# 0063 — La naissance se stocke en date de jeu, l'âge se dérive

**Date :** 2026-10-13
**Statut :** acceptée (V3.1-48, choix de l'auteur du 5 octobre)

## Contexte

Le bloc `character` stockait `age` (entier, V3-Z1). Un âge vieillit avec la campagne : stocké, il devient faux à chaque jour de jeu. C'est une valeur dérivée (règle 16). La fiche n'avait en outre qu'un champ de nom, porté par l'entité.

## Options envisagées

- **A.** Garder `age` et demander au MJ de le tenir à jour à la main.
- **B.** Stocker la naissance (`birth`, une `GameDate`) et dériver l'âge de la date du jour du monde (`calendar.currentDate`).

## Décision

**B.** Le bloc `character` gagne `given_name`, `family_name` et `birth` (tous optionnels). `ageAt` et `birthYearFromAge` (`src/core/calendar/age.ts`) sont pures : un anniversaire pas encore passé retire un an. On saisit l'âge, le jour et le mois ; l'année se calcule. `age` reste lisible (fiches anciennes) et disparaît à la première édition de la naissance. Sans date du jour réglée, l'année se saisit à la main et l'âge affiche « — ». Le nom de l'entité est recomposé « Prénom Nom » côté serveur à l'enregistrement du bloc. Le calendrier du monde arrive avec le layout du monde (CABLAGE C1), par contexte.

## Conséquences

- Les mentions pointent l'entité par `id` et suivent le renommage ; leur `label` écrit n'est jamais réécrit (spec §A1).
- `applyLevelUp` refuse désormais un changement de naissance, de prénom ou de nom, plus d'`age`.
- Le layout du monde lit une colonne de plus par rendu (QUOTAS Q1), dans la même vague que les campagnes.

## Complément (V3.1-74, 13 octobre 2026) — la mort

- **Mort** : `death` (`GameDate`, optionnel) dans le même bloc `character`. « Défunt » = `death` renseigné, sans booléen à part (règle 16).
- **L'âge s'arrête à la mort** (`ageWithDeath`, `src/core/genealogy/lifeDates.ts`). Un défunt a un âge même sans date du jour réglée.
- **Une fiche sans bloc `character`** n'a pas de dates : rien n'est inventé.
- **Généalogie** : `getFamilyTree` lit les blocs `character` des seules fiches de l'arbre, en une requête, et les **filtre pour le lecteur avant l'envoi**. Le bloc a sa propre visibilité : une naissance réservée au MJ ne part jamais vers un joueur ni vers le wiki public (test d'intégration).
