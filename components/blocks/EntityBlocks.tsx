"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { computeDroppedOrder } from "@/src/core/ordering/computeDroppedOrder";
import { useCollapsedGroups } from "@/components/shell/useCollapsedGroups";
import Dropdown from "@/components/shared/Dropdown";
import ActionsMenu from "@/components/shared/ActionsMenu";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import TextBlockEditor from "./TextBlockEditor";
import InfoboxBlockEditor from "./InfoboxBlockEditor";
import ImageBlockEditor from "./ImageBlockEditor";
import CustomTableBlockEditor from "./CustomTableBlockEditor";
import RandomTableBlockEditor from "./RandomTableBlockEditor";
import GeneratorBlockEditor from "./GeneratorBlockEditor";
import InventoryBlockEditor from "./InventoryBlockEditor";
import SpellcastingBlockEditor from "./SpellcastingBlockEditor";
import ResourcesBlockEditor from "./ResourcesBlockEditor";
import MusicBlockEditor from "./MusicBlockEditor";
import GenealogyBlockEditor from "./GenealogyBlockEditor";
import QuestBlockEditor from "./QuestBlockEditor";
import SessionLogBlockEditor from "./SessionLogBlockEditor";
import PersonalityBlockEditor from "./PersonalityBlockEditor";
import RelationshipBlockEditor from "./RelationshipBlockEditor";
import WorldviewBlockEditor from "./WorldviewBlockEditor";
import RelationsGraphBlockEditor from "./RelationsGraphBlockEditor";
import TimelineBlockEditor from "./TimelineBlockEditor";
import MapBlockEditor from "./MapBlockEditor";
import MonsterStatblockSheet from "./MonsterStatblockSheet";
import PlayableCharacterSheet from "./PlayableCharacterSheet";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import type { TextBlockData } from "@/src/core/schemas/blocks/text";
import type { InfoboxBlockData } from "@/src/core/schemas/blocks/infobox";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import type { CustomTableBlockData } from "@/src/core/schemas/blocks/customTable";
import type { RandomTableBlockData } from "@/src/core/schemas/blocks/randomTable";
import type { GeneratorBlockData } from "@/src/core/schemas/blocks/generator";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import type { MusicBlockData } from "@/src/core/schemas/blocks/music";
import type { StatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import type { GenealogyBlockData } from "@/src/core/schemas/blocks/genealogy";
import type { QuestBlockData } from "@/src/core/schemas/blocks/quest";
import type { SessionLogBlockData } from "@/src/core/schemas/blocks/sessionLog";
import type { PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import type { RelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import type { WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import type { RelationsGraphBlockData } from "@/src/core/schemas/blocks/relationsGraph";
import type { TimelineBlockData } from "@/src/core/schemas/blocks/timeline";
import type { MapBlockData } from "@/src/core/schemas/blocks/map";
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";

export interface BlockItem {
  id: string;
  entityId: string;
  blockType: string;
  display: BlockDisplay;
  data: unknown;
  displayOrder: number;
  version: number;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  text: "Texte",
  infobox: "Encadré",
  image: "Image",
  custom_table: "Tableau",
  random_table: "Table aléatoire",
  generator: "Générateur",
  character: "Personnage",
  inventory: "Inventaire",
  spellcasting: "Incantation",
  resources: "Ressources",
  statblock: "Fiche de créature",
  music: "Musique",
  genealogy: "Généalogie",
  quest: "Quête",
  session_log: "Journal de séance",
  personality: "Personnalité",
  relationship: "Relation",
  worldview: "Convictions",
  relations_graph: "Réseau",
  timeline: "Chronologie",
  map: "Carte",
};

function BlockDataEditor({
  block,
  onChange,
  onSaveNow,
  worldSlug,
  worldId,
  otherEntities,
  onRelationsChanged,
  relationsReloadSignal,
  characterData,
  onBlockRefreshed,
  hideAiAssist,
}: {
  block: BlockItem;
  onChange: (data: unknown) => void;
  /** Bloc `map` (Lot I) : upload/changement de vue par defaut doivent persister immediatement — la sauvegarde habituelle (perte de focus du conteneur du bloc) ne se declenche pas de maniere fiable depuis une fenetre modale imbriquee dans ce meme conteneur. Reutilise le mecanisme de surcharge deja en place pour la visibilite (`onSaveBlock` cote `SortableBlockCard`). */
  onSaveNow?: (data: unknown) => void;
  worldSlug: string;
  /** V2-H3 : necessaire pour "creer la carte «X»" depuis le bloc genealogie sans faire remonter le monde entier. */
  worldId: string;
  /** V2-H3 : meme liste que RelationsChips.tsx, reutilisee pour la recherche du "+" du bloc genealogie. */
  otherEntities: OtherEntityOption[];
  /** V2-H3 : rafraichit la section "Relations" en tete de fiche apres un ajout depuis le bloc genealogie. */
  onRelationsChanged: () => void;
  /** V2, retour utilisateur : incremente ailleurs sur la page (liste de relations, autre bloc) — force genealogie/reseau a recharger leur graphe, qu'ils chargent via leur propre `useEffect` sans jamais dependre de `router.refresh()`. */
  relationsReloadSignal: number;
  /** Bloc `character` de la meme entite, s'il existe (V1-C18) — permet au bloc `inventory` autonome d'afficher les memes lignes Attaquer/Degats et la meme barre de charge que l'onglet Inventaire de la fiche jouable, sans dupliquer le calcul. */
  characterData: CharacterBlockData | undefined;
  /** Assistance IA du bloc `text` (V1-F3) : une proposition appliquee ecrit cote serveur, ce callback resynchronise l'etat local (donnee + version). */
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
  /** Coquille joueur (retour utilisateur) : "enlever les outils d'assistance IA" — jamais pour le MJ. */
  hideAiAssist?: boolean;
}) {
  switch (block.blockType) {
    case "text":
      return (
        <TextBlockEditor
          data={block.data as TextBlockData}
          onChange={(d) => onChange(d)}
          entityId={block.entityId}
          blockId={block.id}
          onBlockRefreshed={onBlockRefreshed}
          hideAssist={hideAiAssist}
        />
      );
    case "infobox":
      return (
        <InfoboxBlockEditor data={block.data as InfoboxBlockData} onChange={(d) => onChange(d)} />
      );
    case "image":
      return <ImageBlockEditor blockId={block.id} data={block.data as ImageBlockData} onChange={(d) => onChange(d)} />;
    case "custom_table":
      return (
        <CustomTableBlockEditor
          data={block.data as CustomTableBlockData}
          onChange={(d) => onChange(d)}
        />
      );
    case "random_table":
      return (
        <RandomTableBlockEditor
          data={block.data as RandomTableBlockData}
          onChange={(d) => onChange(d)}
          blockId={block.id}
        />
      );
    case "generator":
      return (
        <GeneratorBlockEditor
          data={block.data as GeneratorBlockData}
          onChange={(d) => onChange(d)}
          blockId={block.id}
        />
      );
    case "inventory":
      return (
        <InventoryBlockEditor
          data={block.data as InventoryBlockData}
          onChange={(d) => onChange(d)}
          worldSlug={worldSlug}
          character={characterData}
        />
      );
    case "spellcasting":
      return (
        <SpellcastingBlockEditor
          data={block.data as SpellcastingBlockData}
          onChange={(d) => onChange(d)}
          worldSlug={worldSlug}
        />
      );
    case "resources":
      return (
        <ResourcesBlockEditor data={block.data as ResourcesBlockData} onChange={(d) => onChange(d)} />
      );
    case "music":
      return (
        <MusicBlockEditor data={block.data as MusicBlockData} onChange={(d) => onChange(d)} blockId={block.id} />
      );
    case "genealogy":
      return (
        <GenealogyBlockEditor
          entityId={block.entityId}
          worldId={worldId}
          worldSlug={worldSlug}
          data={block.data as GenealogyBlockData}
          otherEntities={otherEntities}
          onRelationsChanged={onRelationsChanged}
          reloadSignal={relationsReloadSignal}
        />
      );
    case "quest":
      return (
        <QuestBlockEditor
          blockId={block.id}
          version={block.version}
          data={block.data as QuestBlockData}
          otherEntities={otherEntities}
          onChange={(d) => onChange(d)}
          onBlockRefreshed={onBlockRefreshed}
        />
      );
    case "session_log":
      return (
        <SessionLogBlockEditor
          blockId={block.id}
          version={block.version}
          data={block.data as SessionLogBlockData}
          onBlockRefreshed={onBlockRefreshed}
        />
      );
    case "personality":
      return (
        <PersonalityBlockEditor
          blockId={block.id}
          version={block.version}
          entityId={block.entityId}
          worldSlug={worldSlug}
          data={block.data as PersonalityBlockData}
          onChange={(d) => onChange(d)}
          onBlockRefreshed={onBlockRefreshed}
        />
      );
    case "relationship":
      return (
        <RelationshipBlockEditor
          entityId={block.entityId}
          worldSlug={worldSlug}
          data={block.data as RelationshipBlockData}
          otherEntities={otherEntities}
          onChange={(d) => onChange(d)}
        />
      );
    case "worldview":
      return (
        <WorldviewBlockEditor
          blockId={block.id}
          version={block.version}
          entityId={block.entityId}
          worldSlug={worldSlug}
          data={block.data as WorldviewBlockData}
          onChange={(d) => onChange(d)}
          onBlockRefreshed={onBlockRefreshed}
        />
      );
    case "relations_graph":
      return (
        <RelationsGraphBlockEditor
          entityId={block.entityId}
          worldSlug={worldSlug}
          data={block.data as RelationsGraphBlockData}
          onChange={(d) => onChange(d)}
          onRelationsChanged={onRelationsChanged}
          reloadSignal={relationsReloadSignal}
        />
      );
    case "timeline":
      return (
        <TimelineBlockEditor
          blockId={block.id}
          version={block.version}
          worldSlug={worldSlug}
          data={block.data as TimelineBlockData}
          otherEntities={otherEntities}
          onChange={(d) => onChange(d)}
          onBlockRefreshed={onBlockRefreshed}
        />
      );
    case "map":
      return (
        <MapBlockEditor
          worldSlug={worldSlug}
          data={block.data as MapBlockData}
          visibilityLevel={block.visibilityLevel}
          visibilityScopeId={block.visibilityScopeId}
          onChange={(d) => onChange(d)}
          onSaveNow={onSaveNow ? (d) => onSaveNow(d) : undefined}
        />
      );
    default:
      return <p className="text-sm text-danger">Type de bloc inconnu : {block.blockType}</p>;
  }
}

/**
 * Blocs discrets, toujours editables en place — comme l'ancienne
 * application (master, EntityDetail.tsx) : pas d'encadre par bloc, juste
 * un separateur ; la sauvegarde se declenche a la perte de focus, jamais
 * par un bouton "Enregistrer" a chercher. Le type d'un bloc ne presuppose
 * plus son role (V0-06e) : un bloc `text` peut porter n'importe quel titre
 * ("Description", "Histoire"...), c'est le titre qui porte le sens.
 */
export default function EntityBlocks({
  entityId,
  worldId,
  initialBlocks,
  worldSlug,
  otherEntities,
  onLaunchWizard,
  relationsReloadSignal,
  onRelationsChanged: onRelationsChangedFromParent,
  restrictAddableTypes,
  hideAiAssist,
}: {
  entityId: string;
  /** V2-H3 : necessaire pour "creer la carte «X»" depuis le bloc genealogie. */
  worldId: string;
  initialBlocks: BlockItem[];
  worldSlug: string;
  /** V2-H3 : meme liste que RelationsChips.tsx, reutilisee par le bloc genealogie. */
  otherEntities: OtherEntityOption[];
  /** Assistant de creation (retour utilisateur, suite) — omis quand aucun parent ne le fournit (ex. contextes hors fiche de monde), le bouton reste alors absent plutot que sans effet. */
  onLaunchWizard?: () => void;
  /** Coquille joueur (retour utilisateur, V2-M7b) : "je ne leur donnerais pas le droit d'ajouter d'autre bloc que ceux de texte, si les joueurs veulent ajouter des choses il faudra demander au MJ" — limite la barre "Ajouter un bloc" a ces types, `undefined` (MJ) laisse tout disponible. */
  restrictAddableTypes?: string[];
  /** Coquille joueur (retour utilisateur) : "enlever les outils d'assistance IA" — masque le panneau Assistance IA des blocs `text`, jamais pour le MJ. */
  hideAiAssist?: boolean;
  /** V2, retour utilisateur : compteur possede par le parent (EditEntityForm), partage avec RelationsChips — force genealogie/reseau a recharger quand une relation change ailleurs sur la page. Absent hors contexte de fiche complete (ex. fenetre isolee) : les deux blocs retombent alors sur leur seul rechargement interne. */
  relationsReloadSignal?: number;
  onRelationsChanged?: () => void;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<BlockItem[]>(initialBlocks);
  // Retour utilisateur : le pli/depli d'un bloc ne survivait pas a un
  // rechargement (Set en memoire) — meme mecanisme de persistance que le
  // sommaire (`useCollapsedGroups`, deja teste), une cle par fiche pour ne
  // jamais melanger les plis d'une fiche avec ceux d'une autre.
  const { isCollapsed, toggle: toggleCollapsed } = useCollapsedGroups(`creadonjon:collapsed:blocks:${entityId}`);
  const [conflictedIds, setConflictedIds] = useState<Set<string>>(new Set());
  /** Distinct de `conflictedIds` (409, "rechargez") : un 400/500 signifie que la donnee elle-meme est rejetee (ex. `label` vide sur un objet d'inventaire) — se recharger ne change rien tant que la donnee n'est pas corrigee. Avant ce complement, `doSaveBlock` avalait ces echecs sans rien afficher : le bouton semblait "ne rien faire". */
  const [saveErrorIds, setSaveErrorIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const versionsRef = useRef<Record<string, number>>(
    Object.fromEntries(initialBlocks.map((b) => [b.id, b.version])),
  );
  const saveChainsRef = useRef<Record<string, Promise<void>>>({});
  /**
   * Miroir synchrone de `blocks`, mis a jour dans le meme appel que
   * `setBlocks` (jamais via un effet — un effet ne se declenche qu'apres
   * le rendu suivant, trop tard pour l'usage vise ici). `doSaveBlock` lit
   * ce ref plutot que `blocks` : un blur peut survenir avant que React
   * n'ait rendu la mise a jour du tout dernier `onChange` (frappe rapide
   * puis clic hors du bloc), auquel cas `blocks` ferme sur une valeur
   * perimee et la sauvegarde envoie l'AVANT-derniere frappe, pas la
   * derniere — bug reel trouve en testant le bloc `personality` (V2-H1),
   * touchait potentiellement tout champ texte de tout type de bloc.
   */
  const blocksRef = useRef<BlockItem[]>(initialBlocks);
  function updateBlocks(updater: (prev: BlockItem[]) => BlockItem[]) {
    blocksRef.current = updater(blocksRef.current);
    setBlocks(blocksRef.current);
  }

  const sortedBlocks = [...blocks].sort((a, b) => a.displayOrder - b.displayOrder);
  const characterBlock = blocks.find((b) => b.blockType === "character");
  const inventoryBlock = blocks.find((b) => b.blockType === "inventory");
  const spellcastingBlock = blocks.find((b) => b.blockType === "spellcasting");
  const resourcesBlock = blocks.find((b) => b.blockType === "resources");

  /** Onglet Traits (V1-C4 suite) : la fiche jouable edite desormais le bloc `character` en entier — plus de formulaire brut separe en dessous. */
  function updateCharacter(data: CharacterBlockData) {
    if (!characterBlock) return;
    patchBlock(characterBlock.id, { data });
    saveBlock(characterBlock.id, { data });
  }

  /**
   * Meme bloc `inventory` que l'onglet Inventaire de la fiche jouable et
   * l'editeur — une seule donnee, deux vues (V1-B5, §5.1). Cree le bloc a
   * la volee s'il n'existe pas encore : la fiche jouable affiche toujours
   * l'onglet Inventaire (etat vide par defaut cote `PlayableCharacterSheet`)
   * meme quand aucun bloc `inventory` n'a ete ajoute a l'entite — sans ce
   * bootstrap, "Ajouter un objet"/les pieces semblaient ne rien faire :
   * `if (!inventoryBlock) return` avalait silencieusement la modification.
   */
  async function updateInventory(data: InventoryBlockData) {
    if (inventoryBlock) {
      patchBlock(inventoryBlock.id, { data });
      saveBlock(inventoryBlock.id, { data });
      return;
    }
    const created = await createBlockWithData("inventory", data);
    if (created) updateBlocks((prev) => [...prev, created]);
  }

  /** Meme motif que `updateInventory` (bootstrap-si-absent) — l'onglet Magie coche « Préparé » avant qu'un bloc `spellcasting` existe forcément deja (V1-C6). */
  async function updateSpellcasting(data: SpellcastingBlockData) {
    if (spellcastingBlock) {
      patchBlock(spellcastingBlock.id, { data });
      saveBlock(spellcastingBlock.id, { data });
      return;
    }
    const created = await createBlockWithData("spellcasting", data);
    if (created) updateBlocks((prev) => [...prev, created]);
  }

  /** Cree un bloc puis lui pose immediatement de vraies donnees — la creation seule ne prend que le defaut du registre. Aller-retour direct plutot que `saveBlock` : juste apres `setBlocks`, le bloc cree n'est pas encore dans le `blocks` capture par la fermeture de cet appel, et `doSaveBlock` (qui cherche le bloc par id dans `blocks`) le raterait silencieusement. */
  async function createBlockWithData(blockType: string, data: unknown): Promise<BlockItem | null> {
    const res = await fetch(`/api/entities/${entityId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId,
        blockType,
        label: BLOCK_TYPE_LABELS[blockType],
        visibility: { level: "public", scopeId: null },
      }),
    });
    if (!res.ok) return null;
    const block = (await res.json()) as BlockItem;
    versionsRef.current[block.id] = block.version;

    const patchRes = await fetch(`/api/blocks/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: block.version,
        display: block.display,
        data,
        visibility: { level: block.visibilityLevel, scopeId: block.visibilityScopeId ?? null },
      }),
    });
    if (!patchRes.ok) {
      setSaveErrorIds((prev) => new Set(prev).add(block.id));
      return block;
    }
    const updated = (await patchRes.json()) as BlockItem;
    versionsRef.current[updated.id] = updated.version;
    return updated;
  }

  function patchBlock(id: string, patch: Partial<BlockItem>) {
    updateBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  /**
   * Une proposition IA appliquee (V1-F3) ecrit le bloc cote serveur en
   * dehors de la chaine `saveBlock` habituelle — `versionsRef` doit suivre,
   * sinon la prochaine edition manuelle de ce bloc PATCH avec une version
   * perimee et echoue en 409 (conflit fantome, alors que rien n'est
   * reellement en conflit du point de vue de l'utilisateur).
   */
  function handleBlockRefreshed(fresh: { id: string; data: unknown; version: number }) {
    versionsRef.current[fresh.id] = fresh.version;
    patchBlock(fresh.id, { data: fresh.data, version: fresh.version });
  }

  async function addBlock(blockType: string) {
    const res = await fetch(`/api/entities/${entityId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId,
        blockType,
        label: BLOCK_TYPE_LABELS[blockType],
        visibility: { level: "public", scopeId: null },
      }),
    });
    if (!res.ok) return;
    const block = (await res.json()) as BlockItem;
    versionsRef.current[block.id] = block.version;
    updateBlocks((prev) => [...prev, block]);
  }

  /**
   * Sauvegardes serialisees par bloc (via versionsRef + une chaine de
   * promesses par id) : un blur et un changement de visibilite peuvent se
   * declencher a quelques millisecondes d'intervalle sur le meme bloc, et
   * s'ils partaient en parallele avec la version lue depuis le state React,
   * le second arrivait toujours avec une version deja perimee (409) et son
   * changement disparaissait sans message clair. La chaine garantit que le
   * second n'part qu'une fois le premier resolu, avec la version a jour.
   */
  function saveBlock(
    id: string,
    overrides?: { visibilityLevel?: string; visibilityScopeId?: string | null; data?: unknown },
  ) {
    const run = () => doSaveBlock(id, overrides);
    const previous = saveChainsRef.current[id] ?? Promise.resolve();
    const next = previous.then(run, run);
    saveChainsRef.current[id] = next;
    return next;
  }

  async function doSaveBlock(
    id: string,
    overrides?: { visibilityLevel?: string; visibilityScopeId?: string | null; data?: unknown },
  ) {
    const block = blocksRef.current.find((b) => b.id === id);
    if (!block) return;

    const res = await fetch(`/api/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: versionsRef.current[id],
        display: block.display,
        // "data" en surcharge, jamais lu depuis `block` : `patchBlock` puis
        // `saveBlock` dans le meme appel synchrone (ex. updateCharacterChoices)
        // fermerait sinon sur le `blocks` d'AVANT le patch, perime tant que
        // React n'a pas re-rendu (meme raison que overrides.visibilityLevel
        // ci-dessous, deja en place).
        data: overrides && "data" in overrides ? overrides.data : block.data,
        visibility: {
          level: overrides?.visibilityLevel ?? block.visibilityLevel,
          scopeId: overrides?.visibilityScopeId ?? block.visibilityScopeId ?? null,
        },
      }),
    });

    if (res.status === 409) {
      setConflictedIds((prev) => new Set(prev).add(id));
      return;
    }
    if (!res.ok) {
      setSaveErrorIds((prev) => new Set(prev).add(id));
      return;
    }

    const updated = (await res.json()) as BlockItem;
    versionsRef.current[id] = updated.version;
    patchBlock(id, { version: updated.version });
    setConflictedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSaveErrorIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleBlockBlur(id: string) {
    return (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      saveBlock(id);
    };
  }

  async function confirmDeleteBlock() {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (!id) return;
    await fetch(`/api/blocks/${id}`, { method: "DELETE" });
    updateBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  /**
   * Pas de route dediee "dupliquer" : on cree un bloc vide du meme type
   * puis on le remplit du contenu de l'original en une seconde requete —
   * reutilise l'existant plutot qu'un nouvel endpoint pour un besoin simple.
   * Le bloc duplique atterrit en fin de liste (meme regle que "+ Ajouter").
   */
  async function duplicateBlock(id: string) {
    const original = blocksRef.current.find((b) => b.id === id);
    if (!original) return;

    const createRes = await fetch(`/api/entities/${entityId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId,
        blockType: original.blockType,
        label: original.display.label || BLOCK_TYPE_LABELS[original.blockType],
        visibility: { level: original.visibilityLevel, scopeId: original.visibilityScopeId },
      }),
    });
    if (!createRes.ok) return;
    const created = (await createRes.json()) as BlockItem;

    const fillRes = await fetch(`/api/blocks/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: created.version,
        display: original.display,
        data: original.data,
        visibility: { level: original.visibilityLevel, scopeId: original.visibilityScopeId },
      }),
    });
    if (!fillRes.ok) {
      versionsRef.current[created.id] = created.version;
      updateBlocks((prev) => [...prev, created]);
      return;
    }
    const filled = (await fillRes.json()) as BlockItem;
    versionsRef.current[filled.id] = filled.version;
    updateBlocks((prev) => [...prev, filled]);
  }

  /** Ecrit le nouveau `display_order` (une seule colonne, une seule ligne) — commun aux boutons Monter/Descendre et au glisser-deposer, qui ne different que par le calcul de `newOrder` en amont. */
  async function moveBlockTo(id: string, newOrder: number) {
    const current = blocksRef.current.find((b) => b.id === id);
    if (!current) return;
    const res = await fetch(`/api/blocks/${id}/order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: current.version, displayOrder: newOrder }),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as BlockItem;
    versionsRef.current[id] = updated.version;
    patchBlock(id, { displayOrder: updated.displayOrder, version: updated.version });
  }

  async function moveBlock(id: string, direction: "up" | "down") {
    const index = sortedBlocks.findIndex((b) => b.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedBlocks.length) return;

    const neighbor = sortedBlocks[swapIndex];
    const beyond = direction === "up" ? sortedBlocks[swapIndex - 1] : sortedBlocks[swapIndex + 1];
    const newOrder = beyond
      ? (beyond.displayOrder + neighbor.displayOrder) / 2
      : neighbor.displayOrder + (direction === "up" ? -1000 : 1000);
    await moveBlockTo(id, newOrder);
  }

  /**
   * Glisser-deposer (V2-G1) : memes garanties que Monter/Descendre — un
   * seul `PATCH /api/blocks/[id]/order`, la meme verification de version
   * cote serveur (`reorderBlock`), jamais un lot special pour le
   * glisser-depose. `PointerSensor` couvre souris ET tactile ; `KeyboardSensor`
   * rend la liste reordonnable au clavier (Tab jusqu'a la poignee, puis
   * fleches), ce que les boutons Monter/Descendre offraient deja mais que
   * le glisser-depose natif HTML5 n'aurait pas fourni tout seul.
   */
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newOrder = computeDroppedOrder(sortedBlocks, String(active.id), String(over.id));
    if (newOrder === null) return;
    void moveBlockTo(String(active.id), newOrder);
  }

  return (
    <div className="flex flex-col">
      {/* `id` fige (V2-G1) : sans lui, l'identifiant interne d'accessibilite
          de dnd-kit (`aria-describedby="DndDescribedBy-N"`) est un compteur
          incremente a chaque montage — different entre le rendu serveur et
          l'hydratation client des qu'une AUTRE instance de ce composant a
          deja incremente ce compteur ailleurs sur la page (ex. plusieurs
          fenetres d'entite ouvertes). Base sur `entityId`, deja stable et
          identique cote serveur/client. */}
      <DndContext id={`entity-blocks-${entityId}`} sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {sortedBlocks.map((block, index) => (
            <SortableBlockCard
              key={block.id}
              block={block}
              index={index}
              lastIndex={sortedBlocks.length - 1}
              isCollapsed={isCollapsed(block.id)}
              hasConflict={conflictedIds.has(block.id)}
              hasSaveError={saveErrorIds.has(block.id)}
              worldSlug={worldSlug}
              worldId={worldId}
              otherEntities={otherEntities}
              onRelationsChanged={() => {
                router.refresh();
                onRelationsChangedFromParent?.();
              }}
              relationsReloadSignal={relationsReloadSignal ?? 0}
              entityId={entityId}
              characterBlock={characterBlock}
              inventoryBlock={inventoryBlock}
              spellcastingBlock={spellcastingBlock}
              resourcesBlock={resourcesBlock}
              onToggleCollapsed={toggleCollapsed}
              onPatchBlock={patchBlock}
              onSaveBlock={saveBlock}
              onMoveBlock={moveBlock}
              onDuplicateBlock={duplicateBlock}
              onRequestDelete={setPendingDeleteId}
              onUpdateCharacter={updateCharacter}
              onUpdateInventory={updateInventory}
              onUpdateSpellcasting={updateSpellcasting}
              onBlockRefreshed={handleBlockRefreshed}
              onBlur={handleBlockBlur(block.id)}
              hideAiAssist={hideAiAssist}
            />
          ))}
        </SortableContext>
      </DndContext>
      {sortedBlocks.length === 0 && (
        <p className="py-4 text-center text-xs italic text-ink-muted">
          Aucun bloc. Utilisez la barre ci-dessous pour en ajouter.
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-edge pt-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          Ajouter un bloc :
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {onLaunchWizard && (
            <button
              type="button"
              onClick={onLaunchWizard}
              title={characterBlock ? "Remplace le personnage actuel de cette fiche" : undefined}
              className="rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
            >
              + Assistant de création
            </button>
          )}
          {Object.entries(BLOCK_TYPE_LABELS)
            .filter(([type]) => !restrictAddableTypes || restrictAddableTypes.includes(type))
            .map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => addBlock(type)}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
            >
              + {label}
            </button>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Supprimer ce bloc ?"
        message="Cette action retire le bloc de la fiche. Il reste consultable dans l'historique de l'entité."
        confirmLabel="Supprimer"
        danger
        onConfirm={confirmDeleteBlock}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}

/**
 * Une carte de bloc, glissable (V2-G1) — extraite d'`EntityBlocks` pour que
 * `useSortable` (un hook) s'appelle une fois PAR INSTANCE de composant,
 * jamais une fois par iteration d'une boucle `.map()` a l'interieur du
 * composant parent (regle des hooks : leur nombre d'appels ne doit jamais
 * dependre du nombre de blocs).
 */
function SortableBlockCard({
  block,
  index,
  lastIndex,
  isCollapsed,
  hasConflict,
  hasSaveError,
  worldSlug,
  worldId,
  otherEntities,
  onRelationsChanged,
  relationsReloadSignal,
  entityId,
  characterBlock,
  inventoryBlock,
  spellcastingBlock,
  resourcesBlock,
  onToggleCollapsed,
  onPatchBlock,
  onSaveBlock,
  onMoveBlock,
  onDuplicateBlock,
  onRequestDelete,
  onUpdateCharacter,
  onUpdateInventory,
  onUpdateSpellcasting,
  onBlockRefreshed,
  onBlur,
  hideAiAssist,
}: {
  block: BlockItem;
  index: number;
  lastIndex: number;
  isCollapsed: boolean;
  hasConflict: boolean;
  hasSaveError: boolean;
  worldSlug: string;
  worldId: string;
  otherEntities: OtherEntityOption[];
  onRelationsChanged: () => void;
  relationsReloadSignal: number;
  entityId: string;
  characterBlock: BlockItem | undefined;
  inventoryBlock: BlockItem | undefined;
  spellcastingBlock: BlockItem | undefined;
  resourcesBlock: BlockItem | undefined;
  onToggleCollapsed: (id: string) => void;
  onPatchBlock: (id: string, patch: Partial<BlockItem>) => void;
  onSaveBlock: (id: string, overrides?: { visibilityLevel?: string; visibilityScopeId?: string | null; data?: unknown }) => void;
  onMoveBlock: (id: string, direction: "up" | "down") => void;
  onDuplicateBlock: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onUpdateCharacter: (data: CharacterBlockData) => void;
  onUpdateInventory: (data: InventoryBlockData) => void;
  onUpdateSpellcasting: (data: SpellcastingBlockData) => void;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
  onBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  hideAiAssist?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onBlur={onBlur}
      className={`border-b border-edge/60 py-4 first:pt-0 last:border-b-0 ${isDragging ? "relative z-10 bg-panel opacity-90" : ""}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-1.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab text-ink-muted transition-colors hover:text-ink active:cursor-grabbing"
            title="Glisser pour réordonner"
            aria-label="Réordonner ce bloc"
          >
            ⠿
          </button>
          {block.blockType !== "statblock" && (
            <button
              type="button"
              onClick={() => onToggleCollapsed(block.id)}
              className="shrink-0 text-ink-muted transition-transform hover:text-ink"
              style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              title={isCollapsed ? "Déplier" : "Replier"}
            >
              ▾
            </button>
          )}
          <input
            value={block.display.label}
            placeholder={BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType}
            onChange={(e) => onPatchBlock(block.id, { display: { ...block.display, label: e.target.value } })}
            className="block-title flex-1 bg-transparent outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:italic placeholder:text-ink-muted focus:border-b focus:border-accent"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-edge bg-panel-raised px-2 py-0.5 text-xs text-ink-muted">
            {BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType}
          </span>
          <Dropdown
            value={block.visibilityLevel}
            options={VISIBILITY_OPTIONS}
            onChange={(v) => {
              onPatchBlock(block.id, { visibilityLevel: v });
              onSaveBlock(block.id, { visibilityLevel: v });
            }}
            aria-label="Visibilité du bloc"
            className="rounded-full border border-edge bg-panel-raised px-2 py-0.5 text-xs text-ink transition-colors hover:bg-panel"
          />
          <button
            type="button"
            onClick={() => onMoveBlock(block.id, "up")}
            disabled={index === 0}
            className="text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
            aria-label="Monter"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMoveBlock(block.id, "down")}
            disabled={index === lastIndex}
            className="text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
            aria-label="Descendre"
          >
            ▼
          </button>
          <ActionsMenu
            aria-label="Actions du bloc"
            items={[
              { label: "Dupliquer", onSelect: () => onDuplicateBlock(block.id) },
              { label: "Supprimer", onSelect: () => onRequestDelete(block.id), danger: true },
            ]}
          />
        </div>
      </div>

      {hasConflict && (
        <p className="mb-2 text-xs text-danger">Modifié entre-temps. Rechargez la page avant de réessayer.</p>
      )}
      {hasSaveError && (
        <p className="mb-2 text-xs text-danger">
          Cette modification n&apos;a pas pu être enregistrée. Vérifiez les champs (ex. un nom vide) et réessayez.
        </p>
      )}

      {/* La fiche jouable (V1-B5) vit dans la carte du bloc `character`
          lui-meme — plus de panneau de stats separe au-dessus de la
          liste des blocs (V1-C4, specs/arbitrage-modifications.md §3.1).
          Son onglet Traits edite desormais le build en entier (espece,
          classes, caracteristiques, genre/pronoms) : plus de formulaire
          brut separe en dessous pour ce type de bloc (suite V1-C4).

          Le bloc `inventory`, lui, GARDE sa propre carte brute
          (BlockDataEditor generique ci-dessous) en plus de l'onglet
          Inventaire de la fiche jouable — demande explicite : un MJ
          doit pouvoir montrer l'inventaire seul (ex. fenetre separee)
          sans exposer toute la fiche de personnage. Les deux vues
          editent le meme bloc (meme `id`, meme etat React `blocks`) :
          une modification dans l'une declenche patchBlock/saveBlock
          sur ce bloc, l'autre vue se re-rend avec la donnee a jour au
          prochain rendu — synchronise sans mecanisme dedie. */}
      {block.blockType === "character" ? (
        !isCollapsed && (
          <PlayableCharacterSheet
            worldSlug={worldSlug}
            entityId={entityId}
            campaignId={null}
            character={block.data as CharacterBlockData}
            inventory={inventoryBlock?.data as InventoryBlockData | undefined}
            spellcasting={spellcastingBlock?.data as SpellcastingBlockData | undefined}
            resources={resourcesBlock?.data as ResourcesBlockData | undefined}
            characterBlockId={block.id}
            characterBlockVersion={block.version}
            onUpdateCharacter={onUpdateCharacter}
            onUpdateInventory={onUpdateInventory}
            onUpdateSpellcasting={onUpdateSpellcasting}
            onBlockRefreshed={onBlockRefreshed}
          />
        )
      ) : block.blockType === "statblock" ? (
        <MonsterStatblockSheet data={block.data as StatblockBlockData} onChange={(data) => onPatchBlock(block.id, { data })} />
      ) : (
        !isCollapsed && (
          <BlockDataEditor
            block={block}
            onChange={(data) => onPatchBlock(block.id, { data })}
            onSaveNow={(data) => onSaveBlock(block.id, { data })}
            worldSlug={worldSlug}
            worldId={worldId}
            otherEntities={otherEntities}
            onRelationsChanged={onRelationsChanged}
            relationsReloadSignal={relationsReloadSignal}
            characterData={characterBlock?.data as CharacterBlockData | undefined}
            onBlockRefreshed={onBlockRefreshed}
            hideAiAssist={hideAiAssist}
          />
        )
      )}
    </div>
  );
}
