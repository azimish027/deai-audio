"""完整处理链编排 + 降级矩阵。"""
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


class Pipeline:
    """完整处理链。任何单模块失败都不阻塞导出。"""

    def __init__(self, tmp_dir: Optional[str] = None):
        self._tmp_dir = tmp_dir or tempfile.mkdtemp(prefix="deai_pipeline_")

    def run(self, src_path: str, template_id: str = "studio_vocal") -> Session:
        sess = Session()
        sess.source.path = src_path
        sess.template_id = template_id
        sess.tmp_dir = self._tmp_dir

        # ── 1. 解码 ──
        sess.state = PipelineState.UPLOADED
        try:
            decode_to_wav48(sess)
        except Exception as e:
            raise RuntimeError(f"Decode failed: {e}")
        sess.state = PipelineState.DECODED

        # ── 2. DC 去除 ──
        try:
            sess.working["wav"] = remove_dc_offset(sess.working["wav"])
        except Exception:
            pass

        # ── 3. 削波修复 ──
        try:
            sess.working["wav"] = declip_sparse(
                sess.working["wav"], sess.working["sr"]
            )
        except Exception:
            pass

        # ── 4. 诊断 ──
        try:
            sess.diagnosis = build_diagnosis_report(sess)
        except Exception:
            traceback.print_exc()
        sess.state = PipelineState.DIAGNOSED

        # ── 5. 源分离（可回退全混音） ──
        try:
            sess = separate_session(sess)
        except Exception:
            sess.stems = type(sess.stems)()
        sess.state = PipelineState.SEPARATED

        # ── 6. 分段 ──
        try:
            sess = segment_session(sess)
        except Exception:
            # 退化：整文件一个段
            sess.segments = [SceneSegment(0.0, sess.source.duration_s, SceneLabel.MONOLOGUE, 0.5)]
        sess.state = PipelineState.SEGMENTED

        # ── 7. 模板 DSP 链 ──
        sess = self._apply_template_chain(sess)
        sess.state = PipelineState.PROCESSING

        # ── 8. 标准化 ──
        sess = self._apply_normalize(sess)
        sess.state = PipelineState.NORMALIZED

        # ── 9. 导出 ──
        out_dir = os.path.join(self._tmp_dir, "exports")
        try:
            export_all(sess, out_dir)
        except Exception as e:
            traceback.print_exc()
        sess.state = PipelineState.EXPORTED

        return sess

    def _apply_template_chain(self, sess: Session) -> Session:
        tmpl = TEMPLATES.get(sess.template_id, TEMPLATES["studio_vocal"])
        audio = sess.working["wav"]
        sr = sess.working["sr"]

        # 全混音时强度降低 20%
        stem_factor = 1.0 if sess.stems.vocals is not None else 0.8

        # 7a. 降噪
        try:
            audio = apply_denoise(sess, tmpl["denoise_strength"] * stem_factor).working["wav"]
        except Exception:
            pass

        # 7b. 去混响
        try:
            audio = apply_deverb(audio, sr, wet_retention=tmpl["deverb_wet_retention"])
        except Exception:
            pass

        # 7c. 瞬态恢复
        try:
            audio = transient_restore(
                audio, sr,
                target_transient_db=tmpl["transient_target_db"],
                max_restore_db=tmpl["transient_max_restore_db"],
            )
        except Exception:
            pass

        # 7d. 去齿音
        try:
            audio = deesser(audio, sr, level=tmpl["deesser_level"])
        except Exception:
            pass

        # 7e. 音高修正（共振峰保留）
        try:
            audio = pitch_correct_via_tdpsola(audio, sr, f0_shift_cents=0.0, enable=False)
        except Exception:
            pass

        # 7f. 微瑕疵注入
        try:
            # 根据第一段场景判断
            scene_label = sess.segments[0].scene_label.value if sess.segments else "monologue"
            audio = inject_micro_imperfections(
                audio, sr, scene_label=scene_label,
                do_pitch=True, do_volume=True, do_time=True,
            )
        except Exception:
            pass

        sess.working["wav"] = audio
        return sess

    def _apply_normalize(self, sess: Session) -> Session:
        tmpl = TEMPLATES.get(sess.template_id, TEMPLATES["studio_vocal"])
        audio = sess.working["wav"]
        sr = sess.working["sr"]

        # 8a. 双遍标准化
        try:
            audio, il, lra = loudness_normalize(audio, sr, target_lufs=tmpl["il_target_lufs"])
            sess.diagnosis.mechanical_signature.lra_lu = lra
        except Exception:
            pass

        # 8b. WAV TP 限制
        try:
            audio = truepeak_limit(audio, sr, limit_dbfs=TRUE_PEAK_LIMIT_WAV_DBTP)
        except Exception:
            pass

        # 8c. 给 M4A/MP3 留额外余量（导出环节会再编码，限幅器应先让 WAV 也留有余量）
        # 这里用统一 -1.5 dBTP，后续 export_all 编码前再归一化到 -1.0 peak
        sess.working["wav"] = audio
        return sess


# 向后兼容别名（Session.segments 实际是 list[Segment]，不需要导入）
from ..session.session import Segment as SceneSegment  # noqa: E402
