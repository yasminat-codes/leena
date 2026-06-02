#!/usr/bin/env python3
"""Evaluate a trained openWakeWord model against real WAV corpora.

This harness refuses to invent data. It requires:
- a trained openWakeWord-compatible ONNX model
- 16 kHz mono PCM WAV ambient files with no wake phrase
- 16 kHz mono PCM WAV positive files, one wake phrase per file
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
import time
import wave
from dataclasses import dataclass
from pathlib import Path

SAMPLE_RATE = 16000
SAMPLE_WIDTH_BYTES = 2
CHANNELS = 1
FRAME_SAMPLES = 1280
MIN_AMBIENT_SECONDS = 3600
MIN_POSITIVE_CLIPS = 50


@dataclass
class ClipResult:
    path: Path
    duration_seconds: float
    trigger_count: int
    first_trigger_seconds: float | None
    scores: list[float]
    latencies_ms: list[float]


@dataclass
class ThresholdResult:
    threshold: float
    ambient_seconds: float
    false_accepts: int
    false_accepts_per_hour: float
    positive_count: int
    misses: int
    false_reject_percent: float
    mean_latency_ms: float
    p95_latency_ms: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Measure openWakeWord FA/hr and FR% from real 16 kHz WAV corpora.",
    )
    parser.add_argument("--model", required=True, type=Path, help="Path to .onnx model")
    parser.add_argument(
        "--ambient-dir",
        required=True,
        type=Path,
        help="Directory of ambient 16 kHz mono PCM WAV files with no wake phrase",
    )
    parser.add_argument(
        "--positive-dir",
        required=True,
        type=Path,
        help="Directory of positive 16 kHz mono PCM WAV files, one wake phrase per file",
    )
    parser.add_argument(
        "--thresholds",
        default="0.5",
        help="Single threshold, comma list, or range start:end:step; default 0.5",
    )
    parser.add_argument("--framework", default="onnx", choices=("onnx", "tflite"))
    parser.add_argument("--refractory-seconds", type=float, default=3.0)
    parser.add_argument("--target-fa-per-hour", type=float, default=2.0)
    parser.add_argument("--target-fr-percent", type=float, default=10.0)
    parser.add_argument("--verifier", default="none", help="Verifier label for report output")
    parser.add_argument("--output", type=Path, help="Optional markdown report path")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of markdown")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    thresholds = parse_thresholds(args.thresholds)
    validate_inputs(args.model, args.ambient_dir, args.positive_dir)

    try:
        import numpy as np
        from openwakeword.model import Model
    except ImportError as error:
        print(
            "Missing dependency. Create a temp venv and run: python -m pip install openwakeword",
            file=sys.stderr,
        )
        print(str(error), file=sys.stderr)
        return 3

    ambient_files = list_wavs(args.ambient_dir)
    positive_files = list_wavs(args.positive_dir)
    results: list[ThresholdResult] = []

    for threshold in thresholds:
        model = Model(
            wakeword_models=[str(args.model)],
            inference_framework=args.framework,
        )
        ambient_results = [
            evaluate_clip(model, path, threshold, args.refractory_seconds, np)
            for path in ambient_files
        ]
        positive_results = [
            evaluate_clip(model, path, threshold, args.refractory_seconds, np)
            for path in positive_files
        ]
        results.append(summarize_threshold(threshold, ambient_results, positive_results))

    payload = {
        "model": str(args.model),
        "model_size_bytes": model_size_bytes(args.model),
        "verifier": args.verifier,
        "thresholds": [result.__dict__ for result in results],
        "chosen": chosen_threshold(results, args.target_fa_per_hour, args.target_fr_percent),
        "targets": {
            "false_accepts_per_hour": args.target_fa_per_hour,
            "false_reject_percent": args.target_fr_percent,
        },
    }

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        report = render_markdown(payload)
        print(report)
        if args.output:
            args.output.write_text(report, encoding="utf-8")

    return 0 if payload["chosen"] is not None else 2


def parse_thresholds(value: str) -> list[float]:
    value = value.strip()
    if ":" in value:
        parts = [float(part) for part in value.split(":")]
        if len(parts) != 3:
            raise ValueError("--thresholds range must be start:end:step")
        start, end, step = parts
        if step <= 0:
            raise ValueError("--thresholds step must be positive")
        count = int(math.floor((end - start) / step)) + 1
        return [round(start + (index * step), 6) for index in range(count + 1) if start + (index * step) <= end + 1e-9]
    return [float(part.strip()) for part in value.split(",") if part.strip()]


def validate_inputs(model: Path, ambient_dir: Path, positive_dir: Path) -> None:
    if not model.is_file():
        raise FileNotFoundError(f"Model not found: {model}")
    ambient_files = validate_audio_directory(ambient_dir)
    positive_files = validate_audio_directory(positive_dir)

    ambient_seconds = sum(wav_duration_seconds(path) for path in ambient_files)
    if ambient_seconds < MIN_AMBIENT_SECONDS:
        raise ValueError(
            f"Ambient corpus must be at least {MIN_AMBIENT_SECONDS} seconds; "
            f"found {ambient_seconds:.1f} seconds",
        )
    if len(positive_files) < MIN_POSITIVE_CLIPS:
        raise ValueError(
            f"Positive corpus must include at least {MIN_POSITIVE_CLIPS} WAV files; "
            f"found {len(positive_files)}",
        )


def validate_audio_directory(directory: Path) -> list[Path]:
    if not directory.is_dir():
        raise NotADirectoryError(f"Audio directory not found: {directory}")
    wav_files = list_wavs(directory)
    if not wav_files:
        raise FileNotFoundError(f"No .wav files found in {directory}")
    for path in wav_files:
        wav_duration_seconds(path)
    return wav_files


def list_wavs(directory: Path) -> list[Path]:
    return sorted(path for path in directory.rglob("*.wav") if path.is_file())


def wav_duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as wav_file:
        validate_wav_format(path, wav_file)
        return wav_file.getnframes() / SAMPLE_RATE


def evaluate_clip(model, path: Path, threshold: float, refractory_seconds: float, np) -> ClipResult:
    samples = read_wav(path, np)
    duration_seconds = len(samples) / SAMPLE_RATE
    refractory_frames = max(1, math.ceil(refractory_seconds / (FRAME_SAMPLES / SAMPLE_RATE)))
    trigger_count = 0
    frames_since_trigger = refractory_frames
    first_trigger_seconds: float | None = None
    scores: list[float] = []
    latencies_ms: list[float] = []

    if hasattr(model, "reset"):
        model.reset()

    for frame_index, start in enumerate(range(0, len(samples), FRAME_SAMPLES)):
        chunk = samples[start : start + FRAME_SAMPLES]
        if len(chunk) < FRAME_SAMPLES:
            chunk = np.pad(chunk, (0, FRAME_SAMPLES - len(chunk)), mode="constant")

        started = time.perf_counter()
        prediction = model.predict(chunk)
        latencies_ms.append((time.perf_counter() - started) * 1000)
        score = max_score(prediction)
        scores.append(score)

        if score > threshold and frames_since_trigger >= refractory_frames:
            trigger_count += 1
            frames_since_trigger = 0
            if first_trigger_seconds is None:
                first_trigger_seconds = frame_index * (FRAME_SAMPLES / SAMPLE_RATE)
        else:
            frames_since_trigger += 1

    return ClipResult(
        path=path,
        duration_seconds=duration_seconds,
        trigger_count=trigger_count,
        first_trigger_seconds=first_trigger_seconds,
        scores=scores,
        latencies_ms=latencies_ms,
    )


def read_wav(path: Path, np):
    with wave.open(str(path), "rb") as wav_file:
        validate_wav_format(path, wav_file)
        data = wav_file.readframes(wav_file.getnframes())
    return np.frombuffer(data, dtype=np.int16)


def validate_wav_format(path: Path, wav_file) -> None:
    if wav_file.getframerate() != SAMPLE_RATE:
        raise ValueError(f"{path} must be {SAMPLE_RATE} Hz")
    if wav_file.getnchannels() != CHANNELS:
        raise ValueError(f"{path} must be mono")
    if wav_file.getsampwidth() != SAMPLE_WIDTH_BYTES:
        raise ValueError(f"{path} must be 16-bit PCM")
    if wav_file.getcomptype() != "NONE":
        raise ValueError(f"{path} must be uncompressed PCM")


def max_score(prediction) -> float:
    if isinstance(prediction, dict):
        return max(float(value) for value in prediction.values())
    return float(prediction)


def summarize_threshold(
    threshold: float,
    ambient_results: list[ClipResult],
    positive_results: list[ClipResult],
) -> ThresholdResult:
    ambient_seconds = sum(result.duration_seconds for result in ambient_results)
    false_accepts = sum(result.trigger_count for result in ambient_results)
    misses = sum(1 for result in positive_results if result.trigger_count == 0)
    latencies = [
        latency
        for result in [*ambient_results, *positive_results]
        for latency in result.latencies_ms
    ]
    return ThresholdResult(
        threshold=threshold,
        ambient_seconds=ambient_seconds,
        false_accepts=false_accepts,
        false_accepts_per_hour=false_accepts / (ambient_seconds / 3600),
        positive_count=len(positive_results),
        misses=misses,
        false_reject_percent=(misses / len(positive_results)) * 100,
        mean_latency_ms=statistics.fmean(latencies) if latencies else 0,
        p95_latency_ms=percentile(latencies, 95),
    )


def percentile(values: list[float], pct: int) -> float:
    if not values:
        return 0
    ordered = sorted(values)
    index = min(len(ordered) - 1, math.ceil((pct / 100) * len(ordered)) - 1)
    return ordered[index]


def model_size_bytes(model: Path) -> int:
    size = model.stat().st_size
    sidecar = model.with_suffix(f"{model.suffix}.data")
    if sidecar.is_file():
        size += sidecar.stat().st_size
    return size


def chosen_threshold(
    results: list[ThresholdResult],
    target_fa_per_hour: float,
    target_fr_percent: float,
) -> dict | None:
    passing = [
        result
        for result in results
        if result.false_accepts_per_hour <= target_fa_per_hour
        and result.false_reject_percent <= target_fr_percent
    ]
    if not passing:
        return None
    chosen = sorted(
        passing,
        key=lambda result: (
            result.false_accepts_per_hour,
            result.false_reject_percent,
            -result.threshold,
        ),
    )[0]
    return chosen.__dict__


def render_markdown(payload: dict) -> str:
    chosen = payload["chosen"]
    lines = [
        "# Wake Word Measurement Run",
        "",
        f"- Model: `{payload['model']}`",
        f"- Model size: {payload['model_size_bytes']} bytes",
        f"- Verifier used: {payload['verifier']}",
        f"- Chosen threshold: {chosen['threshold'] if chosen else 'none'}",
        "",
        "| Threshold | FA/hr | FR% | Misses | Positives | Mean latency ms | P95 latency ms |",
        "|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for result in payload["thresholds"]:
        lines.append(
            "| {threshold:.3f} | {false_accepts_per_hour:.3f} | "
            "{false_reject_percent:.2f} | {misses} | {positive_count} | "
            "{mean_latency_ms:.2f} | {p95_latency_ms:.2f} |".format(**result)
        )
    lines.extend(
        [
            "",
            "## Outcome",
            "",
            "Targets passed."
            if chosen
            else "No threshold met the configured FA/hr and FR% targets.",
        ]
    )
    return "\n".join(lines)


if __name__ == "__main__":
    raise SystemExit(main())
