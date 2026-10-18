import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { APP_LOGO_KEYS } from "@/src/core/brand/identity";
import { DESSINS_LOGO } from "@/components/brand/LogoApp";

/** La clé du logo à dessiner : une des douze, rien d'autre (règle 4). */
const zQuery = z.object({ cle: z.enum(APP_LOGO_KEYS) });

/**
 * L'accent et son encre du thème sombre (`src/styles/tokens.css`), en
 * hexadécimal : le moteur d'images de `next/og` ne lit ni `oklch` ni les
 * variables CSS. oklch(0.76 0.13 78) et oklch(0.15 0.02 78).
 */
const ACCENT = "#dea645";
const ENCRE = "#100a03";

/** Le moteur de `next/og` n'accepte que des éléments SVG dans un `<svg>` : on déplie le fragment de chaque dessin. */
function elementsDuDessin(dessin: ReactNode): ReactNode[] {
  const enfants = isValidElement<{ children?: ReactNode }>(dessin) && dessin.type === Fragment ? dessin.props.children : dessin;
  return Children.toArray(enfants);
}

/**
 * V3.1-86 — l'icône de l'onglet du navigateur : la tuile d'accent et le
 * dessin au trait du logo choisi. Publique comme l'écran-titre, elle ne lit
 * rien : la clé arrive dans l'adresse (posée par `generateMetadata`), donc
 * une adresse donne toujours la même image et se garde un an.
 */
export async function GET(request: NextRequest) {
  const parsed = zQuery.safeParse({ cle: request.nextUrl.searchParams.get("cle") });
  if (!parsed.success) return NextResponse.json({ error: "Logo inconnu." }, { status: 400 });

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: ACCENT, borderRadius: 17, color: ENCRE }}>
        <svg width="46" height="46" viewBox="0 0 48 48" style={{ color: ENCRE }}>
          {elementsDuDessin(DESSINS_LOGO[parsed.data.cle])}
        </svg>
      </div>
    ),
    { width: 64, height: 64, headers: { "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" } }
  );
}
