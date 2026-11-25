import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { choixEffectif } from "@/src/core/ai/providerChoice";
import { listAiProvidersWithChoice, type AiProviderRow } from "@/src/server/repos/aiProviders";
import { z } from "zod";
import { verifierUrlFournisseur, type RaisonUrlRefusee } from "@/src/core/ai/providerUrl";
import { chiffrementDisponible, chiffrerSecret } from "@/src/server/ai/secrets";
import { adressesPriveesAutorisees } from "@/src/server/ai/resolveProvider";
import type { FournisseurIaVue, FournisseursIaReponse } from "@/lib/ia/fournisseurs";

type TypedClient = SupabaseClient<Database>;

/** Jamais `secret` : seulement s'il existe (ADR 0103). */
export function vueFournisseur(ligne: AiProviderRow): FournisseurIaVue {
  return { id: ligne.id, label: ligne.label, baseUrl: ligne.base_url, models: ligne.models, aUneCle: ligne.secret !== null, posePar: ligne.updated_at };
}

/** ADR 0108 — ce que la page Compte et le solo lisent, en une seule requête. */
export async function lireFournisseursIa(supabase: TypedClient, userId: string): Promise<FournisseursIaReponse> {
  const { providers, choice } = await listAiProvidersWithChoice(supabase, userId);
  const effectif = choixEffectif(
    providers.map((p) => ({ id: p.id, models: p.models, updatedAt: p.updated_at })),
    choice ? { providerId: choice.provider_id, model: choice.model } : null,
  );
  return {
    fournisseurs: providers.map(vueFournisseur),
    actif: effectif ? { fournisseurId: effectif.providerId, model: effectif.model } : null,
    chiffrementDisponible: chiffrementDisponible(),
  };
}

/**
 * Le corps d'un fournisseur, à la création comme à la modification. Les
 * modèles : 1 à 12 identifiants distincts, jamais `::` (séparateur des
 * options du choix, `lib/ia/fournisseurs.ts`).
 */
export const fournisseurCorpsSchema = z.object({
  label: z.string().trim().min(1).max(60),
  baseUrl: z.string().trim().min(8).max(300),
  models: z
    .array(z.string().trim().min(1).max(120).refine((m) => !m.includes("::"), "Un identifiant de modèle ne contient pas « :: »."))
    .min(1, "Indique au moins un modèle.")
    .max(12, "Douze modèles au plus par fournisseur.")
    .transform((ms) => [...new Set(ms)]),
  /** Absent : on garde la clé en place. `null` : on la retire. Une chaîne : on la remplace. */
  secret: z.string().trim().min(8).max(500).nullable().optional(),
});

export const REFUS_URL: Record<RaisonUrlRefusee, string> = {
  illisible: "Cette adresse n'en est pas une. Elle doit commencer par https:// et finir par le chemin de l'API (souvent /v1).",
  schema: "Seules les adresses http et https sont acceptées.",
  http: "En ligne, l'adresse doit être en https — une clé d'API ne voyage pas en clair.",
  privee: "Cette adresse désigne une machine du réseau local, que le serveur ne peut pas joindre pour toi. Passe par un tunnel, qui te donnera une adresse publique.",
  identifiants: "Retire le nom d'utilisateur et le mot de passe de l'adresse : la clé se saisit dans son propre champ.",
};

/** L'adresse, vérifiée contre la SSRF (ADR 0103) : un message d'erreur, ou `null` si elle passe. */
export function refusAdresse(baseUrl: string): string | null {
  const verdict = verifierUrlFournisseur(baseUrl, { adressesPriveesAutorisees: adressesPriveesAutorisees() });
  return verdict.ok ? null : REFUS_URL[verdict.raison];
}

/**
 * La clé, chiffrée AVANT de quitter ce processus (ADR 0103). `undefined` :
 * inchangée ; `null` : retirée. Sans `AI_SECRETS_KEY`, une erreur plutôt
 * qu'une clé écrite en clair.
 */
export function preparerSecret(secret: string | null | undefined): { ok: true; secret: string | null | undefined } | { ok: false; error: string } {
  if (secret === undefined || secret === null) return { ok: true, secret };
  if (!chiffrementDisponible()) return { ok: false, error: "AI_SECRETS_KEY n'est pas posée sur le serveur : une clé ne peut pas être enregistrée en sécurité." };
  return { ok: true, secret: chiffrerSecret(secret) };
}
