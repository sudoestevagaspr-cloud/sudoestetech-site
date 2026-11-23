# Sudoeste Tech: site de vagas

Vagas de TI de Francisco Beltrão, Pato Branco e região, em [sudoestetech.com.br](https://sudoestetech.com.br).

- Requisitos da v1: [`docs/requisitos.md`](docs/requisitos.md)
- Resumo do projeto, regras e fases: [`CLAUDE.md`](CLAUDE.md)
- Fase 1, banco de dados e segurança: [`docs/fase-1-banco.md`](docs/fase-1-banco.md)
- Fase 2, site público na Cloudflare: [`docs/fase-2-site.md`](docs/fase-2-site.md)

Stack: Supabase (PostgreSQL, Auth, Storage), Next.js na Cloudflare (Workers, com OpenNext) e Resend.

## Rodar no computador

Precisa de Node.js 22 ou mais novo e do Docker (para o banco local).

```bash
npm install
cp .env.example .env.local   # e preencha (veja os comentários no arquivo)
npm run db:start             # sobe o Supabase local
npm run db:reset             # cria as tabelas e as vagas de exemplo
npm run dev                  # site em http://localhost:3000
```

| Comando | O que faz |
| --- | --- |
| `npm test` | Testes das regras (busca, filtros, datas, salário) |
| `npm run test:e2e` | Testes no navegador, no celular e no computador |
| `npm run db:test` | Testes de segurança do banco |
| `npm run lint` / `npm run typecheck` | Conferem o código |
| `npm run cf:preview` | Monta o site como na Cloudflare e abre em http://localhost:8787 |
