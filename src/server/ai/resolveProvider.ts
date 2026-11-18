import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { verifierUrlFournisseur } from "@/src/core/ai/providerUrl";
import { getAiProvider } from "@/src/server/repos/aiProviders";
import { OpenAiCompatibleProvider } from "./adapters/openAiCompatible";
import { dechiffrerSecret } from "./secrets";
import type { AiProvider } from "./provider";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-224 (ADR 0103) — quel fournisseur sert cet appel.
 *
 * L'ordre, et il compte :
 *  1. **celui du compte** qui déclenche l'appel — sa clé, ses jetons, sa facture ;
 *  2. à défaut, **celui de l'environnement** (`AI_LOCAL_*`), ce qui garde le
 *     comportement d'avant sur une machine locale ;
 *  3. à défaut, **aucun** : l'appel n'a pas lieu, le tour reste joué, et
 *     l'écran le dit (V3.1-223).
 *
 * Toute la résolution vit ici, dans `src/server/ai/` (règle absolue 12) :
 * aucune route ne construit plus un fournisseur elle-même.
 */

/** Les adresses privées ne sont tolérées que lorsque le serveur tourne sur la machine du joueur. */
export function adressesPriveesAutorisees(): boolean {
  return process.env.NODE_ENV !== "production";
}

function depuisEnv(): AiProvider | null {
  const baseUrl = process.env.AI_LOCAL_BASE_URL;
  const model = process.env.AI_LOCAL_MODEL;
  if (!baseUrl || !model) return null;
  return new OpenAiCompatibleProvider({ baseUrl, model, apiKey: process.env.AI_LOCAL_API_KEY });
}

/**
 * Rend `null` plutôt que de jeter : un appel d'IA est toujours best-effort
 * (`specs/cible-locale-et-ia.md` §4). Une adresse devenue invalide, un secret
 * indéchiffrable, et c'est comme s'il n'y avait pas de fournisseur.
 *
 * Coût (docs/QUOTAS.md) : **une lecture** par appel d'IA, sur une table d'une
 * ligne par compte, par sa clé primaire. Rien quand le compte n'a rien déclaré
 * — et rien du tout si aucun appel n'est fait.
 */
export async function resolveProviderForUser(supabase: TypedClient, userId: string | null): Promise<AiProvider | null> {
  if (!userId) return depuisEnv();

  const ligne = await getAiProvider(supabase, userId);
  if (!ligne) return depuisEnv();

  // Revérifiée ICI, et pas seulement à l'enregistrement : une ligne peut avoir
  // été écrite autrement depuis (script, éditeur SQL), et c'est notre serveur
  // qui appellera l'adresse.
  if (!verifierUrlFournisseur(ligne.base_url, { adressesPriveesAutorisees: adressesPriveesAutorisees() }).ok) return null;

  const cle = ligne.secret === null ? undefined : (dechiffrerSecret(ligne.secret) ?? undefined);
  // Un secret posé mais indéchiffrable (clé de chiffrement changée) : on
  // n'appelle pas « sans clé », ce qui donnerait un 401 incompréhensible.
  if (ligne.secret !== null && cle === undefined) return null;

  return new OpenAiCompatibleProvider({ baseUrl: ligne.base_url, model: ligne.model, apiKey: cle });
}
