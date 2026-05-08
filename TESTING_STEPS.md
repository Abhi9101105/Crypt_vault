# CryptVault Testing Steps

## 1. Open the Project

```powershell
cd D:\CryptVault
```

## 2. Database

The project now runs locally with SQLite by default:

```env
DATABASE_URL=sqlite:///./securevault.db
```

PostgreSQL is optional for production testing. If Docker is installed, run `docker compose up -d postgres` and set `DATABASE_URL=postgresql+psycopg://securevault:securevault@localhost:5432/securevault`.

## 3. Install Backend Dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 4. Run the Backend

```powershell
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Check:

```text
http://127.0.0.1:8000/docs
```

## 5. Run the Frontend

Open a second PowerShell window:

```powershell
cd D:\CryptVault\frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## 6. Functional Test Flow

1. Register the first user. This account becomes admin.
2. Upload a `.txt`, `.pdf`, `.csv`, `.png`, `.jpg`, `.docx`, or `.xlsx` file.
3. Download the file and confirm it opens correctly.
4. Click the version history button, upload a new version through the API, then roll back from the UI.
5. Register a second user in another browser or incognito window.
6. As admin/user owner, share a file with the second username.
7. Log in as the second user and confirm the shared file appears.
8. Create a secure share link from the file row.
9. Open the admin panel and confirm audit logs are being recorded.
10. Trigger multiple downloads quickly to generate higher risk audit scores and flagged alerts.

## 7. Security Checks

Backend syntax check:

```powershell
python -m compileall backend app.py
```

Frontend production build:

```powershell
cd frontend
npm run build
```

Encrypted file blobs are stored under `vault/`. Each new file version uses AES-256-GCM with a stored `key_id`, nonce, authentication tag, ciphertext, and SHA-256 digest metadata.
