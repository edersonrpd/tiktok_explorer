/**
 * Tradução dos códigos de erro da API do TikTok Shop para causa provável
 * e ação recomendada, em vez de exibir o JSON cru.
 */

export interface ErrorExplanation {
  title: string;
  action: string;
}

const FAILED_TO_GET_ORDERS: ErrorExplanation = {
  title: "Falha ao buscar os pedidos",
  action:
    "Erro transitório do lado do TikTok. Tente novamente; se repetir várias vezes, acione o suporte da plataforma com o request_id.",
};

const TIKTOK_INTERNAL_ERROR: ErrorExplanation = {
  title: "Erro interno do TikTok",
  action:
    "Erro do lado da plataforma, não da sua requisição. Tente novamente; se persistir, acione o suporte com o request_id.",
};

const KNOWN_CODES: Record<number, ErrorExplanation> = {
  106001: {
    title: "Assinatura inválida",
    action:
      "Timestamp expirado ou parâmetro alterado/adicionado após assinar. Gere uma nova assinatura no sistema interno e cole a URL nova sem editar nada.",
  },
  10008: {
    title: "Assinatura inválida",
    action:
      "Mesma causa do 106001: timestamp expirado ou query modificada após a assinatura. Gere uma nova assinatura.",
  },
  36009004: {
    title: "Token inválido, expirado ou incompleto",
    action:
      "Verifique se copiou o access token inteiro (começa com ROW_). Se estiver completo, gere um token novo.",
  },
  12000000: {
    title: "shop_cipher inválido ou de outra loja",
    action:
      "O shop_cipher da URL não corresponde à loja do token. Confirme que URL e token foram gerados para a mesma loja.",
  },
  // Códigos específicos do Get Order Detail (202507).
  21008111: {
    title: "Pedido não pertence a esta loja",
    action:
      "O pedido ou pacote informado é de outro vendedor. Confirme se o ID está correto e se o shop_cipher é o da loja dona do pedido.",
  },
  10002014: FAILED_TO_GET_ORDERS,
  10002015: FAILED_TO_GET_ORDERS,
  10037002: FAILED_TO_GET_ORDERS,
  10037003: FAILED_TO_GET_ORDERS,
  10037004: FAILED_TO_GET_ORDERS,
  10006402: TIKTOK_INTERNAL_ERROR,
  36009003: TIKTOK_INTERNAL_ERROR,
};

export function explainErrorCode(code: number): ErrorExplanation {
  const known = KNOWN_CODES[code];
  if (known !== undefined) return known;
  return {
    title: `Erro ${code} da API do TikTok Shop`,
    action:
      "Código não mapeado. Verifique a mensagem original abaixo e, se precisar acionar o suporte do TikTok, informe o request_id.",
  };
}

export const NETWORK_ERROR_EXPLANATION: ErrorExplanation = {
  title: "Falha de rede",
  action:
    "Não foi possível alcançar a API. Em desenvolvimento, verifique se o servidor do Vite está rodando (npm run dev); hospedado na Vercel, verifique sua conexão e se o deploy inclui a função api/tts. A chamada sempre passa pelo proxy /api/tts.",
};
