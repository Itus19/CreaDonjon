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
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@img/**/*"],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
