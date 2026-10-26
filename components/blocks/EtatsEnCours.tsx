"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ActionsMenu from "@/components/shared/ActionsMenu";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "@/components/shell/useMatchMedia";
import NomDeRegle from "./NomDeRegle";
import { useWorldRuleEntries } from "./useWorldRuleEntries";

const PASTILLE_ETAT = "rounded-full border border-danger text-xs text-danger";
export const CROIX =
  "relative flex h-4 w-4 items-center justify-center rounded-full text-xs leading-none text-ink-muted transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:text-danger disabled:opacity-40";

/**
 * Les états en cours (V2.1-26) : pastilles rouges, « × » pour en retirer,
 * « + » qui ouvre les états du ruleset (feuille du bas sur téléphone, menu au
 * delà). Extrait de `RangeeChiffree` par V3.1-79 pour que la fiche de
 * créature montre la même boîte, sans changer celle du personnage : sans
 * `onRetirerEtat`, les pastilles sont de lecture ; sans `onAjouterEtat`, pas
 * de « + ». Rien à afficher : aucun rendu.
 */
export default function EtatsEnCours({
  worldSlug,
  conditions,
  busy,
  onRetirerEtat,
  onAjouterEtat,
  etatsDisponibles = [],
}: {
  worldSlug: string;
  /** Des noms LISIBLES, pas des clés. */
  conditions: string[];
  busy: boolean;
  onRetirerEtat?: (nom: string) => void;
  onAjouterEtat?: (nom: string) => void;
  etatsDisponibles?: string[];
}) {
  const t = useTranslations("table");
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [feuilleEtats, setFeuilleEtats] = useState(false);

  // V3.1-32 : un état n'ouvre une règle que si la fiche existe dans le ruleset
  // du monde (jamais une clé devinée). Les états sont stockés par NOM traduit.
  const regles = useWorldRuleEntries(worldSlug);
  const reglesEtats = regles.filter((e) => e.entryType === "condition");
  const cleEtat = (nom: string) => reglesEtats.find((e) => e.name.toLowerCase() === nom.toLowerCase())?.key;

  const dejaPoses = new Set(conditions.map((c) => c.toLowerCase()));
  const aPoser = etatsDisponibles.filter((nom) => !dejaPoses.has(nom.toLowerCase()));

  return (
    <>
      {(conditions.length > 0 || onAjouterEtat) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">États</span>
          {conditions.map((condition) => {
            const cle = cleEtat(condition);
            const nom = cle ? <NomDeRegle worldSlug={worldSlug} ruleKey={cle}>{condition}</NomDeRegle> : condition;
            if (!onRetirerEtat) {
              return (
                <span key={condition} className={`${PASTILLE_ETAT} px-3 py-1`}>
                  {nom}
                </span>
              );
            }
            return (
              <span key={condition} className={`${PASTILLE_ETAT} inline-flex items-center gap-1.5 py-1 pl-3 pr-2`}>
                {nom}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRetirerEtat(condition)}
                  title={t("retirerEtat", { nom: condition })}
                  aria-label={t("retirerEtat", { nom: condition })}
                  className={CROIX}
                >
                  ×
                </button>
              </span>
            );
          })}
          {onAjouterEtat &&
            (estTelephone ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setFeuilleEtats(true)}
                aria-haspopup="dialog"
                title={t("ajouterEtat")}
                aria-label={t("ajouterEtat")}
                className="min-h-8 min-w-8 rounded-full border border-edge px-2 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
              >
                +
              </button>
            ) : (
              <ActionsMenu
                label="+"
                aria-label={t("ajouterEtat")}
                triggerClassName="rounded-full border border-edge px-2 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
                items={aPoser.map((nom) => ({ label: nom, onSelect: () => onAjouterEtat(nom) }))}
              />
            ))}
        </div>
      )}

      {feuilleEtats && onAjouterEtat && (
        <FeuilleDuBas titre={t("ajouterEtat")} titreVisible onFermer={() => setFeuilleEtats(false)}>
          {aPoser.length === 0 ? (
            <p className="px-1 pb-2 text-sm text-ink-muted">{t("aucunEtatAPoser")}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 pb-1">
              {aPoser.map((nom) => (
                <li key={nom}>
                  <button
                    type="button"
                    onClick={() => {
                      onAjouterEtat(nom);
                      setFeuilleEtats(false);
                    }}
                    className="flex min-h-11 w-full items-center rounded-2xl border border-edge bg-panel px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-panel-raised"
                  >
                    {nom}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FeuilleDuBas>
      )}
    </>
  );
}
