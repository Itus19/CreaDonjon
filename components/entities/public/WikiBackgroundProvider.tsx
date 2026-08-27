"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import type { WikiBackground } from "@/src/server/services/publicShare";

/** Proprietes CSS personnalisees (`--h`, `--wiki-bg-image`, etc.) : React ne les type pas nativement. */
type CustomProperties = CSSProperties & Record<`--${string}`, string | number>;

interface WikiBackgroundContextValue {
  displayed: WikiBackground | null;
  visible: boolean;
  register: (background: WikiBackground | null) => void;
}

const WikiBackgroundContext = createContext<WikiBackgroundContextValue | null>(null);

/**
 * Fond de page wiki persistant a travers la navigation (V2-G13 suite,
 * retour utilisateur : "la duree du fondu est la meme quand on arrive...
 * mais aussi quand on la quitte"). `/partage/[token]/**` et
 * `/m/[worldSlug]/apercu/**` n'avaient aucun `layout.tsx` propre — chaque
 * page remontait `BookSkin` de zero, donc aucun etat ne pouvait survivre
 * a une navigation pour animer une sortie. Ce fournisseur vit dans un
 * nouveau `layout.tsx` de chaque segment (le seul endroit qui persiste
 * entre deux fiches), et porte l'unique div de fond en `position: fixed`
 * — jamais remonte tant qu'on reste dans le meme lien de partage/monde.
 *
 * `register` (voir `useWikiBackground` plus bas) : chaque page enregistre
 * son propre fond au montage. Si un fond est deja affiche, il disparait
 * d'abord (sa PROPRE duree de fondu) — "revenir au fond par defaut" —
 * puis le nouveau (le cas echeant) apparait a son tour avec la sienne.
 * Jamais un fondu croise direct entre deux images : plus simple, et ca
 * correspond au comportement demande.
 */
export default function WikiBackgroundProvider({ children }: { children: React.ReactNode }) {
  const [displayed, setDisplayed] = useState<WikiBackground | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const register = useCallback((next: WikiBackground | null) => {
    setDisplayed((current) => {
      const unchanged = current?.imageUrl === next?.imageUrl && current?.hue === next?.hue;
      if (unchanged) return current;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (!current) {
        if (next) requestAnimationFrame(() => setVisible(true));
        return next;
      }

      setVisible(false);
      timeoutRef.current = setTimeout(() => {
        setDisplayed(next);
        if (next) requestAnimationFrame(() => setVisible(true));
      }, current.fadeMs);
      return current;
    });
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  return (
    <WikiBackgroundContext.Provider value={{ displayed, visible, register }}>
      {displayed && (
        <div
          className="wiki-bg-backdrop"
          aria-hidden="true"
          style={
            {
              opacity: visible ? 1 : 0,
              transitionDuration: `${displayed.fadeMs}ms`,
              "--wiki-bg-image": `url("${displayed.imageUrl}")`,
              "--wiki-bg-blur": `${displayed.blurPx}px`,
            } as CustomProperties
          }
        />
      )}
      {children}
    </WikiBackgroundContext.Provider>
  );
}

/**
 * Enregistre le fond de LA PAGE COURANTE aupres du `WikiBackgroundProvider`
 * ancetre (dans le `layout.tsx` du segment), et renvoie l'etat actuellement
 * affiche pour que `BookSkin.tsx` applique `--h`/`--c`/`data-mode` sur son
 * propre conteneur — jamais un div supplementaire ici, qui casserait le
 * flex/hauteur de la mise en page.
 *
 * Jamais de nettoyage au demontage : la page suivante enregistre deja sa
 * propre valeur a son montage, avant que celle-ci ne demonte — nettoyer
 * ici ecraserait cette nouvelle valeur par du vide.
 */
export function useWikiBackground(background: WikiBackground | null | undefined): {
  displayed: WikiBackground | null;
  visible: boolean;
} {
  const ctx = useContext(WikiBackgroundContext);
  const normalized = background ?? null;

  useEffect(() => {
    ctx?.register(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, normalized?.imageUrl, normalized?.hue, normalized?.chroma, normalized?.blurPx, normalized?.fadeMs, normalized?.mode]);

  return { displayed: ctx?.displayed ?? null, visible: ctx?.visible ?? false };
}
