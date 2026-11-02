import subprocess


def encode_to_m4a(wav_path: str, out_path: str) -> str:
    subprocess.run(
        ["ffmpeg", "-y", "-i", wav_path, "-c:a", "aac", "-b:a", "192k", out_path],
        check=True,
        capture_output=True,
    )
    return out_path
