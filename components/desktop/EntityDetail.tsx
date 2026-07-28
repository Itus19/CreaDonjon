"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  addAlias,
  addBlock,
  addRelation,
  removeAlias,
  removeRelation,
} from "@/lib/actions/entities";
import { entityKindColor } from "@/lib/entityKindColors";

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  joueurs: "Joueurs",
  mj: "MJ uniquement",
  prive: "Privé",
};

const BLOCK_TYPE_PRESETS = [
  "personnage",
  "biologie",
  "inventaire",
  "faction",
  "geographie",
  "objectifs",
  "chronologie",
  "statistiques",
];

type Entity = {
  id: string;
  name: string;
  entity_kind: string | null;
  summary: string | null;
  aliases: string[];
};

type Block = {
  id: string;
  block_type: string;
  data: { content?: string } | Record<string, unknown>;
  visibility: string;
  display_order: number;
};

type RelationRow = {
  id: string;
  relationType: string;
  visibility: string;
  otherId: string;
  otherName: string;
  otherKind: string | null;
  direction: "out" | "in";
};

export default function EntityDetail({
  worldId,
  entityId,
  onOpenEntity,
  onLoaded,
}: {
  worldId: string;
  entityId: string;
  onOpenEntity?: (entityId: string, name: string, entityKind: string | null) => void;
  onLoaded?: (entity: { name: string; entity_kind: string | null }) => void;
}) {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [otherEntities, setOtherEntities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pendingBlockType, setPendingBlockType] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();

    const [{ data: entityData }, { data: blocksData }, { data: outgoing }, { data: incoming }, { data: others }] =
      await Promise.all([
        supabase
          .from("entities")
          .select("id, name, entity_kind, summary, aliases")
          .eq("id", entityId)
          .single(),
        supabase
          .from("blocks")
          .select("id, block_type, data, visibility, display_order")
          .eq("entity_id", entityId)
          .order("display_order"),
        supabase
          .from("relations")
          .select("id, relation_type, visibility, target:target_entity_id(id, name, entity_kind)")
          .eq("source_entity_id", entityId),
        supabase
          .from("relations")
          .select("id, relation_type, visibility, source:source_entity_id(id, name, entity_kind)")
          .eq("target_entity_id", entityId),
        supabase
          .from("entities")
          .select("id, name")
          .eq("world_id", worldId)
          .neq("id", entityId)
          .order("name"),
      ]);

    if (!entityData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setEntity(entityData);
    onLoaded?.({ name: entityData.name, entity_kind: entityData.entity_kind });
    setBlocks(blocksData ?? []);
    setOtherEntities(others ?? []);

    type RawOther = { id: string; name: string; entity_kind: string | null };

    setRelations([
      ...(outgoing ?? []).map((r) => {
        const target = r.target as unknown as RawOther;
        return {
          id: r.id,
          relationType: r.relation_type,
          visibility: r.visibility,
          otherId: target.id,
          otherName: target.name,
          otherKind: target.entity_kind,
          direction: "out" as const,
        };
      }),
      ...(incoming ?? []).map((r) => {
        const source = r.source as unknown as RawOther;
        return {
          id: r.id,
          relationType: r.relation_type,
          visibility: r.visibility,
          otherId: source.id,
          otherName: source.name,
          otherKind: source.entity_kind,
          direction: "in" as const,
        };
      }),
    ]);
    setLoading(false);
  }, [worldId, entityId, onLoaded]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setPendingBlockType(null);
    load();
  }, [load]);

  async function withRefresh(action: (formData: FormData) => Promise<void>, formData: FormData) {
    await action(formData);
    await load();
  }

  if (loading) {
    return <p className="p-6 text-muted">Chargement...</p>;
  }

  if (notFound || !entity) {
    return <p className="p-6 text-muted">Entité introuvable.</p>;
  }

  const addAliasToEntity = addAlias.bind(null, worldId, entityId);
  const removeAliasFromEntity = removeAlias.bind(null, worldId, entityId);
  const addRelationToEntity = addRelation.bind(null, worldId, entityId);
  const removeRelationFromEntity = removeRelation.bind(null, worldId, entityId);
  const addBlockToEntity = addBlock.bind(null, worldId, entityId);

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* En-tete : titre, proprietes, portrait */}
      <div className="grid grid-cols-4 gap-4 border-b border-border pb-5">
        <div className="col-span-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{entity.name}</h1>
          </div>

          {entity.entity_kind && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-black/20 px-2.5 py-1 text-xs font-medium text-foreground">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: entityKindColor(entity.entity_kind) }}
              />
              {entity.entity_kind}
            </span>
          )}

          {entity.summary && <p className="text-foreground/90">{entity.summary}</p>}

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              Alias :
            </span>
            {entity.aliases?.map((alias) => (
              <form key={alias} action={(fd) => withRefresh(removeAliasFromEntity, fd)}>
                <input type="hidden" name="alias" value={alias} />
                <button type="submit" className="chip group">
                  {alias}
                  <span className="chip-remove">×</span>
                </button>
              </form>
            ))}
            <form
              action={(fd) => withRefresh(addAliasToEntity, fd)}
              className="flex items-center gap-1"
            >
              <input
                name="alias"
                type="text"
                placeholder="+ ajouter"
                className="w-24 rounded-full border border-border bg-transparent px-3 py-1 text-xs text-foreground outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="rounded-full border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                Ajouter
              </button>
            </form>
          </div>

          {/* Relations : rangees verticales, comme dans le prototype de reference */}
          <div className="mt-1 flex flex-col gap-1.5 border-t border-border/60 pt-2.5 text-xs">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              Relations :
            </span>
            <div className="flex flex-col gap-1.5">
              {relations.map((relation) => (
                <div
                  key={relation.id}
                  className="inline-flex w-fit items-center gap-1.5 rounded border border-border bg-black/20 px-2 py-1 text-xs text-muted transition-colors hover:border-accent/30"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: entityKindColor(relation.otherKind) }}
                  />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                    {relation.relationType} :
                  </span>
                  {onOpenEntity ? (
                    <button
                      onClick={() => onOpenEntity(relation.otherId, relation.otherName, relation.otherKind)}
                      className="font-semibold text-accent hover:text-accent-hover"
                    >
                      {relation.otherName}
                    </button>
                  ) : (
                    <Link
                      href={`/worlds/${worldId}/entities/${relation.otherId}`}
                      className="font-semibold text-accent hover:text-accent-hover"
                    >
                      {relation.otherName}
                    </Link>
                  )}
                  <form action={(fd) => withRefresh(removeRelationFromEntity, fd)}>
                    <input type="hidden" name="relation_id" value={relation.id} />
                    <button type="submit" className="chip-remove ml-1">
                      ×
                    </button>
                  </form>
                </div>
              ))}
              {relations.length === 0 && (
                <p className="text-xs italic text-muted">Aucune relation pour l&apos;instant.</p>
              )}
            </div>

            {otherEntities.length > 0 && (
              <form
                action={(fd) => withRefresh(addRelationToEntity, fd)}
                className="mt-1 flex flex-wrap items-center gap-2"
              >
                <input
                  name="relation_type"
                  type="text"
                  placeholder="type (habite, connait...)"
                  required
                  list={`relation-type-suggestions-${entityId}`}
                  className="input-field w-40 text-xs"
                />
                <datalist id={`relation-type-suggestions-${entityId}`}>
                  <option value="habite" />
                  <option value="appartient" />
                  <option value="connait" />
                  <option value="possede" />
                  <option value="deteste" />
                  <option value="a_participe" />
                </datalist>
                <select name="target_entity_id" required className="input-field text-xs">
                  {otherEntities.map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.name}
                    </option>
                  ))}
                </select>
                <select name="visibility" defaultValue="public" className="input-field text-xs">
                  <option value="public">Public</option>
                  <option value="joueurs">Joueurs</option>
                  <option value="mj">MJ uniquement</option>
                  <option value="prive">Privé</option>
                </select>
                <button type="submit" className="btn-outline text-xs">
                  + Ajouter une relation
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Portrait / blason */}
        <div className="flex items-center justify-center">
          <div className="flex h-48 w-full items-center justify-center rounded-2xl border border-border bg-black/20 text-center text-xs text-muted">
            Portrait
          </div>
        </div>
      </div>

      {/* Corps : blocs */}
      <div className="flex flex-col gap-3">
        {blocks.map((block) => (
          <div key={block.id} className="card">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{block.block_type}</span>
              <span className="chip">
                {VISIBILITY_LABELS[block.visibility] ?? block.visibility}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">
              {(block.data as { content?: string })?.content ?? JSON.stringify(block.data)}
            </p>
          </div>
        ))}
        {blocks.length === 0 && (
          <p className="py-4 text-center text-xs italic text-muted">
            Aucun bloc. Utilisez la barre ci-dessous pour en ajouter.
          </p>
        )}
      </div>

      {/* Barre d'ajout de bloc, façon barre d'outils compacte */}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
          Ajouter un bloc :
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {BLOCK_TYPE_PRESETS.map((type) => (
            <button
              key={type}
              onClick={() => setPendingBlockType(type)}
              className="chip transition-colors hover:border-accent/40 hover:bg-surface-hover"
            >
              + {type}
            </button>
          ))}
        </div>

        {pendingBlockType && (
          <form
            action={async (fd) => {
              await withRefresh(addBlockToEntity, fd);
              setPendingBlockType(null);
            }}
            className="mt-1 flex flex-col gap-2 rounded-lg border border-border bg-black/10 p-3"
          >
            <input type="hidden" name="block_type" value={pendingBlockType} />
            <div className="flex items-center gap-2 text-xs text-muted">
              Type : <span className="chip">{pendingBlockType}</span>
            </div>
            <textarea
              name="content"
              rows={3}
              required
              autoFocus
              placeholder="Contenu du bloc..."
              className="input-field text-sm"
            />
            <div className="flex items-center gap-2">
              <select name="visibility" defaultValue="public" className="input-field text-xs">
                <option value="public">Public</option>
                <option value="joueurs">Joueurs</option>
                <option value="mj">MJ uniquement</option>
                <option value="prive">Privé</option>
              </select>
              <button type="submit" className="btn-accent text-xs">
                Ajouter
              </button>
              <button
                type="button"
                onClick={() => setPendingBlockType(null)}
                className="text-xs text-muted hover:text-foreground"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tiroir JSON brut, replie par defaut */}
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-muted hover:text-foreground">
          Code JSON brut de la fiche
        </summary>
        <pre className="max-h-64 overflow-auto border-t border-border bg-black/30 p-3 font-mono text-[11px] text-foreground/70">
          {JSON.stringify({ entity, blocks, relations }, null, 2)}
        </pre>
      </details>
    </div>
  );
}
