import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/** Meme convention hexadecimale que entityPortraits.ts/backgroundImages.ts (`bytea_output = hex`). */
function bufferToBytea(buffer: Buffer): string {
  return `\\x${buffer.toString("hex")}`;
}
function byteaToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/^\\x/, ""), "hex");
}

export interface BlockImage {
  image: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

/** Une seule ligne par bloc (cle primaire) : un nouveau televersement remplace l'ancien de fait. */
export async function upsertBlockImage(
  supabase: TypedClient,
  params: { blockId: string; image: Buffer; mimeType: string; width: number; height: number }
): Promise<void> {
  const { error } = await supabase.from("block_images").upsert({
    block_id: params.blockId,
    image: bufferToBytea(params.image),
    mime_type: params.mimeType,
    width: params.width,
    height: params.height,
  });
  if (error) throw new Error(error.message);
}

export async function getBlockImage(supabase: TypedClient, blockId: string): Promise<BlockImage | null> {
  const { data, error } = await supabase
    .from("block_images")
    .select("image, mime_type, width, height")
    .eq("block_id", blockId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { image: byteaToBuffer(data.image), mimeType: data.mime_type, width: data.width, height: data.height };
}

export async function deleteBlockImage(supabase: TypedClient, blockId: string): Promise<void> {
  const { error } = await supabase.from("block_images").delete().eq("block_id", blockId);
  if (error) throw new Error(error.message);
}
