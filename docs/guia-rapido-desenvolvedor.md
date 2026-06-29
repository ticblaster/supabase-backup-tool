# Guia rápido para desenvolvedores

Referência de uma página: problema, solução e uso mínimo.

## Problema em uma frase

Supabase Free não entrega backup baixável, e o desenvolvedor precisa copiar **banco + Storage** de forma segura e repetível.

## Solução em uma frase

CLI local que gera um pacote timestampado com SQL, arquivos dos buckets, manifesto e notas de restore.

## Checklist de uso

- [ ] Node.js 18+ instalado
- [ ] `pg_dump` e `psql` no PATH (Windows: PostgreSQL client tools)
- [ ] `rclone` configurado, se houver buckets
- [ ] `backup.config.json` e `.env` criados a partir dos exemplos
- [ ] Connection strings no `.env` (pooler e/ou direct)
- [ ] `npm run check -- --project <nome> --test-db-connection` OK
- [ ] `npm run backup -- --project <nome>` executado
- [ ] Pasta em `backups/<projeto>/<timestamp>/` revisada

## Comandos do dia a dia

```bash
npm run check -- --project meu-projeto
npm run backup:db -- --project meu-projeto
npm run backup -- --project meu-projeto
npm run restore:print -- --project meu-projeto --backup 20260629-120000
```

## O que guardar / o que nunca commitar

| Guardar localmente | Nunca no Git |
|--------------------|--------------|
| `backups/` | `.env` |
| `backup.config.json` (sem segredos) | connection strings |
| `restore-notes.md` de cada backup | senhas de banco ou S3 |

## Quando pedir ajuda

**Marcelo Ribeiro de Oliveira Mello** — ticblaster@gmail.com

Ver também [autor-licenca-e-suporte.md](./autor-licenca-e-suporte.md).