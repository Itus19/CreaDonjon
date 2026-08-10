"use client";

import { useEffect, useMemo, useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import {
  characterSheet,
  type Ability,
  type CharacterBuild,
  type DerivedSheet,
  type EquippedItem,
  type ResolvedFeature,
} from "@/src/core/rules/sheet";
import { armorAcModifier, mapChosenSkillModifiers, type WeaponData } from "@/src/core/rules/srdMapping";
import { evaluate, type TraceStep } from "@/src/core/formula/evaluate";
import type { RuntimeState } from "@/src/core/schemas/runtimeState";
import type { AdvantageState } from "@/src/core/rules/action";
import { useResolvedRuleset, type RemainingChoiceView } from "./useResolvedRuleset";
import { useReferenceChips, refIdentity } from "./useReferenceChips";
import RuleChip from "@/components/rules/RuleChip";
import ReferenceChipDisplay from "./ReferenceChipDisplay";
import InventoryBlockEditor, { itemLabel, itemRef } from "./InventoryBlockEditor";
import RuleEntryAutocomplete from "./RuleEntryAutocomplete";
import Dropdown from "@/components/shared/Dropdown";
import ActionsMenu from "@/components/shared/ActionsMenu";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import { SKILLS, SKILL_ABILITIES } from "@/src/core/rules/sheet";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "FOR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "SAG",
  cha: "CHA",
};

/** Compétences triées par libellé FR (V1-C4 suite) — même ordre que la référence visuelle fournie par l'utilisateur. */
const SORTED_SKILLS = [...SKILLS].sort((a, b) => SKILL_LABELS_FR[a].localeCompare(SKILL_LABELS_FR[b]));

const RECHARGE_LABELS: Record<string, string> = {
  short_rest: "repos court",
  long_rest: "repos long",
  dawn: "à l'aube",
  never: "jamais",
};

const SPECIES_TYPES = ["species"] as const;
const BACKGROUND_TYPES = ["background"] as const;
const CLASS_TYPES = ["class"] as const;
const SUBCLASS_TYPES = ["subclass"] as const;

const GENDER_OPTIONS = [
  { value: "unspecified", label: "Non précisé" },
  { value: "feminine", label: "Féminin" },
  { value: "masculine", label: "Masculin" },
  { value: "neutral", label: "Neutre" },
  { value: "custom", label: "Personnalisé" },
];

/** `unspecified` (on ne sait pas) et `neutral` (ni l'un ni l'autre) restent deux valeurs distinctes du menu — jamais fusionnees (V1-C4). */
function genderDropdownValue(gender: CharacterBlockData["gender"]): string {
  if (!gender) return "unspecified";
  if (typeof gender === "object") return "custom";
  return gender;
}

function ruleRef(key: string): BlockReference | null {
  return key.trim() ? { kind: "rule", key: key.trim() } : null;
}

type Tab = "actions" | "magie" | "inventaire" | "traits";

function toggleChoice(current: string[], option: string, max: number): string[] {
  if (current.includes(option)) return current.filter((o) => o !== option);
  if (current.length >= max) return current;
  return [...current, option];
}

function resourceMax(tracker: { max: { formula: import("@/src/core/formula/ast").FormulaNode } }): number {
  const neverRolls = { nextInt: () => { throw new Error("le mode max n'appelle jamais le RNG"); } };
  try {
    return evaluate(tracker.max.formula, {}, neverRolls, "max").value;
  } catch {
    return 0;
  }
}

interface RollLogEntry {
  id: string;
  label: string;
  total: number;
  trace: TraceStep[];
  isCritical?: boolean;
  isCriticalFail?: boolean;
}

interface SheetApiResponse {
  sheet: DerivedSheet;
  weaponByKey: Record<string, WeaponData | null>;
  hitDiceTotals: Record<string, number>;
  runtimeState: { state: RuntimeState; hpMax: number; hitDiceTotals: Record<string, number> };
}

/**
 * Fiche de personnage jouable (V1-B5, specs/fiche-personnage-interactive.md).
 * Remplace `CharacterSheetPreview` (V1-B4) : le calcul d'affichage en direct
 * (CA/PV max/aptitudes/choix restants) reste le meme, cote client, pour la
 * reactivite immediate (§B4 "se recalcule a chaque modification"). Tout ce
 * qui touche au jeu (attaque, sort, repos, PV courants) passe par
 * `/api/entities/[id]/actions/*` et `/api/entities/[id]/sheet` — le serveur
 * relance ses propres calculs, jamais confiance dans un nombre envoye par
 * ce composant (CLAUDE.md regle 6 : les des sont lances par le serveur).
 *
 * Decision de perimetre : aucun contexte de campagne n'est encore
 * accessible depuis la fiche du wiki (rien ne lie une page d'entite a une
 * campagne dans l'URL aujourd'hui) — `campaignId` reste `null` ici, les
 * jets sont donc des essais non enregistres (specs §A1). Le brancher sur
 * une vraie campagne est un cablage de navigation a part, pas ce ticket.
 */
export default function PlayableCharacterSheet({
  worldSlug,
  entityId,
  character,
  inventory,
  spellcasting,
  resources,
  onUpdateCharacter,
  onUpdateInventory,
}: {
  worldSlug: string;
  entityId: string;
  character: CharacterBlockData;
  inventory: InventoryBlockData | undefined;
  spellcasting: SpellcastingBlockData | undefined;
  resources: ResourcesBlockData | undefined;
  onUpdateCharacter: (data: CharacterBlockData) => void;
  onUpdateInventory: (data: InventoryBlockData) => void;
}) {
  const campaignId: string | null = null;
  const [tab, setTab] = useState<Tab>("actions");
  const [advantage, setAdvantage] = useState<AdvantageState>("normal");
  const [remote, setRemote] = useState<SheetApiResponse | null>(null);
  const [rollLog, setRollLog] = useState<RollLogEntry[]>([]);
  const [pendingCrit, setPendingCrit] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Onglet Traits (V1-C4 suite) : meme bloc `character` que le reste de la fiche, une seule donnee, plusieurs vues — meme motif que `onUpdateInventory`. */
  function patchCharacter(fields: Partial<CharacterBlockData>) {
    onUpdateCharacter({ ...character, ...fields });
  }

  function updateClass(index: number, patchFields: Partial<CharacterBlockData["classes"][number]>) {
    patchCharacter({ classes: character.classes.map((c, i) => (i === index ? { ...c, ...patchFields } : c)) });
  }

  function removeClass(index: number) {
    patchCharacter({ classes: character.classes.filter((_, i) => i !== index) });
  }

  function addClass() {
    patchCharacter({ classes: [...character.classes, { class: { kind: "rule", key: "" }, level: 1, subclass: null }] });
  }

  const speciesKey = character.species?.kind === "rule" ? character.species.key : undefined;
  const backgroundKey = character.background?.kind === "rule" ? character.background.key : undefined;
  const classSelections = useMemo(
    () =>
      character.classes
        .filter((c) => c.class.kind === "rule" && c.class.key)
        .map((c) => ({ key: (c.class as { kind: "rule"; key: string }).key, level: c.level })),
    [character.classes]
  );
  const equipmentKeys = useMemo(
    () => (inventory?.items ?? []).map(itemRef).filter((r): r is { kind: "rule"; key: string } => r?.kind === "rule").map((r) => r.key),
    [inventory]
  );

  const { ruleset, remainingChoices, equipment } = useResolvedRuleset(worldSlug, {
    species: speciesKey,
    background: backgroundKey,
    classes: classSelections,
    equipmentKeys,
  });

  const dexScore = character.abilities.base.dex;
  const dexMod = Math.floor((dexScore - 10) / 2);

  const equippedItems: EquippedItem[] = useMemo(
    () =>
      (inventory?.items ?? []).map((item) => {
        const ref = itemRef(item);
        const armor = ref?.kind === "rule" ? equipment[ref.key] : null;
        return {
          key: item.id,
          label: itemLabel(item),
          equipped: item.equipped ?? false,
          modifiers: armor ? [armorAcModifier(armor, dexMod, `item:${item.id}`, itemLabel(item))] : [],
        };
      }),
    [inventory, equipment, dexMod]
  );

  const choiceFeatures: Record<string, ResolvedFeature> = {};
  const choiceFeatureKeys: string[] = [];
  for (const choice of remainingChoices) {
    const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
    const key = `choice:${choice.id}`;
    choiceFeatures[key] = { key, label: choice.label, source: "choice", modifiers: mapChosenSkillModifiers(chosen, choice.id, choice.label) };
    choiceFeatureKeys.push(key);
  }

  const build: CharacterBuild = {
    species: speciesKey ?? "",
    classes: character.classes
      .filter((c) => c.class.kind === "rule" && c.class.key)
      .map((c) => ({
        key: (c.class as { kind: "rule"; key: string }).key,
        level: c.level,
        subclass: c.subclass?.kind === "rule" ? c.subclass.key : undefined,
      })),
    abilities: { assigned: character.abilities.base },
    featureKeys: [...Object.keys(ruleset.features), ...choiceFeatureKeys],
  };

  const sheet = characterSheet(
    build,
    { classes: ruleset.classes, features: { ...ruleset.features, ...choiceFeatures } },
    equippedItems,
    []
  );

  const classFeatures = Object.values(ruleset.features).filter((f) => f.source === "class");
  const featureRefs = useMemo(() => classFeatures.map((f) => ({ kind: "rule" as const, key: f.key })), [classFeatures]);
  const featureChips = useReferenceChips(worldSlug, featureRefs);

  const knownSpellRefs = useMemo(
    () => (spellcasting?.known ?? []).map((k) => k.ref),
    [spellcasting]
  );
  const spellChips = useReferenceChips(worldSlug, knownSpellRefs);

  const inventoryRefs = useMemo(
    () => (inventory?.items ?? []).map(itemRef).filter((r): r is NonNullable<ReturnType<typeof itemRef>> => r !== null),
    [inventory]
  );
  const inventoryChips = useReferenceChips(worldSlug, inventoryRefs);

  const buildRefs = useMemo(() => {
    const refs: BlockReference[] = [];
    if (character.species) refs.push(character.species);
    if (character.background) refs.push(character.background);
    for (const c of character.classes) {
      refs.push(c.class);
      if (c.subclass) refs.push(c.subclass);
    }
    return refs;
  }, [character.species, character.background, character.classes]);
  const buildChips = useReferenceChips(worldSlug, buildRefs);

  /**
   * Competences liees a un choix non resolu (V1-C4 suite, sur retour
   * utilisateur) : evite la double UI "Choix restants" + liste de
   * competences — les ronds de la liste deviennent le point d'interaction
   * unique. Toutes les options connues aujourd'hui sont des cles de
   * competence (`extractSkillChoices`, seule source de `remainingChoices`
   * cote serveur) ; si une autre nature de choix apparait plus tard, elle
   * restera simplement invisible ici (aucune competence ne la reference).
   */
  const skillChoices = useMemo(() => {
    const map = new Map<string, RemainingChoiceView>();
    for (const choice of remainingChoices) {
      for (const option of choice.options) {
        if (!map.has(option)) map.set(option, choice);
      }
    }
    return map;
  }, [remainingChoices]);

  async function reloadRemote() {
    const res = await fetch(`/api/entities/${entityId}/sheet?campaignId=${campaignId ?? ""}`);
    if (res.ok) setRemote(await res.json());
  }

  // Chargement initial en ligne (pas d'appel a reloadRemote ici) : le rendu
  // d'effet ne doit jamais appeler une fonction qui pourrait mettre a jour
  // l'etat de facon synchrone du point de vue de l'analyse statique — meme
  // motif que useReferenceChips.ts/useWorldRuleEntries.ts.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entities/${entityId}/sheet?campaignId=${campaignId ?? ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: SheetApiResponse | null) => {
        if (!cancelled && body) setRemote(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entityId, campaignId]);

  function pushLog(entry: Omit<RollLogEntry, "id">) {
    setRollLog((prev) => [{ ...entry, id: crypto.randomUUID() }, ...prev].slice(0, 8));
  }

  async function postAction<T>(path: string, body: unknown): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/${entityId}/actions/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.error ?? "Action impossible.");
        return null;
      }
      if (res.status === 204) return {} as T;
      return (await res.json()) as T;
    } finally {
      setBusy(false);
    }
  }

  async function attack(item: InventoryItem) {
    const result = await postAction<{
      weaponLabel: string;
      attack?: { total: number; isCritical: boolean; isCriticalFail: boolean; trace: TraceStep[] };
    }>("attack", { campaignId, itemId: item.id, advantage });
    if (!result?.attack) return;
    setPendingCrit((prev) => ({ ...prev, [item.id]: result.attack!.isCritical }));
    pushLog({
      label: `${result.weaponLabel} — attaque`,
      total: result.attack.total,
      trace: result.attack.trace,
      isCritical: result.attack.isCritical,
      isCriticalFail: result.attack.isCriticalFail,
    });
  }

  async function damage(item: InventoryItem, versatile: boolean) {
    const critical = pendingCrit[item.id] ?? false;
    const result = await postAction<{ weaponLabel: string; damage?: { total: number; trace: TraceStep[] } }>("damage", {
      campaignId,
      itemId: item.id,
      critical,
      versatile,
    });
    if (!result?.damage) return;
    pushLog({ label: `${result.weaponLabel} — dégâts${critical ? " (critique)" : ""}`, total: result.damage.total, trace: result.damage.trace });
  }

  async function cast(spellKey: string, spellLabel: string, slotLevel: number) {
    const result = await postAction<{ remainingSlots: number; damage?: { total: number; trace: TraceStep[] } }>("cast-spell", {
      campaignId,
      spellKey,
      slotLevel,
    });
    if (!result) return;
    pushLog({
      label: result.damage ? `${spellLabel} (niv. ${slotLevel})` : `${spellLabel} (niv. ${slotLevel}) lancé`,
      total: result.damage?.total ?? 0,
      trace: result.damage?.trace ?? [],
    });
    reloadRemote();
  }

  async function rest(kind: "short" | "long") {
    if (kind === "long") {
      await postAction("long-rest", { campaignId });
    } else {
      await postAction("short-rest", { campaignId, hitDiceSpent: {} });
    }
    reloadRemote();
  }

  /** Reflete le delta immediatement (§4.5 recalcul client) avant meme la reponse serveur — les boutons +/- semblaient lents car rien ne s'affichait avant le second aller-retour (`postAction` puis `reloadRemote`). Le serveur reste la verite : `reloadRemote()` corrige ensuite si besoin. */
  function patchRuntimeState(mutate: (state: RuntimeState) => RuntimeState) {
    setRemote((prev) => (prev ? { ...prev, runtimeState: { ...prev.runtimeState, state: mutate(prev.runtimeState.state) } } : prev));
  }

  async function changeHp(delta: number) {
    patchRuntimeState((state) => ({ ...state, hp: { ...state.hp, current: Math.max(0, state.hp.current + delta) } }));
    await postAction("hp", { campaignId, delta });
    reloadRemote();
  }

  async function changeXp(delta: number) {
    patchRuntimeState((state) => ({ ...state, xp: Math.max(0, state.xp + delta) }));
    await postAction("xp", { campaignId, delta });
    reloadRemote();
  }

  function exportJson() {
    const a = document.createElement("a");
    a.href = `/api/entities/${entityId}/export`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function changeResource(trackerId: string, delta: number) {
    await postAction("resource", { campaignId, trackerId, delta });
    reloadRemote();
  }

  const runtimeState = remote?.runtimeState.state;
  const hpMax = remote?.runtimeState.hpMax ?? sheet.hitPoints.max;
  const weaponByKey = remote?.weaponByKey ?? {};
  const equippedWeapons = (inventory?.items ?? []).filter((item) => {
    if (!item.equipped) return false;
    const ref = itemRef(item);
    return ref?.kind === "rule" && Boolean(weaponByKey[ref.key]);
  });

  const classesLabel = build.classes.map((c) => `${ruleset.classes[c.key]?.label ?? c.key} ${c.level}`).join(" / ");

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-edge/60 bg-panel-raised p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Espèce
            <div className="flex items-center gap-1">
              <div className="w-24">
                <RuleEntryAutocomplete
                  worldSlug={worldSlug}
                  entryTypes={SPECIES_TYPES}
                  value={character.species?.kind === "rule" ? character.species.key : ""}
                  onChange={(key) => patchCharacter({ species: ruleRef(key) })}
                  placeholder="dwarf"
                />
              </div>
              {character.species && (
                <ReferenceChipDisplay reference={character.species} chip={buildChips.get(refIdentity(character.species))} />
              )}
            </div>
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Historique
            <div className="flex items-center gap-1">
              <div className="w-24">
                <RuleEntryAutocomplete
                  worldSlug={worldSlug}
                  entryTypes={BACKGROUND_TYPES}
                  value={character.background?.kind === "rule" ? character.background.key : ""}
                  onChange={(key) => patchCharacter({ background: ruleRef(key) })}
                  placeholder="soldier"
                />
              </div>
              {character.background && (
                <ReferenceChipDisplay reference={character.background} chip={buildChips.get(refIdentity(character.background))} />
              )}
            </div>
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Genre
            <Dropdown
              value={genderDropdownValue(character.gender)}
              options={GENDER_OPTIONS}
              onChange={(v) =>
                patchCharacter({
                  gender:
                    v === "custom"
                      ? { custom: typeof character.gender === "object" ? character.gender.custom : "" }
                      : (v as Exclude<CharacterBlockData["gender"], { custom: string } | undefined>),
                })
              }
              aria-label="Genre"
            />
            {typeof character.gender === "object" && (
              <input
                value={character.gender.custom}
                onChange={(e) => patchCharacter({ gender: { custom: e.target.value } })}
                placeholder="préciser…"
                className="w-24 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
            )}
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Pronoms
            <input
              value={character.pronouns ?? ""}
              onChange={(e) => patchCharacter({ pronouns: e.target.value })}
              placeholder="elle, il, iel…"
              className="w-24 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
          </label>
          {classesLabel && <span className="pb-1.5 text-xs text-ink-muted">{classesLabel}</span>}
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => rest("short")} className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink hover:bg-panel disabled:opacity-50">
            Repos court
          </button>
          <button type="button" disabled={busy} onClick={() => rest("long")} className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink hover:bg-panel disabled:opacity-50">
            Repos long
          </button>
          <ActionsMenu
            label="Exporter"
            triggerClassName="rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel"
            aria-label="Exporter la fiche"
            items={[
              { label: "Exporter en JSON", onSelect: exportJson },
              { label: "Exporter en PDF", onSelect: () => window.print() },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">CA</span>
          <p className="text-lg font-semibold text-ink">{sheet.ac.value}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Initiative</span>
          <p className="text-lg font-semibold text-ink">{sheet.abilities.dex.mod >= 0 ? "+" : ""}{sheet.abilities.dex.mod}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Vitesse</span>
          <p className="text-lg font-semibold text-ink">{sheet.speed.value} m</p>
        </div>
        <div>
          <span className="flex flex-col text-[10px] font-bold uppercase leading-tight tracking-widest text-ink-muted">
            <span>Perception</span>
            <span>passive</span>
          </span>
          <p className="text-lg font-semibold text-ink">{10 + sheet.skills.perception.mod}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Maîtrise</span>
          <p className="text-lg font-semibold text-ink">+{sheet.proficiencyBonus}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">PV</span>
          <p className="flex items-center gap-1 text-lg font-semibold text-ink">
            <button type="button" disabled={busy} onClick={() => changeHp(-1)} className="rounded border border-edge px-1.5 text-xs">−</button>
            {runtimeState?.hp.current ?? hpMax}/{hpMax}
            <button type="button" disabled={busy} onClick={() => changeHp(1)} className="rounded border border-edge px-1.5 text-xs">+</button>
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">XP</span>
          <p className="flex items-center gap-1 text-lg font-semibold text-ink">
            <button type="button" disabled={busy} onClick={() => changeXp(-100)} className="rounded border border-edge px-1.5 text-xs">−100</button>
            {runtimeState?.xp ?? 0}
            <button type="button" disabled={busy} onClick={() => changeXp(100)} className="rounded border border-edge px-1.5 text-xs">+100</button>
          </p>
        </div>
        {(runtimeState?.exhaustion ?? 0) > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-danger">Épuisement</span>
            <p className="text-lg font-semibold text-danger">{runtimeState!.exhaustion}</p>
          </div>
        )}
      </div>

      {sheet.warnings.length > 0 && (
        <div className="rounded-md border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger">
          <p className="font-semibold">Personnage illégal — enregistrable quand même :</p>
          <ul className="list-inside list-disc">
            {sheet.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-1 border-b border-edge/60 text-xs">
        {(["actions", "magie", "inventaire", "traits"] as Tab[])
          .filter((t) => t !== "magie" || spellcasting)
          .map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-t-md px-3 py-1.5 capitalize transition-colors ${
                tab === t ? "border-b-2 border-accent text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
      </div>

      {tab === "actions" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-ink-muted">Prochain jet :</span>
            {(["disadvantage", "normal", "advantage"] as AdvantageState[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAdvantage(a)}
                className={`rounded-full border px-2 py-0.5 ${advantage === a ? "border-accent text-accent" : "border-edge text-ink-muted"}`}
              >
                {a === "normal" ? "normal" : a === "advantage" ? "avantage" : "désavantage"}
              </button>
            ))}
          </div>

          {equippedWeapons.length === 0 && <p className="text-sm text-ink-muted">Aucune arme équipée.</p>}
          {equippedWeapons.map((item) => {
            const ref = itemRef(item);
            const weapon = ref?.kind === "rule" ? weaponByKey[ref.key] : null;
            return (
              <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border border-edge/60 px-2.5 py-1.5 text-sm">
                <span className="font-medium text-ink">{itemLabel(item)}</span>
                <button type="button" disabled={busy} onClick={() => attack(item)} className="rounded-full border border-edge px-2.5 py-1 text-xs hover:bg-panel disabled:opacity-50">
                  Attaquer
                </button>
                <button type="button" disabled={busy} onClick={() => damage(item, false)} className="rounded-full border border-edge px-2.5 py-1 text-xs hover:bg-panel disabled:opacity-50">
                  Dégâts
                </button>
                {weapon?.versatileDamageDice && (
                  <button type="button" disabled={busy} onClick={() => damage(item, true)} className="rounded-full border border-edge px-2.5 py-1 text-xs hover:bg-panel disabled:opacity-50">
                    Dégâts (2 mains)
                  </button>
                )}
              </div>
            );
          })}

          {(resources?.trackers.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Ressources</span>
              {resources!.trackers.map((tracker) => {
                const max = resourceMax(tracker);
                const used = runtimeState?.resources[tracker.id] ?? 0;
                return (
                  <div key={tracker.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-ink">{tracker.label}</span>
                    <span className="text-ink-muted">
                      {Math.max(0, max - used)}/{max} · {RECHARGE_LABELS[tracker.recharge] ?? tracker.recharge}
                    </span>
                    <button type="button" disabled={busy || used >= max} onClick={() => changeResource(tracker.id, 1)} className="rounded border border-edge px-1.5 text-xs disabled:opacity-50">
                      utiliser
                    </button>
                    <button type="button" disabled={busy || used <= 0} onClick={() => changeResource(tracker.id, -1)} className="rounded border border-edge px-1.5 text-xs disabled:opacity-50">
                      annuler
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {rollLog.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-md border border-edge/60 bg-panel-sunken p-2">
              {rollLog.map((entry) => (
                <div key={entry.id} className="text-xs">
                  <p className="text-ink">
                    <span className="font-semibold">{entry.label} : {entry.total}</span>
                    {entry.isCritical && <span className="ml-1 text-accent">critique !</span>}
                    {entry.isCriticalFail && <span className="ml-1 text-danger">échec critique</span>}
                  </p>
                  {entry.trace.length > 0 && <p className="text-ink-muted">{entry.trace.map((s) => s.text).join(" ; ")}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "magie" && spellcasting && (
        <div className="flex flex-col gap-2">
          {(spellcasting.known ?? []).map((known) => {
            const chip = spellChips.get(refIdentity(known.ref));
            const label = chip?.found ? chip.name : known.ref.kind === "rule" ? known.ref.key : known.ref.id;
            return (
              <div key={refIdentity(known.ref)} className="flex flex-wrap items-center gap-2 rounded-md border border-edge/60 px-2.5 py-1.5 text-sm">
                <span className="flex-1 text-ink">{label}</span>
                {Object.entries(sheet.spellcasting?.slots ?? {}).map(([level, total]) => {
                  const used = runtimeState?.spell_slots_used[level] ?? 0;
                  const available = total - used > 0;
                  return (
                    <button
                      key={level}
                      type="button"
                      disabled={busy || !available}
                      title={available ? `Lancer au niveau ${level}` : "Aucun emplacement disponible"}
                      onClick={() => known.ref.kind === "rule" && cast(known.ref.key, label, Number(level))}
                      className="rounded-full border border-edge px-2 py-0.5 text-xs disabled:opacity-30"
                    >
                      niv. {level} ({Math.max(0, total - used)}/{total})
                    </button>
                  );
                })}
              </div>
            );
          })}
          {(spellcasting.known ?? []).length === 0 && <p className="text-sm text-ink-muted">Aucun sort connu.</p>}
        </div>
      )}

      {tab === "inventaire" && (
        <InventoryBlockEditor worldSlug={worldSlug} data={inventory ?? { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } }} onChange={onUpdateInventory} />
      )}

      {tab === "traits" && (
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Classes</span>
            {character.classes.map((c, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 border-b border-edge/40 py-1.5">
                <div className="w-28">
                  <RuleEntryAutocomplete
                    worldSlug={worldSlug}
                    entryTypes={CLASS_TYPES}
                    value={c.class.kind === "rule" ? c.class.key : ""}
                    onChange={(key) => updateClass(index, { class: { kind: "rule", key } })}
                    placeholder="fighter"
                  />
                </div>
                <input
                  type="number"
                  min={1}
                  value={c.level}
                  onChange={(e) => updateClass(index, { level: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                />
                <div className="flex-1">
                  <RuleEntryAutocomplete
                    worldSlug={worldSlug}
                    entryTypes={SUBCLASS_TYPES}
                    value={c.subclass?.kind === "rule" ? c.subclass.key : ""}
                    onChange={(key) => updateClass(index, { subclass: ruleRef(key) })}
                    placeholder="sous-classe (optionnel)"
                  />
                </div>
                <ReferenceChipDisplay reference={c.class} chip={buildChips.get(refIdentity(c.class))} />
                <button type="button" onClick={() => removeClass(index)} className="text-xs text-danger hover:underline">
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addClass}
              className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
            >
              + Ajouter une classe
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Caractéristiques</span>
              <Dropdown
                value={character.abilities.method}
                options={[
                  { value: "standard_array", label: "Tableau standard" },
                  { value: "point_buy", label: "Achat de points" },
                  { value: "roll", label: "Tirage" },
                ]}
                onChange={(v) =>
                  patchCharacter({ abilities: { ...character.abilities, method: v as CharacterBlockData["abilities"]["method"] } })
                }
                aria-label="Méthode d'attribution"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(ABILITY_LABELS) as Ability[]).map((ability) => {
                const save = sheet.savingThrows[ability];
                return (
                  <label key={ability} className="flex flex-col gap-1 text-xs text-ink-muted">
                    {ABILITY_LABELS[ability]} ({sheet.abilities[ability].mod >= 0 ? "+" : ""}
                    {sheet.abilities[ability].mod})
                    <input
                      type="number"
                      value={character.abilities.base[ability]}
                      onChange={(e) =>
                        patchCharacter({
                          abilities: {
                            ...character.abilities,
                            base: { ...character.abilities.base, [ability]: Number(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                    />
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${save.proficient ? "bg-accent" : "bg-edge"}`}
                        aria-hidden="true"
                      />
                      Sauv. {save.mod >= 0 ? "+" : ""}
                      {save.mod}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
              Compétences · maîtrise {sheet.proficiencyBonus >= 0 ? "+" : ""}
              {sheet.proficiencyBonus}
            </span>
            {remainingChoices.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {remainingChoices.map((choice) => {
                  const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
                  return (
                    <p key={choice.id} className="text-xs text-ink-muted">
                      {choice.label} : {chosen.length}/{choice.count} choisie(s) — cliquez les ronds clairs ci-dessous
                    </p>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {SORTED_SKILLS.map((skill) => {
                const result = sheet.skills[skill];
                const choice = skillChoices.get(skill);
                const chosenForChoice = choice ? ((character.choices[choice.id] as string[] | undefined) ?? []) : [];
                const isChosen = choice ? chosenForChoice.includes(skill) : false;
                const canPick = choice ? isChosen || chosenForChoice.length < choice.count : false;

                function toggle() {
                  if (!choice) return;
                  patchCharacter({ choices: { ...character.choices, [choice.id]: toggleChoice(chosenForChoice, skill, choice.count) } });
                }

                const dotClass = choice
                  ? isChosen
                    ? "bg-accent"
                    : canPick
                      ? "border-2 border-ink bg-transparent"
                      : "border border-edge bg-transparent opacity-40"
                  : result.proficiency === "expertise"
                    ? "bg-accent"
                    : result.proficiency === "proficient"
                      ? "border border-accent bg-accent/40"
                      : "border border-edge bg-transparent";

                const dotTitle = choice
                  ? isChosen
                    ? `${choice.label} — choisie, cliquer pour retirer`
                    : canPick
                      ? `${choice.label} — cliquer pour choisir (${chosenForChoice.length}/${choice.count})`
                      : `${choice.label} — choix déjà complet (${choice.count}/${choice.count})`
                  : result.proficiency === "expertise"
                    ? "Expertise"
                    : result.proficiency === "proficient"
                      ? "Maîtrisée"
                      : "Non maîtrisée";

                return (
                  <div key={skill} className="flex items-center gap-2 text-sm">
                    {choice ? (
                      <button
                        type="button"
                        onClick={toggle}
                        disabled={!canPick}
                        title={dotTitle}
                        className="flex h-4 w-4 shrink-0 items-center justify-center disabled:cursor-not-allowed"
                      >
                        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                      </button>
                    ) : (
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} title={dotTitle} />
                    )}
                    <span className="flex-1 text-ink">{SKILL_LABELS_FR[skill]}</span>
                    <span className="text-[10px] uppercase text-ink-muted">{ABILITY_LABELS[SKILL_ABILITIES[skill]]}</span>
                    <span className="w-8 text-right font-medium text-ink">
                      {result.mod >= 0 ? "+" : ""}
                      {result.mod}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">Points de vie</span>
            <Dropdown
              value={character.hp_method}
              options={[
                { value: "fixed", label: "Valeur fixe" },
                { value: "rolled", label: "Jetés" },
              ]}
              onChange={(v) => patchCharacter({ hp_method: v as CharacterBlockData["hp_method"] })}
              aria-label="Méthode de points de vie"
            />
          </div>

          {classFeatures.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Aptitudes accordées</span>
              <div className="flex flex-wrap gap-2">
                {classFeatures.map((f) => {
                  const chip = featureChips.get(refIdentity({ kind: "rule", key: f.key }));
                  return chip?.found ? (
                    <RuleChip key={f.key} href={chip.href} label={chip.name} summary={chip.summary} />
                  ) : (
                    <span key={f.key} className="text-xs italic text-ink-muted">{f.label}</span>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Objets</span>
            <div className="flex flex-wrap gap-2">
              {(inventory?.items ?? []).map((item) => {
                const ref = itemRef(item);
                if (!ref) return <span key={item.id} className="text-xs text-ink-muted">{itemLabel(item)}</span>;
                return <ReferenceChipDisplay key={item.id} reference={ref} chip={inventoryChips.get(refIdentity(ref))} />;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
