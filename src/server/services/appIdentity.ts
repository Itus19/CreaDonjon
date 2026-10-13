import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { APP_LOGO_KEYS, DEFAULT_APP_IDENTITY, type AppLogoKey } from "@/src/core/brand/identity";
import { getAppIdentityRow } from "@/src/server/repos/appIdentity";

/**
 * V3.1-84 (ADR 0061) — LECTURE de l'identité de l'application. Fichier sans
 * `sharp` : le layout racine l'importera (V3.1-86), l'écriture vit dans
 * `appIdentityWrite.ts`.
 */

export const APP_IDENTITY_TAG = "app-identity";

export interface AppIdentity {
  name: string;
  tagline: string;
  logoKey: AppLogoKey;
  /** URL du logo téléversé, versionnée par sa date d'écriture (cache long sans risque), ou `null` : le logo au trait `logoKey` s'affiche. */
  logoUrl: string | null;
}

/** L'URL versionnée du logo : une nouvelle version change l'URL, l'ancienne peut donc rester en cache pour toujours. */
export function brandLogoUrl(updatedAt: string): string {
  return `/api/app-identity/logo?v=${new Date(updatedAt).getTime()}`;
}

function isLogoKey(value: string): value is AppLogoKey {
  return (APP_LOGO_KEYS as readonly string[]).includes(value);
}

/**
 * L'identité lue par tous (écran-titre, rail, onglet). Une ligne au plus, lue
 * par un client anonyme et mise en cache entre les requêtes : une lecture par
 * heure au plus, invalidée aussitôt qu'un superadmin enregistre
 * (`updateTag(APP_IDENTITY_TAG)`). Aucune ligne : les valeurs par défaut.
 */
export const getAppIdentity = unstable_cache(
  async (): Promise<AppIdentity> => {
    const row = await getAppIdentityRow(createAnonClient());
    if (!row) return { ...DEFAULT_APP_IDENTITY, logoUrl: null };
    return {
      name: row.name,
      tagline: row.tagline,
      logoKey: isLogoKey(row.logo_key) ? row.logo_key : DEFAULT_APP_IDENTITY.logoKey,
      logoUrl: row.logo_storage_path ? brandLogoUrl(row.updated_at) : null,
    };
  },
  ["app-identity"],
  { tags: [APP_IDENTITY_TAG], revalidate: 3600 }
);
