"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from "d3-force";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDesktop } from "@/components/shell/DesktopContext";
import RelationsGraphNodeCard, { TEINTE_FOND } from "./RelationsGraphNodeCard";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import {
  filtresParGenre,
  idsVisibles,
  lienVisible,
  liensDeCarte,
  nomsUtiles,
  toucher,
  trouver,
  voisinage,
  type GroupeReseau,
} from "@/lib/ui/reseau";
import type { RelationsGraph, RelationsGraphEdge, RelationsGraphNode } from "@/src/core/relationsGraph/buildRelationsGraph";

const ICON_SIZE = 40;
const ROOT_ICON_SIZE = 56;
/** Marge de securite autour de chaque nœud, pour que son etiquette de nom ne deborde jamais du cadre calcule. */
const NODE_MARGIN = 70;
const VIEWPORT_HEIGHT = 420;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
/** En dessous de ce deplacement (px), un clic-relache reste un clic — pas un panoramique qui devrait avaler le clic suivant. */
const DRAG_THRESHOLD = 4;
/** Simulation calculee une fois, statique a l'affichage — pas d'animation continue, un graphe de fiche n'a pas besoin de "respirer". */
const TICKS = 300;

interface PositionedNode extends RelationsGraphNode, SimulationNodeDatum {}

function layout(graph: RelationsGraph): PositionedNode[] {
  const nodes: PositionedNode[] = graph.nodes.map((n) => ({ ...n }));
  const links = graph.edges.map((e) => ({ source: e.fromId, target: e.toId }));

  const simulation = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-260))
    // Retour utilisateur : distance doublee (110 -> 220) pour respirer un
    // peu plus entre les nœuds — la seule valeur touchee, charge/collision
    // inchangees.
    .force("link", forceLink(links).id((d) => (d as PositionedNode).id).distance(220))
    .force("center", forceCenter(0, 0))
    .force("collide", forceCollide(ROOT_ICON_SIZE / 2 + 20))
    .stop();

  for (let i = 0; i < TICKS; i++) simulation.tick();
  return nodes;
}

/** Un écran sans survol (téléphone, tablette au doigt) : un toucher allume, un second ouvre. */
function surveillerSansSurvol(rappel: () => void): () => void {
  const requete = window.matchMedia("(hover: none)");
  requete.addEventListener("change", rappel);
  return () => requete.removeEventListener("change", rappel);
}
const sansSurvol = () => window.matchMedia("(hover: none)").matches;
const sansSurvolServeur = () => false;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Graphe de relations auto-organise (V2-H1 phase 5, reprise visuelle sur
 * references fournies par l'utilisateur) — d3-force pour le placement
 * (charge repulsive + liens + collision), nœuds rendus en cartes portrait
 * (`RelationsGraphNodeCard`, meme repli initiale que `FamilyTreeCard`)
 * plutot que de simples cercles. Pan (glisser) + zoom (molette centree sur
 * le curseur) + cadrage automatique a l'ouverture : meme mecanique que
 * `FamilyTreeCanvas.tsx` (genealogie), dupliquee plutot que partagee — la
 * genealogie route ses traits en angle droit par generation/ordre, ce
 * graphe positionne par simulation de forces, deux mises en page trop
 * differentes pour un seul composant (troisieme occurrence a generaliser,
 * pas la deuxieme, CLAUDE.md).
 *
 * Survol d'un nœud = met en surbrillance le nœud et ses liens de premier
 * degre, estompe le reste, ET affiche le libelle de CHACUN de ces liens a
 * la fois (retour utilisateur — pas un seul). Survol d'un LIEN = meme
 * estompage sur ses deux extremites, plus son propre libelle affiche
 * au-dessus (« membre de », « parent de »...) — sans action, juste
 * l'explication ; cliquer le lien l'EPINGLE (le libelle reste affiche
 * apres avoir bouge la souris) et revele en plus le bouton masquer/
 * afficher, si fourni.
 *
 * V3.1-72 : une vignette de 40 px (56 au centre) avec un liseré par genre ;
 * cliquer la choisit (la carte de la fiche, « Ouvrir la fiche » est un vrai
 * lien) au lieu de l'ouvrir. Filtres par genre avec leur nombre (la fiche du
 * centre ne se masque jamais), « Trouver… », « Tout montrer ». Sans survol
 * (téléphone) : un toucher allume et nomme les voisins, un second ouvre. Tout
 * le calcul est dans `lib/ui/reseau.ts`.
 */
export default function RelationsGraphCanvas({
  graph,
  hrefBase,
  edgeColor,
  onToggleEdgeVisibility,
}: {
  graph: RelationsGraph;
  /** Base des liens vers une fiche — `/m/[worldSlug]/f` en edition, `/m/[worldSlug]/apercu` (ou `/partage/[token]`) sur le wiki public. Meme motif que `PublicGenealogyBlock`/`PublicQuestBlock`. */
  hrefBase: string;
  /** Couleur d'un lien direct depuis la racine (relationshipColor si une attitude existe), sinon `var(--edge)`. */
  edgeColor: (edge: RelationsGraphEdge) => string;
  onToggleEdgeVisibility?: (edge: RelationsGraphEdge) => void;
}) {
  const desktop = useDesktop();
  const router = useRouter();
  const t = useTranslations("fiche.reseau");
  const tactile = useSyncExternalStore(surveillerSansSurvol, sansSurvol, sansSurvolServeur);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // La vignette choisie : au téléphone le premier toucher, sur ordinateur le clic (la carte de la fiche s'ouvre).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [masques, setMasques] = useState<ReadonlySet<GroupeReseau>>(new Set());
  const [recherche, setRecherche] = useState("");
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [pinnedEdgeId, setPinnedEdgeId] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const fittedForRef = useRef<string | null>(null);

  const positioned = useMemo(() => layout(graph), [graph]);
  const byId = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);

  // Cadre englobant de la simulation (jamais garanti dans une taille fixe,
  // contrairement a l'ancien viewBox statique) : chaque nœud a une marge
  // fixe pour son icone + etiquette, quelle que soit sa taille reelle.
  const bounds = useMemo(() => {
    if (positioned.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 };
    const xs = positioned.map((n) => n.x ?? 0);
    const ys = positioned.map((n) => n.y ?? 0);
    const minX = Math.min(...xs) - NODE_MARGIN;
    const maxX = Math.max(...xs) + NODE_MARGIN;
    const minY = Math.min(...ys) - NODE_MARGIN;
    const maxY = Math.max(...ys) + NODE_MARGIN;
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [positioned]);

  // La vignette qui s'allume : celle qu'on survole, à défaut celle qu'on a choisie.
  const activeId = hoveredId ?? selectedId;
  const lumiere = useMemo(() => (activeId ? voisinage(graph, activeId) : null), [activeId, graph]);

  const highlightedNodeIds = useMemo(() => {
    if (lumiere) return lumiere.noeuds;
    if (hoveredEdgeId) {
      const edge = graph.edges.find((e) => e.id === hoveredEdgeId);
      if (edge) return new Set([edge.fromId, edge.toId]);
    }
    return null;
  }, [lumiere, hoveredEdgeId, graph.edges]);

  const visibles = useMemo(() => idsVisibles(graph.nodes, masques), [graph.nodes, masques]);
  const filtres = useMemo(() => filtresParGenre(graph.nodes), [graph.nodes]);
  const trouves = useMemo(() => trouver(graph.nodes, recherche), [graph.nodes, recherche]);
  const noms = useMemo(() => nomsUtiles(graph, selectedId), [graph, selectedId]);
  const selectedNode = selectedId ? byId.get(selectedId) : undefined;
  const quelqueChoseDeFiltre = masques.size > 0 || recherche.trim() !== "" || selectedId !== null;

  // Etiquette(s) affichee(s) (retour utilisateur) : un lien EPINGLE reste
  // toujours visible (petit bug corrige : survoler un autre portrait le
  // faisait disparaitre avant), auquel s'ajoutent toutes les aretes
  // directes du portrait survole (pas une seule a la fois) ou, a defaut,
  // la seule arete directement survolee.
  const edgesToLabel = (() => {
    const byId = new Map(graph.edges.map((e) => [e.id, e] as const));
    const result = new Map<string, RelationsGraphEdge>();
    const pinned = pinnedEdgeId ? byId.get(pinnedEdgeId) : undefined;
    if (pinned) result.set(pinned.id, pinned);
    if (lumiere) {
      for (const e of graph.edges) {
        if (lumiere.liens.has(e.id) && lienVisible(e, visibles)) result.set(e.id, e);
      }
    } else if (hoveredEdgeId) {
      const e = byId.get(hoveredEdgeId);
      if (e) result.set(e.id, e);
    }
    return [...result.values()];
  })();

  const nodesSignature = graph.nodes
    .map((n) => n.id)
    .sort()
    .join(",");

  // Centre et ajuste a la fenetre a l'ouverture et a chaque changement
  // structurel (degre de liens change, nœud ajoute/retire) — jamais a
  // chaque re-rendu, ce qui effacerait un panoramique/zoom manuel en cours.
  useLayoutEffect(() => {
    if (fittedForRef.current === nodesSignature) return;
    fittedForRef.current = nodesSignature;
    const container = containerRef.current;
    if (!container || bounds.width === 0 || bounds.height === 0) return;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const fitScale = clamp(Math.min(containerWidth / bounds.width, containerHeight / bounds.height, 1), MIN_ZOOM, MAX_ZOOM);
    setView({
      scale: fitScale,
      x: containerWidth / 2 - (bounds.minX + bounds.width / 2) * fitScale,
      y: containerHeight / 2 - (bounds.minY + bounds.height / 2) * fitScale,
    });
  }, [nodesSignature, bounds]);

  // Molette non-passive (React attache onWheel en passif par defaut) :
  // sans ceci, preventDefault() n'empeche pas la page de defiler en plus
  // du zoom du canevas. Ctrl+molette seulement (retour utilisateur) : une
  // simple molette laisse la page defiler normalement.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      setView((current) => {
        const nextScale = clamp(current.scale * (1 - e.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);
        const worldX = (cursorX - current.x) / current.scale;
        const worldY = (cursorY - current.y) / current.scale;
        return { scale: nextScale, x: cursorX - worldX * nextScale, y: cursorY - worldY * nextScale };
      });
    }
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: view.x, startPanY: view.y, moved: false };
    setIsDragging(true);
  }

  function handleMouseMove(e: React.MouseEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
    if (drag.moved) setView((current) => ({ ...current, x: drag.startPanX + dx, y: drag.startPanY + dy }));
  }

  function endDrag() {
    if (dragRef.current?.moved) suppressClickRef.current = true;
    dragRef.current = null;
    setIsDragging(false);
  }

  function handleClickCapture(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }

  function openEntity(node: RelationsGraphNode, e: React.MouseEvent) {
    if (!desktop) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    desktop.openRef({ kind: "entity", key: node.slug });
  }

  /** Toucher/cliquer une vignette : téléphone, premier toucher = sélection et second = ouverture ; ordinateur, la carte de la fiche. */
  function choisir(node: RelationsGraphNode) {
    if (!tactile) {
      setSelectedId((courant) => (courant === node.id ? null : node.id));
      return;
    }
    const suite = toucher({ selection: selectedId }, node.id);
    setSelectedId(suite.etat.selection);
    if (suite.ouvrir) {
      if (desktop) desktop.openRef({ kind: "entity", key: node.slug });
      else router.push(`${hrefBase}/${node.slug}`);
    }
  }

  function toutMontrer() {
    setMasques(new Set());
    setRecherche("");
    setSelectedId(null);
    setHoveredId(null);
  }

  function basculerGenre(groupe: GroupeReseau) {
    setMasques((courant) => {
      const suite = new Set(courant);
      if (suite.has(groupe)) suite.delete(groupe);
      else suite.add(groupe);
      return suite;
    });
  }

  if (positioned.length === 0) {
    return <p className="text-sm text-ink-muted">{t("aucuneRelation")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Filtres par genre avec leur nombre ; en bande qui défile sur téléphone. */}
        <div className="flex min-w-0 max-w-full gap-1 overflow-x-auto pb-0.5 @md/bloc:flex-wrap">
          {filtres.map(({ groupe, n }) => {
            const masque = masques.has(groupe);
            return (
              <button
                key={groupe}
                type="button"
                aria-pressed={!masque}
                onClick={() => basculerGenre(groupe)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  masque ? "border-edge text-ink-muted line-through opacity-60" : "border-edge-strong text-ink hover:bg-panel-raised"
                }`}
              >
                <i aria-hidden className={`h-2 w-2 rounded-sm ${TEINTE_FOND[groupe]}`} />
                {t("filtre", { groupe: t(`groupes.${groupe}`), n })}
              </button>
            );
          })}
        </div>
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={t("trouver")}
          aria-label={t("trouverLabel")}
          className="ml-auto w-40 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
        {quelqueChoseDeFiltre && (
          <button
            type="button"
            onClick={toutMontrer}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
          >
            {t("toutMontrer")}
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-xl border border-edge/60 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          height: VIEWPORT_HEIGHT,
          backgroundImage: "radial-gradient(var(--edge) 1px, transparent 1px)",
          backgroundSize: `${18 * view.scale}px ${18 * view.scale}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
          backgroundColor: "color-mix(in oklch, var(--panel-sunken) 60%, transparent)",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClickCapture={handleClickCapture}
        onClick={() => {
          setPinnedEdgeId(null);
          if (!tactile) setSelectedId(null);
        }}
      >
        <div
          className="absolute left-0 top-0"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}
        >
          <svg
            className="pointer-events-none absolute"
            style={{ left: bounds.minX, top: bounds.minY }}
            width={bounds.width}
            height={bounds.height}
          >
            {graph.edges.map((edge) => {
              const from = byId.get(edge.fromId);
              const to = byId.get(edge.toId);
              if (!from || !to || !lienVisible(edge, visibles)) return null;
              const dimmed = highlightedNodeIds ? !(highlightedNodeIds.has(edge.fromId) && highlightedNodeIds.has(edge.toId)) : false;
              // Retour utilisateur : un lien masque au wiki public (tout
              // sauf `public`) reste grise, meme survole/epingle — pour que
              // ce qui n'apparaitra jamais aux joueurs se distingue d'un
              // coup d'œil, sans avoir a ouvrir chaque lien pour verifier.
              const hiddenFromPublic = edge.visibilityLevel !== "public";
              const x1 = (from.x ?? 0) - bounds.minX;
              const y1 = (from.y ?? 0) - bounds.minY;
              const x2 = (to.x ?? 0) - bounds.minX;
              const y2 = (to.y ?? 0) - bounds.minY;
              return (
                <g
                  key={edge.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedEdgeId(edge.id === pinnedEdgeId ? null : edge.id);
                  }}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseLeave={() => setHoveredEdgeId((current) => (current === edge.id ? null : current))}
                  className="pointer-events-auto cursor-pointer"
                >
                  {/* Trait invisible mais large : le trait visible (1.5px) est bien trop fin pour cliquer/survoler de maniere fiable a la souris — meme zone de clic que le trait rendu, juste plus genereuse. */}
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={hiddenFromPublic ? "var(--ink-muted)" : edgeColor(edge)}
                    strokeWidth={edgesToLabel.some((e) => e.id === edge.id) ? 3 : 1.5}
                    strokeDasharray={hiddenFromPublic ? "4 3" : undefined}
                    opacity={dimmed ? 0.2 : hiddenFromPublic ? 0.45 : 0.8}
                  />
                </g>
              );
            })}
          </svg>

          {positioned.map((node) => {
            if (!visibles.has(node.id)) return null;
            const dimmed = highlightedNodeIds ? !highlightedNodeIds.has(node.id) : false;
            const isRoot = node.degree === 0;
            const size = isRoot ? ROOT_ICON_SIZE : ICON_SIZE;
            return (
              /* Un bouton, pas un lien : toucher choisit la vignette (la carte
                 de la fiche, ou au téléphone un premier toucher), et « Ouvrir
                 la fiche » est un vrai lien dans la carte. Ici le lien d'avant
                 préchargeait des dizaines de fiches d'un coup
                 (`prefetch={false}`, V2.1-20 lot 6) : plus rien à précharger. */
              <button
                key={node.id}
                type="button"
                aria-pressed={selectedId === node.id}
                aria-label={node.name}
                onClick={(e) => {
                  // Sinon le clic remonte au fond, qui désélectionne : la carte ne paraîtrait jamais.
                  e.stopPropagation();
                  choisir(node);
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity"
                style={{ left: node.x, top: node.y, opacity: dimmed ? 0.2 : 1 }}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setHoveredId(node.id);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse") setHoveredId(null);
                }}
              >
                <RelationsGraphNodeCard
                  id={node.id}
                  name={node.name}
                  entityKind={node.entityKind}
                  hasPortrait={node.hasPortrait}
                  size={size}
                  isRoot={isRoot}
                  nom={!tactile || noms.has(node.id)}
                  brille={trouves.has(node.id)}
                />
              </button>
            );
          })}

          {edgesToLabel.map((edge) => {
            const from = byId.get(edge.fromId);
            const to = byId.get(edge.toId);
            if (!from || !to) return null;
            const midX = ((from.x ?? 0) + (to.x ?? 0)) / 2;
            const midY = ((from.y ?? 0) + (to.y ?? 0)) / 2;
            const isPinned = edge.id === pinnedEdgeId;
            return (
              <div
                key={edge.id}
                className={`pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-edge-strong bg-panel-raised py-1 text-xs text-ink shadow-lg ${isPinned ? "pointer-events-auto pl-2.5 pr-1" : "px-2.5"}`}
                style={{ left: midX, top: midY }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-ink-muted">{edge.label}</span>
                {isPinned && onToggleEdgeVisibility && (
                  <button
                    type="button"
                    onClick={() => onToggleEdgeVisibility(edge)}
                    className="rounded-full px-2 py-0.5 text-ink transition-colors hover:bg-panel"
                  >
                    {edge.visibilityLevel === "gm" ? t("rendreVisible") : t("masquerAuxJoueurs")}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* La carte de la fiche choisie (ordinateur) : nom, genre, trois liens, « Ouvrir la fiche ». Hors de la couche zoomée : elle ne bouge ni ne grossit avec le graphe. */}
        {!tactile && selectedNode && (
          <div
            className="absolute bottom-3 left-3 z-10 flex max-w-72 flex-col gap-1 rounded-xl border border-edge-strong bg-panel-raised p-2.5 text-xs shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <b className="text-sm text-ink">{selectedNode.name}</b>
            <span className="text-ink-muted">
              {(ENTITY_KIND_LABELS as Record<string, string>)[selectedNode.entityKind] ?? selectedNode.entityKind}
            </span>
            <ul className="flex flex-col gap-0.5 text-ink-soft">
              {liensDeCarte(graph, selectedNode.id).map((l) => (
                <li key={l.id}>
                  <span aria-hidden>{l.sortant ? "→" : "←"}</span> {l.label} · {l.autre}
                </li>
              ))}
            </ul>
            <Link
              href={`${hrefBase}/${selectedNode.slug}`}
              prefetch={false}
              onClick={(e) => openEntity(selectedNode, e)}
              className="mt-1 self-start rounded-full border border-edge px-3 py-1 text-ink transition-colors hover:bg-panel"
            >
              {t("ouvrirFiche")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
