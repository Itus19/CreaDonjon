import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * Client ANONYME côté serveur, sans cookie ni session (V3.1-84). Pour les
 * seules lectures publiques par nature, mises en cache entre les requêtes
 * (`unstable_cache` ne peut pas lire les cookies) : l'identité de
 * l'application, que la RLS ouvre à `anon`. Il voit exactement ce que voit
 * un visiteur non connecté, rien de plus : jamais la clé service.
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
