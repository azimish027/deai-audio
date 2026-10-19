"""DeepFilterNet 降噪：atten_lim_db 控制最大衰减量。"""
from __future__ import annotations

import numpy as np

from ..session.session import Session
from ..config.constants import denoise_strength_to_atten_lim


class Denoiser:
    """DeepFilterNet 流式封装。内部懒加载模型。"""

    def __init__(self, atten_lim_db: float = 15.0):
        self.atten_lim_db = atten_lim_db
        self._model = None
        self._stream = None

    def _ensure_model(self) -> None:
        if self._model is None:
            from deepfilter_stream import DeepFilterModel
            self._model = DeepFilterModel()
        if self._stream is None:
            self._stream = self._model.new_stream(atten_lim_db=self.atten_lim_db)

    def denoise(self, audio: np.ndarray, sr: int) -> np.ndarray:
        audio = audio.astype(np.float32)
        try:
            self._ensure_model()
        except Exception:
            return audio  # 模型不可用则原样返回

        # DeepFilterNet 流式逐块（单声道）
        if audio.ndim == 1:
            return self._denoise_mono(audio, sr)
        out = np.zeros_like(audio)
        for ch in range(audio.shape[1]):
            out[:, ch] = self._denoise_mono(audio[:, ch], sr)
        return out

    def _denoise_mono(self, mono: np.ndarray, sr: int) -> np.ndarray:
        # DeepFilterNet 按 48kHz 工作；若 sr 不同先临时重采样
        if sr != 48000:
            import librosa
            orig_len = len(mono)
            mono = librosa.resample(mono, orig_sr=sr, target_sr=48000)
            result = self._stream.process(mono) if hasattr(self._stream, "process") else mono
            return librosa.resample(result, orig_sr=48000, target_sr=sr)[:orig_len]
        return self._stream.process(mono) if hasattr(self._stream, "process") else mono


def apply_denoise(session: Session, strength: float) -> Session:
    atten = denoise_strength_to_atten_lim(strength)
    denoiser = Denoiser(atten_lim_db=atten)
    session.working["wav"] = denoiser.denoise(
        session.working["wav"], session.working["sr"]
    )
    return session
