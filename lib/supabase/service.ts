import "server-only";
import { cache } from "react";
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
 *
 * `React.cache()` (V2.1-19 volet A) — meme motif que `createClient`
 * (lib/supabase/server.ts), et pour une raison qui depasse le cout d'une
 * construction d'objet : les depots memoises (`listEntitiesForWorld`,
 * `listCampaignsForWorld`, `walkRulesetChain`...) prennent le client en
 * PREMIER ARGUMENT, et `cache()` compare ses arguments par identite. Tant
 * que cette fabrique rendait un objet neuf a chaque appel, les sept
 * appels de `publicShare.ts` produisaient sept clients differents, donc
 * autant de cles de cache differentes : TOUTE la memoisation de depot
 * etait inerte sur `/partage`, et seulement la. Le gain de l'audit P-01
 * n'atteignait pas la seule route que des visiteurs ouvrent.
 *
 * Portee : bornee au rendu courant, jamais partagee entre deux requetes
 * ni entre deux visiteurs — c'est la garantie de `cache()` lui-meme, et
 * elle vaut d'etre repetee ici puisque ce client contourne la RLS. Le
 * client est sans etat (`persistSession: false`) : le reemployer dans un
 * meme rendu ne transporte rien d'un appel a l'autre.
 */
export const createShareLinkServiceClient = cache(function createShareLinkServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
});
