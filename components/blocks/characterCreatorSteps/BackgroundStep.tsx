"use client";

import { useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import { useTranslations } from "next-intl";
import type { BackgroundBlockData, BackgroundEquipmentOption } from "@/src/core/schemas/rule-blocks";
import { ABILITIES, ABILITY_LABELS as ABILITY_NAMES, type Ability, type Skill } from "@/src/core/rules/sheet";
import { parseBackgroundAbilityBonusChoice, type BackgroundAbilityBonusChoice } from "@/src/core/rules/backgroundAbilityBonus";
import { CURRENCY_LABELS_FR, SKILL_LABELS_FR } from "@/src/i18n/fr";
import { libelleMaitrise } from "@/lib/ui/maitrises";
import type { SousEtape } from "@/lib/ui/cheminCreation";
import FicheSelection, { type LigneFiche } from "../characterCreator/FicheSelection";
import ValeursHistorique from "../characterCreator/ValeursHistorique";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";

export interface BackgroundEquipmentChoice {
  backgroundKey: string;
  optionLabel: string;
  appliedGold: { value: number; unit: string } | null;
}

function findBlock<T>(blocks: RuleEntryBlockData[] | undefined, blockType: string): T | null {
  const found = blocks?.find((b) => b.blockType === blockType);
  return found ? (found.data as T) : null;
}

function withoutAbilityBonusChoice(choices: CharacterBlockData["choices"]): CharacterBlockData["choices"] {
  if (!(ABILITY_BONUS_CHOICE_KEY in choices)) return choices;
  const rest = { ...choices };
  delete rest[ABILITY_BONUS_CHOICE_KEY];
  return rest;
}

interface BackgroundCardInfo {
  featName: string | null;
  abilities: Ability[];
  toolLine: string | null;
  skillsLine: string | null;
}

/**
 * Don lie, valeurs de caracteristique, maitrise d'outil et maitrises de
 * competence d'un historique, pour les afficher directement sur son bouton
 * (retour utilisateur, V2-G1 — meme demande que pour les boutons d'espece,
 * `SpeciesStep.tsx`). `feat_name` vient de la resolution serveur
 * (`listRuleEntryBlocksByKeys`, ResolvedBackgroundBlockData) deja appliquee
 * a ce bloc — jamais recalculee ici, seulement lue.
 */
function backgroundCardInfo(blocks: RuleEntryBlockData[] | undefined): BackgroundCardInfo | null {
  const data = findBlock<BackgroundBlockData & { feat_name?: string }>(blocks, "background");
  if (!data) return null;
  return {
    featName: data.feat_name ?? null,
    abilities: data.ability_scores.filter((a): a is Ability => (ABILITIES as readonly string[]).includes(a)),
    toolLine: data.tool_proficiency ? libelleMaitrise({ key: data.tool_proficiency, name: data.tool_proficiency }) : null,
    skillsLine: data.skill_proficiencies.map((s) => SKILL_LABELS_FR[s as Skill] ?? s).join(", "),
  };
}

const TAG_PREFIX = "background:";
const ABILITY_BONUS_CHOICE_KEY = "background.ability_bonus";

const EMPTY_ABILITY_BONUS_CHOICE: BackgroundAbilityBonusChoice = { kind: "background_ability_bonus", increases: {} };

/**
 * Etape 4 (specs/wiki-liens-et-personnages.md §B8) : boutons pour
 * l'historique (meme motif que `SpeciesStep`/`LevelClassesStep`), puis, si sa
 * fiche porte un `equipment_options` (2024 : "choisissez A ou B", jamais
 * juste du texte fige — cf. `zBackgroundBlockData`), le vrai choix
 * d'equipement de depart contre or, absent jusqu'ici (retour utilisateur :
 * l'assistant ignorait completement ce champ pourtant deja modelise).
 *
 * Les objets ajoutes par un choix sont marques (`notes` = "background:<cle
 * historique>:<option>") pour pouvoir les retirer proprement si l'utilisateur
 * change d'avis — jamais une deuxieme fois la meme option, jamais un residu
 * de l'ancienne quand on en choisit une autre. L'or ajoute est retire a
 * l'identique avant d'appliquer le nouveau choix.
 *
 * Selection par clic direct sur l'encadre (retour utilisateur, V2-G1 —
 * remplace les boutons "Choisir A/B" separes) : `equipmentInteraction`
 * rend l'encadre de `Background()` (blockContentRenderer.tsx) cliquable,
 * jamais sur une fiche de regle en lecture seule.
 *
 * Bonus de caracteristique de l'historique (V2-G7, regle 2024) : section a
 * part, sous le contenu existant — jamais sur l'etape Caracteristiques, qui
 * reste independante de l'historique choisi (les trois methodes
 * d'attribution existantes ne lisent aucun historique). Repartition par
 * budget de points (retour utilisateur) : `character.abilities.base` suffit
 * comme reference, `sheet` n'est plus necessaire ici.
 */
export default function BackgroundStep({
  worldSlug,
  character,
  patchCharacter,
  inventory,
  onUpdateInventory,
  choice,
  onChooseOption,
  backgroundAbilityScores,
  valeurs,
  sousEtapes,
  onAller,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  inventory: InventoryBlockData;
  onUpdateInventory: (data: InventoryBlockData) => void;
  choice: BackgroundEquipmentChoice | null;
  onChooseOption: (choice: BackgroundEquipmentChoice | null) => void;
  backgroundAbilityScores: Ability[] | null;
  /** Les caractéristiques calculées par le moteur (`sheet.abilities`), pour les jetons de l'historique. */
  valeurs: Readonly<Record<Ability, { score: number; mod: number }>>;
  /** Les sous-étapes de l'étape Historique, venues du chemin (le don et ses choix). */
  sousEtapes: readonly SousEtape[];
  onAller: (position: string) => void;
}) {
  const t = useTranslations("creation.historique");
  const allEntries = useWorldRuleEntries(worldSlug);
  const entries = allEntries.filter((e) => e.entryType === "background");
  const nomDe = (key: string) => allEntries.find((e) => e.key === key)?.name;
  const blocksByKey = useRuleEntryBlocks(
    worldSlug,
    entries.map((e) => e.key)
  );

  const currentKey = character.background?.kind === "rule" ? character.background.key : "";
  const currentBlocks = blocksByKey[currentKey];
  const backgroundData = findBlock<BackgroundBlockData>(currentBlocks, "background");
  const currentInfo = backgroundCardInfo(currentBlocks);

  // Membre choisi pour un item "au choix" (ex. Symbole sacre -> Amulette, le
  // jeu du Soldat), retour utilisateur V2-G1 — indexe par
  // `<option.label>:<index d'item>`, remis a zero au changement d'historique
  // pour ne jamais heriter une selection d'un autre historique reutilisant les
  // memes labels "A"/"B". Vide (cle absente) tant que le joueur n'a pas
  // explicitement choisi : l'item reste alors un objet generique sans
  // reference.
  const [categorySelections, setCategorySelections] = useState<Record<string, string>>({});

  function select(key: string) {
    const switching = key !== currentKey;
    const nextChoices = switching ? withoutAbilityBonusChoice(character.choices) : character.choices;
    patchCharacter({ background: { kind: "rule", key }, choices: nextChoices });
    if (switching) {
      onChooseOption(null);
      setCategorySelections({});
    }
  }

  function applyOption(option: BackgroundEquipmentOption, overrides?: Record<string, string>) {
    const selections = overrides ?? categorySelections;
    let items: InventoryItem[] = inventory.items.filter((it) => !it.notes?.startsWith(TAG_PREFIX));
    const currency = { ...inventory.currency };

    if (choice?.appliedGold) {
      const unit = choice.appliedGold.unit as keyof typeof currency;
      if (unit in currency) currency[unit] = Math.max(0, currency[unit] - choice.appliedGold.value);
    }

    const tag = `${TAG_PREFIX}${currentKey}:${option.label}`;
    const newItems: InventoryItem[] = option.items.map((it, i) => {
      const categoryKey = it.category_options?.length ? selections[`${option.label}:${i}`] : undefined;
      const ref =
        it.ref?.kind === "rule" ? { kind: "rule" as const, key: it.ref.key } : categoryKey ? { kind: "rule" as const, key: categoryKey } : undefined;
      return {
        id: `bg-${currentKey}-${option.label}-${i}`,
        qty: it.quantity,
        notes: tag,
        ...(ref ? { ref } : { label: it.label }),
      };
    });
    items = [...items, ...newItems];

    if (option.gold) {
      const unit = option.gold.unit as keyof typeof currency;
      if (unit in currency) currency[unit] = (currency[unit] ?? 0) + option.gold.value;
    }

    onUpdateInventory({ ...inventory, items, currency });
    onChooseOption({ backgroundKey: currentKey, optionLabel: option.label, appliedGold: option.gold ?? null });
  }

  function chooseCategoryMember(option: BackgroundEquipmentOption, itemIndex: number, key: string) {
    const next = { ...categorySelections, [`${option.label}:${itemIndex}`]: key };
    setCategorySelections(next);
    // Reapplique tout de suite si l'option est deja la selection active : l'inventaire reflete le dernier choix sans reclic.
    if (choice?.backgroundKey === currentKey && choice.optionLabel === option.label) applyOption(option, next);
  }

  // Valeurs de caracteristique de l'historique (V2-G7, regle 2024) : section a
  // part, jamais sur l'etape Caracteristiques, qui reste independante de
  // l'historique choisi. Meme donnee qu'avant (`background.ability_bonus`) ;
  // `ValeursHistorique` ne compose que les deux formes officielles (+2/+1,
  // +1/+1/+1), les seules que `isValidBackgroundAbilityBonusChoice` accepte.
  const abilityChoice = parseBackgroundAbilityBonusChoice(character.choices[ABILITY_BONUS_CHOICE_KEY]) ?? EMPTY_ABILITY_BONUS_CHOICE;

  function setIncreases(increases: BackgroundAbilityBonusChoice["increases"]) {
    patchCharacter({ choices: { ...character.choices, [ABILITY_BONUS_CHOICE_KEY]: { kind: "background_ability_bonus", increases } } });
  }

  const ligneFiche: LigneFiche[] = currentInfo
    ? [
        ...(currentInfo.featName ? [{ nom: t("don"), texte: currentInfo.featName }] : []),
        ...(currentInfo.skillsLine ? [{ nom: t("competences"), texte: currentInfo.skillsLine }] : []),
        ...(currentInfo.toolLine ? [{ nom: t("outil"), texte: currentInfo.toolLine }] : []),
      ]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 @lg/creation:grid-cols-3">
        {entries.map((e) => {
          const info = backgroundCardInfo(blocksByKey[e.key]);
          const choisi = e.key === currentKey;
          return (
            <button
              key={e.key}
              type="button"
              aria-pressed={choisi}
              onClick={() => select(e.key)}
              className={`flex min-w-0 flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                choisi ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised hover:bg-panel"
              }`}
            >
              <span className="text-sm font-semibold text-ink">{e.name}</span>
              {info?.featName && <span className="w-full truncate text-xs text-ink-muted">{info.featName}</span>}
            </button>
          );
        })}
      </div>

      {currentKey && (
        <FicheSelection
          titre={entries.find((e) => e.key === currentKey)?.name ?? currentKey}
          resume={currentInfo && currentInfo.abilities.length > 0 ? t("valeursPossibles", { liste: currentInfo.abilities.map((a) => ABILITY_NAMES[a]).join(", ") }) : null}
          lignes={ligneFiche}
          naissent={sousEtapes}
          onAller={onAller}
        />
      )}

      {currentKey && backgroundAbilityScores && backgroundAbilityScores.length === 3 && (
        <ValeursHistorique abilities={backgroundAbilityScores} valeurs={valeurs} increases={abilityChoice.increases} onChange={setIncreases} />
      )}

      {currentKey && backgroundData && backgroundData.equipment_options.length > 0 && (
        <section aria-label={t("equipement.titre")} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("equipement.titre")}</h3>
            <span className="text-xs text-ink-muted">{t("equipement.aide")}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 @lg/creation:grid-cols-2">
            {backgroundData.equipment_options.map((option) => {
              const choisie = choice?.backgroundKey === currentKey && choice.optionLabel === option.label;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={choisie}
                  onClick={() => applyOption(option)}
                  className={`flex flex-col gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    choisie ? "border-accent bg-accent/10" : "border-edge bg-panel-sunken hover:bg-panel-raised"
                  }`}
                >
                  <span className={`font-semibold ${choisie ? "text-accent" : "text-ink"}`}>{t("equipement.option", { nom: option.label })}</span>
                  {option.items.length > 0 && (
                    <ul className="flex flex-col gap-0.5 text-ink-soft">
                      {option.items.map((it, i) => {
                        const nom = it.ref?.kind === "rule" ? (nomDe(it.ref.key) ?? it.label) : it.label;
                        const membre = it.category_options?.length ? categorySelections[`${option.label}:${i}`] : undefined;
                        return (
                          <li key={i}>
                            {it.quantity > 1 ? `${it.quantity} × ` : ""}
                            {membre ? (nomDe(membre) ?? nom) : nom}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {option.gold && (
                    <span className="text-ink-soft">
                      {option.gold.value} {CURRENCY_LABELS_FR[option.gold.unit] ?? option.gold.unit}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Un objet « au choix » (le jeu du Soldat, le symbole sacré de l'Acolyte) : ses membres en cartes, une fois l'option retenue. */}
          {backgroundData.equipment_options.flatMap((option) =>
            choice?.backgroundKey === currentKey && choice.optionLabel === option.label
              ? option.items.flatMap((it, i) =>
                  it.category_options?.length
                    ? [
                        <div key={`${option.label}:${i}`} className="flex flex-col gap-1.5">
                          <span className="text-xs text-ink-muted">{t("equipement.aChoisir", { objet: it.label })}</span>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
                            {it.category_options.map((m) => {
                              const cle = m.kind === "rule" ? m.key : "";
                              const choisi = categorySelections[`${option.label}:${i}`] === cle;
                              return (
                                <button
                                  key={cle}
                                  type="button"
                                  aria-pressed={choisi}
                                  disabled={!cle}
                                  onClick={() => chooseCategoryMember(option, i, cle)}
                                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                    choisi ? "border-accent bg-accent/10 font-semibold text-accent" : "border-edge bg-panel-sunken text-ink hover:bg-panel-raised"
                                  }`}
                                >
                                  {nomDe(cle) ?? cle}
                                </button>
                              );
                            })}
                          </div>
                        </div>,
                      ]
                    : []
                )
              : []
          )}
        </section>
      )}
    </div>
  );
}
