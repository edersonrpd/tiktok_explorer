# tiktok-product-viewer

Aplicação web (React + Vite + TypeScript) para consultar **anúncios,
pedidos, transações por pedido, extratos de repasse e transações a
liquidar** da API do TikTok Shop a partir de uma **URL já assinada** por um
sistema interno, exibindo o resultado de forma legível.

Endpoints suportados:

| Recurso | Endpoint | Onde vai o código |
|---|---|---|
| Anúncio | `/product/202309/products/{id}` | no path |
| Pedidos | `/order/202507/orders?ids=a,b` | na **query** (`ids`) |
| Transações do pedido | `/finance/202501/orders/{order_id}/statement_transactions` | no path |
| Repasses | `/finance/202309/statements?sort_field=...` | **não tem código** — só query |
| Extrato (repasse) | `/finance/202501/statements/{id}/statement_transactions?sort_field=...` | no path, **com parâmetros na query** |
| A liquidar | `/finance/202507/orders/unsettled?sort_field=...` | **não tem código** — só query |

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

- **Montador de endpoint (passo 1)**, com abas para anúncio, pedidos,
  transações e extrato:
  - *Anúncio*: informe o `product_id` e a aplicação monta
    `/product/202309/products/<id>`. Aceita o ID puro e tolera colar um
    path ou URL inteiro (fica com o último segmento antes da query).
  - *Pedidos*: informe um ou vários order ids — separados por vírgula,
    espaço ou quebra de linha, para colar direto de planilha — e a
    aplicação monta `/order/202507/orders?ids=a,b`, removendo repetidos
    e respeitando o limite de 50 IDs por chamada da documentação.
    O `ids` já sai no caminho porque **faz parte da query assinada**:
    acrescentá-lo depois da assinatura invalidaria o `sign`.
  - *Transações*: informe o `order_id` de **um único** pedido e a
    aplicação monta `/finance/202501/orders/<id>/statement_transactions`.
    O ID vai no path, como no anúncio — sem parâmetro extra na query.
  - *Repasses*: **não pede código** — lista os repasses da loja por
    período e monta `/finance/202309/statements`. É por aqui que se
    começa: o resultado traz o `statement_id` de cada repasse, que é o
    que a aba *Extrato* exige. O `sort_field` aqui é `statement_time`, e
    não `order_create_time`, porque cada linha é um repasse e não um
    pedido. Aceita filtrar por `payment_status` (pago, em processamento,
    falhou) e só devolve dados a partir de 01/07/2023.
  - *Extrato*: informe o `statement_id` e a aplicação monta
    `/finance/202501/statements/<id>/statement_transactions` já com
    `sort_field=order_create_time` (obrigatório, e o único valor aceito),
    `page_size` e `sort_order`; há um campo opcional para o `page_token`
    da página seguinte. O ID fica no **meio** do caminho, então colar o
    path inteiro é lido de `/statements/<id>/`, não do último segmento.
    O endpoint exige o escopo `seller.finance.info` no app.

    O `page_size` e a ordenação **convivem com o ID** porque paginam as
    *transações dentro* do repasse — um repasse pode ter milhares de
    pedidos. Não é a paginação dos repasses; essa é a da aba anterior.
  - *A liquidar*: não pede código nenhum — a consulta vale para a loja
    inteira e monta `/finance/202507/orders/unsettled` já com
    `sort_field=order_create_time` (obrigatório, e o único valor aceito),
    `page_size` e `sort_order`, mais uma janela opcional de datas. As duas
    datas são digitadas no calendário e convertidas para `search_time_ge` /
    `search_time_lt` em epoch, pelo **horário local**. A data final entra
    inteira: como o parâmetro é `lt` (estritamente menor), a aplicação
    envia a meia-noite do dia seguinte — sem isso, escolher 31/01
    excluiria o dia 31. Também exige o escopo `seller.finance.info`.

  Em todos os casos há botão de copiar, e a URL gerada (com o host
  `https://open-api.tiktokglobalshop.com`) é o que vai para o sistema
  interno de assinatura.
- **Tipo de recurso detectado pelo path** da URL assinada, não pela aba
  escolhida: colar uma URL de pedido com a aba de anúncio aberta continua
  funcionando, e a validação passa a exigir `ids`. Os dois endpoints de
  `/finance/` terminam em `/statement_transactions` e se distinguem pelo
  segmento do meio: `/orders/<id>` são as transações de um pedido,
  `/statements/<id>` são as do repasse inteiro. Os outros dois de
  finanças não têm ID no path e se distinguem pelo fim do caminho:
  `/statements` é a lista de repasses e `/orders/unsettled` são as
  transações a liquidar — um "/" a mais separa a lista de repasses das
  transações de um deles.
- **Validação antes de enviar**: bloqueia placeholder não substituído
  (`{product_id}`, `{statement_id}` ou outro no mesmo formato) e
  parâmetros obrigatórios ausentes (`shop_cipher`, `app_key`,
  `timestamp`, `sign`); avisa (sem bloquear) quando o `timestamp` tem mais
  de 4 minutos.
- **Separador de query codificado no path** (`%3F` no lugar de `?`, `%26`
  no lugar de `&`): sintoma de um sistema de assinatura que codificou o
  caminho inteiro como um único valor. Os parâmetros do endpoint ficam
  colados no path, o TikTok não reconhece a rota e eles não entram na
  query — logo, também não entraram no cálculo da assinatura. A aplicação
  explica isso e oferece um botão que reconstrói a URL com os separadores
  literais, para diagnosticar se a assinatura em si está correta.
- **Painel de parâmetros** sempre visível com nome e valor brutos, para
  conferir que são exatamente os esperados e nada a mais (4 para anúncio e
  para transações, 5 para pedidos por causa do `ids`; no extrato e nas
  transações a liquidar, 5 obrigatórios mais os opcionais de paginação,
  ordenação e — só nas a liquidar — a janela de datas).
- **Erros traduzidos**: `106001`/`10008` (assinatura), `36009004` (token),
  `12000000` (`shop_cipher`), `21008111` (pedido de outra loja), além dos
  transitórios do Get Order Detail (`10002014/15`, `10037002/3/4`,
  `10006402`, `36009003`) e falha de rede — todos viram causa provável +
  ação, sempre com o `request_id` (o que o suporte do TikTok pede).
- **Resultado em cartões**:
  - *Anúncio*: cabeçalho, breadcrumb de categorias, galeria com vídeo,
    tabela de SKUs (com botão de copiar a coluna `seller_sku`), descrição
    sanitizada com DOMPurify, atributos, dimensões/peso.
  - *Pedidos*: um cartão por pedido com status, datas, entrega, rastreio,
    marcadores (COD, amostra, retido, endereço alterado…), destinatário
    destrinchado (logradouro, número, bairro, cidade/UF pelo
    `district_info`), bloco **fiscal e de pagamento** (CNPJ do
    marketplace, `need_upload_invoice`, código do meio de pagamento e da
    autorização) e **prazos** (RTS, TTS, coleta, cancelamento automático)
    com quanto falta para cada um. IDs solicitados que não voltaram na
    resposta são sinalizados. A tabela de itens **agrupa por SKU e mostra
    a quantidade**: cada entrada de `line_items` é uma unidade (2
    camisetas iguais vêm como duas entradas), então a lista crua repetiria
    linhas sem informar quantidade; as colunas mostram a conta do item
    (preço cheio, desconto de cada lado, total). O botão copia uma linha
    por SKU, que é o formato usado para cruzar com o cadastro do ERP.
  - *Transações*: resumo do pedido (receita, taxas/impostos, frete e
    settlement) e uma tabela com uma linha por SKU. Clicar na linha expande
    o detalhamento de receita, frete (incluindo componentes suplementares) e
    taxas/impostos daquele SKU, escondendo os componentes zerados — só os
    valores que efetivamente impactaram o settlement aparecem.
  - *Repasses*: a tela de **entrada** das finanças, e a resposta para
    "de onde vem o `statement_id`?". Lista os repasses do período com
    totais e situação do pagamento (pago, em processamento, falhou), e
    **cada linha entrega o caminho da consulta de extrato daquele
    repasse**, pronto para assinar — sem isso seria copiar o ID à mão,
    voltar ao passo 1 e trocar de aba. A resposta não traz somatório
    nenhum, então todo total exibido é soma **da página** e a tela diz
    isso.

  - *Extrato*: totais do repasse (valor a pagar, total repassado, reserva)
    com a composição e a **conferência das fórmulas publicadas na
    documentação** — receita − frete − taxas/impostos − ajustes = total
    repassado, e total repassado + reserva = valor a pagar —, apontando
    divergência em vez de escondê-la. Depois vêm os totais por tipo de
    transação (pedido, reserva e cada tipo de ajuste, traduzidos) e a
    tabela de transações, com detalhamento sob demanda: cada transação tem
    ~70 campos e quase todos vêm zerados, então só os **diferentes de
    zero** aparecem, com a contagem dos omitidos. O bloco de tarifas e
    impostos fecha a conta contra `fee_tax_amount` — a mesma conferência
    descrita em *A liquidar*, com o mesmo componente. A exportação
    também é a mesma (*Excel*, *CSV* e *Copiar*, cabeçalhos em
    português), com as colunas que só existem aqui: reserva, status da
    reserva e liberação prevista. O arquivo leva o ID do extrato no
    nome, porque é comum conferir vários lado a lado. O botão "copiar para
    planilha" gera uma linha por transação com os valores brutos, para
    reconciliar no Excel.

    A paginação é o ponto onde este endpoint difere dos demais: o
    `page_token` faz parte da query assinada, então **não** dá para
    avançar página dentro do app. Quando a resposta traz
    `next_page_token`, a tela monta a URL da página seguinte — com o mesmo
    `page_size` e `sort_order` — pronta para assinar.
  - *A liquidar*: a pergunta que o extrato não responde — **quanto ainda
    está para entrar**. Todo valor é estimativa (prefixo `est_` na API),
    porque o repasse não foi fechado, e a tela repete isso onde o número
    aparece: estimado não é realizado e não pode ser lançado como tal.

    Três armadilhas desta resposta, que a tela trata explicitamente em vez
    de esconder:

    1. Os quatro somatórios do cabeçalho valem para o **conjunto filtrado
       inteiro**, não para a página. Compará-los com a soma das transações
       exibidas só faz sentido quando a página É o conjunto inteiro (sem
       `next_page_token` e com `total_count` batendo) — fora disso a
       conferência é omitida, com a explicação, em vez de acusar uma
       divergência que não existe.
    2. **Não há somatório de frete** na resposta. O custo de frete aparece
       somado das transações da página e marcado como tal.
    3. `estimated_settlement` **não é uma data** enquanto o pedido não é
       entregue: a API devolve o texto da política (`x days after
       delivery`) e só depois passa a devolver um epoch. A tela mostra a
       frase original nesse caso, junto com `unsettled_reason` — que é o
       que responde "por que ainda não caiu?" e por isso fica na linha
       fechada, não atrás do expansor.

    A fórmula publicada (`receita − frete − taxas/impostos − ajustes =
    repasse`) é conferida **transação a transação**, com a contagem de
    quantas fecharam e a lista das que não. A paginação funciona como no
    extrato, com uma diferença: a URL da página seguinte repete a janela
    de datas desta consulta, porque o token foi emitido para aquele
    recorte.

    ⚠️ **Não dá para consultar um pedido específico neste endpoint.** A
    documentação não prevê parâmetro de `order_id` nem de `adjustment_id`
    — os únicos recortes são `search_time_ge`/`search_time_lt` sobre
    `order_create_time`. Procurar um pedido é, portanto: trazer a janela
    em que ele foi criado e achá-lo na lista. Para isso a tabela tem uma
    **busca local** que casa por trecho em todos os identificadores da
    transação (o mesmo pedido pode aparecer como `order_id` numa linha e
    como `adjustment_order_id` em outra) e aceita vários IDs colados de
    planilha, para ver de uma vez quais daqueles pedidos ainda estão
    pendentes. O botão de copiar exporta o que está filtrado.

    Se o pedido não aparecer, são dois casos e a tela diz os dois: ou ele
    está fora da janela consultada, ou **já foi liquidado** — uma vez
    liquidada, a transação some desta consulta e passa a estar em
    *Transações do pedido*
    (`/finance/202501/orders/{order_id}/statement_transactions`), que é a
    aba ao lado. Esta API também só devolve transações criadas a partir
    de 01/01/2025.

    **A conta das tarifas não fecha somando as linhas — e a tela mostra
    por quê.** Vale para as duas telas de finanças (aqui e no extrato),
    porque o bloco é o mesmo
    ([`src/components/breakdown.tsx`](src/components/breakdown.tsx),
    sobre `readFeeTax` em [`src/lib/statements.ts`](src/lib/statements.ts)).
    Duas coisas atrapalham ao mesmo tempo:

    1. `affiliate_commission_before_pit_amount` repete o valor de
       `affiliate_commission_amount`: é a mesma comissão do criador vista
       antes da retenção de IR, não uma cobrança a mais. Esses campos
       (com `pit_withheld_from_ads_commission_amount`) saem da soma e vão
       para um bloco *Comissão de afiliado — recortes*, marcado como não
       somável.
    2. Mesmo assim sobra um valor **por pedido** que entra em
       `est_fee_tax_amount` sem aparecer em nenhum dos ~35 campos de
       `fee` nem dos 16 de `tax`. Em dois pedidos BR conferidos, eram
       exatos R$ 6,00 em cada um.

    Por isso o bloco de tarifas fecha a conta na tela: *soma das linhas*
    + *cobrado sem detalhamento* = o total do campo (`est_fee_tax_amount`
    aqui, `fee_tax_amount` no extrato), com o nome do campo à vista para
    procurar no JSON bruto. A conferência só aparece quando há diferença.
    Num pedido real:
    −16,08 (afiliado) −11,35 (plataforma) −11,35 (frete grátis) = −38,78,
    mais −6,00 não detalhado, dá os −44,78 que saem do repasse. A
    diferença também vira a coluna `est_fee_tax_nao_detalhado` na
    exportação.

  - **Exportação da tabela** em três formatos, com **cabeçalhos em
    português** e sempre do que está na tela (se você filtrou 3 pedidos,
    são esses 3 que saem). As duas telas de finanças oferecem os mesmos
    três botões:
    - *Excel* gera um `.xlsx` de verdade. É o formato a preferir: número
      vai como **número** e data como **data**, então não existe a questão
      de ponto ou vírgula decimal — quem decide a exibição é o Excel, pelo
      idioma da máquina — e as datas ordenam e filtram de verdade, em vez
      de ordenarem como texto. Sai com cabeçalho em negrito, primeira
      linha congelada, filtro automático e largura de coluna.
    - *CSV* gera o dialeto que o Excel em português abre com dois cliques:
      separador `;` (a vírgula ali é o decimal), vírgula decimal nos
      valores e BOM UTF-8, sem o qual "Transações" vira "TransaÃ§Ãµes".
      Serve para quem precisa de texto — importar em outro sistema,
      versionar, abrir no Sheets.
    - *Copiar* mantém o TAB com ponto decimal, para colar numa planilha já
      aberta sem passar pelo assistente de importação.

    As três saídas vêm da **mesma** definição de colunas, em que cada
    célula declara o seu tipo — é isso que deixa o `.xlsx` gravar número
    como número sem que os outros dois formatos divirjam dele. A
    maquinaria é genérica
    ([`src/lib/spreadsheet.ts`](src/lib/spreadsheet.ts)); cada tela só
    declara as suas colunas.

    A coluna *Tipo* sai traduzida, com *Tipo (código)* ao lado: o rótulo é
    o que a pessoa lê, o código é o que filtra e agrupa numa tabela
    dinâmica. *Liquidação prevista* acompanha o campo da API — vira data
    quando o pedido já foi entregue e texto da política quando não.

    O `.xlsx` é escrito por [`src/lib/xlsx.ts`](src/lib/xlsx.ts), **sem
    dependência**: um `.xlsx` é um ZIP com alguns XMLs dentro, e escrever
    o que esta tela precisa (uma aba de texto, número e data) cabe em um
    arquivo. As bibliotecas do ecossistema pesam de 800 KB a 1 MB — mais
    que o bundle inteiro desta aplicação — para resolver leitura,
    fórmulas, gráficos e formatos legados que aqui nunca serão usados.

- **Extrato financeiro do pedido** ([`src/lib/orderStatement.ts`](src/lib/orderStatement.ts)),
  no cartão de pedidos, em três leituras que se completam:
  1. *Extrato do vendedor* — crédito × débito e **total líquido a
     receber**, no mesmo formato do extrato oficial, mas mostrando de qual
     campo do JSON veio cada linha e escondendo por padrão as linhas
     zeradas.
  2. *O que o comprador pagou* — a conta passo a passo (itens − descontos,
     frete cheio − subsídios, taxas), com cada seção **conferida contra o
     campo que a API já devolve pronto** (`sub_total`, `shipping_fee`,
     `total_amount`). Divergência aparece em vermelho com os dois valores.
  3. *Quem pagou o frete* — comprador, plataforma e vendedor separados.
     Em pedido com etiqueta do TikTok (`shipping_type: TIKTOK`) a
     plataforma contrata e paga o envio, então o frete cobrado do
     comprador **entra como crédito e volta como débito**, fechando em
     zero — é assim que o extrato oficial fecha o mesmo pedido.

  Há ainda um bloco de *conferências* cruzando `line_items[]` com
  `payment` (soma dos itens × `sub_total`, descontos, `sub_total` + frete ×
  `total_amount`).

  ⚠️ **Comissões e taxas de venda não existem no Get Order Detail** —
  nenhum campo do pedido carrega esse valor. O número oficial está nas
  *transações do pedido*
  (`/finance/202501/orders/{order_id}/statement_transactions`, a consulta
  do item anterior), que trazem receita, taxas e `settlement_amount` já
  apurados. Para uma estimativa sem uma segunda consulta, o campo de
  comissão aceita **percentual** (`36%`, aplicado sobre o total pago) ou
  **valor** (`6,82`), e o resultado sai sempre marcado como informado;
  enquanto nada for preenchido, o líquido é exibido como um teto. O
  percentual fica em `localStorage` — é o mesmo para a loja toda; o valor
  absoluto não persiste, porque é específico daquele pedido.

  Todo o dinheiro é somado em **inteiros de escala 4**
  ([`src/lib/money.ts`](src/lib/money.ts)): com `Number` direto, somar os
  decimais da API acumula erro binário e o total deixa de bater com
  `total_amount` por centavos — justamente a conferência que a tela existe
  para fazer.
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
  lib/endpoint.ts        # monta os endpoints de anúncio, pedidos, transações e extrato
  lib/signedUrl.ts       # normalização + validação da URL (funções puras)
  lib/orders.ts          # agrupamento dos itens do pedido por SKU
  lib/money.ts           # aritmética exata sobre os valores em string da API
  lib/statements.ts      # leitura dos valores do extrato de repasse
  lib/statementList.ts   # leitura da lista de repasses (de onde vem o statement_id)
  lib/unsettled.ts       # leitura das transações a liquidar (tudo estimado)
  lib/spreadsheet.ts     # exportação da tabela nos três formatos (colunas tipadas)
  lib/xlsx.ts            # escrita de .xlsx (ZIP + OOXML), sem dependência
  lib/statementLabels.ts # tradução dos ~70 campos do extrato
  lib/orderStatement.ts  # extrato do pedido: crédito × débito e conferências
  lib/proxyTarget.ts     # lógica do proxy compartilhada entre dev e produção
  lib/*.test.ts          # testes das funções puras
  lib/api.ts             # camada de chamada (fetch via proxy /api/tts)
  lib/errorCodes.ts      # tradução dos códigos de erro
  lib/diagnostics.ts     # verificações de inconsistência de cadastro
  lib/format.ts          # formatação (datas BR, preço, idade)
  components/            # interface em cartões
  components/breakdown.tsx # blocos de detalhamento e conferência de tarifas (telas de finanças)
  App.tsx                # estado da aplicação e layout
```

## Referência da OpenAPI para agentes de código

`.claude/skills/tts-openapi-guide/` guarda um recorte da especificação
OpenAPI oficial do TikTok Shop — os módulos `product`, `order` e `finance`,
que são os que este app consulta (90 dos 405 paths do snapshot completo).
Serve para conferir versão de endpoint, parâmetro obrigatório e schema de
resposta **sem chutar campo**: quais versões de `/order` e `/finance`
existem, que `ids` aceita no máximo 50 por chamada, ou quais campos do
detalhamento o extrato pode trazer.

É uma cópia (MIT) das skills publicadas pela ByteDance em
`@tts-open-toolkit/cli`. Para reinstalar o conjunto completo, com os demais
módulos (logistics, return_refund, fulfillment, …):

```bash
npx @tts-open-toolkit/cli skill add --target .claude/skills
```

O comando só copia arquivos — não altera `settings.json` nem o código do
projeto. Documentação que não estiver no recorte fica no docv2 oficial:
`https://partner.tiktokshop.com/docv2/page/{api}-{versão}`.

