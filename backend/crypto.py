import base64
import hashlib
import json
from dataclasses import dataclass

from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes

from backend.config import get_settings

NONCE_BYTES = 12
TAG_BYTES = 16


@dataclass(frozen=True)
class EncryptedPayload:
    key_id: str
    nonce: bytes
    ciphertext: bytes
    tag: bytes
    sha256_hash: str = ""

    def to_bytes(self) -> bytes:
        header = {
            "version": 2,
            "algorithm": "AES-256-GCM",
            "key_id": self.key_id,
            "nonce": base64.b64encode(self.nonce).decode("ascii"),
            "tag": base64.b64encode(self.tag).decode("ascii"),
            "sha256": self.sha256_hash,
        }
        header_bytes = json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
        return len(header_bytes).to_bytes(4, "big") + header_bytes + self.ciphertext

    @classmethod
    def from_bytes(cls, blob: bytes) -> "EncryptedPayload":
        if len(blob) < 5:
            raise ValueError("Encrypted blob is too short")
        header_size = int.from_bytes(blob[:4], "big")
        header_end = 4 + header_size
        if header_size <= 0 or header_end > len(blob):
            raise ValueError("Encrypted blob header is invalid")
        header = json.loads(blob[4:header_end])
        alg = header.get("algorithm") or header.get("alg")
        if alg != "AES-256-GCM":
            raise ValueError("Unsupported encrypted payload algorithm")
        return cls(
            key_id=header["key_id"],
            nonce=base64.b64decode(header["nonce"]),
            tag=base64.b64decode(header["tag"]),
            ciphertext=blob[header_end:],
            sha256_hash=header.get("sha256", ""),
        )


def _keyring() -> dict[str, bytes]:
    keys: dict[str, bytes] = {}
    for entry in get_settings().encryption_keys.split(","):
        if not entry.strip():
            continue
        key_id, encoded = entry.split(":", 1)
        key = base64.b64decode(encoded)
        if len(key) != 32:
            raise RuntimeError(f"Encryption key {key_id} must decode to 32 bytes")
        keys[key_id] = key
    if get_settings().active_key_id not in keys:
        raise RuntimeError("ACTIVE_KEY_ID is not present in ENCRYPTION_KEYS")
    return keys


def encrypt_bytes(file_bytes: bytes, aad: bytes = b"") -> EncryptedPayload:
    key_id = get_settings().active_key_id
    key = _keyring()[key_id]
    nonce = get_random_bytes(NONCE_BYTES)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce, mac_len=TAG_BYTES)
    if aad:
        cipher.update(aad)
    ciphertext, tag = cipher.encrypt_and_digest(file_bytes)
    return EncryptedPayload(
        key_id=key_id,
        nonce=nonce,
        ciphertext=ciphertext,
        tag=tag,
        sha256_hash=sha256_hex(file_bytes),
    )


def decrypt_payload(payload: EncryptedPayload, aad: bytes = b"") -> bytes:
    key = _keyring().get(payload.key_id)
    if key is None:
        raise ValueError("Encryption key is unavailable for this file version")
    cipher = AES.new(key, AES.MODE_GCM, nonce=payload.nonce, mac_len=TAG_BYTES)
    if aad:
        cipher.update(aad)
    return cipher.decrypt_and_verify(payload.ciphertext, payload.tag)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify_blob_integrity(blob: bytes) -> bool:
    """Verify that a blob can be parsed and has valid structure before decryption."""
    try:
        payload = EncryptedPayload.from_bytes(blob)
        return len(payload.nonce) == NONCE_BYTES and len(payload.tag) == TAG_BYTES
    except (ValueError, KeyError):
        return False


def rotation_needed(key_id: str) -> bool:
    return key_id != get_settings().active_key_id
