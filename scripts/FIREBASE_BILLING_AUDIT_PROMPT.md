# Firebase / GCP billing protection — reusable audit prompt

Copy everything below the line into Cursor (or any AI assistant) when starting or reviewing a Firebase + Hosting project.

---

Review this Firebase/GCP project for billing-spike risk and implement protections:

## 1. HOSTING BANDWIDTH

- Never stream large files (PDF, PPTX, video, ZIP) through Cloud Functions or Hosting rewrites. Use direct object-storage URLs (B2, GCS, Firebase Storage) with **302 redirects** or short-lived signed URLs only.
- Add long cache headers for `/assets/**` and short cache for `index.html`.
- Keep the deployed static bundle small; lazy-load routes that import tesseract, exceljs, pdfjs, mammoth, or other 500KB+ libraries.
- Remove `modulepreload` for lazy-only chunks in the Vite production build.

## 2. CRAWLERS

- `robots.txt`: Disallow `/api/`, `/admin/`, `/student/`, `/tutor/`, and block AI bots (GPTBot, PerplexityBot, ClaudeBot, Google-Extended, Bytespider, CCBot) unless explicitly needed for SEO training.
- Do not advertise download APIs in `llms.txt`.
- Sitemap should only list true public marketing pages (no private app paths).

## 3. API QUOTAS (Cloud Functions)

- Per-IP rate limit (~120 requests/hour).
- Daily caps: **10 GB egress**, **1,000 Firestore reads**, **1,000 Firestore writes** (track in `system/apiQuota/{YYYY-MM-DD}`, Admin SDK only).
- Block crawler user-agents on public unauthenticated download endpoints.

## 4. SPLIT MARKETING vs PRIVATE APP (recommended)

Use **two Firebase Hosting targets** in one project:

| Target | Domain | Build | Purpose |
|--------|--------|-------|---------|
| `marketing` | `example.com` | Lightweight Vite entry (public pages only) | SEO, portfolios, contact |
| `app` | `app.example.com` | Full SPA (student/tutor/admin) | Auth apps, heavy JS |

Implementation checklist:

1. `firebase hosting:sites:create <project-app>` for the second site.
2. `.firebaserc` targets: `marketing` → main site, `app` → app site.
3. `firebase.json` hosting array with two targets, different `public` folders (`dist/marketing`, `dist/app`).
4. Marketing `redirects` for `/student/**`, `/tutor/**`, `/admin/**` → `https://app.example.com/...`.
5. App site `robots.txt`: `Disallow: /` (block all crawlers).
6. Env: `VITE_APP_ORIGIN=https://app.example.com`; marketing links to private routes use `appUrl('/student/...')`.
7. Deploy: `firebase deploy --only hosting:marketing,hosting:app,functions`.

## 5. GCP BUDGET ALERT — $10/month (step-by-step)

### Option A — Google Cloud Console (manual)

1. Open [Google Cloud Billing](https://console.cloud.google.com/billing).
2. Select your **billing account** (the one linked to the Firebase project).
3. Go to **Budgets & alerts** → **Create budget**.
4. **Scope**: choose **Projects** → select only this Firebase project (not all projects).
5. **Amount**: **$10** per month (calendar month).
6. **Thresholds**: enable alerts at **50%**, **90%**, and **100%** ($5, $9, $10).
7. **Notifications**: check your email (billing admins receive alerts by default).
8. **Save**.

### Option B — gcloud CLI (automated)

```bash
# From project root (adjust PROJECT_ID and BILLING_ACCOUNT)
gcloud services enable billingbudgets.googleapis.com --project=YOUR_PROJECT_ID

gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="Project $10 monthly" \
  --budget-amount=10USD \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 \
  --filter-projects=projects/YOUR_PROJECT_ID
```

Find billing account ID: `gcloud billing projects describe YOUR_PROJECT_ID`

### After creating the budget

- Add a **second alert** at $20 if you want a hard warning before runaway costs.
- Check **Billing → Reports** weekly for the first month after any deploy.

## 6. MONITORING

- Firebase Console → Hosting → Usage (watch bandwidth after deploys).
- Billing → Reports → filter by **Firebase Hosting** SKU.
- If bandwidth spikes with low Analytics users → bot/crawler issue, not real traffic.

## 7. DELIVERABLES

Apply the changes, build, and deploy `functions`, `hosting:marketing`, and `hosting:app`. Summarize what changed and estimated bandwidth savings.

---

## This project (hannington portfolio)

| Item | Value |
|------|--------|
| Marketing site | `techantmedia.com` → target `marketing` → `dist/marketing` |
| App site | `app.techantmedia.com` → target `app` → `dist/app` |
| Budget script | `pnpm setup:gcp-budget` |
| Deploy | `pnpm firebase:deploy` |

**DNS (you must add in your domain registrar):**

- `app.techantmedia.com` → CNAME → `hanningtonkutria-app.web.app` (after `firebase hosting:sites:create hanningtonkutria-app`)

**Firebase Console → Hosting → Add custom domain** for the app site once DNS is set.
