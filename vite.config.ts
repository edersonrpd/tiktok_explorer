import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { proxyToTikTok, TARGET_HEADER, TOKEN_HEADER } from "./src/lib/proxyTarget";

/**
 * Proxy de desenvolvimento para /api/tts.
 *
 * Por que existe: a API do TikTok Shop não envia headers CORS, então o
 * navegador bloqueia chamadas diretas. O frontend chama /api/tts na mesma
 * origem e o intermediário repassa para a API real.
 *
 * Isto é um middleware, e não o `server.proxy` do Vite, para rodar
 * EXATAMENTE a mesma lógica da função de produção (src/lib/proxyTarget.ts):
 * dev e Vercel se comportam igual, inclusive na validação do alvo.
 *
 * PONTO SENSÍVEL — a query string é parte da assinatura:
 * O path + query assinados chegam no header `x-tts-target` e são apenas
 * concatenados ao host de destino. Nada aqui faz parse, decode ou
 * reordenação da query; qualquer alteração invalidaria o `sign` (106001).
 */
function ttsDevProxy(): PluginOption {
  return {
    name: "tts-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/tts", (req, res) => {
        void (async () => {
          const outcome = await proxyToTikTok({
            method: req.method,
            target: firstHeader(req.headers[TARGET_HEADER]),
            accessToken: firstHeader(req.headers[TOKEN_HEADER]),
          });
          res.statusCode = outcome.status;
          res.setHeader("content-type", outcome.contentType);
          res.setHeader("cache-control", "no-store");
          res.end(outcome.body);
        })();
      });
    },
  };
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ttsDevProxy()],
});
