# Instalação e configuração

## Pré-requisitos

| Ferramenta | Obrigatório | Instalação |
|------------|-------------|------------|
| Node.js 18+ | Sim | https://nodejs.org/ |
| pg_dump | Sim se `db.engine=pgdump` (padrão) | PostgreSQL client tools |
| pg_dumpall | Recomendado | Gera `roles.sql`; sem ele, arquivo de aviso |
| Supabase CLI | Sim se `db.engine=supabase-cli` | Pode exigir Docker Desktop |
| psql | Recomendado | Restore manual |
| rclone | Se `storage.mode=rclone` | https://rclone.org/install/ |

## Instalação da ferramenta

```bash
cd supabase-backup-tool
npm install
```

## Arquivo `.env`

Copie o exemplo e preencha as connection strings. **Nunca commite `.env`.**

```bash
cp .env.example .env
```

```env
GERAL_HOMOLOGACAO_DB_URL=postgresql://postgres.xxxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
OUTRO_PROJETO_DB_URL=postgresql://postgres.yyyyy:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

### Onde obter a connection string

Supabase Dashboard → **Project Settings** → **Database** → **Connection string (URI)**.

Use a string do pooler ou conexão direta conforme sua rede. A senha fica apenas no `.env`, referenciada pelo nome em `dbUrlEnv`.

## Arquivo `backup.config.json`

```bash
cp backup.config.example.json backup.config.json
```

### Estrutura

```json
{
  "supabaseCli": "npx supabase",
  "defaultProject": "geral-homologacao",
  "backupRoot": "./backups",
  "projects": {
    "geral-homologacao": {
      "projectRef": "xxxxx",
      "dbUrlEnv": "GERAL_HOMOLOGACAO_DB_URL",
      "db": {
        "engine": "pgdump",
        "excludeTables": [
          "storage.buckets_vectors",
          "storage.vector_indexes"
        ]
      },
      "storage": {
        "mode": "rclone",
        "remote": "supabase-geral",
        "buckets": ["trip-receipts"]
      }
    }
  }
}
```

### Campos

| Campo | Descrição |
|-------|-----------|
| `defaultProject` | Projeto usado quando `--project` não é informado |
| `backupRoot` | Pasta raiz dos backups (relativa ou absoluta) |
| `projectRef` | Referência do projeto no Supabase (apenas metadado no manifest) |
| `dbUrlEnv` | Nome da variável de ambiente com a connection string |
| `db.engine` | `pgdump` (padrão, sem Docker) ou `supabase-cli` |
| `db.excludeTables` | Excluídas só em `data.sql` (`--exclude-table` ou `-x`) |
| `supabaseCli` | Comando da CLI (ex.: `npx supabase`) |
| `storage.rcloneFlags` | Flags extras do rclone (ex.: `--s3-list-version`, `2`) |
| `storage.mode` | `rclone` ou `supabase-cli` |
| `storage.remote` | Nome do remote rclone (obrigatório no modo rclone) |
| `storage.buckets` | Lista de buckets a copiar |

## Adicionar um novo projeto

1. Crie a variável no `.env`:

   ```env
   MEU_PROJETO_DB_URL=postgresql://...
   ```

2. Adicione o bloco em `backup.config.json`:

   ```json
   "meu-projeto": {
     "projectRef": "abcdef",
     "dbUrlEnv": "MEU_PROJETO_DB_URL",
     "storage": {
       "mode": "rclone",
       "remote": "supabase-meu-projeto",
       "buckets": ["uploads"]
     }
   }
   ```

3. Valide:

   ```bash
   npm run check -- --project meu-projeto
   ```

## Validação inicial

```bash
npm run check
npm run list-projects
```

O comando `check` confirma: Supabase CLI, rclone (se necessário), config válido e variáveis de ambiente definidas.