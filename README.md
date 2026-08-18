# tiktok-product-viewer

Aplicação web (React + Vite + TypeScript) para consultar anúncios da API do
TikTok Shop a partir de uma **URL já assinada** por um sistema interno e
exibir o resultado de forma legível: cabeçalho do produto, galeria, tabela
de variações (SKUs), diagnóstico de integração e JSON bruto.

Esta aplicação **não** calcula `sign` e **não** pede `app_secret`. O fluxo é
sempre: colar a URL assinada + o access token → GET → resultado.

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço indicado (por padrão `http://localhost:5173`).

Outros comandos:

```bash
npm test        # testes das funções puras (normalização/validação da URL)
npm run build   # typecheck estrito + build de produção
```

## Hospedagem na Vercel

O projeto está pronto para deploy: importe o repositório na Vercel (o
[`vercel.json`](vercel.json) já declara framework, build e output) ou rode
`vercel` na raiz. O build gera o frontend estático e [`api/tts.ts`](api/tts.ts)
vira uma **Edge Function** que atende `/api/tts` em produção, fazendo o
papel que o middleware do Vite faz em desenvolvimento. Como a chamada à API
do TikTok sai do servidor da Vercel — e não do navegador — o CORS deixa de
ser problema.

Se o app responder `404 NOT_FOUND` ao consultar, é a Vercel dizendo que a
função não existe naquele deployment: abra o deployment → aba **Functions**
e confirme que `api/tts.ts` aparece lá.

## Por que existe o proxy `/api/tts`

A API `open-api.tiktokglobalshop.com` não envia headers CORS, então o
navegador bloqueia chamadas diretas de uma página web. O frontend sempre
chama `/api/tts` (mesma origem) e um intermediário repassa para
`https://open-api.tiktokglobalshop.com`:

- **Desenvolvimento** (`npm run dev`): um middleware do dev server do Vite,
  registrado em [`vite.config.ts`](vite.config.ts).
- **Produção (Vercel)**: a Edge Function em [`api/tts.ts`](api/tts.ts).

Os dois executam **a mesma lógica compartilhada**
([`src/lib/proxyTarget.ts`](src/lib/proxyTarget.ts)), então dev e produção
se comportam igual, inclusive na validação.

### Por que a rota é estática e o alvo vai em um header

O endpoint é `/api/tts` — uma rota **estática** — e o path + query
assinados viajam no header `x-tts-target`, nunca na URL da requisição.
Essa decisão resolve dois problemas de uma vez:

1. **Roteamento**: rotas dinâmicas catch-all (`api/tts/[...path].ts`) podem
   não ser registradas como função na Vercel, devolvendo o 404 da própria
   plataforma. Uma rota estática não tem esse risco.
2. **Integridade da assinatura**: o roteador de rotas dinâmicas *reescreve*
   a URL, acrescentando os parâmetros de rota à query string — corrompendo
   exatamente a query sobre a qual o `sign` foi calculado. Em um header, o
   valor é uma string opaca que nenhum roteador interpreta.

O proxy só valida o alvo por segurança (ASCII imprimível, começa com `/`,
não tenta apontar para outro host) e o concatena ao host de destino. Ele
também usa `redirect: "manual"`, para nunca reenviar o access token a um
destino inesperado, e responde com `cache-control: no-store`, já que a URL
do proxy é constante e uma resposta em cache poderia ser reaproveitada
para outro produto.

## ⚠️ Nunca modifique a query string assinada

A assinatura (`sign`) do TikTok é calculada sobre o path + os parâmetros da
query exatamente como foram serializados no momento da assinatura.
**Qualquer** modificação — re-encoding de um caractere, reordenação,
adição ou remoção de parâmetro — invalida a chamada e retorna o erro
`106001`.

Por isso, no código:

- A query é tratada como **string opaca**: a URL é separada no **primeiro**
  `?` e o restante é repassado literalmente ([`src/lib/signedUrl.ts`](src/lib/signedUrl.ts)).
- **Nunca** usamos `new URL()` / `URLSearchParams` para reconstruir a query —
  essas APIs re-codificam caracteres e reordenam parâmetros.
- **Nunca** aplicamos `encodeURIComponent` em nada que veio da URL assinada.
- O path + query assinados são enviados **como header opaco**
  ([`src/lib/api.ts`](src/lib/api.ts)) e o proxy apenas os concatena ao
  host de destino ([`src/lib/proxyTarget.ts`](src/lib/proxyTarget.ts)) —
  nenhum roteador chega a interpretá-los.
- O parse de parâmetros exibido no painel serve só para **conferência
  visual e validação** — o que vai para a rede é sempre a string original.

A única normalização feita é remover prefixos conhecidos do **início** da
entrada (`file:///` ou `https://open-api.tiktokglobalshop.com`), mantendo
path + query intactos.

## Funcionalidades

- **Validação antes de enviar**: bloqueia placeholder `{product_id}` não
  substituído e parâmetros obrigatórios ausentes (`shop_cipher`, `app_key`,
  `timestamp`, `sign`); avisa (sem bloquear) quando o `timestamp` tem mais
  de 4 minutos.
- **Painel de parâmetros** sempre visível com nome e valor brutos, para
  conferir que são exatamente 4 e nada a mais.
- **Erros traduzidos**: `106001`/`10008` (assinatura), `36009004` (token),
  `12000000` (`shop_cipher`) e falha de rede viram causa provável + ação,
  sempre com o `request_id` (o que o suporte do TikTok pede).
- **Resultado em cartões**: cabeçalho, breadcrumb de categorias, galeria com
  vídeo, tabela de SKUs (com botão de copiar a coluna `seller_sku`),
  descrição sanitizada com DOMPurify, atributos, dimensões/peso.
- **Diagnóstico de integração**: alertas automáticos de `external_product_id`
  ambíguo, `seller_sku` vazio/duplicado, estoque baixo, preços divergentes,
  EAN ausente e descrição escrita para uma única cor.
- **Histórico da sessão**: últimas 10 consultas bem-sucedidas, em memória
  (some ao recarregar); clicar reexibe sem nova chamada.
- O **access token** persiste em `localStorage`; a **URL assinada não** —
  ela expira em minutos e guardá-la só geraria confusão.

## Estrutura

```
api/
  tts.ts                 # proxy de produção (Vercel Edge Function)
src/
  types/tiktok.ts        # tipagem completa da resposta da API
  lib/signedUrl.ts       # normalização + validação da URL (funções puras)
  lib/proxyTarget.ts     # lógica do proxy compartilhada entre dev e produção
  lib/*.test.ts          # testes das funções puras
  lib/api.ts             # camada de chamada (fetch via proxy /api/tts)
  lib/errorCodes.ts      # tradução dos códigos de erro
  lib/diagnostics.ts     # verificações de inconsistência de cadastro
  lib/format.ts          # formatação (datas BR, preço, idade)
  components/            # interface em cartões
  App.tsx                # estado da aplicação e layout
```
