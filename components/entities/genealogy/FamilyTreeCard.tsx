"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { FamilyTreeNode } from "@/src/core/genealogy/buildFamilyTree";

/**
 * Carte portrait + etiquette de nom arrondie (esthetique de reference
 * fournie par l'utilisateur, V2-H3) — meme mecanique de repli que
 * `PublicPortrait.tsx` (une entite sans portrait affiche son initiale
 * plutot qu'une image cassee).
 *
 * Trois etats plutot que deux (retour utilisateur : icone d'image cassee
 * visible un instant sur les cartes sans portrait) : l'image reste
 * `hidden` tant qu'elle n'a pas fini de charger AVEC succes — l'initiale
 * est donc affichee par defaut et ne disparait que si l'image reussit
 * vraiment, jamais un placeholder qui laisserait passer l'etat casse du
 * navigateur le temps d'un aller-retour reseau (le 404 arrive apres le
 * premier rendu, jamais avant).
 *
 * Retour utilisateur (portrait de Fine parfois reste bloque sur
 * l'initiale) : une image deja en cache navigateur peut finir de charger
 * de facon synchrone des que `src` est pose, avant que React n'ait
 * attache `onLoad` — l'evenement part alors dans le vide. Le callback de
 * ref verifie `complete`/`naturalWidth` a l'attachement du nœud pour
 * rattraper exactement ce cas, en plus de `onLoad` pour le chargement
 * normal (reseau).
 */
export default function FamilyTreeCard({ node, href }: { node: FamilyTreeNode; href: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  const checkAlreadyLoaded = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setStatus(img.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  return (
    <Link href={href} className="relative block h-full w-full">
      <div className="h-full w-full overflow-hidden rounded-xl border border-edge bg-panel-raised transition-colors hover:border-edge-strong">
        {status !== "loaded" && (
          <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-ink-muted">
            {node.name.slice(0, 1).toUpperCase() || "?"}
          </div>
        )}
        {status !== "error" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={checkAlreadyLoaded}
            src={`/api/entities/${node.id}/portrait`}
            alt=""
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            className={`h-full w-full object-cover ${status === "loaded" ? "" : "hidden"}`}
          />
        )}
      </div>
      <span className="absolute inset-x-2 bottom-2 block truncate rounded-full border border-edge-strong bg-panel px-2 py-1 text-center text-xs font-semibold text-ink shadow-md">
        {node.name || "(sans nom)"}
      </span>
    </Link>
  );
}
