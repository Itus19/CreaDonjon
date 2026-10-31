"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "@/components/shell/useMatchMedia";
import type { SousEtape } from "@/lib/ui/cheminCreation";
import { colonnesComparatives, estTableauComparatif } from "@/lib/ui/optionsAvecEffets";
import { localizedLabel, type OpenChoice } from "@/src/core/rules/choices";
import { DAMAGE_TYPE_LABELS_FR, SKILL_LABELS_FR } from "@/src/i18n/fr";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { refIdentity, useReferenceChips } from "./useReferenceChips";
import ChoixGenerique from "./characterCreator/ChoixGenerique";
import { TableauOptions } from "./characterCreator/ChoixExpliques";

/** Les options d'un choix rouvert, telles que le sélecteur les attend. Un choix de don ou de sort n'est pas proposé ici (aucun catalogue chargé) : le seul geste est de garder l'ancienne réponse. */
function optionsDe(choix: OpenChoice): SousEtape["options"] {
  const from = choix.from;
  if (from.kind === "option") {
    return from.options.map((o) => ({
      cle: o.id,
      libelle: localizedLabel(o.label, o.id),
      ...(o.description ? { description: localizedLabel(o.description, "") } : {}),
    }));
  }
  if (from.kind === "skill" || from.kind === "language" || from.kind === "tool" || from.kind === "ability" || from.kind === "damage_type") {
    return (from.options ?? []).map((cle) => ({ cle }));
  }
  return [];
}

/** La `SousEtape` minimale que lisent les sélecteurs de la création : rien de plus que le choix et la sélection en cours. */
function sousEtapeDe(choix: OpenChoice, choisis: string[]): SousEtape {
  return {
    cle: choix.key,
    etape: "classe",
    libelle: choix.label,
    source: choix.label,
    nombre: choix.count,
    choisis,
    options: optionsDe(choix),
    genre: choix.from.kind,
    impose: false,
    fait: choisis.length >= choix.count,
    attend: false,
    expertise: false,
    niveau: choix.atLevel,
  };
}

/**
 * V3.1-119 — Les choix qu'un repos a rouverts (`choices_to_refresh`) : pour chacun,
 * « Choisir à nouveau : <libellé> », la réponse actuelle, le sélecteur, « Valider »
 * et « Garder ». Sans réponse, l'ancien choix reste (rien n'est envoyé tant qu'on
 * ne clique pas). Ordinateur et tablette : un bandeau sur la fiche ; téléphone : un
 * rappel compact qui ouvre une feuille du bas.
 *
 * Jamais `disabled` pendant la requête (leçon du ticket 51) : `aria-disabled` et
 * un retour anticipé, pour que le bouton garde le focus.
 */
export default function ChoixRouverts({
  worldSlug,
  choix,
  onRepondre,
}: {
  worldSlug: string;
  choix: OpenChoice[];
  /** Envoie la réponse (`null` : garder). Rend le message d'erreur du serveur, ou `null` si c'est enregistré. */
  onRepondre: (cle: string, valeurs: string[] | null) => Promise<string | null>;
}) {
  const t = useTranslations("creation");
  const mobile = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [occupe, setOccupe] = useState(false);
  const occupeRef = useRef(false);

  // Les noms des sorts que portent les options, pour le tableau comparatif.
  const refsSorts = useMemo(
    () =>
      choix.flatMap((c): BlockReference[] =>
        c.from.kind === "option" ? c.from.options.flatMap((o) => (o.spells ?? []).map((s): BlockReference => ({ kind: "rule", key: s.key }))) : []
      ),
    [choix]
  );
  const puces = useReferenceChips(worldSlug, refsSorts);
  const nomSort = (cle: string) => {
    const puce = puces.get(refIdentity({ kind: "rule", key: cle }));
    return puce?.found ? puce.name : cle;
  };

  if (choix.length === 0) return null;

  async function repondre(cle: string, valeurs: string[] | null) {
    if (occupeRef.current) return;
    occupeRef.current = true;
    setOccupe(true);
    try {
      const erreur = await onRepondre(cle, valeurs);
      setErreurs((prev) => {
        const reste = Object.fromEntries(Object.entries(prev).filter(([k]) => k !== cle));
        return erreur === null ? reste : { ...reste, [cle]: erreur || t("choixRouvertsErreur") };
      });
    } catch (erreur: unknown) {
      console.error("Choix rouvert non enregistré", erreur);
      setErreurs((prev) => ({ ...prev, [cle]: t("choixRouvertsErreur") }));
    } finally {
      occupeRef.current = false;
      setOccupe(false);
    }
  }

  const bandeaux = choix.map((c) => {
    const libelleOption = (cle: string) => optionsDe(c).find((o) => o.cle === cle)?.libelle ?? SKILL_LABELS_FR[cle as keyof typeof SKILL_LABELS_FR] ?? DAMAGE_TYPE_LABELS_FR[cle] ?? cle;
    const choisis = selection[c.key] ?? c.chosen;
    const sous = sousEtapeDe(c, choisis);
    const actuelle = c.chosen.map(libelleOption).join(", ");
    const complet = choisis.length === c.count;
    const onChoisir = (valeurs: string[]) => setSelection((prev) => ({ ...prev, [c.key]: valeurs }));
    return (
      <section key={c.key} aria-label={t("choixRouvertsTitre", { libelle: c.label })} className="flex flex-col gap-2 rounded-md border border-accent/50 bg-accent/10 p-3">
        <h3 className="text-sm font-semibold text-ink">{t("choixRouvertsTitre", { libelle: c.label })}</h3>
        <p className="text-xs text-ink-soft">{t("choixRouvertsActuelle", { reponse: actuelle })}</p>
        {estTableauComparatif(c.from) ? (
          <TableauOptions sous={sous} colonnes={colonnesComparatives(c.from.options, nomSort)} onChoisir={onChoisir} />
        ) : (
          <ChoixGenerique sous={sous} libelleOption={libelleOption} dejaAcquis={new Set()} onChoisir={onChoisir} />
        )}
        {erreurs[c.key] && (
          <p role="alert" className="text-xs text-danger">
            {erreurs[c.key]}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-disabled={occupe || !complet}
            onClick={() => {
              if (occupe || !complet) return;
              void repondre(c.key, choisis);
            }}
            className="rounded-full border border-accent bg-accent/10 px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/20 aria-disabled:opacity-50"
          >
            {t("choixRouvertsValider")}
          </button>
          <button
            type="button"
            aria-disabled={occupe}
            onClick={() => {
              if (occupe) return;
              void repondre(c.key, null);
            }}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel aria-disabled:opacity-50"
          >
            {t("choixRouvertsGarder", { reponse: actuelle })}
          </button>
        </div>
      </section>
    );
  });

  if (!mobile) return <div className="flex flex-col gap-2">{bandeaux}</div>;

  return (
    <>
      <button
        type="button"
        onClick={() => setFeuilleOuverte(true)}
        className="rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 text-left text-xs text-ink"
      >
        {t("choixRouvertsRappel", { n: choix.length })}
      </button>
      {feuilleOuverte && (
        <FeuilleDuBas titre={t("choixRouvertsFeuille")} titreVisible onFermer={() => setFeuilleOuverte(false)}>
          <div className="flex flex-col gap-3">{bandeaux}</div>
        </FeuilleDuBas>
      )}
    </>
  );
}
