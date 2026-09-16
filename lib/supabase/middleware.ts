import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touching auth.getUser() here is what actually refreshes the session
  // cookie on every request; without it, tokens silently expire mid-session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /partage/* est le point d'entree public du lien de partage (V0-07,
  // resolu par un jeton, jamais par une session) : jamais derriere le
  // mur d'authentification, meme sans utilisateur connecte. /rejoindre/*
  // (V2-M4) est le meme genre de point d'entree pour un lien d'invitation —
  // bug trouve en verifiant en direct (retour utilisateur) : un ami SANS
  // compte encore reclame etait renvoye vers /login, qu'il ne peut pas
  // utiliser puisqu'il n'a justement pas encore de compte. Le flux entier
  // (V2-M4 a M7d) n'a donc jamais ete atteignable par un vrai visiteur
  // deconnecte avant cette correction.
  // Une page /partage/* embarque des <img src="/api/assets/..."> et
  // src="/api/entities/[id]/portrait" — des requetes SEPAREES que le
  // navigateur emet lui-meme, sans jamais repasser par /partage/*. Trouve
  // en testant ce lien pour de vrai avec un client sans session (retour
  // utilisateur) : la page HTML se chargeait, mais chaque image redirigeait
  // vers /login (texte/JSON, jamais une image) puisque /api/* n'etait pas
  // sur cette liste — la garde RLS (assets_select, migration
  // 20260902110001) etait donc correcte mais jamais atteinte, ce middleware
  // bloquant tout avant. GET seul suffirait en theorie (POST/DELETE sur
  // /api/entities/*/portrait exigent deja leur propre verification
  // d'authentification, cote route) mais /api/* renvoie du JSON, jamais une
  // page /login — rediriger un appel API vers du HTML est deja incorrect
  // pour n'importe quelle methode, pas seulement GET.
  const isPublicPage =
    path === "/login" ||
    path === "/signup" ||
    path.startsWith("/auth/") ||
    path.startsWith("/partage/") ||
    path.startsWith("/rejoindre/") ||
    path.startsWith("/api/assets/") ||
    /^\/api\/entities\/[^/]+\/portrait$/.test(path) ||
    // Troisieme occurrence du meme defaut, trouvee en mesurant le fond de page
    // (V2.1-20 lot 2) : `/api/blocks/[id]/image` (V2-G12, V2-L1) sert les
    // images de BLOC — celles du corps des fiches, et l'image de fond du wiki.
    // Elle n'etait pas sur cette liste, donc pour un visiteur ANONYME chaque
    // image d'une page /partage repondait 307 vers /login. Le fond de page ne
    // s'affichait jamais, les images de bloc non plus ; seul l'auteur, qui est
    // connecte quand il verifie son propre lien, voyait la page complete.
    //
    // La route sait deja se defendre toute seule, exactement comme le portrait
    // ci-dessus : sans session, elle passe par `getPublicBlockImageSignedUrl`,
    // qui reapplique `filterBlocks` avec `{ kind: "anonymous" }` avant de
    // resoudre le moindre asset (publicShare.ts). Un bloc `gm` reste donc
    // invisible ici — la garde n'a jamais ete le middleware, elle est dans la
    // route, et le middleware l'empechait simplement d'etre atteinte.
    /^\/api\/blocks\/[^/]+\/image$/.test(path);

  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
