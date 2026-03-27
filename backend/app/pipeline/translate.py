import time
"""Translation module using Claude API."""

import logging

logger = logging.getLogger(__name__)


async def translate_content(
    transcription: dict,
    ost_detection: dict,
    source_language: str,
    api_key: str,
) -> dict:
    """
    Translate transcribed content to English using Claude.

    Args:
        transcription: Transcription data with segments
        ost_detection: OST detection results
        source_language: Source language code
        api_key: Anthropic API key

    Returns:
        Dictionary with translation results
    """
    import httpx

    logger.info(f"Translating content from {source_language}")

    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured")

    try:
        # Extract full text from transcription
        full_text = transcription.get("full_text", "")

        if not full_text:
            logger.warning("No text to translate")
            return {
                "video_summary": "",
                "meta_translations": [],
                "segments": [],
            }

        # Build prompt for translation
        segments = transcription.get("segments", [])
        ost_items = ost_detection.get("ost_items", [])

        prompt = _build_translation_prompt(
            full_text, segments, ost_items, source_language
        )

        # Call Claude API
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-sonnet-4-5",
                    "max_tokens": 4096,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )

            if response.status_code != 200:
                raise RuntimeError(
                    f"Claude API error: {response.status_code} - {response.text}"
                )

            response_data = response.json()
            translation_text = response_data["content"][0]["text"]

        # Parse translation results
        translation_results = _parse_translation_response(
            translation_text, segments, ost_items
        )

        logger.info("Translation complete")
        return translation_results

    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise RuntimeError(f"Failed to translate content: {str(e)}")


def _build_translation_prompt(
    full_text: str, segments: list, ost_items: list, source_language: str
) -> str:
    """Build the translation prompt for Claude."""

    ost_context = ""
    if ost_items:
        ost_context = "\n\nOriginal Soundtrack Elements:\n"
        for item in ost_items[:10]:  # Limit to first 10
            ost_context += f"- {item.get('timestamp', 'unknown')}s: {item.get('description', '')}\n"

    prompt = f"""You are a professional video translator and editor. Your task is to:

1. Provide a brief video summary (2-3 sentences)
2. Translate the transcript from {source_language} to English
3. Resolve speaker identities and names from context
4. Generate detailed contextual notes with:
   - Term: specific word or phrase
   - Explanation: what it means in context
5. Flag any violence or sensitive content in notes (not inline)
6. Preserve fillers and hesitations (um, uh, like, etc.)
7. Do NOT use em dashes (—), use regular dashes (-)

Transcript to translate:
{full_text}
{ost_context}

Return your response in this JSON format:
{{
  "video_summary": "Brief 2-3 sentence summary",
  "meta_translations": [
    {{"term": "original phrase", "translation": "English translation", "explanation": "context"}}
  ],
  "segments": [
    {{
      "timestamp_start": 0,
      "timestamp_end": 60,
      "speaker": "Speaker Name",
      "original": "Original text",
      "translation": "Translated text",
      "notes": [
        {{"term": "key term", "explanation": "what it means"}}
      ],
      "flags": ["violence" or null]
    }}
  ]
}}"""

    return prompt


def _parse_translation_response(
    response_text: str, segments: list, ost_items: list
) -> dict:
    """Parse Claude's translation response."""
    import json

    import re

    try:
        # Extract JSON from response
        json_match = re.search(r"\{[\s\S]*\}", response_text)

        if json_match:
            result = json.loads(json_match.group())
        else:
            logger.warning("No JSON found in translation response")
            result = {
                "video_summary": response_text[:200],
                "meta_translations": [],
                "segments": [],
            }

        # Enrich segments with OST information
        if ost_items:
            result["ost_integration"] = _integrate_ost(
                result.get("segments", []), ost_items
            )

        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse translation JSON: {e}")
        return {
            "video_summary": "",
            "meta_translations": [],
            "segments": [],
            "raw_response": response_text,
        }


def _integrate_ost(segments: list, ost_items: list) -> list:
    """Integrate OST items into segments."""
    integrated = []

    for segment in segments:
        segment_start = segment.get("timestamp_start", 0)
        segment_end = segment.get("timestamp_end", 60)

        # Find OST items in this segment
        segment_ost = [
            item
            for item in ost_items
            if segment_start <= item.get("timestamp", 0) < segment_end
        ]

        if segment_ost:
            segment["ost_items"] = segment_ost

        integrated.append(segment)

    return integrated
