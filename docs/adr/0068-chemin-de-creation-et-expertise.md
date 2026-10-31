# 0068 — Le chemin de création recalculé, et l'expertise comme choix

**Date :** 2026-10-31
**Statut :** acceptée (V3.1-49, choix de l'auteur pour l'expertise et le sélecteur générique)

## Contexte

V3.1-49 range sous chaque étape de création les choix qu'elle fait naître, et un choix doit disparaître si sa source change. L'Expertise du Roublard « attend les compétences », mais le bloc `choices` (ADR 0046) ne savait pas dire « parmi les compétences maîtrisées ». La couche d'un modificateur ne suffit pas non plus à dire sous quelle étape ranger un choix : un don accordé par l'historique est en couche 5, comme un don de classe.

## Options envisagées

- **Chemin mémorisé** : garder la liste des sous-étapes dans l'état de l'assistant, et la purger quand une source change. Deux vérités à tenir d'accord.
- **Chemin recalculé** : le dériver à chaque rendu de `resolveChoices` et des anciens choix restants. Un choix existe parce que sa source est choisie.
- **Expertise** : un genre de choix à part, ou un drapeau sur le choix de compétence.

## Décision

- **Chemin recalculé** (`lib/ui/cheminCreation.ts`, pur et testé). Les réponses restent stockées quand une source change : une espèce rechoisie les retrouve, et la fiche calculée ignore déjà ce qui n'est plus valide.
- **`ChoiceSource.origin`** (espèce, classe, historique) et **`RemainingChoice.origin`** (« character » en plus, pour les langues du personnage, sous Identité) disent l'étape.
- **Expertise** : un drapeau `expertise` sur le choix `skill`. `resolveChoices` ne retient une expertise que sur une compétence que les autres aptitudes (`otherFeatures`) ou un autre choix rendent maîtrisée. Sans `otherFeatures`, elle est prise telle quelle, comme un sort sans catalogue.
- **Sélecteur générique** pour tous les genres de choix ; V3.1-118 le remplacera, genre par genre.

## Conséquences

L'import accepte les choix des aptitudes de classe (`Features`), qui s'ouvrent au niveau de leur classe (`classKey`). Données : `rogue-expertise`, `rogue-thieves-cant` (Argot imposé par `presets`). L'Expertise du Barde et du Rôdeur suivra le même modèle quand on la saisira. La fiche jouable rappelle les choix ouverts (`choixOuverts`).
