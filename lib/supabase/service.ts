import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * Client service-role : contourne TOUTE la RLS, sur TOUTES les tables.
 *
 * A n'utiliser QUE depuis `src/server/services/publicShare.ts`, et
 * seulement pour lire les donnees d'un monde dont le `world_id` vient
 * d'etre confirme par `public.resolve_share_link` (un jeton de partage
 * valide, non expire, non revoque). Ne jamais passer un `world_id` ou un
 * `entity_id` recu directement d'un visiteur sans revalider son jeton
 * juste avant — ce client n'a aucune notion de "monde autorise", tout ce
 * qu'il lit, il le lit vraiment.
 *
 * Ne jamais importer ce module depuis un fichier "use client", ni
 * l'utiliser pour autre chose que la lecture publique de partage (regle
 * absolue n°1 : la cle service role est strictement serveur).
 */
export function createShareLinkServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
