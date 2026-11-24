"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { PlayStyle } from "@/src/core/remote/feed";

/**
 * ADR 0103 — la façon de jouer d'une campagne (à table, à distance, les
 * deux), dans Gestion de campagne. Choisir une autre valeur ouvre toujours
 * une confirmation : l'auteur ne veut jamais changer de mode par accident
 * (18 nov.). La route refuse d'ailleurs un corps sans `confirmed: true`.
 */
export default function FaconDeJouerPanel({ worldSlug, campaignId, initial }: { worldSlug: string; campaignId: string; initial: PlayStyle }) {
  const t = useTranslations("distance");
  const [actuelle, setActuelle] = useState<PlayStyle>(initial);
  const [proposee, setProposee] = useState<PlayStyle | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const libelles: Record<PlayStyle, string> = { table: t("faconTable"), remote: t("faconRemote"), both: t("faconBoth") };

  async function confirmer() {
    if (!proposee) return;
    const cible = proposee;
    setProposee(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/facon-de-jouer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playStyle: cible, confirmed: true }),
      });
      if (!res.ok) {
        setErreur(t("faconErreur"));
        return;
      }
      setActuelle(cible);
      setErreur(null);
    } catch (e) {
      console.error("Façon de jouer non changée", e);
      setErreur(t("faconErreur"));
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-edge bg-panel p-6">
      <h2 className="text-base font-semibold text-ink">{t("faconTitre")}</h2>
      <p className="text-sm text-ink-soft">{t("faconExplication")}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("faconTitre")}>
        {(["table", "remote", "both"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={actuelle === f}
            onClick={() => (f === actuelle ? undefined : setProposee(f))}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${actuelle === f ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink hover:bg-panel-raised"}`}
          >
            {libelles[f]}
          </button>
        ))}
      </div>
      {actuelle !== "table" && (
        <Link href={`/m/${worldSlug}/mj/distance`} className="self-start rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10">
          {t("ouvrirJeuADistance")}
        </Link>
      )}
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
      <ConfirmDialog
        open={proposee !== null}
        title={t("faconConfirmerTitre")}
        message={proposee ? t("faconConfirmerTexte", { facon: libelles[proposee] }) : ""}
        confirmLabel={t("faconConfirmer")}
        onConfirm={() => void confirmer()}
        onCancel={() => setProposee(null)}
      />
    </section>
  );
}
