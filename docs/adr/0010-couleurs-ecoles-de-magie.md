# 0010 — Quatrième catégorie de couleur sémantique : les écoles de magie

**Date :** 2026-08-24
**Statut :** acceptée

## Contexte

`specs/coquille-et-design.md` §1 posait trois couleurs de lien, jamais mélangées (violet = entité de wiki, vert d'eau = règle, terracotta = réservé au MJ), et interdisait explicitement toute couleur codée en dur en dehors de `tokens.css`. Une tentative précédente de badge par école de sort (Abjuration, Évocation…) avait été refusée sur cette base — un commentaire dans `SpellSelectionStep.tsx` en gardait la trace.

Retour utilisateur explicite (V2-G1) : les huit badges d'école de l'onglet Sorts de l'assistant de création sont tous rendus dans la même couleur, illisibles à distinguer d'un coup d'œil pour un joueur qui compare plusieurs sorts.

## Options envisagées

- **A. Ajouter une quatrième catégorie de couleur sanctionnée**, une teinte par école, mêmes garanties de contraste (L/C) que les trois existantes. — Répond directement à la demande ; élargit le système au-delà des trois couleurs "jamais mélangées" d'origine.
- **B. Rester dans la palette existante** (variation de clarté du vert d'eau des règles plutôt que de teinte). — Ne casse rien à la charte, mais différencie huit catégories bien moins nettement que huit teintes distinctes.
- **C. Repère non coloré** (lettre, icône). — Aucune couleur ajoutée, mais répond moins bien au besoin exprimé ("des couleurs différentes").

## Décision

Option A, sur confirmation explicite de l'utilisateur. Huit nouveaux jetons `--school-<ecole>` dans `tokens.css`, un par école de magie (clés alignées sur `MAGIC_SCHOOL_LABELS_FR`), déclinés dans les six blocs de mode existants (dark/dim/soft/light, deux blocs de contraste élevé). Chaque teinte reprend exactement les couples L/C déjà vérifiés ≥ 7:1 pour `--link-entity`/`--link-rule`/`--gm` dans le mode correspondant — seule la teinte change, jamais la clarté ni le chroma, donc les garanties de contraste documentées en tête de `tokens.css` restent valables sans nouveau calcul.

## Conséquences

- Le principe "trois couleurs de lien, jamais mélangées" (§1) devient quatre catégories sémantiques au total ; les écoles de magie ne sont **pas** des couleurs de lien (elles ne pointent vers aucune fiche), donc la distinction reste nette : liens vs. classification d'un badge.
- Toute nouvelle catégorie de couleur future doit suivre le même protocole : jetons dans `tokens.css`, mêmes L/C que les couleurs déjà vérifiées, jamais de valeur en dur ailleurs dans le code.
- `specs/coquille-et-design.md` §1 est amendé en conséquence (renvoi vers cet ADR).
