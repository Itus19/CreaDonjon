"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Tabs from "@/components/shared/Tabs";
import ChatPanel from "@/components/shell/ChatPanel";
import { useSoloContexte } from "@/components/solo/SoloContexte";

/**
 * Le jeu à distance, côté joueur : la colonne droite porte deux onglets,
 * « Fiche » et « MJ, en privé » (variante 2). Le privé EST le fil privé du
 * chat de campagne (ADR 0038) : questions de règles, apartés, et deux
 * demandes d'un geste, « Demander une pause » et « Sujet à éviter ».
 * Repliée en bande (ordinateur), la colonne ne montre que la fiche.
 */
export default function ColonneFicheJoueur({ campaignId, fiche }: { campaignId: string; fiche: ReactNode }) {
  const t = useTranslations("distance");
  const { replie } = useSoloContexte();
  const [onglet, setOnglet] = useState<"fiche" | "prive">("fiche");

  if (replie) return <>{fiche}</>;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Tabs
        aria-label={t("colonneDroite")}
        value={onglet}
        onChange={setOnglet}
        items={[
          { value: "fiche", label: t("ongletFiche") },
          { value: "prive", label: t("ongletMjPrive") },
        ]}
      />
      <div className={`min-h-0 flex-1 ${onglet === "fiche" ? "" : "hidden"}`}>{fiche}</div>
      {onglet === "prive" && <PriveAvecMj campaignId={campaignId} />}
    </div>
  );
}

function PriveAvecMj({ campaignId }: { campaignId: string }) {
  const t = useTranslations("distance");
  const [sujet, setSujet] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function ecrire(body: string) {
    setEnvoi(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      setErreur(res.ok ? null : t("priveNonEnvoye"));
      if (res.ok) setSujet(null);
    } catch (e) {
      console.error("Message privé au MJ non envoyé", e);
      setErreur(t("priveNonEnvoye"));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-xs text-ink-muted">{t("priveExplication")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={envoi}
          onClick={() => void ecrire(t("messagePause"))}
          className="min-h-10 flex-1 rounded-full border border-gm px-3 py-1 text-xs text-gm transition-colors hover:bg-gm/10 disabled:opacity-50"
        >
          {t("demanderPause")}
        </button>
        <button
          type="button"
          disabled={envoi}
          onClick={() => setSujet((s) => (s === null ? "" : null))}
          aria-expanded={sujet !== null}
          className="min-h-10 flex-1 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {t("sujetAEviter")}
        </button>
      </div>
      {sujet !== null && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (sujet.trim()) void ecrire(t("messageSujet", { sujet: sujet.trim() }));
          }}
        >
          <input
            autoFocus
            value={sujet}
            maxLength={300}
            onChange={(e) => setSujet(e.target.value)}
            placeholder={t("sujetPlaceholder")}
            aria-label={t("sujetAEviter")}
            className="min-h-10 flex-1 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
          <button type="submit" disabled={!sujet.trim() || envoi} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50">
            {t("envoyer")}
          </button>
        </form>
      )}
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
      <div className="min-h-0 flex-1">
        <ChatPanel campaignId={campaignId} fil={{ genre: "prive" }} estMj={false} />
      </div>
    </div>
  );
}
