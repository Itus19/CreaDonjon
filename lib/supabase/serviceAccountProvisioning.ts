import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * Deuxieme (et seul autre) trou confine dans le client service-role,
 * a cote de `lib/supabase/service.ts` (CLAUDE.md regle 4 ter) — voir
 * `docs/adr/0015-provisioning-comptes-invites.md`. Ne reutilise pas ce
 * premier trou : sa portee est explicitement "lecture de partage public
 * seulement", l'elargir a la creation de comptes aurait ete exactement le
 * "elargir sa portee" que la regle interdit. Celui-ci a sa propre portee,
 * tout aussi etroite : provisionner/reclamer un compte invite
 * (src/server/services/accountProvisioning.ts, seul importateur, verifie
 * par la meme regle ESLint que le premier trou).
 *
 * A n'utiliser QUE pour : creer un compte `auth.users` sans mot de passe
 * pour un ami invite, generer son lien de connexion magique, et ecrire les
 * lignes `campaign_invites`/`campaign_members`/`campaign_characters`/
 * `world_members` que cette toute premiere reclamation exige avant que la
 * personne n'ait elle-meme une session (la RLS ordinaire ne peut pas
 * encore s'appliquer a elle). Jamais pour autre chose.
 */
export function createAccountProvisioningServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
