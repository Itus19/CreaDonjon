import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * Troisieme (et seul autre) trou confine dans le client service-role, a
 * cote de `lib/supabase/service.ts` et `serviceAccountProvisioning.ts`
 * (CLAUDE.md regle 4 ter) — voir `docs/adr/0031-comptes-tag-et-mots-de-passe-natifs.md`
 * §6. Ne reutilise pas les deux trous existants : leurs portees sont
 * explicitement bornees (lecture de partage public / provisionner un
 * compte invite SANS mot de passe) — celui-ci a sa propre portee, tout
 * aussi etroite : tout ce qui touche un MOT DE PASSE de compte
 * (src/server/services/accountAuth.ts, seul importateur, verifie par la
 * meme regle ESLint que les deux premiers trous).
 *
 * A n'utiliser QUE pour : creer un compte "tag" avec mot de passe,
 * reinitialiser le mot de passe de n'importe quel compte (reinitialisation
 * forcee, superadmin), et les gestes superadmin generalises (supprimer un
 * compte quelconque, transferer un ruleset personnel). Jamais pour autre
 * chose.
 */
export function createAccountAuthServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
