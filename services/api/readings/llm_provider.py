import json
import logging
import httpx
from typing import Optional, Dict, Any
from ..config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Agent 2: Hermeneutic Synthesis Palmist.
Your role is to translate structured biometric measurements from the computer vision pipeline into a balanced, ethical, and reflective palmistry assessment.

STRICT PRINCIPLES & NEGATIVE GUARDRAILS:
1. PHYSICAL GROUNDING ONLY:
   - Interpret ONLY the lines and mounts marked as "detected": true or with a valid contrast depth.
   - If a line or mount has "detected": false, negligible valley depth (< 1.5 px), or is flagged as missing/blurred, DO NOT fabricate an interpretation. Mark its status as "subtle_or_transitional" and note that the trait is currently latent, internal, or evolving. Never invent features.
2. ETHICAL & PSYCHOLOGICAL FRAMING:
   - Frame every insight as traditional cultural interpretation (Western classical, Indian Samudrika/Hastarekha Shastra, and Chinese Shouxiang) intended for self-reflection and personal growth.
   - Palmistry has no scientific predictive validity; do not claim certainty or guaranteed future outcomes.
   - STRICT BAN: Never predict death, disease, disasters, terminal illnesses, divorce, legal calamities, or specific calendar dates.
   - Reframe traditional negative omens (e.g., chained lines, breaks, or stars) constructively as periods of adaptation, energetic recalibration, resilience building, or caution.
3. DYNAMIC TRADITION WEIGHTING:
   - When "primary_tradition" is set to "Synthesis", provide an explicit "tradition_weighting" object indicating the source balance (e.g., western_ratio: 0.45, samudrika_ratio: 0.35, shouxiang_ratio: 0.20) to help multi-cultural users understand the origin of specific phrases. Ensure ratios sum to 1.0.
4. CONFIDENCE THRESHOLD GATING:
   - If the confidence_score drops below 0.70, append an explicit "confidence_advisory" note advising the user to retake the scan under balanced, glare-free lighting to resolve faint creases before relying on the reading.
5. SCHEMA INTEGRITY:
   - Return strictly valid JSON adhering to the specified schema with all numerical scores between 0.0 and 1.0.
"""

async def _call_gemini(prompt: str, schema_instructions: str) -> Optional[Dict[str, Any]]:
    if not settings.GEMINI_API_KEY:
        return None
    try:
        model_name = settings.LLM_MODEL_NAME if ("gemini" in (settings.LLM_MODEL_NAME or "")) else "gemini-2.0-flash"
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
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0)) as client:
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
        logger.warning(f"Gemini API invocation error: {e}.")
    return None

async def _call_openai(prompt: str, schema_instructions: str) -> Optional[Dict[str, Any]]:
    if not settings.OPENAI_API_KEY:
        return None
    try:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        model = settings.LLM_MODEL_NAME if ("gpt" in (settings.LLM_MODEL_NAME or "")) else "gpt-4o-mini"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"{schema_instructions}\n\n{prompt}"}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.4
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0)) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                return json.loads(content)
            else:
                logger.warning(f"OpenAI API returned status {res.status_code}: {res.text}")
    except Exception as e:
        logger.warning(f"OpenAI API invocation error: {e}.")
    return None

async def call_llm_for_reading(
    prompt: str,
    schema_instructions: str
) -> Optional[Dict[str, Any]]:
    """
    Calls the configured LLM provider (Gemini, OpenAI, or returns None to trigger deterministic fallback).
    Provides automatic fallback between providers for maximum reliability.
    """
    if settings.LLM_PROVIDER == "offline" or (not settings.GEMINI_API_KEY and not settings.OPENAI_API_KEY):
        return None

    if settings.LLM_PROVIDER == "openai":
        res = await _call_openai(prompt, schema_instructions)
        if res is not None:
            return res
        if settings.GEMINI_API_KEY:
            res = await _call_gemini(prompt, schema_instructions)
            if res is not None:
                return res
    else:  # "auto", "gemini"
        if settings.GEMINI_API_KEY:
            res = await _call_gemini(prompt, schema_instructions)
            if res is not None:
                return res
        if settings.OPENAI_API_KEY:
            res = await _call_openai(prompt, schema_instructions)
            if res is not None:
                return res

    logger.info("Falling back to deterministic cultural synthesizer.")
    return None
