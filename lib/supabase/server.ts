import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * `React.cache()` (retour utilisateur : "l'application... recharge des
 * choses déjà présentes") — memoise pour la duree d'UNE seule requete/rendu
 * (jamais entre deux requetes, jamais un cache partage entre utilisateurs :
 * `cache()` de React est explicitement borne au rendu courant). Sans ceci,
 * chaque layout/page de l'arborescence (`app/m/[worldSlug]/layout.tsx`,
 * `joueur/layout.tsx`, `joueur/fiche/layout.tsx`, la page elle-meme...)
 * appelait `createClient()` independamment, creant autant de clients
 * distincts qu'il y a de fichiers dans la pile — et rendait impossible tout
 * memoise en aval (`getWorldBySlug`, `listCampaigns`...) puisque leur
 * argument `supabase` n'etait jamais le MEME objet d'un appel a l'autre.
 * Meme motif que le cache memoire de `useWorldCalendar.ts` cote client,
 * transpose cote serveur.
 */
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: safe to ignore when
            // middleware is refreshing the session instead.
          }
        },
      },
    },
  );
});

/**
 * `React.cache()` (retour utilisateur : "l'application... recharge des
 * choses déjà présentes", suite) — `supabase.auth.getUser()` revalide le
 * jeton aupres du serveur d'authentification a CHAQUE appel (par design,
 * plus sur que de faire confiance a la session locale) : un aller-retour
 * reseau, jamais une simple lecture locale. Une meme requete empilait
 * pourtant cet appel dans chaque layout/page de l'arborescence ET dans les
 * services qu'ils appellent (`entityWindow.ts`, `rules.ts`...). Memoise ici
 * pour la duree du rendu courant, meme motif et meme portee que
 * `createClient` juste au-dessus — ne fonctionne que parce que `supabase`
 * est desormais un objet stable par requete.
 */
export const getAuthUser = cache(async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
