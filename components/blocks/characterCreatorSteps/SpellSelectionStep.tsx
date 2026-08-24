"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { AbilityScores } from "@/src/core/schemas/blocks/abilities";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type {
  ClassProgressionBlockData,
  CustomTableBlockData,
  DescriptionBlockData,
  SpellCastingBlockData,
  SpellcastingProgressionBlockData,
} from "@/src/core/schemas/rule-blocks";
import type { Ability } from "@/src/core/rules/sheet";
import { parseCustomTableFields, parseSpellClasses, parseSpellLevel, type CustomTableRow } from "@/src/core/rules/srdMapping";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import { MAGIC_SCHOOL_LABELS_FR, MAGIC_SCHOOL_COLOR_VAR } from "@/src/i18n/fr";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";

function findBlock<T>(blocks: RuleEntryBlockData[] | undefined, blockType: string): T | null {
  const found = blocks?.find((b) => b.blockType === blockType);
  return found ? (found.data as T) : null;
}

/** `null` pour une reference d'entite — un sort connu n'en a jamais, mais le type de `known[].ref` reste l'union `BlockReference`. */
function ruleKeyOf(ref: SpellcastingBlockData["known"][number]["ref"]): string | null {
  return ref.kind === "rule" ? ref.key : null;
}

interface ClassSpellBudget {
  classKey: string;
  className: string;
  ability: string;
  cantripsAllowed: number;
  spellsAllowed: number;
  maxSpellLevel: number;
}

const ABILITY_KEYS = new Set(["str", "dex", "con", "int", "wis", "cha"]);

function isAbility(value: string): value is Ability {
  return ABILITY_KEYS.has(value);
}

/**
 * Budget de sorts d'une classe a un niveau donne, lu directement dans son
 * `class_progression` (colonnes `spellcasting_cantrips_known`/
 * `spellcasting_prepared_spells`/`spellcasting_spells_known`/
 * `spellcasting_spell_slots_level_N` — noms exacts poses par
 * `scripts/ingest-srd.ts`, verifies contre le Magicien 2024). `null` si la
 * classe n'a pas de progression d'incantation a ce niveau (classe non
 * incantatrice, ou incantation qui commence plus tard).
 *
 * Bug reel corrige ici (retour utilisateur, V2-G1) : ni
 * `spellcasting_prepared_spells` ni `spellcasting_spells_known` n'existent
 * pour un lanceur "preparant" (Magicien, Clerc, Druide...) — le SRD ne
 * tabule jamais ce nombre par niveau, il depend du modificateur de
 * caracteristique du personnage, pas seulement de son niveau de classe.
 * Sans repli, l'etape Sorts n'affichait alors QUE les sorts mineurs pour
 * ces classes, jamais les sorts de niveau 1+. Repli : modificateur +
 * niveau de classe, minimum 1 — formule officielle (PHB/SRD), la meme pour
 * les cinq classes concernees.
 */
function computeBudget(
  classKey: string,
  className: string,
  level: number,
  abilityScores: AbilityScores,
  blocks: RuleEntryBlockData[] | undefined
): ClassSpellBudget | null {
  const progression = findBlock<ClassProgressionBlockData>(blocks, "class_progression");
  const spellInfo = findBlock<SpellcastingProgressionBlockData>(blocks, "spellcasting_progression");
  if (!progression || !spellInfo) return null;
  const row = progression.rows.find((r) => r.level === level);
  if (!row) return null;

  const cantripsAllowed = typeof row.spellcasting_cantrips_known === "number" ? row.spellcasting_cantrips_known : 0;

  let maxSpellLevel = 0;
  for (let n = 1; n <= 9; n++) {
    const value = row[`spellcasting_spell_slots_level_${n}`];
    if (typeof value === "number" && value > 0) maxSpellLevel = n;
  }

  let spellsAllowed: number;
  if (typeof row.spellcasting_prepared_spells === "number") {
    spellsAllowed = row.spellcasting_prepared_spells;
  } else if (typeof row.spellcasting_spells_known === "number") {
    spellsAllowed = row.spellcasting_spells_known;
  } else if (maxSpellLevel > 0 && isAbility(spellInfo.ability)) {
    const score = abilityScores[spellInfo.ability];
    spellsAllowed = Math.max(1, Math.floor((score - 10) / 2) + level);
  } else {
    spellsAllowed = 0;
  }

  if (cantripsAllowed === 0 && spellsAllowed === 0) return null;

  return { classKey, className, ability: spellInfo.ability, cantripsAllowed, spellsAllowed, maxSpellLevel };
}

function spellClassesAndLevel(blocks: RuleEntryBlockData[] | undefined): { classes: string[]; level: number | null } {
  const table = blocks?.find((b) => b.blockType === "custom_table");
  if (!table) return { classes: [], level: null };
  const fields = parseCustomTableFields((table.data as CustomTableBlockData).rows as unknown as CustomTableRow[]);
  return { classes: parseSpellClasses(fields), level: parseSpellLevel(fields) };
}

function spellSchool(blocks: RuleEntryBlockData[] | undefined): { label: string; colorVar: string } | null {
  const casting = findBlock<SpellCastingBlockData>(blocks, "spell_casting");
  if (!casting) return null;
  return {
    label: MAGIC_SCHOOL_LABELS_FR[casting.school] ?? casting.school,
    colorVar: MAGIC_SCHOOL_COLOR_VAR[casting.school] ?? "--link-rule",
  };
}

function descriptionPreview(blocks: RuleEntryBlockData[] | undefined): string {
  const data = findBlock<DescriptionBlockData>(blocks, "description");
  const text = data?.segments.map((s) => s.text).join(" ") ?? "";
  return text.length > 130 ? `${text.slice(0, 130)}…` : text;
}

/**
 * Ligne d'un sort (retour utilisateur, V2-G1 — remplace les encadres
 * `SpellCard` : liste dense, une ligne par sort, plutot qu'une grille de
 * cartes) : nom + badge d'ecole + niveau sur la meme ligne, aperçu du texte
 * toujours visible en dessous, description complete depliable a la
 * demande. Selectionner (bande cliquable sur toute la ligne) et deplier
 * (bouton dedie a droite) restent deux interactions separees. Le badge
 * d'ecole porte une teinte par ecole (retour utilisateur, V2-G1 — un badge
 * neutre unique etait illisible a distinguer d'un coup d'oeil) : une
 * quatrieme categorie de couleur sanctionnee (`docs/adr/0010-couleurs-
 * ecoles-de-magie.md`), jamais une valeur en dur — chaque teinte vit dans
 * `tokens.css` (`--school-<ecole>`), jamais ici.
 */
function SpellRow({
  worldSlug,
  entry,
  level,
  isChosen,
  canPick,
  blocks,
  onToggle,
}: {
  worldSlug: string;
  entry: { key: string; name: string };
  level: number | null;
  isChosen: boolean;
  canPick: boolean;
  blocks: RuleEntryBlockData[] | undefined;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const school = spellSchool(blocks);
  const preview = descriptionPreview(blocks);
  const descriptionBlocks = blocks?.filter((b) => b.blockType === "description") ?? [];

  return (
    <div className={`flex flex-col border-b border-edge/40 last:border-b-0 ${isChosen ? "bg-accent/10" : ""}`}>
      <div className="flex items-start gap-2 px-2.5 py-2">
        <button
          type="button"
          disabled={!canPick}
          onClick={onToggle}
          title={isChosen ? "Cliquer pour retirer" : "Cliquer pour choisir"}
          className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
            isChosen ? "border-accent bg-accent" : "border-edge hover:border-accent"
          }`}
          aria-label={isChosen ? "Retirer ce sort" : "Choisir ce sort"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/m/${worldSlug}/regles/${entry.key}`}
              className="text-sm font-semibold no-underline hover:underline"
              style={{ color: "var(--link-rule)" }}
            >
              {entry.name}
            </Link>
            {school && (
              <span
                className="rounded-full border px-1.5 py-0 text-[10px]"
                style={{ borderColor: `var(${school.colorVar})`, color: `var(${school.colorVar})` }}
              >
                {school.label}
              </span>
            )}
            {level !== null && <span className="mech shrink-0 text-[10px] text-ink-muted">{level === 0 ? "Mineur" : `Niv. ${level}`}</span>}
          </div>
          {preview && !expanded && <p className="truncate text-xs text-ink-muted">{preview}</p>}
        </div>
        {descriptionBlocks.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? "Replier" : "En savoir plus"}
            aria-label={expanded ? "Replier" : "En savoir plus"}
            className="shrink-0 rounded-full p-1 text-ink-muted transition-colors hover:bg-panel hover:text-accent"
          >
            {expanded ? "▴" : "👁"}
          </button>
        )}
      </div>
      {expanded && descriptionBlocks.length > 0 && (
        <div className="px-2.5 pb-2.5 pl-9 text-xs text-ink-muted">
          {descriptionBlocks.map((b, i) => (
            <div key={i}>{renderBlockData("description", b.data, worldSlug)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Filtre par nom (retour utilisateur, V2-G1) — insensible a la casse/aux accents, meme comportement que les recherches d'objet ailleurs dans l'assistant. */
function matchesSearch(name: string, query: string): boolean {
  if (query.trim() === "") return true;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return norm(name).includes(norm(query));
}

/**
 * Liste depliable d'un pool de sorts (mineurs, ou un niveau donne) — compteur
 * bien visible ("X/Y choisis") en tete, champ de recherche par nom, puis les
 * lignes (`SpellRow`). Composant a part pour que le champ de recherche ait
 * son propre etat local sans avoir a le remonter par pool dans le parent.
 */
function SpellPool({
  worldSlug,
  title,
  countLabel,
  chosen,
  allowed,
  showCounter = true,
  pool,
  blocksByKey,
  level,
  isChosenKey,
  canPick,
  onToggle,
}: {
  worldSlug: string;
  title: string;
  countLabel: string;
  chosen: number;
  allowed: number;
  /** Le compteur combine ("Sorts : X/Y") vit une seule fois au-dessus de toutes les sections de niveau — jamais repete section par section, ce serait faux : le budget n'est jamais compte par niveau (cf. commentaire de `computeBudget`). */
  showCounter?: boolean;
  pool: { key: string; name: string }[];
  blocksByKey: Record<string, RuleEntryBlockData[]>;
  level: number | null;
  isChosenKey: (key: string) => boolean;
  canPick: (key: string) => boolean;
  onToggle: (key: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => pool.filter((e) => matchesSearch(e.name, search)), [pool, search]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{title}</span>
      {showCounter && (
        <div className="flex flex-col items-center gap-1 self-center rounded-md border border-edge/60 bg-panel-raised px-6 py-2.5">
          <span className="text-xl font-bold text-accent">
            {chosen}/{allowed}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-ink-muted">{countLabel}</span>
        </div>
      )}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Rechercher — ${title.toLowerCase()}…`}
        className="w-full rounded-md border border-edge bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none"
      />
      {/* Hauteur plafonnee a environ 5-6 sorts (retour utilisateur) — une
          liste de 300+ sorts (Magicien 2024) restait sinon une page entiere
          a parcourir avant d'atteindre la recherche du pool suivant. */}
      <div className="flex max-h-80 flex-col overflow-y-auto rounded-md border border-edge/60 bg-panel-raised">
        {filtered.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-ink-muted">Aucun sort ne correspond.</p>
        ) : (
          filtered.map((e) => (
            <SpellRow
              key={e.key}
              worldSlug={worldSlug}
              entry={e}
              level={level}
              isChosen={isChosenKey(e.key)}
              canPick={canPick(e.key)}
              blocks={blocksByKey[e.key]}
              onToggle={() => onToggle(e.key)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Sorts connus/prepares a la creation (point 7 du retour utilisateur) —
 * hors perimetre de specs/wiki-liens-et-personnages.md §B8, ajoute en plus
 * des sept etapes. Un budget par classe incantatrice du personnage (cantrips
 * + sorts, plafonnes par le niveau max d'emplacement disponible), sorts
 * filtres par la meme liste de classes que le SRD (`Spells.classes`).
 * Ecrit directement dans le bloc `spellcasting` (separe de `character`),
 * cree a la validation si au moins un sort a ete choisi.
 */
export default function SpellSelectionStep({
  worldSlug,
  character,
  spellcasting,
  onUpdateSpellcasting,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  spellcasting: SpellcastingBlockData;
  onUpdateSpellcasting: (data: SpellcastingBlockData) => void;
}) {
  const entries = useWorldRuleEntries(worldSlug);
  const spellEntries = entries.filter((e) => e.entryType === "spell");
  const classKeys = character.classes.filter((c) => c.class.kind === "rule" && c.class.key).map((c) => (c.class as { kind: "rule"; key: string }).key);

  // Deux appels separes plutot qu'un seul lot fusionne (retour utilisateur :
  // "l'onglet sorts prend vraiment longtemps a charger") : le lot des sorts
  // (`spellEntries`) est EXACTEMENT le meme ensemble de cles que le
  // prechargement lance des l'etape 1 par `CharacterCreatorWizard`
  // (`useRuleEntryBlocks` met en cache par le JSON trie des cles demandees)
  // — y ajouter les cles de classe changerait ce JSON et manquerait le
  // cache prechauffe, ce qui annulait l'essentiel du gain mesure en test.
  const spellBlocksByKey = useRuleEntryBlocks(
    worldSlug,
    spellEntries.map((e) => e.key)
  );
  const classBlocksByKey = useRuleEntryBlocks(worldSlug, classKeys);
  const blocksByKey = { ...spellBlocksByKey, ...classBlocksByKey };

  const budgets = character.classes
    .filter((c) => c.class.kind === "rule" && c.class.key)
    .map((c) => {
      const key = (c.class as { kind: "rule"; key: string }).key;
      const name = entries.find((e) => e.key === key)?.name ?? key;
      return computeBudget(key, name, c.level, character.abilities.base, blocksByKey[key]);
    })
    .filter((b): b is ClassSpellBudget => b !== null);

  function toggleSpell(budget: ClassSpellBudget, spellKey: string, kind: "cantrip" | "spell") {
    const isKnown = spellcasting.known.some((k) => k.ref.kind === "rule" && k.ref.key === spellKey);
    if (isKnown) {
      onUpdateSpellcasting({
        ...spellcasting,
        known: spellcasting.known.filter((k) => !(k.ref.kind === "rule" && k.ref.key === spellKey)),
        prepared: spellcasting.prepared.filter((k) => k !== spellKey),
      });
      return;
    }

    const pool = spellEntries.filter((e) => {
      const { classes, level } = spellClassesAndLevel(blocksByKey[e.key]);
      if (!classes.includes(budget.classKey)) return false;
      return kind === "cantrip" ? level === 0 : level !== null && level >= 1 && level <= budget.maxSpellLevel;
    });
    const cap = kind === "cantrip" ? budget.cantripsAllowed : budget.spellsAllowed;
    const selectedInPool = spellcasting.known.filter((k) => pool.some((p) => p.key === ruleKeyOf(k.ref))).length;
    if (selectedInPool >= cap) return;

    const sources = budgets.map((b) => ({ class: b.classKey, ability: b.ability as SpellcastingBlockData["sources"][number]["ability"] }));
    onUpdateSpellcasting({
      ...spellcasting,
      sources,
      known: [...spellcasting.known, { ref: { kind: "rule", key: spellKey }, origin: "class" }],
      prepared: [...spellcasting.prepared, spellKey],
    });
  }

  if (budgets.length === 0) {
    return <p className="text-sm text-ink-muted">Aucune des classes choisies n&apos;incante à ce niveau.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {budgets.map((budget) => {
        const cantripPool = spellEntries.filter((e) => {
          const { classes, level } = spellClassesAndLevel(blocksByKey[e.key]);
          return classes.includes(budget.classKey) && level === 0;
        });
        const spellPool = spellEntries.filter((e) => {
          const { classes, level } = spellClassesAndLevel(blocksByKey[e.key]);
          return classes.includes(budget.classKey) && level !== null && level >= 1 && level <= budget.maxSpellLevel;
        });
        const knownCantrips = spellcasting.known.filter((k) => cantripPool.some((p) => p.key === ruleKeyOf(k.ref))).length;
        const knownSpells = spellcasting.known.filter((k) => spellPool.some((p) => p.key === ruleKeyOf(k.ref))).length;
        const isChosenKey = (key: string) => spellcasting.known.some((k) => k.ref.kind === "rule" && k.ref.key === key);

        return (
          <div key={budget.classKey} className="flex flex-col gap-4 rounded-md border border-edge/60 p-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{budget.className}</span>

            {budget.cantripsAllowed > 0 && (
              <SpellPool
                worldSlug={worldSlug}
                title="Sorts mineurs"
                countLabel="Sorts mineurs sélectionnés"
                chosen={knownCantrips}
                allowed={budget.cantripsAllowed}
                pool={cantripPool}
                blocksByKey={blocksByKey}
                level={0}
                isChosenKey={isChosenKey}
                canPick={(key) => isChosenKey(key) || knownCantrips < budget.cantripsAllowed}
                onToggle={(key) => toggleSpell(budget, key, "cantrip")}
              />
            )}

            {/* Une sous-section par niveau (retour utilisateur, V2-G1) : le
                budget reste un seul total combine (le SRD ne compte jamais
                les sorts connus par niveau), mais parcourir un seul bloc
                plat devenait illisible des que le niveau max depassait 1
                ou 2. */}
            {budget.spellsAllowed > 0 && (
              <div className="flex flex-col gap-4">
                {/* Compteur combine une seule fois pour toutes les sections
                    de niveau ci-dessous — jamais par niveau, le budget ne
                    se compte jamais ainsi (cf. commentaire de `computeBudget`). */}
                <div className="flex flex-col items-center gap-1 self-center rounded-md border border-edge/60 bg-panel-raised px-6 py-2.5">
                  <span className="text-xl font-bold text-accent">
                    {knownSpells}/{budget.spellsAllowed}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-ink-muted">
                    Sorts préparés ({budget.className}, niveau max {budget.maxSpellLevel})
                  </span>
                </div>
                {Array.from({ length: budget.maxSpellLevel }, (_, i) => i + 1).map((lvl) => {
                  const levelPool = spellPool.filter((e) => spellClassesAndLevel(blocksByKey[e.key]).level === lvl);
                  if (levelPool.length === 0) return null;
                  return (
                    <SpellPool
                      key={lvl}
                      worldSlug={worldSlug}
                      title={`Sorts de niveau ${lvl}`}
                      countLabel=""
                      showCounter={false}
                      chosen={knownSpells}
                      allowed={budget.spellsAllowed}
                      pool={levelPool}
                      blocksByKey={blocksByKey}
                      level={lvl}
                      isChosenKey={isChosenKey}
                      canPick={(key) => isChosenKey(key) || knownSpells < budget.spellsAllowed}
                      onToggle={(key) => toggleSpell(budget, key, "spell")}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
