from fastapi.testclient import TestClient

from log_ui.app import STATIC_DIR, create_app
from log_ui.settings import Settings


def test_missing_bundle_gives_hint(store_dir, tmp_path):
    c = TestClient(create_app(Settings(store_dir=store_dir), static_dir=tmp_path / "empty"))
    r = c.get("/")
    assert r.status_code == 200 and "npm run build" in r.text
    assert c.get("/api/health").status_code == 200
    assert c.get("/api/does-not-exist").status_code == 404


def test_spa_routing_with_bundle(store_dir, tmp_path):
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<!doctype html><title>log-ui test</title><div id=root></div>")
    (static / "assets" / "app.js").write_text("console.log(1)")
    (static / "favicon.svg").write_text("<svg/>")
    c = TestClient(create_app(Settings(store_dir=store_dir), static_dir=static))
    for path in ("/", "/p/demo", "/p/demo/runs/run-a", "/p/demo/views/ladder?runs=a"):
        r = c.get(path)
        assert r.status_code == 200 and "log-ui test" in r.text, path
    assert c.get("/assets/app.js").text == "console.log(1)"
    assert c.get("/favicon.svg").text == "<svg/>"
    assert c.get("/api/health").json()["ok"] is True
    assert "log-ui test" not in c.get("/api/nothing").text


def test_real_bundle_if_built(store_dir):
    if not (STATIC_DIR / "index.html").exists():
        import pytest

        pytest.skip("web bundle not built")
    c = TestClient(create_app(Settings(store_dir=store_dir)))
    r = c.get("/p/demo")
    assert r.status_code == 200 and "<div id=\"root\"" in r.text
