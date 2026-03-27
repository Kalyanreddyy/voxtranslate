"""Audio transcription module using ElevenLabs."""

import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


async def transcribe_video(
    video_path: str,
    api_key: str,
    language_code: str = "",
    tag_audio_events: bool = True,
    diarize: bool = True,
    include_subtitles: bool = False,
    no_verbatim: bool = False,
) -> dict:
    """
    Transcribe video audio using ElevenLabs Scribe v2.

    Args:
        video_path: Path to video file
        api_key: ElevenLabs API key
        language_code: Source language code (empty = auto-detect)
        tag_audio_events: Tag non-speech audio events
        diarize: Enable speaker diarization
        include_subtitles: Request SRT/VTT subtitle output
        no_verbatim: Clean up filler words

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

        # Build Scribe API params
        data: dict = {
            "model_id": "scribe_v2",
            "diarize": "true" if diarize else "false",
            "timestamps_granularity": "word",
            "tag_audio_events": "true" if tag_audio_events else "false",
        }

        # Only set language_code if not auto-detect
        if language_code and language_code not in ("", "auto"):
            data["language_code"] = language_code

        # Subtitle formats
        if include_subtitles:
            data["additional_formats"] = '[{"format":"srt"},{"format":"vtt"}]'

        # Call ElevenLabs API
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {"file": ("audio.wav", audio_data, "audio/wav")}


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


def _words_to_utterances(words: list) -> list:
    """Convert scribe_v2 word-level output into utterance-like chunks."""
    if not words:
        return []
    utterances = []
    current = {"text": "", "start_time": 0, "end_time": 0, "speaker": "speaker_0"}
    block_duration = 30
    for word in words:
        if word.get("type") == "spacing":
            continue
        start = word.get("start", 0)
        text = word.get("text", "")
        if not current["text"] or start - current["start_time"] < block_duration:
            current["text"] += (" " if current["text"] else "") + text
            current["end_time"] = word.get("end", start)
            if not current["text"] or current["start_time"] == 0:
                current["start_time"] = start
        else:
            utterances.append(current)
            current = {"text": text, "start_time": start, "end_time": word.get("end", start), "speaker": word.get("speaker_id", "speaker_0")}
    if current["text"]:
        utterances.append(current)
    return utterances

def _segment_transcription(data: dict) -> list:
    """Segment transcription into 1-minute blocks."""
    segments = []
    current_segment = None
    segment_duration = 60

    utterances = data.get("utterances", []) or _words_to_utterances(data.get("words", []))

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
