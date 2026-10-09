# 0046 — Les règles de personnage en données, et un seul mécanisme de choix

**Date :** 2026-10-09
**Statut :** acceptée (conception de V3.1-47, avec V3.1-3, 6, 7)

## Contexte

Principe de l'auteur : aucune règle de personnage en dur. Aujourd'hui le plafond de niveau, la génération des caractéristiques (`abilityGeneration.ts`), la charge, la revente, le départ à haut niveau sont des constantes ; les prérequis de multiclassage sont du texte ; dons, traits d'espèce et sous-classes à choix n'ont aucun mécanisme (seul `RemainingChoice` couvre compétences, langues et maîtrises d'armes) ; la sous-classe choisie n'est même pas résolue (`CreationSelection.classes` n'a pas de champ pour elle).

## Options envisagées

- **A.** Une colonne de réglages sur `rulesets` — hors du système d'héritage des fiches (une variante ne pourrait pas surcharger une valeur).
- **B.** Une **fiche de règles** du ruleset, `character_rules`, héritée et surchargée comme les autres fiches ; et un **choix accordé** générique, porté par n'importe quelle fiche.

## Décision

B.
- **Fiche `character_rules`** (une par ruleset, catégorie système, bloc typé `zCharacterRules`) : `level_cap` (20) ; `ability_generation` (`standard_array`, `point_buy` : budget, min, max, coûts ; `roll` : expression et nombre de jets) ; `encumbrance_multiplier` (Force × 7,5 kg) ; `sell_ratio` (½) ; `starting_at_higher_level` (table par palier : or, objets magiques) ; `multiclass_spell_slots` (ADR 0045). Une variante surcharge champ par champ. Les valeurs 2024 viennent de l'import SRD de la base officielle ; le noyau n'a **aucune valeur de repli** : sans fiche, la création le dit.
- **Sur la fiche de classe** : `multiclass_prerequisites` structurés (`{ all | any: [{ ability, min }] }`) ; `suggested_abilities` (l'ordre « Répartir pour un clerc ») ; `casterWeight` (ADR 0045).
- **Le choix accordé** (`zChoiceGrant`), dans la progression d'une classe ou d'une sous-classe, sur un trait d'espèce, un historique ou un don : `{ id, label, count, at_level, refresh: never | short_rest | long_rest, from }` où `from` est un des genres `skill`, `language`, `tool`, `weapon_mastery`, `feat` (filtre : catégorie, origine), `spell` (filtre : liste, niveau max, école), `damage_type`, `ability`, ou **`option`** — des options nommées qui portent chacune leurs propres effets (modificateurs, sorts toujours préparés par niveau, ressources) et leur propre caractéristique d'incantation choisie une fois : c'est la forme des lignages, legs, ascendances, terrains, tactiques. Les améliorations de caractéristiques et les dons de la progression deviennent des `zChoiceGrant` (`ability` ou `feat`).
- **Stockage** : `character.choices[<source>.<clé>.<id>]` (la clé qualifiée existe déjà) ; un choix `refresh ≠ never` garde aussi la date du dernier repos qui l'a rouvert.
- **Résolution** : `resolvedRuleset` collecte tous les `zChoiceGrant` accessibles (espèce, historique, classes **et sous-classes** — `CreationSelection.classes[].subclass` ajouté), rend `RemainingChoice` généralisé (le `kind` devient le genre de `from`) ; `characterSheet()` applique les effets des options choisies. Un repos qui rouvre un choix émet son événement ; l'écran le propose (V3.1-5).

## Conséquences

V3.1-3, 6 et 7 sont conçus ici et fermés au profit des tickets d'implémentation. Gros chantier : le schéma et l'import d'abord, l'assistant ensuite (V3.1-49 à 53 lisent ces données).
