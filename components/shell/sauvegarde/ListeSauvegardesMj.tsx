"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { attenteDeReponse, issueDepuisReponse, type DemandeSauvegarde, type IssueSauvegarde } from "@/lib/ui/sauvegardes";
import { repondreSauvegarde } from "@/lib/ui/sauvegardesApi";
import SaisieVraiDe from "./SaisieVraiDe";

const BTN = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";
const BTN_PRINCIPAL = "rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50";
const DUREE_VERDICT_MS = 5000;

/**
 * V3.1-112 (ADR 0044) — les sauvegardes demandées, côté MJ : une ligne par
 * demande, avec qui doit répondre. Le MJ peut toujours répondre (la base l'y
 * autorise) : « Lancer » (le SERVEUR tire) ou « Saisir » (le vrai dé de la
 * table, « modificateur inclus »). Aucun rendu sans demande ni verdict.
 */
export default function ListeSauvegardesMj({
  campaignId,
  demandes,
  nomDeLaCible,
  onRepondue,
}: {
  campaignId: string;
  demandes: DemandeSauvegarde[];
  /** Le nom de la joueuse (ou de son personnage) que la demande attend, quand l'écran le connaît. */
  nomDeLaCible: (demande: DemandeSauvegarde) => string | null;
  /** La réponse est enregistrée : l'écran relit ce qu'elle a changé (PV, états de la cible). */
  onRepondue?: (demande: DemandeSauvegarde) => void;
}) {
  const t = useTranslations("sauvegardes");
  const [occupee, setOccupee] = useState<string | null>(null);
  const [saisie, setSaisie] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ label: string; issue: IssueSauvegarde } | null>(null);

  // Le verdict du dernier jet se retire seul.
  useEffect(() => {
    if (!verdict) return;
    const minuteur = setTimeout(() => setVerdict(null), DUREE_VERDICT_MS);
    return () => clearTimeout(minuteur);
  }, [verdict]);

  async function repondre(demande: DemandeSauvegarde, corps: Parameters<typeof repondreSauvegarde>[2]) {
    if (occupee) return;
    setErreur(null);
    setOccupee(demande.id);
    const res = await repondreSauvegarde(campaignId, demande.id, corps, t("erreurEnvoi"));
    setOccupee(null);
    if (!res.ok) {
      setErreur(res.erreur);
      return;
    }
    setSaisie(null);
    onRepondue?.(demande);
    setVerdict({ label: demande.label, issue: issueDepuisReponse(res.reponse, demande.dc) });
  }

  if (demandes.length === 0 && !verdict && !erreur) return null;

  return (
    <section aria-label={t("listeTitre")} className="flex flex-col gap-2 rounded-[18px] border border-accent bg-panel p-3 backdrop-blur-[var(--blur)]">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("listeTitre")}</h2>
      {demandes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {demandes.map((d) => {
            const nom = nomDeLaCible(d);
            const attente = attenteDeReponse(d, nom);
            // Un monstre n'a pas de joueuse : le MJ doit quand même savoir QUI résiste.
            const qui = attente.qui === "mj" ? (nom ? `${nom} · ${t("aToi")}` : t("aToi")) : attente.nom ? t("attend", { nom: attente.nom }) : t("attendJoueuse");
            return (
              <li key={d.id} className="flex flex-col gap-2 rounded-xl border border-edge bg-panel-sunken px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1 text-xs text-ink">
                    <span className="font-medium">{d.label}</span> <span className="text-ink-muted">· {qui}</span>
                  </span>
                  <button type="button" disabled={occupee !== null} onClick={() => void repondre(d, { mode: "roll" })} className={BTN_PRINCIPAL}>
                    {t("lancer")}
                  </button>
                  <button type="button" disabled={occupee !== null} onClick={() => setSaisie(saisie === d.id ? null : d.id)} aria-expanded={saisie === d.id} className={BTN}>
                    {t("saisir")}
                  </button>
                </div>
                {saisie === d.id && (
                  <SaisieVraiDe
                    desactive={occupee !== null}
                    onValider={(natural, inclus) => void repondre(d, { mode: "die", natural, modifierIncluded: inclus })}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {verdict && (
        <p role="status" className={`text-xs font-semibold ${verdict.issue.reussie ? "text-success" : "text-danger"}`}>
          {t("verdict", { verdict: verdict.issue.reussie ? t("reussie") : t("ratee"), total: verdict.issue.total, dd: verdict.issue.dc })}
          <span className="font-normal text-ink-muted"> · {verdict.label}</span>
        </p>
      )}
      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}
    </section>
  );
}
