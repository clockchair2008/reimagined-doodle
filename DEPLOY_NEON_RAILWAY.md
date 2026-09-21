# Deploy: Neon + GitHub + Railway

This guide covers a **new empty Neon database** (e.g. after losing the old Neon account) and deploying this monorepo.

Repo: `https://github.com/clockchair2008/reimagined-doodle`

---

## 1. Create Neon database

1. Sign up / log in at [https://neon.tech](https://neon.tech).
2. Create a project (e.g. `zatca`).
3. Copy the connection string. It must look like:

```text
postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
```

4. Keep this URL private (Railway env vars / local `backend/.env` only — never commit it).

---

## 2. Bootstrap schema + admin (one-time)

On your machine, from `backend/`:

```bash
# Put Neon URL in backend/.env (see .env.example)
# DATABASE_URL=postgresql://...?sslmode=require
# DB_SSL=true
# DB_SSL_REJECT_UNAUTHORIZED=false

npm install
npm run db:bootstrap
npm run seed:admin
```

- `db:bootstrap` creates all tables, then runs migrations (including invoice deduction columns + protection triggers).
- `seed:admin` creates `admin@zatca.com` / `admin123` — **change the password after first login**.

Old company/customer/invoice data from the lost Neon project is **not recoverable** unless you have a backup dump.

---

## 3. Push code to GitHub

```bash
git add .
git status
git commit -m "Add invoice deduction amount and description"
git push origin main
```

Use a branch/PR if you prefer review before `main`.

---

## 4. Deploy on Railway

1. Sign up at [https://railway.app](https://railway.app) and connect GitHub.
2. **New Project → Deploy from GitHub repo** → select this repo.

### Backend service

- Root directory: `backend` (or set start command to run from backend)
- Start command: `npm run start:prod` (after build: Railway usually runs `npm install` + `npm run build` if configured)
- Suggested build: `npm install && npm run build`
- Suggested start: `npm run start:prod`

**Environment variables:**

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon connection string (`?sslmode=require`) |
| `DB_SSL` | `true` |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | long random string |
| `PORT` | leave to Railway (app reads `PORT`) |

### Frontend service

- Root directory: `frontend`
- Build: `npm install && npm run build`
- Start: `npm run start` (Next.js)
- Env:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | Public URL of the backend service (e.g. `https://xxx.up.railway.app`) |

---

## 5. After deploy checklist

1. Open the frontend URL → login with admin.
2. Create company + customer (data starts empty).
3. Create an invoice; optional **Deduction Amount** + **Deduction Description** (e.g. advance payment, retention, discount).
4. Issue the invoice and confirm PDF shows deduction + amount due.

---

## Invoice deductions (what was added)

| Field | Meaning |
|-------|---------|
| `deductionAmount` | Amount taken off what the buyer pays |
| `deductionDescription` | Reason (required if amount &gt; 0) |
| `payableAmount` | `totalAmount - deductionAmount` (amount due) |

UBL maps the deduction to `PrepaidAmount` and sets `PayableAmount` accordingly; the reason is stored in a document `Note` and on the PDF.

---

## Troubleshooting

- **Tables missing in production:** run `npm run db:bootstrap` locally against Neon once (production `NODE_ENV` does not auto-sync schema).
- **SSL errors:** ensure `sslmode=require` on the URL and `DB_SSL=true`.
- **CORS / API 404 from frontend:** `NEXT_PUBLIC_API_URL` must match the Railway backend public URL (no trailing path).
