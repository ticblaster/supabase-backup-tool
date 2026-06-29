# supabase-backup-tool

> **Languages:** [English](README.md) · [Português (Brasil)](README.pt-BR.md)

Local CLI for **logical backup** of **Supabase** databases (Postgres) and **Storage bucket** files — built for developers who need to protect staging environments, clone setups, or snapshot state before risky changes.

Supports **multiple Supabase projects** in one installation via `backup.config.json`.

---

## The problem

If you build on Supabase, you have probably run into this:

- The **free plan** does not offer downloadable backups in the dashboard.
- You need a **staging** database copy before deploy or migration.
- You want to **clone** an environment and test restore without touching production.
- **Storage** files (uploads, receipts, documents) are **not** included in Postgres SQL dumps.
- On **Windows**, `supabase db dump` may require **Docker Desktop** and fail when direct connections resolve to IPv6 only.

Developers end up responsible for a manual, repeatable, safe backup process.

## The solution

**supabase-backup-tool** automates that workflow in a simple CLI:

| Step | What it does |
|------|----------------|
| Database | `roles.sql`, `schema.sql`, `data.sql` (engine `pgdump` or `supabase-cli`) |
| Storage | Copies configured buckets via `rclone` (recommended) or Supabase CLI |
| Metadata | `manifest.json` with SHA-256, selected DB URL, warnings |
| Restore | `restore-notes.md` with a safe playbook (no destructive auto-restore) |
| Security | Masked passwords in logs; `.env` and `backups/` excluded from Git |

Runs **locally**, no web UI, with **URL fallback** (Session Pooler → Direct) when one network path fails.

---

## Basic usage

### 1. Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [PostgreSQL client tools](https://www.postgresql.org/download/) (`pg_dump`, `psql`) — recommended on Windows
- [rclone](https://rclone.org/) — if backing up Storage buckets

### 2. Install

```bash
git clone https://github.com/ticblaster/supabase-backup-tool.git
cd supabase-backup-tool
npm install
```

### 3. Configure

```bash
cp backup.config.example.json backup.config.json
cp .env.example .env
```

Edit `.env` with connection strings (never commit this file):

```env
GERAL_HOMOLOGACAO_DB_URL_POOLER=postgresql://postgres.<ref>:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
GERAL_HOMOLOGACAO_DB_URL_DIRECT=postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres
```

In `backup.config.json`, define the project and buckets:

```json
{
  "defaultProject": "geral-homologacao",
  "backupRoot": "./backups",
  "projects": {
    "geral-homologacao": {
      "projectRef": "your-project-ref",
      "dbUrlEnvCandidates": [
        "GERAL_HOMOLOGACAO_DB_URL_POOLER",
        "GERAL_HOMOLOGACAO_DB_URL_DIRECT"
      ],
      "db": { "engine": "pgdump" },
      "storage": {
        "mode": "rclone",
        "remote": "supabase-geral",
        "buckets": ["trip-receipts"]
      }
    }
  }
}
```

### 4. Validate

```bash
npm run check -- --project geral-homologacao
npm run check -- --project geral-homologacao --test-db-connection
```

### 5. Run backup

```bash
npm run backup -- --project geral-homologacao
npm run backup:db -- --project geral-homologacao
npm run backup:storage -- --project geral-homologacao
```

### 6. Output

```txt
backups/geral-homologacao/20260629-161824/
  db/roles.sql, schema.sql, data.sql
  storage/trip-receipts/...
  manifest.json
  restore-notes.md
  logs/backup.log
```

```bash
npm run restore:print -- --project geral-homologacao --backup 20260629-161824
```

---

## Main commands

```bash
npm run check              # validate deps, config and env vars
npm run list-projects      # list configured projects
npm run backup             # full backup (db + storage)
npm run backup:db          # database only
npm run backup:storage     # storage only
npm run restore:print      # print restore playbook
npm run test               # unit tests
```

---

## Database backup engines

| Engine | Tools | Docker | When to use |
|--------|-------|--------|-------------|
| **`pgdump`** (default) | `pg_dump`, `pg_dumpall` | No | Windows, simple backup, no Docker |
| **`supabase-cli`** | Supabase CLI | May require | Docker already available |

---

## Full documentation

**English**

- [Documentation index](./docs/README.md)
- [Overview](./docs/en/overview.md)
- [Quick start for developers](./docs/en/quick-start-developer.md)
- [Author, license & support](./docs/en/author-license-support.md)

**Português (Brasil)**

- [Índice da documentação](./docs/README.pt-BR.md)
- [Visão geral](./docs/visao-geral.md)
- [Guia rápido](./docs/guia-rapido-desenvolvedor.md)

---

## Author

**Marcelo Ribeiro de Oliveira Mello** — [ticblaster@gmail.com](mailto:ticblaster@gmail.com)

Original author. Available for support on setup, configuration, and adoption.

## License

**MIT** — see [LICENSE](./LICENSE). Reuse and modification allowed with attribution. Details in [AUTHORS.md](./AUTHORS.md).

## Support

**ticblaster@gmail.com**

---

**v0.1.0** — Local CLI · `pgdump` and `supabase-cli` engines · URL fallback · no destructive auto-restore.