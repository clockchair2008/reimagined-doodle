# ZATCA Phase 2 — Client Onboarding Guide

### What we need from you, and how to get it (step by step)

**Purpose of this document**  
Your system already works for **ZATCA Phase 1** (generate invoices, PDF, QR, XML locally).  
**Phase 2** connects the system to ZATCA’s **Fatoora** platform so invoices are **signed** and **cleared / reported** officially.

You can keep using **Phase 1** and **Phase 2** separately. We only switch a company to Phase 2 after the steps below are complete.

---

## Part A — What you will provide us (checklist)

Please send us the following when ready (email / secure share):

| # | Item | Notes |
|---|------|--------|
| 1 | Company legal name (English) | Must match commercial registration / VAT records |
| 2 | Company legal name (Arabic) | Same as above |
| 3 | VAT number (15 digits) | Saudi VAT / TIN |
| 4 | Commercial Registration (CR) number | If available |
| 5 | Full address | Street, building number, district, city, postal code, country = SA |
| 6 | Contact person | Name, email, phone (for Fatoora / OTP) |
| 7 | Invoice types you use | Standard (B2B) / Simplified (B2C) / Both |
| 8 | Solution / device name | e.g. “Clock Chair E-Invoicing” (we can suggest this) |
| 9 | **Sandbox Compliance CSID** | Certificate + secret/password from Fatoora (sandbox) |
| 10 | **Production CSID** | Only after sandbox tests pass |
| 11 | Confirmation of environment | Sandbox first, then Production |
| 12 | Preferred go-live date | Optional |

**Do not** send certificates over unsecured public chat if possible. Prefer encrypted email or a private link.

---

## Part B — Overview: Phase 1 vs Phase 2

| | Phase 1 (current) | Phase 2 (new) |
|--|-------------------|---------------|
| Generate invoice / PDF / QR | Yes | Yes |
| UBL XML | Yes | Yes |
| Cryptographic digital signature | Optional / not required for live ZATCA | **Required** |
| Send to ZATCA Fatoora | No | **Yes** |
| B2B invoices | Local only | **Clearance** (ZATCA must accept before final) |
| B2C invoices | Local only | **Reporting** (submit after issue) |

---

## Part C — Step-by-step: what you do on Fatoora

> Official portal: [ZATCA E-Invoicing / Fatoora](https://zatca.gov.sa/en/E-Invoicing/Introduction/Pages/default.aspx)  
> Use the **Fatoora** portal for taxpayer / solution onboarding (sandbox then production).  
> Screens and labels can change; if a button name differs slightly, use the closest matching option.

### Step 1 — Confirm your company is ready

1. Confirm you have an active **VAT registration** in Saudi Arabia.
2. Confirm who will manage Fatoora access (accountant, finance, or IT).
3. Confirm whether you issue:
   - **Standard tax invoices** (usually B2B), and/or
   - **Simplified tax invoices** (usually B2C / POS).
4. Tell us which types apply to you (this affects clearance vs reporting).

---

### Step 2 — Create / access Fatoora account

1. Open the ZATCA / Fatoora portal and sign in with your taxpayer credentials.
2. If you do not have access yet, ask your accountant or the person who handles ZATCA filings to invite you or create access.
3. Complete any identity / OTP verification ZATCA asks for.
4. Confirm you can see the **E-Invoicing / Fatoora** section for your VAT number.

**Send us:** name + email of the person who has portal access (for coordination only).

---

### Step 3 — Start in Sandbox (not Production)

Always begin in **Sandbox / Simulation / Developer** environment.

1. In Fatoora, select the **sandbox / simulation** environment (wording may vary).
2. Do **not** generate Production certificates until we finish testing.
3. Tell us: “Sandbox access is ready.”

---

### Step 4 — Register the E-Invoicing Solution (Unit)

ZATCA needs a registered **solution / device / EGS unit** for your software.

1. In Fatoora, open the section to **add / onboard an E-Invoicing solution** (or “EGS”, “Device”, “Solution Unit”).
2. Enter details such as:
   - Solution / unit name (example: `ClockChair-Portal-01`)
   - Organization / branch name
   - City / location
   - Country: **SA**
   - Invoice types: Standard / Simplified / Both (as agreed)
3. Save / submit the solution registration.

**Send us:**

- Exact **solution / unit name** you entered
- Screenshot of the registered unit (optional but helpful)

---

### Step 5 — Generate a CSR (Certificate Signing Request)

Fatoora requires a CSR to issue your cryptographic certificate (CSID).

**Important:**  
In most setups, **we (the software provider) generate the CSR** using ZATCA’s tools/SDK and your company details, then **you** upload it in Fatoora.

#### 5A — Information you must give us before we generate CSR

Send us this form filled:

```text
VAT Number (15 digits): ____________________
Company name (English): ____________________
Company name (Arabic):  ____________________
CR Number:              ____________________
Organization unit:      ____________________  (e.g. Head Office / Main Branch)
Location / City:        ____________________
Country:                SA
Solution/Unit name:     ____________________
Invoice types:          [ ] Standard (B2B)  [ ] Simplified (B2C)  [ ] Both
Environment:            Sandbox
Contact email:          ____________________
Contact phone:          ____________________
```

#### 5B — What happens next

1. We generate the **CSR file** (and keep the private key securely on the server — you normally do **not** get the private key by email).
2. We send you the **CSR file** (usually `.csr` or content to paste).
3. You upload that CSR in Fatoora for the solution unit.

---

### Step 6 — Request Compliance CSID (Sandbox)

1. In Fatoora sandbox, open your registered solution/unit.
2. Choose **request / generate Compliance CSID** (or similar).
3. Upload / paste the CSR we provided.
4. Complete OTP / authentication if asked.
5. Download or copy the issued **Compliance CSID** materials.

You typically receive something like:

- Certificate (public)
- Secret / binary security token / password (depending on portal format)
- Sometimes a request ID / CSID identifier

**Send us securely:**

- Compliance certificate file(s)
- Secret / password / token
- Any request ID shown in the portal
- Confirmation: environment = **Sandbox**

---

### Step 7 — We run compliance tests (our side + yours)

After we install your Compliance CSID:

1. We configure your company in the system for **Phase 2 – Sandbox**.
2. We issue test invoices:
   - Standard (B2B) → **Clearance** path
   - Simplified (B2C) → **Reporting** path
3. ZATCA returns Accepted / Rejected / Warnings.
4. We fix any data/format issues with you (address fields, VAT, customer data, etc.).

**What you do:**

- Provide sample real-looking test customers (B2B with VAT, B2C without if needed)
- Confirm invoice content looks correct
- Approve that sandbox results are acceptable

---

### Step 8 — Request Production CSID (only after sandbox success)

1. Switch to **Production** in Fatoora (only when we say sandbox is passed).
2. Repeat CSR upload / CSID request for **Production** (we may generate a new CSR for production).
3. Download Production CSID certificate + secret.

**Send us securely:**

- Production CSID certificate
- Production secret/token
- Confirmation that Production unit name matches the live company

---

### Step 9 — Go live with Phase 2 (while keeping Phase 1 available)

1. We enable **Phase 2** for your company in the portal.
2. Phase 1 can remain available for selected use cases if you want both modes.
3. New Phase 2 invoices will:
   - Be signed
   - Be submitted to ZATCA
   - Show status: Cleared / Reported / Rejected

**What you confirm to us before go-live:**

- [ ] Production CSID installed
- [ ] First live B2B and/or B2C test agreed
- [ ] Who receives rejection alerts
- [ ] Go-live date/time

---

## Part D — Clearance vs Reporting (so you understand statuses)

| Customer type | Invoice type | Phase 2 action |
|---------------|--------------|----------------|
| B2B (buyer has VAT) | Standard Tax Invoice | **Clearance** — ZATCA must accept; then share with customer |
| B2C (usually no buyer VAT) | Simplified Tax Invoice | **Reporting** — issue, then report to ZATCA |

If clearance/reporting fails, the invoice may need correction and resubmission according to ZATCA rules. We will show status in the system.

---

## Part E — Security rules (please follow)

1. Treat CSID certificate + secret like a bank password.
2. Do not post them in WhatsApp groups or public tickets.
3. Prefer secure email / password-protected zip / private drive link.
4. Tell us immediately if a certificate is leaked or staff with portal access leaves.
5. Never share the **private key** unless we specifically ask through a secured channel (normally we hold it on the server).

---

## Part F — Timeline (typical)

| Stage | Who | Typical duration |
|-------|-----|------------------|
| Collect company data + portal access | Client | 1–3 days |
| CSR generation + Compliance CSID | Client + us | 1–2 days |
| Sandbox testing & fixes | Us + client | Several days (depends on rejections) |
| Production CSID | Client + us | 1 day |
| Go-live | Us + client | 1 day |

Exact timing depends on ZATCA portal responses and data quality.

---

## Part G — Reply template (copy/paste back to us)

```text
Subject: ZATCA Phase 2 onboarding materials

Company English name:
Company Arabic name:
VAT number:
CR number:
Address (full):
City / Postal code:
Contact person / email / phone:

Invoice types: Standard / Simplified / Both
Solution unit name:
Environment ready: Sandbox [ ]  Production [ ]

Attached / shared securely:
[ ] Compliance CSID certificate
[ ] Compliance secret/token
[ ] Production CSID (if ready)
[ ] Screenshots of Fatoora unit (optional)

Preferred go-live date:
Notes:
```

---

## Part H — FAQ

**Q: Can we keep using Phase 1 after Phase 2 is ready?**  
A: Yes. We can keep both modes and enable Phase 2 per company / when you choose.

**Q: Do we need a new system?**  
A: No. We extend the current portal; Phase 2 is an additional integration layer.

**Q: Who creates the CSR?**  
A: Usually we create it from your company details; you upload it in Fatoora and return the CSID.

**Q: What if ZATCA rejects an invoice?**  
A: The system will show the error; we guide correction and resubmission.

**Q: Is sandbox mandatory?**  
A: Strongly recommended (and normally required) before production CSID / live submission.

---

## Support

For portal login issues → contact your ZATCA / Fatoora administrator or ZATCA support.  
For software setup (CSR, CSID install, Phase 2 toggle, testing) → contact your implementation team.
