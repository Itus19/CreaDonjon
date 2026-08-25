"use client";

import { useEffect, useMemo, useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import { SKILLS, SKILL_ABILITIES, type Ability, type DerivedSheet } from "@/src/core/rules/sheet";
import { XP_LEVEL_THRESHOLDS } from "@/src/core/rules/experience";
import type { RuntimeState } from "@/src/core/schemas/runtimeState";
import type { AdvantageState } from "@/src/core/rules/action";
import type { TraceStep } from "@/src/core/formula/evaluate";
import { useCharacterSheetContext } from "./useCharacterSheetContext";
import { useReferenceChips, refIdentity } from "./useReferenceChips";
import Dropdown from "@/components/shared/Dropdown";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import CharacterSheetHeader from "./CharacterSheetHeader";
import ActionsTab, { type PreparedSpellView } from "./ActionsTab";
import MagicTab, { type KnownSpellView } from "./MagicTab";
import InventoryTab from "./InventoryTab";
import TraitsTab from "./TraitsTab";
import WeaponMasteryTab from "./WeaponMasteryTab";
import { toggleChoice } from "./characterChoiceUtils";

export const ABILITY_LABELS: Record<Ability, string> = {
  str: "FOR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "SAG",
  cha: "CHA",
};

/** Compétences triées par libellé FR (V1-C4 suite) — même ordre que la référence visuelle fournie par l'utilisateur. Exportée pour `RemainingChoicesStep.tsx` (assistant de création, V2-G1) — même esthétique, jamais un deuxième tri recalculé. */
export const SORTED_SKILLS = [...SKILLS].sort((a, b) => SKILL_LABELS_FR[a].localeCompare(SKILL_LABELS_FR[b]));

type Tab = "actions" | "magie" | "inventaire" | "traits" | "maitrise";

/** Libelles d'onglet (retour utilisateur, V2-G1) : "maitrise" seule ne suffit pas comme les autres onglets a un seul mot, la classe `capitalize` (par mot) l'aurait rendu "Maîtrise D'armes". */
const TAB_LABELS: Record<Tab, string> = {
  actions: "Actions",
  magie: "Magie",
  inventaire: "Inventaire",
  traits: "Traits",
  maitrise: "Maîtrise d'armes",
};

export interface RollLogEntry {
  id: string;
  label: string;
  total: number;
  trace: TraceStep[];
  isCritical?: boolean;
  isCriticalFail?: boolean;
}

interface SheetApiResponse {
  sheet: DerivedSheet;
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
 * `campaignId` : `null` depuis la fiche du wiki (rien ne lie une page
 * d'entite a une campagne dans l'URL) — les jets y sont des essais non
 * enregistres (specs §A1). Une vraie campagne (V1-E4 suite, ecran
 * Initiative, retour utilisateur : "utiliser le bloc qu'on vient de
 * construire... ouvre leur fiche de personnage") passe l'id reel : mêmes
 * routes `/api/entities/[id]/actions/*`, deja prevues pour les deux
 * (`campaignId` accepte `null`, cf. `resolveCharacterActionContext`) —
 * aucun branchement supplementaire cote serveur.
 *
 * Mise en page (V1-C4 suite, sur retour utilisateur avec captures d'ecran de
 * reference) : colonne gauche persistante (caracteristiques + competences,
 * visible quel que soit l'onglet actif) + fenetre a onglets a droite
 * (Actions/Inventaire/Magie/Traits — ordre revu sur retour utilisateur, la
 * Magie place naturellement apres l'Inventaire), au lieu d'un seul bloc qui remplacait
 * tout son contenu par onglet. Empile en une colonne sous `md` pour
 * preserver la lisibilite a 375px (critere deja acquis en V1-B5).
 *
 * V2-G5 : decoupe en en-tete (`CharacterSheetHeader.tsx`) + un composant par
 * onglet (`ActionsTab`/`MagicTab`/`InventoryTab`/`TraitsTab.tsx`) — pur
 * decoupage, aucun changement de comportement. Ce fichier reste
 * l'orchestrateur : tout l'etat et les appels serveur restent ici, les
 * enfants ne recoivent que des props deja pretes a afficher.
 */
export default function PlayableCharacterSheet({
  worldSlug,
  entityId,
  campaignId,
  character,
  inventory,
  spellcasting,
  resources,
  onUpdateCharacter,
  onUpdateInventory,
  onUpdateSpellcasting,
}: {
  worldSlug: string;
  entityId: string;
  campaignId: string | null;
  character: CharacterBlockData;
  inventory: InventoryBlockData | undefined;
  spellcasting: SpellcastingBlockData | undefined;
  resources: ResourcesBlockData | undefined;
  onUpdateCharacter: (data: CharacterBlockData) => void;
  onUpdateInventory: (data: InventoryBlockData) => void;
  onUpdateSpellcasting: (data: SpellcastingBlockData) => void;
}) {
  const [tab, setTab] = useState<Tab>("actions");
  const [advantage, setAdvantage] = useState<AdvantageState>("normal");
  const [remote, setRemote] = useState<SheetApiResponse | null>(null);
  const [rollLog, setRollLog] = useState<RollLogEntry[]>([]);
  const [pendingCrit, setPendingCrit] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xpDelta, setXpDelta] = useState("");
  const [hpDelta, setHpDelta] = useState("");

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

  /**
   * Fiche derivee + ruleset resolu (V1-C18) : extrait dans un hook partage
   * (`useCharacterSheetContext.ts`) — `InventoryBlockEditor` en a besoin pour
   * afficher le meme onglet Inventaire quand l'entite a aussi un bloc
   * `character`, sans dupliquer le moteur `characterSheet` (7 couches de
   * modificateurs — une deuxieme implementation, meme approximative,
   * diverge tot ou tard).
   */
  const {
    remainingChoices,
    proficiencies,
    equipment,
    weaponByKey,
    weight,
    cost,
    spellLevels,
    isMonk,
    sheet,
    traits,
    traitChips,
    traitSourceLabel,
    skillChoices,
    languageChoices,
    allLanguages,
    itemChips,
    equippedWeapons,
    buildChips,
    weaponMasteryChips,
    masteredWeaponKeys,
  } = useCharacterSheetContext(worldSlug, character, inventory, spellcasting);

  const weaponMasteryChoices = remainingChoices.filter((c) => c.kind === "weapon_mastery");

  const knownSpellRefs = useMemo(
    () => (spellcasting?.known ?? []).map((k) => k.ref),
    [spellcasting]
  );
  const spellChips = useReferenceChips(worldSlug, knownSpellRefs);

  /** Tri par niveau puis ordre alphabetique (V1-C6) — niveau resolu via `spellLevels` (0 par defaut si non resolu, ex. reference cassee). */
  const sortedKnownSpells: KnownSpellView[] = useMemo(() => {
    return (spellcasting?.known ?? [])
      .map((known) => {
        const chip = spellChips.get(refIdentity(known.ref));
        const label = chip?.found ? chip.name : known.ref.kind === "rule" ? known.ref.key : known.ref.id;
        const level = known.ref.kind === "rule" ? spellLevels[known.ref.key] ?? 0 : 0;
        return { known, label, level };
      })
      .sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
  }, [spellcasting, spellChips, spellLevels]);

  const preparedSpells: PreparedSpellView[] = sortedKnownSpells
    .filter((s) => s.known.ref.kind === "rule" && (spellcasting?.prepared ?? []).includes(s.known.ref.key))
    .map((s) => ({ ref: s.known.ref, label: s.label }));

  function togglePrepared(key: string) {
    if (!spellcasting) return;
    const prepared = spellcasting.prepared.includes(key)
      ? spellcasting.prepared.filter((k) => k !== key)
      : [...spellcasting.prepared, key];
    onUpdateSpellcasting({ ...spellcasting, prepared });
  }

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

  async function changeExhaustion(delta: number) {
    patchRuntimeState((state) => ({ ...state, exhaustion: Math.max(0, Math.min(6, state.exhaustion + delta)) }));
    await postAction("exhaustion", { campaignId, delta });
    reloadRemote();
  }

  /** Champ + boutons (V1-C4 suite, sur retour utilisateur) : remplace les anciens boutons a montant fixe (+100) — on tape le montant une fois, "+"/"-" l'appliquent puis vident le champ. Un champ laisse vide vaut 1 (sur retour utilisateur) plutot que de ne rien faire. */
  function applyXpDelta(sign: 1 | -1) {
    const amount = xpDelta.trim() === "" ? 1 : Math.abs(Math.trunc(Number(xpDelta)));
    if (!amount) return;
    changeXp(sign * amount);
    setXpDelta("");
  }

  /** Meme motif que `applyXpDelta` (V1-C4 suite, sur retour utilisateur) : remplace les boutons +1/-1 par un champ + boutons, coherent avec l'XP. */
  function applyHpDelta(sign: 1 | -1) {
    const amount = hpDelta.trim() === "" ? 1 : Math.abs(Math.trunc(Number(hpDelta)));
    if (!amount) return;
    changeHp(sign * amount);
    setHpDelta("");
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

  const exhaustion = runtimeState?.exhaustion ?? 0;
  const hpCurrent = runtimeState?.hp.current ?? hpMax;
  const hpPct = hpMax > 0 ? Math.min(100, Math.max(0, (hpCurrent / hpMax) * 100)) : 0;
  const hpLow = hpMax > 0 && hpCurrent / hpMax <= 0.25;

  const totalLevel = Math.max(1, character.classes.reduce((sum, c) => sum + c.level, 0));
  const levelIndex = Math.min(totalLevel, XP_LEVEL_THRESHOLDS.length) - 1;
  const xpFloor = XP_LEVEL_THRESHOLDS[levelIndex] ?? 0;
  const xpCeiling = XP_LEVEL_THRESHOLDS[levelIndex + 1] ?? xpFloor;
  const xpCurrent = runtimeState?.xp ?? 0;
  const xpPct = xpCeiling > xpFloor ? Math.min(100, Math.max(0, ((xpCurrent - xpFloor) / (xpCeiling - xpFloor)) * 100)) : 100;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-edge/60 bg-panel-raised p-3">
      <CharacterSheetHeader
        worldSlug={worldSlug}
        character={character}
        patchCharacter={patchCharacter}
        updateClass={updateClass}
        removeClass={removeClass}
        addClass={addClass}
        buildChips={buildChips}
        refIdentity={refIdentity}
        sheet={sheet}
        busy={busy}
        exhaustion={exhaustion}
        onChangeExhaustion={changeExhaustion}
        hpCurrent={hpCurrent}
        hpMax={hpMax}
        hpLow={hpLow}
        hpPct={hpPct}
        hpDelta={hpDelta}
        setHpDelta={setHpDelta}
        applyHpDelta={applyHpDelta}
        xpCurrent={xpCurrent}
        xpCeiling={xpCeiling}
        xpPct={xpPct}
        totalLevel={totalLevel}
        xpLevelThresholdsLength={XP_LEVEL_THRESHOLDS.length}
        xpDelta={xpDelta}
        setXpDelta={setXpDelta}
        applyXpDelta={applyXpDelta}
        onRest={rest}
        onExportJson={exportJson}
        error={error}
      />

      <div className="flex flex-col gap-4 md:flex-row">
        <aside className="flex flex-col gap-3 md:w-48 md:shrink-0">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Caractéristiques</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ABILITY_LABELS) as Ability[]).map((ability) => {
                const save = sheet.savingThrows[ability];
                return (
                  <div key={ability} className="flex flex-col items-center gap-1 rounded-lg border border-edge/60 bg-panel-raised px-2 py-2.5 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{ABILITY_LABELS[ability]}</span>
                    <span className="text-xl font-bold text-ink">
                      {sheet.abilities[ability].mod >= 0 ? "+" : ""}
                      {sheet.abilities[ability].mod}
                    </span>
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
                      className="w-10 rounded-full border border-edge bg-panel-sunken px-1 py-0.5 text-center text-xs text-ink-muted outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span
                      className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        save.proficient ? "border-accent bg-accent/20 text-accent" : "border-edge text-ink-muted"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${save.proficient ? "bg-accent" : "bg-edge"}`} aria-hidden="true" />
                      Sauv. {save.mod >= 0 ? "+" : ""}
                      {save.mod}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
              Compétences · maîtrise {sheet.proficiencyBonus >= 0 ? "+" : ""}
              {sheet.proficiencyBonus}
            </span>
            {remainingChoices.some((c) => c.kind === "skill") && (
              <div className="flex flex-col gap-0.5">
                {remainingChoices
                  .filter((c) => c.kind === "skill")
                  .map((choice) => {
                    const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
                    return (
                      <p key={choice.id} className="text-xs text-ink-muted">
                        {choice.label} : {chosen.length}/{choice.count} choisie(s) — cliquez les ronds clairs ci-dessous
                      </p>
                    );
                  })}
              </div>
            )}
            <div className="flex flex-col gap-1">
              {SORTED_SKILLS.map((skill) => {
                const result = sheet.skills[skill];
                const choice = skillChoices.get(skill);
                const chosenForChoice = choice ? ((character.choices[choice.id] as string[] | undefined) ?? []) : [];
                const isChosen = choice ? chosenForChoice.includes(skill) : false;
                // Deja maitrisee par une autre source (retour utilisateur,
                // V2-G1) : voir le commentaire jumeau dans
                // `RemainingChoicesStep.tsx` (assistant de creation), meme
                // logique ici pour un choix de competence encore ouvert sur
                // la fiche jouable (montee de niveau future).
                const alreadyGrantedElsewhere = choice ? !isChosen && result.proficiency !== "none" : false;
                const canPick = choice ? isChosen || (chosenForChoice.length < choice.count && !alreadyGrantedElsewhere) : false;

                function toggle() {
                  if (!choice) return;
                  patchCharacter({ choices: { ...character.choices, [choice.id]: toggleChoice(chosenForChoice, skill, choice.count) } });
                }

                const dotClass = choice
                  ? isChosen
                    ? "bg-accent"
                    : alreadyGrantedElsewhere
                      ? "border border-accent bg-accent/40"
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
                    : alreadyGrantedElsewhere
                      ? "Déjà maîtrisée par une autre source — choisissez une compétence différente"
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
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center" title={dotTitle}>
                        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                      </span>
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
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex gap-1 border-b border-edge/60 text-xs">
            {(["actions", "inventaire", "magie", "traits", "maitrise"] as Tab[])
              .filter((t) => (t !== "magie" || spellcasting) && (t !== "maitrise" || weaponMasteryChoices.length > 0))
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-t-md px-3 py-1.5 transition-colors ${
                    tab === t ? "border-b-2 border-accent text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
          </div>

          {tab === "maitrise" && (
            <WeaponMasteryTab
              choices={weaponMasteryChoices}
              chips={weaponMasteryChips}
              characterChoices={character.choices}
              onChangeChoices={(choices) => patchCharacter({ choices })}
            />
          )}

          {tab === "actions" && (
            <ActionsTab
              worldSlug={worldSlug}
              busy={busy}
              advantage={advantage}
              setAdvantage={setAdvantage}
              equippedWeapons={equippedWeapons}
              itemChips={itemChips}
              weaponByKey={weaponByKey}
              masteredWeaponKeys={masteredWeaponKeys}
              strMod={sheet.abilities.str.mod}
              dexMod={sheet.abilities.dex.mod}
              proficiencyBonus={sheet.proficiencyBonus}
              isMonk={isMonk}
              onAttack={attack}
              onDamage={damage}
              spellcasting={spellcasting}
              preparedSpells={preparedSpells}
              spellSlots={sheet.spellcasting?.slots ?? {}}
              spellSlotsUsed={runtimeState?.spell_slots_used ?? {}}
              onCast={cast}
              resources={resources}
              resourcesUsed={runtimeState?.resources ?? {}}
              onChangeResource={changeResource}
              rollLog={rollLog}
            />
          )}

          {tab === "magie" && spellcasting && (
            <MagicTab
              worldSlug={worldSlug}
              sortedKnownSpells={sortedKnownSpells}
              spellChips={spellChips}
              spellcasting={spellcasting}
              onTogglePrepared={togglePrepared}
            />
          )}

          {tab === "inventaire" && (
            <InventoryTab
              worldSlug={worldSlug}
              inventory={inventory}
              onUpdateInventory={onUpdateInventory}
              strMod={sheet.abilities.str.mod}
              dexMod={sheet.abilities.dex.mod}
              proficiencyBonus={sheet.proficiencyBonus}
              isMonk={isMonk}
              weaponByKey={weaponByKey}
              equipment={equipment}
              weight={weight}
              cost={cost}
              encumbrance={sheet.encumbrance}
            />
          )}

          {tab === "traits" && (
            <TraitsTab
              traits={traits}
              traitChips={traitChips}
              traitSourceLabel={traitSourceLabel}
              proficiencies={proficiencies}
              languageChoices={languageChoices}
              character={character}
              patchCharacter={patchCharacter}
              allLanguages={allLanguages}
            />
          )}
        </div>
      </div>
    </div>
  );
}
