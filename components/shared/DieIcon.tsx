import type { DieSides } from "@/src/core/dice/dieSides";

/**
 * Silhouette du polyedre reellement lance (retour utilisateur : "que le
 * dessin s'adapte au type de des lance") — un d4 est un tetraedre, un d20 un
 * icosaedre, et on le voit avant meme de lire la formule.
 *
 * Trace au lieu de rempli : les six formes partagent la meme graisse et la
 * meme boite de 24, donc elles pesent pareil cote a cote dans une liste
 * d'armes. `currentColor` partout — la couleur vient du bouton (ambre sur
 * l'action principale, encre attenuee sinon), jamais posee ici.
 *
 * Le d6 et le d20 partent tous deux d'un hexagone, comme leurs vraies
 * projections : c'est l'interieur qui les separe (trois aretes en Y pour le
 * cube, une face triangulaire pour l'icosaedre).
 */
const SHAPES: Record<DieSides, React.ReactNode> = {
  // Tetraedre : la face de devant, et la face du dessus repliee dedans. Les
  // trois aretes tirees vers le centre (la vraie projection depuis un sommet)
  // se lisaient comme une fleche a 28 px — le triangle inverse, lui, est
  // immediatement un d4.
  4: (
    <>
      <path d="M12 2.6 21.4 20H2.6z" />
      <path d="M7.3 11.3h9.4L12 20z" />
    </>
  ),
  // Cube en projection isometrique : hexagone + les trois aretes visibles.
  6: (
    <>
      <path d="M12 1.8 21.6 7.3v9.4L12 22.2 2.4 16.7V7.3z" />
      <path d="M12 12.1V1.8M12 12.1 2.4 16.7M12 12.1l9.6 4.6" />
    </>
  ),
  // Octaedre : l'equateur, et les deux faces de devant sous lui. Une croix
  // complete (equateur + axe entier) donnait un losange a quatre quartiers,
  // pas un solide.
  8: (
    <>
      <path d="M12 1.6 21 12l-9 10.4L3 12z" />
      <path d="M3 12h18M12 12v10.4" />
    </>
  ),
  // Trapezoedre pentagonal : le cerf-volant caracteristique du d10.
  10: (
    <>
      <path d="M12 1.6 21 9.4l-9 13-9-13z" />
      <path d="M12 15.6 3 9.4M12 15.6l9-6.2M12 1.6v14" />
    </>
  ),
  // Dodecaedre : la face de devant, large, dans le pentagone du contour. Une
  // face centrale trop petite faisait une pierre precieuse plutot qu'un de.
  12: (
    <>
      <path d="M12 2 21.9 9.3 18.2 21.2H5.8L2.1 9.3z" />
      <path d="M12 18.2 6.7 10.9 8.7 8.1h6.6l2 2.8z" />
    </>
  ),
  // Icosaedre : hexagone + la face triangulaire de devant.
  20: (
    <>
      <path d="M12 1.6 21.6 7v10L12 22.4 2.4 17V7z" />
      <path d="M12 6.2 18 16.4H6z" />
      <path d="M12 1.6v4.6M2.4 7l3.6 9.4M21.6 7 18 16.4" />
    </>
  ),
};

export default function DieIcon({ sides, className }: { sides: DieSides; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {SHAPES[sides]}
    </svg>
  );
}
