

---

### ☑ V3.1-117 — La sous-classe résolue et ses choix · `M` · sans modèle IA — **fait le 13 octobre (ADR 0046)**

**Modèle conseillé : Opus.** **ADR 0046.** **Dépend de** : 116.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `CreationSelection.classes[].subclass` ; la sous-classe rejoint le lot
  résolu ; `zSubclassFeatureEntry` accepte modificateurs, sorts toujours
  préparés et `zChoiceGrant`.
- Import SRD : Affinité élémentaire (type de dégâts, une fois), Cercle de
  la Terre (terrain, au repos long), Résilience fiélonne (au repos),
  Proie du chasseur / Tactiques défensives (au repos), Découvertes
  magiques, Savant en évocation (sorts).

**Critères d'acceptation**
- [ ] ~~Affinité élémentaire Feu : résistance et bonus de dégâts appliqués (test).~~ Reporté à V3.1-137 et V3.1-134 (décision de l'auteur, 13 octobre) : le type choisi est enregistré (test).
- [x] Une sous-classe purement descriptive ne change rien.

**Note de clôture (13 octobre, Opus).** Détail dans l'[ADR 0046](../adr/0046-regles-de-personnage-et-choix-generiques.md), section « Réalisé (V3.1-117) ».

*Fait :*
- sous-classe dans la sélection, dans le moteur et dans la fiche ;
- `subclassFeatures` et le niveau de classe pour les choix et les sorts ; 9 tests du noyau ;
- `data/srd/subclasses-2024.json`, posé par l'import et gardé par un test ;
- 3 tests d'intégration contre la base : Cercle de la Terre, Savant en évocation, Voleur descriptif.

*Défaut trouvé en route et corrigé* : la validation des sorts côté serveur perdait un sort valide placé après des sorts refusés.

*Vérifié en vrai* : la route du ruleset rend, pour un Druide 5 du Cercle de la Terre, le choix du terrain et ses quatre options ; la fiche de Testeur B se charge sans changement.

*Restes* :
- la clé de la sous-classe Cercle de la Terre est `circle-of-the-land-subclass` (collision avec une aptitude 2014 à l'import) ; elle entre dans la clé des choix stockés ;
- les sorts de domaine, de serment, de protecteur et draconiques (toujours préparés) ne sont pas encore saisis : le vocabulaire existe, c'est de la donnée ;
- l'écran des choix revient à V3.1-118.
