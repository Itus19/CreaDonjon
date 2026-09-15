import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // `sharp` embarque des binaires natifs par plateforme (libvips) — le
  // bundler de Next (Turbopack) les trace mal quand il essaie de l'inclure
  // dans le bundle serveur, provoquant "ERR_DLOPEN_FAILED: libvips-cpp.so...
  // cannot open shared object file" une fois deploye sur Vercel (jamais
  // reproduit en local, ou `next dev` ne bundle pas de la meme facon).
  // Cette option dit a Next de charger `sharp` comme un vrai `require`
  // Node externe au lieu de tenter de le bundler — Vercel trace alors
  // correctement le binaire natif lui-meme.
  serverExternalPackages: ["sharp"],
  // Insuffisant seul (constate en deploiement reel) : le traceur de
  // fichiers de Next ne peut pas deviner qu'un module natif charge par
  // dlopen() a besoin de ses .so — il ne suit que les require()/import()
  // qu'il peut analyser statiquement. Sans cette inclusion manuelle, le
  // dossier @img/sharp-libvips-linux-x64 (qui contient libvips-cpp.so)
  // n'est simplement pas copie dans la fonction deployee.
  //
  // Cette inclusion est limitee aux quatre routes qui executent reellement
  // `sharp`. Elle valait auparavant `"/**"`, donc pour les 208 fonctions du
  // deploiement : 78 Mo de binaires natifs recopies dans chacune, ~16 Go de
  // stockage de fonctions par deploiement. C'est ce qui a fait depasser le
  // quota Vercel ("Functions Storage 14,67 GB / 10 GB") — la taille du code
  // n'y est pour rien. Mesure sur un build reel : 16,8 Go de fichiers traces
  // avant, 1,6 Go apres.
  //
  // Ces quatre routes sont les seules a atteindre un `await import("sharp")`
  // a l'execution (uploadAsset, uploadBlockImage, uploadEntityPortrait,
  // uploadBackgroundImage). Ailleurs le module est bien dans le graphe
  // d'imports — `app/layout.tsx` finit par tirer `backgroundImages` — mais
  // l'import dynamique ne se declenche jamais, donc le binaire n'a aucune
  // raison d'etre copie.
  //
  // Le joker `*` remplace le segment dynamique : ecrire la clef
  // `/api/blocks/[blockId]/image/route` ne marche PAS (les crochets sont lus
  // comme une classe de caracteres de glob, pas comme un segment Next) et
  // echoue silencieusement — verifie en lisant les `.nft.json` du build.
  //
  // Si un nouveau chemin d'upload apparait, il doit etre ajoute ici, sinon il
  // echouera en production avec ERR_DLOPEN_FAILED (et jamais en local).
  outputFileTracingIncludes: {
    "/api/worlds/*/assets/route": ["./node_modules/@img/**/*"],
    "/api/blocks/*/image/route": ["./node_modules/@img/**/*"],
    "/api/entities/*/portrait/route": ["./node_modules/@img/**/*"],
    "/api/settings/background/route": ["./node_modules/@img/**/*"],
  },
  /**
   * V3-R4a — les fonds fournis avec l'application sont servis depuis
   * `public/`, auquel Next applique par defaut
   * `cache-control: public, max-age=0, must-revalidate` : mesure sur le
   * deploiement reel, chaque navigation redemandait l'image ne serait-ce que
   * pour s'entendre repondre 304. Un aller-retour avant de pouvoir peindre,
   * sur le reseau ou l'aller-retour coute le plus cher.
   *
   * `immutable` n'est deliberement PAS utilise, contrairement a ce que le
   * ticket proposait : ces fichiers ne portent pas d'empreinte dans leur nom,
   * donc remplacer une illustration en gardant son nom laisserait les
   * visiteurs deja venus sur l'ancienne version pendant un an, sans recours.
   * 30 jours de fraicheur couvrent largement une partie ou une campagne
   * (l'aller-retour disparait), et `stale-while-revalidate` sert ensuite
   * l'ancienne image immediatement tout en allant chercher la nouvelle en
   * fond — on gagne le meme temps sans le mode d'echec.
   */
  async headers() {
    return [
      {
        source: "/backgrounds/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=31536000" }],
      },
    ];
  },
  experimental: {
    // Next 16 impose par defaut une limite de 10 Mo sur les corps de
    // requete passant par son proxy interne, appliquee AVANT notre propre
    // controle de taille (MAX_UPLOAD_BYTES, src/server/services/storage.ts —
    // 25 Mo, retour utilisateur : une carte reelle pese ~20 Mo) — une image
    // dont le poids + l'enveloppe multipart depasse cette limite interne
    // etait tronquee en amont, formData() ne voyait plus le champ "file" du
    // tout ("Aucun fichier recu.", plutot que le message correct "Image
    // trop lourde"). Relevee a 27 Mo pour laisser passer nos propres
    // uploads jusqu'a leur plafond prevu, sans changer ce plafond lui-meme.
    proxyClientMaxBodySize: "27mb",
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
