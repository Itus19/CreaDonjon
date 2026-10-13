import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPublicWorldWikiBackgroundSignedUrl, resolveShareLink } from "@/src/server/services/publicShare";
import { SIGNED_URL_CACHE_HEADER } from "@/src/server/services/storage";
import { hasVerifiedSharePassword } from "@/lib/shareLinks/passwordCookie";

const zParams = z.object({ token: z.string().min(1).max(200) });

/**
 * V3.1-59 (ADR 0047) — l'image du fond par défaut du wiki, pour un visiteur
 * du lien de partage. Même porte que les pages du lien : un jeton valide, et
 * le mot de passe s'il y en a un. Ne sert QUE la copie désignée par
 * `worlds.wiki_background` (`getPublicWorldWikiBackgroundSignedUrl`), jamais
 * une autre image.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  const { token } = parsed.data;

  const resolved = await resolveShareLink(token);
  if (!resolved || (resolved.passwordHash && !(await hasVerifiedSharePassword(token, resolved.passwordHash)))) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  const url = await getPublicWorldWikiBackgroundSignedUrl(resolved.worldId);
  if (!url) return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": SIGNED_URL_CACHE_HEADER } });
}
