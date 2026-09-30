"""Unit checks for supplier catalog normalization and encrypted credentials."""
import models
from routers.provider_catalog import _catalog_rows, _normalize, _service_platform


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


def test_flattens_khmer_topup_games_into_sellable_packages():
    rows = _catalog_rows({"games": [{"slug": "freefire-sgmy", "name": "Free Fire", "id_label": "Player ID", "server_label": None, "packages": [{"package_id": 374, "name": "25 Diamonds", "price": 0.24}]}]})
    assert rows[0]["id"] == "freefire-sgmy:374"
    assert rows[0]["package_id"] == 374
    assert _service_platform(rows[0]["game_slug"]) == "free_fire"
