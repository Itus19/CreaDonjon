# 0060 — La fondation des règles jouables : activation, ressources déclarées, effets qui durent

**Date :** 2026-10-13
**Statut :** acceptée (étude `docs/etude-regles-jouables.md`, ADR 0059)

## Contexte

L'ADR 0059 exige que toute règle soit jouable par le moteur. L'étude montre que trois pièces manquent sous toutes les autres : rien ne dit qu'une règle **se joue** (un bouton), les compteurs sont **saisis à la main** sur le personnage au lieu d'être déclarés par les règles, et **aucun effet ne dure** (`entity_active_effects` existe depuis la Phase 0 et n'est jamais écrite ; `turn.ts` ignore `apply_modifier` faute de mieux). Cet ADR fixe la forme de ces trois pièces, plus l'état de couverture d'une fiche.

## Options envisagées

- **Où vit la mécanique.** A : de nouveaux blocs typés sur les fiches de règles, comme `modifiers` et `triggers`. B : une table. B reconstruirait chaîne de rulesets, surcharges, homebrew et traductions, que les blocs ont déjà (même raisonnement que pour `triggers`, `blocks.ts`).
- **Vocabulaire des effets.** A : réutiliser `EffectNode` des déclencheurs. B : un second vocabulaire pour les activations. B ferait deux moteurs pour la même chose.
- **Compteurs.** A : copier les compteurs dans le bloc `resources` du personnage à la création. B : les calculer depuis les règles du personnage. A stockerait une valeur dérivée (règle absolue 16) et divergerait au premier changement de règle.
- **Effets qui durent.** A : les écrire dans `entity_runtime_state`. B : dans `entity_active_effects`, prévue pour ça (`SCHEMA.md` §12.2), durée ancrée sur les événements de session.

## Décision

A, A, B, B.

### 1. Bloc de règle `resources` — la ressource déclarée par une règle

```json
{ "resources": [{
  "key": "channel-divinity",
  "label": { "fr": "Conduit divin" },
  "max": { "op": "ref", "name": "column.channel_divinity" },
  "recharge": "short_rest_one"
}] }
```

- Porté par n'importe quelle fiche : aptitude de classe, trait d'espèce, don, objet. `key` est unique dans le ruleset ; d'autres fiches la **référencent** pour la dépenser (Abjuration d'ennemis et Arme sacrée dépensent `channel-divinity`).
- `max` est une formule. `column.<clé>` lit une colonne de la `class_progression` de la classe qui accorde la fiche, au niveau de cette classe ; `level`, `ability.*`, `proficiency` restent disponibles.
- `recharge` : `short_rest`, `short_rest_one` (V3.1-113), `long_rest`, `dawn`, `never`.
- `characterSheet()` calcule la liste des ressources du personnage à partir de ses fiches (même chemin que les `modifiers`, `resolvedRuleset.ts`). Rien n'est copié. L'état de jeu garde seulement les usages consommés, sous la clé de la ressource (`state.resources`, forme inchangée). Le bloc `resources` du personnage reste pour les compteurs sans règle (`custom: true`).
- Un objet ne compte ses ressources que s'il est équipé, ou lié quand il demande un lien.

### 2. Bloc de règle `activation` — « cette règle se joue »

```json
{ "activations": [{
  "id": "abjure",
  "label": { "fr": "Abjuration d'ennemis" },
  "requires": { "op": "gte", "args": [{ "op": "ref", "name": "level" }, { "op": "num", "value": 3 }] },
  "cost": { "action": "magic", "resources": [{ "key": "channel-divinity", "amount": { "op": "num", "value": 1 } }] },
  "targets": { "kind": "creature", "count": { "op": "max", "args": [{ "op": "num", "value": 1 }, { "op": "ref", "name": "ability.cha" }] }, "range": { "value": 18, "unit": "m" }, "must_see": true },
  "effects": [ { "action": "saving_throw", "who": "target", "ability": "wis", "dc": { "op": "ref", "name": "spell_save_dc" }, "on_fail": [ { "action": "apply_effect", "who": "target", "effect": "frightened-abjure" } ] } ],
  "variants": null
}] }
```

- `cost.action` : `action`, `bonus`, `reaction`, `magic`, `free`, `none` — décompté sur le budget d'action (ADR 0029).
- `targets.kind` : `self`, `creature`, `ally`, `enemy`, `point`. `range` est en mètres : il se mesure aux distances réelles de l'ADR 0059, et d'ici là à leur lecture en zones.
- `effects` réutilise `EffectNode` sans le dupliquer. `who` y vaut `self` ou `target`.
- `variants` : options au choix à l'activation (l'ancien M12), chacune avec ses effets et éventuellement son propre coût. Imposition des mains, Souffle (cône ou ligne), Révélation céleste.
- `requires` est un `ConditionNode` : niveau minimum, état, aptitude.
- Les déclenchements autres que le clic (réaction, sur événement) sont **hors de cette fondation** : c'est le chantier « intervenir sur un jet ». Le champ `trigger` est réservé, absent vaut « au clic ».

### 3. L'effet `apply_effect` et les effets qui durent

Un nouvel effet rejoint le vocabulaire fermé : `{ "action": "apply_effect", "who": ..., "effect": "<id>" }`. Il pose un **effet actif** décrit dans le même bloc `activation`, sous `durable_effects` :

```json
{ "durable_effects": [{
  "id": "frightened-abjure",
  "label": { "fr": "Effrayé (Abjuration)" },
  "conditions": ["frightened"],
  "modifiers": [],
  "duration": { "unit": "minute", "amount": 1 },
  "concentration": false,
  "ends_on": [ { "event": "damage_taken", "subject": "bearer" } ],
  "token": null
}] }
```

- `duration.unit` : `round`, `minute`, `hour`, `day`, `until_turn_end` (`whose` : `bearer` ou `source`, `which` : `current` ou `next`), `until_rest`, `permanent`. Une minute vaut dix rounds en combat ; hors combat, le temps avance avec l'état de scène (`specs/moteur-de-jeu.md` §6).
- `ends_on` : des événements du vocabulaire fermé, avec une condition facultative. Une fin « au choix » est `{ "event": "dismissed" }`, que seul le porteur ou la source émet.
- `concentration: true` lie l'effet à la concentration de la source (V3.1-24, point 2) : la rompre retire l'effet.
- `modifiers` et `conditions` s'appliquent tant que l'effet dure. `characterSheet()` lit déjà les effets actifs en couche 7 (`activeEffects`) ; il ne recevait que des listes vides.
- **Jeton** (l'ancien M16) : `token: { "uses": 1, "grants": "<id d'activation>" }`. Tant que l'effet dure, son porteur dispose d'une activation qu'il n'a pas lui-même : le dé d'Inspiration bardique chez l'allié, « avantage à un jet de votre choix », Paume vibratoire. Un usage épuisé retire l'effet.
- Écriture dans `entity_active_effects` : `source_kind` gagne `feature`, et une colonne `payload jsonb` reçoit la description validée par Zod (conditions, fin, jeton). `modifiers` y garde les modificateurs **déclarés** ; leurs valeurs sont recalculées par `characterSheet()`, jamais figées. `duration` garde l'ancrage (événement de départ, round, porteur). Une migration nouvelle ; aucune ne se modifie.
- L'expiration est une fonction pure du noyau, appelée sur `turn_start`, `turn_end`, `round_end`, les repos et l'avance du temps de scène. Un effet expiré est retiré et journalisé, jamais en silence.

### 4. Bloc de règle `coverage` — l'état de couverture

```json
{ "gaps": [ { "text": "ne peut faire qu'une seule chose à son tour", "missing": "restriction de tour" } ] }
```

- Une fiche est **jouable** si elle porte au moins un bloc mécanique et aucune lacune, **partielle** si elle déclare des lacunes, **non évaluée** si elle n'a ni l'un ni l'autre. L'état est calculé, jamais stocké.
- Le mode solo avertit avant qu'une fiche non jouable n'entre en jeu (ADR 0059 §3).

### 5. Le service

Une action serveur `activateFeature` : entrée validée par Zod (entité, campagne, fiche, activation, variante, cibles), droit d'écriture par `canEditEntity`, puis le noyau vérifie `requires`, le coût et les cibles, **lance les dés côté serveur**, résout les effets et rend un plan. Le service l'applique en une écriture : usages consommés, budget, effets actifs, états, `session_event` et `dice_rolls`. Écrire sur une créature qui n'est pas la sienne (poser Effrayé sur un monstre) suit l'ADR 0041.

## Conséquences

- Trois nouveaux blocs de règle (`resources`, `activation`, `coverage`) et un effet (`apply_effect`). Aucune migration pour les blocs (`block_type` est un `text` libre) ; une migration pour `entity_active_effects`.
- Un même vocabulaire d'effets pour les déclencheurs et les activations : un effet ajouté sert aux deux.
- Le bouton « utiliser » actuel de l'onglet Actions, qui ne fait que +1 sur un compteur, est remplacé par un bouton par activation. Les compteurs manuels restent.
- Dépend de V3.1-24 (concentration, PV temporaires) et de V3.1-113 (`short_rest_one`).
- Ne couvre pas encore : les valeurs de modificateur en formule ou en dé, les réactions, les actions modifiées, les conditions de jeu, le modèle du monde. Chacun a son chantier (`docs/backlog-v3.1/12-regles-jouables.md`, V3.1-129 à 140).
- `docs/SCHEMA.md` §12.2 et `specs/regles-blocs.md` §5 sont mis à jour par le ticket qui écrit la migration.
