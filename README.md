# supabase-backup-tool

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
# Backup completo (banco + storage)
npm run backup -- --project geral-homologacao

# Apenas banco
npm run backup:db -- --project geral-homologacao

# Apenas arquivos dos buckets
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

Para ver o roteiro de restauração de um backup existente:

```bash
npm run restore:print -- --project geral-homologacao --backup 20260629-161824
```

---

## Comandos principais

```bash
npm run check              # valida deps, config e variáveis de ambiente
npm run list-projects      # lista projetos configurados
npm run backup             # backup completo
npm run backup:db          # apenas banco
npm run backup:storage     # apenas buckets
npm run restore:print      # imprime roteiro de restore
npm run test               # testes unitários
```

---

## Engines de backup do banco

| Engine | Ferramentas | Docker | Quando usar |
|--------|-------------|--------|-------------|
| **`pgdump`** (padrão) | `pg_dump`, `pg_dumpall` | Não | Windows, backup simples, sem Docker |
| **`supabase-cli`** | Supabase CLI | Pode exigir | Ambiente com Docker já configurado |

---

## Documentação completa

- [Índice da documentação](./docs/README.md)
- [Visão geral e fluxo](./docs/visao-geral.md)
- [Instalação e configuração](./docs/instalacao-e-configuracao.md)
- [Autor, licença e suporte](./docs/autor-licenca-e-suporte.md)

---

## Autor

**Marcelo Ribeiro de Oliveira Mello** — [ticblaster@gmail.com](mailto:ticblaster@gmail.com)

Autor inicial do projeto. Disponível para suporte sobre uso, configuração e adaptação da ferramenta.

## Licença

**MIT** — ver [LICENSE](./LICENSE). Reuso e modificação permitidos com atribuição ao autor original. Detalhes em [AUTHORS.md](./AUTHORS.md).

## Suporte

**ticblaster@gmail.com**

---

**v0.1.0** — CLI local · engines `pgdump` e `supabase-cli` · fallback de URLs · sem restore automático destrutivo.