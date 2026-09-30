"""Unit checks for supplier catalog normalization and encrypted credentials."""
import models
from routers.provider_catalog import _catalog_rows, _normalize


def test_normalizes_nested_catalog_game():
    rows = _catalog_rows({"data": {"games": [{"game_id": 42, "game_name": "Free Fire", "price": "1.25"}]}})
    assert _normalize(rows[0]) == {
        "external_id": "42", "name": "Free Fire", "description": "", "price": 1.25, "image": "",
        "raw": {"game_id": 42, "game_name": "Free Fire", "price": "1.25"},
    }


def test_provider_key_is_encrypted_at_rest():
    provider = models.ProviderConnection(name="Test", catalog_url="https://api.example.com/catalog")
    provider.set_api_key("secret-api-key")
    assert provider.api_key == "secret-api-key"
    assert "secret-api-key" not in provider.api_key_encrypted
