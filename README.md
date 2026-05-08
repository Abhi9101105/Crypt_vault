# CryptVault — Secure File Vault

A production-grade encrypted file storage system with AES-256-GCM encryption, JWT authentication, granular ACL permissions, version history, audit logging, and real-time anomaly detection.

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green?logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?logo=sqlite)
![Tests](https://img.shields.io/badge/Tests-87%2F87_Passing-brightgreen)

### [Live Demo → crypt-vault-ashy.vercel.app](https://crypt-vault-ashy.vercel.app)

> **First user to register becomes admin.** Free tier backend may take ~30s to wake from cold start.

---

## Try It Out

Want to test the app? Download these sample files and upload them to CryptVault:

| File | Type | Description |
|------|------|-------------|
| [`test_upload_report.txt`](sample_dataset/test_upload_report.txt) | TXT | Simulated incident report (classified document) |
| [`test_upload_audit.csv`](sample_dataset/test_upload_audit.csv) | CSV | Security audit log with risk scores |
| [`evidence_notes.txt`](sample_dataset/evidence_notes.txt) | TXT | Forensic evidence notes |
| [`sample_financial_records.csv`](sample_dataset/sample_financial_records.csv) | CSV | Financial transaction records |

---

### Demo Scenario 1 — Quick Start (Single User)

1. Open the [Live Demo](https://crypt-vault-ashy.vercel.app)
2. Click **Create Account** → Register as `admin1` / `admin@vault.io` / `SecurePass123!@`
3. Login with the same credentials
4. Click **Upload** → drag in `test_upload_report.txt`
5. Click ⋮ → **Download** → verify the decrypted content matches
6. Click ⋮ → **Verify Integrity** → should show "Integrity check passed"
7. Upload `test_upload_report.txt` again → version badge changes to **v2** (auto-versioning)
8. Click ⋮ → **Version History** → see both versions, download v1 to compare
9. Check the **Audit** tab in the sidebar → all your actions are logged with timestamps

---

### Demo Scenario 2 — File Sharing & ACL (Two Users)

**Step 1: Setup as Admin**
1. Login as `admin1` (or register if fresh deploy)
2. Upload `sample_financial_records.csv`
3. Click ⋮ → **Share** → Users tab
4. Type `analyst1` in the username field, select **Read** permission → click **Share**

**Step 2: Switch to second user**
1. Click your username in the sidebar → **Logout**
2. Click **Create Account** → Register as `analyst1` / `analyst@vault.io` / `SecurePass123!@`
3. Login as `analyst1`

**Step 3: Verify shared access**
1. You should see `sample_financial_records.csv` in your file list (shared by admin)
2. Click ⋮ → **Download** → works (you have read permission)
3. Click ⋮ → notice **Delete is missing** (you only have read access, not delete)
4. Try uploading a new version of the same file → blocked (no write permission)

**Step 4: Verify isolation**
1. Upload a new file as `analyst1` (e.g., `evidence_notes.txt`)
2. Logout → Login as `admin1`
3. Admin can see their own files but **cannot** see `analyst1`'s private file (unless shared)

---

### Demo Scenario 3 — Admin Security & Anomaly Detection

**Step 1: Trigger security alerts**
1. Logout from any account
2. Try logging in with `admin1` and **wrong passwords** — do this **6+ times** rapidly
3. Login with the correct password

**Step 2: Check admin dashboard**
1. The **stat cards** at the top show updated "Failed Logins" count
2. Click **Alerts** in the sidebar → You'll see flagged events with risk scores (65+)
3. Each alert shows the reason (e.g., "failed_login burst from same user")
4. Click the **eye icon** to acknowledge → click **X** to dismiss

**Step 3: Review audit trail**
1. Click **Audit** in the sidebar
2. Every action is logged: login, failed_login, upload, download, share, delete
3. Use the **filter dropdown** to view only specific action types
4. Each log entry includes: user, action, resource, risk score, timestamp

> **Note:** The admin dashboard (stats, audit, alerts) is only visible to the first registered user (admin role). Regular users see only their own files.

## Features

| Feature | Description |
|---------|-------------|
| **Authentication** | JWT access + refresh tokens, Argon2 password hashing, role-based access (admin/user) |
| **File Upload** | Multi-file drag-and-drop, progress tracking, file type validation (30+ types) |
| **Encryption at Rest** | AES-256-GCM with AAD, SHA-256 integrity hashing, keyring rotation support |
| **Download & Decryption** | Streaming decryption, original filename/MIME restoration |
| **Integrity Verification** | SHA-256 + GCM tag verification detects any blob tampering |
| **Version History** | Auto-versioning for same-name uploads, per-version download |
| **Rollback** | Restore any previous version as current |
| **File Sharing** | Share with users (read/write/delete ACL) or via expiring public links |
| **Secure Share Links** | Token-based public download links with configurable expiry |
| **Delete** | Cascade blob cleanup from disk on deletion |
| **Audit Logging** | Every action logged: login, upload, download, share, delete, rollback |
| **Anomaly Detection** | Risk scoring engine, failed-login burst detection, delete-spike alerts |
| **Admin Dashboard** | Real-time stats, filterable audit logs, alert management |
| **Modern UI** | Dark-mode React frontend with glassmorphism, animations, and premium design |

---

## Architecture

```
CryptVault/
├── backend/
│   ├── api/               # FastAPI route handlers
│   │   ├── auth.py        # Register, login, refresh, logout
│   │   ├── files.py       # Upload, download, versions, share, delete
│   │   ├── admin.py       # Stats, audit logs, flagged events
│   │   └── share.py       # Public share link download
│   ├── services/          # Business logic layer
│   │   ├── auth_service.py
│   │   ├── file_service.py
│   │   ├── audit_service.py
│   │   └── anomaly_service.py
│   ├── config.py          # Pydantic settings from .env
│   ├── crypto.py          # AES-256-GCM encrypt/decrypt
│   ├── database.py        # SQLAlchemy engine + session
│   ├── models.py          # ORM models
│   ├── schemas.py         # Pydantic request/response models
│   ├── security.py        # JWT, password hashing, RBAC
│   └── main.py            # FastAPI app entry point
├── frontend/
│   ├── src/
│   │   ├── components/    # React UI components
│   │   ├── api.js         # API client with auth + upload progress
│   │   ├── store.jsx      # React Context state management
│   │   ├── styles.css     # Dark-mode design system
│   │   └── main.jsx       # App entry point
│   ├── vercel.json        # Vercel SPA routing config
│   ├── vite.config.js     # Vite + API proxy config
│   └── package.json
├── vault/                 # Encrypted file storage (gitignored)
├── render.yaml            # Render deployment blueprint
├── .env.example           # Environment variable template
├── requirements.txt       # Python dependencies
└── README.md
```

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Clone
```bash
git clone https://github.com/Abhi9101105/Crypt_vault.git
cd Crypt_vault
```

### 2. Backend
```bash
python3 -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate          # Windows

pip install -r requirements.txt

cp .env.example .env
# Edit .env — generate secrets using the commands inside the file

uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open
Navigate to **http://127.0.0.1:5173**

> The first registered user automatically becomes **admin**.

---

## Production Deployment

### Backend → Render

#### Option A: One-click (Blueprint)
1. Fork this repo
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
3. Connect your GitHub repo
4. Render reads `render.yaml` and creates the service automatically

#### Option B: Manual Setup
1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Runtime** | Python |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
| **Plan** | Free |

4. Set **Environment Variables** in Render dashboard:

| Variable | Value |
|----------|-------|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | `sqlite:///./securevault.db` (or PostgreSQL URL) |
| `JWT_SECRET` | Generate: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `AUDIT_HMAC_SECRET` | Generate: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ENCRYPTION_KEYS` | Generate: `python3 -c "import base64,os; print('v1:'+base64.b64encode(os.urandom(32)).decode())"` |
| `ACTIVE_KEY_ID` | `v1` |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` (your Vercel URL) |
| `PYTHON_VERSION` | `3.11.11` |

5. Click **Create Web Service**
6. Copy the service URL (e.g., `https://cryptvault-api.onrender.com`)

---

### Frontend → Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**
2. Import your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

4. Set **Environment Variable**:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://cryptvault-api.onrender.com` (your Render URL) |

5. Click **Deploy**

---

### Post-Deployment Checklist

- [ ] Backend is live on Render (check `/api/auth/me` returns 401)
- [ ] Frontend is live on Vercel
- [ ] Update Render's `ALLOWED_ORIGINS` with your actual Vercel URL
- [ ] Register first user (becomes admin)
- [ ] Upload a test file
- [ ] Verify download decrypts correctly

---

## Security Design

### Encryption
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Management**: Keyring with versioned keys, rotation support
- **Blob Format**: `[key_id | nonce | GCM_tag | SHA-256 | ciphertext]`
- **AAD**: `file_id:version_number:filename` bound to each blob

### Authentication
- **Passwords**: Argon2id hashing (with bcrypt fallback)
- **Tokens**: JWT access (15 min) + secure refresh tokens (14 days)
- **Refresh**: SHA-256 hashed, one-time-use, revocable

### Authorization
- **RBAC**: Admin and User roles
- **ACL**: Per-file, per-user permissions (read, write, delete)
- **Share Links**: Token-based with configurable expiry

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security` (production only)

---

## Testing

### Automated (87 tests across 16 phases)
```bash
source .venv/bin/activate
python3 test_all_phases.py
```

### Test Coverage
| Phase | Area | Tests |
|-------|------|-------|
| 1 | Authentication & Roles | 7 |
| 2 | File Upload | 9 |
| 3 | Encryption at Rest | 3 |
| 4 | Download + Decryption | 6 |
| 5 | Integrity Verification | 4 |
| 6 | Version History | 5 |
| 7 | Rollback | 3 |
| 8 | File Sharing | 6 |
| 9 | Secure Share Links | 4 |
| 10 | ACL Permissions | 5 |
| 11 | Delete System | 3 |
| 12 | Audit Logging | 11 |
| 13 | Risk Detection | 4 |
| 14 | Admin Dashboard | 7 |
| 15 | Security Validation | 9 |
| 16 | UI Build | 1 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Frontend | React 19, Vite, Framer Motion, Lucide Icons |
| Database | SQLite (WAL mode) / PostgreSQL ready |
| Encryption | PyCryptodome (AES-256-GCM) |
| Auth | python-jose (JWT), passlib (Argon2) |
| Styling | TailwindCSS + custom dark-mode design system |
| Deployment | Render (backend) + Vercel (frontend) |

---

## License

MIT License — see [LICENSE](LICENSE) for details.
