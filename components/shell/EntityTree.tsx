"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { EntityTreeGroup, EntityTreeNode } from "@/src/core/entity-tree/build-tree";
import { useOpenEntityLink } from "./useOpenEntityLink";
import { useCollapsedGroups } from "./useCollapsedGroups";
import { useDesktopWindowsState } from "./DesktopWindowsProvider";
import ActionsMenu from "@/components/shared/ActionsMenu";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

function NodeRow({
  node,
  worldSlug,
  depth,
  currentSlug,
  hrefBase,
  editable,
  onTreeChanged,
}: {
  node: EntityTreeNode;
  worldSlug: string;
  depth: number;
  currentSlug: string | null;
  hrefBase?: string;
  editable?: boolean;
  /** Retour utilisateur : dupliquer/supprimer "mettait un temps vraiment long" — recharge SEULEMENT l'arborescence (jamais `router.refresh()`, meme motif que RelationsChips.tsx). */
  onTreeChanged?: () => void;
}) {
  const t = useTranslations("shell");
  const desktopWindows = useDesktopWindowsState();
  const [expanded, setExpanded] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasChildren = node.children.length > 0;
  const isActive = node.slug === currentSlug;
  const link = useOpenEntityLink(worldSlug, node.slug, hrefBase);

  async function duplicate() {
    await fetch(`/api/entities/${node.id}/duplicate`, { method: "POST" });
    onTreeChanged?.();
  }

  async function confirmDelete() {
    setConfirmingDelete(false);
    await fetch(`/api/entities/${node.id}`, { method: "DELETE" });
    // Retour utilisateur : supprimer la fiche actuellement ouverte amenait
    // vers un 404 (`router.refresh()` relancait la page courante, devenue
    // introuvable) — ferme plutot la fenetre si elle est ouverte (primaire
    // ou secondaire `avec`). Sans effet si cette fiche n'est ouverte nulle
    // part (`closeWindow` ne fait rien pour une reference absente).
    desktopWindows?.closeWindow({ kind: "entity", key: node.slug });
    onTreeChanged?.();
  }

  return (
    <li>
      {/* `group` porte le survol (retour utilisateur) : le menu "..." ne
          s'affiche qu'au survol de la ligne, jamais en permanence — une
          ligne de sommaire n'est pas un bloc, pas de chrome systematique. */}
      <div className="group flex items-center" style={{ paddingLeft: `${depth * 14}px` }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? t("replier") : t("deplier")}
            className="w-4 text-xs text-ink-muted"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Link
          href={link.href}
          onClick={link.onClick}
          className={`flex-1 truncate rounded px-2 py-1 text-sm transition-colors hover:bg-panel-raised ${
            isActive ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {node.name}
        </Link>
        {editable && (
          <ActionsMenu
            aria-label={`Actions sur ${node.name}`}
            triggerClassName="shrink-0 rounded-md px-1.5 py-1 text-xs text-ink-muted opacity-0 transition-opacity hover:bg-panel-raised hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
            items={[
              { label: "Dupliquer", onSelect: duplicate },
              { label: "Supprimer", onSelect: () => setConfirmingDelete(true), danger: true },
            ]}
          />
        )}
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        title="Supprimer cette fiche ?"
        message="Êtes-vous sûr de vouloir supprimer cette fiche ?"
        confirmLabel="Supprimer"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              worldSlug={worldSlug}
              depth={depth + 1}
              currentSlug={currentSlug}
              hrefBase={hrefBase}
              editable={editable}
              onTreeChanged={onTreeChanged}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * En-tete de groupe, glissable (V2-G9) — extrait pour la meme raison que
 * `NodeRow`/`SortableBlockCard` (`components/blocks/EntityBlocks.tsx`) :
 * `useSortable` s'appelle une fois PAR INSTANCE, jamais dans la `.map()` du
 * parent.
 */
/** Cherche `slug` dans une liste de nœuds, enfants `part_of` compris (recursif). */
function containsSlug(nodes: EntityTreeNode[], slug: string | null): boolean {
  if (!slug) return false;
  return nodes.some((n) => n.slug === slug || containsSlug(n.children, slug));
}

function SortableGroupHeader({
  groupKind,
  label,
  collapsed,
  editable,
  onToggle,
}: {
  groupKind: string;
  label: string;
  collapsed: boolean;
  editable?: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("shell");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: groupKind });

  return (
    <div
      ref={setNodeRef}
      className={`group flex items-center gap-1 ${isDragging ? "relative z-10 opacity-90" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {editable && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 touch-none cursor-grab text-xs text-ink-muted opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
          title="Glisser pour réordonner"
          aria-label={`Réordonner la catégorie ${label}`}
        >
          ⠿
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? t("deplier") : t("replier")}
        className="flex flex-1 items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted"
      >
        <span className="w-3 text-[10px]">{collapsed ? "▸" : "▾"}</span>
        {label}
      </button>
    </div>
  );
}

export default function EntityTree({
  groups,
  worldSlug,
  hrefBase,
  editable,
  collapseStorageKey,
  defaultCollapsedKinds = [],
}: {
  groups: EntityTreeGroup[];
  worldSlug: string;
  /** Peau « livre » (V2-G2) : `/partage/:token` ou `/m/:worldSlug/apercu`, jamais la fiche d'edition — voir `useOpenEntityLink`. */
  hrefBase?: string;
  /** Menu "..." (dupliquer/supprimer) et glisser-depose (V2-G9) : jamais sur la peau publique/apercu, seulement depuis components/shell/Sidebar.tsx. */
  editable?: boolean;
  /** Cle `localStorage` distincte par appelant (retour utilisateur, V2-G7) — Sidebar/RulesSidebar/BookSkin ne doivent jamais partager le meme etat plie/deplie. */
  collapseStorageKey: string;
  /** Categories repliees au tout premier rendu, avant toute preference memorisee (ex. BookSkin : tout sauf "pj"). */
  defaultCollapsedKinds?: string[];
}) {
  const t = useTranslations("shell");
  const kindLabels = t.raw("kindLabels") as Record<string, string>;
  const { isCollapsed, toggle } = useCollapsedGroups(collapseStorageKey, defaultCollapsedKinds);
  const pathname = usePathname();

  // Miroir local (retour utilisateur : dupliquer/supprimer une fiche ou
  // reordonner les categories "mettait un temps vraiment long") — resynchronise
  // "pendant le rendu" quand la prop change (vraie navigation), meme motif
  // que RelationsChips.tsx.
  const [prevGroups, setPrevGroups] = useState(groups);
  const [localGroups, setLocalGroups] = useState(groups);
  if (groups !== prevGroups) {
    setPrevGroups(groups);
    setLocalGroups(groups);
  }

  async function reloadTree() {
    const res = await fetch(`/api/worlds/${worldSlug}/entity-tree`);
    if (!res.ok) return;
    setLocalGroups(await res.json());
  }
  let currentSlug: string | null = null;
  if (hrefBase) {
    // Peau « livre » (/partage/:token/:slug ou /m/:worldSlug/apercu/:slug) :
    // le segment courant est ce qui suit `hrefBase/`, sans autre `/f/` a chercher.
    if (pathname.startsWith(`${hrefBase}/`)) {
      currentSlug = decodeURIComponent(pathname.slice(hrefBase.length + 1).split("/")[0]);
    }
  } else {
    const match = pathname.match(/\/f\/([^/]+)/);
    if (match) currentSlug = decodeURIComponent(match[1]);
  }

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Categories seulement (V2-G9) — le classement des fiches DANS une
   * categorie est desormais fixe (alphabetique, `buildEntityTree`, retour
   * utilisateur "faciliter la recherche") : plus de glisser-depose par
   * fiche, qui n'aurait plus d'effet visible des le prochain rendu.
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const groupKinds = localGroups.map((g) => g.kind);
    if (!groupKinds.includes(activeId) || !groupKinds.includes(overId)) return;
    const reordered = arrayMove(groupKinds, groupKinds.indexOf(activeId), groupKinds.indexOf(overId));
    // Optimiste (retour utilisateur, "un temps vraiment long") : dnd-kit a
    // deja anime le glissement, appliquer le nouvel ordre tout de suite
    // evite un aller-retour serveur visible pour un geste qui se repete
    // souvent d'affilee en reorganisant plusieurs categories. L'ecriture
    // part en arriere-plan, jamais attendue.
    const byKind = new Map(localGroups.map((g) => [g.kind, g]));
    setLocalGroups(reordered.map((kind) => byKind.get(kind)!));
    void fetch(`/api/worlds/${worldSlug}/entity-kind-order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered }),
    });
  }

  if (localGroups.length === 0) {
    return <p className="px-2 text-sm text-ink-muted">{t("aucuneEntite")}</p>;
  }

  return (
    <DndContext id={`entity-tree-${worldSlug}`} sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localGroups.map((g) => g.kind)} strategy={verticalListSortingStrategy}>
        <nav aria-label={t("entitesDuMonde")} className="flex flex-col gap-3">
          {localGroups.map((group) => {
            // Retour utilisateur (wiki public) : naviguer vers une fiche
            // via un lien du contenu (genealogie, reseau, relations...) ne
            // doit jamais laisser la fiche active cachee dans une categorie
            // repliee, sans aucun repere de position dans le sommaire —
            // deplie de force la categorie qui la contient, sans toucher a
            // la preference memorisee (`isCollapsed` reste la source de
            // verite si on la replie de nouveau a la main).
            const collapsed = isCollapsed(group.kind) && !containsSlug(group.items, currentSlug);
            return (
              <div key={group.kind}>
                <SortableGroupHeader
                  groupKind={group.kind}
                  label={kindLabels[group.kind] ?? group.kind}
                  collapsed={collapsed}
                  editable={editable}
                  onToggle={() => toggle(group.kind)}
                />
                {!collapsed && (
                  <ul>
                    {group.items.map((node) => (
                      <NodeRow
                        key={node.id}
                        node={node}
                        worldSlug={worldSlug}
                        depth={0}
                        currentSlug={currentSlug}
                        hrefBase={hrefBase}
                        editable={editable}
                        onTreeChanged={reloadTree}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </SortableContext>
    </DndContext>
  );
}
