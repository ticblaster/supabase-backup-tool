# Documentação — supabase-backup-tool

> **Idiomas:** [Português (Brasil)](README.md) · [English](README.en.md)

Índice da documentação da ferramenta de backup lógico para projetos Supabase.

## Guias

| Documento | Conteúdo |
|-----------|----------|
| [Guia rápido (desenvolvedor)](./guia-rapido-desenvolvedor.md) | Problema, solução e checklist em uma página |
| [Visão geral](./visao-geral.md) | Problema, solução, escopo e fluxo |
| [Instalação e configuração](./instalacao-e-configuracao.md) | Pré-requisitos, `.env`, `backup.config.json` |
| [Comandos](./comandos.md) | CLI, exemplos e estrutura do backup gerado |
| [Storage com rclone](./storage-rclone.md) | Backup de buckets via S3 |
| [Restauração](./restauracao.md) | Roteiro seguro de restore |
| [Arquitetura](./arquitetura.md) | Módulos, responsabilidades e fluxo interno |
| [Segurança e limitações](./seguranca-e-limitacoes.md) | Boas práticas e restrições conhecidas |
| [Autor, licença e suporte](./autor-licenca-e-suporte.md) | Autoria, MIT, reuso e contato |

## Por que existe

Desenvolvedores em Supabase (especialmente plano Free) não têm backup baixável nativo. Esta ferramenta automatiza backup lógico do Postgres e cópia dos buckets, com manifesto e roteiro de restore.

## Início rápido

```bash
npm install
cp backup.config.example.json backup.config.json
cp .env.example .env
# Edite backup.config.json e .env com seus projetos
npm run check -- --project geral-homologacao --test-db-connection
npm run backup -- --project geral-homologacao
```

Guia completo no [README da raiz](../README.md).

## Versão

Documentação referente à ferramenta **v0.1.0**.