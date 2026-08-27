"use client";

import { useRef, useState } from "react";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";

const WRAP_MODE_OPTIONS: { value: ImageBlockData["wrapMode"]; label: string; title: string }[] = [
  { value: "intercalate", label: "Intercaler", title: "L'image reste un bloc à part entière, pleine largeur" },
  { value: "wrap", label: "Retour à la ligne", title: "Le texte du bloc suivant contourne l'image" },
];

/**
 * Téléversement (V2-G12) : même patron que le portrait
 * (`components/entities/PortraitUpload.tsx`), mais par bloc — une fiche
 * peut avoir plusieurs blocs image, contrairement au portrait unique de
 * l'entité. Le collage d'une URL externe reste possible (`data.url` ne
 * distingue jamais externe/téléversé, même champ dans les deux cas).
 */
export default function ImageBlockEditor({
  blockId,
  data,
  onChange,
}: {
  blockId: string;
  data: ImageBlockData;
  onChange: (data: ImageBlockData) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheBustRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch(`/api/blocks/${blockId}/image`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Erreur inattendue.");
      return;
    }
    cacheBustRef.current += 1;
    // Cache-busting (retelenverser remplace l'image au meme id de bloc,
    // comme le portrait) : sans ce parametre, le navigateur pourrait
    // continuer d'afficher l'ancienne image en cache.
    onChange({ ...data, url: `/api/blocks/${blockId}/image?v=${cacheBustRef.current}` });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) upload(file);
  }

  // "wrap" ne propose que gauche/droite (un flottement centre n'existe pas
  // en CSS) ; "intercalate" propose les trois, l'image restant dans son
  // propre bloc pleine largeur.
  const alignOptions: { value: ImageBlockData["align"]; label: string }[] =
    data.wrapMode === "wrap"
      ? [
          { value: "left", label: "Gauche" },
          { value: "right", label: "Droite" },
        ]
      : [
          { value: "left", label: "Gauche" },
          { value: "center", label: "Centre" },
          { value: "right", label: "Droite" },
        ];

  return (
    <div className="flex flex-col gap-2">
      <input
        value={data.url}
        onChange={(e) => onChange({ ...data, url: e.target.value })}
        placeholder="https://…"
        className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50"
        >
          {data.url ? "Remplacer par un fichier" : "+ Téléverser un fichier"}
        </button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChange} />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      {/* `self-start` (retour utilisateur, rognage) : sans lui, le
          conteneur parent (`flex flex-col`) etire ce flex-item en largeur
          (`align-items: stretch`, la valeur par defaut) malgre `w-auto` —
          une image plus large que haute se retrouvait alors dans une boite
          pleine largeur x 240px, rognee par `object-cover` pour la remplir. */}
      {data.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.url}
          alt={data.caption}
          className="max-h-60 w-auto self-start rounded-md object-cover"
        />
      )}

      <input
        value={data.caption}
        onChange={(e) => onChange({ ...data, caption: e.target.value })}
        placeholder="Légende (optionnelle)"
        className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm italic placeholder:not-italic placeholder:text-ink-muted"
      />

      <div className="flex flex-wrap items-start gap-4 border-t border-edge/60 pt-2 text-xs">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Comportement du texte</span>
          <div className="flex gap-1">
            {WRAP_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.title}
                onClick={() => {
                  // "wrap" ne connait pas "center" : on retombe sur "left" si
                  // c'etait la valeur choisie en "intercalate".
                  const nextAlign = opt.value === "wrap" && data.align === "center" ? "left" : data.align;
                  onChange({ ...data, wrapMode: opt.value, align: nextAlign });
                }}
                aria-pressed={data.wrapMode === opt.value}
                className={`rounded-full border px-2 py-0.5 transition-colors ${
                  data.wrapMode === opt.value ? "border-accent text-accent" : "border-edge text-ink-soft hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Alignement</span>
          <div className="flex gap-1">
            {alignOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...data, align: opt.value })}
                aria-pressed={data.align === opt.value}
                className={`rounded-full border px-2 py-0.5 transition-colors ${
                  data.align === opt.value ? "border-accent text-accent" : "border-edge text-ink-soft hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Taille de l&apos;image</span>
          <label className="flex items-center gap-1.5">
            <span className="shrink-0 text-ink-soft">{data.sizePct}%</span>
            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={data.sizePct}
              onChange={(e) => onChange({ ...data, sizePct: Number(e.target.value) })}
              aria-label="Taille de l'image dans le wiki"
              className="w-full"
            />
          </label>
        </div>
      </div>

      {/* Fond de page (V2-G13) : n'a de sens que si une image existe deja —
          pas de bascule sur un bloc vide. Un seul bloc actif a la fois par
          fiche, applique cote serveur (src/server/services/blocks.ts) :
          cocher celui-ci decoche silencieusement tout autre bloc image de
          la meme entite (reflete au prochain rechargement). */}
      {data.url && (
        <div className="flex flex-col gap-2 border-t border-edge/60 pt-2 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={data.useAsWikiBackground}
              onChange={(e) => onChange({ ...data, useAsWikiBackground: e.target.checked })}
            />
            Définir comme fond du wiki de cette fiche
          </label>
          {data.useAsWikiBackground && (
            <div className="flex flex-wrap items-start gap-4 pl-5">
              <div className="flex min-w-32 flex-1 flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Flou du fond</span>
                <label className="flex items-center gap-1.5">
                  <span className="shrink-0 text-ink-soft">{data.backgroundBlurPx}px</span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={1}
                    value={data.backgroundBlurPx}
                    onChange={(e) => onChange({ ...data, backgroundBlurPx: Number(e.target.value) })}
                    aria-label="Flou du fond du wiki"
                    className="w-full"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Durée du fondu</span>
                <label className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={3000}
                    step={100}
                    value={data.fadeMs}
                    onChange={(e) => onChange({ ...data, fadeMs: Number(e.target.value) })}
                    aria-label="Durée du fondu d'entrée en millisecondes"
                    className="w-20 rounded-md border border-edge bg-transparent px-2 py-1"
                  />
                  <span className="text-ink-soft">ms</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
