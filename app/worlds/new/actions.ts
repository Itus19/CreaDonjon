"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createWorld(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const defaultRulesetId = formData.get("default_ruleset_id") as string;

  const { error } = await supabase.from("worlds").insert({
    name,
    owner_id: user.id,
    default_ruleset_id: defaultRulesetId || null,
  });

  if (error) {
    redirect(`/worlds/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}
