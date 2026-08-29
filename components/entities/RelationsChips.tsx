"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import Dropdown from "@/components/shared/Dropdown";
import EyeIcon from "@/components/shared/EyeIcon";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import { useDesktop } from "@/components/shell/DesktopContext";
import { RELATION_TYPES } from "@/src/core/relations/inverses";
import { RELATION_LABELS_FR } from "@/src/i18n/fr";

export interface RelationChip {
  id: string;
  relationType: string;
  label: string;
  other: { id: string; name: string; slug: string; entity_kind: string };
  visibilityLevel: string;
}

export interface OtherEntityOption {
  id: string;
  name: string;
  slug: string;
  entity_kind: string;
}

/**
 * Pseudo-type, jamais stocke tel quel (retour utilisateur : impossible de
 * dire "cette fiche est enfant de X" depuis sa propre liste de relations —
 * `RELATION_TYPES` ne contient que les sens canoniques, `parent_of` mais
 * jamais `child_of`, meme motif que la contrainte SQL). Selectionne, il
 * inverse source/cible a l'envoi (`addRelation`) et ecrit `parent_of`
 * avec l'AUTRE entite comme source — la seule chose qui manquait, pas un
 * nouveau vocabulaire de relation.
 */
const CHILD_OF_OPTION = "child_of";

export default function RelationsChips({
  entityId,
  worldSlug,
  relations,
  otherEntities,
  onRelationsChanged,
}: {
  entityId: string;
  worldSlug: string;
  relations: RelationChip[];
  otherEntities: OtherEntityOption[];
  /** V2, retour utilisateur : signale aux blocs genealogie/reseau (qui chargent leur graphe a part) qu'une relation a change ici, pour qu'ils se rechargent aussi. */
  onRelationsChanged?: () => void;
}) {
  const router = useRouter();
  const desktop = useDesktop();
  const [targetEntityId, setTargetEntityId] = useState(otherEntities[0]?.id ?? "");
  const [relationType, setRelationType] = useState<string>(RELATION_TYPES[0]);
  const [visibilityLevel, setVisibilityLevel] = useState("public");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Miroir local (retour utilisateur : le bouton oeil "mettait du temps a
  // s'enclencher") — bascule affichee immediatement, sans attendre le
  // rechargement complet de la page que `router.refresh()` declenche pour
  // tout le reste (ajout/suppression, qui changent l'ENSEMBLE des lignes,
  // pas seulement un champ). Resynchronise "pendant le rendu" (React,
  // "Adjusting state when a prop changes") plutot que dans un effet — la
  // liste change quand le serveur en renvoie une nouvelle (ajout/
  // suppression, navigation vers une autre fiche), jamais a chaque rendu.
  const [prevRelations, setPrevRelations] = useState(relations);
  const [localRelations, setLocalRelations] = useState(relations);
  if (relations !== prevRelations) {
    setPrevRelations(relations);
    setLocalRelations(relations);
  }

  const groups = new Map<string, RelationChip[]>();
  for (const relation of localRelations) {
    const kind = relation.other.entity_kind;
    const list = groups.get(kind) ?? [];
    list.push(relation);
    groups.set(kind, list);
  }

  async function removeRelation(id: string) {
    await fetch(`/api/relations/${id}`, { method: "DELETE" });
    router.refresh();
    onRelationsChanged?.();
  }

  /** Bascule œil (retour utilisateur) : public/gm seulement, meme binaire que le masquage d'un lien depuis le bloc reseau (`RelationsGraphBlockEditor.tsx`) — pas le selecteur complet a 6 niveaux pour un geste rapide. Optimiste : la puce reflete le nouvel etat tout de suite, la requete part en arriere-plan. */
  async function toggleVisibility(relation: RelationChip) {
    const nextLevel = relation.visibilityLevel === "gm" ? "public" : "gm";
    setLocalRelations((prev) => prev.map((r) => (r.id === relation.id ? { ...r, visibilityLevel: nextLevel } : r)));
    await fetch(`/api/relations/${relation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: { level: nextLevel, scopeId: null } }),
    });
    onRelationsChanged?.();
  }

  async function addRelation() {
    if (!targetEntityId) return;
    setPending(true);
    setError(null);
    // "Enfant de" (retour utilisateur) : l'AUTRE entite devient la source
    // de la requete, cette fiche la cible — meme ecriture `parent_of` que
    // si on l'avait faite depuis la fiche de l'autre entite, juste sans
    // avoir a y naviguer.
    const isChildOf = relationType === CHILD_OF_OPTION;
    const res = await fetch(`/api/entities/${isChildOf ? targetEntityId : entityId}/relations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetEntityId: isChildOf ? entityId : targetEntityId,
        relationType: isChildOf ? "parent_of" : relationType,
        visibility: { level: visibilityLevel, scopeId: null },
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible d'ajouter cette relation.");
      return;
    }
    router.refresh();
    onRelationsChanged?.();
  }

  return (
    <div className="flex flex-col gap-2">
      {[...groups.entries()].map(([kind, chips]) => (
        <div key={kind} className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {ENTITY_KIND_LABELS[kind as keyof typeof ENTITY_KIND_LABELS] ?? kind}
          </span>
          {chips.map((relation) => (
            <span
              key={relation.id}
              className="flex items-center gap-1.5 rounded-full border border-edge bg-panel-raised px-3 py-1 text-xs"
            >
              <button
                type="button"
                onClick={() => toggleVisibility(relation)}
                className="text-ink-muted hover:text-ink"
                aria-label={relation.visibilityLevel === "gm" ? "Rendre cette relation publique" : "Masquer cette relation aux joueurs"}
                title={relation.visibilityLevel === "gm" ? "Masquée aux joueurs — cliquer pour rendre publique" : "Visible publiquement — cliquer pour masquer"}
              >
                <EyeIcon open={relation.visibilityLevel !== "gm"} className="h-3.5 w-3.5" />
              </button>
              <span className="text-ink-muted">{RELATION_LABELS_FR[relation.label] ?? relation.label}</span>
              <Link
                href={`/m/${worldSlug}/f/${relation.other.slug}`}
                onClick={(e) => {
                  if (!desktop) return;
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                  e.preventDefault();
                  desktop.openRef({ kind: "entity", key: relation.other.slug });
                }}
                className="font-medium text-link-entity hover:underline"
              >
                {relation.other.name}
              </Link>
              <button
                type="button"
                onClick={() => removeRelation(relation.id)}
                className="text-ink-muted hover:text-danger"
                aria-label="Retirer cette relation"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ))}
      {localRelations.length === 0 && (
        <p className="text-sm text-ink-muted">Aucune relation pour l&apos;instant.</p>
      )}

      {otherEntities.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Dropdown
            value={relationType}
            options={[
              ...RELATION_TYPES.map((type) => ({ value: type, label: RELATION_LABELS_FR[type] ?? type })),
              { value: CHILD_OF_OPTION, label: RELATION_LABELS_FR[CHILD_OF_OPTION] ?? CHILD_OF_OPTION },
              // Retour utilisateur : options triees par ordre alphabetique du
              // libelle affiche (pas de l'ordre du vocabulaire ferme ci-dessus,
              // qui suit un tout autre critere — voir inverses.ts).
            ].sort((a, b) => a.label.localeCompare(b.label, "fr"))}
            onChange={setRelationType}
            aria-label="Type de relation"
          />
          <Dropdown
            value={targetEntityId}
            options={otherEntities.map((other) => ({ value: other.id, label: other.name }))}
            onChange={setTargetEntityId}
            aria-label="Entité cible"
          />
          <Dropdown
            value={visibilityLevel}
            options={VISIBILITY_OPTIONS}
            onChange={setVisibilityLevel}
            aria-label="Visibilité de la relation"
          />
          <button
            type="button"
            onClick={addRelation}
            disabled={pending}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            + Ajouter une relation
          </button>
          {error && <span className="text-xs text-danger">{error}</span>}
        </div>
      )}
    </div>
  );
}
