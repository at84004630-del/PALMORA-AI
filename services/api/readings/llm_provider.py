import json
import logging
import httpx
from typing import Optional, Dict, Any
from ..config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Palmora AI's interpretive narrator.
Your role is to translate measured physical palm features into thoughtful, culturally grounded palmistry reflections.

STRICT PRINCIPLES:
1. Frame all interpretations as traditional cultural symbolism, folklore, and contemplative self-reflection.
2. Palmistry is for entertainment, historical appreciation, and mindfulness. It is NOT scientific personality diagnosis or future prediction.
3. NEVER make deterministic future predictions (e.g. marriage age, number of children, wealth accumulation).
4. NEVER make claims about health, illness, medical conditions, or lifespan.
5. NEVER fabricate visual measurements not present in the supplied feature analysis.
6. Provide inspiring, respectful, and empowering reflective prompts.
7. Return strictly valid JSON adhering to the specified schema.
"""

async def call_llm_for_reading(
    prompt: str,
    schema_instructions: str
) -> Optional[Dict[str, Any]]:
    """
    Calls the configured LLM provider (Gemini, OpenAI, or returns None to trigger deterministic fallback).
    """
    # 1. Check Gemini
    if settings.GEMINI_API_KEY:
        try:
            model_name = settings.LLM_MODEL_NAME or "gemini-1.5-flash"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{SYSTEM_PROMPT}\n\n{schema_instructions}\n\n{prompt}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.4,
                    "responseMimeType": "application/json"
                }
            }
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        text_resp = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        return json.loads(text_resp)
                else:
                    logger.warning(f"Gemini API returned status {res.status_code}: {res.text}")
        except Exception as e:
            logger.warning(f"Gemini API invocation error: {e}. Falling back to deterministic cultural synthesizer.")

    # 2. Check OpenAI
    if settings.OPENAI_API_KEY:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"{schema_instructions}\n\n{prompt}"}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.4
            }
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    return json.loads(content)
        except Exception as e:
            logger.warning(f"OpenAI API invocation error: {e}. Falling back to deterministic cultural synthesizer.")

    # Provider not configured or call failed
    return None
