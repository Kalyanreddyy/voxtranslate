"""Video download module using yt-dlp."""

import asyncio
import json
import logging
import os
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


async def download_video(url: str, output_dir: str) -> dict:
    """
    Download a video from YouTube using yt-dlp.

    Args:
        url: YouTube URL
        output_dir: Output directory path

    Returns:
        Dictionary with download metadata
    """
    import yt_dlp

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Downloading video from {url}")

    try:
        # Run yt-dlp in executor to avoid blocking
        loop = asyncio.get_event_loop()

        def download():
            ydl_opts = {
                "format": "best[height<=720]",
                "outtmpl": str(output_dir / "%(id)s.%(ext)s"),
                "quiet": False,
                "no_warnings": False,
                "extract_flat": False,
                "writeinfo_json": True,
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                return info

        info = await loop.run_in_executor(None, download)

        # Find video file
        video_id = info.get("id")
        video_ext = info.get("ext", "mp4")
        video_path = output_dir / f"{video_id}.{video_ext}"

        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        # Get file stats
        file_stats = video_path.stat()
        size_bytes = file_stats.st_size

        result = {
            "path": str(video_path),
            "video_id": video_id,
            "title": info.get("title", "Unknown"),
            "duration_seconds": info.get("duration"),
            "size_bytes": size_bytes,
            "metadata": {
                "uploader": info.get("uploader"),
                "upload_date": info.get("upload_date"),
                "description": info.get("description", "")[:500],
                "channel_url": info.get("channel_url"),
                "view_count": info.get("view_count"),
                "like_count": info.get("like_count"),
            },
        }

        logger.info(f"Successfully downloaded video: {video_path}")
        return result

    except Exception as e:
        logger.error(f"Error downloading video: {e}")
        raise RuntimeError(f"Failed to download video: {str(e)}")


async def trim_video(video_path: str, time_ranges: list[dict], output_dir: str) -> str:
    """
    Trim video to only specified time ranges using ffmpeg.

    Args:
        video_path: Path to the input video file
        time_ranges: List of dicts with 'start' and 'end' timestamps (HH:MM:SS format)
        output_dir: Output directory for trimmed video

    Returns:
        Path to the trimmed video file
    """
    import shutil

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Trimming video to {len(time_ranges)} range(s)")

    try:
        loop = asyncio.get_event_loop()

        if len(time_ranges) == 1:
            # Single range: use simple ffmpeg trim
            range_data = time_ranges[0]
            start = range_data["start"]
            end = range_data["end"]

            output_path = output_dir / "trimmed.mp4"

            def trim_single():
                cmd = [
                    "ffmpeg",
                    "-i",
                    video_path,
                    "-ss",
                    start,
                    "-to",
                    end,
                    "-c",
                    "copy",
                    "-y",
                    str(output_path),
                ]
                subprocess.run(cmd, check=True, capture_output=True)

            await loop.run_in_executor(None, trim_single)
            logger.info(f"Trimmed video saved to {output_path}")
            return str(output_path)

        else:
            # Multiple ranges: create clips and concatenate
            clip_files = []

            for i, range_data in enumerate(time_ranges):
                start = range_data["start"]
                end = range_data["end"]
                clip_path = output_dir / f"clip_{i}.mp4"
                clip_files.append(clip_path)

                def trim_clip(idx=i):
                    cmd = [
                        "ffmpeg",
                        "-i",
                        video_path,
                        "-ss",
                        time_ranges[idx]["start"],
                        "-to",
                        time_ranges[idx]["end"],
                        "-c",
                        "copy",
                        "-y",
                        str(clip_files[idx]),
                    ]
                    subprocess.run(cmd, check=True, capture_output=True)

                await loop.run_in_executor(None, trim_clip)
                logger.info(f"Created clip {i+1}/{len(time_ranges)}: {clip_path}")

            # Create concat file for ffmpeg concat demuxer
            concat_file = output_dir / "concat.txt"
            with open(concat_file, "w") as f:
                for clip_path in clip_files:
                    f.write(f"file '{clip_path.absolute()}'\n")

            output_path = output_dir / "trimmed.mp4"

            def concat_clips():
                cmd = [
                    "ffmpeg",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    str(concat_file),
                    "-c",
                    "copy",
                    "-y",
                    str(output_path),
                ]
                subprocess.run(cmd, check=True, capture_output=True)

            await loop.run_in_executor(None, concat_clips)

            # Clean up clip files
            for clip_path in clip_files:
                if clip_path.exists():
                    clip_path.unlink()
            concat_file.unlink()

            logger.info(f"Concatenated {len(time_ranges)} clips to {output_path}")
            return str(output_path)

    except Exception as e:
        logger.error(f"Error trimming video: {e}")
        raise RuntimeError(f"Failed to trim video: {str(e)}")
