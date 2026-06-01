from pathlib import Path

import pytest

from atrium_hermes import manifest

FIXTURES = Path(__file__).parent / "fixtures"


def read(name: str) -> str:
    return (FIXTURES / name).read_text()


def test_parse_valid():
    parsed = manifest.parse(read("incomplete.md"))
    assert parsed.meta["name"] == "ts-refactor-helper"
    assert "Suggests safe" in parsed.body


def test_parse_no_frontmatter_raises():
    with pytest.raises(manifest.ManifestError):
        manifest.parse("# just a heading\nno frontmatter here")


def test_economic_completeness():
    assert manifest.is_economically_complete(manifest.parse(read("complete.md")).meta) is True
    assert manifest.is_economically_complete(manifest.parse(read("incomplete.md")).meta) is False


def test_augment_adds_missing_fields():
    meta = manifest.parse(read("incomplete.md")).meta
    out = manifest.augment(meta, default_price="0.001", session="sess-123")
    assert out["price_per_call_usdc"] == "0.001"
    assert out["derivation_method"] == "hermes-loop"
    assert out["hermes_session"] == "sess-123"


def test_augment_does_not_clobber_existing():
    meta = manifest.parse(read("complete.md")).meta
    out = manifest.augment(meta, default_price="0.001")
    assert out["price_per_call_usdc"] == "0.005"  # kept
    assert out["derivation_method"] == "manual"  # kept


def test_serialize_roundtrip():
    parsed = manifest.parse(read("incomplete.md"))
    augmented = manifest.augment(parsed.meta, default_price="0.002")
    text = manifest.serialize(augmented, parsed.body)
    reparsed = manifest.parse(text)
    assert reparsed.meta["price_per_call_usdc"] == "0.002"
    assert reparsed.meta["name"] == "ts-refactor-helper"
    assert "Suggests safe" in reparsed.body
