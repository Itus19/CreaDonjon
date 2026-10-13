

---

### ☑ V3.1-113 — Ressources : pacte, recharge partielle, multiclassage (noyau) · `M` · sans modèle IA — **fait le 13 octobre (ADR 0045)**

**Modèle conseillé : Opus** — moteur, tests d'abord. **ADR 0045.**
**Dépend de** : 115 (pour la table du multiclassé dans `character_rules`).

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `recharge: "short_rest_one"` (bloc Ressources, version relevée) ;
  `spellcasting.kind` `slots` | `pact` et `pactSlots` ; `casterWeight` ;
  `pact_slots_used` dans l'état de jeu (défaut 0).
- `characterSheet()` : emplacements du multiclassé (niveaux pondérés,
  arrondi inférieur, table du ruleset) ; réserve de pacte séparée.
- Import SRD : poids d'incantation, magie de pacte de l'occultiste, Arcanum
  mystique (ressource `long_rest` par niveau 6 à 9), recharges partielles
  (Rage, Conduit divin, Forme sauvage, Second souffle).

**Critères d'acceptation**
- [x] Occultiste 20 : 4 emplacements de pacte de niveau 5 ; clerc 3 /
  magicien 2 : emplacements d'un lanceur de niveau 5 ; un multiclassé
  occultiste garde deux réserves (tests).
- [x] Repos court : une Rage rendue ; repos long : toutes (test).

**Note de clôture (13 octobre, Opus).** Détail dans l'[ADR 0045](../adr/0045-pacte-recharge-partielle-multiclassage.md), section « Réalisé ».

*Fait :*
- `computeSpellSlots` et `rechargeTrackers`, 12 tests du noyau ;
- `pact_slots_used` dans l'état de jeu ;
- poids d'incantation de chaque classe dans `data/srd/class-spellcasting.json` ;
- `castSpell` et les repos branchés ;
- 2 tests d'intégration contre la base (occultiste 20, clerc 3 / magicien 2), et ceux des repos rejoués.

*Corrigé en route* : l'arrondi de l'ADR 0045. En 2024, la moitié des niveaux de paladin ou de rôdeur s'arrondit au supérieur.

*Vérifié en vrai* (Testeur B, Clerc 1) : « Niv. 1 — 2/2 » emplacements, inchangé.

*Reporté* :
- les recharges de classe déclarées par les règles et l'Arcanum mystique vont à V3.1-129 ;
- l'écran de la réserve de pacte va à V3.1-114. D'ici là, un occultiste ne voit pas ses emplacements de pacte à l'écran, mais il peut les dépenser.
