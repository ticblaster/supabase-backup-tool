# Quick start for developers

> **Languages:** [English](quick-start-developer.md) · [Português (Brasil)](../guia-rapido-desenvolvedor.md)

One-page reference: problem, solution, minimal usage.

## Problem in one sentence

Supabase Free does not ship downloadable backups; developers must copy **database + Storage** safely and repeatedly.

## Solution in one sentence

A local CLI that builds a timestamped package with SQL dumps, bucket files, manifest, and restore notes.

## Usage checklist

- [ ] Node.js 18+ installed
- [ ] `pg_dump` and `psql` on PATH
- [ ] `rclone` configured if using buckets
- [ ] `backup.config.json` and `.env` created from examples
- [ ] Connection strings in `.env` (pooler and/or direct)
- [ ] `npm run check -- --project <name> --test-db-connection` passes
- [ ] `npm run backup -- --project <name>` completed
- [ ] Review `backups/<project>/<timestamp>/`

## Day-to-day commands

```bash
npm run check -- --project my-project
npm run backup:db -- --project my-project
npm run backup -- --project my-project
npm run restore:print -- --project my-project --backup 20260629-120000
```

## Keep local / never commit

| Keep locally | Never in Git |
|--------------|--------------|
| `backups/` | `.env` |
| `backup.config.json` (no secrets) | connection strings |
| per-backup `restore-notes.md` | DB or S3 passwords |

## Support

**Marcelo Ribeiro de Oliveira Mello** — ticblaster@gmail.com

See [author-license-support.md](./author-license-support.md).