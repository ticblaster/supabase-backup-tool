# Storage com rclone

O dump SQL do banco **não inclui** os bytes dos arquivos armazenados nos buckets. A cópia dos arquivos é uma etapa separada.

## Modo recomendado: rclone

O modo `rclone` é o mais confiável para backup recursivo de buckets do Supabase Storage.

### Configuração no Supabase

1. Abra o projeto no Supabase Dashboard.
2. Vá em **Storage** → **S3 Access** (ou configuração S3 equivalente).
3. Gere **Access Key** e **Secret**.

### Configuração do remote rclone

Edite o arquivo de configuração do rclone (ex.: `%APPDATA%\rclone\rclone.conf` no Windows):

```ini
[supabase-geral]
type = s3
provider = Other
access_key_id = <SUA_ACCESS_KEY>
secret_access_key = <SUA_SECRET>
endpoint = https://<project-ref>.storage.supabase.co/storage/v1/s3
acl = private
```

Substitua `<project-ref>` pelo ref do projeto (ex.: o valor de `projectRef` no config).

### Testar o remote

```bash
rclone lsd supabase-geral:
rclone ls supabase-geral:trip-receipts
```

### Configurar na ferramenta

```json
"storage": {
  "mode": "rclone",
  "remote": "supabase-geral",
  "buckets": ["trip-receipts"]
}
```

A ferramenta executa, para cada bucket:

```bash
rclone copy supabase-geral:trip-receipts <backupPath>/storage/trip-receipts --progress
```

## Modo alternativo: supabase-cli

```json
"storage": {
  "mode": "supabase-cli",
  "buckets": ["documents", "avatars"]
}
```

A ferramenta tenta:

```bash
supabase storage cp -r ss:///<bucket> <destino>
```

**Limitação:** o suporte a download recursivo pode variar conforme a versão da Supabase CLI. Se falhar, a mensagem de erro recomenda migrar para `rclone`.

## Restore dos arquivos

Após restaurar o banco, copie os arquivos do backup para o destino:

```bash
rclone copy backups/geral-homologacao/20260629-151045/storage/trip-receipts supabase-destino:trip-receipts
```

Valide políticas de Storage e metadados dos buckets no projeto destino.