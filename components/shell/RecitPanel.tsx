"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Interrupteur from "@/components/rules/Interrupteur";
import { enregistrerReglagesTable } from "@/lib/ui/reglesActives";
import { RECIT_PERSONNES, REGISTRE_MAX, STYLE_INTIME_MAX, type RecitPersonne, type RecitSettings } from "@/src/core/campaigns/recit";

/**
 * V3.2-5 — Le réglage « Récit » de la partie, dans Gestion de campagne :
 * la personne du récit, le registre, et les scènes intimes (coupées par
 * défaut). Il ne règle que la consigne du modèle de narration solo.
 *
 * La personne et l'interrupteur s'enregistrent au geste ; les deux textes,
 * au bouton, pour ne pas écrire la colonne à chaque frappe.
 */
export default function RecitPanel({ campaignId, initial }: { campaignId: string; initial: RecitSettings }) {
  const t = useTranslations("table");
  const [recit, setRecit] = useState<RecitSettings>(initial);
  const [textes, setTextes] = useState({ registre: initial.registre, style_intime: initial.style_intime });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const [busy, setBusy] = useState(false);
  const libelles: Record<RecitPersonne, string> = { tu: t("recitTu"), vous: t("recitVous"), il: t("recitIl") };
  const textesModifies = textes.registre !== recit.registre || textes.style_intime !== recit.style_intime;

  async function enregistrer(patch: Partial<RecitSettings>) {
    const avant = recit;
    setRecit({ ...recit, ...patch });
    setBusy(true);
    setEnregistre(false);
    const echec = await enregistrerReglagesTable(campaignId, { recit: patch }, t("recitErreur"));
    setBusy(false);
    if (echec) {
      setRecit(avant);
      setErreur(echec);
      return;
    }
    setErreur(null);
    setEnregistre(true);
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-edge bg-panel p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">{t("recitTitre")}</h2>
        <p className="text-sm text-ink-soft">{t("recitExplication")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{t("recitPersonne")}</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("recitPersonne")}>
          {RECIT_PERSONNES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={recit.personne === p}
              disabled={busy}
              onClick={() => (p === recit.personne ? undefined : void enregistrer({ personne: p }))}
              className={`rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-50 ${recit.personne === p ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink hover:bg-panel-raised"}`}
            >
              {libelles[p]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">{t("recitRegistre")}</span>
        <span className="text-xs text-ink-muted">{t("recitRegistreAide")}</span>
        <textarea
          value={textes.registre}
          maxLength={REGISTRE_MAX}
          rows={5}
          onChange={(e) => setTextes({ ...textes, registre: e.target.value })}
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

      <Interrupteur
        actif={recit.scenes_intimes}
        onChange={() => void enregistrer({ scenes_intimes: !recit.scenes_intimes })}
        titre={t("recitIntimes")}
        aide={t("recitIntimesAide")}
      />

      {recit.scenes_intimes && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">{t("recitStyleIntime")}</span>
          <span className="text-xs text-ink-muted">{t("recitStyleIntimeAide")}</span>
          <textarea
            value={textes.style_intime}
            maxLength={STYLE_INTIME_MAX}
            rows={6}
            onChange={(e) => setTextes({ ...textes, style_intime: e.target.value })}
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!textesModifies || busy}
          onClick={() => void enregistrer({ registre: textes.registre, style_intime: textes.style_intime })}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {t("recitEnregistrer")}
        </button>
        {enregistre && !textesModifies && <span className="text-xs text-ink-muted">{t("recitEnregistre")}</span>}
        {erreur && (
          <span role="alert" className="text-xs text-danger">
            {erreur}
          </span>
        )}
      </div>
    </section>
  );
}
