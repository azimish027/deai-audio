"""完整处理链编排 + 降级矩阵。

扩展：每步跑前跑后测同一组指标，把 before / after / delta 塞进
session.measurements，供前端仪表盘、步骤卡、A/B 对比使用。
"""
from __future__ import annotations

import os
import tempfile
import traceback
from typing import Callable, Optional

import numpy as np

from ..session.session import Session, PipelineState, SceneLabel
from ..config.constants import (
    TEMPLATES, TRUE_PEAK_LIMIT_DBTP, TRUE_PEAK_LIMIT_WAV_DBTP,
)
from ..io.decode import decode_to_wav48
from ..io.export import export_all
from ..diagnosis.report import build_diagnosis_report
from ..separation.backend import separate_session
from ..denoise.deepfilter import apply_denoise
from ..segmentation.vad import segment_session
from ..dsp.dc_offset import remove_dc_offset
from ..dsp.declip import declip_sparse
from ..dsp.deverb import apply_deverb
from ..dsp.transient_restore import transient_restore
from ..dsp.deesser import deesser
from ..dsp.pitch_correct import pitch_correct_via_tdpsola
from ..dsp.micro_imperfection import inject_micro_imperfections, inject_floor_noise
from ..dsp.truepeak_limiter import truepeak_limit
from ..loudness.normalize import loudness_normalize


# ============================================================
# 指标测量工具（无依赖，纯 numpy / pyloudnorm）
# ============================================================

def _measure_audio(audio: np.ndarray, sr: int) -> dict:
    """对一段音频测核心指标。任何子指标测量失败都优雅回退。"""
    if audio is None or audio.size == 0:
        return {"lufs": None, "true_peak_dbtp": None, "phase_entropy": None,
                "spectrum_flatness": None, "rms_dbfs": None}

    mono = audio if audio.ndim == 1 else audio.mean(axis=1)

    # RMS dBFS（近似）
    try:
        rms = float(np.sqrt(np.mean(mono ** 2)))
        rms_dbfs = 20.0 * np.log10(max(rms, 1e-12))
    except Exception:
        rms_dbfs = None

    # True peak（简单插值近似——不做完整 4x oversampling，够用）
    try:
        peak = float(np.max(np.abs(audio)))
        true_peak_dbtp = 20.0 * np.log10(max(peak, 1e-12))
    except Exception:
        true_peak_dbtp = None

    # LUFS（EBU R128 —— 可选 pyloudnorm，没装就用 RMS 近似）
    lufs = None
    try:
        import pyloudnorm as pyln
        meter = pyln.Meter(sr)
        measure_in = audio[:, None] if audio.ndim == 1 else audio
        lufs = float(meter.integrated_loudness(measure_in))
    except Exception:
        try:
            # 粗略近似：LUFS ≈ RMS dBFS - 0.691（K-weighting 常数）
            if rms_dbfs is not None:
                lufs = rms_dbfs - 0.7
        except Exception:
            pass

    # 相位熵（1-bit 符号 + 相邻差分）
    try:
        sign = np.sign(mono)
        d = sign[1:] != sign[:-1]
        counts = np.bincount(d.astype(int))
        p = counts / max(counts.sum(), 1)
        phase_entropy = float(-np.sum(p * np.log2(p + 1e-12)))
        # 归一化到 [0, 1]（log2(2) = 1 上限）
        phase_entropy = min(1.0, phase_entropy)
    except Exception:
        phase_entropy = None

    # 频谱平坦度
    spectrum = np.abs(np.fft.rfft(mono[:sr * 5])) if len(mono) >= sr * 5 else np.abs(np.fft.rfft(mono))
    spectrum = spectrum + 1e-12
    try:
        geo_mean = float(np.exp(np.mean(np.log(spectrum))))
        ari_mean = float(np.mean(spectrum))
        spectrum_flatness = geo_mean / ari_mean if ari_mean > 0 else None
    except Exception:
        spectrum_flatness = None

    return {
        "lufs": lufs,
        "true_peak_dbtp": true_peak_dbtp,
        "phase_entropy": phase_entropy,
        "spectrum_flatness": spectrum_flatness,
        "rms_dbfs": rms_dbfs,
    }


def _delta_str(before: float | None, after: float | None) -> str:
    if before is None or after is None:
        return "—"
    d = after - before
    sign = "+" if d > 0 else ""
    return f"{sign}{d:.2f}"


# ============================================================
# Pipeline Step 元信息（给前端步骤卡用人话解释）
# ============================================================

STEP_META: dict[str, dict] = {
    "decode": {
        "name": "解码 + 48kHz 重采样",
        "explain": "WAV/MP3/M4A/FLAC → 48kHz 浮点，统一采样率方便后续处理。",
    },
    "dc_offset": {
        "name": "DC Offset 去除",
        "explain": "把波形整体归零，避免后续处理产生偏置。",
    },
    "declip": {
        "name": "削波修复",
        "explain": "稀疏重建削波峰值，把 >0.99 的样本拉回到正常范围。",
    },
    "separation": {
        "name": "源分离（Demucs）",
        "explain": "把人声/鼓/贝斯/其他分开，每条轨道单独处理再混音。",
    },
    "denoise": {
        "name": "降噪（DeepFilterNet）",
        "explain": "深度学习模型压制背景噪声，保留人声清晰。",
    },
    "deverb": {
        "name": "去混响",
        "explain": "湿声残留过高的部分，保留 15% 自然空间感。",
    },
    "transient_restore": {
        "name": "瞬态恢复",
        "explain": "把起音瞬间补到目标 dB，让咬字更利落。",
    },
    "deesser": {
        "name": "去齿音",
        "explain": "压缩高频刺耳的 s/z 发音，保留清晰度。",
    },
    "loudness_normalize": {
        "name": "响度标准化（EBU R128）",
        "explain": "双遍测量 + 线性增益，对齐到模板目标 LUFS。",
    },
    "true_peak_limit": {
        "name": "True Peak 限幅",
        "explain": "防止编码过冲，把真峰值压到 -1.0 dBTP 以下。",
    },
}


def _human_step_sentence(step_id: str, before: dict, after: dict) -> str:
    """根据 before/after 自动生成一句人话。"""
    meta = STEP_META.get(step_id, {})
    base = meta.get("explain", "")

    if step_id == "loudness_normalize":
        b, a = before.get("lufs"), after.get("lufs")
        if b is not None and a is not None:
            return f"响度从 {b:.1f} LUFS → {a:.1f} LUFS，{base}"
    elif step_id == "denoise":
        b, a = before.get("spectrum_flatness"), after.get("spectrum_flatness")
        if b is not None and a is not None and b > a:
            return f"噪声成分下降（平坦度 {b:.2f}→{a:.2f}），{base}"
    elif step_id == "transient_restore":
        b, a = before.get("phase_entropy"), after.get("phase_entropy")
        if b is not None and a is not None and a > b:
            return f"相位熵 {b:.2f}→{a:.2f}，咬字更自然，{base}"
    elif step_id == "true_peak_limit":
        b, a = before.get("true_peak_dbtp"), after.get("true_peak_dbtp")
        if b is not None and a is not None and b > -1.0:
            return f"真峰值 {b:.1f}→{a:.1f} dBTP，防编码过冲，{base}"
    elif step_id == "declip":
        b, a = before.get("true_peak_dbtp"), after.get("true_peak_dbtp")
        if b is not None and a is not None:
            return f"削波峰值 {b:.1f}→{a:.1f} dBTP，{base}"

    return base


class Pipeline:
    """完整处理链。任何单模块失败都不阻塞导出。

    扩展：每步 before/after 指标自动塞进 session.measurements，结构：
        {
          "before": { ...解码后第一次全量测量 },
          "after":  { ...全部跑完后的终态测量 },
          "steps": [
            { step_id, name, status, human,
              before: {lufs, true_peak_dbtp, phase_entropy, spectrum_flatness, rms_dbfs},
              after:  { ...},
              delta:  { ...}
            }, ...
          ],
          "lufs_target": -16.0,   # 来自模板
          "true_peak_limit_dbtp": -1.0
        }
    """

    def __init__(self, tmp_dir: Optional[str] = None):
        self._tmp_dir = tmp_dir or tempfile.mkdtemp(prefix="deai_pipeline_")

    # ───────── 统一的 step 测量 helper ─────────
    def _record_step(self, sess: Session, step_id: str,
                     audio_before: np.ndarray | None,
                     audio_after: np.ndarray | None,
                     status: str = "ok", note: str = "") -> None:
        sr = sess.working.get("sr", 48000)
        before = _measure_audio(audio_before, sr) if audio_before is not None else {}
        after = _measure_audio(audio_after, sr) if audio_after is not None else {}
        delta = {}
        for k in ("lufs", "true_peak_dbtp", "phase_entropy", "spectrum_flatness", "rms_dbfs"):
            b = before.get(k)
            a = after.get(k)
            if b is not None and a is not None:
                delta[k] = round(a - b, 4)
            else:
                delta[k] = None
        meta = STEP_META.get(step_id, {})
        sess.measurements["steps"].append({
            "step_id": step_id,
            "name": meta.get("name", step_id),
            "explain": meta.get("explain", ""),
            "human": _human_step_sentence(step_id, before, after),
            "status": status,
            "note": note,
            "before": before,
            "after": after,
            "delta": delta,
        })


    def _detect_breath_frames(self, audio: np.ndarray, sr: int,
                              win_ms: int = 20, rms_db_threshold: float = -42.0,
                              drop_ratio: float = 0.3) -> np.ndarray:
        """
        检测气口/尾音帧。返回 bool mask（shape == audio.shape，False=正常，True=气口）。
        逻辑：短窗 RMS < -42dBFS 且 RMS 比前后窗 drop > 30% → 气口候选。
        纯能量-based，无需 f0 检测。
        """
        if audio is None or len(audio) < sr * 0.1:
            return np.zeros(len(audio), dtype=bool)

        mono = audio if audio.ndim == 1 else audio.mean(axis=1)
        win = int(sr * win_ms / 1000)
        if win < 1:
            return np.zeros(len(mono), dtype=bool)

        n_windows = len(mono) // win
        if n_windows < 3:
            return np.zeros(len(mono), dtype=bool)

        # 窗级 RMS
        rms = np.array([
            float(np.sqrt(np.mean(mono[i * win:(i + 1) * win] ** 2)))
            for i in range(n_windows)
        ])
        rms_db = 20.0 * np.log10(rms + 1e-10)

        # 气口候选：当前窗 RMS 低于阈值，且比前后窗 drop > drop_ratio
        breath_windows = np.zeros(n_windows, dtype=bool)
        for i in range(1, n_windows - 1):
            if rms_db[i] < rms_db_threshold:
                forward_drop = (rms[i - 1] - rms[i]) / (rms[i - 1] + 1e-10)
                backward_drop = (rms[i + 1] - rms[i]) / (rms[i + 1] + 1e-10)
                if forward_drop > drop_ratio or backward_drop > drop_ratio:
                    breath_windows[i] = True

        # 扩展 1 窗左右（气口不是 1 个窗，是一段）
        expanded = breath_windows.copy()
        for i in range(1, n_windows - 1):
            if breath_windows[i]:
                expanded[max(0, i - 1)] = True
                expanded[min(n_windows - 1, i + 1)] = True

        # 展开到样本级
        frame_mask = np.zeros(len(mono), dtype=bool)
        for i in range(n_windows):
            if expanded[i]:
                frame_mask[i * win:(i + 1) * win] = True

        # 多声道适配
        if audio.ndim == 2:
            return np.tile(frame_mask[:, None], (1, audio.shape[1]))
        return frame_mask

    # ───────── 主流程 ─────────
    def run(
        self,
        src_path: str,
        template_id: str = "studio_vocal",
        params: Optional[dict] = None,
    ) -> Session:
        """
        params 可空，结构：
            {
              "enabled":    {step_id: bool, ...},   # False → 该步跳过，status="skipped"
              "strengths":  {step_id: float, ...}, # 覆盖模板默认值；1.0 = 原值
            }
        """
        params = params or {}
        enabled_dict: dict[str, bool] = params.get("enabled") or {}
        strengths: dict[str, float] = params.get("strengths") or {}
        human_override: dict = params.get("human_preserve") or {}

        def _is_on(step_id: str, default: bool = True) -> bool:
            return enabled_dict.get(step_id, default)

        sess = Session()
        sess.source.path = src_path
        sess.template_id = template_id
        sess.tmp_dir = self._tmp_dir
        sess.params = params   # type: ignore[attr-defined]  # 回显到前端

        tmpl = TEMPLATES.get(template_id, TEMPLATES["studio_vocal"])

        # ── human_preserve：模板默认 + 用户覆盖 ──
        hp_default = tmpl.get("human_preserve", {}) or {}
        hp = {**hp_default, **human_override}   # 用户 params 最后覆盖
        hp_on = bool(hp.get("enabled", hp_default.get("enabled", True)))

        # strength override helper：模板值 × strength_multiplier
        def _s(step_id: str, template_default: float, *, minv: float = 0.0, maxv: float = 999.0) -> float:
            mul = strengths.get(step_id, 1.0)
            return max(minv, min(maxv, template_default * mul))

        # ★ 人味保护：denoise_strength ×0.6（气口/尾音一起被当噪声音掉）
        #    deverb_wet_retention ×1.5（口腔共鸣是"人"的标记）
        denoise_strength_hp = tmpl["denoise_strength"]
        deverb_wet_hp = tmpl["deverb_wet_retention"]
        pitch_enabled_hp = False   # 默认不修音（反直觉点）
        pitch_tol_hp = hp.get("pitch_tolerance_cents", hp_default.get("pitch_tolerance_cents", 15))
        loudness_tol_hp = hp.get("loudness_tolerance_lufs", hp_default.get("loudness_tolerance_lufs", 1.5))
        keep_breath_hp = hp.get("keep_breath", hp_default.get("keep_breath", True))
        keep_slur_hp = hp.get("keep_slur", hp_default.get("keep_slur", True))
        dynamic_wide_hp = hp.get("dynamic_wide", hp_default.get("dynamic_wide", True))
        target_lufs_hp = tmpl.get("il_target_lufs", -16.0)

        if hp_on:
            denoise_strength_hp *= hp.get("denoise_strength_mult", hp_default.get("denoise_strength_mult", 0.6))
            deverb_wet_hp *= hp.get("deverb_wet_retention_mult", hp_default.get("deverb_wet_retention_mult", 1.5))
            # 修音只在"偏差 > tolerance"时才触发（故意留微偏差）
            # keep_slur=True 时不修音（不修音 = 自然保留滑音）
            pitch_enabled_hp = (
                hp.get("pitch_correct", hp_default.get("pitch_correct", True))
                and not keep_slur_hp   # 保留滑音 → 不修音
            )

        sess.measurements = {  # type: ignore[attr-defined]  # 运行时动态字段
            "before": {},
            "after": {},
            "steps": [],
            "lufs_target": tmpl.get("il_target_lufs", -16.0),
            "true_peak_limit_dbtp": TRUE_PEAK_LIMIT_WAV_DBTP,
            "template_id": template_id,
            "enabled": enabled_dict,
            "strengths": strengths,
            "human_preserve": hp,
        }

        # 把子方法需要的 hp 变量直接挂到 measurements 里（子方法从 sess.measurements 读）
        sess.measurements["_hp"] = {
            "on": hp_on,
            "denoise_strength_override": denoise_strength_hp,
            "deverb_wet_override": deverb_wet_hp,
            "pitch_enabled": pitch_enabled_hp,
            "pitch_tol_cents": pitch_tol_hp,
            "loudness_tol_lufs": loudness_tol_hp,
            "keep_breath": keep_breath_hp,
            "keep_slur": keep_slur_hp,
            "dynamic_wide": dynamic_wide_hp,
            "target_lufs": target_lufs_hp,
        }

        # ── 1. 解码（不能关） ──
        sess.state = PipelineState.UPLOADED
        try:
            decode_to_wav48(sess)
        except Exception as e:
            raise RuntimeError(f"Decode failed: {e}")
        sess.state = PipelineState.DECODED

        # 解码后的全量 before 快照
        sess.measurements["before"] = _measure_audio(sess.working["wav"], sess.working["sr"])

        # ── 2. DC 去除 ──
        if _is_on("dc_offset"):
            try:
                audio_in = sess.working["wav"]
                audio_out = remove_dc_offset(audio_in)
                sess.working["wav"] = audio_out
                self._record_step(sess, "dc_offset", audio_in, audio_out, "ok")
            except Exception as e:
                self._record_step(sess, "dc_offset", None, None, "skipped", str(e))
        else:
            self._record_step(sess, "dc_offset", None, None, "skipped", "用户关闭")

        # ── 3. 削波修复 ──
        if _is_on("declip"):
            try:
                audio_in = sess.working["wav"]
                audio_out = declip_sparse(audio_in, sess.working["sr"])
                sess.working["wav"] = audio_out
                self._record_step(sess, "declip", audio_in, audio_out, "ok")
            except Exception as e:
                self._record_step(sess, "declip", None, None, "skipped", str(e))
        else:
            self._record_step(sess, "declip", None, None, "skipped", "用户关闭")

        # ── 4. 诊断（不处理音频，只测量，不接受开关） ──
        try:
            sess.diagnosis = build_diagnosis_report(sess)
        except Exception:
            traceback.print_exc()
        sess.state = PipelineState.DIAGNOSED

        # ── 5. 源分离 ──
        if _is_on("separation"):
            try:
                audio_in = sess.working["wav"]
                sess = separate_session(sess)
                audio_out = sess.working["wav"]
                self._record_step(sess, "separation", audio_in, audio_out, "ok")
            except Exception as e:
                sess.stems = type(sess.stems)()
                self._record_step(sess, "separation", None, None, "skipped", str(e))
        else:
            # 用户关了分离，清空 stems（后续 stem_factor=0.8 走全混音处理）
            sess.stems = type(sess.stems)()
            self._record_step(sess, "separation", None, None, "skipped", "用户关闭")
        sess.state = PipelineState.SEPARATED

        # ── 6. 分段（不关） ──
        try:
            sess = segment_session(sess)
        except Exception:
            sess.segments = [SceneSegment(0.0, sess.source.duration_s, SceneLabel.MONOLOGUE, 0.5)]
        sess.state = PipelineState.SEGMENTED

        # ── 7. 模板 DSP 链（接受 enabled + strengths） ──
        sess = self._apply_template_chain(sess, tmpl, enabled_dict, strengths)
        sess.state = PipelineState.PROCESSING

        # ── 8. 标准化（接受 enabled + strengths） ──
        sess = self._apply_normalize(sess, tmpl, enabled_dict, strengths)
        sess.state = PipelineState.NORMALIZED

        # 终态 after 快照
        sess.measurements["after"] = _measure_audio(sess.working["wav"], sess.working["sr"])

        # ── 9. 导出（不关） ──
        out_dir = os.path.join(self._tmp_dir, "exports")
        try:
            export_all(sess, out_dir)
        except Exception as e:
            traceback.print_exc()
        sess.state = PipelineState.EXPORTED

        return sess

    def _apply_template_chain(
        self,
        sess: Session,
        tmpl: dict,
        enabled: dict[str, bool],
        strengths: dict[str, float],
    ) -> Session:
        def _on(step_id: str) -> bool:
            return enabled.get(step_id, True)
        def _s(step_id: str, default: float, *, lo: float = 0.0, hi: float = 999.0) -> float:
            mul = strengths.get(step_id, 1.0)
            return max(lo, min(hi, default * mul))

        audio = sess.working["wav"]
        sr = sess.working["sr"]
        stem_factor = 1.0 if sess.stems.vocals is not None else 0.8

        # 7a. 降噪 (+ keep_breath 气口保护)
        if _on("denoise"):
            try:
                audio_in = audio
                hp_denoise = sess.measurements.get("_hp", {}).get("denoise_strength_override", tmpl["denoise_strength"])
                hp_keep_breath = sess.measurements.get("_hp", {}).get("keep_breath", True)

                # ★ keep_breath：denoise 前检测气口帧 mask（短窗 RMS + 能量下降沿）
                breath_mask = None
                if hp_keep_breath:
                    breath_mask = self._detect_breath_frames(audio, sr)

                audio = apply_denoise(sess, _s("denoise", hp_denoise) * stem_factor).working["wav"]

                # ★ keep_breath：denoise 后对气口帧反向抬 0.8dB（把被过度降噪的气口/尾音还原）
                if breath_mask is not None and breath_mask.any():
                    breath_gain = 10 ** (0.8 / 20.0)   # +0.8dB 线性增益
                    if audio.ndim == 1:
                        audio[breath_mask] *= breath_gain
                    else:
                        for ch in range(audio.shape[1]):
                            audio[breath_mask, ch] *= breath_gain

                self._record_step(sess, "denoise", audio_in, audio, "ok")
            except Exception as e:
                self._record_step(sess, "denoise", None, None, "skipped", str(e))
        else:
            self._record_step(sess, "denoise", None, None, "skipped", "用户关闭")

        # 7b. 去混响（strength 越小越激进 → wet_retention 越小）
        if _on("deverb"):
            try:
                audio_in = audio
                # strength=1.0 → 模板原值；strength=0 → wet_retention 降 20%
                hp_deverb = sess.measurements.get("_hp", {}).get("deverb_wet_override", tmpl["deverb_wet_retention"])
                wet = hp_deverb * (1.0 - 0.2 * (1.0 - strengths.get("deverb", 1.0)))
                audio = apply_deverb(audio, sr, wet_retention=wet)
                self._record_step(sess, "deverb", audio_in, audio, "ok")
            except Exception as e:
                self._record_step(sess, "deverb", None, None, "skipped", str(e))
        else:
            self._record_step(sess, "deverb", None, None, "skipped", "用户关闭")

        # 7c. 瞬态恢复
        if _on("transient_restore"):
            try:
                audio_in = audio
                audio = transient_restore(
                    audio, sr,
                    target_transient_db=tmpl["transient_target_db"],
                    max_restore_db=_s("transient_restore", tmpl["transient_max_restore_db"]),
                )
                self._record_step(sess, "transient_restore", audio_in, audio, "ok")
            except Exception as e:
                self._record_step(sess, "transient_restore", None, None, "skipped", str(e))
        else:
            self._record_step(sess, "transient_restore", None, None, "skipped", "用户关闭")

        # 7d. 去齿音
        if _on("deesser"):
            try:
                audio_in = audio
                mul = strengths.get("deesser", 1.0)
                level = "medium" if mul > 0.7 else "light" if mul > 0.3 else "off"
                audio = deesser(audio, sr, level=level)
                self._record_step(sess, "deesser", audio_in, audio, "ok")
            except Exception as e:
                self._record_step(sess, "deesser", None, None, "skipped", str(e))
        else:
            self._record_step(sess, "deesser", None, None, "skipped", "用户关闭")

        # 7e. 音高修正（默认关闭） + 7f. 微瑕疵注入（不进 steps）
        try:
            hp_pitch_enabled = sess.measurements.get("_hp", {}).get("pitch_enabled", False)
            _ = pitch_correct_via_tdpsola(audio, sr, f0_shift_cents=0.0, enable=hp_pitch_enabled)
        except Exception:
            pass
        try:
            scene_label = sess.segments[0].scene_label.value if sess.segments else "monologue"
            audio = inject_micro_imperfections(audio, sr, scene_label=scene_label,
                                               do_pitch=True, do_volume=True, do_time=True)
        except Exception:
            pass

        sess.working["wav"] = audio
        return sess

    def _apply_normalize(
        self,
        sess: Session,
        tmpl: dict,
        enabled: dict[str, bool],
        strengths: dict[str, float],
    ) -> Session:
        def _on(step_id: str) -> bool:
            return enabled.get(step_id, True)
        def _s(step_id: str, default: float) -> float:
            mul = strengths.get(step_id, 1.0)
            return default + (mul - 1.0) * 1.0   # 每 ±0.5 strength → ±1 LUFS 偏移

        audio = sess.working["wav"]
        sr = sess.working["sr"]

        # 8a. 响度标准化 (+ dynamic_wide: 容忍内跳过)
        if _on("loudness_normalize"):
            try:
                audio_in = audio
                target = _s("loudness_normalize", tmpl["il_target_lufs"])

                hp_dynamic_wide = sess.measurements.get("_hp", {}).get("dynamic_wide", True)
                hp_loudness_tol = sess.measurements.get("_hp", {}).get("loudness_tol_lufs", 1.5)

                # ★ dynamic_wide：先测一次 IL，如果已经在容忍范围内就跳过压缩
                if hp_dynamic_wide:
                    try:
                        import pyloudnorm as pyln
                        meter = pyln.Meter(sr)
                        measure = audio[:, None] if audio.ndim == 1 else audio
                        current_il = float(meter.integrated_loudness(measure))
                        il_dev = abs(current_il - target)
                        if il_dev <= hp_loudness_tol:
                            # 已在容忍内，跳过 normalize（保留自然动态）
                            self._record_step(
                                sess, "loudness_normalize", audio_in, audio_in, "ok",
                                f"dynamic_wide: IL={current_il:.1f} 已在 ±{hp_loudness_tol:.1f} LUFS 容忍内，跳过压缩",
                            )
                        else:
                            audio, il, lra = loudness_normalize(audio, sr, target_lufs=target)
                            sess.diagnosis.mechanical_signature.lra_lu = lra
                            self._record_step(sess, "loudness_normalize", audio_in, audio, "ok")
                    except Exception:
                        audio, il, lra = loudness_normalize(audio, sr, target_lufs=target)
                        sess.diagnosis.mechanical_signature.lra_lu = lra
                        self._record_step(sess, "loudness_normalize", audio_in, audio, "ok")
                else:
                    # dynamic_wide=False → 电台感优先，硬压到 target
                    audio, il, lra = loudness_normalize(audio, sr, target_lufs=target)
                    sess.diagnosis.mechanical_signature.lra_lu = lra
                    self._record_step(sess, "loudness_normalize", audio_in, audio, "ok")
            except Exception as e:
                self._record_step(sess, "loudness_normalize", None, None, "skipped", str(e))
        else:
            self._record_step(sess, "loudness_normalize", None, None, "skipped", "用户关闭")

        # 8b. True Peak 限制
        if _on("true_peak_limit"):
            try:
                audio_in = audio
                audio = truepeak_limit(audio, sr, limit_dbfs=TRUE_PEAK_LIMIT_WAV_DBTP)
                self._record_step(sess, "true_peak_limit", audio_in, audio, "ok")
            except Exception as e:
                self._record_step(sess, "true_peak_limit", None, None, "skipped", str(e))
        else:
            self._record_step(sess, "true_peak_limit", None, None, "skipped", "用户关闭")

        sess.working["wav"] = audio
        return sess


# 向后兼容别名（Session.segments 实际是 list[Segment]，不需要导入）
from ..session.session import Segment as SceneSegment  # noqa: E402
