"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type {
  BackgroundEquipmentOption,
  BlockType,
  ClassBasicsBlockData,
  ClassEquipmentBlockData,
  SubclassSlotBlockData,
} from "@/src/core/schemas/rule-blocks";
import { exceedsLevelCap } from "@/src/core/rules/characterRules";
import { renderBlockData, type EquipmentCardInteraction } from "@/components/rules/blockContentRenderer";
import Checkbox from "@/components/shared/Checkbox";
import type { ProgressionEmplacement } from "@/lib/ui/progressionsPersonnage";
import type { LigneProgression } from "@/lib/ui/progressionClasse";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";

const ABILITY_LABELS: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };

export interface ClassEquipmentChoiceState {
  optionLabel: string;
  appliedGold: { value: number; unit: string } | null;
}

/** Le contrôle des prérequis de multiclassage (V3.1-115), calculé par l'assistant qui connaît les caractéristiques. */
export interface ControlePrerequis {
  /** Une phrase par classe dont le prérequis manque. */
  lignes: string[];
  /** Montée de niveau : le serveur refuse. Création : seulement signalé. */
  bloquant: boolean;
  /** Le MJ peut passer outre ; la joueuse voit le refus. */
  estMj: boolean;
  passeOutre: boolean;
  onPasserOutre: (valeur: boolean) => void;
}

function findBlock<T>(blocks: RuleEntryBlockData[] | undefined, blockType: string): T | null {
  const found = blocks?.find((b) => b.blockType === blockType);
  return found ? (found.data as T) : null;
}

const NIVEAUX_RAPIDES = [1, 5, 10, 15];

const STYLE_LIGNE: Record<LigneProgression["etat"], { ligne: string; numero: string }> = {
  acquis: { ligne: "border-success text-ink", numero: "text-success" },
  atteint: { ligne: "border-accent bg-accent/10 text-ink", numero: "text-accent" },
  nouveau: { ligne: "border-accent bg-accent/10 text-ink", numero: "text-accent" },
  avenir: { ligne: "border-edge text-ink-soft opacity-50", numero: "text-ink-muted" },
};

type Panneau = { genre: "sousclasse" };

/**
 * Etape Classe (V3.1-51, specs/wiki-liens-et-personnages.md §B8 etendue au
 * multiclassage complet) : en tete, les classes du personnage en
 * emplacements ; l'emplacement choisi ouvre sa progression, une ligne par
 * niveau, et les choix de chaque niveau atteint sont des pastilles sur sa
 * ligne. Le meme ecran sert a la montee de niveau (`niveauxAvant` donne) : les
 * niveaux acquis sont verrouilles, les nouveaux en dore.
 *
 * `class_basics`/`description` viennent de `useRuleEntryBlocks`, jamais du
 * resume fige `ai_digest` des chips — a jour si le MJ edite la fiche. La
 * sous-classe est gatee par `subclass_slot.chosen_at_level` de CETTE classe.
 */
const EQUIPMENT_TAG_PREFIX = "class-equipment:";

export default function LevelClassesStep({
  worldSlug,
  character,
  patchCharacter,
  inventory,
  onUpdateInventory,
  equipmentChoices,
  onChooseEquipmentChoices,
  hideEquipment = false,
  progressions,
  plafondNiveau,
  niveauxAvant,
  controle,
  onAller,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  inventory: InventoryBlockData;
  onUpdateInventory: (data: InventoryBlockData) => void;
  equipmentChoices: (ClassEquipmentChoiceState | null)[];
  onChooseEquipmentChoices: (choices: (ClassEquipmentChoiceState | null)[]) => void;
  /** Montee de niveau (V2-G1) : la premiere classe a deja recu son equipement de depart il y a longtemps — jamais reproposer cette section, meme si la fiche de classe en porte un. */
  hideEquipment?: boolean;
  /** Une progression par emplacement (`progressionsPersonnage`). */
  progressions: (ProgressionEmplacement | null)[];
  /** `level_cap` du ruleset ; absent : aucun plafond invente. */
  plafondNiveau: number | undefined;
  /** Montee de niveau : le niveau de chaque classe avant. Absent : creation. */
  niveauxAvant?: ReadonlyMap<string, number>;
  controle: ControlePrerequis | null;
  /** Ouvre un choix du chemin (`c:<cle>`). */
  onAller: (position: string) => void;
}) {
  const t = useTranslations("creation.classe");
  const tCreation = useTranslations("creation");
  const entries = useWorldRuleEntries(worldSlug);
  const classEntries = entries.filter((e) => e.entryType === "class");
  const subclassEntries = entries.filter((e) => e.entryType === "subclass");

  const selectedSubclassKeys = character.classes
    .map((c) => (c.subclass?.kind === "rule" ? c.subclass.key : null))
    .filter((k): k is string => Boolean(k));
  const neededKeys = [...new Set([...classEntries.map((e) => e.key), ...selectedSubclassKeys])];
  const blocksByKey = useRuleEntryBlocks(worldSlug, neededKeys);

  const totalLevel = character.classes.reduce((sum, c) => sum + c.level, 0);
  const montee = niveauxAvant !== undefined;

  // Emplacement ouvert, panneau ouvert sous la progression (sous-classe, amelioration) et grille des classes.
  const [selectionBrute, setSelection] = useState(0);
  const [panneau, setPanneau] = useState<Panneau | null>(null);
  const [grilleOuverte, setGrilleOuverte] = useState(false);
  const selection = Math.min(selectionBrute, Math.max(0, character.classes.length - 1));

  // Equipement de depart : seule la PREMIERE classe en accorde a la
  // creation (retour utilisateur, point 9 — meme regle que le jeu reel : le
  // multiclassage ne redonne jamais d'equipement de depart, seule la classe
  // initiale en octroie).
  const firstClassKey = character.classes[0]?.class.kind === "rule" ? character.classes[0].class.key : "";
  const firstClassEquipment = findBlock<ClassEquipmentBlockData>(blocksByKey[firstClassKey], "class_equipment");

  // Membre choisi pour un item "au choix" (retour utilisateur, V2-G1),
  // indexe par `<choiceIndex>:<option.label>:<index d'item>` — plusieurs
  // choix independants par classe (contrairement a l'historique, un seul
  // choix), meme motif que BackgroundStep sinon.
  const [categorySelections, setCategorySelections] = useState<Record<string, string>>({});

  function updateSlot(index: number, patch: Partial<CharacterBlockData["classes"][number]>) {
    patchCharacter({ classes: character.classes.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  }

  function removeSlot(index: number) {
    patchCharacter({ classes: character.classes.filter((_, i) => i !== index) });
    setSelection(0);
    setPanneau(null);
  }

  function addSlot() {
    patchCharacter({ classes: [...character.classes, { class: { kind: "rule", key: "" }, level: 1, subclass: null, hp_rolls: [] }] });
    setSelection(character.classes.length);
    setPanneau(null);
    setGrilleOuverte(true);
  }

  function ouvrirEmplacement(index: number) {
    setSelection(index);
    setPanneau(null);
    setGrilleOuverte(false);
  }

  function selectClass(index: number, key: string, previousKey: string) {
    updateSlot(index, { class: { kind: "rule", key }, subclass: null });
    if (index !== 0 || key === previousKey) return;

    // Changer de premiere classe retire les choix d'equipement (et leur or)
    // de l'ancienne — les objets fixes se reconcilient d'eux-memes plus bas
    // des que la fiche de la nouvelle classe est chargee.
    const items = inventory.items.filter((it) => !it.notes?.startsWith(`${EQUIPMENT_TAG_PREFIX}choice:`));
    const currency = { ...inventory.currency };
    for (const choice of equipmentChoices) {
      if (choice?.appliedGold) {
        const unit = choice.appliedGold.unit as keyof typeof currency;
        if (unit in currency) currency[unit] = Math.max(0, currency[unit] - choice.appliedGold.value);
      }
    }
    onUpdateInventory({ ...inventory, items, currency });
    onChooseEquipmentChoices([]);
    setCategorySelections({});
  }
  function chooseEquipmentOption(choiceIndex: number, option: BackgroundEquipmentOption, overrides?: Record<string, string>) {
    const selections = overrides ?? categorySelections;
    const prior = equipmentChoices[choiceIndex] ?? null;
    let items = inventory.items.filter((it) => it.notes !== `${EQUIPMENT_TAG_PREFIX}choice:${choiceIndex}`);
    const currency = { ...inventory.currency };
    if (prior?.appliedGold) {
      const unit = prior.appliedGold.unit as keyof typeof currency;
      if (unit in currency) currency[unit] = Math.max(0, currency[unit] - prior.appliedGold.value);
    }

    const tag = `${EQUIPMENT_TAG_PREFIX}choice:${choiceIndex}`;
    const newItems: InventoryItem[] = option.items.map((it, i) => {
      const categoryKey = it.category_options?.length ? selections[`${choiceIndex}:${option.label}:${i}`] : undefined;
      const ref =
        it.ref?.kind === "rule" ? { kind: "rule" as const, key: it.ref.key } : categoryKey ? { kind: "rule" as const, key: categoryKey } : undefined;
      return {
        id: `class-choice-${firstClassKey}-${choiceIndex}-${i}`,
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
    const nextChoices = [...equipmentChoices];
    nextChoices[choiceIndex] = { optionLabel: option.label, appliedGold: option.gold ?? null };
    onChooseEquipmentChoices(nextChoices);
  }

  // Objets TOUJOURS accordes par la premiere classe (`class_equipment.fixed`,
  // ex. le Grimoire du Magicien) — reconcilies automatiquement, sans bouton :
  // contrairement a un choix, il n'y a rien a decider. Un `useEffect` plutot
  // qu'un appel direct dans `selectClass` : la fiche de la classe choisie
  // (`blocksByKey`) n'est pas forcement encore chargee au moment du clic,
  // cet effet se redeclenche de lui-meme des qu'elle arrive.
  useEffect(() => {
    if (hideEquipment) return;
    const fixedTag = `${EQUIPMENT_TAG_PREFIX}fixed:${firstClassKey}`;
    const stale = inventory.items.filter((it) => it.notes?.startsWith(`${EQUIPMENT_TAG_PREFIX}fixed:`) && it.notes !== fixedTag);
    const alreadyApplied = inventory.items.some((it) => it.notes === fixedTag);
    const desiredFixed = firstClassEquipment?.fixed ?? [];
    if (stale.length === 0 && (alreadyApplied || desiredFixed.length === 0)) return;

    const items = inventory.items.filter((it) => !it.notes?.startsWith(`${EQUIPMENT_TAG_PREFIX}fixed:`));
    const newItems: InventoryItem[] = alreadyApplied
      ? []
      : desiredFixed.map((it, i) => ({
          id: `class-fixed-${firstClassKey}-${i}`,
          qty: it.quantity,
          notes: fixedTag,
          ...(it.ref?.kind === "rule" ? { ref: { kind: "rule" as const, key: it.ref.key } } : { label: it.label }),
        }));
    onUpdateInventory({ ...inventory, items: [...items, ...newItems] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstClassKey, firstClassEquipment]);

  const plafondAtteint = plafondNiveau !== undefined && exceedsLevelCap(totalLevel + 1, plafondNiveau);

  function nomDeClasse(key: string): string {
    return classEntries.find((e) => e.key === key)?.name ?? key;
  }

  const slot = character.classes[selection];
  const classKey = slot && slot.class.kind === "rule" ? slot.class.key : "";
  const verrouille = classKey !== "" && (niveauxAvant?.has(classKey) ?? false);
  const niveauAvant = verrouille ? (niveauxAvant?.get(classKey) ?? 0) : 0;
  const progression = progressions[selection] ?? null;
  const classBlocks = blocksByKey[classKey];
  const subclassSlot = findBlock<SubclassSlotBlockData>(classBlocks, "subclass_slot");
  const availableSubclasses = subclassEntries.filter((e) => e.parentClassKey === classKey);
  const subclassKey = slot?.subclass?.kind === "rule" ? slot.subclass.key : "";
  const subclassBlocks = blocksByKey[subclassKey];

  // Bornes du niveau de cette classe : jamais sous le niveau d'avant, jamais au-dela du plafond de la classe
  // ni de ce que le plafond du ruleset laisse au personnage une fois les autres classes comptees.
  const niveauMin = Math.max(1, niveauAvant);
  const niveauMaxClasse = progression?.maxNiveau ?? 20;
  const placeRestante = plafondNiveau === undefined ? Infinity : plafondNiveau - (totalLevel - (slot?.level ?? 0));
  const niveauMax = Math.max(niveauMin, Math.min(niveauMaxClasse, placeRestante));

  function reglerNiveau(niveau: number) {
    if (!slot) return;
    const borne = Math.max(niveauMin, Math.min(niveauMax, niveau));
    if (borne !== slot.level) updateSlot(selection, { level: borne });
    setPanneau(null);
  }

  const niveauxRapides = [...new Set([...NIVEAUX_RAPIDES, niveauMaxClasse])].filter((n) => n >= niveauMin && n <= niveauMax).sort((a, b) => a - b);

  function surPastille(genre: "choix" | "sousclasse" | "amelioration", cle: string, niveau: number) {
    if (genre === "choix") onAller(`c:${cle}`);
    else if (genre === "sousclasse") setPanneau((p) => (p?.genre === "sousclasse" ? null : { genre: "sousclasse" }));
    // V3.1-118 : l'amélioration vit dans la sous-étape du don de ce niveau (`<classe>.l<n>.feat`).
    else onAller(`c:${classKey}.l${niveau}.feat`);
  }

  const afficherGrille = slot !== undefined && !verrouille && (classKey === "" || grilleOuverte);
  const usedByOtherSlots = new Set(character.classes.filter((_, i) => i !== selection).map((c) => (c.class.kind === "rule" ? c.class.key : "")));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink">
        {t("niveauTotal", { n: totalLevel })}
        {plafondNiveau !== undefined && <span className="text-ink-muted"> {t("surPlafond", { plafond: plafondNiveau })}</span>}
      </p>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("emplacementsAria")}>
        {character.classes.map((c, index) => {
          const key = c.class.kind === "rule" ? c.class.key : "";
          const gain = c.level - (niveauxAvant?.get(key) ?? 0);
          const retirable = character.classes.length > 1 && !(niveauxAvant?.has(key) ?? false);
          return (
            <span
              key={index}
              className={`inline-flex items-center rounded-2xl border bg-panel-sunken ${index === selection ? "border-accent/70 bg-accent/10" : "border-edge"}`}
            >
              <button
                type="button"
                aria-pressed={index === selection}
                onClick={() => ouvrirEmplacement(index)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left"
              >
                <b className="text-sm text-ink">{key ? nomDeClasse(key) : t("nouvelleClasse")}</b>
                <span className="text-xs text-ink-muted">
                  {t("niveauCourt", { n: c.level })}
                  {montee && gain > 0 ? ` ${t("gain", { n: gain })}` : ""}
                </span>
              </button>
              {retirable && (
                <button
                  type="button"
                  aria-label={t("retirer")}
                  onClick={() => removeSlot(index)}
                  className="pr-2.5 text-sm text-danger transition-colors hover:text-danger/70"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        <button
          type="button"
          disabled={plafondAtteint}
          onClick={addSlot}
          title={plafondAtteint ? t("plafondAtteint", { plafond: plafondNiveau ?? 0 }) : undefined}
          className="rounded-2xl border border-dashed border-edge-strong px-2.5 py-1.5 text-sm text-accent transition-colors hover:bg-panel-raised disabled:opacity-40"
        >
          {t("ajouter")}
        </button>
      </div>

      {controle && controle.lignes.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger">
          <p className="font-semibold">{t("prerequis.titre")}</p>
          <ul className="list-inside list-disc">
            {controle.lignes.map((ligne) => (
              <li key={ligne}>{ligne}</li>
            ))}
          </ul>
          {!controle.bloquant ? (
            <p className="text-ink-muted">{t("prerequis.signale")}</p>
          ) : controle.estMj ? (
            <Checkbox checked={controle.passeOutre} onChange={() => controle.onPasserOutre(!controle.passeOutre)} label={t("prerequis.passerOutre")} />
          ) : (
            <p className="text-ink-muted">{t("prerequis.seulMj")}</p>
          )}
        </div>
      )}

      {slot && (
        <div className="flex flex-col gap-3 rounded-md border border-edge/60 p-3">
          {classKey !== "" && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("niveauDe", { classe: nomDeClasse(classKey) })}</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-panel-sunken px-1.5 py-0.5">
                <button
                  type="button"
                  aria-label={t("moins")}
                  disabled={slot.level <= niveauMin}
                  onClick={() => reglerNiveau(slot.level - 1)}
                  className="h-6 w-6 rounded-full border border-edge-strong bg-panel-raised text-sm text-ink disabled:opacity-40"
                >
                  −
                </button>
                <b className="min-w-8 text-center font-display text-lg text-ink">{slot.level}</b>
                <button
                  type="button"
                  aria-label={t("plus")}
                  disabled={slot.level >= niveauMax}
                  onClick={() => reglerNiveau(slot.level + 1)}
                  className="h-6 w-6 rounded-full border border-edge-strong bg-panel-raised text-sm text-ink disabled:opacity-40"
                >
                  +
                </button>
              </span>
              <span className="flex flex-wrap gap-1">
                {niveauxRapides.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={t("niveauRapide", { n })}
                    onClick={() => reglerNiveau(n)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      n === slot.level ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </span>
              {!verrouille && (
                <button
                  type="button"
                  onClick={() => setGrilleOuverte((o) => !o)}
                  className="ml-auto rounded-full border border-edge px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
                >
                  {t("changerClasse")}
                </button>
              )}
            </div>
          )}

          {plafondNiveau !== undefined && slot.level >= niveauMax && niveauMax < niveauMaxClasse && (
            <p className="text-xs text-ink-muted">{t("plafondAtteint", { plafond: plafondNiveau })}</p>
          )}

          {afficherGrille && (
            <div className="grid grid-cols-2 gap-2 @2xl/creation:grid-cols-4">
              {classEntries
                .filter((e) => e.key === classKey || !usedByOtherSlots.has(e.key))
                .map((e) => {
                  const eBasics = findBlock<ClassBasicsBlockData>(blocksByKey[e.key], "class_basics");
                  const saves = eBasics?.saving_throw_proficiencies.map((a) => ABILITY_LABELS[a] ?? a.toUpperCase()).join("/");
                  const isSelected = e.key === classKey;
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => {
                        selectClass(selection, e.key, classKey);
                        setGrilleOuverte(false);
                        setPanneau(null);
                      }}
                      className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        isSelected ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised hover:bg-panel"
                      }`}
                    >
                      <span className="text-sm font-semibold text-ink">{e.name}</span>
                      {eBasics && (
                        <span className="text-xs text-ink-muted">
                          d{eBasics.hit_die}
                          {saves ? ` · ${t("sauvegardes", { liste: saves })}` : ""}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}

          {classKey !== "" && progression && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-ink-muted">{montee ? t("legendeMontee") : t("legende")}</p>
              <ol className="flex flex-col">
                {progression.lignes.map((l) => {
                  const style = STYLE_LIGNE[l.etat];
                  const modifiable = l.niveau >= niveauMin && l.niveau <= niveauMax;
                  return (
                    <li key={l.niveau} className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 border-l-[3px] px-2 py-1 text-sm ${style.ligne}`}>
                      {modifiable ? (
                        <button
                          type="button"
                          aria-label={t("niveauRapide", { n: l.niveau })}
                          onClick={() => reglerNiveau(l.niveau)}
                          className={`text-left font-display text-base font-bold ${style.numero}`}
                        >
                          {l.niveau}
                        </button>
                      ) : (
                        <span className={`font-display text-base font-bold ${style.numero}`}>{l.niveau}</span>
                      )}
                      <span className="min-w-0">
                        {l.aptitudes.length > 0 ? l.aptitudes.join(", ") : <span className="text-ink-muted">—</span>}
                        {l.etat === "avenir" && l.aVenir.length > 0 && (
                          <span className="block text-xs text-ink-muted">{t("aVenir", { liste: l.aVenir.join(", ") })}</span>
                        )}
                        {l.etat === "acquis" && montee && <span className="sr-only"> {t("verrouille")}</span>}
                      </span>
                      <span className="flex flex-wrap justify-end gap-1">
                        {l.pastilles.map((p) => (
                          <button
                            key={`${p.genre}:${p.cle}`}
                            type="button"
                            onClick={() => surPastille(p.genre, p.cle, l.niveau)}
                            className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs transition-colors ${
                              p.fait ? "border-edge text-ink-muted hover:bg-panel-raised" : "border-accent/60 bg-accent/10 text-accent hover:bg-accent/20"
                            }`}
                          >
                            {p.fait ? "✓ " : ""}
                            {p.libelle}
                            <span className="sr-only"> {p.fait ? tCreation("fait") : tCreation("aFaireUn")}</span>
                          </button>
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {panneau?.genre === "sousclasse" && subclassSlot && (
            <div className="flex flex-col gap-2 rounded-md border border-edge/40 bg-panel-sunken p-2.5">
              <p className="text-sm font-medium text-ink">{subclassSlot.label}</p>
              {availableSubclasses.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {availableSubclasses.map((e) => (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => updateSlot(selection, { subclass: { kind: "rule", key: e.key } })}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        e.key === subclassKey ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                      }`}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-muted">{t("aucuneSousClasse")}</p>
              )}
              {subclassKey && subclassBlocks && subclassBlocks.length > 0 && (
                <div className="flex flex-col gap-2 text-sm text-ink">
                  {subclassBlocks
                    .filter((b) => b.blockType === "description" || b.blockType === "subclass_features")
                    .map((b, i) => (
                      <div key={i}>{renderBlockData(b.blockType as BlockType, b.data, worldSlug)}</div>
                    ))}
                </div>
              )}
            </div>
          )}


          {classKey && classBlocks && classBlocks.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border border-edge/40 bg-panel-sunken p-2.5 text-sm text-ink">
              {classBlocks
                .filter((b) => b.blockType === "description" || b.blockType === "class_basics")
                .map((b, i) => (
                  <div key={i}>{renderBlockData(b.blockType as BlockType, b.data, worldSlug)}</div>
                ))}
            </div>
          )}

          {/* Equipement de depart, uniquement pour la premiere classe
              (retour utilisateur, point 9) : fiche complete (objets fixes
              + chaque choix, deja resolus). Clic direct sur l'encadre de
              chaque choix pour le selectionner (retour utilisateur,
              V2-G1 — remplace les boutons "Choisir A/B" separes), meme
              mecanisme que l'historique (`BackgroundStep`) — un
              `EquipmentCardInteraction` par choix independant. */}
          {selection === 0 && firstClassEquipment && !hideEquipment && (
            <div className="flex flex-col gap-2 rounded-md border border-edge/40 bg-panel-sunken p-2.5 text-sm text-ink">
              {renderBlockData(
                "class_equipment",
                firstClassEquipment,
                worldSlug,
                [],
                firstClassEquipment.choices.map(
                  (_, choiceIndex): EquipmentCardInteraction => ({
                    isChosen: (optionLabel) => equipmentChoices[choiceIndex]?.optionLabel === optionLabel,
                    onSelect: (optionLabel) => {
                      const option = firstClassEquipment.choices[choiceIndex]?.options.find((o) => o.label === optionLabel);
                      if (option) chooseEquipmentOption(choiceIndex, option);
                    },
                    categoryChoice: {
                      selectedKey: (optionLabel, itemIndex) => categorySelections[`${choiceIndex}:${optionLabel}:${itemIndex}`] ?? "",
                      onSelectKey: (optionLabel, itemIndex, key) => {
                        const stateKey = `${choiceIndex}:${optionLabel}:${itemIndex}`;
                        const next = { ...categorySelections, [stateKey]: key };
                        setCategorySelections(next);
                        if (equipmentChoices[choiceIndex]?.optionLabel === optionLabel) {
                          const option = firstClassEquipment.choices[choiceIndex]?.options.find((o) => o.label === optionLabel);
                          if (option) chooseEquipmentOption(choiceIndex, option, next);
                        }
                      },
                    },
                  })
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
