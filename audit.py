import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv


load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
AUDIT_LOG_FILE = os.path.join(BASE_DIR, "audit_log.json")
VALID_ACTIONS = {"LOGIN", "LOGOUT", "UPLOAD", "DOWNLOAD", "DELETE", "VERIFY"}


def require_env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def normalize_secret(secret_key):
    if isinstance(secret_key, bytes):
        return secret_key
    return str(secret_key).encode("utf-8")


def get_hmac_secret_key():
    return normalize_secret(require_env("HMAC_SECRET"))


def generate_hmac(log_entry, secret_key):
    unsigned_entry = {
        key: value
        for key, value in log_entry.items()
        if key != "hmac_signature"
    }
    message = json.dumps(
        unsigned_entry,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hmac.new(normalize_secret(secret_key), message, hashlib.sha256).hexdigest()


def write_log(entry):
    signed_entry = dict(entry)
    signed_entry["hmac_signature"] = generate_hmac(
        signed_entry,
        get_hmac_secret_key(),
    )

    with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as audit_file:
        audit_file.write(json.dumps(signed_entry, sort_keys=True) + "\n")

    return signed_entry


def verify_log(entry, secret_key):
    stored_signature = entry.get("hmac_signature", "")
    expected_signature = generate_hmac(entry, secret_key)
    return hmac.compare_digest(stored_signature, expected_signature)


def record_action(username, action, filename="N/A", file_hash="N/A", ip_address="N/A"):
    if action not in VALID_ACTIONS:
        raise ValueError(f"Unsupported audit action: {action}")

    entry = {
        "log_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "username": username,
        "action": action,
        "filename": filename or "N/A",
        "file_hash": file_hash or "N/A",
        "ip_address": ip_address or "N/A",
    }
    return write_log(entry)
