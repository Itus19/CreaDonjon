"use client";

import { useCallback, useRef, useState } from "react";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";

/** Largeur de base a 100% (correspond a l'ancien `w-56` fixe) — la case grandit/retrecit autour de cette reference, 50-200%. */
const BASE_WIDTH_PX = 224;

/**
 * Portrait televersable, remplacable (retour utilisateur) : une seule
 * ligne par entite cote serveur (`entity_portraits`, cle primaire
 * `entity_id`) — un nouveau televersement remplace l'ancien de fait,
 * "remplacer" n'est donc que retelenverser. Existence detectee par
 * l'echec de chargement de l'`<img>` (`onError`), jamais par un appel
 * separe de verification avant coup.
 *
 * Taille/alignement (V2-G11) : reglables au survol une fois un portrait
 * present (pas de sens sur un simple placeholder). La taille sauvegarde au
 * relachement du curseur (`onPointerUp`), jamais a chaque `onChange`, pour
 * ne pas spammer la route de mise en page — l'alignement, lui, est un
 * simple bouton, sauvegarde immediatement comme le reste de la fiche.
 */
export default function PortraitUpload({
  entityId,
  initialLayout,
}: {
  entityId: string;
  initialLayout: EntityPortraitLayout;
}) {
  const [hasPortrait, setHasPortrait] = useState(true);
  const [cacheBust, setCacheBust] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sizePct, setSizePct] = useState(initialLayout.displaySizePct);
  const [align, setAlign] = useState<"left" | "right">(initialLayout.align);
  const inputRef = useRef<HTMLInputElement>(null);

  // Retour utilisateur (icone d'image cassee visible sur une fiche sans
  // portrait, meme cause que PublicPortrait.tsx/FamilyTreeCard.tsx) : un
  // 404 deja en cache navigateur peut se resoudre de facon synchrone des
  // que `src` est pose, avant que React n'ait attache `onError`. Le
  // callback de ref verifie `complete`/`naturalWidth` a l'attachement du
  // nœud pour rattraper ce cas, en plus de `onError` pour le reseau normal.
  const checkAlreadyFailed = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0) setHasPortrait(false);
  }, []);

  async function saveLayout(layout: EntityPortraitLayout) {
    await fetch(`/api/entities/${entityId}/portrait/layout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    });
  }

  function commitSize() {
    void saveLayout({ displaySizePct: sizePct, align });
  }

  function changeAlign(next: "left" | "right") {
    setAlign(next);
    void saveLayout({ displaySizePct: sizePct, align: next });
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch(`/api/entities/${entityId}/portrait`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Erreur inattendue.");
      return;
    }
    setHasPortrait(true);
    setCacheBust((n) => n + 1);
  }

  async function remove() {
    setUploading(true);
    await fetch(`/api/entities/${entityId}/portrait`, { method: "DELETE" });
    setUploading(false);
    setHasPortrait(false);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) upload(file);
  }

  const fileInput = (
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChange} />
  );

  // Sans portrait, aucun emplacement reserve (retour utilisateur) : pas de
  // case/bordure/fond a la place d'une image absente, juste un lien texte
  // pour en ajouter un — la fiche se comporte comme si la notion de
  // portrait n'existait pas tant qu'aucun n'a ete televerse.
  if (!hasPortrait) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-left text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
        >
          + Ajouter un portrait
        </button>
        {fileInput}
        {error && <p className="max-w-56 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Toujours a 100% ici (retour utilisateur) : la case de la fiche ne
          bouge jamais avec le curseur, seul le rendu du wiki en tient
          compte (PublicPortrait.tsx) — largeur fixe, jamais `sizePct`. */}
      <div
        className="group relative flex aspect-[3/4] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-edge bg-panel-sunken text-center text-xs text-ink-muted"
        style={{ width: `${BASE_WIDTH_PX}px` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={checkAlreadyFailed}
          src={`/api/entities/${entityId}/portrait?v=${cacheBust}`}
          alt="Portrait"
          onError={() => setHasPortrait(false)}
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-scrim p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            Remplacer
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={uploading}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50"
          >
            Retirer
          </button>
          <div className="mt-1 flex w-full flex-col items-center gap-1 text-[10px] text-ink-soft">
            <span className="text-[9px] uppercase tracking-wide text-ink-muted">Taille dans le wiki</span>
            <label className="flex w-full items-center gap-1.5">
              <span className="shrink-0">{sizePct}%</span>
              <input
                type="range"
                min={50}
                max={200}
                step={5}
                value={sizePct}
                onChange={(e) => setSizePct(Number(e.target.value))}
                onPointerUp={commitSize}
                onKeyUp={commitSize}
                aria-label="Taille du portrait dans le wiki"
                className="w-full"
              />
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => changeAlign("left")}
                aria-pressed={align === "left"}
                className={`rounded-full border px-2 py-0.5 transition-colors ${
                  align === "left" ? "border-accent text-accent" : "border-edge text-ink-soft hover:text-ink"
                }`}
              >
                Gauche
              </button>
              <button
                type="button"
                onClick={() => changeAlign("right")}
                aria-pressed={align === "right"}
                className={`rounded-full border px-2 py-0.5 transition-colors ${
                  align === "right" ? "border-accent text-accent" : "border-edge text-ink-soft hover:text-ink"
                }`}
              >
                Droite
              </button>
            </div>
          </div>
        </div>
      </div>
      {fileInput}
      {error && <p className="max-w-56 text-xs text-danger">{error}</p>}
    </div>
  );
}
