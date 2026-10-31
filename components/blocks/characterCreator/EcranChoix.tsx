"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { SousEtape } from "@/lib/ui/cheminCreation";
import { colonnesComparatives, estTableauComparatif } from "@/lib/ui/optionsAvecEffets";
import { ABILITIES, SKILLS, type Ability, type DerivedSheet, type Skill } from "@/src/core/rules/sheet";
import { bestSpellAbility, skillChoiceEffects, spellAbilityEffects } from "@/src/core/rules/choiceEffects";
import type { OpenChoice } from "@/src/core/rules/choices";
import { parseCustomTableFields, parseSpellLevel, type CustomTableRow } from "@/src/core/rules/srdMapping";
import type { CustomTableBlockData } from "@/src/core/schemas/rule-blocks";
import type { RuleEntryBlockData } from "../useRuleEntryBlocks";
import ChoixGenerique from "./ChoixGenerique";
import SelecteurSorts, { type CandidatSort } from "./SelecteurSorts";
import FicheSort from "./FicheSort";
import { ChoixCaracIncantation, ChoixCompetence, TableauOptions } from "./ChoixExpliques";

function niveauDuSort(blocs: RuleEntryBlockData[] | undefined): number | null {
  const table = blocs?.find((b) => b.blockType === "custom_table");
  if (!table) return null;
  return parseSpellLevel(parseCustomTableFields((table.data as CustomTableBlockData).rows as unknown as CustomTableRow[]));
}

export interface ContexteEcranChoix {
  worldSlug: string;
  sheet: DerivedSheet;
  ouverts: readonly OpenChoice[];
  /** Les caractéristiques d'incantation des classes choisies. */
  caracsDeClasse: readonly Ability[];
  /** Les blocs des sorts du monde, préchargés par l'assistant. */
  blocsSorts: Record<string, RuleEntryBlockData[]>;
  nomSort: (cle: string) => string;
  libelleOption: (sous: SousEtape) => (cle: string) => string;
  dejaAcquis: (sous: SousEtape) => Set<string>;
  onChoisir: (cleChoix: string, valeurs: string[]) => void;
}

/**
 * V3.1-50 — L'écran d'une sous-étape : le bon sélecteur selon le genre du
 * choix, et l'effet chiffré par le moteur quand il en a un. Un don d'historique
 * (`groupe`) réunit ses choix en sections, avec la fiche du sort touché à côté
 * (dessous sur tablette et téléphone).
 */
export default function EcranChoix({ sous, ctx }: { sous: SousEtape; ctx: ContexteEcranChoix }) {
  const t = useTranslations("creation");
  const [touche, setTouche] = useState<string | null>(null);

  if (sous.genre !== "groupe" || !sous.sections) return <Choix sous={sous} ctx={ctx} touche={touche} onToucher={setTouche} />;

  return (
    <div className="grid grid-cols-1 gap-4 @4xl/creation:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-5">
        {sous.sections.map((section) => (
          <section key={section.cle} aria-label={section.libelle} className="flex flex-col gap-2">
            {section.genre !== "spell" && (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">{section.libelle}</h3>
                <span className="text-xs text-ink-muted">{section.fait ? t("fait") : t("aFaireUn")}</span>
              </div>
            )}
            <Choix sous={section} ctx={ctx} touche={touche} onToucher={setTouche} dansGroupe />
          </section>
        ))}
      </div>
      <div className="min-w-0">
        <FicheSort worldSlug={ctx.worldSlug} cle={touche} nom={touche ? ctx.nomSort(touche) : ""} blocs={touche ? ctx.blocsSorts[touche] : undefined} />
      </div>
    </div>
  );
}

function Choix({
  sous,
  ctx,
  touche,
  onToucher,
  dansGroupe = false,
}: {
  sous: SousEtape;
  ctx: ContexteEcranChoix;
  touche: string | null;
  onToucher: (cle: string) => void;
  dansGroupe?: boolean;
}) {
  const ouvert = ctx.ouverts.find((o) => o.key === sous.cle);
  const libelleOption = ctx.libelleOption(sous);
  const onChoisir = (valeurs: string[]) => ctx.onChoisir(sous.cle, valeurs);
  const from = ouvert?.from;

  if (!sous.impose && sous.options.length > 0) {
    if (sous.genre === "spell") {
      const candidats: CandidatSort[] = sous.options.map((o) => ({ cle: o.cle, nom: o.libelle ?? ctx.nomSort(o.cle), niveau: niveauDuSort(ctx.blocsSorts[o.cle]) }));
      return (
        <SelecteurSorts
          worldSlug={ctx.worldSlug}
          titre={dansGroupe ? sous.libelle : undefined}
          candidats={candidats}
          blocs={ctx.blocsSorts}
          choisis={sous.choisis}
          max={sous.nombre}
          // Un clic : retire un sort choisi, sinon le choisit (à un seul, il remplace le premier).
          onBasculer={(cle) => onChoisir(sous.choisis.includes(cle) ? sous.choisis.filter((c) => c !== cle) : sous.nombre === 1 ? [cle] : [...sous.choisis, cle])}
          touche={dansGroupe ? touche : undefined}
          onToucher={dansGroupe ? onToucher : undefined}
        />
      );
    }

    if (from?.kind === "ability" && from.spellcasting === true) {
      const options = sous.options.map((o) => o.cle).filter((c): c is Ability => (ABILITIES as readonly string[]).includes(c));
      const effets = spellAbilityEffects(ctx.sheet, options);
      const deClasse = ctx.caracsDeClasse.find((a) => options.includes(a));
      const signalee = bestSpellAbility(effets, deClasse);
      return (
        <ChoixCaracIncantation
          sous={sous}
          effets={effets}
          signalee={signalee}
          deLaClasse={signalee !== null && signalee === deClasse}
          libelleOption={libelleOption}
          onChoisir={onChoisir}
        />
      );
    }

    if (from?.kind === "skill" && from.expertise !== true) {
      const competences = sous.options.map((o) => o.cle).filter((c): c is Skill => (SKILLS as readonly string[]).includes(c));
      return <ChoixCompetence sous={sous} effets={skillChoiceEffects(ctx.sheet, competences, `choice:${sous.cle}`)} libelleOption={libelleOption} onChoisir={onChoisir} />;
    }

    if (estTableauComparatif(from)) {
      return <TableauOptions sous={sous} colonnes={colonnesComparatives(from.options, ctx.nomSort)} onChoisir={onChoisir} />;
    }
  }

  return <ChoixGenerique sous={sous} libelleOption={libelleOption} dejaAcquis={ctx.dejaAcquis(sous)} onChoisir={onChoisir} />;
}
