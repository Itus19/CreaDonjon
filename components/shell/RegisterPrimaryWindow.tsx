"use client";

import { useEffect } from "react";
import { useDesktop } from "./DesktopContext";
import { refId, type WindowRef } from "./windowRefs";

/**
 * Marqueur invisible : la fiche routee (entite ou regle, ADR-0011)
 * s'annonce comme fenetre primaire aupres du bureau partage. Se
 * desinscrit au demontage — navigation vers une autre page ou vers
 * l'accueil de sa section.
 */
export default function RegisterPrimaryWindow({
  windowRef,
  name,
  badge,
  homeHref,
}: {
  windowRef: WindowRef;
  name: string;
  badge: string;
  homeHref: string;
}) {
  const desktop = useDesktop();
  const id = refId(windowRef);

  useEffect(() => {
    desktop?.registerPrimary({ ref: windowRef, name, badge, homeHref });
    return () => desktop?.registerPrimary(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `id` resume `windowRef` (kind+key) de facon stable
  }, [id, name, badge, homeHref]);

  return null;
}
