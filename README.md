# Acervo Meishu-Sama

Biblioteca Digital dos Ensinamentos de Mokiti Okada (1882–1955).

## Stack
- Next.js 14 (App Router)
- Supabase (Auth + PostgreSQL + pgvector)
- Tailwind CSS
- Vercel (deploy)
- Parece que ficou bom

## Setup local

```bash
npm install
cp .env.local.example .env.local
# Preencher as variáveis no .env.local
npm run dev
```

## Variáveis de ambiente

| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (anon key) |
| `GEMINI_API_KEY` | aistudio.google.com/app/apikey |

## Deploy no Vercel

1. Conectar o repositório GitHub no Vercel
2. Adicionar as variáveis de ambiente no painel do Vercel
3. Deploy automático em cada `git push`

## Supabase

Projeto: `meishu-sama-acervo` (sa-east-1)  
URL: https://hnlyshkknoznxcpxrooa.supabase.co
