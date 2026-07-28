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
  formData: FormData,
) {
  const supabase = await createClient();
  await requireUser(supabase);

  await supabase.from("blocks").insert({
    entity_id: entityId,
    block_type: formData.get("block_type") as string,
    data: { content: formData.get("content") as string },
    visibility: formData.get("visibility") as string,
  });

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
