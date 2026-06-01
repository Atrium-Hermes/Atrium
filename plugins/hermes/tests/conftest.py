import pytest


@pytest.fixture(autouse=True)
def hermes_home(tmp_path, monkeypatch):
    """Point all sidecar state at a throwaway dir so tests never touch ~/.atrium-hermes."""
    monkeypatch.setenv("ATRIUM_HERMES_HOME", str(tmp_path / "home"))
    yield
