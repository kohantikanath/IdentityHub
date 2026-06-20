import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings


def _get_key() -> bytes:
    """Decode the base64-encoded ENCRYPTION_KEY from .env into raw 32 bytes."""
    return base64.urlsafe_b64decode(get_settings().ENCRYPTION_KEY)


def encrypt(plaintext: str) -> str:
    """
    Encrypt plaintext with AES-256-GCM.

    Why GCM over CBC?
    GCM is authenticated encryption — it guarantees both confidentiality AND
    integrity. If the ciphertext is tampered with, decrypt() raises InvalidTag
    instead of silently returning garbage.

    A fresh 12-byte (96-bit) nonce is generated per call.
    Reusing a nonce with the same key completely breaks GCM security, so we
    never derive or store nonces — os.urandom() gives a cryptographically
    random one every time.

    Storage format: base64(nonce[12] + ciphertext + auth_tag[16])
    """
    nonce = os.urandom(12)
    ciphertext_with_tag = AESGCM(_get_key()).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + ciphertext_with_tag).decode("utf-8")


def decrypt(token: str) -> str:
    """
    Decrypt a token produced by encrypt().
    Raises cryptography.exceptions.InvalidTag if the token was tampered with.
    """
    raw = base64.urlsafe_b64decode(token.encode("utf-8"))
    nonce, ciphertext_with_tag = raw[:12], raw[12:]
    return AESGCM(_get_key()).decrypt(nonce, ciphertext_with_tag, None).decode("utf-8")


def mask_aadhaar(plain: str) -> str:
    """XXXXXXXX1234 — expose only last 4 digits."""
    return f"XXXXXXXX{plain[-4:]}"


def mask_pan(plain: str) -> str:
    """ABXXXXX34F — expose first 2 characters and last 3."""
    return f"{plain[:2]}XXXXX{plain[-3:]}"
