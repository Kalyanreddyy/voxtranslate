"""Original soundtrack (OST) detection using Claude Vision."""

import asyncio
import base64
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

# OST types to detect
OST_TYPES = [
    "background_music",
    "ambient_sound",
    "voiceover",
    "dialogue",
    "sound_effects",
    "silence",
    "music_transition",
    "unknown",
]


async def detect_ost(video_path: str, api_key: str) -> dict:
    """
    Detect original soundtrack segments using Claude Vision.

    Args:
        video_path: Path to video file
        api_key: Anthropic API key

    Returns:
        Dictionary with OST detection results
    """
    logger.info(f"Detecting OST from video: {video_path}")

    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured")

    try:
        # Extract frames from video
        frames = await _extract_frames(video_path, interval=3)

        if not frames:
            logger.warning("No frames extracted from video")
            return {"ost_items": [], "frame_count": 0}

        # Process frames in batches
        ost_items = await _process_frames_batch(frames, api_key)

        result = {
            "ost_items": ost_items,
            "frame_count": len(frames),
            "total_ost_items": len(ost_items),
        }

        logger.info(f"OST detection complete: {len(ost_items)} items detected")
        return result

    except Exception as e:
        logger.error(f"OST detection error: {e}")
        raise RuntimeError(f"Failed to detect OST: {str(e)}")


async def _extract_frames(video_path: str, interval: int = 3) -> list:
    """
    Extract frames from video at specified interval.

    Args:
        video_path: Path to video file
        interval: Interval in seconds between frames

    Returns:
        List of (timestamp, frame_path) tuples
    """
    import tempfile

    frames = []
    temp_dir = Path(tempfile.gettempdir()) / "voxtranslate_frames"
    temp_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Extracting frames from {video_path} every {interval} seconds")

    loop = asyncio.get_event_loop()

    def run_ffmpeg():
        cmd = [
            "ffmpeg",
            "-i",
            video_path,
            "-vf",
            f"fps=1/{interval}",
            "-q:v",
            "2",
            str(temp_dir / "frame_%04d.jpg"),
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            return []

        # Collect frame paths
        frame_files = sorted(temp_dir.glob("frame_*.jpg"))
        return frame_files

    frame_files = await loop.run_in_executor(None, run_ffmpeg)

    # Create timestamp-frame mappings
    for idx, frame_path in enumerate(frame_files):
        timestamp = idx * interval
        frames.append({"timestamp": timestamp, "path": str(frame_path)})

    logger.info(f"Extracted {len(frames)} frames")
    return frames


async def _process_frames_batch(frames: list, api_key: str) -> list:
    """
    Process frames in batches using Claude Vision.

    Args:
        frames: List of frame data
        api_key: Anthropic API key

    Returns:
        List of detected OST items
    """
    import httpx

    ost_items = []
    batch_size = 10

    # Process frames in batches
    for batch_idx in range(0, len(frames), batch_size):
        batch = frames[batch_idx : batch_idx + batch_size]

        logger.info(f"Processing batch {batch_idx // batch_size + 1} of {(len(frames) + batch_size - 1) // batch_size}")
        import time; time.sleep(12)

        try:
            items = await _analyze_frame_batch(batch, api_key)
            ost_items.extend(items)
        except Exception as e:
            logger.warning(f"Error processing batch: {e}")
            continue

    return ost_items


async def _analyze_frame_batch(batch: list, api_key: str) -> list:
    """
    Analyze a batch of frames using Claude Vision.

    Args:
        batch: List of frame data
        api_key: Anthropic API key

    Returns:
        List of detected OST items
    """
    import httpx

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Build vision content with all frames in batch
        content = [
            {
                "type": "text",
                "text": f"""Analyze these video frames and identify any original soundtrack (OST) elements visible or audible from the visual context.

For each frame with detected OST elements, identify:
1. Timestamp (frame position)
2. OST type from: {', '.join(OST_TYPES)}
3. Brief description
4. Confidence (0-100)
5. Visual indicators (what you see that suggests the OST type)

Return JSON format:
{{"items": [{{"timestamp": int, "type": str, "description": str, "confidence": int, "visual_indicators": str}}]}}""",
            }
        ]

        # Add frame images to content
        for frame_data in batch:
            try:
                frame_path = frame_data["path"]
                with open(frame_path, "rb") as f:
                    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

                content.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_data,
                        },
                    }
                )
            except Exception as e:
                logger.warning(f"Error reading frame {frame_data['path']}: {e}")
                continue

        # Call Claude API
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": content}],
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Claude API error: {response.status_code} - {response.text}")

        response_data = response.json()
        text_content = response_data["content"][0]["text"]

        # Parse JSON from response
        import json

        import re

        json_match = re.search(r"\{.*\}", text_content, re.DOTALL)
        if json_match:
            try:
                result = json.loads(json_match.group())
                return result.get("items", [])
            except json.JSONDecodeError:
                logger.warning("Failed to parse Claude response as JSON")
                return []

        return []
