from pathlib import Path

import pytest

from atrium_hermes import manifest, publisher, watcher
from atrium_hermes.config import Config, PublishingCfg, WatchCfg

FIXTURES = Path(__file__).parent / "fixtures"


def make_cfg(skills_dir: Path, auto: bool = True) -> Config:
    return Config(
        watch=WatchCfg(hermes_skills_dir=str(skills_dir), debounce_seconds=0.1),
        publishing=PublishingCfg(default_price_usdc="0.001", auto_publish=auto, network="base-sepolia"),
    )


def test_matches_ignore_pattern(tmp_path):
    proc = watcher.SkillProcessor(make_cfg(tmp_path))
    assert proc.matches_ignore_pattern(Path("test-thing.md")) is True  # test-*
    assert proc.matches_ignore_pattern(Path("notes.draft.md")) is True  # *.draft.md
    assert proc.matches_ignore_pattern(Path("real-skill.md")) is False


def test_is_ignored_via_ignore_file(tmp_path):
    proc = watcher.SkillProcessor(make_cfg(tmp_path))
    target = tmp_path / "keep-me-out.md"
    assert proc.is_ignored(target) is False
    watcher.add_ignored(str(target))
    assert proc.is_ignored(target) is True


def test_process_skill_augments_and_publishes(tmp_path, monkeypatch):
    skill = tmp_path / "ts-refactor-helper.md"
    skill.write_text((FIXTURES / "incomplete.md").read_text())

    calls = {}

    def fake_publish(path, network, timeout=300):
        calls["path"] = str(path)
        return publisher.PublishResult(ok=True, skill_id="0x" + "ab" * 32, tx="0xdead", cid="bafy")

    monkeypatch.setattr(publisher, "publish", fake_publish)

    proc = watcher.SkillProcessor(make_cfg(tmp_path, auto=True))
    proc.process_skill(skill)

    # file was augmented with the default price
    assert manifest.parse(skill.read_text()).meta["price_per_call_usdc"] == "0.001"
    # publish ran and was recorded
    assert calls["path"] == str(skill)
    assert str(skill) in publisher.published_paths()


def test_process_skill_skips_ignored(tmp_path, monkeypatch):
    skill = tmp_path / "test-scratch.md"  # matches default ignore pattern test-*
    skill.write_text((FIXTURES / "incomplete.md").read_text())

    monkeypatch.setattr(publisher, "publish", lambda *a, **k: pytest.fail("should not publish"))

    proc = watcher.SkillProcessor(make_cfg(tmp_path, auto=True))
    proc.process_skill(skill)
    assert str(skill) not in publisher.published_paths()


def test_already_published_not_republished(tmp_path, monkeypatch):
    skill = tmp_path / "done.md"
    skill.write_text((FIXTURES / "complete.md").read_text())
    publisher.record_published({"path": str(skill), "name": "done", "skill_id": "0x1"})

    monkeypatch.setattr(publisher, "publish", lambda *a, **k: pytest.fail("should not republish"))
    proc = watcher.SkillProcessor(make_cfg(tmp_path, auto=True))
    proc.process_skill(skill)
