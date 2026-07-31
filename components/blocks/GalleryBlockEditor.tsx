"use client";

import type { GalleryBlockData } from "@/src/core/schemas/blocks/gallery";

/** Pas de table `assets`/upload en V0 : chaque image est une URL externe collee. */
export default function GalleryBlockEditor({
  data,
  onChange,
}: {
  data: GalleryBlockData;
  onChange: (data: GalleryBlockData) => void;
}) {
  function updateImage(index: number, patch: Partial<GalleryBlockData["images"][number]>) {
    onChange({
      __v: 1,
      images: data.images.map((img, i) => (i === index ? { ...img, ...patch } : img)),
    });
  }

  function removeImage(index: number) {
    onChange({ __v: 1, images: data.images.filter((_, i) => i !== index) });
  }

  function addImage() {
    onChange({ __v: 1, images: [...data.images, { url: "", caption: "", isPortrait: false }] });
  }

  return (
    <div className="flex flex-col gap-3">
      {data.images.map((image, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-lg border border-edge p-3">
          <div className="flex items-center gap-2">
            <input
              value={image.url}
              onChange={(e) => updateImage(index, { url: e.target.value })}
              placeholder="https://…"
              className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="text-xs text-danger hover:underline"
            >
              Supprimer
            </button>
          </div>
          <input
            value={image.caption}
            onChange={(e) => updateImage(index, { caption: e.target.value })}
            placeholder="Légende"
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={image.isPortrait}
              onChange={(e) => updateImage(index, { isPortrait: e.target.checked })}
            />
            Portrait
          </label>
          {image.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.url} alt={image.caption} className="max-h-40 w-auto rounded-md object-cover" />
          )}
        </div>
      ))}
      {data.images.length === 0 && (
        <p className="text-sm text-ink-muted">Aucune image pour l&apos;instant.</p>
      )}
      <button
        type="button"
        onClick={addImage}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        + Ajouter une image
      </button>
    </div>
  );
}
