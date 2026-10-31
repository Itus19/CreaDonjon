"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { choixOuverts } from "@/lib/ui/cheminCreation";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import { ABILITY_LABELS as ABILITY_NAMES, SKILL_ABILITIES, type Ability } from "@/src/core/rules/sheet";
import { XP_LEVEL_THRESHOLDS, hasReachedNextLevel } from "@/src/core/rules/experience";
import { applyDamageToHp } from "@/src/core/rules/tempHp";
import { pvSousUnTiers } from "@/lib/ui/commandeE";
import { etatMourant } from "@/lib/ui/etatMourant";
import { resumerCompetences } from "@/lib/ui/resumeCompetences";
import type { RuntimeState } from "@/src/core/schemas/runtimeState";
import type { AdvantageState } from "@/src/core/rules/action";
import { useCharacterSheetContext } from "./useCharacterSheetContext";
import { useReferenceChips, refIdentity } from "./useReferenceChips";
import Dropdown from "@/components/shared/Dropdown";
import Tabs, { TabPanel } from "@/components/shared/Tabs";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import CharacterSheetHeader from "./CharacterSheetHeader";
import ActionsTab, { type PreparedSpellView } from "./ActionsTab";
import MagicTab, { type KnownSpellView } from "./MagicTab";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import InventoryTab from "./InventoryTab";
import TraitsTab from "./TraitsTab";
import MasteriesTab from "./MasteriesTab";
import { toggleChoice } from "./characterChoiceUtils";
import CharacterCreatorWizard from "./CharacterCreatorWizard";
import { useDiceRoll } from "@/components/shell/DiceRollPanel";
import { chargerFicheCalculee, type SheetApiResponse } from "./ficheCalculee";
import { ABILITY_LABELS, SORTED_SKILLS } from "./sheetLabels";
import TuileCaracteristique from "./TuileCaracteristique";
import { commandesDeLaFiche, type CommandesFiche } from "@/lib/ui/commandesFiche";
import { useJetsDeLaFiche } from "./useJetsDeLaFiche";
import { TAB_LABELS, type Tab } from "./ongletsFiche";



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
  characterBlockId,
  characterBlockVersion,
  onUpdateCharacter,
  onUpdateInventory,
  onUpdateSpellcasting,
  onBlockRefreshed,
  isWorldAdmin = false,
  commandesImposees,
}: {
  worldSlug: string;
  entityId: string;
  campaignId: string | null;
  character: CharacterBlockData;
  inventory: InventoryBlockData | undefined;
  spellcasting: SpellcastingBlockData | undefined;
  resources: ResourcesBlockData | undefined;
  /** Bloc `character` (id/version) — V2-G1, requis pour lancer une montee de niveau (sauvegarde chirurgicale avec verification de version). */
  characterBlockId: string;
  characterBlockVersion: number;
  onUpdateCharacter: (data: CharacterBlockData) => void;
  onUpdateInventory: (data: InventoryBlockData) => void;
  onUpdateSpellcasting: (data: SpellcastingBlockData) => void;
  /** Un bloc a ete ecrit par une autre voie que la sauvegarde normale de ce composant (V2-G1, montee de niveau) — synchronise la version locale sans redeclencher une sauvegarde (meme motif que `BlockDataEditor`/`EntityBlocks.handleBlockRefreshed`). */
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
  /** MJ du monde (V3.1-115) : peut passer outre un prerequis de multiclassage a la montee de niveau. Indication d'interface seulement, le serveur le re-verifie. */
  isWorldAdmin?: boolean;
  /** V3.1-57 : l'aperçu de l'écran Règles actives impose les commandes que montrerait la fiche d'une joueuse ; remplace celles du serveur. */
  commandesImposees?: CommandesFiche;
}) {
  const [tab, setTab] = useState<Tab>("actions");
  const [advantage, setAdvantage] = useState<AdvantageState>("normal");
  const [remote, setRemote] = useState<SheetApiResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Montee de niveau (V2-G1) : le meme motif que "wizardOpen" dans
  // EditEntityForm.tsx — l'assistant remplace tout le rendu de cette fiche
  // tant qu'il est ouvert. L'etat vit ici (avec les autres), mais le
  // "return" anticipe qui remplace le rendu doit attendre la fin de TOUS
  // les hooks de ce composant (react-hooks/rules-of-hooks) — il vit plus
  // bas, juste apres le dernier `useEffect`.
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  // V3.1-29 : sous 40rem de fiche, les competences sont une ligne repliable, fermee par defaut.
  const [competencesOuvertes, setCompetencesOuvertes] = useState(false);
  // V3.1-32 : le d20 du dernier jet contre la mort lance depuis cette fiche (montre a cote du bouton).
  const [dernierD20, setDernierD20] = useState<number | null>(null);
  const idCompetences = useId();

  /** V2-M11 : jets de test/competence/sauvegarde/initiative depuis cette fiche — alimentent le volet, jamais un second affichage local (voir CLAUDE.md, "resultats de des uniquement dans ce volet"). */
  const { rollAbility, rollSkill, rollSave, rollInitiative } = useDiceRoll();

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
    patchCharacter({ classes: [...character.classes, { class: { kind: "rule", key: "" }, level: 1, subclass: null, hp_rolls: [] }] });
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
    rulesetPret,
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
    openChoices,
  } = useCharacterSheetContext(worldSlug, character, inventory, spellcasting);
  const t = useTranslations("creation");
  const aRappeler = rulesetPret ? choixOuverts(remainingChoices, openChoices, character.choices) : [];

  const weaponMasteryChoices = remainingChoices.filter((c) => c.kind === "weapon_mastery");

  // Les sorts accordés (V3.1-118) partent dans la même requête de noms que les sorts connus.
  const knownSpellRefs = useMemo(
    () => [
      ...(spellcasting?.known ?? []).map((k) => k.ref),
      ...sheet.grantedSpells.map((g): BlockReference => ({ kind: "rule", key: g.key })),
    ],
    [spellcasting, sheet.grantedSpells]
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
    .map((s) => ({ ref: s.known.ref, label: s.label, level: s.level }));

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
    chargerFicheCalculee(entityId, campaignId)
      .then((body) => {
        if (!cancelled && body) setRemote(body);
      })
      .catch((erreur: unknown) => {
        // Jamais muet : l'erreur se voit, dans la console et sur la fiche. L'en-tete
        // reste en squelette (pas de chiffre faux), le reste se calcule en local.
        console.error("Fiche calculee non chargee", erreur);
        if (!cancelled) setError("La fiche calculée n'a pas pu être chargée.");
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, campaignId]);

  // V3.1-106 : attaque, dégâts et sorts ouvrent l'outil de dés pré-rempli ; le MJ peut y cibler un participant du combat en cours.
  const jets = useJetsDeLaFiche({ entityId, campaignId, estMj: isWorldAdmin, apresSort: reloadRemote });

  if (levelUpOpen) {
    return (
      <CharacterCreatorWizard
        worldSlug={worldSlug}
        montee={{
          entityId,
          campaignId,
          expectedVersion: characterBlockVersion,
          initial: {
            character,
            inventory: inventory ?? { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } },
            spellcasting,
          },
          isWorldAdmin,
          onCancel: () => setLevelUpOpen(false),
          onDone: (result) => {
            onBlockRefreshed({ id: characterBlockId, data: result.character.data, version: result.character.version });
            if (result.spellcasting) onBlockRefreshed(result.spellcasting);
            setLevelUpOpen(false);
            // `remote.runtimeState.hpMax` (V1-B5) vient de `/sheet`, chargee
            // une seule fois au montage — sans ce rechargement, la barre de PV
            // resterait plafonnee a l'ANCIEN niveau jusqu'au prochain rechargement
            // complet de la page, alors que le bloc `character` local, lui, est
            // deja a jour (V2-G1).
            reloadRemote();
          },
        }}
      />
    );
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
    // Meme regle que le serveur (V3.1-24) : les degats entament les PV temporaires d'abord, un soin plafonne au maximum.
    patchRuntimeState((state) => {
      if (delta < 0) {
        const { hp } = applyDamageToHp({ current: state.hp.current, max: hpMax, temp: state.hp.temp }, -delta);
        return { ...state, hp: { ...state.hp, current: hp.current, temp: hp.temp } };
      }
      return { ...state, hp: { ...state.hp, current: Math.max(state.hp.current, Math.min(hpMax, state.hp.current + delta)) } };
    });
    await postAction("hp", { campaignId, delta });
    reloadRemote();
  }

  /**
   * V3.1-32 — jet contre la mort : le SERVEUR lance le d20 (`natural: null`), la fiche
   * n'envoie jamais de resultat. La reponse met l'etat de jeu a jour tout de suite
   * (PV et jets), puis le rechargement habituel confirme.
   */
  async function jetDeMort() {
    const result = await postAction<{
      natural: number;
      deathSaves: { success: number; fail: number };
      hpCurrent: number;
    }>("death-save", { campaignId, natural: null });
    if (!result) return;
    setDernierD20(result.natural);
    patchRuntimeState((state) => ({ ...state, hp: { ...state.hp, current: result.hpCurrent }, death_saves: result.deathSaves }));
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

  /** V2.1-26 — meme geste que l'epuisement : le client reflete la borne pour l'affichage, le serveur la fait respecter. */
  async function changeInspiration(delta: number) {
    patchRuntimeState((state) => ({ ...state, inspiration: Math.max(0, Math.min(5, state.inspiration + delta)) }));
    await postAction("inspiration", { campaignId, delta });
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

  /**
   * V3.1-114 — un geste de l'égaliseur sur un emplacement ou la réserve de pacte (+1 dépense, -1 rend).
   * Comme `changeExhaustion` : le client reflète la borne tout de suite, le serveur la fait respecter.
   */
  async function changeEmplacement(geste: { pool: "slots"; level: number } | { pool: "pact" }, delta: number) {
    patchRuntimeState((state) => {
      if (geste.pool === "pact") {
        const total = sheet.spellcasting?.pactSlots?.count ?? 0;
        return { ...state, pact_slots_used: Math.max(0, Math.min(total, (state.pact_slots_used ?? 0) + delta)) };
      }
      const cle = String(geste.level);
      const total = sheet.spellcasting?.slots[geste.level] ?? 0;
      return { ...state, spell_slots_used: { ...state.spell_slots_used, [cle]: Math.max(0, Math.min(total, (state.spell_slots_used[cle] ?? 0) + delta)) } };
    });
    const corps = geste.pool === "pact" ? { campaignId, pool: "pact", delta } : { campaignId, pool: "slots", level: geste.level, delta };
    await postAction("spell-slot", corps);
    reloadRemote();
  }

  // V3.1-114 : les classes et sous-classes (clés de règle) — une ressource qui en vient va au groupe « Classe » de l'égaliseur.
  const classKeys = character.classes.flatMap((c) => [c.class, c.subclass].flatMap((r) => (r?.kind === "rule" ? [r.key] : [])));
  const runtimeState = remote?.runtimeState.state;
  // V3.1-109 : tant que la fiche calculee n'est pas la, aucune commande (jamais un geste que le serveur refusera).
  const commandes = commandesImposees ?? commandesDeLaFiche(remote?.controls);
  const hpMax = remote?.runtimeState.hpMax ?? sheet.hitPoints.max;

  const exhaustion = runtimeState?.exhaustion ?? 0;
  // V2.1-26 : `?? 0` et `?? []` comme partout ici — l'etat de jeu n'est pas
  // encore charge au premier rendu, et une fiche sans campagne n'en a pas.
  const inspiration = runtimeState?.inspiration ?? 0;
  const conditions = runtimeState?.conditions ?? [];
  const hpCurrent = runtimeState?.hp.current ?? hpMax;
  const hpTemp = runtimeState?.hp.temp ?? 0;
  const hpLow = pvSousUnTiers(hpCurrent, hpMax);
  const deathSaves = runtimeState?.death_saves ?? { success: 0, fail: 0 };
  const etat = etatMourant({ current: hpCurrent }, deathSaves);
  // V3.1-26 : l'en-tete n'affiche un chiffre que quand tout ce qui le fonde est la — les regles
  // resolues (CA, PV max, vitesse) ET l'etat de jeu. Avant, valeurs de depart fausses (CA 11, PV 0/0).
  const pret = rulesetPret && remote !== null;

  const totalLevel = Math.max(1, character.classes.reduce((sum, c) => sum + c.level, 0));
  const levelIndex = Math.min(totalLevel, XP_LEVEL_THRESHOLDS.length) - 1;
  const xpFloor = XP_LEVEL_THRESHOLDS[levelIndex] ?? 0;
  const xpCeiling = XP_LEVEL_THRESHOLDS[levelIndex + 1] ?? xpFloor;
  const xpCurrent = runtimeState?.xp ?? 0;
  const xpPct = xpCeiling > xpFloor ? Math.min(100, Math.max(0, ((xpCurrent - xpFloor) / (xpCeiling - xpFloor)) * 100)) : 100;
  const canLevelUp = hasReachedNextLevel(totalLevel, xpCurrent);
  const resume = resumerCompetences(
    SORTED_SKILLS.map((skill) => ({ nom: SKILL_LABELS_FR[skill], mod: sheet.skills[skill].mod, proficiency: sheet.skills[skill].proficiency }))
  );

  return (
    <div className="@container mb-4 flex flex-col gap-3 rounded-md border border-edge/60 bg-panel-raised p-3">
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
        inspiration={inspiration}
        onChangeInspiration={changeInspiration}
        conditions={conditions}
        pret={pret}
        hpCurrent={hpCurrent}
        hpTemp={hpTemp}
        hpMax={hpMax}
        hpLow={hpLow}
        onChangeHp={changeHp}
        xpCurrent={xpCurrent}
        xpCeiling={xpCeiling}
        xpPct={xpPct}
        totalLevel={totalLevel}
        xpLevelThresholdsLength={XP_LEVEL_THRESHOLDS.length}
        onChangeXp={changeXp}
        canLevelUp={canLevelUp}
        onLevelUp={() => setLevelUpOpen(true)}
        onRest={rest}
        onExportJson={exportJson}
        onRollInitiative={() => rollInitiative(entityId, advantage, { label: "Initiative", modifier: sheet.abilities.dex.mod })}
        error={error}
        etatMourant={etat}
        deathSaves={deathSaves}
        dernierD20={dernierD20}
        onJetDeMort={jetDeMort}
        concentration={runtimeState?.concentration ?? null}
        commandes={commandes}
      />
      {/* V3.1-49 : un personnage créé avec des choix ouverts les retrouve ici (la création ne les impose pas). */}
      {aRappeler.length > 0 && (
        <p className="rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs text-ink">
          {t("choixOuvertsFiche", { n: aRappeler.length, liste: aRappeler.map((c) => c.libelle).join(", ") })}
        </p>
      )}

      {/*
        V3.1-28 — la fiche suit la largeur de SA fenêtre, pas celle de l'écran :
        une requête de conteneur (`@container`, posé sur la fiche entière), car la même fiche vit dans une
        page pleine, un volet partagé ou une tablette. Sous 40rem (640 px) de
        fenêtre, la disposition du téléphone : les six caractéristiques en ligne
        au-dessus des onglets ; au-delà, la colonne de gauche.
      */}
      <div className="flex flex-col gap-4 @min-[40rem]:flex-row">
        <aside className="flex flex-col gap-3 @min-[40rem]:w-48 @min-[40rem]:shrink-0">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Caractéristiques</span>
            <div className="grid grid-cols-3 gap-1.5 @min-[40rem]:grid-cols-2 @min-[40rem]:gap-2">
              {(Object.keys(ABILITY_LABELS) as Ability[]).map((ability) => {
                const save = sheet.savingThrows[ability];
                return (
                  <TuileCaracteristique
                    key={ability}
                    abreviation={ABILITY_LABELS[ability]}
                    modificateur={`${sheet.abilities[ability].mod >= 0 ? "+" : ""}${sheet.abilities[ability].mod}`}
                    titreTest={`Lancer un test de ${ABILITY_NAMES[ability]}`}
                    libelleTest={`Test de ${ABILITY_NAMES[ability]}`}
                    onTest={() =>
                      rollAbility(entityId, ability, advantage, {
                        label: `Test de ${ABILITY_NAMES[ability]}`,
                        modifier: sheet.abilities[ability].mod,
                        inspiration,
                        apresRelance: reloadRemote,
                      })
                    }
                    milieu={
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
                    }
                    sauvegarde={`Sauv. ${save.mod >= 0 ? "+" : ""}${save.mod}`}
                    titreSauvegarde={`Lancer une sauvegarde de ${ABILITY_NAMES[ability]}`}
                    libelleSauvegarde={`Sauvegarde de ${ABILITY_NAMES[ability]}`}
                    maitrise={save.proficient}
                    onSauvegarde={() =>
                      rollSave(entityId, ability, advantage, {
                        label: `Sauvegarde de ${ABILITY_NAMES[ability]}`,
                        modifier: save.mod,
                        inspiration,
                        apresRelance: reloadRemote,
                      })
                    }
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {/*
              V3.1-29 — étroit (moins de 40rem de FICHE) : une ligne « Compétences »
              repliable, fermée par défaut, avec son résumé à droite. Large : le
              titre et la liste d'avant, toujours visibles, bouton masqué.
            */}
            <button
              type="button"
              onClick={() => setCompetencesOuvertes((v) => !v)}
              aria-expanded={competencesOuvertes}
              aria-controls={idCompetences}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-edge/60 bg-panel-raised px-3 py-2.5 text-left @min-[40rem]:hidden"
            >
              <span className="text-sm font-semibold text-ink">Compétences</span>
              <span className="min-w-0 truncate text-xs text-ink-muted">
                {competencesOuvertes
                  ? "replier ▴"
                  : `${resume.maitrisees} ${resume.maitrisees > 1 ? "maîtrisées" : "maîtrisée"}${
                      resume.meilleure ? ` · ${resume.meilleure.nom} ${resume.meilleure.mod >= 0 ? "+" : ""}${resume.meilleure.mod}` : ""
                    } ▾`}
              </span>
            </button>
            <span className="hidden text-[10px] font-bold uppercase tracking-widest text-ink-muted @min-[40rem]:block">
              Compétences · maîtrise {sheet.proficiencyBonus >= 0 ? "+" : ""}
              {sheet.proficiencyBonus}
            </span>
            <div
              id={idCompetences}
              className={`flex-col gap-1.5 @min-[40rem]:flex ${competencesOuvertes ? "flex" : "hidden"}`}
            >
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
                  // `half` (Touche-à-tout, V3.1-46) n'est pas une maîtrise accordée ailleurs.
                  const alreadyGrantedElsewhere = choice ? !isChosen && (result.proficiency === "proficient" || result.proficiency === "expertise") : false;
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
                      <button
                        type="button"
                        title={`Lancer ${SKILL_LABELS_FR[skill]}`}
                        onClick={() =>
                          rollSkill(entityId, skill, advantage, {
                            label: `${SKILL_LABELS_FR[skill]} — test`,
                            modifier: result.mod,
                            inspiration,
                            apresRelance: reloadRemote,
                          })
                        }
                        className="flex flex-1 items-center gap-2 text-left hover:text-accent"
                      >
                        <span className="flex-1 text-ink">{SKILL_LABELS_FR[skill]}</span>
                        <span className="text-[10px] uppercase text-ink-muted">{ABILITY_LABELS[SKILL_ABILITIES[skill]]}</span>
                        <span className="w-8 text-right font-medium text-ink">
                          {result.mod >= 0 ? "+" : ""}
                          {result.mod}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
              {/* Légende de la liste : seulement dans le bloc replié du téléphone. */}
              <p className="text-xs text-ink-muted @min-[40rem]:hidden">● expertise · ◐ maîtrise</p>
              {/* Le sélecteur vit DANS ce bloc (choix de l'auteur) : replié avec lui sur fiche étroite, comme avant au-delà. */}
              <div className="flex items-center gap-2 @min-[40rem]:mt-1.5">
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
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/*
            Onglets en pilule glissante — le dessin et sa mecanique
            vivent dans `components/shared/Tabs.tsx` (ADR 0034), avec le clavier que cette rangee
            n'avait pas. Ne restent ici que la liste et son filtre.

            Plus de condition sur "maitrise" : l'onglet ne portait que les
            bottes d'arme et disparaissait sans elles ; il porte maintenant
            les maitrises et les langues, que tout personnage possede.
          */}
          {/* V3.1-32 : sous 40rem de fiche, la pilule reste collee en haut de la fenetre
              qui defile (`sticky top-0`, fond opaque) ; au-dela, rien ne change. */}
          <div className="sticky top-0 z-10 -mx-1 bg-panel-raised px-1 py-1 @min-[40rem]:static @min-[40rem]:mx-0 @min-[40rem]:bg-transparent @min-[40rem]:p-0">
            <Tabs
              idPrefix="fiche"
              value={tab}
              onChange={setTab}
              aria-label="Sections de la fiche"
              items={(["actions", "inventaire", "magie", "traits", "maitrise"] as Tab[])
                .filter((t) => t !== "magie" || spellcasting)
                .map((t) => ({ value: t, label: TAB_LABELS[t] }))}
            />
          </div>

          <TabPanel idPrefix="fiche" value={tab} className="mt-2 rounded-lg border border-edge bg-panel p-3">
            {tab === "maitrise" && (
              <MasteriesTab
                proficiencies={proficiencies}
                masteryChoices={weaponMasteryChoices}
                masteryChips={weaponMasteryChips}
                languageChoices={languageChoices}
                allLanguages={allLanguages}
                character={character}
                patchCharacter={patchCharacter}
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
                onAttack={(_item, arme) => jets.attaquerArme(arme, advantage)}
                onDamage={(_item, versatile, arme) => jets.degatsArme(arme, versatile)}
                spellcasting={spellcasting}
                preparedSpells={preparedSpells}
                spellSlots={sheet.spellcasting?.slots ?? {}}
                spellSlotsUsed={runtimeState?.spell_slots_used ?? {}}
                spellAttackBonus={sheet.spellcasting?.attackBonus ?? 0}
                spellSaveDc={sheet.spellcasting?.saveDc ?? 0}
                spellAbilityLabel={sheet.spellcasting ? ABILITY_LABELS[sheet.spellcasting.ability] : ""}
                onCast={(_spellKey, _slotLevel, sort) => jets.lancerSort(sort)}
                onCastAttack={(_spellKey, sort) => jets.attaquerSort(sort, advantage)}
                resources={resources}
                resourcesUsed={runtimeState?.resources ?? {}}
                onChangeResource={changeResource}
                pact={sheet.spellcasting?.pactSlots ?? null}
                pactUsed={runtimeState?.pact_slots_used ?? 0}
                classKeys={classKeys}
                onGesteEmplacement={changeEmplacement}
                emplacementsDesactives={!commandes.spell_slots}
              />
            )}

            {tab === "magie" && spellcasting && (
              <MagicTab
                worldSlug={worldSlug}
                sortedKnownSpells={sortedKnownSpells}
                spellChips={spellChips}
                spellcasting={spellcasting}
                grantedSpells={sheet.grantedSpells}
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
                server={{ entityId, campaignId, onBlockRefreshed }}
                monnaieLectureSeule={!commandes.currency}
              />
            )}

            {tab === "traits" && (
              <TraitsTab worldSlug={worldSlug} traits={traits} traitChips={traitChips} traitSourceLabel={traitSourceLabel} />
            )}
          </TabPanel>
        </div>
      </div>
    </div>
  );
}
