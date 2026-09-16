import { useState } from "react";
import { Images } from "lucide-react";
import type { ImageInfo, VideoInfo } from "../types/tiktok";
import { Card } from "./ui";

export function Gallery({ images, video }: { images: ImageInfo[]; video: VideoInfo | undefined }) {
  const urls = images
    .map((img) => img.urls?.[0])
    .filter((u): u is string => u !== undefined && u !== "");
  const [selected, setSelected] = useState(0);

  if (urls.length === 0 && video?.url === undefined) {
    return (
      <Card title="Galeria" icon={<Images />}>
        <p className="text-xs t-4">Produto sem imagens ou vídeo.</p>
      </Card>
    );
  }

  const selectedUrl = urls[selected] ?? urls[0];

  return (
    <Card
      title={`Galeria${video?.url !== undefined ? " + vídeo" : ""}`}
      icon={<Images />}
      count={urls.length}
    >
      <div className="space-y-3">
        {selectedUrl !== undefined && (
          <img
            src={selectedUrl}
            alt="Imagem principal do produto"
            className="max-h-72 w-full rounded border border-[var(--border)] object-contain"
          />
        )}
        {urls.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {urls.map((u, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                className={`h-14 w-14 overflow-hidden rounded border-2 transition-colors ${
                  i === selected ? "border-[var(--accent)]" : "border-transparent hover:border-[var(--border2)]"
                }`}
              >
                <img src={u} alt={`Miniatura ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {video?.url !== undefined && video.url !== "" && (
          <video
            src={video.url}
            poster={video.cover_url}
            controls
            className="max-h-72 w-full rounded border border-[var(--border)]"
          />
        )}
      </div>
    </Card>
  );
}
