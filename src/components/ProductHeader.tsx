import { Layers, Copy } from "lucide-react";
import type { Product } from "../types/tiktok";
import { formatEpochBR } from "../lib/format";

export function ProductHeader({
  product,
  onToast,
}: {
  product: Product;
  onToast: (msg: string) => void;
}) {
  const chains = product.category_chains ?? [];
  const leaf = chains.find((c) => c.is_leaf) ?? chains[chains.length - 1];
  const imgUrl = product.main_images?.[0]?.urls?.[0];

  const handleCopyId = () => {
    void navigator.clipboard.writeText(product.id).then(() => onToast("Código do anúncio copiado!"));
  };

  return (
    <section className="card">
      <div className="hero">
        <div className="hero-img">
          {imgUrl !== undefined && imgUrl !== "" ? (
            <img src={imgUrl} alt="Produto" />
          ) : (
            <div className="hero-ph">
              sem
              <br />
              imagem
            </div>
          )}
        </div>
        <div className="hero-body">
          {leaf !== undefined && (
            <span className="hero-eyebrow">
              <Layers className="h-3 w-3" />
              {leaf.local_name}
            </span>
          )}
          <h1 className="hero-title">{product.title ?? "(sem título)"}</h1>
          <span className="id-chip">
            <span className="k">ID</span>
            <span className="v">{product.id}</span>
            <button type="button" className="copy-btn" onClick={handleCopyId} title="Copiar código do anúncio">
              <Copy />
            </button>
          </span>

          <div className="badges">
            {product.status !== undefined && (
              <span className={`badge ${product.status === "ACTIVATE" ? "green" : "gray"}`}>
                {product.status}
              </span>
            )}
            {product.audit?.status !== undefined && (
              <span className={`badge ${product.audit.status === "APPROVED" ? "green" : "blue"}`}>
                Auditoria: {product.audit.status}
              </span>
            )}
            {product.is_not_for_sale === true && <span className="badge gray">Fora de venda</span>}
            {product.is_cod_allowed === true && <span className="badge pink">COD permitido</span>}
          </div>

          <div className="meta-grid">
            <div className="meta">
              <div className="mk">Marca</div>
              <div className="mv">{product.brand?.name ?? "—"}</div>
            </div>
            <div className="meta">
              <div className="mk">external_product_id</div>
              <div className="mv mono">{product.external_product_id ?? "—"}</div>
            </div>
            <div className="meta">
              <div className="mk">Criado em</div>
              <div className="mv">{formatEpochBR(product.create_time)}</div>
            </div>
            <div className="meta">
              <div className="mk">Atualizado em</div>
              <div className="mv">{formatEpochBR(product.update_time)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
