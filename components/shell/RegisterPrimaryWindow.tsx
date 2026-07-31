"use client";

import { useEffect } from "react";
import { useDesktop } from "./DesktopContext";

/**
 * Marqueur invisible : la fiche routee s'annonce comme fenetre primaire
 * aupres de `<DesktopWindows>` (ADR-0006). Se desinscrit au demontage —
 * navigation vers une autre page ou vers l'accueil du monde.
 */
export default function RegisterPrimaryWindow({
  slug,
  name,
  kind,
}: {
  slug: string;
  name: string;
  kind: string;
}) {
  const desktop = useDesktop();

  useEffect(() => {
    desktop?.registerPrimary({ slug, name, kind });
    return () => desktop?.registerPrimary(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, name, kind]);

  return null;
}
