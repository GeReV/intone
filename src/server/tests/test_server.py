import json

import pytest

from server import create_app


@pytest.fixture
def client(mock_engine):
    app = create_app(mock_engine)
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_voices_returns_json_list(client):
    response = client.get("/voices")
    assert response.status_code == 200
    assert response.content_type == "application/json"
    data = json.loads(response.data)
    assert data == ["af", "af_bella"]


def test_synthesize_returns_ogg_audio(client):
    response = client.get("/synthesize?text=hello&voice=af&rate=1.0")
    assert response.status_code == 200
    assert response.content_type == "audio/ogg"
    assert response.data == b"fake_ogg_audio"


def test_synthesize_missing_text_returns_400(client):
    response = client.get("/synthesize")
    assert response.status_code == 400


def test_synthesize_empty_text_returns_400(client):
    response = client.get("/synthesize?text=   ")
    assert response.status_code == 400


def test_synthesize_unknown_voice_returns_400(client):
    response = client.get("/synthesize?text=hello&voice=not_real")
    assert response.status_code == 400


def test_synthesize_uses_default_voice(client):
    response = client.get("/synthesize?text=hello")
    assert response.status_code == 200


def test_synthesize_invalid_rate_falls_back_to_default(client):
    response = client.get("/synthesize?text=hello&rate=notanumber")
    assert response.status_code == 200


def test_synthesize_rate_clamped_below(client, mock_engine, monkeypatch):
    captured = {}

    def fake_synthesize(text, voice, rate):
        captured["rate"] = rate
        return b"x"

    monkeypatch.setattr(mock_engine, "synthesize", fake_synthesize)
    client.get("/synthesize?text=hello&rate=0.1")
    assert captured["rate"] == 0.5


def test_synthesize_rate_clamped_above(client, mock_engine, monkeypatch):
    captured = {}

    def fake_synthesize(text, voice, rate):
        captured["rate"] = rate
        return b"x"

    monkeypatch.setattr(mock_engine, "synthesize", fake_synthesize)
    client.get("/synthesize?text=hello&rate=5.0")
    assert captured["rate"] == 2.0


def test_cors_header_on_voices(client):
    response = client.get("/voices")
    assert "Access-Control-Allow-Origin" in response.headers


def test_cors_header_on_synthesize(client):
    response = client.get("/synthesize?text=hello")
    assert "Access-Control-Allow-Origin" in response.headers


def test_synthesis_error_returns_500(mock_engine, monkeypatch):
    def boom(text, voice, rate):
        raise RuntimeError("model exploded")

    monkeypatch.setattr(mock_engine, "synthesize", boom)
    app = create_app(mock_engine)
    app.config["TESTING"] = True
    with app.test_client() as c:
        response = c.get("/synthesize?text=hello")
    assert response.status_code == 500
