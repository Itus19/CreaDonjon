"use client";

import { useState } from "react";

/**
 * "Demande de modif au MJ" (V2-M13, retour utilisateur : "il y ait un
 * bouton... qui ouvre une petite fenêtre de chat pour y écrire leur
 * demande") — envoie directement dans le fil de chat du joueur avec le MJ
 * (`related_entity_id` pose sur le message, jamais un second canal a part) :
 * la fenetre de chat commune du MJ affiche deja "depuis quelle fiche" via
 * ce meme champ (`ChatPanel`, chip "Depuis : ..."). Popover local, pas une
 * navigation vers l'onglet Chat : la demande part sans quitter la fiche.
 */
export default function RequestEditButton({ campaignId, entityId }: { campaignId: string | null; entityId: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!campaignId) return null;

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, relatedEntityId: entityId }),
      });
      if (!res.ok) {
        setError("Impossible d'envoyer la demande.");
        return;
      }
      setDraft("");
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setOpen(false);
      }, 1500);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
      >
        Demande de modif au MJ
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-edge-strong bg-panel-raised p-3 shadow-lg">
          {sent ? (
            <p className="text-sm text-ink">Envoyé au MJ.</p>
          ) : (
            <>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Décrivez ce que vous aimeriez changer…"
                rows={3}
                className="w-full resize-none rounded-md border border-edge bg-panel px-2 py-1.5 text-sm text-ink placeholder:text-ink-muted outline-none focus:ring-1 focus:ring-accent"
              />
              {error && <p className="mt-1 text-xs text-danger">{error}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-muted hover:text-ink">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  Envoyer
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
