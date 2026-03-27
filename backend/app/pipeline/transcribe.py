"""Audio transcription module using ElevenLabs."""

import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


async def transcribe_video(video_path: str, api_key: str) -> dict:
    """
    Transcribe video audio using ElevenLabs Scribe.

    Args:
        video_path: Path to video file
        api_key: ElevenLabs API key

    Returns:
        Dictionary with transcription data
    """
    import httpx

    logger.info(f"Transcribing video: {video_path}")

    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY not configured")

    try:
        # Extract audio from video
        audio_path = await _extract_audio(video_path)

        # Read audio file
        with open(audio_path, "rb") as f:
            audio_data = f.read()

        # Call ElevenLabs API
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {"file": ("audio.wav", audio_data, "audio/wav")}
            data = {
                "model_id": "scribe_v1",
                "diarize": "true",
                "timestamps_granularity": "word",
            }

            response = await client.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                files=files,
                data=data,
                headers={"xi-api-key": api_key},
            )

            if response.status_code != 200:
                raise RuntimeError(
                    f"ElevenLabs API error: {response.status_code} - {response.text}"
                )

            transcription_data = response.json()

        # Process transcription into segments (1-minute blocks)
        segments = _segment_transcription(transcription_data)

        result = {
            "raw": transcription_data,
            "segments": segments,
            "full_text": _extract_full_text(segments),
            "duration_seconds": _get_duration(segments),
        }

        logger.info(f"Transcription complete: {len(segments)} segments")
        return result

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise RuntimeError(f"Failed to transcribe video: {str(e)}")
    finally:
        # Cleanup audio file
        try:
            audio_path = Path(video_path).with_suffix(".wav")
            if audio_path.exists():
                audio_path.unlink()
        except Exception as e:
            logger.warning(f"Failed to cleanup audio file: {e}")


async def _extract_audio(video_path: str) -> str:
    """Extract audio from video using ffmpeg."""
    import subprocess

    output_path = Path(video_path).with_suffix(".wav")

    logger.info(f"Extracting audio to: {output_path}")

    loop = asyncio.get_event_loop()

    def run_ffmpeg():
        cmd = [
            "ffmpeg",
            "-i",
            video_path,
            "-q:a",
            "9",
            "-n",
            str(output_path),
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg error: {result.stderr}")

        return str(output_path)

    return await loop.run_in_executor(None, run_ffmpeg)


def _segment_transcription(data: dict) -> list:
    """Segment transcription into 1-minute blocks."""
    segments = []
    current_segment = None
    segment_duration = 60

    utterances = data.get("utterances", [])

    for utterance in utterances:
        start_time = utterance.get("start_time", 0)

        # Create new segment if needed
        if current_segment is None or start_time >= current_segment["end_time"]:
            if current_segment:
                segments.append(current_segment)

            segment_start = (int(start_time) // segment_duration) * segment_duration
            current_segment = {
                "start_time": segment_start,
                "end_time": segment_start + segment_duration,
                "utterances": [],
                "speaker": None,
            }

        current_segment["utterances"].append(utterance)
        if not current_segment["speaker"]:
            current_segment["speaker"] = utterance.get("speaker")

    if current_segment:
        segments.append(current_segment)

    return segments


def _extract_full_text(segments: list) -> str:
    """Extract full transcription text from segments."""
    text_parts = []

    for segment in segments:
        for utterance in segment.get("utterances", []):
            text = utterance.get("text", "")
            if text:
                text_parts.append(text)

    return " ".join(text_parts)


def _get_duration(segments: list) -> int:
    """Get total duration from segments."""
    if not segments:
        return 0

    last_segment = segments[-1]
    return int(last_segment.get("end_time", 0))
