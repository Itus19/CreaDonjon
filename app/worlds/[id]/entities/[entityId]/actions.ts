"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addBlock(
  worldId: string,
  entityId: string,
  formData: FormData,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const blockType = formData.get("block_type") as string;
  const content = formData.get("content") as string;
  const visibility = formData.get("visibility") as string;

  const { error } = await supabase.from("blocks").insert({
    entity_id: entityId,
    block_type: blockType,
    data: { content },
    visibility,
  });

  if (error) {
    redirect(
      `/worlds/${worldId}/entities/${entityId}?error=${encodeURIComponent(error.message)}`,
    );
  }

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

  const targetEntityId = formData.get("target_entity_id") as string;
  const relationType = formData.get("relation_type") as string;
  const visibility = formData.get("visibility") as string;

  const { error } = await supabase.from("relations").insert({
    source_entity_id: entityId,
    target_entity_id: targetEntityId,
    relation_type: relationType,
    visibility,
  });

  if (error) {
    redirect(
      `/worlds/${worldId}/entities/${entityId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/worlds/${worldId}/entities/${entityId}`);
}
