"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("settings");
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
      .catch((erreur) => console.error("Chargement des fonds d'écran impossible", erreur));
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
      setError(body?.error ?? t("theme.echecEnvoi"));
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
      setError(body?.error ?? t("theme.echecSuppression"));
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
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs font-bold uppercase tracking-wider text-ink-muted">{t("theme.fondsTitre")}</span>
        <span className="text-xs text-ink-muted">{t("theme.fondsLegende")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-2.5">
        {BUILTIN_BACKGROUNDS.map((bg) => {
          const ref = `builtin:${bg.slug}`;
          return (
            <Vignette
              key={bg.slug}
              libelle={bg.label}
              image={bg.thumbDataUrl}
              modes={bg.availableModes}
              actif={selectedRef === ref}
              onClick={() => select(ref, bg.backdropUrl, bg.hue, bg.chroma, bg.availableModes)}
            />
          );
        })}
        {personalImages.map((img) => (
          <div key={img.id} className="relative flex">
            <Vignette
              libelle={t("theme.imagePerso")}
              image={img.thumbDataUrl}
              modes={img.availableModes}
              actif={selectedRef === img.id}
              onClick={() => select(img.id, `/api/settings/background/${img.id}/image`, img.hue, img.chroma, img.availableModes)}
            />
            <button
              type="button"
              onClick={() => handleDelete(img.id)}
              title={t("theme.retirer")}
              aria-label={t("theme.retirer")}
              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-panel-raised text-sm leading-none text-danger ring-1 ring-edge-strong transition-colors hover:bg-danger/10 motion-reduce:transition-none"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex min-h-[5.5rem] items-center justify-center rounded-2xl border border-dashed border-edge text-sm text-accent transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none"
        >
          {uploading ? "…" : `+ ${t("theme.ajouter")}`}
        </button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} className="hidden" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Vignette de fond : image, libellé et un point par mode lisible. */
function Vignette({
  libelle,
  image,
  modes,
  actif,
  onClick,
}: {
  libelle: string;
  image: string;
  modes: string[];
  actif: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`flex flex-1 flex-col overflow-hidden rounded-2xl border bg-panel-sunken text-left text-ink transition-colors motion-reduce:transition-none ${
        actif ? "border-accent ring-1 ring-accent" : "border-edge hover:border-edge-strong"
      }`}
    >
      <span className="h-[70px] bg-cover bg-center lg:h-24" style={{ backgroundImage: `url("${image}")` }} />
      <span className="flex items-center gap-1.5 px-2 py-1.5 text-xs">
        <span className="flex-1 truncate">{libelle}</span>
        {modes.map((m) => (
          <i key={m} className={`h-[7px] w-[7px] rounded-full border border-edge-strong mode-swatch-${m}`} />
        ))}
      </span>
    </button>
  );
}
