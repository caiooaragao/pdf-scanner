# PDF Scanner - Efeito de Digitalização

Converte cada página do PDF em imagem, aplica efeito de digitalização (tons de cinza, leve desfoque, JPEG) e remonta o PDF no tamanho original da página.

## Interface no navegador (sem servidor)

1. Dê duplo clique em **`index.html`** na raiz (redireciona para `public/index.html`) **ou** abra diretamente **`public/index.html`**.
2. Use **Chrome** ou **Edge** (recomendado). É preciso **internet** na primeira carga (bibliotecas via CDN).
3. Envie PDFs e clique em **Digitalizar e baixar**.
   - Um arquivo → `nome_digitalizado.pdf`
   - Vários → `pdfs_digitalizados.zip`

Se o worker do PDF.js falhar com `file://` no seu navegador, use a opção com servidor abaixo.

## Uso em linha de comando (Node.js)

1. Coloque os PDFs na pasta `pdf_scanner`
2. `npm install` e `npm start`
3. Saída em `digitalizados/`

## Interface web com servidor local (opcional)

1. `npm install` e `npm run web`
2. Abra [http://localhost:3847](http://localhost:3847) — mesma UI, processamento no **servidor** (Node + Sharp), útil para PDFs grandes ou se preferir o resultado idêntico ao CLI.

## Publicar no GitHub Pages (URL pública)

Sim: a interface que roda **só no navegador** pode ficar online. O GitHub não executa Node; quem processa o PDF é o visitante (PDF.js + pdf-lib no browser).

1. Crie um repositório no GitHub e envie este projeto (`git push`).
2. No repositório: **Settings → Pages**.
3. Em **Build and deployment**, em **Source** escolha **Deploy from a branch**.
4. Branch **main** (ou `master`), pasta **`/ (root)`**, Save.
5. Em um ou dois minutos o site fica em:
   - `https://SEU_USUARIO.github.io/NOME_DO_REPO/`
   - A raiz abre o `index.html`, que redireciona para `public/index.html`.

Repositório **público** + Pages gratuito costuma ser o caminho mais simples. O backend `server.js` / `npm run web` **não** roda no Pages; em produção o app usa sempre o processamento no navegador.

## Criar o repositório no GitHub (terminal)

1. Instale e faça login uma vez: `gh auth login` (GitHub CLI).
2. Na pasta do projeto: `.\push-github.ps1`  
   (ou `.\push-github.ps1 -RepoName outro-nome` se `pdf-scanner` já existir).

Sem o `gh`, crie o repositório vazio no site do GitHub e rode:
`git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git` e `git push -u origin main`.

## Requisitos

- **Só o HTML / Pages:** navegador recente + rede para CDN
- **CLI / servidor local:** Node.js 18+
