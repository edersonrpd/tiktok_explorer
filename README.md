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

> O build de produção serve apenas para conferência: em produção não há o
> proxy do dev server, então a chamada à API depende de outro intermediário.

## Por que existe o proxy `/tts`

A API `open-api.tiktokglobalshop.com` não envia headers CORS, então o
navegador bloqueia chamadas diretas de uma página web. O dev server do Vite
resolve isso: o frontend chama `/tts/...` (mesma origem) e o Vite repassa a
requisição para `https://open-api.tiktokglobalshop.com`, removendo apenas o
prefixo `/tts` — sem tocar na query string, sem injetar headers relevantes e
sem alterar o path. A configuração está em [`vite.config.ts`](vite.config.ts).

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
- A URL final da requisição é uma concatenação pura:
  `"/tts" + pathWithQuery` ([`src/lib/api.ts`](src/lib/api.ts)).
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
src/
  types/tiktok.ts        # tipagem completa da resposta da API
  lib/signedUrl.ts       # normalização + validação da URL (funções puras)
  lib/signedUrl.test.ts  # testes das funções puras
  lib/api.ts             # camada de chamada (fetch via proxy /tts)
  lib/errorCodes.ts      # tradução dos códigos de erro
  lib/diagnostics.ts     # verificações de inconsistência de cadastro
  lib/format.ts          # formatação (datas BR, preço, idade)
  components/            # interface em cartões
  App.tsx                # estado da aplicação e layout
```
