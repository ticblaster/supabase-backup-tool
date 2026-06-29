# Overview

> **Languages:** [English](../README.en.md) · [Português (Brasil)](../visao-geral.md)

## Who this is for

Developers and teams using **Supabase** who need **local**, **repeatable**, **self-controlled** backups — especially for staging, test environments, or free-tier projects.

This does not replace Supabase paid managed backups; it complements day-to-day development workflows.

## The problem

### Typical scenario

You run a Supabase project with real or semi-real data in staging. Before a risky migration, cleanup script, environment clone, or simply sleeping better at night, you need a recoverable copy of the **database** and **Storage files**.

### Pain points

| Limitation | Impact |
|------------|--------|
| No downloadable backup on Free tier | No “restore from yesterday” button |
| SQL dump ≠ Storage bytes | Images and uploads stay outside Postgres |
| Direct connection IPv6-only in some networks | `pg_dump` fails on Windows/local networks |
| `supabase db dump` + Docker | Docker Desktop required on many Windows setups |
| Manual restore order | roles → schema → data is easy to get wrong |

## The solution

**supabase-backup-tool** packages the workflow in a Node.js/TypeScript CLI:

1. Reads projects from `backup.config.json` and secrets from `.env`.
2. Tests candidate DB URLs (pooler/direct) and picks the first working one.
3. Dumps Postgres (`roles`, `schema`, `data`).
4. Copies configured Storage buckets.
5. Writes `manifest.json`, `restore-notes.md`, and audit logs.

Each run produces a timestamped folder ready to archive or restore in a separate environment.

## Basic usage

```bash
npm install
cp backup.config.example.json backup.config.json
cp .env.example .env
npm run check -- --project geral-homologacao --test-db-connection
npm run backup -- --project geral-homologacao
```

## What it does / does not do

**Does:**

- Logical DB backup via **`pgdump`** (default) or **`supabase-cli`**
- URL fallback (`dbUrlEnvCandidates`)
- Storage backup via `rclone` or Supabase CLI
- Multi-project support, dependency checks, masked credentials
- `pg_dump` warnings (e.g. circular foreign keys)

**Does not:**

- Scheduled backups (manual runs in v0.1.0)
- Destructive auto-restore
- Full guaranteed Auth user export
- Storage bytes inside SQL dumps