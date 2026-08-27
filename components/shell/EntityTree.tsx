"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { computeDroppedOrder } from "@/src/core/ordering/computeDroppedOrder";
import { useOpenEntityLink } from "./useOpenEntityLink";
import { useCollapsedGroups } from "./useCollapsedGroups";
import ActionsMenu from "@/components/shared/ActionsMenu";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

function NodeRow({
  node,
  worldSlug,
  depth,
  currentSlug,
  hrefBase,
  editable,
}: {
  node: EntityTreeNode;
  worldSlug: string;
  depth: number;
  currentSlug: string | null;
  hrefBase?: string;
  editable?: boolean;
}) {
  const t = useTranslations("shell");
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasChildren = node.children.length > 0;
  const isActive = node.slug === currentSlug;
  const link = useOpenEntityLink(worldSlug, node.slug, hrefBase);
  // Toujours appele (regle des hooks), meme hors DndContext (peau publique,
  // jamais `editable`) : dnd-kit retombe alors sur des valeurs inertes, la
  // poignee n'est de toute facon jamais rendue dans ce cas.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });

  async function duplicate() {
    await fetch(`/api/entities/${node.id}/duplicate`, { method: "POST" });
    router.refresh();
  }

  async function confirmDelete() {
    setConfirmingDelete(false);
    await fetch(`/api/entities/${node.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <li>
      {/* `group` porte le survol (retour utilisateur) : le menu "..." et la
          poignee de glisser ne s'affichent qu'au survol de la ligne, jamais
          en permanence — une ligne de sommaire n'est pas un bloc, pas de
          chrome systematique. */}
      <div
        ref={setNodeRef}
        className={`group flex items-center ${isDragging ? "relative z-10 bg-panel-raised opacity-90" : ""}`}
        style={{ paddingLeft: `${depth * 14}px`, transform: CSS.Transform.toString(transform), transition }}
      >
        {/* Uniquement au premier niveau d'un groupe (V2-G9, portee volontaire) :
            un enfant imbrique (part_of) reste triable par display_order mais
            pas encore glissable dans cette passe, trop rare dans les donnees
            actuelles pour justifier des listes triables imbriquees. */}
        {editable && depth === 0 && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="shrink-0 touch-none cursor-grab text-xs text-ink-muted opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
            title="Glisser pour réordonner"
            aria-label={`Réordonner ${node.name || "(sans nom)"}`}
          >
            ⠿
          </button>
        )}
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
        message={`« ${node.name || "(sans nom)"} » sera retirée du monde. Cette action reste réversible en base, mais aucun écran ne permet de l'annuler pour l'instant.`}
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
  const router = useRouter();
  const kindLabels = t.raw("kindLabels") as Record<string, string>;
  const { isCollapsed, toggle } = useCollapsedGroups(collapseStorageKey, defaultCollapsedKinds);
  const pathname = usePathname();
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
   * Un seul gestionnaire pour les deux listes glissables (categories ET
   * fiches, V2-G9) : distingue par l'id depose (une cle de groupe, ou un
   * uuid de fiche) plutot que deux `DndContext` a synchroniser. Un depot
   * entre deux categories differentes pour une fiche est ignore (portee
   * volontaire — changer de categorie reste le selecteur de type, V2-G7).
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const groupKinds = groups.map((g) => g.kind);
    if (groupKinds.includes(activeId)) {
      if (!groupKinds.includes(overId)) return;
      const reordered = arrayMove(groupKinds, groupKinds.indexOf(activeId), groupKinds.indexOf(overId));
      void fetch(`/api/worlds/${worldSlug}/entity-kind-order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered }),
      }).then(() => router.refresh());
      return;
    }

    const group = groups.find((g) => g.items.some((i) => i.id === activeId));
    const target = group?.items.find((i) => i.id === activeId);
    if (!group || !target || !group.items.some((i) => i.id === overId)) return;
    const newOrder = computeDroppedOrder(
      group.items.map((i) => ({ id: i.id, displayOrder: i.displayOrder })),
      activeId,
      overId
    );
    if (newOrder === null) return;
    void fetch(`/api/entities/${activeId}/order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: target.version, displayOrder: newOrder }),
    }).then(() => router.refresh());
  }

  if (groups.length === 0) {
    return <p className="px-2 text-sm text-ink-muted">{t("aucuneEntite")}</p>;
  }

  return (
    <DndContext id={`entity-tree-${worldSlug}`} sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={groups.map((g) => g.kind)} strategy={verticalListSortingStrategy}>
        <nav aria-label={t("entitesDuMonde")} className="flex flex-col gap-3">
          {groups.map((group) => {
            const collapsed = isCollapsed(group.kind);
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
                  <SortableContext items={group.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
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
                        />
                      ))}
                    </ul>
                  </SortableContext>
                )}
              </div>
            );
          })}
        </nav>
      </SortableContext>
    </DndContext>
  );
}
