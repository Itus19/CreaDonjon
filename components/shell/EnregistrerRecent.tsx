"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { EspaceRecents } from "@/lib/ui/recents";
import { enregistrerRecent } from "./useRecents";

/**
 * Marqueur invisible (V3.1-30) : la page d'une fiche s'annonce comme
 * « consultée récemment ». Monté par les quatre pages de fiche (entité MJ,
 * règle MJ, fiche du wiki joueur, règle joueur), jamais sur `/apercu` ni
 * `/partage`. Le titre est celui que la page affiche déjà ; seuls l'adresse,
 * le titre et le type sont gardés, jamais un contenu.
 *
 * L'adresse est le chemin courant : `usePathname` ne contient pas la requête,
 * donc jamais de `?avec=`. Une fiche introuvable n'arrive pas ici (la page
 * répond 404 avant de rendre ce composant).
 */
export default function EnregistrerRecent({
  worldSlug,
  espace,
  titre,
  type,
}: {
  worldSlug: string;
  espace: EspaceRecents;
  titre: string;
  /** Identifiant technique du type (`entity_kind` ou `entry_type`), traduit à l'affichage. */
  type?: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    enregistrerRecent(worldSlug, espace, { href: pathname, titre, type });
  }, [worldSlug, espace, pathname, titre, type]);

  return null;
}
