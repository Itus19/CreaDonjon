"use client";

import type { ImageBlockData } from "@/src/core/schemas/blocks/image";

/** Pas de table `assets`/upload en V0 : l'image est une URL externe collee. */
export default function ImageBlockEditor({
  data,
  onChange,
}: {
  data: ImageBlockData;
  onChange: (data: ImageBlockData) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <input
        value={data.url}
        onChange={(e) => onChange({ ...data, url: e.target.value })}
        placeholder="https://…"
        className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm"
      />
      {data.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.url} alt={data.caption} className="max-h-60 w-auto rounded-md object-cover" />
      )}
      <input
        value={data.caption}
        onChange={(e) => onChange({ ...data, caption: e.target.value })}
        placeholder="Légende (optionnelle)"
        className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm italic placeholder:not-italic placeholder:text-ink-muted"
      />
    </div>
  );
}
