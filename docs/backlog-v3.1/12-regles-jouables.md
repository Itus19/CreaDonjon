# Les règles jouables (V3.1-129 à 140)

*Toute règle d'un ruleset en jeu est jouable à 100 % par le moteur, sans qu'un modèle lise la règle (ADR 0059). Étude et découpage : [`docs/etude-regles-jouables.md`](../etude-regles-jouables.md). Forme des données de la fondation : [ADR 0060](../adr/0060-la-fondation-des-regles-jouables.md). Esquisse : planches « Esquisse · Règle jouable » du canevas de la refonte (https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm).*

*Partie du backlog V3.1. L'index, la feuille de route et la table de tous les tickets : [`docs/BACKLOG_V3.1.md`](../BACKLOG_V3.1.md).*

**Ordre.** 129 → 130 → 131 et 132 → 133 forment la **fondation**. 134 à 138 sont les cinq autres chantiers : chacun se conçoit (ADR) avant de se découper, dans l'ordre de l'étude. 139 et 140 viennent quand la fondation tient.

**Critère commun à toute la partie.** Le moteur reste jouable sans IA (`docs/backlog-v3/00-cadre.md` §3) : aucun ticket de 129 à 139 n'appelle de modèle. Les dés sont lancés par le serveur (règle absolue 8).

---

## La fondation (ADR 0060)

### ☐ V3.1-129 — Le noyau : ressources déclarées, activation, effets qui durent · `L` · sans modèle IA — **prêt (Opus)**

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

### ☐ V3.1-130 — La migration et le service `activateFeature` · `M` · sans modèle IA — **prêt (Opus)**

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

### ☐ V3.1-131 — La fiche jouable : un bouton par activation · `M` · sans modèle IA — **à décider (esquisse)**

**Modèle conseillé : Sonnet**, une fois les planches « Esquisse · Règle jouable » passées en « Décidé ».
**Dépend de** : 130.

**Sous-tâches Haiku** (`aide-haiku`) : libellés dans `messages/` ; planche du catalogue ; vérifications.

- Onglet Actions : les ressources calculées (avec leur recharge), une carte par activation avec son coût, ses variantes, le choix des cibles et le résultat ; les effets actifs et les jetons du personnage. Le bouton « utiliser » des compteurs manuels reste pour les compteurs `custom`.
- `docs/CABLAGE.md` : aucun chargement de plus à l'ouverture de la fiche (les activations viennent avec les fiches de règles déjà chargées).

**Critères d'acceptation**
- [ ] Les trois écrans de l'esquisse, une fois décidés, se retrouvent sur la fiche.
- [ ] Une activation se joue au téléphone sans perdre le fil de la fiche.

---

### ☐ V3.1-132 — L'éditeur de briques et l'état de couverture · `L` · sans modèle IA — **à décider (esquisse)**

**Modèle conseillé : Sonnet** pour l'interface, une fois l'esquisse décidée ; Opus relit la validation.
**Dépend de** : 129.

**Sous-tâches Haiku** (`aide-haiku`) : libellés ; planche du catalogue ; vérifications.

- Sur une fiche de règle modifiable : édition des blocs `resources`, `activation` (coût, cibles, effets imbriqués, variantes, effets qui durent) et `coverage`, par listes déroulantes et champs de formule — jamais un champ JSON libre. Le texte de la règle reste à côté, avec le passage dont vient chaque brique.
- Badge de couverture sur la fiche (jouable, partielle, non évaluée) ; vue « règles non jouables » d'un ruleset.
- Le mode solo avertit avant qu'une fiche non jouable n'entre en jeu (ADR 0059 §3).

**Critères d'acceptation**
- [ ] Abjuration d'ennemis se saisit entièrement depuis l'éditeur, sans JSON, et se joue sur la fiche.
- [ ] Une règle officielle ne se modifie pas : l'éditeur crée la surcharge dans le ruleset personnel (règle absolue 18).

---

### ☐ V3.1-133 — Les données : le quotidien du SRD rendu jouable · `M` · sans modèle IA — **prêt (Opus)**

**Modèle conseillé : Opus** — données de règles officielles, import.
**Dépend de** : 129.

**Sous-tâches Haiku** (`aide-haiku`) : vérifications et résumé des échecs.

- Les ressources et activations des règles 1, 6 et 8 de l'étude (Second souffle, Sursaut d'action, Abjuration d'ennemis), plus Conduit divin, en données SRD importées par `ingest-srd` (même motif que `data/srd/triggers-2024.json`, ADR 0050).
- Les règles qui demandent un chantier suivant reçoivent un bloc `coverage` honnête plutôt qu'une activation incomplète.

**Critères d'acceptation**
- [ ] Après réimport, les trois règles sont « jouables » et se jouent sur une fiche de test (`docs/TESTS.md`, comptes de test).

---

## Les chantiers suivants (à concevoir)

Chacun commence par un ADR, puis se découpe en tickets prêts. Les règles visées viennent de l'étude.

### ☐ V3.1-134 — Les valeurs calculées · `M` · sans modèle IA — **à concevoir (Opus)**
Valeur de modificateur en formule ou en dé (+ mod. CHA, +1d4, 10 + DEX + CON), nombre et taille des dés en formule dans l'AST, nouvelles cibles (`crit_range`, sens, vitesses, lumière, maîtrises). Règles visées : 2, 3, 5, 11, 12, 13, 23, 24, 25, 32.

*Reçu de V3.1-117 (13 octobre)* : le bonus de dégâts de l'Affinité élémentaire (+ mod. CHA à un jet de dégâts d'un sort du type choisi). Critère : « Affinité élémentaire Feu : bonus de dégâts appliqué (test) ». Le type choisi est déjà enregistré (`<sous-classe>.elemental-affinity.damage-type`).

### ☐ V3.1-135 — Intervenir sur un jet · `L` · sans modèle IA — **à concevoir (Opus)**
Réactions (une fenêtre de choix dans le déroulé d'un jet, côté serveur), opérations sur un jet en cours (ajouter ou soustraire un dé, relancer, fixer à 20, CA contre ce jet, diviser les dégâts), limite une fois par tour. Règles visées : 5, 9, 10, 19, 20, 27, 28, 33, 37, 39.

### ☐ V3.1-136 — Les actions modifiées · `M` · sans modèle IA — **à concevoir (Opus)**
Attaques multiples, action disponible en action bonus, temps d'incantation changé, attaque remplacée, budget réservé à un usage, accorder ou lancer un sort comme effet. Règles visées : 7, 13, 14, 16, 21, 24, 32, 33, 35, 39.

### ☐ V3.1-137 — Les conditions de jeu et les distances réelles · `L` · sans modèle IA — **à concevoir (Opus)**
Distances en mètres entre créatures (ADR 0059 §5), zones géométriques, auras, résistances et immunités, conditions sur l'équipement, règles qui en modifient d'autres, étiquettes d'arme sur `attack_hit`. Règles visées : 2, 3, 10, 12, 13, 17, 18, 24, 25, 26, 29, 32, 33, 36.

*Reçu de V3.1-117 (13 octobre)* : les résistances choisies (Affinité élémentaire, Résilience fiélonne, héritages fiélons). Critère : « Affinité élémentaire Feu : résistance appliquée (test) ».

### ☐ V3.1-138 — Le modèle du monde · `L` · sans modèle IA — **à concevoir (Opus)**
Perception et visibilité (invisible, caché, sens), lumière, étiquettes de magie (divination, capteurs), immunités et restrictions de ciblage, et les cas uniques : transformation, invocation, PV temporaires en effet (sur V3.1-24), redirection, jauge qui monte, recharge sur événement, quantité choisie, consommables, choix contraints pour les règles ouvertes. Règles visées : 8, 15, 16, 22, 29, 34, 35, 38.

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

