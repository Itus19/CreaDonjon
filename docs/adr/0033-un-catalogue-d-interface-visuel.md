# ADR 0033 — Un catalogue d'interface visuel, construit sur le vrai CSS

**Date** : 1ᵉʳ octobre 2026 · **Statut** : accepté

## Contexte

`docs/CHARTE-UI.md` décrit les recettes en mots. Les défauts d'esthétique trouvés en jouant (ascenseur qui jurait avec la DA, bulle de date du navigateur, sélecteur qui se chevauchait) venaient d'éléments qu'aucune recette ne couvrait, ou qu'on réécrivait à la main sans voir l'original. L'auteur veut voir chaque élément, ses états et ses animations, et y puiser pour créer les suivants.

## Options

1. Captures d'écran dans le `.md` — vieillissent en silence.
2. Une page de catalogue dans l'application — fidèle, mais une fonctionnalité de plus à maintenir.
3. Un canevas d'esquisse, alimenté par le CSS compilé de l'application.

## Décision

Option 3. Le canevas « Catalogue d'interface » montre chaque élément avec ses états figés côte à côte et un exemplaire vivant. Il ne recopie aucun style : il charge la feuille produite par `scripts/catalogue/build-css.mjs`, qui compile `app/globals.css` et dérive des classes `.st-hover`, `.st-focus`, `.st-active` des vraies règles `:hover`, `:focus-visible`, `:active`. Les planches vivent dans `docs/catalogue/`, versionnées comme le reste. La charte reste le seul texte normatif ; son §9 indexe les planches. Le générateur Python qui a servi à écrire la première version n'est pas gardé : le dépôt n'a pas d'autre Python, et une section se copie plus sûrement qu'elle ne se génère.

## Conséquences

- Tout élément nouveau ou modifié met sa planche à jour (règle dans `CLAUDE.md`).
- Le catalogue montre l'existant, jamais un état souhaité : on décide, on code, puis on documente.
- `app/globals.css` exclut `docs/` du scan Tailwind, pour que les classes propres aux planches n'entrent pas dans la feuille de l'application.
- Limite du canevas : 8 000 px par planche ; une famille qui grandit se coupe en deux planches.
- Publier demande une session Claude (outil Artifact) ; le dépôt garde la source.
