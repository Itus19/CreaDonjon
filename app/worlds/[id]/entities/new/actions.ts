"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createEntity(worldId: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const entityKind = (formData.get("entity_kind") as string) || null;
  const summary = (formData.get("summary") as string) || null;

  const { data: entity, error } = await supabase
    .from("entities")
    .insert({
      world_id: worldId,
      name,
      entity_kind: entityKind,
      summary,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !entity) {
    redirect(
      `/worlds/${worldId}/entities/new?error=${encodeURIComponent(error?.message ?? "Erreur inconnue")}`,
    );
  }

  redirect(`/worlds/${worldId}/entities/${entity.id}`);
}
