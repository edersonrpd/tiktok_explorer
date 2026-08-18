/**
 * Tradução dos códigos de erro da API do TikTok Shop para causa provável
 * e ação recomendada, em vez de exibir o JSON cru.
 */

export interface ErrorExplanation {
  title: string;
  action: string;
}

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
