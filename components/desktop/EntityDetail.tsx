"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addAlias, addBlock, addRelation, removeAlias } from "@/lib/actions/entities";

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  joueurs: "Joueurs",
  mj: "MJ uniquement",
  prive: "Privé",
};

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
          .select("id, relation_type, visibility, target:target_entity_id(id, name)")
          .eq("source_entity_id", entityId),
        supabase
          .from("relations")
          .select("id, relation_type, visibility, source:source_entity_id(id, name)")
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

    setRelations([
      ...(outgoing ?? []).map((r) => {
        const target = r.target as unknown as { id: string; name: string };
        return {
          id: r.id,
          relationType: r.relation_type,
          visibility: r.visibility,
          otherId: target.id,
          otherName: target.name,
          direction: "out" as const,
        };
      }),
      ...(incoming ?? []).map((r) => {
        const source = r.source as unknown as { id: string; name: string };
        return {
          id: r.id,
          relationType: r.relation_type,
          visibility: r.visibility,
          otherId: source.id,
          otherName: source.name,
          direction: "in" as const,
        };
      }),
    ]);
    setLoading(false);
  }, [worldId, entityId, onLoaded]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
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
  const addBlockToEntity = addBlock.bind(null, worldId, entityId);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{entity.name}</h1>
            {entity.entity_kind && <span className="chip">{entity.entity_kind}</span>}
          </div>

          {entity.summary && <p className="text-foreground/90">{entity.summary}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Alias :</span>
            {entity.aliases?.map((alias) => (
              <form
                key={alias}
                action={(fd) => withRefresh(removeAliasFromEntity, fd)}
              >
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
        </div>

        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-black/20 text-xs text-muted">
          Portrait
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-foreground">Relations</h2>

        <div className="flex flex-wrap gap-2">
          {relations.map((relation) => {
            const chipClass =
              relation.direction === "out" ? "chip-relation-out" : "chip-relation-in";
            const label = (
              <>
                <span className="opacity-70">{relation.relationType}</span>
                {relation.otherName}
              </>
            );
            return onOpenEntity ? (
              <button
                key={relation.id}
                onClick={() => onOpenEntity(relation.otherId, relation.otherName, null)}
                className={chipClass}
                title={VISIBILITY_LABELS[relation.visibility] ?? relation.visibility}
              >
                {label}
              </button>
            ) : (
              <Link
                key={relation.id}
                href={`/worlds/${worldId}/entities/${relation.otherId}`}
                className={chipClass}
                title={VISIBILITY_LABELS[relation.visibility] ?? relation.visibility}
              >
                {label}
              </Link>
            );
          })}
          {relations.length === 0 && (
            <p className="text-sm text-muted">Aucune relation pour l&apos;instant.</p>
          )}
        </div>

        {otherEntities.length > 0 && (
          <form
            action={(fd) => withRefresh(addRelationToEntity, fd)}
            className="flex flex-wrap items-center gap-2 pt-1"
          >
            <input
              name="relation_type"
              type="text"
              placeholder="type (habite, connait...)"
              required
              list={`relation-type-suggestions-${entityId}`}
              className="input-field w-44 text-sm"
            />
            <datalist id={`relation-type-suggestions-${entityId}`}>
              <option value="habite" />
              <option value="appartient" />
              <option value="connait" />
              <option value="possede" />
              <option value="deteste" />
              <option value="a_participe" />
            </datalist>
            <select name="target_entity_id" required className="input-field text-sm">
              {otherEntities.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
            <select name="visibility" defaultValue="public" className="input-field text-sm">
              <option value="public">Public</option>
              <option value="joueurs">Joueurs</option>
              <option value="mj">MJ uniquement</option>
              <option value="prive">Privé</option>
            </select>
            <button type="submit" className="btn-outline text-sm">
              Lier
            </button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-foreground">Blocs</h2>

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
        {blocks.length === 0 && <p className="text-muted">Aucun bloc pour l&apos;instant.</p>}
      </section>

      <section className="form-card flex flex-col gap-4">
        <h2 className="text-lg font-medium text-foreground">Ajouter un bloc</h2>

        <form
          action={(fd) => withRefresh(addBlockToEntity, fd)}
          className="flex flex-col gap-4"
        >
          <label className="field-label">
            Type de bloc
            <input
              name="block_type"
              type="text"
              required
              list={`block-type-suggestions-${entityId}`}
              className="input-field"
            />
            <datalist id={`block-type-suggestions-${entityId}`}>
              <option value="personnage" />
              <option value="biologie" />
              <option value="inventaire" />
              <option value="faction" />
              <option value="geographie" />
              <option value="relations" />
              <option value="objectifs" />
              <option value="chronologie" />
              <option value="statistiques" />
            </datalist>
          </label>

          <label className="field-label">
            Contenu
            <textarea name="content" rows={4} required className="input-field" />
          </label>

          <label className="field-label">
            Visibilité
            <select name="visibility" defaultValue="public" className="input-field">
              <option value="public">Public</option>
              <option value="joueurs">Joueurs</option>
              <option value="mj">MJ uniquement</option>
              <option value="prive">Privé</option>
            </select>
          </label>

          <button type="submit" className="btn-accent self-start">
            Ajouter
          </button>
        </form>
      </section>
    </div>
  );
}
