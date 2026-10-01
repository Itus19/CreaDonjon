# ADR 0034 — La pilule glissante remplace les intercalaires de classeur

**Date** : 1ᵉʳ octobre 2026 · **Statut** : accepté, à appliquer (V3.1-19) · **Remplace** en partie l'ADR 0026

## Contexte

L'ADR 0026 autorisait deux présentations d'onglets : la bascule segmentée (`Tabs.tsx`) et les intercalaires de classeur (`BinderTabs`). Le classeur était né d'un retour réel (« les onglets ne sont pas très visibles »). Avec la refonte « verre minéral », l'auteur le trouve finalement peu esthétique. Cinq styles ont été esquissés pour le panneau de monde de l'accueil : pilule glissante, soulignement, pastilles à icônes, liste latérale, dalles résumé.

## Décision

**La pilule glissante (A).** Les onglets sont posés dans une gélule (`rounded-full border border-edge`, fond `panel-sunken`, 3 px de marge) ; un fond relevé (`panel-raised`, liseré `edge-strong`, ombre douce) **glisse** sous l'onglet actif en 260 ms `cubic-bezier(.4,0,.2,1)`. Onglets de largeur égale, actif en encre pleine et graisse 600.

Elle vaut pour le panneau de monde de l'accueil **et** pour la fiche de personnage. C'est le dessin de `Tabs.tsx`, plus le glissement : il n'y a plus qu'**une** présentation d'onglets. `BinderTabs` disparaît ; ses usages passent à `Tabs` (ou `BinderTabs` devient un simple renvoi le temps de la migration).

Le glissement fait la visibilité que le classeur apportait : on voit l'onglet changer, pas seulement la couleur d'un texte.

## Conséquences

- Le contrat ARIA de l'ADR 0026 (`role="tablist"`, `aria-selected`, un seul onglet tabulable, flèches/`Home`/`End`) reste entier : `Tabs.tsx` l'a déjà.
- Le tableau à deux lignes du §3 de `CHARTE-UI.md` redevient une ligne, **quand le code change** (la charte décrit l'existant). La planche 3 du catalogue suit.
- `prefers-reduced-motion` : le fond saute sans glisser.
- Usages de `BinderTabs` à convertir : accueil, fiche jouable, fiche solo, colonne Monde et coquille du solo, aperçu du créateur de personnage.
- Bascule `SectionToggle` (liens Monde/Règles/MJ) : même dessin, toujours hors du cadre des onglets ; elle peut prendre le glissement, sans obligation.
