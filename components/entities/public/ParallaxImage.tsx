"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { parallaxProgress, parallaxShiftPx, parallaxTravelPx } from "@/src/core/images/parallax";

/**
 * V2.1-10 lot 3 — la seule image de bloc qui embarque du JS.
 *
 * `PublicImageBlock` ne monte ce composant que pour une intensite > 0 : une
 * page dont aucune image n'est en parallaxe reste servie sans un octet de JS
 * de plus qu'avant. C'est aussi ce qui fait du curseur son propre
 * interrupteur, sans case a cocher separee.
 *
 * L'image est plus HAUTE que son cadre (`height: calc(100% + intensite%)`) et
 * glisse dedans : aucun vide ne peut apparaitre, au prix d'un rognage assume
 * (voir src/core/images/parallax.ts).
 */

/**
 * Un seul ecouteur pour toute la page, jamais un par image.
 *
 * `capture: true` est indispensable ici : `scroll` ne remonte PAS depuis un
 * element qui defile, et la coquille de l'application fait defiler un
 * conteneur interne, pas `window`. En phase de capture, l'evenement passe par
 * `window` quel que soit l'element responsable.
 *
 * Les mesures de tous les abonnes sont faites dans une seule image
 * d'animation : sans cela, chaque `getBoundingClientRect()` intercale une
 * lecture entre deux ecritures de style et force autant de recalculs de mise
 * en page.
 */
const abonnes = new Set<() => void>();
let imageDemandee = false;

function rafraichirTous() {
  imageDemandee = false;
  for (const abonne of abonnes) abonne();
}

function demanderRafraichissement() {
  if (imageDemandee) return;
  imageDemandee = true;
  requestAnimationFrame(rafraichirTous);
}

function abonner(maj: () => void): () => void {
  if (abonnes.size === 0) {
    window.addEventListener("scroll", demanderRafraichissement, { capture: true, passive: true });
    window.addEventListener("resize", demanderRafraichissement, { passive: true });
  }
  abonnes.add(maj);
  demanderRafraichissement();
  return () => {
    abonnes.delete(maj);
    if (abonnes.size === 0) {
      window.removeEventListener("scroll", demanderRafraichissement, { capture: true });
      window.removeEventListener("resize", demanderRafraichissement);
    }
  };
}

export default function ParallaxImage({
  src,
  alt,
  intensityPct,
}: {
  src: string;
  alt: string;
  intensityPct: number;
}) {
  const cadreRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Mouvement reduit : on ne s'abonne meme pas. Le style CSS de secours
    // (`app/globals.css`) annule en plus la transformation, au cas ou un
    // decalage aurait ete pose avant que la preference ne change.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function maj() {
      const cadre = cadreRef.current;
      const image = imageRef.current;
      if (!cadre || !image) return;
      const rect = cadre.getBoundingClientRect();
      const travel = parallaxTravelPx(rect.height, intensityPct);
      const progress = parallaxProgress({
        frameTop: rect.top,
        frameHeight: rect.height,
        viewportHeight: window.innerHeight,
      });
      image.style.transform = `translate3d(0, ${parallaxShiftPx(progress, travel)}px, 0)`;
    }

    return abonner(maj);
  }, [intensityPct]);

  return (
    <div ref={cadreRef} className="parallax-frame relative w-full overflow-hidden rounded-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="parallax-image absolute inset-x-0 top-0 w-full object-cover"
        style={{ height: `calc(100% + ${intensityPct}%)` } as CSSProperties}
      />
    </div>
  );
}
