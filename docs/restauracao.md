# Restauração

A ferramenta **não executa restore automático** na v0.1.0. Cada backup inclui `restore-notes.md` e o comando `restore:print` reimprime o roteiro.

## Princípios

1. **Sempre** teste em ambiente separado antes de produção.
2. **Nunca** restaure sobre produção sem plano de rollback.
3. Valide Auth, RLS, Storage e fluxos críticos após o restore.

## Ordem sugerida

1. Criar novo projeto Supabase ou instância Postgres compatível.
2. Definir `TARGET_DB_URL` com a connection string de destino.
3. Restaurar `db/roles.sql`.
4. Restaurar `db/schema.sql`.
5. Restaurar `db/data.sql` com replicação temporariamente desabilitada.
6. Copiar arquivos dos buckets de `storage/` para o destino.
7. Validar políticas RLS, usuários Auth e integrações da aplicação.

## Comando sugerido (banco)

Linux/macOS:

```bash
export TARGET_DB_URL="postgresql://postgres.dest:Senha@host:5432/postgres"

psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file "db/roles.sql" \
  --file "db/schema.sql" \
  --command "SET session_replication_role = replica" \
  --file "db/data.sql" \
  --dbname "$TARGET_DB_URL"
```

Windows (PowerShell) — use caminhos absolutos:

```powershell
$TARGET_DB_URL = "postgresql://postgres.dest:Senha@host:5432/postgres"
$backup = "C:\caminho\backups\geral-homologacao\20260629-151045"

psql --single-transaction --variable ON_ERROR_STOP=1 `
  --file "$backup\db\roles.sql" `
  --file "$backup\db\schema.sql" `
  --command "SET session_replication_role = replica" `
  --file "$backup\db\data.sql" `
  --dbname $TARGET_DB_URL
```

## Imprimir roteiro de um backup existente

```bash
npm run restore:print -- --project geral-homologacao --backup 20260629-151045
```

## Validações pós-restore

| Área | O que verificar |
|------|-----------------|
| Schema | Tabelas, índices, triggers, extensões |
| RLS | Políticas nas tabelas sensíveis |
| Auth | Usuários e providers (pode exigir export/import extra) |
| Storage | Buckets, políticas e arquivos acessíveis |
| Aplicação | Login, uploads, queries críticas |

## Integridade

Use o `manifest.json` do backup para conferir SHA-256 dos arquivos SQL antes do restore:

```json
{
  "path": "db/schema.sql",
  "sizeBytes": 12345,
  "sha256": "..."
}
```