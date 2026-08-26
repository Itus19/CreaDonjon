"use client";

import { useEffect, useRef, useState } from "react";
import { BUILTIN_BACKGROUNDS } from "@/src/core/theme/builtinBackgrounds";

interface PersonalImage {
  id: string;
  thumbDataUrl: string;
  hue: number;
  chroma: number;
  availableModes: string[];
}

interface ApiImage {
  id: string;
  thumb_data_url: string;
  hue: number;
  chroma: number;
  available_modes: string[];
}

export interface BackgroundSelection {
  ref: string;
  backdropUrl: string;
  hue: number;
  chroma: number;
  availableModes: string[];
}

/**
 * Selecteur de fond d'ecran personnel (V2-G4 reformule) : grille des images
 * fournies avec l'application (`BUILTIN_BACKGROUNDS`, statiques, toujours
 * la, jamais supprimables) plus la bibliotheque personnelle de l'utilisateur
 * courant (chargee via `GET /api/settings/background`). Juste apres les
 * boutons de mode existants dans les Reglages — un reglage EN PLUS du
 * theme, jamais a sa place.
 */
export default function BackgroundPicker({
  currentRef,
  onSelectionChange,
}: {
  currentRef: string;
  onSelectionChange: (selection: BackgroundSelection) => void;
}) {
  const [personalImages, setPersonalImages] = useState<PersonalImage[]>([]);
  const [selectedRef, setSelectedRef] = useState(currentRef);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings/background")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { images: ApiImage[] }) => {
        setPersonalImages(
          body.images.map((img) => ({
            id: img.id,
            thumbDataUrl: img.thumb_data_url,
            hue: img.hue,
            chroma: img.chroma,
            availableModes: img.available_modes,
          }))
        );
      })
      .catch(() => {});
  }, []);

  function select(ref: string, backdropUrl: string, hue: number, chroma: number, availableModes: string[]) {
    setSelectedRef(ref);
    onSelectionChange({ ref, backdropUrl, hue, chroma, availableModes });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/settings/background", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec du téléversement.");
      return;
    }
    const { image } = (await res.json()) as { image: ApiImage };
    const added: PersonalImage = {
      id: image.id,
      thumbDataUrl: image.thumb_data_url,
      hue: image.hue,
      chroma: image.chroma,
      availableModes: image.available_modes,
    };
    setPersonalImages((prev) => [added, ...prev]);
    select(added.id, `/api/settings/background/${added.id}/image`, added.hue, added.chroma, added.availableModes);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/settings/background/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de la suppression.");
      return;
    }
    setPersonalImages((prev) => prev.filter((img) => img.id !== id));
    if (selectedRef === id) {
      const fallback = BUILTIN_BACKGROUNDS.find((b) => b.slug === "artwork-c") ?? BUILTIN_BACKGROUNDS[0];
      select(`builtin:${fallback.slug}`, fallback.backdropUrl, fallback.hue, fallback.chroma, fallback.availableModes);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {BUILTIN_BACKGROUNDS.map((bg) => {
          const ref = `builtin:${bg.slug}`;
          return (
            <button
              key={bg.slug}
              type="button"
              onClick={() => select(ref, bg.backdropUrl, bg.hue, bg.chroma, bg.availableModes)}
              title={bg.label}
              aria-label={bg.label}
              style={{ backgroundImage: `url("${bg.thumbDataUrl}")` }}
              className={`h-12 w-12 shrink-0 rounded-md bg-cover bg-center transition-all ${
                selectedRef === ref ? "ring-2 ring-accent" : "ring-1 ring-edge hover:ring-edge-strong"
              }`}
            />
          );
        })}
        {personalImages.map((img) => (
          <div key={img.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => select(img.id, `/api/settings/background/${img.id}/image`, img.hue, img.chroma, img.availableModes)}
              title="Image personnelle"
              aria-label="Image personnelle"
              style={{ backgroundImage: `url("${img.thumbDataUrl}")` }}
              className={`h-12 w-12 rounded-md bg-cover bg-center transition-all ${
                selectedRef === img.id ? "ring-2 ring-accent" : "ring-1 ring-edge hover:ring-edge-strong"
              }`}
            />
            <button
              type="button"
              onClick={() => handleDelete(img.id)}
              title="Supprimer cette image"
              aria-label="Supprimer cette image"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-panel-raised text-sm text-danger ring-1 ring-edge transition-colors hover:bg-danger/10"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Téléverser une image"
          aria-label="Téléverser une image"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-edge text-lg text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {uploading ? "…" : "+"}
        </button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} className="hidden" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
