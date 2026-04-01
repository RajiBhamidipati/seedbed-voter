# Seedbed Voter

A lightweight voting app for Finova team members to vote on shortlisted AI ideas from Seedbed.

## Purpose

The AI Council shortlists ideas from [Seedbed](https://seedbed.vercel.app). This app lets ~40 people across the Product Org view the 5 finalists and cast a single vote for their favourite. No auth — trust-based voting by name entry.

## Stack

- **Next.js 14** (App Router)
- **Supabase** JS client (same project as Seedbed)
- **Tailwind CSS** (Finova design system)
- **Vercel** for deployment

## Local setup

```bash
git clone https://github.com/RajiBhamidipati/seedbed-voter.git
cd seedbed-voter
npm install
```

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

These are the same credentials used by the main Seedbed app.

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the repo in [Vercel](https://vercel.com/new)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Supabase requirements

This app uses existing tables from the Seedbed project — no schema changes needed.

**Real-time:** For live vote counts, enable Realtime on the `votes` table in Supabase Dashboard > Database > Replication.

## Features

- View 5 shortlisted AI ideas with full details (problem, solution, pillars, gates, score)
- Cast one vote per person (case-insensitive duplicate detection)
- Live vote counts via Supabase Realtime
- Export all votes as CSV
