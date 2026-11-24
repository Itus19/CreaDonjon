"use client";

import { useCallback, useState } from "react";
import Link, { useLinkStatus } from "next/link";
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
import { useSurFicheCreee } from "@/components/shared/fichesCreees";
import { SESSION_JOURNAL_KIND } from "@/src/core/entities/systemKinds";

/**
 * Le nom de la fiche, plus l'état d'attente de SON lien (V2.1-20 lot 1).
 *
 * `useLinkStatus` ne se lit que depuis un descendant du `<Link>` — d'où ce
 * composant plutôt qu'un `pending` calculé dans `NodeRow`, qui est le parent.
 *
 * Mesuré avant de l'écrire (V2.1-20 lot 0) : entre le clic et l'arrivée il se
 * passe de 215 à 731 ms selon la fiche, pendant lesquelles RIEN ne bougeait —
 * ni la page, ni le lien cliqué.
 *
 * Le signal ne peut pas être le fond : `hover:bg-panel-raised` le pose déjà,
 * donc cliquer une ligne survolée ne changerait rien à l'écran, précisément
 * dans le cas le plus courant. Il porte donc sur la COULEUR du texte —
 * `text-accent`, celle de la ligne active, puisque c'est ce que cette ligne est
 * sur le point de devenir — et sur le pouls, qui distingue « on y va » de « on
 * y est ». Aucun nœud ajouté, aucune largeur modifiée : la ligne ne bouge pas.
 *
 * Inoffensif dans la coquille d'édition, où ce même arbre est monté sans
 * `hrefBase` : le clic y ouvre une fenêtre et appelle `preventDefault()`
 * (ADR-0006), donc aucune navigation ne démarre et `pending` y reste faux.
 * Rien à conditionner, et son apparence ne change pas.
 */
function NomDuLien({ nom }: { nom: string }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse text-accent" : undefined}>{nom}</span>;
}

function NodeRow({
  node,
  worldSlug,
  depth,
  currentSlug,
  hrefBase,
  editable,
  onTreeChanged,
  glissable,
}: {
  node: EntityTreeNode;
  worldSlug: string;
  depth: number;
  currentSlug: string | null;
  hrefBase?: string;
  editable?: boolean;
  /** AG-13 : la ligne se range à la main (Livre de sessions) — réf., style et poignée fournis par `SortableNodeRow`. */
  glissable?: { ref: (el: HTMLElement | null) => void; style: React.CSSProperties; poignee: React.ReactNode };
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
    <li ref={glissable?.ref} style={glissable?.style}>
      {/* `group` porte le survol (retour utilisateur) : le menu "..." ne
          s'affiche qu'au survol de la ligne, jamais en permanence — une
          ligne de sommaire n'est pas un bloc, pas de chrome systematique. */}
      <div className="group flex items-center" style={{ paddingLeft: `${depth * 14}px` }}>
        {glissable ? glissable.poignee : hasChildren ? (
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
          /* V3-R5 — jamais de prechargement sur l'arbre.
           *
           * Next precharge par defaut tout `<Link>` entrant dans le champ de
           * vision. Ces routes sont dynamiques : chaque prechargement est un
           * RENDU SERVEUR complet, avec ses requetes en base. Mesure sur le
           * deploiement reel, monde de 27 fiches : ouvrir une page declenchait
           * 45 a 49 prechargements pour 23 routes distinctes — la cause reelle
           * du temps de chargement, tres loin devant le poids du paquet.
           *
           * Et ils ne servaient a rien : un clic normal sur une entite NE
           * NAVIGUE PAS (`useOpenEntityLink` fait `preventDefault()` et ouvre
           * une fenetre, ADR-0006). Le `href` n'existe que pour le ctrl-clic,
           * qui ouvre un onglet neuf et n'utilise donc pas ce cache. On
           * prechargeait 27 routes vers lesquelles on ne va jamais.
           *
           * Reste juste le COUT d'une navigation a froid la ou le clic navigue
           * vraiment (peau « livre », coquille joueur) : une requete, contre
           * vingt-sept prechargees pour en servir au plus une.
           *
           * V2.1-20 lot 6 — cette phrase s'est laissee lire comme si le
           * prechargement etait maintenu quelque part. Il ne l'est nulle part,
           * et surtout : ce commentaire ne couvrait que le SOMMAIRE. Les liens
           * du corps d'une fiche (`PublicBlockView`, le panneau de retroliens
           * retire depuis, le titre de `BookSkin`) n'avaient jamais recu ce
           * drapeau et declenchaient 18
           * requetes par page ouverte. Mesure A/B faite a ce moment-la : un
           * squelette apparait en 18 ms sur une cible prechargee contre 20 ms
           * sur une cible qui ne l'a jamais ete, et une navigation coute
           * exactement son rendu serveur. Le prechargement n'apportait rien
           * nulle part, il est coupe partout. */
          prefetch={false}
          className={`flex-1 truncate rounded px-2 py-1 text-sm transition-colors hover:bg-panel-raised ${
            isActive ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          <NomDuLien nom={node.name} />
          {/* AG-8 : un devoir de journal pas encore rendu, que seuls l'autrice et le MJ voient. */}
          {node.enCours && <span className="ml-1.5 text-xs italic text-ink-muted">{t("enCoursDEcriture")}</span>}
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
/**
 * AG-13 — une page du Livre de sessions, rangée à la main par le MJ : la
 * poignée prend la place de la flèche (une page du Livre n'a pas d'enfant).
 */
function SortableNodeRow(props: Omit<React.ComponentProps<typeof NodeRow>, "glissable">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.node.id });
  return (
    <NodeRow
      {...props}
      glissable={{
        ref: setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition, ...(isDragging ? { position: "relative", zIndex: 10, opacity: 0.9 } : {}) },
        poignee: (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="w-4 shrink-0 touch-none cursor-grab text-xs text-ink-muted opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
            title="Glisser pour réordonner"
            aria-label={`Réordonner la page ${props.node.name}`}
          >
            ⠿
          </button>
        ),
      }}
    />
  );
}

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

  const reloadTree = useCallback(async () => {
    const res = await fetch(`/api/worlds/${worldSlug}/entity-tree`);
    if (!res.ok) return;
    setLocalGroups(await res.json());
  }, [worldSlug]);
  // AG-2 : une fiche créée depuis l'éditeur de texte entre au sommaire sans recharger la page.
  // Seul le sommaire modifiable écoute : la peau publique ne montre pas une fiche neuve, non publique.
  const surFicheCreee = useCallback(() => {
    if (editable) void reloadTree();
  }, [editable, reloadTree]);
  useSurFicheCreee(surFicheCreee);
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
   * Categories (V2-G9), et les pages du Livre de sessions (AG-13). Le
   * classement des autres fiches DANS une categorie est desormais fixe (alphabetique, `buildEntityTree`, retour
   * utilisateur "faciliter la recherche") : plus de glisser-depose par
   * fiche, qui n'aurait plus d'effet visible des le prochain rendu.
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // AG-13 : une page du Livre de sessions, rangée parmi les autres pages.
    const livre = localGroups.find((g) => g.kind === SESSION_JOURNAL_KIND);
    const pages = livre?.items.map((n) => n.id) ?? [];
    if (pages.includes(activeId)) {
      if (!pages.includes(overId)) return;
      const avant = localGroups;
      const ordre = arrayMove(pages, pages.indexOf(activeId), pages.indexOf(overId));
      const parId = new Map(livre!.items.map((n) => [n.id, n]));
      setLocalGroups(localGroups.map((g) => (g.kind === SESSION_JOURNAL_KIND ? { ...g, items: ordre.map((id) => parId.get(id)!) } : g)));
      void fetch(`/api/worlds/${worldSlug}/session-journal-order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: ordre }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        })
        .catch((e) => {
          // Le serveur a refusé : le sommaire reprend l'ordre d'avant plutôt que de mentir.
          console.error("Ordre du Livre de sessions non enregistré", e);
          setLocalGroups(avant);
        });
      return;
    }

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
                {!collapsed && editable && group.kind === SESSION_JOURNAL_KIND && (
                  <SortableContext items={group.items.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                    <ul>
                      {group.items.map((node) => (
                        <SortableNodeRow
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
                  </SortableContext>
                )}
                {!collapsed && !(editable && group.kind === SESSION_JOURNAL_KIND) && (
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
