import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addAlias, addBlock, addRelation, removeAlias } from "./actions";

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  joueurs: "Joueurs",
  mj: "MJ uniquement",
  prive: "Privé",
};

export default async function EntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; entityId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: worldId, entityId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: entity } = await supabase
    .from("entities")
    .select("id, name, entity_kind, summary, aliases")
    .eq("id", entityId)
    .single();

  if (!entity) {
    notFound();
  }

  const [{ data: blocks }, { data: outgoing }, { data: incoming }, { data: otherEntities }] =
    await Promise.all([
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

  type RelationRow = {
    id: string;
    relationType: string;
    visibility: string;
    otherId: string;
    otherName: string;
  };

  const relations: RelationRow[] = [
    ...(outgoing ?? []).map((r) => ({
      id: r.id,
      relationType: r.relation_type,
      visibility: r.visibility,
      otherId: (r.target as unknown as { id: string; name: string }).id,
      otherName: (r.target as unknown as { id: string; name: string }).name,
    })),
    ...(incoming ?? []).map((r) => ({
      id: r.id,
      relationType: r.relation_type,
      visibility: r.visibility,
      otherId: (r.source as unknown as { id: string; name: string }).id,
      otherName: (r.source as unknown as { id: string; name: string }).name,
    })),
  ];

  const addAliasToEntity = addAlias.bind(null, worldId, entityId);
  const removeAliasFromEntity = removeAlias.bind(null, worldId, entityId);
  const addRelationToEntity = addRelation.bind(null, worldId, entityId);
  const addBlockToEntity = addBlock.bind(null, worldId, entityId);

  return (
    <div className="flex flex-col flex-1 items-center font-sans">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
        <Link href={`/worlds/${worldId}`} className="text-sm text-muted hover:text-foreground">
          ← Retour au monde
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground">
                {entity.name}
              </h1>
              {entity.entity_kind && (
                <span className="chip">{entity.entity_kind}</span>
              )}
            </div>

            {entity.summary && (
              <p className="text-foreground/90">{entity.summary}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Alias :</span>
              {entity.aliases?.map((alias: string) => (
                <form key={alias} action={removeAliasFromEntity}>
                  <input type="hidden" name="alias" value={alias} />
                  <button type="submit" className="chip group">
                    {alias}
                    <span className="chip-remove">×</span>
                  </button>
                </form>
              ))}
              <form action={addAliasToEntity} className="flex items-center gap-1">
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

          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-black/20 text-xs text-muted">
            Portrait
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-foreground">Relations</h2>

          <div className="flex flex-wrap gap-2">
            {relations.map((relation) => (
              <Link
                key={relation.id}
                href={`/worlds/${worldId}/entities/${relation.otherId}`}
                className="chip transition-colors hover:bg-surface-hover"
                title={VISIBILITY_LABELS[relation.visibility] ?? relation.visibility}
              >
                <span className="text-muted">{relation.relationType}</span>
                {relation.otherName}
              </Link>
            ))}
            {relations.length === 0 && (
              <p className="text-sm text-muted">Aucune relation pour l&apos;instant.</p>
            )}
          </div>

          {otherEntities && otherEntities.length > 0 && (
            <form
              action={addRelationToEntity}
              className="flex flex-wrap items-center gap-2 pt-1"
            >
              <input
                name="relation_type"
                type="text"
                placeholder="type (habite, connait...)"
                required
                list="relation-type-suggestions"
                className="input-field w-44 text-sm"
              />
              <datalist id="relation-type-suggestions">
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

          {blocks?.map((block) => (
            <div key={block.id} className="card">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">
                  {block.block_type}
                </span>
                <span className="chip">
                  {VISIBILITY_LABELS[block.visibility] ?? block.visibility}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">
                {(block.data as { content?: string })?.content ??
                  JSON.stringify(block.data)}
              </p>
            </div>
          ))}
          {blocks?.length === 0 && (
            <p className="text-muted">Aucun bloc pour l&apos;instant.</p>
          )}
        </section>

        <section className="form-card flex flex-col gap-4">
          <h2 className="text-lg font-medium text-foreground">
            Ajouter un bloc
          </h2>

          {error && <p className="text-sm text-danger">{error}</p>}

          <form action={addBlockToEntity} className="flex flex-col gap-4">
            <label className="field-label">
              Type de bloc
              <input
                name="block_type"
                type="text"
                required
                list="block-type-suggestions"
                className="input-field"
              />
              <datalist id="block-type-suggestions">
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
      </main>
    </div>
  );
}
