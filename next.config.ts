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
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
