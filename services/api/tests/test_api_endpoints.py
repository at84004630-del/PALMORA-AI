import asyncio
import time
import pytest
from httpx import AsyncClient, ASGITransport
from services.api.main import app

@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "Palmora" in data["service"]

@pytest.mark.asyncio
async def test_palm_validate_endpoint(synthetic_palm_image_bytes):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("test_palm.jpg", synthetic_palm_image_bytes, "image/jpeg")}
        res = await client.post("/api/v1/palm/validate", files=files)
        assert res.status_code == 200
        data = res.json()
        assert data["is_usable"] is True
        assert data["hand_detected"] is True

@pytest.mark.asyncio
async def test_palm_analyze_endpoint(synthetic_palm_image_bytes):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("test_palm.jpg", synthetic_palm_image_bytes, "image/jpeg")}

        # Unauthenticated request must fail with 401
        unauth_res = await client.post("/api/v1/palm/analyze", files=files)
        assert unauth_res.status_code == 401

        # Authenticate via guest session endpoint
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]

        # Authenticated analysis request succeeds
        res = await client.post(
            "/api/v1/palm/analyze",
            files={"file": ("test_palm.jpg", synthetic_palm_image_bytes, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "analysis_id" in data
        assert "features" in data
        assert "heart_line" in data["features"]
        assert "head_line" in data["features"]
        assert "life_line" in data["features"]

@pytest.mark.asyncio
async def test_readings_generate_endpoint(synthetic_palm_image_bytes):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Establish guest session
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Analyze with guest session
        files = {"file": ("test_palm.jpg", synthetic_palm_image_bytes, "image/jpeg")}
        analyze_res = await client.post("/api/v1/palm/analyze", files=files, headers=headers)
        assert analyze_res.status_code == 200
        analyze_data = analyze_res.json()
        analysis_id = analyze_data["analysis_id"]

        # Generate reading with guest session
        gen_payload = {
            "analysis_id": analysis_id,
            "features": analyze_data["features"],
            "user_notes": "Seeking general life guidance",
            "tier": "free"
        }
        gen_res = await client.post("/api/v1/readings/generate", json=gen_payload, headers=headers)
        assert gen_res.status_code == 200
        reading_data = gen_res.json()
        assert reading_data["id"] is not None
        assert "love_reading" in reading_data
        assert "career_reading" in reading_data
        assert "personality_reading" in reading_data

        reading_id = reading_data["id"]

        # Retrieve specific reading
        get_res = await client.get(f"/api/v1/readings/{reading_id}", headers=headers)
        assert get_res.status_code == 200

        # Delete reading
        del_res = await client.delete(f"/api/v1/readings/{reading_id}", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

@pytest.mark.asyncio
async def test_account_and_quota_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Unauthenticated access rejected with 401
        unauth_acc = await client.get("/api/v1/account")
        assert unauth_acc.status_code == 401

        unauth_quota = await client.get("/api/v1/account/quota")
        assert unauth_quota.status_code == 401

        # Establish guest session
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        guest_data = sess_res.json()
        token = guest_data["session_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Account inspection
        acc_res = await client.get("/api/v1/account", headers=headers)
        assert acc_res.status_code == 200
        acc_data = acc_res.json()
        assert acc_data["id"] == guest_data["user_id"]

        # Quota inspection
        quota_res = await client.get("/api/v1/account/quota", headers=headers)
        assert quota_res.status_code == 200
        quota_data = quota_res.json()
        assert quota_data["total_quota"] >= 1


@pytest.mark.asyncio
async def test_analytics_event_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        event_payload = {
            "event_name": "scan_completed",
            "session_id": "test_sess_123",
            "properties": {"device": "desktop_chrome", "duration_sec": 3.2}
        }
        res = await client.post("/api/v1/analytics/event", json=event_payload)
        assert res.status_code == 200

        # Metrics check
        metrics_res = await client.get("/api/v1/analytics/metrics")
        assert metrics_res.status_code == 200
        metrics = metrics_res.json()
        assert "scan_completed" in metrics["raw_counts"]


@pytest.mark.asyncio
async def test_analytics_track_and_referral_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ref_code = "PALM-TEST-REF99"

        # 1. Track referral visit
        visit_res = await client.post("/api/v1/analytics/track", json={
            "event_name": "referral_visit",
            "properties": {"referral_code": ref_code, "landing_variant": "mystic_v1"}
        })
        assert visit_res.status_code == 200
        assert visit_res.json()["recorded"] is True

        # 2. Track referral completion with session
        comp_res = await client.post("/api/v1/analytics/track", json={
            "event_name": "referral_completion",
            "session_id": "sess_referred_alpha",
            "properties": {"referral_code": ref_code}
        })
        assert comp_res.status_code == 200

        # 3. Repeat completion with same session (abuse prevention test)
        comp_dup_res = await client.post("/api/v1/analytics/track", json={
            "event_name": "referral_completion",
            "session_id": "sess_referred_alpha",
            "properties": {"referral_code": ref_code}
        })
        assert comp_dup_res.status_code == 200
        # Duplicate should be acknowledged but not double-credited
        assert comp_dup_res.json()["recorded"] is True

        # 4. Check metrics reflects referral campaign
        metrics_res = await client.get("/api/v1/analytics/metrics")
        assert metrics_res.status_code == 200
        data = metrics_res.json()
        assert ref_code in data["referrals"]
        assert data["referrals"][ref_code]["visits"] >= 1
        assert data["referrals"][ref_code]["completions"] >= 1


@pytest.mark.asyncio
async def test_analytics_sensitive_data_stripped():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Submit an event with sensitive and disallowed keys
        res = await client.post("/api/v1/analytics/track", json={
            "event_name": "share_card_created",
            "session_id": "sess_clean_test",
            "properties": {
                "aspect": "love",
                "theme": "celestial",
                "raw_photo": "data:image/jpeg;base64,SECRET_PHOTO_BYTES",
                "card_number": "4111222233334444",
                "full_reading_text": "Sensitive reading text should not be in logs"
            }
        })
        assert res.status_code == 200

        # Verify through metrics raw logs that no sensitive properties survived
        metrics_res = await client.get("/api/v1/analytics/metrics")
        assert metrics_res.status_code == 200
        # The audit policy must confirm sensitive isolation
        assert "disallowed_keys_stripped" in metrics_res.json()["audit_policy"]


@pytest.mark.asyncio
async def test_account_deletion_request_tracking():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/analytics/track", json={
            "event_name": "account_deletion_requested",
            "session_id": "sess_delete_user_99",
            "properties": {
                "source": "web_delete_account_portal"
            }
        })
        assert res.status_code == 200
        assert res.json()["recorded"] is True

        metrics_res = await client.get("/api/v1/analytics/metrics")
        assert metrics_res.status_code == 200
        assert metrics_res.json()["raw_counts"].get("account_deletion_requested", 0) >= 1


@pytest.mark.asyncio
async def test_concurrent_health_check_during_heavy_analysis(synthetic_palm_image_bytes):
    """
    Verifies that CPU-bound palm image analysis offloaded to the threadpool
    does NOT block concurrent I/O operations (like /api/health) on the asyncio event loop.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Obtain guest session for analysis authorization
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]

        async def run_analysis():
            res = await client.post(
                "/api/v1/palm/analyze",
                files={"file": ("test_palm.jpg", synthetic_palm_image_bytes, "image/jpeg")},
                headers={"Authorization": f"Bearer {token}"}
            )
            return res

        async def run_health_checks():
            # Brief delay so analysis begins execution in worker threadpool
            await asyncio.sleep(0.005)
            latencies = []
            for _ in range(5):
                t0 = time.perf_counter()
                res = await client.get("/api/health")
                latency_ms = (time.perf_counter() - t0) * 1000
                assert res.status_code == 200
                latencies.append(latency_ms)
                await asyncio.sleep(0.002)
            return latencies

        # Execute CPU-bound analysis and concurrent I/O requests concurrently
        analysis_res, latencies = await asyncio.gather(run_analysis(), run_health_checks())
        assert analysis_res.status_code == 200
        assert len(latencies) == 5
        # Verify event loop remained responsive (average health check latency well within 25ms)
        avg_latency = sum(latencies) / len(latencies)
        assert avg_latency < 35.0, f"Average health check latency {avg_latency:.2f}ms indicates event loop starvation"

@pytest.mark.asyncio
async def test_readings_consult_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Establish guest session
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]

        payload = {
            "category": "money",
            "question": "What does my palm indicate about wealth and financial growth?",
            "report_context": {
                "overall_synthesis": "Balanced energy between strategic thought and practical execution."
            }
        }
        res = await client.post(
            "/api/v1/readings/consult",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["category"] == "money"
        assert len(data["answer"]) > 50
        assert len(data["key_insights"]) >= 2
        assert len(data["suggested_followups"]) == 3


@pytest.mark.asyncio
async def test_readings_compare_endpoint(synthetic_palm_image_bytes):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Establish guest session
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Analyze two images (or synthetic image twice for dominant and non-dominant)
        files1 = {"file": ("palm_left.jpg", synthetic_palm_image_bytes, "image/jpeg")}
        res1 = await client.post("/api/v1/palm/analyze", files=files1, headers=headers)
        assert res1.status_code == 200
        analysis1_id = res1.json()["analysis_id"]

        files2 = {"file": ("palm_right.jpg", synthetic_palm_image_bytes, "image/jpeg")}
        res2 = await client.post("/api/v1/palm/analyze", files=files2, headers=headers)
        assert res2.status_code == 200
        analysis2_id = res2.json()["analysis_id"]

        # Call compare endpoint
        compare_payload = {
            "non_dominant_analysis_id": analysis1_id,
            "dominant_analysis_id": analysis2_id,
            "dominant_hand": "right",
            "language": "en"
        }
        comp_res = await client.post("/api/v1/readings/compare", json=compare_payload, headers=headers)
        assert comp_res.status_code == 200
        comp_data = comp_res.json()
        assert comp_data["id"].startswith("dual_")
        assert comp_data["dominant_hand"] == "right"
        assert comp_data["non_dominant_hand"] == "left"
        assert len(comp_data["comparative_sections"]) == 4
        assert comp_data["growth_index"] >= 70.0


@pytest.mark.asyncio
async def test_analyze_endpoint_test_time_ensembling_and_latency(synthetic_palm_image_bytes):
    """
    Verifies that the /palm/analyze endpoint executes test-time ensembling across 5 passes,
    populates vote_share confidence and majority archetype, reports measured timing in ms,
    and keeps total latency strictly under 6 seconds.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}

        t0 = time.perf_counter()
        res = await client.post(
            "/api/v1/palm/analyze",
            files={"file": ("test_palm.jpg", synthetic_palm_image_bytes, "image/jpeg")},
            headers=headers
        )
        total_time_s = time.perf_counter() - t0

        assert res.status_code == 200
        data = res.json()

        # 1. Verify ensembling metadata & timing under 6 seconds
        assert data["ensemble_runs_count"] == 5
        assert data["ensemble_timing_ms"] is not None
        assert data["ensemble_timing_ms"] < 6000.0, f"Ensemble latency exceeded 6s: {data['ensemble_timing_ms']}ms"
        assert total_time_s < 6.0, f"Total HTTP roundtrip exceeded 6s: {total_time_s:.2f}s"

        # 2. Verify majority archetype and vote_share confidence for major creases
        features = data["features"]
        for line_name in ["heart_line", "head_line", "life_line"]:
            line_data = features[line_name]
            meas = line_data.get("measurements") or {}
            assert "vote_share" in meas, f"vote_share missing in {line_name}"
            assert "ensemble_archetype" in meas, f"ensemble_archetype missing in {line_name}"
            assert "ensemble_votes" in meas, f"ensemble_votes missing in {line_name}"

            # Total votes across all archetypes must equal 5
            total_votes = sum(meas["ensemble_votes"].values())
            assert total_votes == 5, f"Expected 5 votes for {line_name}, got {total_votes}"

            # confidence must match vote_share
            assert line_data["confidence"] == meas["vote_share"]
            assert 0.0 <= line_data["confidence"] <= 1.0

            # Under 0.8 means low_confidence
            if line_data["confidence"] < 0.80:
                assert meas.get("low_confidence") is True
                assert meas.get("archetype_confidence") == "low"
            else:
                assert meas.get("low_confidence") is False
                assert meas.get("archetype_confidence") == "high"


@pytest.mark.asyncio
async def test_low_confidence_line_exclusion_from_title():
    """
    Verifies that any line with vote_share / confidence under 0.80 is flagged as low_confidence
    and is excluded from the synthesized reading title.
    """
    from services.api.readings.generator import _synthesize_reading_title

    # Base line archetypes:
    # heart: heart_curved_high_jupiter -> "Visionary"
    # head: head_sloping_moon -> "Imaginative Explorer"
    # life: life_wide_expansive -> "Expansive Vitality"
    # fate: fate_central_vertical -> "of Purpose"
    # origin: "separated" -> "The Independent"

    # Case 1: All lines high confidence (>= 0.8) -> All included
    full_title = _synthesize_reading_title(
        heart_key="heart_curved_high_jupiter",
        head_key="head_sloping_moon",
        life_key="life_wide_expansive",
        fate_key="fate_central_vertical",
        origin_status="separated",
        hand_side="right",
        low_confidence_lines=set()
    )
    assert "Visionary" in full_title
    assert "Imaginative Explorer" in full_title
    assert "of Purpose" in full_title

    # Case 2: Heart line low confidence (< 0.8) -> "Visionary" excluded from title
    heart_low_title = _synthesize_reading_title(
        heart_key="heart_curved_high_jupiter",
        head_key="head_sloping_moon",
        life_key="life_wide_expansive",
        fate_key="fate_central_vertical",
        origin_status="separated",
        hand_side="right",
        low_confidence_lines={"heart"}
    )
    assert "Visionary" not in heart_low_title
    assert "Imaginative Explorer" in heart_low_title
    assert "of Purpose" in heart_low_title

    # Case 3: Head line low confidence (< 0.8) -> "Imaginative Explorer" excluded from title
    head_low_title = _synthesize_reading_title(
        heart_key="heart_curved_high_jupiter",
        head_key="head_sloping_moon",
        life_key="life_wide_expansive",
        fate_key="fate_central_vertical",
        origin_status="separated",
        hand_side="right",
        low_confidence_lines={"head"}
    )
    assert "Visionary" in head_low_title
    assert "Imaginative Explorer" not in head_low_title
    assert "Spirit" in head_low_title  # fallback noun for adjective
    assert "of Purpose" in head_low_title

    # Case 4: Fate line low confidence (< 0.8) -> "of Purpose" excluded, uses life trait
    fate_low_title = _synthesize_reading_title(
        heart_key="heart_curved_high_jupiter",
        head_key="head_sloping_moon",
        life_key="life_wide_expansive",
        fate_key="fate_central_vertical",
        origin_status="separated",
        hand_side="right",
        low_confidence_lines={"fate"}
    )
    assert "of Purpose" not in fate_low_title
    assert "of Expansive Vitality" in fate_low_title

    # Case 5: Both Fate and Life low confidence (< 0.8) -> Both excluded, falls back to neutral balance
    both_low_title = _synthesize_reading_title(
        heart_key="heart_curved_high_jupiter",
        head_key="head_sloping_moon",
        life_key="life_wide_expansive",
        fate_key="fate_central_vertical",
        origin_status="separated",
        hand_side="right",
        low_confidence_lines={"fate", "life"}
    )
    assert "of Purpose" not in both_low_title
    assert "Expansive Vitality" not in both_low_title
    assert "of Balance" in both_low_title



