import hashlib
import os

from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad, unpad
from dotenv import load_dotenv


load_dotenv()

PBKDF2_ITERATIONS = 310_000
AES_KEY_LENGTH = 32
AES_KEY_SALT = b"encrypted-file-vault-aes-key-v1"


def require_env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def to_bytes(value):
    if isinstance(value, bytes):
        return value
    return str(value).encode("utf-8")


def derive_key(password, salt):
    """Derive a 32-byte AES-256 key with PBKDF2-HMAC-SHA256."""
    return hashlib.pbkdf2_hmac(
        "sha256",
        to_bytes(password),
        to_bytes(salt),
        PBKDF2_ITERATIONS,
        dklen=AES_KEY_LENGTH,
    )


def get_aes_key():
    master_secret = require_env("AES_SECRET")
    return derive_key(master_secret, AES_KEY_SALT)


def encrypt_file(file_bytes):
    """Encrypt raw bytes with AES-256-CBC and prepend the IV."""
    if not isinstance(file_bytes, bytes):
        raise TypeError("file_bytes must be bytes")

    iv = get_random_bytes(AES.block_size)
    cipher = AES.new(get_aes_key(), AES.MODE_CBC, iv)
    encrypted_bytes = cipher.encrypt(pad(file_bytes, AES.block_size))
    return iv + encrypted_bytes


def decrypt_file(encrypted_blob):
    """Decrypt an IV-prefixed AES-256-CBC blob and remove PKCS7 padding."""
    if not isinstance(encrypted_blob, bytes):
        raise TypeError("encrypted_blob must be bytes")
    if len(encrypted_blob) <= AES.block_size:
        raise ValueError("encrypted blob is too short")

    iv = encrypted_blob[: AES.block_size]
    encrypted_bytes = encrypted_blob[AES.block_size :]
    if len(encrypted_bytes) % AES.block_size != 0:
        raise ValueError("encrypted payload is not block aligned")

    cipher = AES.new(get_aes_key(), AES.MODE_CBC, iv)
    return unpad(cipher.decrypt(encrypted_bytes), AES.block_size)


def hash_file(file_bytes):
    """Return the SHA-256 hex digest of the original file bytes."""
    if not isinstance(file_bytes, bytes):
        raise TypeError("file_bytes must be bytes")
    return hashlib.sha256(file_bytes).hexdigest()
