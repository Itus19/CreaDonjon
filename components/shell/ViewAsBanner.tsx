"use client";

import { useState } from "react";

/**
 * Bandeau permanent pendant "voir comme" (retour utilisateur) — visible sur
 * TOUTES les pages (rendu depuis app/layout.tsx) puisque la session est
 * reellement celle du compte cible a partir de maintenant, pas seulement
 * l'ecran d'accueil. Le filet de securite pour ne pas rester bloque hors de
 * son propre compte (voir viewAs.ts) — sans bouton toujours visible pour
 * revenir, remplacer sa propre session serait beaucoup trop risque.
 */
export default function ViewAsBanner({ viewingAsEmail }: { viewingAsEmail: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function returnToAdmin() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/admin/return-from-view-as", { method: "POST" });
    if (!res.ok) {
      setPending(false);
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec du retour.");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  }

  return (
    <div className="flex items-center justify-center gap-3 border-b border-accent bg-accent/20 px-4 py-2 text-sm text-ink">
      <span>
        Vous visualisez comme <strong>{viewingAsEmail}</strong>
      </span>
      <button
        type="button"
        onClick={returnToAdmin}
        disabled={pending}
        className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Retour..." : "Revenir à mon compte"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
