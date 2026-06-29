# Comandos

## Resumo

| Comando npm | Ação |
|-------------|------|
| `npm run check` | Valida deps, config e env |
| `npm run list-projects` | Lista projetos do config |
| `npm run backup` | Backup completo (banco + storage) |
| `npm run backup:db` | Apenas banco |
| `npm run backup:storage` | Apenas buckets |
| `npm run restore:print` | Imprime roteiro de restore |
| `npm run typecheck` | Verificação TypeScript |
| `npm run build` | Compila para `dist/` |

## Exemplos

### Verificar ambiente

```bash
npm run check
npm run check -- --project geral-homologacao
```

Saída esperada (sucesso):

```txt
[check] Configuração encontrada: .../backup.config.json
[check] supabase encontrado
[check] rclone encontrado
[check] geral-homologacao: GERAL_HOMOLOGACAO_DB_URL configurada (postgresql://postgres.xxxxx:****@...)
```

### Backup completo

```bash
npm run backup -- --project geral-homologacao
```

Saída esperada:

```txt
[db] Gerando roles.sql...
[db] Gerando schema.sql...
[db] Gerando data.sql...
[storage] Copiando bucket trip-receipts...
[manifest] Gerando manifest.json...
[done] Backup completo em backups/geral-homologacao/20260629-151045
```

### Backup parcial

```bash
npm run backup:db -- --project geral-homologacao
npm run backup:storage -- --project geral-homologacao
```

### Listar projetos

```bash
npm run list-projects
```

### Roteiro de restore

```bash
npm run restore:print -- --project geral-homologacao --backup 20260629-151045
```

## Estrutura do backup gerado

```txt
backups/
  geral-homologacao/
    20260629-151045/
      db/
        roles.sql
        schema.sql
        data.sql
      storage/
        trip-receipts/
          ...arquivos...
      manifest.json
      restore-notes.md
      logs/
        backup.log
```

O timestamp usa o formato `yyyyMMdd-HHmmss`.

## Manifesto (`manifest.json`)

Contém:

- Versão da ferramenta e data de criação
- Nome e `projectRef` do projeto
- Tipo de backup (`full`, `db-only`, `storage-only`)
- Caminhos dos artefatos
- Lista de arquivos com `sizeBytes` e `sha256`
- Status dos buckets
- Avisos sobre Auth, Storage e restore

## Tratamento de erros

Se qualquer etapa falhar, o processo interrompe e registra em `logs/backup.log`:

```txt
[error] Falha ao gerar data.sql
Motivo: ...
Log completo: backups/geral-homologacao/20260629-151045/logs/backup.log
```

Credenciais nunca aparecem em texto claro nos logs — URLs são mascaradas com `****`.