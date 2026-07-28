"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function addBlock(
  worldId: string,
  entityId: string,
  blockType: string,
) {
  const supabase = await createClient();
  await requireUser(supabase);

  await supabase.from("blocks").insert({
    entity_id: entityId,
    block_type: blockType,
    data: { title: "", content: "" },
    visibility: "public",
  });

  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}

export async function updateBlock(
  worldId: string,
  entityId: string,
  blockId: string,
  updates: { title?: string; content?: string; caption?: string; visibility?: string },
) {
  const supabase = await createClient();
  await requireUser(supabase);

  const { data: block } = await supabase
    .from("blocks")
    .select("data")
    .eq("id", blockId)
    .single();

  const nextData = { ...(block?.data as Record<string, unknown> ?? {}) };
  if (updates.title !== undefined) nextData.title = updates.title;
  if (updates.content !== undefined) nextData.content = updates.content;
  if (updates.caption !== undefined) nextData.caption = updates.caption;

  const payload: Record<string, unknown> = { data: nextData };
  if (updates.visibility !== undefined) payload.visibility = updates.visibility;

  await supabase.from("blocks").update(payload).eq("id", blockId);
  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}

export async function reorderBlocks(worldId: string, entityId: string, orderedBlockIds: string[]) {
  const supabase = await createClient();
  await requireUser(supabase);

  await Promise.all(
    orderedBlockIds.map((blockId, index) =>
      supabase.from("blocks").update({ display_order: index }).eq("id", blockId),
    ),
  );
  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}

export async function deleteBlock(worldId: string, entityId: string, blockId: string) {
  const supabase = await createClient();
  await requireUser(supabase);

  await supabase.from("blocks").delete().eq("id", blockId);
  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}

export async function deleteEntity(worldId: string, entityId: string) {
  const supabase = await createClient();
  await requireUser(supabase);

  await supabase.from("entities").delete().eq("id", entityId);
  revalidatePath(`/worlds/${worldId}`);
}

export async function createEntity(worldId: string, entityKind: string | null = null) {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data } = await supabase
    .from("entities")
    .insert({
      world_id: worldId,
      name: "Nouvelle fiche",
      entity_kind: entityKind,
      created_by: user.id,
    })
    .select("id, name, entity_kind, summary")
    .single();

  revalidatePath(`/worlds/${worldId}`);
  return data;
}

export async function updateEntityName(worldId: string, entityId: string, name: string) {
  const supabase = await createClient();
  await requireUser(supabase);

  const trimmed = name.trim() || "Nouvelle fiche";
  await supabase.from("entities").update({ name: trimmed }).eq("id", entityId);
  revalidatePath(`/worlds/${worldId}`);
  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}

export async function updateEntityKind(worldId: string, entityId: string, kind: string) {
  const supabase = await createClient();
  await requireUser(supabase);

  const trimmed = kind.trim();
  await supabase.from("entities").update({ entity_kind: trimmed || null }).eq("id", entityId);
  revalidatePath(`/worlds/${worldId}`);
  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}

export async function addAlias(
  worldId: string,
  entityId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const alias = (formData.get("alias") as string)?.trim();
  if (!alias) return;

  const { data: entity } = await supabase
    .from("entities")
    .select("aliases")
    .eq("id", entityId)
    .single();

  const aliases = [...new Set([...(entity?.aliases ?? []), alias])];

  await supabase.from("entities").update({ aliases }).eq("id", entityId);
  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}

export async function removeAlias(
  worldId: string,
  entityId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const alias = formData.get("alias") as string;

  const { data: entity } = await supabase
    .from("entities")
    .select("aliases")
    .eq("id", entityId)
    .single();

  const aliases = (entity?.aliases ?? []).filter((a: string) => a !== alias);

  await supabase.from("entities").update({ aliases }).eq("id", entityId);
  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}

export async function addRelation(
  worldId: string,
  entityId: string,
  formData: FormData,
) {
  const supabase = await createClient();

  await supabase.from("relations").insert({
    source_entity_id: entityId,
    target_entity_id: formData.get("target_entity_id") as string,
    relation_type: formData.get("relation_type") as string,
    visibility: formData.get("visibility") as string,
  });

  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}

export async function removeRelation(
  worldId: string,
  entityId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const relationId = formData.get("relation_id") as string;

  await supabase.from("relations").delete().eq("id", relationId);

  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}
