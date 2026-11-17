"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import { DEFAULT_CURRENCY_SYSTEM, type CurrencySystem } from "@/src/core/rules/currency";
import { zCurrencySystemBlockData } from "@/src/core/schemas/rule-blocks/blocks";
import { enregistrerBriques } from "@/lib/ui/regleApi";
import { ajouterPiece, brouillonDe, deplacerDansOrdre, ordreEffectif, systemeDe, type BrouillonPiece, type BrouillonSysteme } from "@/lib/ui/systemeMonetaire";
import type { RuleEntryDetail } from "@/src/server/services/rules";

const CHAMP = "min-w-0 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none";

/**
 * V3.1-220 (ADR 0102) — saisir le système monétaire d'un monde, sur la fiche
 * « Pièces de monnaie ». Même cadre et même chemin d'écriture que l'éditeur de
 * briques : en surcharge dans la variante active, jamais dans l'officielle
 * (règle 18 ; le serveur revalide le bloc). Une pièce par ligne (clé, libellés
 * fr/en, valeur en pc, rôle), puis l'ordre de casse des réserves.
 */
export default function CurrencySystemEditor({
  worldSlug,
  entry,
  onDone,
  onCancel,
}: {
  worldSlug: string;
  entry: RuleEntryDetail;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("regles.monnaie");
  const [brouillon, setBrouillon] = useState<BrouillonSysteme>(() => {
    const bloc = entry.blocks.find((b) => b.blockType === "currency_system");
    const lu = zCurrencySystemBlockData.safeParse(bloc?.data);
    return brouillonDe(lu.success ? (lu.data as CurrencySystem) : DEFAULT_CURRENCY_SYSTEM);
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const officielle = entry.isOfficialBase;

  const majPiece = (i: number, patch: Partial<BrouillonPiece>) =>
    setBrouillon({ ...brouillon, pieces: brouillon.pieces.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  const retirerPiece = (i: number) => setBrouillon({ ...brouillon, pieces: brouillon.pieces.filter((_, k) => k !== i) });
  const nomDe = (key: string) => brouillon.pieces.find((p) => p.key === key)?.fr || key;
  const ordre = ordreEffectif(brouillon);

  async function enregistrer() {
    const r = systemeDe(brouillon);
    if (!r.ok) {
      setErreur(r.message);
      return;
    }
    setErreur(null);
    setEnCours(true);
    const res = await enregistrerBriques(worldSlug, { entryKey: entry.entryKey, currency_system: r.systeme });
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.sansVariante ? t("sansVariante") : res.message);
      return;
    }
    onDone();
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-accent/40 bg-panel-sunken p-4" aria-label={t("titre")}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-ink">{t("titre")}</h2>
        <span className="flex-1" />
        <button type="button" onClick={onCancel} className="rounded-full border border-edge px-4 py-2 text-sm text-ink transition-colors hover:bg-panel-raised">
          {t("annuler")}
        </button>
        <button
          type="button"
          onClick={() => void enregistrer()}
          disabled={enCours || officielle}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {enCours ? t("enregistrement") : t("enregistrer")}
        </button>
      </div>

      {officielle && (
        <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
          {t("sansVariante")}
        </p>
      )}
      {erreur && (
        <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
          {erreur}
        </p>
      )}
      <p className="text-xs text-ink-muted">{t("aide")}</p>

      <ul className="flex flex-col gap-2">
        {brouillon.pieces.map((p, i) => (
          <li key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-edge/60 bg-panel p-2">
            <label className="flex w-28 flex-col gap-1 text-xs text-ink-muted">
              {t("cle")}
              <input value={p.key} onChange={(e) => majPiece(i, { key: e.target.value })} placeholder="crown" className={`${CHAMP} font-mech`} />
            </label>
            <label className="flex w-32 flex-col gap-1 text-xs text-ink-muted">
              {t("libelleFr")}
              <input value={p.fr} onChange={(e) => majPiece(i, { fr: e.target.value })} className={CHAMP} />
            </label>
            <label className="flex w-32 flex-col gap-1 text-xs text-ink-muted">
              {t("libelleEn")}
              <input value={p.en} onChange={(e) => majPiece(i, { en: e.target.value })} className={CHAMP} />
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs text-ink-muted">
              {t("valeur")}
              <input value={p.valeur} onChange={(e) => majPiece(i, { valeur: e.target.value })} inputMode="numeric" className={`${CHAMP} text-right font-mech`} />
            </label>
            <div className="flex flex-col gap-1 text-xs text-ink-muted">
              <span>{t("role")}</span>
              <Dropdown
                value={p.role}
                onChange={(v) => majPiece(i, { role: v === "common" ? "common" : "reserve" })}
                options={[
                  { value: "common", label: t("courante") },
                  { value: "reserve", label: t("reserve") },
                ]}
                aria-label={t("role")}
              />
            </div>
            <button
              type="button"
              onClick={() => retirerPiece(i)}
              aria-label={t("retirer", { nom: p.fr || p.key || "?" })}
              className="ml-auto rounded-full px-2 py-1 text-sm text-danger transition-colors hover:bg-panel-raised"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setBrouillon(ajouterPiece(brouillon))}
        className="w-fit rounded-full border border-edge px-4 py-2 text-sm text-ink transition-colors hover:bg-panel-raised"
      >
        {t("ajouter")}
      </button>

      <div className="flex flex-col gap-2">
        <h3 className="block-title">{t("ordreDeCasse")}</h3>
        {ordre.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("aucuneReserve")}</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {ordre.map((key, i) => (
              <li key={key} className="flex items-center gap-2 text-sm text-ink">
                <span className="w-5 text-right font-mech text-ink-muted">{i + 1}.</span>
                <span className="flex-1">{nomDe(key)}</span>
                <button
                  type="button"
                  onClick={() => setBrouillon(deplacerDansOrdre(brouillon, key, -1))}
                  disabled={i === 0}
                  aria-label={t("monter", { nom: nomDe(key) })}
                  className="rounded-full px-2 py-0.5 text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => setBrouillon(deplacerDansOrdre(brouillon, key, 1))}
                  disabled={i === ordre.length - 1}
                  aria-label={t("descendre", { nom: nomDe(key) })}
                  className="rounded-full px-2 py-0.5 text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink disabled:opacity-30"
                >
                  ▼
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
