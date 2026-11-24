"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MiseAJourRuleset as Donnees } from "@/src/server/services/reglesActives";
import type { RegleAMettreAJour } from "@/src/core/rules/copieRuleset";

/**
 * AG-18 (ADR 0106) — « Mise à jour disponible » : les règles qui ont changé
 * dans la source de la copie active, une ligne chacune, avec « Reprendre » et
 * « Garder la mienne ». La liste arrive avec la page (docs/CABLAGE.md C1) ;
 * chaque choix envoie UNE requête et retire la ligne une fois appliqué.
 */
export default function MiseAJourRuleset({ worldSlug, miseAJour }: { worldSlug: string; miseAJour: Donnees }) {
  const t = useTranslations("regles.miseAJour");
  const [regles, setRegles] = useState(miseAJour.regles);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisir(regle: RegleAMettreAJour, take: boolean) {
    setEnCours(regle.entryKey);
    setErreur(null);
    try {
      const res = await fetch(`/api/worlds/${worldSlug}/ruleset-copy-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rulesetId: miseAJour.copieId, entryKey: regle.entryKey, take, digest: regle.digest }),
      });
      if (res.ok) {
        setRegles((avant) => avant.filter((r) => r.entryKey !== regle.entryKey));
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setErreur(body?.error ?? t("erreur"));
    } catch (e) {
      console.error("Choix de mise à jour du ruleset impossible", e);
      setErreur(t("erreur"));
    } finally {
      setEnCours(null);
    }
  }

  if (regles.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-accent/50 px-3 py-2.5">
      <h3 className="text-sm font-semibold text-accent">{t("titre")}</h3>
      <p className="text-xs text-ink-muted">{t("aide", { source: miseAJour.sourceNom })}</p>
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
      <ul className="flex flex-col gap-1.5">
        {regles.map((r) => (
          <li key={r.entryKey} className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">{t(r.etat)}</span>
              <span className="min-w-0 break-words text-sm text-ink">{r.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={enCours !== null}
                onClick={() => choisir(r, true)}
                className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50 motion-reduce:transition-none"
              >
                {t("reprendre")}
              </button>
              <button
                type="button"
                disabled={enCours !== null}
                onClick={() => choisir(r, false)}
                className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none"
              >
                {t("garder")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
