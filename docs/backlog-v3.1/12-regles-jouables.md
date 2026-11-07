# Les règles jouables (V3.1-129 à 140)

*Toute règle d'un ruleset en jeu est jouable à 100 % par le moteur, sans qu'un modèle lise la règle (ADR 0059). Étude et découpage : [`docs/etude-regles-jouables.md`](../etude-regles-jouables.md). Forme des données de la fondation : [ADR 0060](../adr/0060-la-fondation-des-regles-jouables.md). Esquisse : planches « Esquisse · Règle jouable » du canevas de la refonte (https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm).*

*Partie du backlog V3.1. L'index, la feuille de route et la table de tous les tickets : [`docs/BACKLOG_V3.1.md`](../BACKLOG_V3.1.md).*

**Ordre.** 129 → 130 → 131 et 132 → 133 forment la **fondation**. 134 à 138 sont les cinq autres chantiers : chacun se conçoit (ADR) avant de se découper, dans l'ordre de l'étude. 139 et 140 viennent quand la fondation tient.

**Critère commun à toute la partie.** Le moteur reste jouable sans IA (`docs/backlog-v3/00-cadre.md` §3) : aucun ticket de 129 à 139 n'appelle de modèle. Les dés sont lancés par le serveur (règle absolue 8).

---

## La fondation (ADR 0060)

### ☑ V3.1-129 — Le noyau : ressources déclarées, activation, effets qui durent · `L` · sans modèle IA — **prêt (Opus)**

*Reçu de V3.1-113 (13 octobre)* : la recharge partielle `short_rest_one` existe (noyau `rechargeTrackers`) ; les ressources déclarées par les règles l'utiliseront pour Rage, Conduit divin, Forme sauvage, Second souffle, et `long_rest` par niveau pour l'Arcanum mystique.

*Reçu de V3.1-79 (26 octobre), décidé par l'auteur* : la **recharge des capacités de monstre** (« Souffle empoisonné (recharge 5–6) ») entre ici, comme une ressource qui se recharge, et non comme une colonne isolée. Aujourd'hui, la fiche de créature montre la capacité et sa règle (lue dans le texte : `lireRecharge`, `lib/ui/creature.ts`), sans point « prêt / dépensé » ni bouton, même en combat : une instance de combat (`combat_participants`) n'a aucun champ pour cet état. Le bloc `statblock` reste un **modèle** (specs/outils-mj.md §5) : l'état prêt / dépensé vit dans l'instance de combat, jamais dans le bloc.

**Modèle conseillé : Opus** — noyau du moteur, tests d'abord.
**Dépend de** : V3.1-113 (`short_rest_one`) pour la recharge partielle ; rien d'autre pour le reste.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test:core` et résumer les échecs.

- Schémas Zod des blocs `resources` (de règle), `activation` (avec `durable_effects` et `variants`) et `coverage`, enregistrés au registre (`rule-blocks/blocks.ts`). `apply_effect` rejoint `EffectNode`, `ResolvedEffect` et `zEffect`.
- Formules : `column.<clé>` (colonne de la progression de la classe qui accorde la fiche), `proficiency`, `spell_save_dc`.
- `characterSheet()` : liste des ressources calculée depuis les fiches du personnage (objets seulement équipés ou liés) ; lecture des effets actifs en couche 7, modificateurs recalculés.
- Fonctions pures : `planActivation` (vérifie `requires`, coût, budget, cibles ; lance les dés par le `Rng` injecté ; rend un plan d'écritures), `expireEffects` (sur `turn_start`, `turn_end`, `round_end`, repos, avance du temps), consommation d'un jeton, état de couverture d'une fiche.
- **Recharge d'une capacité de créature** (reçu de V3.1-79) : une ressource à un usage, « prête » ou « dépensée », qui se recharge sur un jet de d6 au début du tour de la créature (seuil lu dans la règle, ex. 5–6) ; son état vit dans l'**instance de combat** — chaque « Gobelin ×4 » a le sien. La structure de la règle (seuil, déclencheur) passe en données ; l'état de l'instance demande sans doute une colonne (ou un champ de l'état d'instance) : migration à décider dans ce ticket. Ensuite, la fiche de créature (`CreatureSheet.tsx`) branche le point « prêt / dépensé » et le jet « Recharge d6 » sur l'instance choisie, et estompe les pastilles d'une capacité dépensée (ce que la planche « Fiche de créature » prévoyait).

**Critères d'acceptation**
- [ ] Un paladin 9 a 2 Conduits divins calculés depuis sa progression ; aucun compteur n'est écrit sur sa fiche (test).
- [ ] Abjuration d'ennemis : trois cibles au plus avec CHA +3, une sauvegarde par cible, Effrayé posé sur les échecs, 1 Conduit divin et l'action Magie consommés (test, `Rng` fixe).
- [ ] L'Effrayé d'Abjuration disparaît dès que son porteur subit des dégâts, et au bout de 10 rounds sinon (tests).
- [ ] Un jeton « avantage à un jet de votre choix » s'engage une fois puis disparaît (test).
- [ ] Une activation sans ressource suffisante est refusée avec sa raison, sans rien écrire (test).
- [ ] Recharge d'une créature : un souffle dépensé par « Gobelin 1 » ne l'est pas pour « Gobelin 2 » ; au début du tour de Gobelin 1, un d6 lancé par le serveur (`Rng` fixe) à 5 ou 6 le rend prêt, à 1–4 non (tests).

---

### ☑ V3.1-130 — La migration et le service `activateFeature` · `M` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** — migration, sécurité, écritures du moteur.
**Dépend de** : 129, V3.1-24 (concentration dans l'état de jeu).

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration nouvelle : `entity_active_effects.source_kind` accepte `feature`, colonne `payload jsonb not null default '{}'`. RLS inchangée (politique d'écriture par `app.can_edit_entity`, migration du 10 octobre). `docs/SCHEMA.md` §12.2 mis à jour ; types régénérés.
- Repo dans `src/server/repos/` ; service `activateFeature` dans `characterActions.ts` ; route ou action serveur à l'entrée validée par Zod ; liste de contrôle de `docs/SECURITE.md`.
- Une seule écriture applique le plan : usages, budget, effets actifs, états, `session_event`, `dice_rolls`. Écriture sur une autre créature selon l'ADR 0041.
- Les repos et la boucle de tour appellent `expireEffects` ; un effet retiré est journalisé.

**Critères d'acceptation**
- [ ] Une activation journalise ses jets et ses effets, et se relit après rechargement (test d'intégration).
- [ ] Un joueur sans droit sur l'entité est refusé (test d'intégration).
- [ ] Un effet de concentration disparaît quand la concentration est rompue (test d'intégration).
- [ ] `docs/QUOTAS.md` : la consommation d'une activation est notée (une écriture, aucune lecture en boucle).

---

### ☑ V3.1-131 — La fiche jouable : un bouton par activation · `M` · sans modèle IA — **à décider (esquisse)**

**Modèle conseillé : Sonnet**, une fois les planches « Esquisse · Règle jouable » passées en « Décidé ».
**Dépend de** : 130.

**Sous-tâches Haiku** (`aide-haiku`) : libellés dans `messages/` ; planche du catalogue ; vérifications.

- Onglet Actions : les ressources calculées (avec leur recharge), une carte par activation avec son coût, ses variantes, le choix des cibles et le résultat ; les effets actifs et les jetons du personnage. Le bouton « utiliser » des compteurs manuels reste pour les compteurs `custom`.
- `docs/CABLAGE.md` : aucun chargement de plus à l'ouverture de la fiche (les activations viennent avec les fiches de règles déjà chargées).

**Critères d'acceptation**
- [ ] Les trois écrans de l'esquisse, une fois décidés, se retrouvent sur la fiche.
- [ ] Une activation se joue au téléphone sans perdre le fil de la fiche.

---

### ☑ V3.1-132 — L'éditeur de briques et l'état de couverture · `L` · sans modèle IA — **à décider (esquisse)**

**Modèle conseillé : Sonnet** pour l'interface, une fois l'esquisse décidée ; Opus relit la validation.
**Dépend de** : 129.

**Sous-tâches Haiku** (`aide-haiku`) : libellés ; planche du catalogue ; vérifications.

- Sur une fiche de règle modifiable : édition des blocs `resources`, `activation` (coût, cibles, effets imbriqués, variantes, effets qui durent) et `coverage`, par listes déroulantes et champs de formule — jamais un champ JSON libre. Le texte de la règle reste à côté, avec le passage dont vient chaque brique.
- Badge de couverture sur la fiche (jouable, partielle, non évaluée) ; vue « règles non jouables » d'un ruleset.
- Le mode solo avertit avant qu'une fiche non jouable n'entre en jeu (ADR 0059 §3).

**Critères d'acceptation**
- [x] Abjuration d'ennemis se saisit entièrement depuis l'éditeur, sans JSON, et se joue sur la fiche.
- [x] Une règle officielle ne se modifie pas : l'éditeur crée la surcharge dans le ruleset personnel (règle absolue 18).

*Fait le 4 novembre.* Planches décidées avec cinq ajustements (pas de cadre « Proposition de l'IA », renvoyé au 140 ; une citation facultative par brique, surlignée ; « Appliquer un état » en une brique ; section « Ressources déclarées » ; écriture dans la variante, jamais dans l'officielle). Noyau : `passage` / `passages` (chemins de `brickPaths`), `coverageSummary`, `pruneOrphanDurableEffects`, `applyOverrideFacts`. Serveur : `savePlayableBlocks` (`add_block`, `replace_block` ou `remove_block` selon la règle d'en dessous ; version maison réécrite d'un tenant ; refus sans variante), `listUnplayableRules`, `listDeclaredResources`, `unplayableAmong` ; routes MJ `rules/playable` et `rules/resources` ; `RuleEntryDetail.coverage`. Écran (Sonnet) : éditeur dans la fiche (⋮ « Rendre jouable »), rendu des trois blocs, badge, page « Règles non jouables » (MJ), bandeau du mode solo. Vérifié au navigateur dans un monde isolé : Conduit divin puis Abjuration saisis à l'éditeur par le MJ, joués par la Testeuse A (1 usage dépensé, sauvegarde du serveur, Effrayé posé) ; règle officielle : message et Enregistrer grisé ; téléphone. Corrigés en vérifiant : badges du titre qui débordaient au téléphone, sélection au doigt, liens du bandeau solo, libellé du badge. Test d'intégration `rulePlayableBlocks.integration.test.ts` (3/3).

*Reste* : l'aperçu du bouton montre les formules brutes (`{spell_save_dc}`) faute de personnage ; les briques « Avantage / désavantage » et « Modificateur temporaire » s'enregistrent mais le tour du moteur ignore encore `apply_modifier` (V3.1-134) ; la condition d'accès `requires`, les jetons et les modificateurs d'un effet qui dure sont conservés mais pas saisissables.

---

### ☑ V3.1-133 — Les données : le quotidien du SRD rendu jouable · `M` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** — données de règles officielles, import.
**Dépend de** : 129.

**Sous-tâches Haiku** (`aide-haiku`) : vérifications et résumé des échecs.

- Les ressources et activations des règles 1, 6 et 8 de l'étude (Second souffle, Sursaut d'action, Abjuration d'ennemis), plus Conduit divin, en données SRD importées par `ingest-srd` (même motif que `data/srd/triggers-2024.json`, ADR 0050).
- Les règles qui demandent un chantier suivant reçoivent un bloc `coverage` honnête plutôt qu'une activation incomplète.

**Critères d'acceptation**
- [x] Après réimport, les trois règles sont « jouables » et se jouent sur une fiche de test (`docs/TESTS.md`, comptes de test). *Nuance* : les trois se jouent de bout en bout ; Second souffle porte le badge « Jouable », Fougue et Abjuration d'ennemis « Partielle », parce qu'elles déclarent honnêtement ce qui reste en texte (pas l'action Magie, une fois par tour ; une seule chose par tour pour la cible), comme le demande la seconde puce.

*Fait le 7 novembre.* `data/srd/playable-2024.json` (même motif que `triggers-2024.json`, ADR 0050) : Second souffle (ressource selon la table, soin `1d10 + class.level`), Fougue (`min(2, 1 + floor(niveau / 17))`, +1 action), Conduit divin du Paladin et du Clerc (ressource selon la table ; Perception divine, Étincelle divine et Renvoi des morts-vivants en `coverage`, renvoyés à 134, 137 et 138), Abjuration d'ennemis (activation complète, Effrayé qui dure). `ingest-srd` les lit et les valide (SRD 2024 seulement) ; test de données `srdPlayableData.test.ts` (blocs valides, clés du SRD, citations présentes mot pour mot dans le texte français, usages conformes aux tables). Le contexte d'activation gagne `class.level` (`grantingClassLevel`, partagé avec les maximums de ressources). Réimport fait (1 905 règles, aucun échec), scripts d'auteur rejoués. Vérifié : `srdPlayable.integration.test.ts` 4/4 (monde sur l'officiel, sans variante) ; au navigateur, Brunhild (Guerrière 5, Testeuse A) joue Second souffle et Fougue, Aldric (Paladin 9, MJ) joue Abjuration contre deux gobelins. Corrigé en vérifiant : le résultat d'une capacité sur soi était vide (il affiche maintenant « Brunhild : 26 → 33 PV (Soins : 7) »).

*Reste* : Fougue n'ajoute l'action qu'au journal, la table ne tenant pas de budget d'action en base (choix du 130 ; la boucle du solo le tient) ; sur la page joueur, le MJ ne voit pas les chiffres des sauvegardes de son propre personnage (il les a dans son journal).

---

## Les chantiers suivants (à concevoir)

Chacun commence par un ADR, puis se découpe en tickets prêts. Les règles visées viennent de l'étude.

### ☑ V3.1-134 — Les valeurs calculées · `M` · sans modèle IA — **conçu le 7 novembre ([ADR 0074](../adr/0074-les-valeurs-calculees.md)), découpé en V3.1-155 à 158**
Valeur de modificateur en formule ou en dé (+ mod. CHA, +1d4, 10 + DEX + CON), nombre et taille des dés en formule dans l'AST, nouvelles cibles (`crit_range`, sens, vitesses, lumière, maîtrises). Règles visées : 2, 3, 5, 11, 12, 13, 23, 24, 25, 32.

*Reçu de V3.1-117 (13 octobre)* : le bonus de dégâts de l'Affinité élémentaire (+ mod. CHA à un jet de dégâts d'un sort du type choisi). Critère : « Affinité élémentaire Feu : bonus de dégâts appliqué (test) ». Le type choisi est déjà enregistré (`<sous-classe>.elemental-affinity.damage-type`).

*Conçu le 7 novembre* : [ADR 0074](../adr/0074-les-valeurs-calculees.md). Deux choix de l'auteur : la Défense sans armure entre dans ce chantier par deux cibles de CA dédiées (sans attendre 137) ; la lumière émise part au 138. Découpé ci-dessous.

#### ☑ V3.1-155 — Le noyau : modificateurs en formule et en dé, dés en formule, nouvelles cibles · `M` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** — noyau du moteur, tests d'abord.
**Dépend de** : 129, 133 (`grantingClassLevel`).

**Sous-tâches Haiku** (`aide-haiku`) : vérifications et résumé des échecs.

- `src/core/formula` : le nœud `dice` accepte une formule pour `count` et `faces` (parseur `ceil({class.level} / 2)d6`, `{proficiency}d10`, `1d{…}` ; formateur à l'aller-retour exact ; bornes de `limits.ts` ; Zod).
- `zModifier.value` : `number | formule`. Un dé n'est permis que sur une cible de jet (refus Zod sur CA, vitesse, PV, caractéristique, sens).
- `characterSheet()` : évalue les formules avec les références de la règle (mêmes que les ressources) ; un dé reste un **dé de bonus**, porté à côté du nombre de chaque jet (`dice: { count, faces, label, source }[]` sur sauvegardes, tests, compétences, et un nouveau `rolls.attack` / `rolls.damage` par genre) ; avertissement si incalculable.
- Cibles nouvelles (`modifierTargets.ts` et lecture dans `characterSheet()`) : `attack*`, `damage*` (dont `damage.weapon.<car>` et `damage.spell.<type>` / `{choice:<clé>}`), `save`, `crit_range*`, `speed.fly|swim|climb|burrow`, `sense.*`, `prof.weapon|armor|tool.*`, `ac.unarmored`, `ac.unarmored_no_shield` (meilleure base de CA retenue ; bouclier selon la cible).

**Critères d'acceptation**
- [x] Aura de protection `max(1, {ability.cha})` sur `save` : +3 aux six sauvegardes d'un Paladin CHA 16 (test).
- [x] Barbare DEX 14 CON 16 sans armure : CA 15, 17 avec bouclier ; avec une armure de cuir, la base de l'armure (test). Moine : `ac.unarmored_no_shield` ignorée avec un bouclier (test).
- [x] Bénédiction : `save` reçoit le dé de bonus 1d4 sans changer le nombre affiché (test) ; un dé sur `ac` est refusé par Zod (test).
- [x] `ceil({class.level} / 2)d6` vaut 3d6 au niveau 5 ; aller-retour texte ↔ arbre exact (tests).

*Fait le 7 novembre.* `src/core/formula` : opérateur « dés » entre deux facteurs, nombre et taille évalués puis bornés, un dé refusé dans le nombre de dés (`diceFormula.test.ts`). `zModifier.value` : nombre ou formule, dé refusé hors cible de jet (`isRollTarget`). `characterSheet()` : formules résolues en trois temps (caractéristiques, reste, vitesses spéciales), dés de bonus (`dice` sur sauvegardes, tests, compétences), CA sans armure (catégorie d'armure portée par les objets équipés), sens, vitesses, maîtrises accordées, `rollModifiers` et `rollBonus()` (attaque, dégâts, critique), cible `{choice:<clé>}` (`sheetComputedValues.test.ts`, 13 tests). Catalogue `modifierTargets.ts` et libellés `fr.ts` étendus.

#### ☑ V3.1-156 — Les jets lancent les dés de bonus et lisent les nouvelles cibles · `M` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** — déroulé des jets côté serveur (règle 8).
**Dépend de** : 155.

**Sous-tâches Haiku** (`aide-haiku`) : recensement des sites de jet ; vérifications.

- `resolveAttackRoll`, `resolveCheckRoll`, `resolveDamageRoll` reçoivent les dés de bonus et la plage de critique ; le détail du jet liste chaque dé de bonus avec sa source.
- Câblage, un point par service, depuis la fiche du serveur jamais depuis le client : attaques d'arme et de sort (`characterActions`), tests et sauvegardes (`checkRolls`), sauvegardes demandées (`saveRequests`), sauvegardes des cibles d'une activation (`featureActivation`, `targetSaveBonus`), jets ciblés (`targetedRoll`), tour solo (`turnIntent`).
- `attack*` et `damage*` s'ajoutent selon le genre du jet (arme ou sort, caractéristique d'attaque, type de dégâts du sort).

**Critères d'acceptation**
- [x] Un personnage béni lance 1d20 + bonus + 1d4 en attaque et en sauvegarde ; le détail montre le d4 (test d'intégration).
- [x] Champion : un 19 naturel est un critique à l'arme, pas au sort (test).
- [x] Rage : +2 aux dégâts d'une attaque de Force, rien à l'arc (test).
- [x] Affinité élémentaire Feu : + mod. CHA aux dégâts d'un sort de feu, rien sur un sort de froid (test) — le critère reçu de V3.1-117.

*Fait le 7 novembre.* `resolveAttackRoll`, `resolveCheckRoll` et `resolveDamageRoll` ajoutent les dés de bonus à l'arbre du jet (lancés par le serveur, gardés dans l'historique ; doublés au critique pour les dégâts) et lisent la plage de critique. Câblés depuis la fiche du serveur : attaques et dégâts d'arme et de sort (`characterActions`, avec `rollBonus` : Rage par la caractéristique d'attaque, Affinité élémentaire par le type de dégâts du sort), tests, compétences et sauvegardes (`checkRolls`), sauvegardes demandées et des cibles (`targetSaveBonus` rend les dés d'un PJ ; le moteur des déclencheurs les lance pour une cible d'activation), tour solo (la demande en attente garde ses dés, lancés par le serveur à la résolution quelle que soit l'origine du d20). Les jets ciblés passent par `rollWeaponAttack` et en profitent. Tests : `actionBonusDice.test.ts`, `triggers.test.ts` (sauvegarde bénie), `bonusDice.integration.test.ts` 3/3 ; critiques et Affinité élémentaire testés au noyau (`sheetComputedValues.test.ts`). Intégration des services touchés : 63/63.

*Reste* : en mode « vrai dé de la table » d'une sauvegarde demandée, le joueur lance lui-même son d4 (le serveur ne l'ajoute pas).

#### ☑ V3.1-157 — L'écran : dés de bonus, sens, vitesses, maîtrises ; l'éditeur suit · `M` · sans modèle IA — **prêt (Sonnet)**

**Modèle conseillé : Sonnet**, une fois 155 fait ; Opus relit.
**Dépend de** : 155.

**Sous-tâches Haiku** (`aide-haiku`) : libellés ; planche du catalogue ; vérifications.

- Fiche : « +3 + 1d4 » et la source au survol, sur les sauvegardes, tests, compétences et l'onglet Actions ; sens et vitesses spéciales dans l'en-tête ou l'onglet Traits ; maîtrises accordées par une règle dans l'onglet Maîtrises, avec leur source.
- Éditeur de briques : les nouvelles cibles dans les listes ; « valeur » devient un champ de formule (dés permis selon la cible) ; « Modificateur temporaire » et « Avantage / désavantage » écrivent un **effet qui dure** porteur de modificateurs (ADR 0074), plus `apply_modifier`.
- Éditeur des modificateurs d'une fiche de règle (bloc `modifiers`) : même champ de formule.

**Critères d'acceptation**
- [x] Bénédiction se saisit à l'éditeur sans JSON (jusqu'à 3 cibles, concentration 1 minute, +1d4 aux attaques et sauvegardes) et se voit sur la fiche des cibles.
- [x] Au téléphone, « +3 + 1d4 » tient sur la ligne de la sauvegarde.

*Fait le 7 novembre* (codé par `dev-sonnet`, relu et corrigé par Opus). Fiche : dés de bonus et source au survol sur les sauvegardes, tests, compétences et l'onglet Actions (`lib/ui/valeursCalculees.ts`), ligne des sens et vitesses spéciales, maîtrises accordées avec leur source (`lib/ui/modificateursFiche.ts`). Éditeur : brique « Effet qui dure porteur de modificateurs » (`apply_boost`, un effet qui dure au sens de l'ADR 0074), champ de formule qui refuse les dés hors cible de jet, nouvelles cibles dans les listes ; formulaire de don en formule. Correctifs d'Opus : une valeur en formule se relit en texte dans le formulaire de don ; la fiche du navigateur reçoit les choix du personnage ; **la fiche ouverte avec sa page reçoit les effets portés** (défaut du 131 : une Bénédiction restait invisible jusqu'à la première action) ; **relancer un effet encore actif le rafraîchit** au lieu de l'empiler (deux Rages faisaient +6). Vérifié : Bénédiction saisie par l'éditeur (`briquesRegle.test.ts`), puis portée par un Barbare 9 au navigateur : « Sauv. +7 + 1d4 », attaque « 1d20+3+4+1d4 », Rage relancée par l'interface → une seule ligne d'effet, dégâts « 1d12+6 » ; à 390 px les sauvegardes « +7 + 1d4 » tiennent (aucune coupure, aucun débordement) ; `srdComputedValues.integration.test.ts` 5/5.

*Reste* : la fiche jouable du mode solo (`FicheJouableSolo`) et l'aperçu de l'assistant ne montrent pas encore les dés de bonus ; convertir une ancienne brique `apply_modifier` en `apply_boost` perd `source`, `layer` et `stacking` (valeurs par défaut reprises).

#### ☑ V3.1-158 — Les données : les règles du SRD que ce chantier rend jouables · `S` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** — données de règles officielles, import.
**Dépend de** : 155, 156.

**Sous-tâches Haiku** (`aide-haiku`) : vérifications et résumé des échecs.

- Dans `data/srd/playable-2024.json` et `modifiers-2024.json` (test de données comme au 133) : Rage (bonus de dégâts lu dans la table, avantage aux tests et sauvegardes de Force ; résistances et prolongation en `coverage`, 137), Aura de protection, Défense sans armure (Barbare, Moine), Critique amélioré, Bénédiction, Arme sacrée (« si on lâche l'arme » en `coverage`), Affinité élémentaire. Attaque sournoise, Inspiration bardique et Souffle reçoivent leurs dés en formule et un `coverage` honnête (135, 137).
- Réimport, scripts d'auteur rejoués.

**Critères d'acceptation**
- [x] Après réimport, Aura de protection, Défense sans armure, Critique amélioré, Bénédiction et Affinité élémentaire sont « Jouable » et se jouent sur une fiche de test. *Nuance* : Défense sans armure (Barbare, Moine) et Critique amélioré sont « Jouable » ; Aura de protection, Affinité élémentaire et Rage se jouent pour ce qu'ils ont de calculé et s'affichent « Partielle » (alliés à 3 m, résistances : V3.1-137) ; **Bénédiction et Arme sacrée ne se font pas ici** : un sort ne se joue pas encore comme une activation, et Arme sacrée s'ouvre « en prenant l'action Attaque » — reportés au chantier 136 (actions modifiées, lancer un sort). Le noyau les sait déjà (`sheetComputedValues.test.ts`, `bonusDice.integration.test.ts`).

*Fait le 7 novembre.* `modifiers-2024.json` : Défense sans armure (`ac.unarmored`, `ac.unarmored_no_shield`), Aura de protection (`save`, `max(1, {ability.cha})`), Critique amélioré (pour le badge de la fiche). `subclasses-2024.json` : Critique amélioré (l'effet), bonus de dégâts de l'Affinité élémentaire (`damage.spell.{choice:…}`). `playable-2024.json` : Rage (ressource selon la table, activation, effet qui dure : bonus de dégâts lu dans la table, avantage en Force) et `coverage` honnête (Rage, Aura, Affinité, Inspiration bardique avec sa ressource, Attaque sournoise). Noyau : un effet qui dure garde la règle qui l'a posé (`ruleKey`), ses formules lisent la table de la classe ; les choix du personnage passent à `characterSheet()` (serveur). Réimport fait (aucun échec), scripts d'auteur rejoués. Vérifié : `srdComputedValues.integration.test.ts` 5/5 (Barbare et Moine CA 15, Champion 19, Aura +3, Rage +3 et avantage).

*Reste* : Souffle du drakéide (zone, remplace une attaque : 136, 137) ; le dé d'Inspiration bardique attend 135.

### ☐ V3.1-135 — Intervenir sur un jet · `L` · sans modèle IA — **conçu le 7 novembre ([ADR 0075](../adr/0075-intervenir-sur-un-jet.md)), découpé en V3.1-159 à 162**
Réactions (une fenêtre de choix dans le déroulé d'un jet, côté serveur), opérations sur un jet en cours (ajouter ou soustraire un dé, relancer, fixer à 20, CA contre ce jet, diviser les dégâts), limite une fois par tour. Règles visées : 5, 9, 10, 19, 20, 27, 28, 33, 37, 39.

*Conçu le 7 novembre* : [ADR 0075](../adr/0075-intervenir-sur-un-jet.md). Deux choix de l'auteur : le **jet suspendu** (si quelqu'un peut réagir, le serveur fige le jet et attend les réponses ou « Continuer » du MJ ; sinon rien ne change) ; le moteur **compte** la réaction et le « une fois par tour » en combat. Découpé ci-dessous.

#### ☑ V3.1-159 — Le noyau : déclencheur de réaction, opérations sur le jet, une fois par tour · `M` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** — noyau du moteur. Tests d'abord.

- `playable.ts` : `trigger` (on `roll`, `roll`, `subject`, `when`, `natural`, `range`, `automatic`), `roll_operations` (sur l'activation et ses variantes : `add_die`, `reroll`, `set_natural`, `ac_bonus`, `damage_multiplier`, `add_damage`), `limit { per }`. Une opération incompatible avec le jet visé est refusée par Zod (`ac_bonus` hors attaque, `set_natural` sur des dégâts).
- `src/core/rules/rollWindow.ts`, pur : `PendingRoll` (genre, d20 et dés, modificateurs, total, CA ou DD, verdict, dégâts) ; `eligibleReactions(roll, candidats, usage)` (déclencheur, `requires`, ressources, réaction libre, limite) ; `applyRollOperations(roll, réponses ordonnées, rng)` qui refait le verdict par `attackVerdict` et la comparaison au DD ; `wouldChangeOutcome`.
- `turnUsage` : lecture et écriture de `{ reaction_spent, once }`, remise à zéro au début du tour du participant.

**Critères d'acceptation**
- [x] Tests : Chance relance un 1 sans fenêtre ; Indomptable relance une sauvegarde ratée avec + niveau ; Coup de chance change un test raté en 20 ; Esquive instinctive divise les dégâts ; Mots cinglants retire le dé à un jet ennemi et non allié ; Bouclier (`ac_bonus 5`) change une touche à 17 contre CA 15 en échec, et le dit (`wouldChangeOutcome`) ; une seconde réaction dans le round n'est pas éligible ; Attaque sournoise ne l'est qu'une fois par tour.

*Fait le 7 novembre.* `playable.ts` : `trigger`, `roll_operations` (activation et variantes), `limit` ; `rollOperationProblems` refuse une opération hors de propos dans la validation du bloc. `src/core/rules/rollWindow.ts` : `PendingRoll`, `outcomeOf` (par `attackVerdict`, plage de critique comprise), `eligibleReactions` (déclencheur, sujet vu du réacteur et de son camp, moment, `requires` via `requirementMet` exporté d'`activation.ts`, ressources, réaction du round, limite), `applyRollOperations` (ordre donné par l'appelant ; dégâts arrondis à l'inférieur après le facteur), `wouldChangeOutcome` (`null` dès qu'un dé décide), `zTurnUsage`, `recordUse`, `resetReaction`, `turnStamp`. `rollWindow.test.ts` : 17 tests. *Reste pour 161* : l'éditeur de briques ne sait pas encore écrire ni relire `trigger`, `roll_operations` et `limit`.

#### ☑ V3.1-160 — La migration et le service : le jet suspendu · `L` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** — migration, RLS, sécurité (signature).
**Dépend de** : 159.

- Migration : table `roll_windows` (campagne, combat, genre, auteur, cible, état figé signé, réactions possibles avec qui répond, réponses, statut, horodatages), RLS (lecture par l'auteur, les répondants et le MJ ; aucune écriture directe), `app.answer_roll_window` (sa propre réponse seulement ; « Continuer » pour le MJ), publication temps réel ; colonne `combat_participants.turn_usage`, remise à zéro au passage de tour ; changement signé (ADR 0041) étendu à `turn_usage`. `docs/SCHEMA.md`, `docs/SECURITE.md` §2.
- Service `rollWindows.ts` : ouvrir (signer l'état), répondre, reprendre (vérifier la signature, appliquer dans l'ordre, dépenser coûts et réactions, écrire les `rule_application`, appliquer la suite par changement signé). Branché dans `resolveTargetedRoll` (verdict, dégâts), `answerSaveRequest`, `rollAbilityCheck`/`rollSkillCheck`, `rollWeaponAttack`, et la boucle du solo (`pending_request` de genre `reaction`, budget de la scène).
- Routes : `GET /api/campaigns/[campaignId]/roll-windows`, `POST …/roll-windows/[windowId]/answer` (Zod).

**Critères d'acceptation**
- [x] Sans réaction possible, un jet s'applique comme avant (les tests existants passent sans changement).
- [x] Intégration, base réelle : un monstre touche un Roublard 5 → fenêtre ; « utiliser » Esquive instinctive → moitié des dégâts, réaction dépensée, seconde attaque du round sans fenêtre.
- [x] Une joueuse qui retouche l'état figé d'une fenêtre est refusée (signature) ; elle ne lit ni CA ni DD d'un adversaire.

*Fait le 7 novembre.* Migration `20261107120000_roll_windows` (appliquée et vérifiée) : `roll_windows` (partie lisible, sans écriture directe), `app_private.roll_window_states` (état figé, aucun droit client), `engine_open_roll_window` et `engine_resume_roll_window` (demandes signées ; reprise par l'auteur seulement, une fois), `answer_roll_window`, `close_roll_window`, `combat_participants.turn_usage`, `apply_engine_change` étendu à `turn_usage`, publication temps réel. **Écart avec l'ADR** : l'état figé n'est pas signé dans la ligne, il n'est simplement jamais accessible à un client ; et la reprise est faite par l'auteur du jet (avec ses droits d'aujourd'hui), pas par le dernier à répondre. Le compte de la réaction est daté et son retour calculé (aucune remise à zéro au passage de tour). Service : `rollWindows.ts` (ouverture, ceux qui peuvent réagir), `rollWindowResume.ts` (réponse, « Continuer », reprise : chaque réaction jouée par `activateFeature`, puis `resolveTargetedRoll` rejoué avec le jet modifié) ; `actorNumbers.ts` partagé avec l'activation au clic. Routes `GET …/roll-windows`, `POST …/roll-windows/[windowId]` (`answer`, `continue`, `resume`). Vérifié : `rollWindows.integration.test.ts` 3/3. Docs : `SCHEMA.md`, `SECURITE.md` (registre), `ARCHITECTURE.md`.

*Reste* : seuls les jets ciblés (attaque, dégâts) passent par le point de décision. Les sauvegardes demandées, les tests, l'attaque sans cible et la boucle du solo : V3.1-163.

#### ☐ V3.1-163 — Les autres jets passent par la fenêtre : sauvegardes, tests, attaque sans cible, solo · `M` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** — déroulé des jets côté serveur.
**Dépend de** : 160.

- `answerSaveRequest` : point de décision après le d20 de la sauvegarde (Indomptable, Inspiration bardique reçue, Mots cinglants du MJ sur un monstre… seulement les PJ). La reprise rejoue la réponse avec le jet modifié.
- `rollAbilityCheck`, `rollSkillCheck` : idem (Coup de chance, Chance). Hors combat : rien n'est compté.
- `rollWeaponAttack` sans cible : seulement les réactions sur son propre jet (Chance, automatique ; les autres n'ont pas d'issue sans CA).
- La boucle du solo : `pending_request` de genre `reaction`, budget de la scène, portée lue dans les zones.
- `zRollWindowState.origin` gagne `save`, `check`.
- Reçu du 162 : les activations des aptitudes de sous-classe (Mots cinglants, `lore-cutting-words` : deux activations, dégâts lancés et attaque qui touche, `add_die` négatif du dé `column.class_specific_bardic_inspiration_die`, portée 18 m) et des traits d'espèce (Chance, `luck` : automatique, relance d'un 1) arrivent sur la fiche ; une activation accordée par un jeton (le dé d'Inspiration bardique) est candidate à une réaction. Les formules d'une réaction lisent aussi les colonnes de la classe (`column.*`), comme les ressources.

**Critères d'acceptation**
- [ ] Intégration : Guerrier 9 rate une sauvegarde demandée → fenêtre ; Indomptable → relance + 9, usage dépensé.
- [ ] Chance (automatique) relance un 1 naturel sur un test sans fenêtre.
- [ ] Solo : une réaction se propose dans le tour, et le budget de la scène la compte.


#### ☐ V3.1-161 — Les écrans : le bandeau de réaction ; l'éditeur suit · `M` · sans modèle IA — **prêt (Sonnet)**

**Modèle conseillé : Sonnet**, une fois 160 fait ; Opus relit.
**Dépend de** : 160.

**Sous-tâches Haiku** (`aide-haiku`) : libellés ; planche du catalogue ; vérifications.

- Bandeau de réaction (joueuse, MJ, solo) : le jet, la règle, « changerait l'issue », « Utiliser » / « Passer » ; « Continuer » pour le MJ ; pastille du dé encoché. Sur le canal unique de `SauvegardesProvider` (docs/CABLAGE.md).
- Éditeur de briques : un déclencheur « En réaction à un jet » et les opérations sur le jet ; la limite « une fois par tour ».

**Critères d'acceptation**
- [ ] Au téléphone, le bandeau tient à 390 px, ses deux boutons au pouce.
- [ ] Esquive instinctive se saisit à l'éditeur sans JSON.

#### ☑ V3.1-162 — Les données : les réactions du SRD · `S` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** — données officielles, import.
**Dépend de** : 159, 160.

- `playable-2024.json` : Esquive instinctive, Mots cinglants, Chance (halfelin), Indomptable, Coup de chance, l'usage du dé d'Inspiration bardique (jeton), Attaque sournoise (au choix sur une touche, une fois par tour). Bouclier attend 136 (un sort joué comme une activation). Réimport, scripts d'auteur rejoués.

**Critères d'acceptation**
- [x] Après réimport, ces règles sont « Jouable » (ou « Partielle » pour la seule portée, jusqu'au 137) et se jouent sur une fiche de test. *Nuance ci-dessous.*

*Fait le 7 novembre.* `playable-2024.json` : Esquive instinctive (réaction, moitié des dégâts ; « Partielle » : « que vous voyez » attend 138), Attaque sournoise (au choix sur ses dégâts, `ceil(niveau / 2)d6`, une fois par tour ; « Partielle » : les conditions d'arme, d'avantage et d'allié au contact attendent 137, la joueuse choisit), Inflexible (ressource 1 → 2 → 3 selon le niveau, relance + niveau de Guerrier) et Coup de chance (un test d20 raté devient 20) — ces deux-là « Jouable », mais ne se déclenchent qu'avec V3.1-163 (sauvegardes et tests). Réimport fait (une relance après un délai dépassé de la base), scripts d'auteur rejoués. Vérifié : `srdReactions.integration.test.ts` 4/4 (les deux réactions sur la fiche d'une Roublarde 5, Esquive instinctive divise les dégâts d'un gobelin, Attaque sournoise ajoute 3d6 une fois par tour, couvertures).

*Reste, passé au V3.1-163* : **Mots cinglants** (une aptitude de sous-classe n'arrive sur la fiche que si elle porte modificateurs ou sorts : `subclassFeatures` ne lui attache pas son bloc d'activation), **Chance** du halfelin (trait d'espèce, même vérification à faire), et **le dé d'Inspiration bardique** reçu (une activation accordée par un jeton n'est pas encore candidate à une réaction). Bouclier attend 136.

### ☐ V3.1-136 — Les actions modifiées · `M` · sans modèle IA — **à concevoir (Opus)**
Attaques multiples, action disponible en action bonus, temps d'incantation changé, attaque remplacée, budget réservé à un usage, accorder ou lancer un sort comme effet. Règles visées : 7, 13, 14, 16, 21, 24, 32, 33, 35, 39.


*Reçu de V3.1-158 (7 novembre)* : Bénédiction (un sort joué comme une activation : jusqu'à 3 cibles, concentration, + 1d4 aux attaques et aux sauvegardes — le noyau le sait déjà) et Arme sacrée (« en prenant l'action Attaque », + mod. CHA aux attaques de l'arme).
### ☐ V3.1-137 — Les conditions de jeu et les distances réelles · `L` · sans modèle IA — **à concevoir (Opus)**
Distances en mètres entre créatures (ADR 0059 §5), zones géométriques, auras, résistances et immunités, conditions sur l'équipement, règles qui en modifient d'autres, étiquettes d'arme sur `attack_hit`. Règles visées : 2, 3, 10, 12, 13, 17, 18, 24, 25, 26, 29, 32, 33, 36.

*Reçu de V3.1-117 (13 octobre)* : les résistances choisies (Affinité élémentaire, Résilience fiélonne, héritages fiélons). Critère : « Affinité élémentaire Feu : résistance appliquée (test) ».

### ☐ V3.1-138 — Le modèle du monde · `L` · sans modèle IA — **à concevoir (Opus)**
Perception et visibilité (invisible, caché, sens), lumière, étiquettes de magie (divination, capteurs), immunités et restrictions de ciblage, et les cas uniques : transformation, invocation, PV temporaires en effet (sur V3.1-24), redirection, jauge qui monte, recharge sur événement, quantité choisie, consommables, choix contraints pour les règles ouvertes. Règles visées : 8, 15, 16, 22, 29, 34, 35, 38.


*Reçu de V3.1-134 (7 novembre, choix de l'auteur, ADR 0074)* : la lumière émise par une créature ou un objet (Aasimar, Arme sacrée) — une cible de modificateur qui n'a de sens qu'avec la lumière par zone de ce chantier.
### ☐ V3.1-139 — L'inventaire et la couverture du SRD · `L` · sans modèle IA — **après la fondation**
Mesurer la couverture de tout ce qui entre en jeu (sorts, aptitudes, espèces, dons, objets magiques, monstres avec leurs actions et traits), lister les lacunes par brique, et tenir le compte jusqu'à 100 %.

### ☐ V3.1-140 — La conversion assistée : du texte aux briques · `L` · **avec modèle IA** — **après la fondation**
Le modèle lit le texte d'une fiche et propose des blocs (`resources`, `activation`, `coverage`), par `ai_proposals` : Zod, validation métier, relecture par l'auteur, application. Jamais d'écriture directe (règle absolue 9). Le texte de la règle entre dans le prompt comme donnée encadrée (règle 10).

### ☐ V3.1-141 — Le système monétaire en données : pièces courantes, réserve, pièces maison · `M` · sans modèle IA — **à concevoir (Opus)**

**Modèle conseillé : Opus** : forme d'un bloc de règle, forme du porte-monnaie, compatibilité des inventaires déjà enregistrés.

**Origine (auteur, 13 octobre).** La monnaie se compose désormais en or, argent et cuivre ; le platine et l'électrum sont une réserve, jamais formés, gardés, cassés seulement au besoin (l'électrum d'abord, au plus juste). C'est codé en dur dans `src/core/rules/currency.ts` (`COMMON_COINS`, `RESERVE_BREAK_ORDER`). L'auteur veut pouvoir le régler sans code, et ajouter des pièces propres à un monde. C'est l'esprit de l'ADR 0059 : une règle de jeu vit dans les données.

**Proposition à trancher par l'ADR**
- **Un bloc de règle typé** « système monétaire », porté par la fiche « Pièces de monnaie » (`standard-exchange-rates`, SRD 5.2.1). Pour chaque pièce : sa clé, son libellé (fr, en), sa valeur en pièces de cuivre, et son rôle, *courante* (elle se regroupe) ou *réserve* (gardée, cassée au besoin) ; plus l'ordre de casse des réserves.
- **Le comportement par défaut** reste celui du 13 octobre : rien ne change pour un ruleset qui ne porte pas le bloc.
- **Pour le modifier** : une surcharge dans un ruleset personnel. Les règles officielles ne se modifient jamais (règle absolue 18).
- **Le moteur** (`depositCoins`, `spendCoins`, `applyCurrencyDelta`, `totalValueCp`) reçoit le système en paramètre au lieu de ses constantes ; le service le lit par la chaîne de rulesets de la campagne.

**La partie lourde : des pièces maison.** Aujourd'hui le porte-monnaie a cinq cases fixes (`pp`, `gp`, `ep`, `sp`, `cp`). Elles sont dans le schéma du bloc `inventory`, dans `InventoryPanel`, dans les statistiques d'économie de campagne (`totalValueCp`, V2-M12) et dans la route `actions/currency`. Une pièce maison demande un porte-monnaie en liste libre (clé → nombre). Les inventaires déjà enregistrés doivent se relire sans erreur, sans migration SQL (le bloc est du `jsonb`, seule sa forme Zod change). À trancher : garder les cinq clés connues et accepter des clés en plus, ou passer tout le porte-monnaie en dictionnaire.

**Découpage probable** : ADR ; noyau paramétré (tests d'abord, les 28 tests de `currency.test.ts` restent verts avec le système par défaut) ; bloc de règle et sa lecture ; pièces maison ; écran.

**Critères d'acceptation (de la conception)**
- [ ] ADR écrit : forme du bloc, forme du porte-monnaie, compatibilité des inventaires existants.
- [ ] Tickets prêts découpés et ajoutés à l'index.

