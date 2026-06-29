# supabase-backup-tool

> **Idiomas:** [English](README.md) · [Português (Brasil)](README.pt-BR.md)

CLI local para **backup lógico** de bancos **Supabase** (Postgres) e cópia dos arquivos dos **buckets de Storage** — pensada para desenvolvedores que precisam proteger homologação, clonar ambientes ou guardar evidências antes de mudanças arriscadas.

Suporta **vários projetos Supabase** na mesma instalação via `backup.config.json`.

---

## O problema

Se você desenvolve com Supabase, provavelmente já passou por alguma destas situações:

- O **plano gratuito** não oferece backup baixável pelo painel.
- Você precisa de uma cópia do banco de **homologação** antes de um deploy ou migração.
- Quer **clonar** um ambiente para testar restore sem tocar em produção.
- Tem arquivos no **Storage** (uploads, comprovantes, documentos) que **não** entram no dump SQL do Postgres.
- No **Windows**, `supabase db dump` pode exigir **Docker Desktop** e falhar em redes onde a conexão direta resolve só IPv6.

Ou seja: o desenvolvedor fica responsável por montar um processo manual, repetível e seguro de backup.

## A solução

O **supabase-backup-tool** automatiza esse processo em uma CLI simples:

| Etapa | O que faz |
|-------|-----------|
| Banco | Gera `roles.sql`, `schema.sql` e `data.sql` (engine `pgdump` ou `supabase-cli`) |
| Storage | Copia buckets configurados via `rclone` (recomendado) ou Supabase CLI |
| Metadados | `manifest.json` com SHA-256, URL de banco usada, avisos |
| Restore | `restore-notes.md` com roteiro seguro (sem restore automático destrutivo) |
| Segurança | Senhas mascaradas nos logs; `.env` e `backups/` fora do Git |

Funciona **localmente**, sem interface web, e aceita **fallback entre URLs** (Session Pooler → Direct connection) quando uma rota de rede falha.

---

## Uso básico (passo a passo)

### 1. Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [PostgreSQL client tools](https://www.postgresql.org/download/) (`pg_dump`, `psql`) — recomendado no Windows
- [rclone](https://rclone.org/) — se for copiar buckets de Storage

### 2. Instalar

```bash
git clone https://github.com/ticblaster/supabase-backup-tool.git
cd supabase-backup-tool
npm install
```

### 3. Configurar

```bash
cp backup.config.example.json backup.config.json
cp .env.example .env
```

Edite o `.env` com as connection strings (nunca commite este arquivo):

```env
GERAL_HOMOLOGACAO_DB_URL_POOLER=postgresql://postgres.<ref>:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
GERAL_HOMOLOGACAO_DB_URL_DIRECT=postgresql://postgres:SENHA@db.<ref>.supabase.co:5432/postgres
```

No `backup.config.json`, defina o projeto e os buckets:

```json
{
  "defaultProject": "geral-homologacao",
  "backupRoot": "./backups",
  "projects": {
    "geral-homologacao": {
      "projectRef": "seu-project-ref",
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

### 4. Validar ambiente

```bash
npm run check -- --project geral-homologacao
npm run check -- --project geral-homologacao --test-db-connection
```

### 5. Executar backup

```bash
npm run backup -- --project geral-homologacao
npm run backup:db -- --project geral-homologacao
npm run backup:storage -- --project geral-homologacao
```

### 6. Resultado

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

## Comandos principais

```bash
npm run check
npm run list-projects
npm run backup
npm run backup:db
npm run backup:storage
npm run restore:print
npm run test
```

---

## Documentação completa

**Português**

- [Índice da documentação](./docs/README.pt-BR.md)
- [Visão geral](./docs/visao-geral.md)
- [Guia rápido](./docs/guia-rapido-desenvolvedor.md)
- [Autor, licença e suporte](./docs/autor-licenca-e-suporte.md)

**English**

- [Documentation index](./docs/README.md)
- [Overview](./docs/en/overview.md)
- [Quick start](./docs/en/quick-start-developer.md)

---

## Autor

**Marcelo Ribeiro de Oliveira Mello** — [ticblaster@gmail.com](mailto:ticblaster@gmail.com)

## Licença

**MIT** — [LICENSE](./LICENSE) · [AUTHORS.md](./AUTHORS.md)

## Suporte

**ticblaster@gmail.com**

---

**v0.1.0**