# Documentation — supabase-backup-tool

> **Languages:** [English](README.md) · [Português (Brasil)](README.pt-BR.md)

Index for the Supabase logical backup CLI.

## Guides

| Document | Content |
|----------|---------|
| [Overview](./en/overview.md) | Problem, solution, scope and flow |
| [Quick start (developer)](./en/quick-start-developer.md) | One-page checklist |
| [Author, license & support](./en/author-license-support.md) | Authorship, MIT, reuse and contact |

Portuguese documentation: [docs/README.pt-BR.md](./README.pt-BR.md)

## Why this exists

Supabase Free tier does not provide native downloadable backups. This tool automates logical Postgres backup and Storage file copy, with manifest and restore notes.

## Quick start

```bash
npm install
cp backup.config.example.json backup.config.json
cp .env.example .env
npm run check -- --project geral-homologacao --test-db-connection
npm run backup -- --project geral-homologacao
```

Full guide: [README.md](../README.md)

## Version

Documentation for **v0.1.0**.