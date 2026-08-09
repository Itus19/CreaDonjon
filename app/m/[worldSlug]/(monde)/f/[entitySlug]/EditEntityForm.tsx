"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RelationsChips, { type OtherEntityOption, type RelationChip } from "@/components/entities/RelationsChips";
import EntityHistoryPanel from "@/components/entities/EntityHistoryPanel";
import EntityBlocks, { type BlockItem } from "@/components/blocks/EntityBlocks";
import Dropdown from "@/components/shared/Dropdown";
import { ENTITY_KINDS } from "@/lib/entities/schemas";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import type { EntitySummary } from "@/src/server/repos/entities";

const ENTITY_KIND_DROPDOWN_OPTIONS = ENTITY_KINDS.map((kind) => ({
  value: kind,
  label: ENTITY_KIND_LABELS[kind],
}));

/**
 * Toujours editable en place, comme l'ancienne application (master,
 * EntityDetail.tsx) : chaque champ sauvegarde tout seul (blur/changement),
 * jamais de bouton "Enregistrer" separe a chercher.
 */
export default function EditEntityForm({
  entity,
  worldSlug,
  initialBlocks,
  initialRelations,
  otherEntities,
}: {
  entity: EntitySummary;
  worldSlug: string;
  initialBlocks: BlockItem[];
  initialRelations: RelationChip[];
  otherEntities: OtherEntityOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(entity.name);
  const [entityKind, setEntityKind] = useState(entity.entity_kind);
  const [aliases, setAliases] = useState<string[]>(entity.aliases);
  const [newAlias, setNewAlias] = useState("");
  const versionRef = useRef(entity.version);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "conflict" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  type SaveOverrides = {
    name?: string;
    entityKind?: string;
    aliases?: string[];
  };

  /**
   * Deux declencheurs de sauvegarde peuvent se suivre a quelques
   * millisecondes d'intervalle (ex. changer le type puis quitter le champ
   * resume) : sans serialisation, le second part avec une version deja
   * perimee et echoue en 409, perdant silencieusement son changement. La
   * chaine garantit l'ordre et une version toujours a jour.
   */
  function save(overrides?: SaveOverrides) {
    const run = () => doSave(overrides);
    const next = saveChainRef.current.then(run, run);
    saveChainRef.current = next;
    return next;
  }

  async function doSave(overrides?: SaveOverrides) {
    setStatus("saving");
    setErrorMessage(null);

    const res = await fetch(`/api/entities/${entity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: versionRef.current,
        name: overrides?.name ?? name,
        entityKind: overrides?.entityKind ?? entityKind,
        aliases: overrides?.aliases ?? aliases,
      }),
    });

    if (res.status === 409) {
      setStatus("conflict");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setErrorMessage(body?.error ?? "Erreur inattendue.");
      setStatus("error");
      return;
    }

    const updated = await res.json();
    versionRef.current = updated.version;
    setStatus("saved");
    router.refresh();
  }

  function addAlias() {
    const value = newAlias.trim();
    if (value === "" || aliases.includes(value)) return;
    const next = [...aliases, value];
    setAliases(next);
    setNewAlias("");
    save({ aliases: next });
  }

  function removeAlias(alias: string) {
    const next = aliases.filter((a) => a !== alias);
    setAliases(next);
    save({ aliases: next });
  }

  function handleKindChange(kind: string) {
    setEntityKind(kind);
    save({ entityKind: kind });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[1fr_auto] gap-6">
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => save()}
              placeholder="Nouvelle entité"
              // Fiche vierge (V0-06g) : pas d'ecran de creation separe, on
              // arrive directement ici — le focus automatique invite a
              // nommer la fiche tout de suite, sans action supplementaire.
              autoFocus={entity.name === ""}
              className="entity-title flex-1 bg-transparent outline-none placeholder:text-ink-muted focus:border-b focus:border-accent"
            />
            {/* Aligne avec le titre, comme dans l'ancienne application : le
                type de fiche se choisit en haut a droite, pas sous le titre.
                L'historique (icone ronde) vit juste a cote, dans le meme coin
                que les pastilles orange/rouge de la barre de fenetre au-dessus
                (V1-C4, specs/arbitrage-modifications.md §3.1). */}
            <div className="flex shrink-0 items-center gap-2">
              <EntityHistoryPanel entityId={entity.id} />
              <Dropdown
                value={entityKind}
                options={ENTITY_KIND_DROPDOWN_OPTIONS}
                onChange={handleKindChange}
                className="shrink-0 whitespace-nowrap bg-transparent px-1 py-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              />
            </div>
          </div>
          {/* Le slug (identifiant d'URL, sans accents ni ponctuation) vit
              sous le titre — utile comme reference technique, mais pas assez
              pour meriter la place a cote du titre. */}
          <div className="mt-0.5 flex items-center gap-3">
            <span className="font-mech text-xs text-ink-muted">{entity.slug}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Alias :
            </span>
            {aliases.map((alias) => (
              <span
                key={alias}
                className="flex items-center gap-1 rounded-full border border-edge bg-panel-raised px-2.5 py-1"
              >
                {alias}
                <button
                  type="button"
                  onClick={() => removeAlias(alias)}
                  className="text-ink-muted hover:text-danger"
                  aria-label={`Retirer l'alias ${alias}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAlias();
                }
              }}
              placeholder="+ ajouter"
              className="w-24 rounded-full border border-edge bg-transparent px-2.5 py-1 outline-none focus:border-accent"
            />
          </div>

          <div className="mt-4 flex flex-col gap-1.5 border-t border-edge/60 pt-2.5 text-xs">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Relations :
            </span>
            <RelationsChips
              entityId={entity.id}
              worldSlug={worldSlug}
              relations={initialRelations}
              otherEntities={otherEntities}
            />
          </div>
        </div>

        <div className="flex aspect-[3/4] w-56 shrink-0 items-center justify-center rounded-2xl border border-edge bg-panel-sunken text-center text-xs text-ink-muted">
          Portrait
        </div>
      </div>

      {status === "conflict" && (
        <p className="text-sm text-danger">
          Cette fiche a été modifiée entre-temps. Rechargez la page avant de réessayer.
        </p>
      )}
      {status === "error" && errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

      <div className="border-t border-edge pt-3">
        <EntityBlocks entityId={entity.id} initialBlocks={initialBlocks} worldSlug={worldSlug} />
      </div>
    </div>
  );
}
