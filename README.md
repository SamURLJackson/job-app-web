# Job Agent Web

A hosted job search pipeline with a Next.js dashboard, Google OAuth, Supabase storage, and GitHub Actions for pipeline execution.

---

## Architecture

```
User Dashboard (Vercel/Next.js)
  └─ Google OAuth login (NextAuth)
  └─ Settings: resume, job titles, salary floor, match accuracy
  └─ "Run Pipeline" button
       └─ Calls GitHub Actions via workflow_dispatch API
            └─ Phase 1: Fetches jobs (WeWorkRemotely RSS + Apify)
            └─ Phase 2: Claude scores each job against user's resume
            └─ Phase 3: Emails direct-apply jobs; queues platform jobs
            └─ POSTs results back to /api/pipeline/callback
  └─ Apply Queue: shows scored jobs with cover letters + apply links
```

---

## Setup Guide

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL** and **anon key** (Settings → API)
3. Also copy your **service_role key** (keep this secret)
4. Go to **SQL Editor** → New Query → paste contents of `supabase-schema.sql` → Run
5. Go to **Storage** → New Bucket → name it `resumes` → Public: **off**

### 2. Set Up Google OAuth

See the instructions provided separately, or:
1. [console.cloud.google.com](https://console.cloud.google.com) → New Project
2. APIs & Services → OAuth consent screen → External
3. Credentials → OAuth 2.0 Client ID → Web application
4. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-APP.vercel.app/api/auth/callback/google`
5. Enable Gmail API + Google Drive API in the library

### 3. Create the GitHub Repo (pipeline)

```bash
# In your job-agent-web folder:
cd pipeline
git init
git add .
git commit -m "Initial pipeline"
gh repo create job-agent-pipeline --private --source=. --push
```

Then add these **GitHub Actions Secrets** (repo → Settings → Secrets → Actions):
- `ANTHROPIC_API_KEY`
- `APIFY_API_TOKEN`
- `APIFY_LINKEDIN_ACTOR_ID`
- `APIFY_INDEED_ACTOR_ID`
- `APIFY_DICE_ACTOR_ID`
- `APIFY_BUILTIN_ACTOR_ID`

### 4. Get a GitHub Personal Access Token

1. GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained
2. Permissions needed: **Actions: Read and Write**
3. Set repository access to your `job-agent-pipeline` repo
4. Copy the token

### 5. Deploy to Vercel

```bash
cd ..   # back to job-agent-web root
npx vercel
```

Or connect via [vercel.com](https://vercel.com) → Import Git Repository.

Add these **Environment Variables** in Vercel (Settings → Environment Variables):

| Variable | Value |
|---|---|
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | Run: `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `GITHUB_TOKEN` | Your GitHub Personal Access Token |
| `GITHUB_OWNER` | Your GitHub username |
| `GITHUB_REPO` | `job-agent-pipeline` |
| `PIPELINE_WEBHOOK_SECRET` | Any random string (keep it secret) |

### 6. Local Development

```bash
cp .env.local.example .env.local
# Fill in all values
npm install
npm run dev
```

---

## Folder Structure

```
job-agent-web/
├── app/                        # Next.js App Router
│   ├── api/
│   │   ├── auth/[...nextauth]/ # Google OAuth
│   │   ├── pipeline/
│   │   │   ├── trigger/        # Fires GitHub Actions
│   │   │   ├── callback/       # Receives pipeline results
│   │   │   └── runs/           # Lists run history
│   │   ├── jobs/               # Job queue CRUD + stats
│   │   └── user/settings/      # User settings
│   ├── dashboard/              # Main dashboard
│   ├── queue/                  # Apply queue
│   ├── settings/               # Settings page
│   └── onboarding/             # First-time setup
├── lib/
│   ├── supabase.js
│   └── auth.js
├── pipeline/                   # Node.js pipeline (runs in GitHub Actions)
│   ├── .github/workflows/
│   │   └── pipeline.yml
│   ├── index.js
│   ├── phase1-sourcing.js
│   ├── phase2-evaluation.js
│   ├── phase3-execution.js
│   ├── deduplication.js
│   ├── logger.js
│   └── package.json
└── supabase-schema.sql
```

---

## Fixing Apify Actor IDs

Your current actor IDs are returning 404. Get the correct ones:
1. Go to [apify.com/store](https://apify.com/store)
2. Search for each scraper (LinkedIn Jobs, Indeed Scraper, Dice Jobs, BuiltIn Jobs)
3. Open each actor → the ID is in the URL: `apify.com/USERNAME/ACTOR-NAME`
   - Copy as `username/actor-name`
4. Update your GitHub Actions secrets with the correct IDs

---

## Resume filename note

Update `RESUME_FILENAME` to `resume.pdf` (lowercase) to match your file.
