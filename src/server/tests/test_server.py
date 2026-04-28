import json

import pytest

from server import EngineRef, create_app


@pytest.fixture
def client(engine_ref):
    app = create_app(engine_ref)
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
    app = create_app(EngineRef(name="mock", engine=mock_engine, device="cpu"))
    app.config["TESTING"] = True
    with app.test_client() as c:
        response = c.get("/synthesize?text=hello")
    assert response.status_code == 500


def test_voices_error_returns_500(mock_engine, monkeypatch):
    def boom():
        raise RuntimeError("engine dead")

    monkeypatch.setattr(mock_engine, "voices", boom)
    app = create_app(EngineRef(name="mock", engine=mock_engine, device="cpu"))
    app.config["TESTING"] = True
    with app.test_client() as c:
        response = c.get("/voices")
    assert response.status_code == 500


def test_synthesize_unknown_default_voice_returns_400(mock_engine, monkeypatch):
    import server as server_module
    monkeypatch.setattr(server_module, "DEFAULT_VOICE", "nonexistent")
    app = create_app(EngineRef(name="mock", engine=mock_engine, device="cpu"))
    app.config["TESTING"] = True
    with app.test_client() as c:
        response = c.get("/synthesize?text=hello")
    assert response.status_code == 400


# --- GET /engine ---

def test_get_engine_returns_name_and_voices(client):
    response = client.get("/engine")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["engine"] == "mock"
    assert data["voices"] == ["af", "af_bella"]


# --- POST /engine ---

def test_swap_engine_success(client, engine_ref, monkeypatch):
    import server as server_module

    new_mock = type("NewMock", (), {
        "voices": lambda self: ["af_heart"],
        "synthesize": lambda self, t, v, r: b"new_audio",
    })()

    monkeypatch.setattr(server_module, "_build_engine", lambda name, device: new_mock)

    response = client.post("/engine?name=kokoro1")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["engine"] == "kokoro1"
    assert data["voices"] == ["af_heart"]
    assert engine_ref.current is new_mock


def test_swap_engine_missing_name_returns_400(client):
    response = client.post("/engine")
    assert response.status_code == 400


def test_swap_engine_unknown_name_returns_400(client, monkeypatch):
    import server as server_module

    def raise_value_error(name, device):
        raise ValueError(f"Unknown engine: {name!r}")

    monkeypatch.setattr(server_module, "_build_engine", raise_value_error)

    response = client.post("/engine?name=nonexistent")
    assert response.status_code == 400


def test_swap_engine_init_failure_returns_500(client, monkeypatch):
    import server as server_module

    def exploding_build(name, device):
        raise RuntimeError("GPU exploded")

    monkeypatch.setattr(server_module, "_build_engine", exploding_build)

    response = client.post("/engine?name=kokoro1")
    assert response.status_code == 500


def test_swap_engine_updates_voices_endpoint(client, engine_ref, monkeypatch):
    import server as server_module

    new_mock = type("NewMock", (), {
        "voices": lambda self: ["af_heart", "am_adam"],
        "synthesize": lambda self, t, v, r: b"x",
    })()

    monkeypatch.setattr(server_module, "_build_engine", lambda name, device: new_mock)
    client.post("/engine?name=kokoro1")

    response = client.get("/voices")
    data = json.loads(response.data)
    assert data == ["af_heart", "am_adam"]
