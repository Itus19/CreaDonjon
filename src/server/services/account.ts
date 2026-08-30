import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getOwnProfile } from "@/src/server/repos/account";

type TypedClient = SupabaseClient<Database>;

/**
 * V2-M2 (Lot M) — verrouillage du mode solo : un seul compte peut l'utiliser,
 * pose a la main par la migration `20260830090001_superadmin_role.sql`.
 * Lecture directe de `profiles.account_role`, jamais un aller-retour RPC
 * vers `app.is_superadmin()` — cette fonction SQL existe pour les politiques
 * RLS (V2-M4/M5, qui doivent laisser le superadmin traverser la logique
 * habituelle d'appartenance), pas pour ce genre de decision metier ponctuelle
 * qu'une simple lecture de table couvre deja, sous la RLS `profiles_select`
 * (restreinte a sa propre ligne). Seul point d'appel de ce champ : jamais
 * de second test `account_role === "superadmin"` ecrit ailleurs.
 */
export async function isSuperadmin(supabase: TypedClient, userId: string): Promise<boolean> {
  const profile = await getOwnProfile(supabase, userId);
  return profile?.account_role === "superadmin";
}
