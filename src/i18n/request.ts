import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

/**
 * Locale par cookie, jamais par prefixe d'URL (V1-A1b) : meme motif que le
 * cookie "mode" du theme (SettingsMenu.tsx) — deplacer toutes les routes
 * existantes sous /fr/... et /en/... aurait ete une reecriture mecanique
 * de tout l'arbre app/, pour un gain nul (pas besoin d'URLs distinctes par
 * langue ici, contrairement a un site public multilingue indexe).
 */
export const SUPPORTED_LOCALES = ["fr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

export function resolveLocale(value: string | undefined): Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
