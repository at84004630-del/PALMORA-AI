import pytest
from httpx import AsyncClient, ASGITransport
from services.api.main import app
from services.api.schemas.readings import PalmReadingReport, ReadingSection
from services.api.readings.translator import translate_palm_reading, DETERMINISTIC_TRANSLATIONS

def create_sample_report() -> PalmReadingReport:
    return PalmReadingReport(
        id="test-reading-uuid",
        reading_title="The Architecture of Intuition & Purpose",
        created_at="2026-10-19T00:00:00Z",
        features_analyzed=["Heart Line", "Head Line", "Life Line"],
        love_reading=ReadingSection(
            title="Heart Line: Emotional Expression & Harmony",
            feature_name="Heart Line",
            feature_status="detected",
            traditional_interpretation="Your heart line indicates deep emotional resonance.",
            reflective_prompts=["How do you communicate love?"],
            confidence_note="Clear detection."
        ),
        career_reading=ReadingSection(
            title="Head Line: Focus, Strategy & Curiosity",
            feature_name="Head Line",
            feature_status="detected",
            traditional_interpretation="Your head line indicates strategic curiosity.",
            reflective_prompts=["What inspires your intellect?"],
            confidence_note="Clear detection."
        ),
        personality_reading=ReadingSection(
            title="Life Line: Vitality, Pacing & Equilibrium",
            feature_name="Life Line",
            feature_status="detected",
            traditional_interpretation="Your life line indicates sustainable vitality.",
            reflective_prompts=["How do you balance rest and work?"],
            confidence_note="Clear detection."
        ),
        overall_synthesis="A harmonious palm structure.",
        disclaimer="Cultural entertainment notice."
    )

@pytest.mark.asyncio
async def test_translator_deterministic_hindi():
    report = create_sample_report()
    translated = await translate_palm_reading(report, "hi")
    assert translated.language == "hi"
    assert translated.reading_title == DETERMINISTIC_TRANSLATIONS["hi"]["reading_title"]
    assert "हृदय" in translated.love_reading.title or "भावना" in translated.love_reading.traditional_interpretation

@pytest.mark.asyncio
async def test_translator_deterministic_spanish():
    report = create_sample_report()
    translated = await translate_palm_reading(report, "es")
    assert translated.language == "es"
    assert translated.reading_title == DETERMINISTIC_TRANSLATIONS["es"]["reading_title"]
    assert "Corazón" in translated.love_reading.title

@pytest.mark.asyncio
async def test_translate_api_endpoint():
    report = create_sample_report()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Establish guest session
        sess_resp = await ac.post("/api/v1/account/guest-session")
        token = sess_resp.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = await ac.post(
            "/api/v1/readings/translate",
            headers=headers,
            json={
                "target_language": "hi",
                "report": report.model_dump()
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["language"] == "hi"
        assert data["reading_title"] == DETERMINISTIC_TRANSLATIONS["hi"]["reading_title"]

@pytest.mark.asyncio
async def test_consult_with_language():
    report = create_sample_report()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        sess_resp = await ac.post("/api/v1/account/guest-session")
        token = sess_resp.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = await ac.post(
            "/api/v1/readings/consult",
            headers=headers,
            json={
                "category": "money",
                "question": "What does my palm indicate about wealth and investments?",
                "report_context": report.model_dump(),
                "language": "hi"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["language"] == "hi"
        assert len(data["answer"]) > 0

@pytest.mark.asyncio
async def test_translator_deterministic_hinglish():
    report = create_sample_report()
    translated = await translate_palm_reading(report, "hinglish")
    assert translated.language == "hinglish"
    assert translated.reading_title == DETERMINISTIC_TRANSLATIONS["hinglish"]["reading_title"]
    assert "Heart Line" in translated.love_reading.title
    assert "emotional depth" in translated.love_reading.traditional_interpretation
    assert "Head Line" in translated.career_reading.title
    assert "Life Line" in translated.personality_reading.title

@pytest.mark.asyncio
async def test_translator_hinglish_aliases():
    report = create_sample_report()
    for alias in ["hi-Latn", "hi_latn", "hi-en", "hi_en", "Hinglish"]:
        translated = await translate_palm_reading(report, alias)
        assert translated.language == "hinglish"
        assert translated.reading_title == DETERMINISTIC_TRANSLATIONS["hinglish"]["reading_title"]

@pytest.mark.asyncio
async def test_translate_api_endpoint_hinglish():
    report = create_sample_report()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        sess_resp = await ac.post("/api/v1/account/guest-session")
        token = sess_resp.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = await ac.post(
            "/api/v1/readings/translate",
            headers=headers,
            json={
                "target_language": "hinglish",
                "report": report.model_dump()
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["language"] == "hinglish"
        assert data["reading_title"] == DETERMINISTIC_TRANSLATIONS["hinglish"]["reading_title"]
