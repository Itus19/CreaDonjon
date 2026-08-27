import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/** PostgREST renvoie/attend un `bytea` en hexadecimal prefixe `\x` (`bytea_output = hex`, meme convention que src/server/repos/backgroundImages.ts). */
function bufferToBytea(buffer: Buffer): string {
  return `\\x${buffer.toString("hex")}`;
}
function byteaToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/^\\x/, ""), "hex");
}

export interface EntityPortrait {
  image: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

/** Une seule ligne par entite (cle primaire) : un nouveau televersement remplace l'ancien de fait. */
export async function upsertEntityPortrait(
  supabase: TypedClient,
  params: { entityId: string; image: Buffer; mimeType: string; width: number; height: number }
): Promise<void> {
  const { error } = await supabase.from("entity_portraits").upsert({
    entity_id: params.entityId,
    image: bufferToBytea(params.image),
    mime_type: params.mimeType,
    width: params.width,
    height: params.height,
  });
  if (error) throw new Error(error.message);
}

export async function getEntityPortrait(supabase: TypedClient, entityId: string): Promise<EntityPortrait | null> {
  const { data, error } = await supabase
    .from("entity_portraits")
    .select("image, mime_type, width, height")
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { image: byteaToBuffer(data.image), mimeType: data.mime_type, width: data.width, height: data.height };
}

export interface EntityPortraitLayout {
  displaySizePct: number;
  align: "left" | "right";
}

const DEFAULT_PORTRAIT_LAYOUT: EntityPortraitLayout = { displaySizePct: 100, align: "right" };

/** `null` de `entity_portraits` (pas encore de portrait) : l'appelant retombe sur les valeurs par defaut des colonnes, jamais une erreur. */
export async function getEntityPortraitLayout(supabase: TypedClient, entityId: string): Promise<EntityPortraitLayout> {
  const { data, error } = await supabase
    .from("entity_portraits")
    .select("display_size_pct, align")
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_PORTRAIT_LAYOUT;
  return { displaySizePct: data.display_size_pct, align: data.align as "left" | "right" };
}

/** N'affecte aucune ligne si aucun portrait n'a encore ete televerse (rien a mettre en page) — l'UI ne propose de toute facon ces reglages qu'une fois un portrait present. */
export async function updateEntityPortraitLayout(
  supabase: TypedClient,
  entityId: string,
  layout: EntityPortraitLayout
): Promise<void> {
  const { error } = await supabase
    .from("entity_portraits")
    .update({ display_size_pct: layout.displaySizePct, align: layout.align })
    .eq("entity_id", entityId);
  if (error) throw new Error(error.message);
}

/** `true` si une ligne a reellement ete supprimee (RLS renvoie sinon 0 ligne sans erreur). */
export async function deleteEntityPortrait(supabase: TypedClient, entityId: string): Promise<boolean> {
  const { error, count } = await supabase
    .from("entity_portraits")
    .delete({ count: "exact" })
    .eq("entity_id", entityId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
