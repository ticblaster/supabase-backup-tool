# Segurança e limitações

## Segurança

### Credenciais

- Connection strings ficam **apenas** no `.env`, referenciadas por `dbUrlEnv`.
- O `backup.config.json` **não** armazena senhas.
- Logs mascaram URLs: `postgresql://postgres.xxxxx:****@host:5432/postgres`.
- Backups **não** incluem o arquivo `.env`.

### Git

O `.gitignore` exclui:

```gitignore
.env
backups/
*.log
```

Não commite backups nem credenciais.

### Boas práticas

1. Restrinja permissões do `.env` no sistema de arquivos.
2. Armazene backups em local criptografado ou com acesso restrito.
3. Rotacione senhas do banco se um backup for exposto.
4. Use chaves S3 do Storage com escopo mínimo para rclone.
5. Teste restore apenas em ambiente isolado.

## Limitações conhecidas

### Plano gratuito Supabase

Não há backup baixável nativo. Esta ferramenta é um workaround local — a responsabilidade de executar e guardar os backups é do operador.

### Auth (GoTrue)

O dump lógico padrão pode não cobrir completamente usuários, providers OAuth e metadados de Auth. Planeje validação ou exportação adicional se Auth for crítico.

### Storage

- Metadados de buckets (políticas, configuração) podem precisar de recriação manual no destino.
- O modo `supabase-cli` para download recursivo não é garantido em todas as versões da CLI.
- Tabelas internas de vetores (`storage.buckets_vectors`, etc.) podem falhar no dump — use `excludeTables`.

### Restore

- RLS, triggers e extensões devem ser validados manualmente.
- Restore destrutivo automático não está implementado de propósito.
- Ordem incorreta de restore (dados antes do schema) causa falhas.

### Operacionais

- Sem agendamento embutido na v0.1.0.
- Sem verificação automática de integridade além do SHA-256 no manifest.
- Sem criptografia do pacote de backup — considere zip com senha ou volume criptografado se necessário.

## Matriz de responsabilidade

| Item | Backup SQL | Backup Storage (rclone) | Restore manual |
|------|------------|-------------------------|----------------|
| Tabelas public | Sim | — | Operador |
| Roles | Sim | — | Operador |
| RLS policies | Sim (schema) | — | Validar |
| Auth users | Parcial | — | Validar/export extra |
| Arquivos bucket | — | Sim | Operador (rclone copy) |
| Políticas Storage | — | Não automático | Recriar no destino |