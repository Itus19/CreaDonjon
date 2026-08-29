"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GenealogyBlockData } from "@/src/core/schemas/blocks/genealogy";
import type { FamilyRelationType, FamilyTree, FamilyTreeEdge, FamilyTreeNode } from "@/src/core/genealogy/buildFamilyTree";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import FamilyTreeCanvas from "@/components/entities/genealogy/FamilyTreeCanvas";
import FamilyTreeCard from "@/components/entities/genealogy/FamilyTreeCard";

/** Menu rapide du "+" (V2-H3, esthetique de reference) : le role de l'ancre determine source/cible de la relation creee. */
const RELATION_MENU_OPTIONS: { label: string; relationType: FamilyRelationType; anchorRole: "source" | "target" }[] = [
  { label: "Parent", relationType: "parent_of", anchorRole: "target" },
  { label: "Enfant", relationType: "parent_of", anchorRole: "source" },
  { label: "Partenaire", relationType: "partner_of", anchorRole: "source" },
  { label: "Ex-partenaire", relationType: "ex_partner_of", anchorRole: "source" },
  { label: "Frère/sœur", relationType: "sibling_of", anchorRole: "source" },
  { label: "Demi-frère/sœur", relationType: "half_sibling_of", anchorRole: "source" },
  { label: "Beau-parent", relationType: "step_parent_of", anchorRole: "target" },
  { label: "Beau-enfant", relationType: "step_parent_of", anchorRole: "source" },
  { label: "Adopté(e)", relationType: "adopted_by", anchorRole: "source" },
];

const MENU_WIDTH = 256;

interface AnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

type MenuStep =
  | { anchorId: string; rect: AnchorRect }
  | { anchorId: string; rect: AnchorRect; option: (typeof RELATION_MENU_OPTIONS)[number] };

/**
 * Editeur du bloc genealogie (V2-H3) : arbre derive de `relations`
 * (jamais stocke ici), rafraichi depuis `/api/entities/[id]/genealogy`
 * apres chaque ajout/suppression. Le "+" au survol d'une carte ouvre,
 * juste a cote de lui, un menu de type de lien puis une recherche/creation
 * de fiche — memes routes que `RelationsChips.tsx` (creer/retirer une
 * relation), aucune nouvelle mecanique d'ecriture, juste une autre porte
 * d'entree.
 *
 * Le menu est porte hors du canevas via un portail (`createPortal`), en
 * position `fixed` calculee depuis le rectangle reel du bouton "+" : le
 * canevas est dans un conteneur `overflow-x-auto`, et un menu ancre par
 * simple CSS relatif a la carte se faisait rogner des qu'elle etait sur le
 * bord gauche ou droit de l'arbre. Le portail evite tout rognage, quelle
 * que soit la position de la carte ou le defilement du canevas.
 */
export default function GenealogyBlockEditor({
  entityId,
  worldId,
  worldSlug,
  data,
  otherEntities,
  onRelationsChanged,
  reloadSignal,
}: {
  entityId: string;
  worldId: string;
  worldSlug: string;
  data: GenealogyBlockData;
  otherEntities: OtherEntityOption[];
  /** Rafraichit la section "Relations" en tete de fiche — meme table, deux vues (V2-H3). */
  onRelationsChanged: () => void;
  /** V2, retour utilisateur : incremente par un ancetre quand une relation change ailleurs (liste du haut, bloc reseau) — force le rechargement de l'arbre, qui sinon ne rejoue jamais son effet (`genealogyUrl` seul en dependance). */
  reloadSignal?: number;
}) {
  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [menu, setMenu] = useState<MenuStep | null>(null);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);

  const rootEntityId = data.rootEntityId ?? entityId;
  const genealogyUrl = `/api/entities/${entityId}/genealogy?${new URLSearchParams({
    rootEntityId,
    depthUp: String(data.depthUp),
    depthDown: String(data.depthDown),
  })}`;

  useEffect(() => {
    let cancelled = false;
    fetch(genealogyUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: FamilyTree | null) => {
        if (!cancelled && body) setTree(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [genealogyUrl, reloadSignal]);

  /** Reappel imperatif apres l'ajout/la suppression d'une relation (pas dans un effet, donc sans le meme garde-fou de setState). */
  async function loadTree() {
    const res = await fetch(genealogyUrl);
    if (res.ok) setTree(await res.json());
  }

  function openMenu(anchorId: string, rect: AnchorRect) {
    setQuery("");
    setMenu({ anchorId, rect });
  }

  function pickOption(option: (typeof RELATION_MENU_OPTIONS)[number]) {
    if (!menu) return;
    setQuery("");
    setMenu({ anchorId: menu.anchorId, rect: menu.rect, option });
  }

  async function linkExisting(targetEntity: OtherEntityOption) {
    if (!menu || !("option" in menu)) return;
    await createFamilyRelation(menu.anchorId, targetEntity.id, menu.option);
  }

  async function createAndLink(name: string) {
    if (!menu || !("option" in menu) || !name.trim()) return;
    setPending(true);
    const res = await fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldId, name: name.trim(), entityKind: "character" }),
    });
    setPending(false);
    if (!res.ok) return;
    const created = (await res.json()) as { id: string };
    await createFamilyRelation(menu.anchorId, created.id, menu.option);
  }

  async function createFamilyRelation(
    anchorId: string,
    otherId: string,
    option: (typeof RELATION_MENU_OPTIONS)[number]
  ) {
    setPending(true);
    const [sourceEntityId, targetEntityId] =
      option.anchorRole === "source" ? [anchorId, otherId] : [otherId, anchorId];
    await fetch(`/api/entities/${sourceEntityId}/relations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetEntityId,
        relationType: option.relationType,
        visibility: { level: "public", scopeId: null },
      }),
    });
    setPending(false);
    setMenu(null);
    setQuery("");
    await loadTree();
    onRelationsChanged();
  }

  async function deleteEdge(edge: FamilyTreeEdge) {
    await fetch(`/api/relations/${edge.id}`, { method: "DELETE" });
    await loadTree();
    onRelationsChanged();
  }

  /** Bouton oeil sur le trait epingle (V2, retour utilisateur point 4) — meme route et meme bascule binaire que RelationsChips.tsx et RelationsGraphBlockEditor.tsx : les trois vues d'une meme relation restent synchronisees. */
  async function toggleEdgeVisibility(edge: FamilyTreeEdge) {
    const nextLevel = edge.visibilityLevel === "gm" ? "public" : "gm";
    await fetch(`/api/relations/${edge.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: { level: nextLevel, scopeId: null } }),
    });
    await loadTree();
    onRelationsChanged();
  }

  if (!tree) return <p className="text-sm text-ink-muted">Chargement de l&apos;arbre…</p>;

  const matches =
    menu && "option" in menu && query.trim().length > 0
      ? otherEntities.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
      : [];

  // Ouvre a droite du bouton par defaut, bascule a gauche si ca deborderait
  // du viewport — jamais rogne, quelle que soit la colonne de la carte.
  const menuStyle = menu
    ? (() => {
        const openLeft = menu.rect.right + MENU_WIDTH + 8 > window.innerWidth;
        const left = openLeft ? menu.rect.left - MENU_WIDTH - 8 : menu.rect.right + 8;
        const top = Math.min(menu.rect.top, window.innerHeight - 260);
        return { left: Math.max(8, left), top: Math.max(8, top) };
      })()
    : null;

  return (
    <>
      <FamilyTreeCanvas
        tree={tree}
        onDeleteEdge={deleteEdge}
        onToggleEdgeVisibility={toggleEdgeVisibility}
        renderCard={(node: FamilyTreeNode) => <FamilyTreeCard node={node} href={`/m/${worldSlug}/f/${node.slug}`} />}
        renderNodeOverlay={(node, scale) => (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openMenu(node.id, e.currentTarget.getBoundingClientRect());
            }}
            aria-label={`Ajouter un proche de ${node.name}`}
            // Contre-echelle (retour utilisateur) : garde un bouton de 24px
            // a l'ecran quel que soit le zoom du canevas — sans ca, un
            // arbre dezoome (MIN_ZOOM 0.3) le retrecit a ~7px, quasi
            // impossible a viser a la souris.
            style={{ transform: `scale(${1 / scale})`, transformOrigin: "top right" }}
            className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-edge-strong bg-panel-raised text-sm text-ink shadow-md hover:bg-panel group-hover:flex"
          >
            +
          </button>
        )}
      />

      {menu &&
        menuStyle &&
        createPortal(
          <>
            {/* Fond invisible plein ecran : ferme le menu au clic en dehors, sans intercepter le reste de la page tant qu'il n'est pas ouvert. */}
            <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed z-40 rounded-lg border border-edge-strong bg-panel-raised p-2 shadow-2xl"
              style={{ left: menuStyle.left, top: menuStyle.top, width: MENU_WIDTH }}
            >
              {!("option" in menu) ? (
                <div className="grid grid-cols-2 gap-1">
                  {RELATION_MENU_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => pickOption(option)}
                      className="rounded px-2 py-1.5 text-left text-xs text-ink hover:bg-panel"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher ou créer une fiche…"
                    className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm"
                  />
                  <div className="flex max-h-40 flex-col overflow-y-auto">
                    {matches.map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        disabled={pending}
                        onClick={() => linkExisting(entity)}
                        className="rounded px-2 py-1.5 text-left text-xs text-ink hover:bg-panel disabled:opacity-50"
                      >
                        {entity.name}
                      </button>
                    ))}
                    {query.trim().length > 0 && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => createAndLink(query)}
                        className="rounded px-2 py-1.5 text-left text-xs text-accent hover:bg-panel disabled:opacity-50"
                      >
                        + Créer « {query.trim()} »
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMenu(null)}
                    className="mt-1 text-left text-xs text-ink-muted hover:text-ink"
                  >
                    Passer pour l&apos;instant
                  </button>
                </div>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
