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
