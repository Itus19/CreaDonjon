# 0045 — Magie de pacte, recharge partielle, emplacements du multiclassé

**Date :** 2026-10-09
**Statut :** acceptée (conception de V3.1-40)

## Contexte

Les ressources ne connaissent que `short_rest`, `long_rest`, `dawn`, `never`. La magie de pacte (emplacements d'un seul niveau, rendus au repos court) n'existe pas. Et `characterSheet()` ne lit les emplacements que de **la première classe incantatrice** (`sheet.ts`, boucle avec `break`) : un multiclassé a des emplacements faux.

## Options envisagées

- **A.** Coder la table du multiclassage et la magie de pacte en dur — contraire au principe « aucune règle de personnage en dur » (V3.1-47).
- **B.** Les porter dans les données du ruleset et faire calculer le noyau.

## Décision

B.
- **Recharge partielle** : `recharge` gagne `short_rest_one` (une au repos court, toutes au repos long) dans `zResourcesBlockData`, version de bloc relevée, migration des données lue par le schéma.
- **Incantation de classe** : `spellcasting.kind` = `slots` (défaut) ou `pact` ; `pact` porte `pactSlots: { [niveau de classe]: { count, slotLevel } }`. L'Arcanum mystique est une ressource `long_rest` par niveau de sort (6 à 9), accordée par la progression.
- **Multiclassage** : chaque classe porte `casterWeight` (`full` 1, `half` ½, `third` ⅓, `none`) ; le ruleset porte la **table des emplacements du multiclassé** (`character_rules.multiclass_spell_slots`, ADR 0046). Le noyau additionne les niveaux pondérés (arrondi inférieur) et lit la table ; une seule classe : sa propre table, comme aujourd'hui. Les emplacements de pacte restent une réserve **séparée**.
- **État de jeu** : `pact_slots_used` (entier) à côté de `spell_slots_used`, lu avec défaut 0.
- **Repos** (`takeShortRest`) : rend les emplacements de pacte et une utilisation des `short_rest_one`.

## Conséquences

Tests du noyau d'abord (occultiste 20 : 4 emplacements de niveau 5 ; clerc 3 / magicien 2 : emplacements d'un lanceur 5). Les valeurs viennent de l'import SRD (base officielle).

## Réalisé (V3.1-113, 13 octobre 2026)

- **Correction de l'arrondi.** Le SRD 5.2.1 compte « la moitié de vos niveaux (**arrondir au supérieur**) de Paladin et de Rôdeur » ; le SRD 5.1, la moitié arrondie à l'inférieur. L'arrondi est donc une donnée de chaque classe dans chaque ruleset (`caster_weight: { fraction, rounding }` du bloc `class_basics`), pas une constante.
- **Noyau.**
  - `computeSpellSlots` (`src/core/rules/spellSlots.ts`) : une seule classe à emplacements garde sa table ; plusieurs lisent la table du ruleset.
  - Une classe sans emplacement à son niveau ne compte pas (paladin 1 de 2014).
  - Sans table, aucun emplacement n'est inventé : l'avertissement `missing_multiclass_table` le dit.
- **Pacte.**
  - La progression du SRD porte déjà les emplacements de pacte de l'occultiste. `spellcasting_kind: "pact"` les sort de la table du multiclassé et les range dans `sheet.spellcasting.pactSlots`.
  - `castSpell` prend un emplacement ordinaire d'abord, puis la réserve de pacte si elle est du niveau demandé.
- **Recharge partielle.**
  - `short_rest_one` s'ajoute à l'énumération du bloc `resources` du personnage. **Écart à cette décision : `__v` n'est pas relevé.** Les blocs existants restent valides, et relever la version aurait imposé de migrer chaque bloc sans aucun gain.
  - `rechargeTrackers` (noyau) remplace la recharge du service. Les deux repos rendent la réserve de pacte (`pact_slots_used`, `.default(0)`, sans migration SQL).
- **Données.** `data/srd/class-spellcasting.json`, par `base_system`, posé par l'import et gardé par un test.
- **Reporté.**
  - Les recharges de Rage, Conduit divin, Forme sauvage et Second souffle, ainsi que l'Arcanum mystique, sont des ressources que les règles **déclarent** (ADR 0060 §1) : V3.1-129. La recharge partielle qu'elles attendaient existe désormais.
  - L'affichage de la réserve de pacte : V3.1-114.
