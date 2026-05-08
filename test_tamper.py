import io
import json
import os
import uuid

from audit import AUDIT_LOG_FILE, get_hmac_secret_key, record_action, verify_log
from app import app, get_db, init_db


def print_result(name, passed, details):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}: {details}")


def load_logs():
    if not os.path.exists(AUDIT_LOG_FILE):
        return []

    entries = []
    with open(AUDIT_LOG_FILE, "r", encoding="utf-8") as audit_file:
        for line in audit_file:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return entries


def save_logs(entries):
    with open(AUDIT_LOG_FILE, "w", encoding="utf-8") as audit_file:
        for entry in entries:
            audit_file.write(json.dumps(entry, sort_keys=True) + "\n")


def test_log_tampering_detection():
    secret_key = get_hmac_secret_key()
    entries = load_logs()

    if not entries or not any(verify_log(entry, secret_key) for entry in entries):
        record_action(
            username="tamper_seed",
            action="LOGIN",
            filename="N/A",
            file_hash="N/A",
            ip_address="127.0.0.1",
        )
        entries = load_logs()

    tampered_index = None
    for index, entry in enumerate(entries):
        if verify_log(entry, secret_key):
            entry["username"] = f"{entry.get('username', 'unknown')}_tampered"
            tampered_index = index
            break

    save_logs(entries)

    tampered_entries = [
        index
        for index, entry in enumerate(load_logs())
        if not verify_log(entry, secret_key)
    ]
    passed = tampered_index in tampered_entries
    print_result(
        "Log Tampering Detection",
        passed,
        f"entry index {tampered_index} was flagged as TAMPERED",
    )
    return passed


def register_and_login(client, username, password):
    client.post(
        "/register",
        data={
            "username": username,
            "password": password,
            "confirm_password": password,
        },
        follow_redirects=True,
    )
    return client.post(
        "/login",
        data={"username": username, "password": password},
        follow_redirects=True,
    )


def create_test_file(client, username):
    file_bytes = b"Phase 3 tamper detection sample file."
    client.post(
        "/upload",
        data={
            "file": (
                io.BytesIO(file_bytes),
                f"{username}_sample.txt",
            )
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )

    with app.app_context():
        file_record = get_db().execute(
            """
            SELECT *
            FROM files
            WHERE owner_username = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (username,),
        ).fetchone()
        return dict(file_record)


def corrupt_encrypted_file(file_record):
    encrypted_path = os.path.join(app.config["VAULT_FOLDER"], file_record["stored_filename"])
    with open(encrypted_path, "rb") as encrypted_file:
        encrypted_blob = bytearray(encrypted_file.read())

    midpoint = max(16, len(encrypted_blob) // 2)
    for offset in range(3):
        if midpoint + offset < len(encrypted_blob):
            encrypted_blob[midpoint + offset] ^= 0xFF

    with open(encrypted_path, "wb") as encrypted_file:
        encrypted_file.write(encrypted_blob)


def test_file_corruption_detection(client, file_record):
    corrupt_encrypted_file(file_record)
    response = client.post(f"/verify/{file_record['id']}")
    payload = response.get_json(silent=True) or {}
    passed = response.status_code == 200 and payload.get("status") == "corrupted"
    print_result(
        "File Corruption Detection",
        passed,
        f"/verify/{file_record['id']} returned {payload}",
    )
    return passed


def test_unauthorized_download(owner_file_id):
    intruder_client = app.test_client()
    intruder_username = f"intruder_{uuid.uuid4().hex[:8]}"
    password = "TamperTest123!"

    register_and_login(intruder_client, intruder_username, password)
    response = intruder_client.get(f"/download/{owner_file_id}")
    passed = response.status_code == 403
    print_result(
        "Unauthorized Access Attempt",
        passed,
        f"different user received HTTP {response.status_code}",
    )
    return passed


def main():
    app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)

    with app.app_context():
        init_db()

    owner_client = app.test_client()
    owner_username = f"owner_{uuid.uuid4().hex[:8]}"
    password = "TamperTest123!"

    register_and_login(owner_client, owner_username, password)
    file_record = create_test_file(owner_client, owner_username)

    results = [
        test_log_tampering_detection(),
        test_file_corruption_detection(owner_client, file_record),
        test_unauthorized_download(file_record["id"]),
    ]

    print()
    if all(results):
        print("All tamper simulation tests passed.")
    else:
        print("One or more tamper simulation tests failed.")


if __name__ == "__main__":
    main()
