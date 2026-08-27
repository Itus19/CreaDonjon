"use client";

import { useRef, useState } from "react";

/**
 * Portrait televersable, remplacable (retour utilisateur) : une seule
 * ligne par entite cote serveur (`entity_portraits`, cle primaire
 * `entity_id`) — un nouveau televersement remplace l'ancien de fait,
 * "remplacer" n'est donc que retelenverser. Existence detectee par
 * l'echec de chargement de l'`<img>` (`onError`), jamais par un appel
 * separe de verification avant coup.
 */
export default function PortraitUpload({ entityId }: { entityId: string }) {
  const [hasPortrait, setHasPortrait] = useState(true);
  const [cacheBust, setCacheBust] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="flex flex-col gap-1.5">
      <div className="group relative flex aspect-[3/4] w-56 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-edge bg-panel-sunken text-center text-xs text-ink-muted">
        {hasPortrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/entities/${entityId}/portrait?v=${cacheBust}`}
            alt="Portrait"
            onError={() => setHasPortrait(false)}
            className="h-full w-full object-cover"
          />
        )}
        {!hasPortrait && <span>Portrait</span>}

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-scrim opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {hasPortrait ? "Remplacer" : "+ Téléverser"}
          </button>
          {hasPortrait && (
            <button
              type="button"
              onClick={remove}
              disabled={uploading}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50"
            >
              Retirer
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChange} />
      {error && <p className="max-w-56 text-xs text-danger">{error}</p>}
    </div>
  );
}
