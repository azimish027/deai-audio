"""源分离：本地优先 demucs-onnx → 云端回退。"""
from __future__ import annotations

import os
from typing import Optional

import numpy as np

from ..session.session import Session, Stems


class SeparatorBackend:
    """三级回退：demucs-onnx → audio-separator(PyTorch) → 跳过。"""

    def __init__(self, model_path: Optional[str] = None):
        self._model_path = model_path or os.path.expanduser(
            "~/.cache/deai-audio/demucs_onnx"
        )
        self._onnx_model = None
        self._torch_model = None

    def separate(self, audio: np.ndarray, sr: int,
                 force_full_mix_fallback: bool = False) -> Stems:
        """返回 Stems(vocals, accompaniment, ambience)。失败则全部 None。"""
        if force_full_mix_fallback:
            return Stems()

        # 尝试 demucs-onnx
        try:
            result = self._try_onnx(audio, sr)
            if result is not None:
                return result
        except Exception as e:
            print(f"[sep] demucs-onnx failed: {e}")

        # 尝试 audio-separator（PyTorch，需要安装）
        try:
            result = self._try_torch(audio, sr)
            if result is not None:
                return result
        except Exception as e:
            print(f"[sep] audio-separator failed: {e}")

        # 全部失败
        return Stems()

    def _try_onnx(self, audio: np.ndarray, sr: int) -> Optional[Stems]:
        """demucs-onnx 推理（需要先 export）。"""
        import onnxruntime as ort

        if not os.path.isdir(self._model_path):
            return None

        stem_map = {
            "vocals": "htdemucs_ft_vocals_fp16weights.onnx",
            "drums": "htdemucs_ft_drums_fp16weights.onnx",
            "bass": "htdemucs_ft_bass_fp16weights.onnx",
            "other": "htdemucs_ft_other_fp16weights.onnx",
        }

        results = {}
        for stem, filename in stem_map.items():
            fpath = os.path.join(self._model_path, filename)
            if not os.path.isfile(fpath):
                return None
            sess = ort.InferenceSession(fpath, providers=["CPUExecutionProvider"])
            results[stem] = sess.run(None, {"input": audio.T.astype(np.float32)})[0]

        vocals = results["vocals"].T if results["vocals"] is not None else None
        accompaniment = (
            results["drums"].T + results["bass"].T + results["other"].T
            if all(results[k] is not None for k in ("drums", "bass", "other"))
            else None
        )
        ambience = None
        if accompaniment is not None and vocals is not None:
            ambience = audio - vocals - accompaniment

        return Stems(vocals=vocals, accompaniment=accompaniment, ambience=ambience)

    def _try_torch(self, audio: np.ndarray, sr: int) -> Optional[Stems]:
        """audio-separator PyTorch 回退。"""
        try:
            from audio_separator.separator import Separator
        except ImportError:
            return None
        # 仅做占位实现——实际调用 audio-separator API
        return None


def separate_session(session: Session) -> Session:
    """分离 session.working.wav，结果填入 session.stems。
    失败则 stems 全部置 None，后续走全混音模式。
    """
    audio = session.working["wav"]
    sr = session.working["sr"]

    # 根据诊断决定是否跳过
    phase_entropy = session.diagnosis.mechanical_signature.phase_entropy
    # 强声码器残留时，跳过分离走"掩盖"分支
    skip = phase_entropy < 0.55 and session.diagnosis.dominant_damage_type.value == "vocoder_residual"

    sep = SeparatorBackend()
    session.stems = sep.separate(audio, sr, force_full_mix_fallback=skip)
    return session
