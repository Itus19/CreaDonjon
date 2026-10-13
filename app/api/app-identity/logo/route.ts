import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAnonClient } from "@/lib/supabase/anon";
import { getAppIdentityRow } from "@/src/server/repos/appIdentity";
import { readBrandLogo } from "@/src/server/services/storage";

/** `v` : la version du logo (date d'écriture, en millisecondes), posée par `brandLogoUrl`. */
const zQuery = z.object({ v: z.string().regex(/^\d{1,16}$/).optional() });

/** Une version demandée qui est la version en cours ne change plus jamais : cache d'un an, partagé (CDN) et navigateur. */
const CACHE_VERSIONNE = "public, max-age=31536000, s-maxage=31536000, immutable";
/** Sans version, ou une version dépassée : on sert l'actuel, mais brièvement. */
const CACHE_COURT = "public, max-age=300, s-maxage=300";

/**
 * V3.1-84 (ADR 0061) — le logo téléversé de l'application, lisible par tous
 * (l'écran-titre le montre avant connexion), lu par un client anonyme.
 * Le long cache versionné fait qu'un visiteur ne le télécharge qu'une fois
 * par version, et le CDN une fois par région (docs/QUOTAS.md, egress).
 */
export async function GET(request: NextRequest) {
  const parsed = zQuery.safeParse({ v: request.nextUrl.searchParams.get("v") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Version invalide." }, { status: 400 });

  const anon = createAnonClient();
  const row = await getAppIdentityRow(anon);
  if (!row?.logo_storage_path) return NextResponse.json({ error: "Aucun logo téléversé." }, { status: 404 });

  const bytes = await readBrandLogo(anon, row.logo_storage_path);
  if (!bytes) return NextResponse.json({ error: "Logo introuvable." }, { status: 404 });

  const current = String(new Date(row.updated_at).getTime());
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": parsed.data.v === current ? CACHE_VERSIONNE : CACHE_COURT,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
