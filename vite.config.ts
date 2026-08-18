import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Proxy /tts -> open-api.tiktokglobalshop.com
 *
 * Por que existe: a API do TikTok Shop não envia headers CORS, então o
 * navegador bloqueia chamadas diretas. O dev server do Vite atua como
 * intermediário: o frontend chama `/tts/...` na mesma origem e o Vite
 * repassa para a API real.
 *
 * PONTO SENSÍVEL — a query string é parte da assinatura:
 * O `rewrite` abaixo remove APENAS o prefixo literal `/tts` do início do
 * path. Ele recebe a string completa "path?query" e NÃO faz parse, decode
 * ou reordenação da query — qualquer alteração (re-encoding de caracteres,
 * reordenação ou adição de parâmetros) invalida o `sign` calculado pelo
 * sistema que assinou a URL e a API responde com erro 106001.
 *
 * `changeOrigin: true` só ajusta o header Host para o destino (necessário
 * para o TLS/virtual host do TikTok); não toca no path nem na query.
 * O http-proxy usado pelo Vite repassa o path bruto (não normaliza nem
 * re-codifica), então nenhum header extra relevante é injetado além dos
 * de proxy padrão.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/tts": {
        target: "https://open-api.tiktokglobalshop.com",
        changeOrigin: true,
        // Remove somente o prefixo /tts; o restante (path + query) passa intacto.
        rewrite: (path) => path.replace(/^\/tts/, ""),
      },
    },
  },
});
