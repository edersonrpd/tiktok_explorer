import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fontes empacotadas com o app, sem depender do Google Fonts: se ele estiver
// bloqueado na rede, o navegador trocaria a JetBrains Mono dos valores por
// outra monoespaçada qualquer.
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
import "./index.css";
import App from "./App";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Elemento #root não encontrado no index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
