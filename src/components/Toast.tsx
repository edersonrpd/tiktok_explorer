import { CheckCircle2 } from "lucide-react";

/** Notificação flutuante de feedback rápido (copiar, baixar etc). */
export function Toast({ message, show }: { message: string; show: boolean }) {
  return (
    <div className={`toast ${show ? "show" : ""}`}>
      <CheckCircle2 />
      <span>{message}</span>
    </div>
  );
}
