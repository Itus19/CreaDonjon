/**
 * Squelette de la colonne de lecture d'une fiche de wiki (V2.1-20 lot 1).
 *
 * Premier état de chargement de l'application — `CHARTE-UI.md` §5 comptait
 * « zéro `loading.tsx` », et c'est le F-01 du rapport d'audit. Les trois routes
 * de wiki le rendent depuis leur `loading.tsx` : `/partage/[token]`,
 * `/m/[worldSlug]/apercu` et l'onglet Wiki de la coquille joueur.
 *
 * Ce composant ne remplace QUE la colonne de lecture. La coquille et le
 * sommaire vivent dans le `layout.tsx` depuis V2.1-12 et V2.1-19 : ils restent
 * montés pendant la navigation, donc le squelette apparaît à leur droite sans
 * que rien d'autre ne bouge. La largeur vient de `BookSkin` (`max-w-[70ch]`),
 * jamais redéclarée ici.
 *
 * Mesuré avant de l'écrire (V2.1-20 lot 0) : une fiche ordinaire répond en
 * 215 ms, celle qui porte un fond et cite deux règles en 731 ms. Pendant tout
 * ce temps, rien ne se passait à l'écran — l'ancienne fiche restait affichée,
 * immobile. Ce composant ne raccourcit pas une milliseconde de rendu ; il
 * remplace « figé » par « en train de charger », ce qui est la plainte réelle.
 *
 * Pas de portrait dans le squelette, délibérément : seules certaines fiches en
 * ont un, et en promettre un qui disparaît ensuite déplacerait tout le texte
 * au moment de l'arrivée. On n'esquisse que ce que TOUTE fiche possède.
 *
 * `animate-pulse` seulement : `prefers-reduced-motion` et `[data-motion="off"]`
 * ramènent déjà toute animation à 0,001 ms dans `src/styles/tokens.css`, il n'y
 * a rien à réimplémenter ici (CHARTE-UI.md §4).
 */

/**
 * Largeurs des lignes de prose. Irrégulières à dessein : une pile de barres de
 * largeur identique se lit comme un panneau d'interface, pas comme du texte.
 * Le `null` marque la fin d'un paragraphe — la ligne précédente est courte et
 * un écart plus grand suit, exactement comme dans le rendu réel.
 */
const LIGNES: (string | null)[] = ["100%", "97%", "99%", "62%", null, "100%", "94%", "98%", "71%"];

export default function WikiFicheSkeleton() {
  return (
    <div role="status" aria-label="Chargement de la fiche" className="animate-pulse">
      {/* Même disposition que l'en-tête de `PublicEntityBody` : le titre à
          gauche, le genre de fiche poussé à droite. La hauteur `h-9` est celle
          d'`.entity-title` (1,875 rem, interligne serré) — le titre réel se
          pose donc là où le squelette l'annonçait. */}
      <div className="flex items-start justify-between gap-3">
        <div className="h-9 w-2/3 rounded-md bg-panel-raised" />
        <div className="mt-1 h-5 w-24 shrink-0 rounded-md bg-panel" />
      </div>
      <div className="mt-6 flex flex-col gap-2.5">
        {LIGNES.map((largeur, i) =>
          largeur === null ? (
            <div key={i} className="h-3" aria-hidden="true" />
          ) : (
            <div key={i} className="h-3.5 rounded-md bg-panel" style={{ width: largeur }} aria-hidden="true" />
          )
        )}
      </div>
    </div>
  );
}
