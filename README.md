# Zeca eventos — agenda político

App que recebe fotos e vídeos de eventos via WhatsApp, organiza automaticamente por local e data no Vercel Blob, e disponibiliza num site pra visualização e download.

## Estrutura

- `app/page.tsx` — site que lista os arquivos organizados por local
- `app/api/whatsapp/route.ts` — recebe o webhook da Whapi Cloud e decide tudo (confirma local, organiza mídia, ou pergunta)
- `app/api/state/route.ts` — lê/escreve o "local ativo" (usado internamente e pra testes manuais)
- `app/api/upload/route.ts` — upload manual protegido por senha (útil pra testes)
- `app/api/view/route.ts` — serve os arquivos privados do Blob (visualização e download)
- `lib/blob-state.ts` — lógica compartilhada de memória do local ativo
- `lib/whapi.ts` — envio de mensagens de volta pro WhatsApp via Whapi Cloud

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local
# preencha o .env.local com os valores reais
npm run dev
```

Abra http://localhost:3000

## Deploy

Esse projeto já está conectado ao Vercel. Qualquer `git push` pra branch `main` dispara um deploy automático.

Variáveis de ambiente necessárias no Vercel (Settings → Environment Variables):
- `BLOB_READ_WRITE_TOKEN`
- `UPLOAD_SECRET`
- `ALLOWED_PHONE`
- `WHAPI_TOKEN`

## Webhook da Whapi Cloud

No painel da Whapi Cloud, nas configurações do canal, em Webhooks, configure a URL:
```
https://SEU-DOMINIO.vercel.app/api/whatsapp
```
E habilite o evento "messages" (post). Habilite também "Auto Download" pra imagem e vídeo, senão o link do arquivo não vem no webhook.
