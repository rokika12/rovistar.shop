from types import SimpleNamespace

from PIL import Image

from services import aba_service


def _shop():
    return SimpleNamespace(aba_dict=lambda: {
        "profile_id": "test-profile",
        "secret_key": "test-secret",
    })


def _order():
    return SimpleNamespace(id=42, order_number="ORDER-42", total=1.0)


def test_build_checkout_url_renders_direct_qr_to_public_upload_path(tmp_path, monkeypatch):
    monkeypatch.setattr(aba_service.config, "QR_DIR", str(tmp_path))
    monkeypatch.setattr(
        aba_service,
        "request_direct_qr",
        lambda *args: {"responseCode": "00", "data": {"qrContent": "000201010212"}},
    )

    result = aba_service.build_checkout_url(
        _order(), _shop(), success_url="https://shop.example/success"
    )

    assert result["qr_content"] == "000201010212"
    assert result["qr_code_url"].startswith("/uploads/qr/qr_")
    image_path = tmp_path / result["qr_code_url"].rsplit("/", 1)[-1]
    with Image.open(image_path) as image:
        assert image.format == "PNG"
        assert image.width > 0 and image.height > 0


def test_build_checkout_url_returns_checkout_when_gateway_fails(monkeypatch):
    def fail_request(*args):
        raise RuntimeError("gateway unavailable")

    monkeypatch.setattr(aba_service, "request_direct_qr", fail_request)

    result = aba_service.build_checkout_url(_order(), _shop())

    assert result["checkout_url"].startswith("https://khqr.cc/api/payment/requestv2/")
    assert result["qr_error"].startswith("ABA KHQR is temporarily unreachable")
    assert "qr_code_url" not in result