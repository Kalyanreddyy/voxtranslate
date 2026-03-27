"""Live stream transcription module for VoxTranslate.

Pulls audio from a YouTube live stream in chunks and transcribes each
chunk using ElevenLabs Scribe, with optional Claude translation.
"""

import asyncio
import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

CHUNK_SECONDS = 30  # seconds per audio chunk


async def is_live_stream(url: str) -> bool:
    """Detect if a YouTube URL is a live stream."""
    import yt_dlp

    def check():
        ydl_opts = {"quiet": True, "skip_download": True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info.get("is_live", False) or info.get("live_status") == "is_live"

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, check)


async def get_live_audio_url(url: str) -> str:
    """Extract the best audio-only stream URL from a live YouTube URL."""
    import yt_dlp

    def extract():
        ydl_opts = {
            "quiet": True,
            "format": "bestaudio",
            "skip_download": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info["url"]

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, extract)


async def transcribe_chunk(
    chunk_path: str,
    api_key: str,
    language: str = "pt",
) -> dict:
    """
    Send a WAV chunk to ElevenLabs Scribe and return transcription.

    Args:
        chunk_path: Path to the WAV chunk file
        api_key: ElevenLabs API key
        language: Source language code (e.g. 'pt' for pt-BR)

    Returns:
        Dict with 'text' and 'utterances' from Scribe
    """
    with open(chunk_path, "rb") as f:
        audio_data = f.read()

    async with httpx.AsyncClient(timeout=60.0) as client:
        files = {"file": ("chunk.wav", audio_data, "audio/wav")}
        data = {
            "model_id": "scribe_v1",
            "diarize": "false",          # single speaker for live streams
            "timestamps_granularity": "word",
            "language_code": language,   # skip language detection, faster
        }

        response = await client.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            files=files,
            data=data,
            headers={"xi-api-key": api_key},
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"ElevenLabs Scribe error: {response.status_code} - {response.text}"
            )

        data = response.json()
        return {
            "text": data.get("text", "").strip(),
            "utterances": data.get("utterances", []),
        }


async def translate_chunk(
    text: str,
    source_language: str,
    target_language: str,
    api_key: str,
) -> str:
    """
    Translate a chunk of text using Claude.

    Args:
        text: Source text to translate
        source_language: e.g. 'Brazilian Portuguese'
        target_language: e.g. 'English'
        api_key: Anthropic API key

    Returns:
        Translated text string
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 1024,
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            f"Translate the following {source_language} to {target_language}. "
                            f"Output only the translation, no commentary, no em dashes:\n\n{text}"
                        ),
                    }
                ],
            },
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Claude API error: {response.status_code} - {response.text}"
            )

        return response.json()["content"][0]["text"].strip()


async def stream_live_transcription(
    youtube_url: str,
    elevenlabs_api_key: str,
    anthropic_api_key: str,
    source_language: str = "pt",
    source_language_label: str = "Brazilian Portuguese",
    target_language: str = "English",
    translate: bool = True,
    on_segment: callable = None,
    stop_event: asyncio.Event = None,
):
    """
    Main live stream loop. Pulls audio from YouTube live stream,
    transcribes each chunk, optionally translates, and calls on_segment.

    Args:
        youtube_url: YouTube live stream URL
        elevenlabs_api_key: ElevenLabs API key for Scribe
        anthropic_api_key: Anthropic API key for Claude translation
        source_language: Language code for Scribe (e.g. 'pt')
        source_language_label: Human-readable label for Claude prompt
        target_language: Target language for translation
        translate: Whether to run Claude translation on each chunk
        on_segment: Async callback(segment: dict) called after each chunk
        stop_event: asyncio.Event — set it to stop the loop cleanly
    """
    logger.info(f"Starting live stream transcription for: {youtube_url}")

    if stop_event is None:
        stop_event = asyncio.Event()

    # Get the direct audio stream URL
    audio_url = await get_live_audio_url(youtube_url)
    logger.info("Got live audio URL from yt-dlp")

    chunk_index = 0

    with tempfile.TemporaryDirectory() as tmpdir:
        # ffmpeg: pull live HLS/DASH audio, segment into 30s WAV chunks
        ffmpeg_cmd = [
            "ffmpeg",
            "-loglevel", "error",
            "-i", audio_url,
            "-f", "segment",
            "-segment_time", str(CHUNK_SECONDS),
            "-ar", "16000",
            "-ac", "1",
            "-reset_timestamps", "1",
            os.path.join(tmpdir, "chunk_%04d.wav"),
        ]

        ffmpeg_proc = subprocess.Popen(ffmpeg_cmd, stderr=subprocess.PIPE)
        logger.info(f"ffmpeg started, writing {CHUNK_SECONDS}s chunks to {tmpdir}")

        seen = set()

        try:
            while not stop_event.is_set():
                await asyncio.sleep(2)  # poll for new chunks

                # Check if ffmpeg is still alive
                if ffmpeg_proc.poll() is not None:
                    logger.error("ffmpeg process died unexpectedly")
                    break

                # Find new completed chunks
                chunk_files = sorted(
                    f for f in os.listdir(tmpdir)
                    if f.startswith("chunk_") and f.endswith(".wav")
                )

                # The last file is still being written — skip it
                completed = chunk_files[:-1] if len(chunk_files) > 1 else []

                for fname in completed:
                    fpath = os.path.join(tmpdir, fname)
                    if fpath in seen:
                        continue

                    seen.add(fpath)
                    wall_time = time.time()

                    try:
                        logger.info(f"Transcribing chunk {chunk_index}: {fname}")

                        # Transcribe
                        result = await transcribe_chunk(
                            fpath,
                            api_key=elevenlabs_api_key,
                            language=source_language,
                        )

                        transcript_text = result["text"]

                        if not transcript_text:
                            logger.debug(f"Chunk {chunk_index} is silent, skipping")
                            chunk_index += 1
                            continue

                        # Translate
                        translation_text = None
                        if translate and anthropic_api_key:
                            translation_text = await translate_chunk(
                                text=transcript_text,
                                source_language=source_language_label,
                                target_language=target_language,
                                api_key=anthropic_api_key,
                            )

                        segment = {
                            "chunk_index": chunk_index,
                            "wall_time": wall_time,
                            "source_language": source_language_label,
                            "target_language": target_language,
                            "transcript": transcript_text,
                            "translation": translation_text,
                        }

                        logger.info(
                            f"Chunk {chunk_index} done | "
                            f"[{source_language_label}] {transcript_text[:80]}... | "
                            f"[{target_language}] {(translation_text or '')[:80]}..."
                        )

                        if on_segment:
                            await on_segment(segment)

                        chunk_index += 1

                    except Exception as e:
                        logger.error(f"Error processing chunk {chunk_index}: {e}")
                        chunk_index += 1
                        continue

        finally:
            ffmpeg_proc.terminate()
            try:
                ffmpeg_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                ffmpeg_proc.kill()
            logger.info("Live stream stopped. ffmpeg terminated.")
