"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * V3-F2, puis V3.2-27 — « Annuler ce tour » : un geste en deux temps
 * (demander, puis confirmer), une requête. Le serveur défait le tour entier
 * (fiches nées d'office, notes du monde ajoutées d'office, découvertes, état
 * du personnage et scène d'avant), écrit l'annulation au journal sans rien
 * effacer, puis l'écran se relit. Il vit au bout de la ligne du dernier tour
 * (`Fil.tsx`) : on voit ce qu'on annule.
 */
/** V3-F2 — annuler le dernier tour : demander, puis confirmer ; une seule requête. */
export default function AnnulerTour({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const t = useTranslations("solo.annulerTour");
  const [confirmer, setConfirmer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function annuler() {
    setBusy(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/solo/annuler-tour`, { method: "POST" });
      const corps: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = corps && typeof corps === "object" && typeof (corps as { error?: unknown }).error === "string" ? (corps as { error: string }).error : t("erreur");
        setErreur(message);
        return;
      }
      setConfirmer(false);
      onDone();
    } catch (e) {
      console.error("Annulation du tour en échec", e);
      setErreur(t("erreur"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirmer ? (
        <>
          <span className="text-xs text-ink-soft">{t("question")}</span>
          <button type="button" onClick={() => void annuler()} disabled={busy} className="min-h-11 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50 sm:min-h-0">
            {t("confirmer")}
          </button>
          <button type="button" onClick={() => setConfirmer(false)} disabled={busy} className="min-h-11 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 sm:min-h-0">
            {t("garder")}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmer(true)} className="min-h-11 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised sm:min-h-0">
          {t("bouton")}
        </button>
      )}
      {erreur && (
        <span role="alert" className="text-xs text-danger">
          {erreur}
        </span>
      )}
    </div>
  );
}
