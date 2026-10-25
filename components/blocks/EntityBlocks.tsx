"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { computeDroppedOrder } from "@/src/core/ordering/computeDroppedOrder";
import { useCollapsedGroups } from "@/components/shell/useCollapsedGroups";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import BlockCard from "@/components/blocks/BlockCard";
import { AnnonceVisibiliteProvider } from "@/components/shared/AnnonceVisibilite";
import {
  annonceReordonnancement,
  famillesAjoutables,
} from "@/lib/ui/ficheBlocs";
import { EditCommitProvider } from "@/components/shared/EditCommitContext";
/**
 * V3-R3 — les 21 vues de bloc sont chargees a la demande, jamais dans le
 * paquet initial.
 *
 * Importees statiquement, elles tiraient 272 fichiers / 44 048 lignes sur
 * TOUTE fiche ouverte : Tiptap (bloc texte), `d3-force` (reseau de
 * relations), le canevas de carte, la fiche de creature, l'assistant de
 * personnage. Une fiche ne contenant qu'un bloc texte payait le canevas de
 * carte et le moteur de graphe.
 *
 * Le gain grandit avec le projet, et c'est ce qui rend ce decoupage durable :
 * le 22e type de bloc ne s'ajoutera plus au paquet initial comme les 21
 * precedents.
 *
 * PAS de `ssr: false`, contrairement a `VoletsLayer.tsx` : ces vues
 * SONT rendues cote serveur et doivent le rester. Le balisage arrive donc
 * complet dans le HTML, la mise en page est juste des le premier pixel, et
 * seul le JS d'hydratation est differe — c'est ce qui evite le saut de mise
 * en page qu'un etat de chargement aurait cause. Un bloc replie
 * (`isCollapsed`) ne rend rien, donc ne telecharge rien non plus.
 *
 * `switch` de `BlockDataEditor` inchange : tout le decoupage tient dans ces
 * declarations, un seul endroit a tenir a jour.
 */
const TextBlockEditor = dynamic(() => import("./TextBlockEditor"));
const InfoboxBlockEditor = dynamic(() => import("./InfoboxBlockEditor"));
const ImageBlockEditor = dynamic(() => import("./ImageBlockEditor"));
const CustomTableBlockEditor = dynamic(
  () => import("./CustomTableBlockEditor"),
);
const RandomTableBlockEditor = dynamic(
  () => import("./RandomTableBlockEditor"),
);
const GeneratorBlockEditor = dynamic(() => import("./GeneratorBlockEditor"));
const InventoryBlockEditor = dynamic(() => import("./InventoryBlockEditor"));
const SpellcastingBlockEditor = dynamic(
  () => import("./SpellcastingBlockEditor"),
);
const ResourcesBlockEditor = dynamic(() => import("./ResourcesBlockEditor"));
const MusicBlockEditor = dynamic(() => import("./MusicBlockEditor"));
const GenealogyBlockEditor = dynamic(() => import("./GenealogyBlockEditor"));
const QuestBlockEditor = dynamic(() => import("./QuestBlockEditor"));
const PersonalityBlockEditor = dynamic(
  () => import("./PersonalityBlockEditor"),
);
const RelationshipBlockEditor = dynamic(
  () => import("./RelationshipBlockEditor"),
);
const WorldviewBlockEditor = dynamic(() => import("./WorldviewBlockEditor"));
const RelationsGraphBlockEditor = dynamic(
  () => import("./RelationsGraphBlockEditor"),
);
const TimelineBlockEditor = dynamic(() => import("./TimelineBlockEditor"));
const MapBlockEditor = dynamic(() => import("./MapBlockEditor"));
const MonsterStatblockSheet = dynamic(() => import("./MonsterStatblockSheet"));
const PlayableCharacterSheet = dynamic(
  () => import("./PlayableCharacterSheet"),
);
const SessionJournalMetaBlockEditor = dynamic(
  () => import("./SessionJournalMetaBlockEditor"),
);
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
import type { PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import type { RelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import type { WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import type { RelationsGraphBlockData } from "@/src/core/schemas/blocks/relationsGraph";
import type { TimelineBlockData } from "@/src/core/schemas/blocks/timeline";
import type { MapBlockData } from "@/src/core/schemas/blocks/map";
import type { SessionJournalMetaBlockData } from "@/src/core/schemas/blocks/sessionJournalMeta";
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
  /** V3.1-64 : le lecteur n'est pas l'auteur (`VisibleBlock.nonAuteur`) ; « Privé » ne lui est pas proposé. */
  nonAuteur?: boolean;
}

export const BLOCK_TYPE_LABELS: Record<string, string> = {
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
  personality: "Personnalité",
  relationship: "Relation",
  worldview: "Convictions",
  relations_graph: "Réseau",
  timeline: "Chronologie",
  map: "Carte",
  session_journal_meta: "Séance",
};

/**
 * V3.1-31 : exporte pour l'editeur plein ecran, qui montre CE meme aiguillage
 * type -> editeur sur son brouillon (donnee / `onChange`), sans le recopier.
 */
export function BlockDataEditor({
  block,
  onChange,
  worldSlug,
  worldId,
  campaignId,
  otherEntities,
  onRelationsChanged,
  relationsReloadSignal,
  characterData,
  onBlockRefreshed,
  hideAiAssist,
  siblings,
  entityKind,
  onEnregistrer,
}: {
  block: BlockItem;
  onChange: (data: unknown) => void;
  worldSlug: string;
  /** V2-H3 : necessaire pour "creer la carte «X»" depuis le bloc genealogie sans faire remonter le monde entier. */
  worldId: string;
  /** V2.1-3 (suite) : necessaire au bloc `session_journal_meta` (roster des autrices possibles, liste des seances reelles) — `null` hors contexte de campagne. */
  campaignId: string | null;
  /** V2-H3 : meme liste que RelationsChips.tsx, reutilisee pour la recherche du "+" du bloc genealogie. */
  otherEntities: OtherEntityOption[];
  /** V2-H3 : rafraichit la section "Relations" en tete de fiche apres un ajout depuis le bloc genealogie. */
  onRelationsChanged: () => void;
  /** V2, retour utilisateur : incremente ailleurs sur la page (liste de relations, autre bloc) — force genealogie/reseau a recharger leur graphe, qu'ils chargent via leur propre `useEffect` sans jamais dependre de `router.refresh()`. */
  relationsReloadSignal: number;
  /** Bloc `character` de la meme entite, s'il existe (V1-C18) — permet au bloc `inventory` autonome d'afficher les memes lignes Attaquer/Degats et la meme barre de charge que l'onglet Inventaire de la fiche jouable, sans dupliquer le calcul. */
  characterData: CharacterBlockData | undefined;
  /** Assistance IA du bloc `text` (V1-F3) : une proposition appliquee ecrit cote serveur, ce callback resynchronise l'etat local (donnee + version). */
  onBlockRefreshed: (fresh: {
    id: string;
    data: unknown;
    version: number;
  }) => void;
  /** Coquille joueur (retour utilisateur) : "enlever les outils d'assistance IA" — jamais pour le MJ. */
  hideAiAssist?: boolean;
  /** V2.1-11 : tous les blocs de la fiche, dans l'ordre d'affichage — le bloc `image` y choisit son hôte d'ancrage. */
  siblings: BlockItem[];
  /** V3.1-66 : genre de la fiche, pour les intitulés proposés par le bloc Encadré. */
  entityKind?: string;
  /** V3.1-68 : ecrit TOUT DE SUITE ce contenu par le chemin d'enregistrement du bloc, `true` si le serveur l'accepte (pastille de visibilite d'un evenement de la Chronologie). Absent dans l'editeur plein ecran. */
  onEnregistrer?: (data: unknown) => Promise<boolean>;
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
          worldSlug={worldSlug}
          worldId={worldId}
          otherEntities={otherEntities}
        />
      );
    case "infobox":
      return (
        <InfoboxBlockEditor
          data={block.data as InfoboxBlockData}
          onChange={(d) => onChange(d)}
          entityKind={entityKind}
          otherEntities={otherEntities}
        />
      );
    case "image":
      return (
        <ImageBlockEditor
          blockId={block.id}
          data={block.data as ImageBlockData}
          onChange={(d) => onChange(d)}
          siblings={siblings}
        />
      );
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
        <ResourcesBlockEditor
          data={block.data as ResourcesBlockData}
          onChange={(d) => onChange(d)}
        />
      );
    case "music":
      return (
        <MusicBlockEditor
          data={block.data as MusicBlockData}
          onChange={(d) => onChange(d)}
          blockId={block.id}
        />
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
          onEnregistrer={onEnregistrer}
          isGm={!hideAiAssist}
          nonAuteur={block.nonAuteur}
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
          isGm={!hideAiAssist}
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
          onEnregistrer={onEnregistrer}
          nonAuteur={block.nonAuteur}
        />
      );
    case "map":
      return (
        <MapBlockEditor
          worldSlug={worldSlug}
          blockId={block.id}
          otherEntities={otherEntities}
          data={block.data as MapBlockData}
          visibilityLevel={block.visibilityLevel}
          visibilityScopeId={block.visibilityScopeId}
          onChange={(d) => onChange(d)}
        />
      );
    case "session_journal_meta":
      return (
        <SessionJournalMetaBlockEditor
          data={block.data as SessionJournalMetaBlockData}
          onChange={(d) => onChange(d)}
          worldSlug={worldSlug}
          campaignId={campaignId}
          isGm={!hideAiAssist}
        />
      );
    case "statblock":
      // Dans `EntityBlocks`, ce type est rendu avant l'aiguillage ; l'editeur
      // plein ecran passe, lui, toujours par ici.
      return (
        <MonsterStatblockSheet
          data={block.data as StatblockBlockData}
          onChange={(d) => onChange(d)}
        />
      );
    default:
      return (
        <p className="text-sm text-danger">
          Type de bloc inconnu : {block.blockType}
        </p>
      );
  }
}

/**
 * Creation d'un bloc vide cote serveur (le titre par defaut est celui du type).
 * Commune a la barre « Ajouter un bloc » de la fiche et a l'editeur plein
 * ecran : `null` si le serveur refuse.
 */
export async function creerBloc(
  entityId: string,
  blockType: string,
): Promise<BlockItem | null> {
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
  return (await res.json()) as BlockItem;
}

/**
 * La barre « Ajouter un bloc » (puces par type), extraite d'`EntityBlocks`
 * pour que l'editeur plein ecran reutilise le meme menu, memes exclusions
 * comprises (generateur, un seul personnalite / convictions par fiche, types
 * permis au joueur).
 */
export function BarreAjoutBloc({
  blocks,
  onAdd,
  restrictAddableTypes,
  onLaunchWizard,
  hasCharacterBlock,
}: {
  blocks: readonly { blockType: string }[];
  onAdd: (blockType: string) => void;
  restrictAddableTypes?: string[];
  onLaunchWizard?: () => void;
  hasCharacterBlock?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-edge pt-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
        Ajouter un bloc :
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {onLaunchWizard && (
          <button
            type="button"
            onClick={onLaunchWizard}
            title={
              hasCharacterBlock
                ? "Remplace le personnage actuel de cette fiche"
                : undefined
            }
            className="rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
          >
            + Assistant de création
          </button>
        )}
        {Object.entries(BLOCK_TYPE_LABELS)
          // "generator" retire de "Ajouter un bloc" (retour utilisateur) : l'outil
          // "Générateurs" vit desormais uniquement dans la sidebar MJ. Le libelle
          // reste dans BLOCK_TYPE_LABELS pour les blocs generator deja existants.
          // "session_journal_meta" redevient ajoutable a la main (V2.1-14) :
          // il reste pose automatiquement par submitJournalEntry, mais rien ne
          // justifie plus de le reserver au Livre de sessions — c'est un bloc
          // de wiki comme un autre, avec quatre libelles fixes.
          // personality/worldview retires des qu'un exemplaire existe deja sur
          // cette fiche (V2.1-5, un seul de chaque pour eviter les confusions —
          // meme garde-fou en base, index blocks_personality_worldview_uniq).
          .filter(
            ([type]) =>
              type !== "generator" &&
              (!restrictAddableTypes || restrictAddableTypes.includes(type)) &&
              !(
                (type === "personality" || type === "worldview") &&
                blocks.some((b) => b.blockType === type)
              ),
          )
          .map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
            >
              + {label}
            </button>
          ))}
      </div>
    </div>
  );
}

/**
 * V3.1-63 — « + Ajouter un bloc » de la fiche sur ordinateur : la palette
 * rangée en familles (Récit, Personnage, Psyché et liens, Outils de jeu),
 * dont l'ordre et les exclusions viennent de `lib/ui/ficheBlocs`. Le
 * téléphone garde `BarreAjoutBloc` (V3.1-31). Le nouveau bloc arrive en bas.
 */
function PaletteAjoutBloc({
  blocks,
  onAdd,
  restrictAddableTypes,
  onLaunchWizard,
  hasCharacterBlock,
}: {
  blocks: readonly { blockType: string }[];
  onAdd: (blockType: string) => void;
  restrictAddableTypes?: string[];
  onLaunchWizard?: () => void;
  hasCharacterBlock?: boolean;
}) {
  const t = useTranslations("fiche");
  const [ouverte, setOuverte] = useState(false);
  const familles = famillesAjoutables(blocks, restrictAddableTypes);
  const assistant = onLaunchWizard && (
    <button
      type="button"
      onClick={onLaunchWizard}
      title={hasCharacterBlock ? t("palette.assistantRemplace") : undefined}
      className="self-start rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
    >
      {t("palette.assistant")}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 pt-1">
      {ouverte ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-edge-strong p-4">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[11px] font-bold uppercase tracking-widest text-ink-muted">
              {t("palette.titre")}
            </span>
            <button
              type="button"
              onClick={() => setOuverte(false)}
              className="rounded-md px-1.5 text-ink-muted transition-colors hover:text-ink"
              aria-label={t("fermer")}
            >
              ×
            </button>
          </div>
          {familles.map((famille) => (
            <div
              key={famille.cle}
              role="group"
              aria-label={t(`palette.familles.${famille.cle}`)}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="w-28 shrink-0 text-xs uppercase tracking-wider text-ink-muted">
                {t(`palette.familles.${famille.cle}`)}
              </span>
              {famille.types.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setOuverte(false);
                    onAdd(type);
                  }}
                  className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
                >
                  {BLOCK_TYPE_LABELS[type] ?? type}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOuverte(true)}
            aria-expanded={false}
            className="rounded-full border border-dashed border-edge-strong px-4 py-1.5 text-sm text-accent transition-colors hover:bg-accent/10"
          >
            {t("palette.ajouter")}
          </button>
          {assistant}
        </div>
      )}
      {ouverte && assistant}
    </div>
  );
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
  campaignId,
  initialBlocks,
  worldSlug,
  otherEntities,
  onLaunchWizard,
  relationsReloadSignal,
  onRelationsChanged: onRelationsChangedFromParent,
  restrictAddableTypes,
  hideAiAssist,
  onBlocksChange,
  entityKind,
}: {
  entityId: string;
  /** V2-H3 : necessaire pour "creer la carte «X»" depuis le bloc genealogie. */
  worldId: string;
  /** V2.1-3 (suite) : necessaire au bloc `session_journal_meta` — `null`/omis pour toute fiche hors contexte de campagne (le seul cas ou ce bloc peut exister est le Livre de sessions, toujours dans une campagne). */
  campaignId?: string | null;
  initialBlocks: BlockItem[];
  worldSlug: string;
  /** V2-H3 : meme liste que RelationsChips.tsx, reutilisee par le bloc genealogie. */
  otherEntities: OtherEntityOption[];
  /** Assistant de creation (retour utilisateur, suite) — omis quand aucun parent ne le fournit (ex. contextes hors fiche de monde), le bouton reste alors absent plutot que sans effet. */
  onLaunchWizard?: () => void;
  /** Coquille joueur (retour utilisateur, V2-M7b puis retour utilisateur ulterieur elargissant la liste) : limite la barre "Ajouter un bloc" a ces types, `undefined` (MJ) laisse tout disponible. */
  restrictAddableTypes?: string[];
  /** Coquille joueur (retour utilisateur) : "enlever les outils d'assistance IA" — masque le panneau Assistance IA des blocs `text`, jamais pour le MJ. */
  hideAiAssist?: boolean;
  /** V2, retour utilisateur : compteur possede par le parent (EditEntityForm), partage avec RelationsChips — force genealogie/reseau a recharger quand une relation change ailleurs sur la page. Absent hors contexte de fiche complete (ex. fenetre isolee) : les deux blocs retombent alors sur leur seul rechargement interne. */
  relationsReloadSignal?: number;
  onRelationsChanged?: () => void;
  /** V3.1-31 : prevenu a chaque changement de la liste, pour que l'editeur plein ecran (monte par le parent) parte de l'etat COURANT des blocs et de leurs versions, jamais de celui du chargement de la page. */
  onBlocksChange?: (blocks: BlockItem[]) => void;
  /** V3.1-66 : genre de la fiche (`entity_kind`), pour les intitulés proposés par le bloc Encadré. */
  entityKind?: string;
}) {
  const t = useTranslations("fiche");
  const [blocks, setBlocks] = useState<BlockItem[]>(initialBlocks);
  // Retour utilisateur : le pli/depli d'un bloc ne survivait pas a un
  // rechargement (Set en memoire) — meme mecanisme de persistance que le
  // sommaire (`useCollapsedGroups`, deja teste), une cle par fiche pour ne
  // jamais melanger les plis d'une fiche avec ceux d'une autre.
  const { isCollapsed, toggle: toggleCollapsed } = useCollapsedGroups(
    `creadonjon:collapsed:blocks:${entityId}`,
  );
  const [conflictedIds, setConflictedIds] = useState<Set<string>>(new Set());
  /** Distinct de `conflictedIds` (409, "rechargez") : un 400/500 signifie que la donnee elle-meme est rejetee (ex. `label` vide sur un objet d'inventaire) — se recharger ne change rien tant que la donnee n'est pas corrigee. Avant ce complement, `doSaveBlock` avalait ces echecs sans rien afficher : le bouton semblait "ne rien faire". */
  const [saveErrorIds, setSaveErrorIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  /**
   * ADR 0023 — ou en est l'ecriture de chaque bloc. L'enregistrement etait
   * jusqu'ici entierement muet : c'est ce silence qui a laisse passer trois
   * pertes de donnee sans que personne ne s'en apercoive avant de relire la
   * base. Rendre l'ecriture visible fait qu'un prochain defaut de la meme
   * famille se verra sur le coup.
   *
   * DEUX etats, pas un. Le premier jet n'affichait « Enregistre » qu'au
   * RETOUR de la requete — soit environ une seconde apres le geste, le temps
   * de l'aller-retour reseau : trop tard pour rassurer. Les annoncer d'un
   * coup au depart mentirait en cas d'echec, alors on dit simplement la
   * verite du moment : « Enregistrement… » des le depart, « Enregistre » a
   * l'arrivee. En cas d'echec l'etat est efface, et ce sont les bandeaux de
   * conflit/erreur qui parlent — jamais une reussite annoncee a tort.
   */
  const [saveStateById, setSaveStateById] = useState<
    Record<string, "pending" | "saved">
  >({});
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const timers = savedTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);
  function setSaveState(id: string, state: "pending" | "saved" | null) {
    // Un enregistrement qui repart annule l'effacement du precedent : sinon
    // le « Enregistre » d'avant s'effacerait au milieu du nouveau.
    clearTimeout(savedTimers.current[id]);
    delete savedTimers.current[id];
    setSaveStateById((prev) => {
      if (state === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: state };
    });
    if (state === "saved") {
      savedTimers.current[id] = setTimeout(() => {
        delete savedTimers.current[id];
        setSaveStateById((prev) => {
          if (prev[id] !== "saved") return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 2000);
    }
  }
  const versionsRef = useRef<Record<string, number>>(
    Object.fromEntries(initialBlocks.map((b) => [b.id, b.version])),
  );
  const saveChainsRef = useRef<Record<string, Promise<boolean>>>({});
  /** ADR 0023 : blocs dont un enregistrement a deja ete demande dans le tour en cours — voir `saveBlock`. */
  const savePendingRef = useRef<Record<string, boolean>>({});
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
    onBlocksChange?.(blocksRef.current);
  }

  const sortedBlocks = [...blocks].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
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
  async function createBlockWithData(
    blockType: string,
    data: unknown,
  ): Promise<BlockItem | null> {
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
        visibility: {
          level: block.visibilityLevel,
          scopeId: block.visibilityScopeId ?? null,
        },
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
    updateBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  }

  /**
   * Une proposition IA appliquee (V1-F3) ecrit le bloc cote serveur en
   * dehors de la chaine `saveBlock` habituelle — `versionsRef` doit suivre,
   * sinon la prochaine edition manuelle de ce bloc PATCH avec une version
   * perimee et echoue en 409 (conflit fantome, alors que rien n'est
   * reellement en conflit du point de vue de l'utilisateur).
   */
  function handleBlockRefreshed(fresh: {
    id: string;
    data: unknown;
    version: number;
  }) {
    versionsRef.current[fresh.id] = fresh.version;
    patchBlock(fresh.id, { data: fresh.data, version: fresh.version });
  }

  async function addBlock(blockType: string) {
    const block = await creerBloc(entityId, blockType);
    if (!block) return;
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
    overrides?: {
      visibilityLevel?: string;
      visibilityScopeId?: string | null;
      data?: unknown;
    },
  ) {
    // ADR 0023 — deux demandes dans le MEME tour ne produisent qu'une
    // requete. Le cas : un editeur qui enregistre deja explicitement (fiche de
    // personnage) contient un controle qui engage
    // desormais sa valeur de lui-meme ; sans cette fusion, un seul geste
    // ecrirait deux fois. Une demande porteuse de surcharges n'est jamais
    // fusionnee — elle transporte une donnee que la suivante ignorerait —,
    // mais elle pose le drapeau, donc c'est bien la plus complete des deux qui
    // part. Les autres peuvent l'etre sans risque : `doSaveBlock` lit de toute
    // facon la donnee la plus fraiche dans `blocksRef`.
    if (!overrides && savePendingRef.current[id])
      return saveChainsRef.current[id] ?? Promise.resolve(true);
    savePendingRef.current[id] = true;
    queueMicrotask(() => {
      delete savePendingRef.current[id];
    });

    const run = () => doSaveBlock(id, overrides);
    const previous = saveChainsRef.current[id] ?? Promise.resolve(true);
    const next = previous.then(run, run);
    saveChainsRef.current[id] = next;
    return next;
  }

  async function doSaveBlock(
    id: string,
    overrides?: {
      visibilityLevel?: string;
      visibilityScopeId?: string | null;
      data?: unknown;
    },
  ): Promise<boolean> {
    const block = blocksRef.current.find((b) => b.id === id);
    if (!block) return false;

    // Des le depart, pas au retour : c'est le geste qu'on accuse, pas le
    // reseau. Voir `saveStateById`.
    setSaveState(id, "pending");

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
          scopeId:
            overrides?.visibilityScopeId ?? block.visibilityScopeId ?? null,
        },
      }),
    });

    if (res.status === 409) {
      // L'indicateur s'efface : le bandeau de conflit dit ce qu'il faut, et
      // laisser « Enregistrement… » tourner indefiniment serait un mensonge
      // de plus.
      setSaveState(id, null);
      setConflictedIds((prev) => new Set(prev).add(id));
      return false;
    }
    if (!res.ok) {
      setSaveState(id, null);
      setSaveErrorIds((prev) => new Set(prev).add(id));
      return false;
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
    setSaveState(id, "saved");
    return true;
  }

  /**
   * V3.1-64 — change la visibilité d'UN bloc : l'écran suit aussitôt, la
   * route d'enregistrement du bloc écrit, et l'ancienne valeur revient si le
   * serveur refuse. `true` si l'écriture a réussi (la pastille l'annonce).
   */
  async function changerVisibiliteBloc(
    id: string,
    niveau: string,
  ): Promise<boolean> {
    const avant = blocksRef.current.find((b) => b.id === id)?.visibilityLevel;
    if (avant === undefined) return false;
    patchBlock(id, { visibilityLevel: niveau });
    const ok = await saveBlock(id, { visibilityLevel: niveau });
    if (!ok) patchBlock(id, { visibilityLevel: avant });
    return ok;
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
        visibility: {
          level: original.visibilityLevel,
          scopeId: original.visibilityScopeId,
        },
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
        visibility: {
          level: original.visibilityLevel,
          scopeId: original.visibilityScopeId,
        },
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
      body: JSON.stringify({
        version: current.version,
        displayOrder: newOrder,
      }),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as BlockItem;
    versionsRef.current[id] = updated.version;
    patchBlock(id, {
      displayOrder: updated.displayOrder,
      version: updated.version,
    });
  }

  async function moveBlock(id: string, direction: "up" | "down") {
    const index = sortedBlocks.findIndex((b) => b.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedBlocks.length) return;

    const neighbor = sortedBlocks[swapIndex];
    const beyond =
      direction === "up"
        ? sortedBlocks[swapIndex - 1]
        : sortedBlocks[swapIndex + 1];
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
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /**
   * V3.1-63 : le glisser au clavier (Entrée sur ⠿, flèches, Entrée pour poser,
   * Échap pour annuler) est celui de `KeyboardSensor` ; ce qu'on ajoute, c'est
   * l'annonce en français de chaque étape (texte calculé par `lib/ui/ficheBlocs`).
   */
  const annonces: Announcements = (() => {
    const ids = sortedBlocks.map((b) => b.id);
    const libelles = Object.fromEntries(
      sortedBlocks.map((b) => [
        b.id,
        b.display.label || BLOCK_TYPE_LABELS[b.blockType] || b.blockType,
      ]),
    );
    const dire = (
      etape: "prise" | "deplace" | "posee" | "annulee",
      actif: string | number,
      cible: string | number | null,
    ) => {
      const a = annonceReordonnancement(
        etape,
        ids,
        libelles,
        String(actif),
        cible === null ? null : String(cible),
      );
      return a
        ? t(`reordonner.${a.cle}`, {
            bloc: a.bloc,
            position: a.position,
            total: a.total,
          })
        : undefined;
    };
    return {
      onDragStart: ({ active }) => dire("prise", active.id, active.id),
      onDragOver: ({ active, over }) =>
        dire("deplace", active.id, over ? over.id : active.id),
      onDragEnd: ({ active, over }) =>
        dire("posee", active.id, over ? over.id : active.id),
      onDragCancel: ({ active }) => dire("annulee", active.id, active.id),
    };
  })();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newOrder = computeDroppedOrder(
      sortedBlocks,
      String(active.id),
      String(over.id),
    );
    if (newOrder === null) return;
    void moveBlockTo(String(active.id), newOrder);
  }

  return (
    <div className="flex flex-col">
      <AnnonceVisibiliteProvider>
        {/* `id` fige (V2-G1) : sans lui, l'identifiant interne d'accessibilite
          de dnd-kit (`aria-describedby="DndDescribedBy-N"`) est un compteur
          incremente a chaque montage — different entre le rendu serveur et
          l'hydratation client des qu'une AUTRE instance de ce composant a
          deja incremente ce compteur ailleurs sur la page (ex. plusieurs
          fenetres d'entite ouvertes). Base sur `entityId`, deja stable et
          identique cote serveur/client. */}
        <DndContext
          id={`entity-blocks-${entityId}`}
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{
            announcements: annonces,
            screenReaderInstructions: {
              draggable: t("reordonner.instructions"),
            },
          }}
        >
          <SortableContext
            items={sortedBlocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedBlocks.map((block, index) => (
              <SortableBlockCard
                key={block.id}
                block={block}
                index={index}
                lastIndex={sortedBlocks.length - 1}
                isCollapsed={isCollapsed(block.id)}
                hasConflict={conflictedIds.has(block.id)}
                hasSaveError={saveErrorIds.has(block.id)}
                saveState={saveStateById[block.id] ?? null}
                worldSlug={worldSlug}
                worldId={worldId}
                campaignId={campaignId ?? null}
                otherEntities={otherEntities}
                onRelationsChanged={() => {
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
                onChangerVisibilite={changerVisibiliteBloc}
                onMoveBlock={moveBlock}
                onDuplicateBlock={duplicateBlock}
                onRequestDelete={setPendingDeleteId}
                onUpdateCharacter={updateCharacter}
                onUpdateInventory={updateInventory}
                onUpdateSpellcasting={updateSpellcasting}
                onBlockRefreshed={handleBlockRefreshed}
                onBlur={handleBlockBlur(block.id)}
                hideAiAssist={hideAiAssist}
                siblings={sortedBlocks}
                entityKind={entityKind}
              />
            ))}
          </SortableContext>
        </DndContext>
        {sortedBlocks.length === 0 && (
          <p className="py-4 text-center text-xs italic text-ink-muted">
            Aucun bloc. Utilisez la barre ci-dessous pour en ajouter.
          </p>
        )}

        <PaletteAjoutBloc
          blocks={blocks}
          onAdd={addBlock}
          restrictAddableTypes={restrictAddableTypes}
          onLaunchWizard={onLaunchWizard}
          hasCharacterBlock={Boolean(characterBlock)}
        />

        <ConfirmDialog
          open={pendingDeleteId !== null}
          title={t("confirmerSuppressionTitre")}
          message={t("confirmerSuppression")}
          confirmLabel={t("confirmerSuppressionBouton")}
          danger
          onConfirm={confirmDeleteBlock}
          onCancel={() => setPendingDeleteId(null)}
        />
      </AnnonceVisibiliteProvider>
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
  saveState,
  worldSlug,
  worldId,
  campaignId,
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
  onChangerVisibilite,
  onMoveBlock,
  onDuplicateBlock,
  onRequestDelete,
  onUpdateCharacter,
  onUpdateInventory,
  onUpdateSpellcasting,
  onBlockRefreshed,
  onBlur,
  hideAiAssist,
  siblings,
  entityKind,
}: {
  block: BlockItem;
  index: number;
  lastIndex: number;
  isCollapsed: boolean;
  hasConflict: boolean;
  hasSaveError: boolean;
  /** ADR 0023 : « pending » pendant la requete, « saved » les deux secondes qui suivent sa reussite, `null` le reste du temps. */
  saveState: "pending" | "saved" | null;
  worldSlug: string;
  worldId: string;
  campaignId: string | null;
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
  onSaveBlock: (
    id: string,
    overrides?: {
      visibilityLevel?: string;
      visibilityScopeId?: string | null;
      data?: unknown;
    },
  ) => Promise<boolean>;
  /** V3.1-64 : écriture optimiste de la visibilité, `true` si le serveur l'a acceptée. */
  onChangerVisibilite: (id: string, niveau: string) => Promise<boolean>;
  onMoveBlock: (id: string, direction: "up" | "down") => void;
  onDuplicateBlock: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onUpdateCharacter: (data: CharacterBlockData) => void;
  onUpdateInventory: (data: InventoryBlockData) => void;
  onUpdateSpellcasting: (data: SpellcastingBlockData) => void;
  onBlockRefreshed: (fresh: {
    id: string;
    data: unknown;
    version: number;
  }) => void;
  onBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  hideAiAssist?: boolean;
  /** V2.1-11 : tous les blocs de la fiche, dans l'ordre d'affichage — transmis au bloc `image`, qui y choisit son hôte d'ancrage. */
  siblings: BlockItem[];
  entityKind?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  /** ADR 0023 — « cette valeur est engagee, enregistre CE bloc ». Lu par `Checkbox` et `Dropdown` via `useEditCommit()`, sans qu'aucun editeur ait a le transmettre. */
  const commit = useCallback(
    () => onSaveBlock(block.id),
    [onSaveBlock, block.id],
  );

  const pliable = block.blockType !== "statblock";

  return (
    <BlockCard
      cardRef={setNodeRef}
      style={style}
      onBlur={onBlur}
      estGlisse={isDragging}
      poignee={{ attributes, listeners }}
      pliable={pliable}
      replie={pliable && isCollapsed}
      onBasculerPli={() => onToggleCollapsed(block.id)}
      titre={block.display.label}
      titrePlaceholder={BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType}
      onTitreChange={(label) =>
        onPatchBlock(block.id, { display: { ...block.display, label } })
      }
      typeLibelle={BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType}
      etatSauvegarde={saveState}
      niveauVisibilite={block.visibilityLevel}
      nonAuteur={block.nonAuteur ?? false}
      onChoisirVisibilite={(niveau) => onChangerVisibilite(block.id, niveau)}
      peutMonter={index > 0}
      peutDescendre={index < lastIndex}
      onMonter={() => onMoveBlock(block.id, "up")}
      onDescendre={() => onMoveBlock(block.id, "down")}
      onDupliquer={() => onDuplicateBlock(block.id)}
      onSupprimer={() => onRequestDelete(block.id)}
      conflit={hasConflict}
      erreurSauvegarde={hasSaveError}
    >
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
      {/* ADR 0023 : un controle discret (case, liste deroulante) enregistre ce
          bloc des qu'il engage sa valeur. Le fournisseur n'entoure que le CORPS
          de l'editeur, jamais l'en-tete : la liste de visibilite, elle,
          enregistre deja explicitement juste au-dessus, et le contexte lui
          ferait envoyer une seconde requete pour rien. */}
      {/* Les éditeurs sont chargés à la demande (`dynamic`). Le premier bloc
          d'un type ajouté pendant la session attend son code : sans frontière
          ici, la carte entière restait absente jusqu'au rechargement. On
          garde l'en-tête de la carte, seul le corps attend. */}
      <Suspense fallback={null}>
      <EditCommitProvider commit={commit}>
        {block.blockType === "character" ? (
          !isCollapsed && (
            <PlayableCharacterSheet
              worldSlug={worldSlug}
              entityId={entityId}
              campaignId={null}
              character={block.data as CharacterBlockData}
              inventory={inventoryBlock?.data as InventoryBlockData | undefined}
              spellcasting={
                spellcastingBlock?.data as SpellcastingBlockData | undefined
              }
              resources={resourcesBlock?.data as ResourcesBlockData | undefined}
              characterBlockId={block.id}
              characterBlockVersion={block.version}
              onUpdateCharacter={onUpdateCharacter}
              onUpdateInventory={onUpdateInventory}
              onUpdateSpellcasting={onUpdateSpellcasting}
              onBlockRefreshed={onBlockRefreshed}
              isWorldAdmin={!hideAiAssist}
            />
          )
        ) : block.blockType === "statblock" ? (
          <MonsterStatblockSheet
            data={block.data as StatblockBlockData}
            onChange={(data) => onPatchBlock(block.id, { data })}
          />
        ) : (
          !isCollapsed && (
            <BlockDataEditor
              block={block}
              onChange={(data) => onPatchBlock(block.id, { data })}
              worldSlug={worldSlug}
              worldId={worldId}
              campaignId={campaignId}
              otherEntities={otherEntities}
              onRelationsChanged={onRelationsChanged}
              relationsReloadSignal={relationsReloadSignal}
              characterData={
                characterBlock?.data as CharacterBlockData | undefined
              }
              onBlockRefreshed={onBlockRefreshed}
              hideAiAssist={hideAiAssist}
              siblings={siblings}
              entityKind={entityKind}
              onEnregistrer={(data) => onSaveBlock(block.id, { data })}
            />
          )
        )}
      </EditCommitProvider>
      </Suspense>
    </BlockCard>
  );
}
