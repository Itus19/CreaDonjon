# Backlog V1 — Le compagnon jouable

**Version :** 1.0 — 30 juillet 2026
**Établi à partir de :** dépôt `Itus19/CreaDonjon`, commit `fe3736a` (V0-07)
**Documents liés :** `SCHEMA.md` · `specs/regles-couche.md` · `specs/regles-blocs.md` · `specs/wiki-liens-et-personnages.md` · `specs/wiki-blocs.md`

---

## 0. État constaté

La V0 est terminée. Ce qui existe et fonctionne :

| Brique | État |
|---|---|
| Authentification, mondes, entités, slugs, routage `/m/[monde]/f/[fiche]` | fait |
| Blocs `text`, `infobox`, `image`, `custom_table` avec schémas Zod | fait |
| Segments en nœuds typés, marques, références, caviardage | fait |
| Relations en bande d'en-tête | fait |
| Recherche, arborescence, coquille, jetons de design | fait |
| Partage anonyme en lecture seule | fait |
| Couches `src/core` → `services` → `repos` respectées | fait |

Les modifications d'apparence apportées à la main sont acquises : **le code fait foi désormais, pas `specs/coquille-et-design.md`**, qui redevient une référence d'intention. Ne pas laisser Claude Code « corriger » l'apparence pour se conformer au document.

---

## 1. Dette à solder avant d'ouvrir la V1

### D-01 — Le contournement de RLS de la page publique · `M` · **prioritaire**

`app/partage/[token]/**` résout le jeton par une fonction `security definer` bornée — c'est correct — puis lit les entités et les blocs avec `createShareLinkServiceClient()`, c'est-à-dire la clé `service_role`.

Cette clé contourne **toute** la RLS. La seule chose qui empêche une fuite est alors le filtrage applicatif de `getPublicEntityDetail`. Le code réutilise `filterBlocks` / `filterSegments`, ce qui est le bon choix — un seul endroit où une visibilité peut fuir. Mais cela inverse le principe posé au §4.2 de `SCHEMA.md` : *la RLS est le dernier filet, pas la seule défense.* Ici, il n'y a pas de filet.

Ce n'est pas à réécrire. C'est à **doter du filet manquant** :

- [ ] Un test d'intégration qui crée un monde avec un bloc `public` et un bloc `gm`, génère un lien, appelle la route publique, et vérifie que la chaîne du bloc `gm` est **absente de la réponse HTTP brute** — pas de l'écran, de la réponse.
- [ ] Le même test pour un segment `gm` à l'intérieur d'un bloc public.
- [ ] Le client `service_role` est confiné à `src/server/services/publicShare.ts`. Une règle ESLint interdit son import ailleurs.
- [ ] Un commentaire en tête de `service.ts` rappelant pourquoi cette exception existe et ce qu'elle exige.

Sans ce test, une modification future de `getPublicEntityDetail` peut ouvrir une fuite totale sans que rien n'échoue.

### D-02 — Deux mécanismes qui se ressemblent, un seul est de la sécurité · `S`

Le code possède maintenant :

| Mécanisme | Nature | Où il agit |
|---|---|---|
| marque `spoiler` sur un nœud | **mise en forme** — texte envoyé au client, masqué en CSS, révélé au clic | effet de style, comme sur Discord |
| `visibility_level` d'un bloc ou d'un segment | **sécurité** — jamais envoyé au client non autorisé | filtrage serveur |

Les deux se ressemblent à l'écran. La confusion est facile et coûteuse : quelqu'un — ou un agent de codage — peut un jour croire que `spoiler` protège un secret de MJ.

- [ ] Le nommer explicitement dans `CLAUDE.md` : *`spoiler` est de la mise en forme, jamais de la sécurité. Un secret de MJ passe par `visibility_level`, jamais par une marque.*
- [ ] Le rendre visible dans l'interface : les deux ne doivent pas se ressembler. Le caviardage MJ porte le liseré terracotta ; le spoiler est neutre.

### D-03 — Documents obsolètes à la racine · `S`

`Phase0_Schema_Technique_v0_1.md` et `Project_Design_Document_v0.1.md` sont encore à la racine, alors que `docs/` contient les versions à jour. Un agent de codage qui tombe sur la v0.1 lira un schéma dont la visibilité est une chaîne encodée et dont les segments portent `text` au lieu de `content`.

- [ ] Supprimer les deux fichiers de la racine (l'historique Git les conserve).
- [ ] Vérifier que `docs/` contient bien les versions courantes de tous les documents.
- [ ] Réconcilier `ROADMAP.md` et `docs/BACKLOG.md` : un seul des deux fait autorité.
- [ ] Remplacer le `README.md` de `create-next-app` : installation, commandes, où trouver quoi, `NOTICE.md` d'attribution SRD.

### D-04 — Vérifier l'import SRD · `S`

`srd-2014.json` et `srd-2024.json` sont à la racine du dépôt. Avant d'attaquer le lot A :

- [ ] L'import a-t-il été exécuté et les rulesets officiels existent-ils en base ?
- [ ] `ruleset_entries.source_raw` existe-t-il et contient-il le JSON d'origine ? (recommandé au §1 de `specs/outils-mj.md` — sans lui, tout champ non encore transformé exigera un réimport)
- [ ] `NOTICE.md` contient-il le texte d'attribution exact des deux SRD ?
- [ ] Déplacer les deux JSON dans `data/srd/` — ils n'ont rien à faire à la racine.

---

## 2. Principe de séquencement de la V1

> **Le moteur avant l'écran, la verticale avant la largeur.**

Trois erreurs à éviter, dans l'ordre de probabilité :

1. **Construire l'interface de règles avant le moteur de résolution.** On obtient alors un affichage qui court après une logique instable.
2. **Faire les douze types de blocs de règles d'un coup.** Cinq suffisent pour un sort et une classe. Le reste attendra un besoin réel.
3. **Ouvrir les campagnes à des joueurs tiers avant la RLS fine.** `SCHEMA.md` §19.2 le dit : le filtrage MJ/joueur repose sur la couche service jusqu'au lot C. Tant qu'il n'est pas descendu en RLS, l'usage reste personnel.

Quatre lots, dans cet ordre. **Chacun se termine par quelque chose de montrable.**

---

## Lot A — Consulter les règles

*Objectif : ouvrir une fiche de sort et une fiche de classe, propres, reliées entre elles, et les personnaliser.*

### V1-A1 — Blocs de règles et rendu · `L`

Cinq types de blocs, pas douze. Spécification : `specs/regles-blocs.md`.

- Table `ruleset_entry_blocks` (migration).
- Schémas Zod : `description`, `spell_casting`, `effects`, `scaling`, `class_progression`, `custom_table`.
- Les dix primitives du §3 dans `src/core/schemas/primitives.ts` — `Quantity`, `Formula`, `Reference`, `Duration`, `Range`, `Area`, `Choice`, `Modifier`, `Grant`, `Localized`.
- Composants de mise en page : `key_values`, `progression_table`, `formula_list`, `prose`, `chips`, `table`. **Un par mise en page, jamais un par type de bloc.**
- Routage `/m/[monde]/regles/[cle]`.

**Critères**
- [ ] Une fiche de sort affiche paramètres, effets et montée en puissance.
- [ ] Une fiche de classe affiche sa table de progression, colonnes déclarées et lignes en données.
- [ ] La colonne « bonus de maîtrise » est **calculée par formule**, pas saisie vingt fois.
- [ ] Le bloc `scaling` engendre la table complète des niveaux d'emplacement à partir de sa règle — le moteur consomme la règle, l'affichage consomme la table engendrée.
- [ ] Un `entry_type` auquel il manque un bloc requis est signalé sur la fiche, pas rejeté.

### V1-A2 — Conversion de l'import SRD vers les blocs · `L`

Le script d'import produit désormais des blocs, plus un objet plat.

- [ ] Import idempotent : rejouer donne le même état.
- [ ] Les sorts produisent `description`, `spell_casting`, `effects`, et `scaling` quand il y a montée en puissance.
- [ ] Les classes produisent `class_progression`.
- [ ] Un rapport de conversion en fin de script : combien d'entrées par type, combien de blocs, combien d'échecs — et **les échecs sont listés**, pas avalés.
- [ ] Aucun contenu hors SRD.

### V1-A3 — Graphe de renvois · `M`

- Table `ruleset_entry_refs`, extracteur pur dans `src/core/rules/refs.ts`.

**Critères**
- [ ] Les renvois `derived` sont recalculés à chaque écriture ; les `declared` ne sont jamais touchés.
- [ ] Une fiche affiche ses renvois sortants **et** entrants.
- [ ] Un renvoi surligne le chemin exact dans la structure quand on le suit.
- [ ] `target_key` résout vers la version surchargée du ruleset courant, pas vers l'entrée d'origine.

### V1-A4 — Surcharge et variantes · `L`

- Table `ruleset_overrides`, résolution pure dans `src/core/rules/resolve.ts`.

**Critères**
- [ ] « Chez moi la boule de feu fait 6d6 » est un `patch_block` sur `effects` ; le reste de la fiche suit toujours sa base.
- [ ] Chaîne d'héritage : profondeur maximale 8, cycles détectés, erreur explicite.
- [ ] Un ruleset publié est figé : toute édition crée `version + 1` avec le même `lineage_id`.
- [ ] Un badge « modifiée dans ta variante » ouvre la comparaison avec l'original.
- [ ] Les rulesets officiels restent inviolables (le trigger le prouve par un test).

---

## Lot B — Le personnage

*Le morceau difficile. Objectif : créer un personnage jouable et afficher sa fiche.*

### V1-B1 — Le moteur de fiche dérivée · `L` · **écrire les tests d'abord**

Entièrement dans `src/core/rules/sheet.ts`. Ni base, ni réseau. Spécification : `specs/wiki-liens-et-personnages.md` partie B.

- Les sept couches de modificateurs et leurs règles d'empilement (§B4).
- `characterSheet(build, ruleset, equipment, activeEffects): DerivedSheet`.
- Chaque valeur dérivée porte sa provenance.

**Critères** — les six cas dorés du §B7, un test chacun :
- [ ] Guerrier nain niveau 1, cotte de mailles + bouclier : couches 1 à 6, empilement de CA.
- [ ] Roublard niveau 5 avec expertise.
- [ ] Magicien niveau 3 : DD de sort, emplacements, caractéristique d'incantation.
- [ ] Guerrier 5 / roublard 2 : multiclassage, clés de choix qualifiées.
- [ ] Sous *bénédiction* et *entravé* : couche 7, avantage et désavantage s'annulent.
- [ ] Prérequis non satisfait : avertissement présent, enregistrement autorisé.
- [ ] La fonction n'importe rien de `next`, `react` ni `@supabase` (la règle ESLint le prouve).
- [ ] Couverture > 90 %.

> **C'est la fonction la plus dense du projet et la première cause de bugs de tout créateur de personnage jamais écrit.** Si un seul module mérite des tests écrits avant le code, c'est celui-là.

### V1-B2 — Blocs de personnage · `L`

`character`, `inventory`, `spellcasting`, `resources`, `statblock`. Spécification : `specs/wiki-blocs.md` §4.

**Critères**
- [ ] Le bloc `character` ne stocke que le build : espèce, classe, niveau, caractéristiques, choix. Aucune valeur dérivée en base.
- [ ] L'inventaire accepte les trois natures : référence de règle, référence d'entité, objet en ligne.
- [ ] `statblock` permet un PNJ ou une créature **sans build** — personne ne construira un gobelin niveau par niveau.
- [ ] Décocher « équipé » sur une armure recalcule la CA sans rechargement de page.
- [ ] Chaque référence porte son lien : capacités, armes, sorts, dons mènent à leur fiche de règle.

### V1-B3 — État de jeu · `M`

Table `entity_runtime_state`.

**Critères**
- [ ] Points de vie, ressources, conditions, expérience, hors du bloc `character`.
- [ ] Le même personnage dans deux campagnes a deux états distincts.
- [ ] Une mutation de jeu écrit un `session_event`, **jamais** une `entity_revision` (`specs/wiki-blocs.md` §4.5).

### V1-B4 — Parcours de création · `L`

**Critères**
- [ ] L'étape « choix restants » est une **liste, pas un tunnel** : on peut revenir sur un choix jusqu'au bout.
- [ ] La fiche se recalcule à chaque modification.
- [ ] Un personnage illégal reste enregistrable, avec un bandeau explicite. On avertit, on n'interdit pas.
- [ ] La CA affiche sa décomposition, pas un nombre nu.

---

## Lot C — Campagnes et permissions

*Objectif : plusieurs personnes autour d'un monde, chacune voyant ce qu'elle doit voir.*

### V1-C1 — Campagnes · `M`

`campaigns`, `campaign_members`, `campaign_characters`, `campaign_entity_snapshots`.

- [ ] Une campagne épingle une version précise de ruleset.
- [ ] Le groupe de joueurs est une entité `faction` créée avec la campagne.
- [ ] Inviter un joueur, lui attribuer un personnage.

### V1-C2 — RLS fine · `L` · **le verrou de l'ouverture publique**

Descendre la résolution de visibilité dans les politiques Postgres, en gardant le filtrage service.

**Critères**
- [ ] Un joueur ne lit aucun bloc `gm`, testé avec deux clients Supabase distincts, jamais `service_role`.
- [ ] Un joueur de la campagne A ne lit rien de la campagne B du même monde.
- [ ] Un bloc `campaign` n'est visible que des membres de cette campagne.
- [ ] La table de vérité de `src/core/visibility` et les politiques RLS donnent **le même résultat** sur les 30 cas — test comparatif automatisé.
- [ ] Aucune récursion sur `campaign_members`.

> Jusqu'à ce ticket, l'application reste à usage personnel. C'est un choix de séquencement assumé, écrit depuis la Phase 0.

### V1-C3 — Historique du wiki · `M`

`entity_revisions`.

- [ ] Chaque enregistrement rédactionnel crée une révision avec sa source.
- [ ] Comparer deux révisions, restaurer une version.
- [ ] Les mutations de jeu n'y apparaissent pas.

---

## Lot D — Première assistance IA

*Objectif : mesurer les coûts réels avant de concevoir le mode solo.*

### V1-D1 — Instrumentation et garde-fous · `M` · **avant tout appel**

- [ ] `ai_usage_log` écrit à **chaque** appel, sans exception.
- [ ] Limitation de débit par utilisateur sur les routes IA.
- [ ] Clés API serveur uniquement, jamais derrière `NEXT_PUBLIC_`.
- [ ] Le contenu de wiki inséré dans un prompt est encadré comme **donnée**, avec consigne d'ignorer toute instruction qu'il contiendrait.

### V1-D2 — Éditeur de règle assisté · `L`

Le « codeur accompagnant » de `specs/regles-couche.md` §5.

- [ ] Le modèle propose des blocs par appel d'outil, jamais du JSON extrait de prose.
- [ ] Échec de validation → deux tentatives, puis formulaire vide rendu à l'utilisateur.
- [ ] **L'utilisateur ne voit jamais de JSON** : formulaire engendré depuis le schéma Zod.
- [ ] Bac à sable avec trace : `1d8 (6) + FOR (+3) = 9 dégâts tranchants`.
- [ ] Une règle générée ne peut modifier qu'une variante, jamais une base officielle.

### V1-D3 — Assistance rédactionnelle · `M`

- [ ] Toute mutation passe par `ai_proposals` : Zod, validation métier, application transactionnelle.
- [ ] Le modèle ne peut référencer que des identifiants fournis dans le contexte du tour.
- [ ] Budget de propositions par tour ; au-delà, rejet et journalisation.

### V1-D4 — Relevé de coûts · `S`

- [ ] Remplir la colonne « mesuré » du tableau de `PDD.md` §32.
- [ ] Coût d'une génération de PNJ, d'une structuration de règle, d'une aide rédactionnelle.
- [ ] Décider du modèle économique et le consigner en §23 du PDD.

> Tant que ce tableau est vide, toute discussion sur le modèle économique est spéculative — et le mode solo se conçoit sans savoir ce qu'il coûte.

---

## 3. Critère de fin de V1

Le même que celui du PDD, à vérifier avec quelqu'un d'autre que vous :

> Un MJ prépare une session complète — 5 PNJ, 3 lieux, 1 rencontre — sans quitter l'application, en moins de 45 minutes.

Et un critère technique, non négociable :

> Ouvrir l'application à un joueur tiers exige que **V1-C2 soit terminé**.

---

## 4. Ordre recommandé

```
D-01 … D-04          dette, une session
Lot A  (A1→A2→A3→A4) les règles deviennent consultables et personnalisables
Lot B  (B1→B2→B3→B4) le personnage devient jouable
Lot C  (C1→C2→C3)    plusieurs personnes, permissions réelles
Lot D  (D1→D2→D3→D4) l'IA, instrumentée dès le premier appel
```

**Ne pas paralléliser les lots.** A débloque B (une fiche de personnage a besoin des règles), B débloque C (une campagne a besoin de personnages), et D a besoin de tout le reste pour avoir quelque chose à assister.

**Un ticket, un commit, une relecture.** La tentation d'enchaîner grandit avec l'aisance ; le risque R2 du registre aussi.
