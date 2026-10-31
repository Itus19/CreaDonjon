"use client";

import { composeCharacterName } from "@/src/core/rules/characterName";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import { useCharacterSheetContext } from "./useCharacterSheetContext";
import InventoryTab from "./InventoryTab";
import AbilityScoreStep, { EMPTY_ABILITY_POOL_ASSIGNMENT, type AbilityPoolAssignment } from "./characterCreatorSteps/AbilityScoreStep";
import LevelClassesStep, { type ClassEquipmentChoiceState } from "./characterCreatorSteps/LevelClassesStep";
import CreationHpRollStep, { type CreationHpGrant } from "./characterCreatorSteps/CreationHpRollStep";
import IdentityStep from "./characterCreatorSteps/IdentityStep";
import SpeciesStep from "./characterCreatorSteps/SpeciesStep";
import BackgroundStep, { type BackgroundEquipmentChoice } from "./characterCreatorSteps/BackgroundStep";
import SpellSelectionStep, { spellClassesAndLevel } from "./characterCreatorSteps/SpellSelectionStep";
import PreviewStep from "./characterCreatorSteps/PreviewStep";
import { createCharacterFromWizardAction, type CreateCharacterFromWizardInput } from "@/app/m/[worldSlug]/mj/creation-personnage/actions";
import { overwriteCharacterFromWizardAction, type OverwriteCharacterFromWizardInput } from "@/app/m/[worldSlug]/(monde)/f/[entitySlug]/actions";
import { useWorldRuleEntries } from "./useWorldRuleEntries";
import { useRuleEntryBlocks } from "./useRuleEntryBlocks";
import EtapesCreation from "./characterCreator/EtapesCreation";
import ChoixGenerique from "./characterCreator/ChoixGenerique";
import ApercuDirect from "./characterCreator/ApercuDirect";
import { construireChemin, etapeDe, positionValide, voisin, type CleEtape, type SousEtape } from "@/lib/ui/cheminCreation";
import { SRD_LANGUAGES, type LanguageKey } from "@/src/core/rules/srdMapping";
import { DAMAGE_TYPE_LABELS_FR, LANGUAGE_LABELS_FR, SKILL_LABELS_FR } from "@/src/i18n/fr";
import { ABILITY_LABELS as ABILITY_NAMES, type Skill } from "@/src/core/rules/sheet";

const EMPTY_CHARACTER: CharacterBlockData = {
  __v: 1,
  species: null,
  background: null,
  classes: [{ class: { kind: "rule", key: "" }, level: 1, subclass: null, hp_rolls: [] }],
  abilities: { method: "standard_array", base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
  choices: {},
  hp_method: "fixed",
  portrait_asset_id: null,
  gender: "unspecified",
  pronouns: "",
};

const EMPTY_INVENTORY: InventoryBlockData = {
  __v: 1,
  items: [],
  containers: [],
  currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
};

const EMPTY_SPELLCASTING: SpellcastingBlockData = {
  __v: 1,
  sources: [],
  known: [],
  prepared: [],
  slot_override: null,
};


/**
 * Assistant de creation de personnage (V2-G1, ecran MJ — sur demande
 * explicite : "d'abord un outil complet dans l'ecran MJ avant de
 * l'integrer cote monde via un bloc"). Sept etapes
 * (specs/wiki-liens-et-personnages.md §B8) : espece, classe niveau 1,
 * caracteristiques, historique, equipement de depart, choix restants
 * (liste, pas un tunnel — modifiable jusqu'au bout), apercu.
 *
 * Reutilise le meme moteur de resolution que la fiche jouable
 * (`useCharacterSheetContext`, deja independant de tout entityId — un bloc
 * d'inventaire autonome s'en sert deja) : l'apercu en direct est calcule par
 * le vrai moteur de regles, pas une approximation propre a l'assistant.
 *
 * Huitieme etape "Sorts" ajoutee en plus de §B8 (retour utilisateur) : un
 * budget de cantrips/sorts par classe incantatrice, lu directement dans son
 * `class_progression` (`SpellSelectionStep.tsx`), ecrit dans le bloc
 * `spellcasting` — separe de `character`, cree a la validation seulement si
 * au moins un sort a ete choisi.
 *
 * Etape "Identite" en tete (V3-Z1) : age, genre, pronoms — le genre y
 * quitte la rangee du nom, ou il vivait seul et sans les pronoms. Toujours
 * visible, jamais filtree, et passable sans rien remplir.
 *
 * V3.1-49 : le chemin qui se ramifie (`lib/ui/cheminCreation.ts`). Les étapes
 * à gauche avec, sous chacune, les choix qu'elle fait naître ; l'écran au
 * centre ; l'aperçu en direct à droite. L'onglet Compétences disparaît :
 * chaque choix vit sous l'étape qui l'accorde, les langues sous Identité.
 * Un choix ouvert n'empêche pas de créer. La joueuse a les mêmes droits que
 * le MJ (niveau de départ, multiclassage). La mise en page suit la largeur
 * du conteneur, pas de l'écran : la même fenêtre MJ peut être étroite.
 */
/**
 * Reutilisation depuis une fiche EXISTANTE (retour utilisateur : "Assistant
 * de creation" lance depuis une fiche) — remplace le trajet "creer une
 * nouvelle entite" par "ecraser celle-ci en place", jamais de redirection
 * (l'URL de la fiche ne change jamais, le slug est independant du nom).
 * `initialName` vient du nom ACTUEL de la fiche (jamais du bloc `character`,
 * qui n'en porte aucun) — mentionne au MJ quel personnage il s'apprete a
 * ecraser, meme si le champ reste librement modifiable.
 */
export interface CharacterWizardEntityMode {
  entityId: string;
  expectedVersion: number;
  initialName: string;
  initialCharacter?: CharacterBlockData;
  initialInventory?: InventoryBlockData;
  initialSpellcasting?: SpellcastingBlockData;
  onCancel: () => void;
  onDone: (result: { name: string; version: number }) => void;
  /**
   * Remplace `overwriteCharacterFromWizardAction` (V3.1-83 : un PJ ouvert
   * sans fiche, réclamé à la validation puis écrit). Une action qui redirige
   * ne rend rien : `onDone` n'est alors pas appelé.
   */
  onSubmit?: (
    worldSlug: string,
    input: OverwriteCharacterFromWizardInput
  ) => Promise<{ error: string } | { ok: true; name: string; version: number } | void>;
  /** Remplace la phrase d'avertissement du bandeau (« remplace le personnage actuel… »). */
  note?: string;
}

export default function CharacterCreatorWizard({
  worldSlug,
  worldId,
  entityMode,
  onCreate,
  onCancel,
}: {
  worldSlug: string;
  /** Requis seulement hors `entityMode` (creation d'une nouvelle entite). */
  worldId?: string;
  entityMode?: CharacterWizardEntityMode;
  /**
   * Remplace `createCharacterFromWizardAction` pour la creation d'une
   * nouvelle entite (V3.1-10, ecran "Choisis ton personnage" — Nouveau PJ) :
   * l'ecran MJ cree une fiche libre, mais un joueur qui compose la sienne
   * depuis la coquille joueuse doit AUSSI la reclamer dans sa campagne et
   * repartir sur son propre ecran, jamais la fiche MJ. Ignore si
   * `entityMode` est fourni (reecriture, jamais une creation).
   */
  onCreate?: (worldSlug: string, input: CreateCharacterFromWizardInput) => Promise<{ error: string } | void>;
  /** Hors `entityMode` : un bouton « Annuler » (V3.1-83, retour au carrousel, rien n'est créé). Absent côté MJ, rien ne change. */
  onCancel?: () => void;
}) {
  const t = useTranslations("creation");
  // Une position du parcours : une étape (`espece`) ou un choix (`c:versatile.feat`). L'étape est gardée à part :
  // quand un choix disparaît (sa source a changé), on sait encore où revenir.
  const [position, setPosition] = useState<string>("ident");
  const [etapeCourante, setEtapeCourante] = useState<CleEtape>("ident");
  const [name, setName] = useState(entityMode?.initialName ?? "");
  const [character, setCharacter] = useState<CharacterBlockData>(entityMode?.initialCharacter ?? EMPTY_CHARACTER);
  const [inventory, setInventory] = useState<InventoryBlockData>(entityMode?.initialInventory ?? EMPTY_INVENTORY);
  const [spellcasting, setSpellcasting] = useState<SpellcastingBlockData>(entityMode?.initialSpellcasting ?? EMPTY_SPELLCASTING);
  const [abilityPool, setAbilityPool] = useState<AbilityPoolAssignment>(EMPTY_ABILITY_POOL_ASSIGNMENT);
  const [bgEquipmentChoice, setBgEquipmentChoice] = useState<BackgroundEquipmentChoice | null>(null);
  const [classEquipmentChoices, setClassEquipmentChoices] = useState<(ClassEquipmentChoiceState | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchCharacter(fields: Partial<CharacterBlockData>) {
    setCharacter((prev) => ({ ...prev, ...fields }));
  }

  // Prechargement des sorts en arriere-plan (retour utilisateur : "l'onglet
  // sorts prend vraiment longtemps a charger") — les blocs de tous les
  // sorts du monde (jusqu'a 339 sous le SRD 2024) ne dependent d'aucun choix
  // du joueur, seulement du monde ; `useRuleEntryBlocks` (cache module-level
  // partage par cle) permet donc de lancer cette requete des l'etape 1
  // (Espece) plutot que d'attendre l'etape 7 (Sorts) — le temps reel
  // d'aller-retour reseau (~1s, base Supabase hebergee) est alors deja passe
  // pendant que le joueur choisit espece/classe/historique/equipement, et
  // `SpellSelectionStep` retrouve le resultat en cache, instantanement.
  const allEntries = useWorldRuleEntries(worldSlug);
  const allSpellKeys = allEntries.filter((e) => e.entryType === "spell").map((e) => e.key);
  const spellBlocks = useRuleEntryBlocks(worldSlug, allSpellKeys);

  // Etape "Sorts" masquee pour une classe qui n'incante jamais (retour
  // utilisateur : "un onglet adaptatif" propose puis ecarte au profit de
  // cette solution plus simple — l'onglet 7 reste dedie aux sorts, il
  // disparait juste pour Barbare/Guerrier/etc. plutot que de changer de
  // contenu selon la classe). Presence du bloc `spellcasting_progression`
  // sur la classe = meme test que `computeBudget` dans `SpellSelectionStep`,
  // sans dupliquer son calcul de budget (qui depend du niveau et n'est pas
  // necessaire ici, juste "cette classe incante-t-elle un jour ?").
  const classKeys = character.classes.filter((c) => c.class.kind === "rule" && c.class.key).map((c) => (c.class as { kind: "rule"; key: string }).key);
  const classBlocksByKey = useRuleEntryBlocks(worldSlug, classKeys);
  const hasSpellcastingClass = classKeys.some((key) => classBlocksByKey[key]?.some((b) => b.blockType === "spellcasting_progression"));

  const {
    remainingChoices,
    sheet,
    ruleset,
    weaponByKey,
    equipment,
    weight,
    cost,
    spellLevels,
    proficiencies,
    languages,
    isMonk,
    traits,
    traitChips,
    traitSourceLabel,
    languageChoices,
    allLanguages,
    itemChips,
    equippedWeapons,
    buildChips,
    backgroundAbilityScores,
    rulesetPret,
    openChoices,
    choiceSources,
    featCatalog,
    proficientSkills,
  } = useCharacterSheetContext(worldSlug, character, inventory, spellcasting);

  // Points de vie (V2-G1, retour utilisateur) : un demarrage au-dela du
  // niveau 1 (personnage OU classe multiclassee choisie directement a un
  // niveau superieur) a besoin d'un choix moyenne/jet par niveau non
  // exempte, exactement comme a la montee de niveau — seul le tout premier
  // niveau du personnage (premiere classe, niveau 1) est exempt.
  const hpGrants: CreationHpGrant[] = [];
  character.classes.forEach((c, index) => {
    if (c.class.kind !== "rule" || !c.class.key) return;
    const classKey = c.class.key;
    const exemptLevel = index === 0 ? 1 : 0;
    if (c.level <= exemptLevel) return;
    const levels: number[] = [];
    for (let lvl = exemptLevel + 1; lvl <= c.level; lvl++) levels.push(lvl);
    hpGrants.push({
      classIndex: index,
      classKey,
      className: ruleset.classes[classKey]?.label ?? classKey,
      dieFaces: ruleset.classes[classKey]?.hitDie ?? 6,
      levels,
    });
  });

  const entryName = new Map(allEntries.map((e) => [e.key, e.name]));
  const languesFixes = new Set(languages.map((l) => l.key));
  const chemin = construireChemin({
    restants: remainingChoices,
    ouverts: openChoices,
    sources: choiceSources,
    reponses: character.choices,
    avecPointsDeVie: hpGrants.length > 0,
    avecSorts: hasSpellcastingClass,
    langues: SRD_LANGUAGES.filter((l) => !languesFixes.has(l)),
    competencesMaitrisees: proficientSkills,
    dons: featCatalog,
    sorts: allEntries
      .filter((e) => e.entryType === "spell")
      .map((e) => {
        const { classes, level } = spellClassesAndLevel(spellBlocks[e.key]);
        return { cle: e.key, libelle: e.name, ...(level !== null ? { niveau: level } : {}), ...(classes.length > 0 ? { listes: classes } : {}) };
      }),
  });
  const ici = positionValide(chemin, position) ? position : null;
  const etapeIci = (ici && etapeDe(chemin, ici)) || etapeCourante;
  const sousIci: SousEtape | undefined = ici?.startsWith("c:")
    ? chemin.etapes.flatMap((e) => e.sous).find((s) => `c:${s.cle}` === ici)
    : undefined;
  const indexEtape = Math.max(0, chemin.etapes.findIndex((e) => e.cle === etapeIci));

  function aller(cible: string) {
    setPosition(cible);
    const etape = etapeDe(chemin, cible);
    if (etape) setEtapeCourante(etape);
  }

  function choisir(cle: string, valeurs: string[]) {
    patchCharacter({ choices: { ...character.choices, [cle]: valeurs } });
  }

  function libelleOption(sous: SousEtape) {
    return (cle: string): string => {
      switch (sous.genre) {
        case "skill":
          return SKILL_LABELS_FR[cle as Skill] ?? cle;
        case "language":
          return LANGUAGE_LABELS_FR[cle as LanguageKey] ?? (t.has(`langues.${cle}`) ? t(`langues.${cle}`) : cle);
        case "ability":
          return ABILITY_NAMES[cle as keyof typeof ABILITY_NAMES] ?? cle;
        case "damage_type":
          return DAMAGE_TYPE_LABELS_FR[cle] ?? cle;
        default:
          return entryName.get(cle) ?? cle;
      }
    };
  }

  /** Ce qu'une autre source donne déjà : grisé, pour ne pas gâcher un choix (règle 2024 : en choisir une autre). */
  function dejaAcquis(sous: SousEtape): Set<string> {
    if (sous.genre === "skill") {
      // Une expertise vise une compétence maîtrisée : seule une expertise venue d'ailleurs la rend inutile.
      return new Set(
        Object.entries(sheet.skills)
          .filter(([, r]) => (sous.expertise ? r.proficiency === "expertise" : r.proficiency === "proficient" || r.proficiency === "expertise"))
          .map(([k]) => k)
      );
    }
    if (sous.genre === "language") return new Set(allLanguages.map((l) => l.key));
    return new Set();
  }

  const nomClasse = (key: string) => ruleset.classes[key]?.label ?? entryName.get(key) ?? key;
  const refKey = (ref: { kind: string; key?: string } | null) => (ref && ref.kind === "rule" && ref.key ? ref.key : null);
  const especeCle = refKey(character.species as { kind: string; key?: string } | null);
  const historiqueCle = refKey(character.background as { kind: string; key?: string } | null);
  const ligne = [
    especeCle ? entryName.get(especeCle) ?? especeCle : null,
    character.classes
      .filter((c) => c.class.kind === "rule" && c.class.key)
      .map((c) => `${nomClasse((c.class as { kind: "rule"; key: string }).key)} ${c.level}`)
      .join(" / ") || null,
    historiqueCle ? entryName.get(historiqueCle) ?? historiqueCle : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const sortsConnus = [...new Set([...spellcasting.known.map((k) => (k.ref.kind === "rule" ? k.ref.key : "")), ...sheet.grantedSpells.map((g) => g.key)])]
    .filter(Boolean)
    .map((k) => entryName.get(k) ?? k);
  // Dons et traits : ni les aptitudes de classe, ni les paquets d'espèce et d'historique (leur clé est leur source),
  // ni les anciens choix de compétences ou de langues (déjà dans les compétences et les langues).
  const traitsAffiches = [
    ...new Set(sheet.features.filter((f) => !f.source.startsWith("class:") && f.source !== "choice" && f.key !== f.source).map((f) => f.label)),
  ];
  const languesAffichees = allLanguages.map((l) => LANGUAGE_LABELS_FR[l.key as LanguageKey] ?? (t.has(`langues.${l.key}`) ? t(`langues.${l.key}`) : l.name));

  // « Prénom Nom » prime sur le champ libre quand l'étape Identité est remplie (V3.1-48).
  const finalName = composeCharacterName(character.given_name, character.family_name) || name.trim();

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (entityMode) {
        const result = await (entityMode.onSubmit ?? overwriteCharacterFromWizardAction)(worldSlug, {
          entityId: entityMode.entityId,
          expectedVersion: entityMode.expectedVersion,
          name: finalName,
          character,
          inventory: inventory.items.length > 0 ? inventory : undefined,
          spellcasting: spellcasting.known.length > 0 ? spellcasting : undefined,
        });
        if (!result) return;
        if ("error" in result) {
          setError(result.error);
          return;
        }
        entityMode.onDone({ name: result.name, version: result.version });
        return;
      }

      const result = await (onCreate ?? createCharacterFromWizardAction)(worldSlug, {
        worldId: worldId!,
        name: finalName,
        character,
        inventory: inventory.items.length > 0 ? inventory : undefined,
        spellcasting: spellcasting.known.length > 0 ? spellcasting : undefined,
      });
      if (result?.error) setError(result.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="@container/creation flex flex-col gap-4">
      {entityMode && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">
            {entityMode.note ?? "Assistant de création — remplace le personnage actuel de cette fiche à la validation."}
          </p>
          <button
            type="button"
            onClick={entityMode.onCancel}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-panel"
          >
            Fermer sans enregistrer
          </button>
        </div>
      )}
      {!entityMode && onCancel && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-panel"
          >
            Annuler
          </button>
        </div>
      )}
      <div className="flex flex-col gap-3 @lg/creation:flex-row">
        {/* Téléphone : une étape par écran, la progression au-dessus. Plus large : les étapes à gauche. */}
        <div className="flex flex-col gap-1.5 @lg/creation:hidden">
          <div aria-hidden="true" className="flex gap-0.5">
            {chemin.etapes.map((e, i) => (
              <i key={e.cle} className={`h-1 flex-1 rounded-full ${i === indexEtape ? "bg-accent" : i < indexEtape && e.aFaire === 0 ? "bg-success" : "bg-edge"}`} />
            ))}
          </div>
          <p className="text-xs text-ink-muted">
            {t("etapeSur", { n: indexEtape + 1, total: chemin.etapes.length, nom: t(`etapes.${etapeIci}`) })}
          </p>
        </div>
        <aside className="hidden w-44 shrink-0 @lg/creation:block @3xl/creation:w-56">
          <EtapesCreation chemin={chemin} position={ici ?? ""} etapeCourante={etapeIci} onAller={aller} />
        </aside>

        <section aria-labelledby="creation-ecran" className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-edge bg-panel p-4">
          <header className="flex flex-col gap-0.5">
            <span className="text-xs text-ink-muted">{sousIci ? sousIci.source : t("etapeN", { n: indexEtape + 1 })}</span>
            <h2 id="creation-ecran" className="font-display text-lg font-bold text-ink">
              {ici === null ? t("choixDisparu") : sousIci ? sousIci.libelle : t(`etapes.${etapeIci}`)}
            </h2>
            {ici === null && <p className="text-sm text-ink-soft">{t("choixDisparuNote")}</p>}
            {ici !== null && !sousIci && <p className="text-sm text-ink-soft">{t(`desc.${etapeIci}`)}</p>}
          </header>

          {ici === null && (
            <button type="button" onClick={() => aller(etapeCourante)} className="w-fit rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised">
              {t("revenirEtape")}
            </button>
          )}

          {sousIci && (
            <ChoixGenerique sous={sousIci} libelleOption={libelleOption(sousIci)} dejaAcquis={dejaAcquis(sousIci)} onChoisir={(v) => choisir(sousIci.cle, v)} />
          )}

          {ici === "ident" && (
            <>
              <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
                {t("nomAffiche")}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("nomPlaceholder")}
                  className="w-full max-w-sm rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm normal-case tracking-normal text-ink outline-none"
                />
              </label>
              <IdentityStep character={character} patchCharacter={patchCharacter} />
            </>
          )}

          {ici === "espece" && <SpeciesStep worldSlug={worldSlug} character={character} patchCharacter={patchCharacter} />}

          {ici === "classe" && (
            <LevelClassesStep
              worldSlug={worldSlug}
              character={character}
              patchCharacter={patchCharacter}
              inventory={inventory}
              onUpdateInventory={setInventory}
              equipmentChoices={classEquipmentChoices}
              onChooseEquipmentChoices={setClassEquipmentChoices}
            />
          )}

          {ici === "carac" && (
            <AbilityScoreStep
              character={character}
              patchCharacter={patchCharacter}
              pool={abilityPool}
              onChangePool={setAbilityPool}
              sheet={sheet}
              characterRules={ruleset.characterRules}
              worldSlug={worldSlug}
              rulesLoaded={Object.keys(ruleset.classes).length + Object.keys(ruleset.features).length > 0}
            />
          )}

          {ici === "pv" && <CreationHpRollStep character={character} patchCharacter={patchCharacter} grants={hpGrants} conMod={sheet.abilities.con.mod} />}

          {ici === "histo" && (
            <BackgroundStep
              worldSlug={worldSlug}
              character={character}
              patchCharacter={patchCharacter}
              inventory={inventory}
              onUpdateInventory={setInventory}
              choice={bgEquipmentChoice}
              onChooseOption={setBgEquipmentChoice}
              backgroundAbilityScores={backgroundAbilityScores}
            />
          )}

          {ici === "equip" && (
            <InventoryTab
              worldSlug={worldSlug}
              inventory={inventory}
              onUpdateInventory={setInventory}
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

          {ici === "sorts" && <SpellSelectionStep worldSlug={worldSlug} character={character} spellcasting={spellcasting} onUpdateSpellcasting={setSpellcasting} />}

          {ici === "apercu" && (
            <div className="flex flex-col gap-3">
              <PreviewStep
                worldSlug={worldSlug}
                character={character}
                patchCharacter={patchCharacter}
                inventory={inventory}
                onUpdateInventory={setInventory}
                spellcasting={spellcasting}
                onUpdateSpellcasting={setSpellcasting}
                spellLevels={spellLevels}
                sheet={sheet}
                traits={traits}
                traitChips={traitChips}
                traitSourceLabel={traitSourceLabel}
                proficiencies={proficiencies}
                languageChoices={languageChoices}
                allLanguages={allLanguages}
                remainingChoices={remainingChoices}
                weaponByKey={weaponByKey}
                equipment={equipment}
                weight={weight}
                cost={cost}
                itemChips={itemChips}
                equippedWeapons={equippedWeapons}
                isMonk={isMonk}
                buildChips={buildChips}
              />

              {chemin.aFaire > 0 && (
                <div className="flex flex-col gap-2 rounded-md border border-accent/50 bg-accent/10 px-3 py-2">
                  <p className="text-sm text-ink">{t("choixOuverts", { n: chemin.aFaire })}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {chemin.etapes
                      .flatMap((e) => e.sous)
                      .filter((s) => !s.fait)
                      .map((s) => (
                        <button
                          key={s.cle}
                          type="button"
                          onClick={() => aller(`c:${s.cle}`)}
                          className="rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
                        >
                          {s.libelle}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {sheet.warnings.length > 0 && (
                <div className="rounded-md border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger">
                  <p className="font-semibold">{t("illegal")}</p>
                  <ul className="list-inside list-disc">
                    {sheet.warnings.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {error && <p className="text-xs text-danger">{error}</p>}

              <button
                type="button"
                disabled={busy || !finalName}
                onClick={submit}
                className="w-fit rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
                title={!finalName ? t("nomRequis") : undefined}
              >
                {entityMode ? t("enregistrer") : t("creer")}
              </button>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-edge pt-3">
            <button
              type="button"
              disabled={ici === chemin.ordre[0]}
              onClick={() => aller(voisin(chemin, ici ?? etapeCourante, -1))}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-30"
            >
              {t("precedent")}
            </button>
            <span className="text-xs text-ink-muted">{chemin.aFaire > 0 ? t("aFaire", { n: chemin.aFaire }) : t("toutChoisi")}</span>
            <button
              type="button"
              disabled={ici === chemin.ordre[chemin.ordre.length - 1]}
              onClick={() => aller(voisin(chemin, ici ?? etapeCourante, 1))}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-30"
            >
              {t("suivant")}
            </button>
          </div>
        </section>

        <aside aria-label={t("apercuAria")} className="hidden w-72 shrink-0 rounded-lg border border-edge bg-panel p-4 @5xl/creation:block">
          <ApercuDirect nom={finalName} ligne={ligne} sheet={sheet} pret={rulesetPret} langues={languesAffichees} traits={traitsAffiches} sorts={sortsConnus} />
        </aside>
      </div>
    </div>
  );
}
