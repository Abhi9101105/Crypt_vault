SecureVault Sample Dataset
==========================

Use these files to test uploads from the dashboard:

Allowed files:
- incident_report.txt
- evidence_notes.txt
- access_logs.csv
- sample_financial_records.csv

Blocked validation test:
- blocked_sample.json

Expected behavior:
- Allowed files should upload successfully.
- SecureVault should create encrypted .enc files in vault/.
- The dashboard Verify Integrity button should return Intact.
- Download should return the original plaintext file.
- The audit dashboard should show LOGIN, UPLOAD, VERIFY, and DOWNLOAD entries as VALID.
- blocked_sample.json should be rejected because .json is not in the allowed extension list.
