import os
import json
import base64
import httpx
from typing import Optional
from pydantic import BaseModel


class LyricsResponse(BaseModel):
    title: str
    tags: str
    lyrics: str


class ThumbnailResponse(BaseModel):
    image_base64: str
    prompt_used: str


def get_openai_api_key() -> str:
    return os.environ.get("OPENAI_API_KEY", "")

def get_openai_base_url() -> str:
    return os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")


async def generate_lyrics(prompt: str, language: str = "english") -> LyricsResponse:
    """Generate song lyrics, title, and tags from a description prompt."""

    api_key = get_openai_api_key()
    base_url = get_openai_base_url()

    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")

    system_prompt = """You are a professional songwriter. Given a description of a song, generate:
1. A catchy song title
2. Music tags (genre, mood, instruments, vocal type) as comma-separated values
3. Full lyrics with proper structure

Format your response as JSON:
{
    "title": "Song Title Here",
    "tags": "pop,female,emotional,piano,ballad",
    "lyrics": "[Intro]\\n\\n[Verse 1]\\nLyrics here...\\n\\n[Chorus]\\nChorus lyrics..."
}

Important rules for lyrics:
- Use sections like [Intro], [Verse], [Prechorus], [Chorus], [Bridge], [Outro]
- Keep verses 4-8 lines each
- Chorus should be memorable and repeatable
- Match the mood and style to the requested genre
- Write in the requested language"""

    user_prompt = f"Write a song in {language} based on this description: {prompt}"

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.8,
                "response_format": {"type": "json_object"},
            },
        )

        if response.status_code != 200:
            error_detail = response.text
            raise ValueError(f"OpenAI API error: {response.status_code} - {error_detail}")

        data = response.json()
        content = data["choices"][0]["message"]["content"]

        try:
            result = json.loads(content)
            return LyricsResponse(
                title=result.get("title", "Untitled"),
                tags=result.get("tags", "pop,vocal"),
                lyrics=result.get("lyrics", ""),
            )
        except json.JSONDecodeError:
            raise ValueError("Failed to parse OpenAI response as JSON")


async def generate_thumbnail(
    title: str,
    tags: str,
    lyrics_preview: str = "",
    style: str = "album cover art"
) -> ThumbnailResponse:
    """Generate a thumbnail image for a song using DALL-E."""

    api_key = get_openai_api_key()
    base_url = get_openai_base_url()

    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")

    # Create a prompt for the image
    mood_words = tags.split(",")[:3]  # Take first 3 tags for mood
    mood_str = ", ".join(mood_words)

    image_prompt = f"""Create a {style} for a song titled "{title}".
The mood is {mood_str}.
Style: Modern digital art, vibrant colors, professional album artwork.
No text or words in the image."""

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{base_url}/images/generations",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "dall-e-3",
                "prompt": image_prompt,
                "n": 1,
                "size": "1024x1024",
                "response_format": "b64_json",
            },
        )

        if response.status_code != 200:
            error_detail = response.text
            raise ValueError(f"OpenAI API error: {response.status_code} - {error_detail}")

        data = response.json()
        image_data = data["data"][0]["b64_json"]
        revised_prompt = data["data"][0].get("revised_prompt", image_prompt)

        return ThumbnailResponse(
            image_base64=image_data,
            prompt_used=revised_prompt,
        )


def is_openai_configured() -> bool:
    """Check if OpenAI API is configured."""
    return bool(get_openai_api_key())
