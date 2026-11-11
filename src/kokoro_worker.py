import json
import os
import sys
import time
import traceback
from contextlib import redirect_stdout

OUTPUT = sys.__stdout__
DEFAULT_VOICE = "am_fenrir"
SAMPLE_RATE = 24000


def emit(payload):
    OUTPUT.write(json.dumps(payload, ensure_ascii=False) + "\n")
    OUTPUT.flush()


def load_pipeline():
    import torch
    from kokoro import KPipeline

    if not torch.cuda.is_available():
        raise RuntimeError(
            "PyTorch cannot access CUDA. Confirm that the CUDA-enabled PyTorch build "
            "is installed in the GafiSpeak .venv."
        )

    device_name = torch.cuda.get_device_name(0)
    cuda_version = torch.version.cuda

    # Keep library startup messages away from stdout: stdout is the JSON protocol.
    with redirect_stdout(sys.stderr):
        pipeline = KPipeline(lang_code="a", device="cuda")

    return pipeline, device_name, cuda_version


def synthesize(pipeline, request):
    import numpy as np
    import soundfile as sf
    import torch

    text = request.get("text")
    output_path = request.get("output_path")
    request_id = request.get("id")
    voice = request.get("voice", DEFAULT_VOICE)
    if not isinstance(voice, str) or len(voice) > 40 or not voice.replace("_", "").isalnum():
        raise ValueError("The selected voice ID is invalid.")

    if not isinstance(text, str) or not text.strip():
        raise ValueError("The speech text is empty.")
    if not isinstance(output_path, str) or not output_path.strip():
        raise ValueError("The output WAV path is missing.")

    started = time.perf_counter()
    chunks = []

    # Kokoro yields one or more chunks. Collect them into a single WAV for Discord.
    with redirect_stdout(sys.stderr), torch.inference_mode():
        for _graphemes, _phonemes, audio in pipeline(
            text.strip(),
            voice=voice,
            speed=1,
            split_pattern=r"\n+"
        ):
            if torch.is_tensor(audio):
                audio = audio.detach().cpu().numpy()

            chunk = np.asarray(audio, dtype=np.float32).reshape(-1)
            if chunk.size:
                chunks.append(chunk)

    if not chunks:
        raise RuntimeError("Kokoro returned no audio for this message.")

    waveform = chunks[0] if len(chunks) == 1 else np.concatenate(chunks)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    sf.write(output_path, waveform, SAMPLE_RATE, subtype="PCM_16")

    return {
        "type": "done",
        "id": request_id,
        "seconds": round(time.perf_counter() - started, 3)
    }


def main():
    try:
        # Import and initialize once. The model stays resident in VRAM between messages.
        import numpy  # noqa: F401
        import soundfile  # noqa: F401

        pipeline, device_name, cuda_version = load_pipeline()
        emit({
            "type": "ready",
            "device": device_name,
            "cuda": cuda_version
        })
    except Exception as error:
        traceback.print_exc(file=sys.stderr)
        emit({"type": "fatal", "error": str(error)})
        return 1

    for raw_line in sys.stdin:
        request = None
        try:
            request = json.loads(raw_line)
            response = synthesize(pipeline, request)
            emit(response)
        except Exception as error:
            traceback.print_exc(file=sys.stderr)
            request_id = request.get("id") if isinstance(request, dict) else None
            emit({
                "type": "error",
                "id": request_id,
                "error": str(error)
            })

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
