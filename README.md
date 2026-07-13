# Zeca eventos — acervo

Site que lista, organizado por local, os arquivos guardados no Vercel Blob `zeca-eventos`.

## Como colocar no ar (sem usar terminal)

1. Crie um repositório novo no GitHub (github.com → "New repository"). Pode chamar de `zeca-eventos-viewer`.
2. Na página do repositório, clique em **Add file → Upload files** e arraste todos os arquivos e pastas deste projeto (mantendo a estrutura de pastas `app/`, `app/api/view/`).
3. Confirme o commit.
4. No Vercel, clique em **Add New → Project**, escolha o repositório que você acabou de criar e clique em **Import**.
5. Antes de clicar em "Deploy", vá em **Environment Variables** e confirme que a variável `BLOB_READ_WRITE_TOKEN` está presente (se o projeto já estava conectado ao store `zeca-eventos`, ela é herdada automaticamente; senão, cole o valor do token gerado no painel do Blob).
6. Clique em **Deploy**. Em cerca de um minuto o site fica no ar num link tipo `zeca-eventos-viewer.vercel.app`.

Sempre que o robô (n8n) subir um arquivo novo no formato `local/data/arquivo.ext`, ele aparece automaticamente aqui agrupado por local.
