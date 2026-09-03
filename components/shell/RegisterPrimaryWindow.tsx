"use client";

import { useEffect } from "react";
import { useDesktop } from "./DesktopContext";
import { refId, type WindowRef } from "./windowRefs";
import type { EntityWindowData } from "@/src/server/services/entityWindow";
import type { RuleEntryDetail } from "@/src/server/services/rules";

/**
 * Marqueur invisible : la fiche routee (entite ou regle, ADR-0011)
 * s'annonce comme fenetre primaire aupres du bureau partage. Se
 * desinscrit au demontage — navigation vers une autre page ou vers
 * l'accueil de sa section.
 *
 * `data` optionnel (audit de performance, retour utilisateur) : la fiche
 * appelante passe ici les MEMES donnees deja rendues cote serveur pour son
 * propre affichage, afin que `DesktopWindowsProvider` puisse les reutiliser
 * si cette fenetre se replie en secondaire (changement de section) —
 * jamais un second fetch pour une donnee que la page a deja en main. Non
 * fourni par les outils MJ/formulaires de creation (`data?:` optionnel) :
 * portee volontairement limitee aux fiches entite/regle, seules concernees
 * par le "rechargement inutile" signale.
 */
export default function RegisterPrimaryWindow({
  windowRef,
  name,
  badge,
  homeHref,
  data,
}: {
  windowRef: WindowRef;
  name: string;
  badge: string;
  homeHref: string;
  data?: EntityWindowData | RuleEntryDetail;
}) {
  const desktop = useDesktop();
  const id = refId(windowRef);

  useEffect(() => {
    desktop?.registerPrimary({ ref: windowRef, name, badge, homeHref, data });
    return () => desktop?.registerPrimary(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `id` resume `windowRef` (kind+key) de facon stable ; `data` volontairement absent (voir DesktopContext.tsx : un instantane au montage suffit, jamais reevalue en cours de vie de la fenetre)
  }, [id, name, badge, homeHref]);

  return null;
}
