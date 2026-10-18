"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Checkbox from "@/components/shared/Checkbox";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Dropdown from "@/components/shared/Dropdown";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { CURRENCY_ORDER, type CoinType } from "@/src/core/rules/currency";
import { apercuPieces, apercuXp, lireMontant, type Apercu, type DeltaPieces, type ModePartage } from "@/lib/ui/outilTable";
import type { Resultat } from "@/lib/ui/tableApi";
import type { TablePc } from "@/src/server/services/tableParty";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";

export type ModeToutelaTable = "xp" | "pieces" | "reposCourt" | "reposLong";

type Issue = { entityId: string; ok: boolean; message: string | null };

const CHAMP = "w-full rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none focus:border-accent";
const CHOIX_BASE = "rounded-full border px-3 py-1 text-xs transition-colors";
const CHOIX_ACTIF = "border-accent text-accent";
const CHOIX_INACTIF = "border-edge text-ink-soft hover:bg-panel-raised";

/**
 * « Toute la table » (V3.1-34) : XP, pièces, repos court, repos long pour les PJ
 * cochés. Feuille du bas sur téléphone, dialogue de la charte au-delà.
 *
 * Valider = UN appel de route par PJ coché, l'un après l'autre (le même geste
 * que la fiche, donc le même journal) ; le résultat est montré par PJ. Le
 * partage « à partager » passe par `partagerEgalement` (noyau) et AFFICHE le reste.
 */
export default function FeuilleToutelaTable({
  mode,
  pcs,
  geste,
  onFermer,
}: {
  mode: ModeToutelaTable;
  pcs: TablePc[];
  geste: (pc: TablePc, action: string, corps: object, delta?: DeltaPieces) => Promise<Resultat<unknown>>;
  onFermer: () => void;
}) {
  const t = useTranslations("table");
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [coches, setCoches] = useState<Set<string>>(() => new Set(pcs.map((pc) => pc.entityId)));
  const [texte, setTexte] = useState("");
  const [partage, setPartage] = useState<ModePartage>("partager");
  const [piece, setPiece] = useState<CoinType>("gp");
  const [phase, setPhase] = useState<"saisie" | "encours" | "fini">("saisie");
  const [issues, setIssues] = useState<Issue[]>([]);

  const cibles = pcs.filter((pc) => coches.has(pc.entityId));
  const avecMontant = mode === "xp" || mode === "pieces";
  const montant = avecMontant ? lireMontant(texte) : null;
  const apercu: Apercu | null =
    montant === null ? null : mode === "xp" ? apercuXp(cibles, montant, partage) : mode === "pieces" ? apercuPieces(cibles, montant, partage, piece) : null;
  const unite = mode === "xp" ? t("unitePx") : t(`piece.${piece}`);

  const titre = { xp: t("titreXp"), pieces: t("titrePieces"), reposCourt: t("titreReposCourt"), reposLong: t("titreReposLong") }[mode];
  const peutValider = phase === "saisie" && cibles.length > 0 && (!avecMontant || (apercu !== null && apercu.parPersonne !== 0));

  function basculer(entityId: string) {
    setCoches((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(entityId)) suivant.delete(entityId);
      else suivant.add(entityId);
      return suivant;
    });
  }

  async function valider() {
    if (!peutValider) return;
    setPhase("encours");
    const resultats: Issue[] = [];
    // Un PJ après l'autre : chaque geste est journalisé, et un refus d'un PJ n'arrête pas les autres.
    for (const pc of cibles) {
      let resultat: Resultat<unknown>;
      if (mode === "xp" && apercu) {
        resultat = await geste(pc, "xp", { delta: apercu.parPersonne });
      } else if (mode === "pieces" && apercu) {
        const delta = { [piece]: apercu.parPersonne };
        resultat = await geste(pc, "currency", { delta }, delta);
      } else if (mode === "reposCourt") {
        resultat = await geste(pc, "short-rest", { hitDiceSpent: {} });
      } else {
        resultat = await geste(pc, "long-rest", {});
      }
      resultats.push({ entityId: pc.entityId, ok: resultat.ok, message: resultat.ok ? null : (resultat.erreur ?? t("erreurGeste")) });
      setIssues([...resultats]);
    }
    setPhase("fini");
  }

  const corps = (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5" disabled={phase !== "saisie"}>
        <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">{t("pourQui")}</legend>
        {pcs.map((pc) => (
          <Checkbox key={pc.entityId} checked={coches.has(pc.entityId)} onChange={() => basculer(pc.entityId)} label={pc.name} disabled={phase !== "saisie"} className="min-h-9 text-sm text-ink" />
        ))}
      </fieldset>

      {avecMontant && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t("montant")}
            <input
              type="text"
              inputMode="numeric"
              value={texte}
              disabled={phase !== "saisie"}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="—"
              className={`${CHAMP} font-normal normal-case tracking-normal`}
            />
          </label>
          {mode === "pieces" && (
            <div className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t("pieceChoisie")}
              <Dropdown
                value={piece}
                options={CURRENCY_ORDER.map((p) => ({ value: p, label: t(`piece.${p}`) }))}
                onChange={(v) => setPiece(v as CoinType)}
                disabled={phase !== "saisie"}
                size="md"
                aria-label={t("pieceChoisie")}
              />
            </div>
          )}
          <div className="flex gap-2" role="group" aria-label={t("repartition")}>
            <button type="button" aria-pressed={partage === "partager"} disabled={phase !== "saisie"} onClick={() => setPartage("partager")} className={`${CHOIX_BASE} ${partage === "partager" ? CHOIX_ACTIF : CHOIX_INACTIF}`}>
              {t("partager")}
            </button>
            <button type="button" aria-pressed={partage === "chacun"} disabled={phase !== "saisie"} onClick={() => setPartage("chacun")} className={`${CHOIX_BASE} ${partage === "chacun" ? CHOIX_ACTIF : CHOIX_INACTIF}`}>
              {t("chacun")}
            </button>
          </div>

          {phase === "saisie" && (
          <div className="flex flex-col gap-1" aria-live="polite">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("apercu")}</span>
            {apercu === null ? (
              <p className="text-xs text-ink-muted">{t("saisirMontant")}</p>
            ) : cibles.length === 0 ? (
              <p className="text-xs text-ink-muted">{t("aucunCoche")}</p>
            ) : (
              <>
                <ul className="flex flex-col gap-0.5">
                  {apercu.lignes.map((ligne) => (
                    <li key={ligne.entityId} className="text-sm text-ink">
                      {ligne.nom} : {ligne.gain >= 0 ? "+" : ""}
                      {ligne.gain} {unite} →{" "}
                      {ligne.nouveauTotal === null ? <span className="text-danger">{t("fondsInsuffisants")}</span> : `${ligne.nouveauTotal} ${unite}`}
                      {ligne.monteAuNiveau !== null && <span className="font-semibold text-accent"> · {t("monteAuNiveau", { niveau: ligne.monteAuNiveau })}</span>}
                    </li>
                  ))}
                </ul>
                {apercu.reste !== 0 && <p className="text-xs text-ink-muted">{t("resteNonDistribue", { reste: apercu.reste, unite })}</p>}
                {apercu.parPersonne === 0 && <p className="text-xs text-ink-muted">{t("rienADistribuer")}</p>}
              </>
            )}
          </div>
          )}
        </div>
      )}

      {!avecMontant && cibles.length === 0 && <p className="text-xs text-ink-muted">{t("aucunCoche")}</p>}

      {phase !== "saisie" && (
        <ul className="flex flex-col gap-0.5" aria-live="polite">
          {cibles.map((pc) => {
            const issue = issues.find((i) => i.entityId === pc.entityId);
            return (
              <li key={pc.entityId} className={`text-sm ${issue && !issue.ok ? "text-danger" : "text-ink"}`}>
                {pc.name} : {issue === undefined ? t("enCours") : issue.ok ? t("fait") : t("echec", { message: issue.message ?? "" })}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (estTelephone) {
    return (
      <FeuilleDuBas titre={titre} titreVisible onFermer={onFermer}>
        {corps}
        <div className="mt-4 flex justify-end gap-2 pb-1">
          {phase === "fini" ? (
            <button type="button" onClick={onFermer} className="min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover">
              {t("fermer")}
            </button>
          ) : (
            <>
              <button type="button" disabled={phase === "encours"} onClick={onFermer} className="min-h-11 rounded-full border border-edge px-4 py-2 text-sm text-ink transition-colors hover:bg-panel disabled:opacity-50">
                {t("annuler")}
              </button>
              <button type="button" disabled={!peutValider} onClick={valider} className="min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50">
                {phase === "encours" ? t("enCours") : t("valider")}
              </button>
            </>
          )}
        </div>
      </FeuilleDuBas>
    );
  }

  return (
    <ConfirmDialog
      open
      title={titre}
      message={t(mode === "xp" ? "messageXp" : mode === "pieces" ? "messagePieces" : "messageRepos")}
      confirmLabel={phase === "fini" ? t("fermer") : phase === "encours" ? t("enCours") : t("valider")}
      cancelLabel={phase === "fini" ? t("fermer") : t("annuler")}
      onConfirm={phase === "fini" ? onFermer : valider}
      onCancel={phase === "encours" ? () => {} : onFermer}
    >
      {corps}
    </ConfirmDialog>
  );
}
