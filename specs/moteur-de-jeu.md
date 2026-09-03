# Spécification — Moteur de jeu

**Version :** 0.1 — 2 septembre 2026
**Cible :** V3, avant le mode solo
**Statut :** Conception arrêtée pour les déclencheurs/conditions et le rejet de Lua (§3-4) ; économie d'action et état de scène (§5-6) à affiner en écrivant V3-A3/V3-A4
**Amende :** `specs/regles-couche.md` §4 · `specs/cible-locale-et-ia.md`

---

## 0. L'objectif

Un moteur qui résout **tout** ce qui est mécanique, pour qu'une IA locale n'ait plus qu'une tâche : raconter ce qui vient de se passer et inventer un récit cohérent.

L'objectif est juste, et il est presque atteint. Ce document dit ce qui manque, et tranche la question de Lua.

---

## 1. Ce qui existe déjà

Inventaire du dépôt au 2 septembre :

| Brique | Où | État |
|---|---|---|
| Formules en AST, parser fermé, RNG injecté | `src/core/formula`, `src/core/dice` | complet |
| Jets d'attaque, de caractéristique, de dégâts, avantage | `src/core/rules/action.ts` | complet |
| Initiative, ordre du tour, avancer/reculer | `src/core/rules/combat.ts` | minimal mais juste |
| Fiche dérivée, sept couches de modificateurs | `src/core/rules/sheet.ts` | complet |
| Cibles de modificateurs (16 cibles, 8 opérations) | `src/core/rules/modifierTargets.ts` | complet |
| Effets actifs avec modificateurs et durée | `ActiveEffect` dans `sheet.ts` | complet |
| Surcharge de règles, héritage, versions figées | `src/core/rules/resolve.ts` | complet |
| Blocs typés, primitives, validation Zod | `src/core/schemas/rule-blocks/` | complet |

**C'est déjà un moteur de règles.** Ce qui manque n'est pas une couche d'exécution : ce sont trois mécanismes précis.

---

## 2. Ce qui manque

| Manque | Exemple qu'on ne sait pas exprimer |
|---|---|
| **Déclencheurs** | « quand vous subissez des dégâts en concentration, jet de Constitution » |
| **Conditions** | « si la cible est à terre, avantage au corps à corps » |
| **Économie d'action** | action, action bonus, réaction, déplacement — le budget d'un tour |
| **État de scène** | qui est présent, où, depuis combien de temps, quelle heure il est |

Les deux premiers forment le sujet repoussé depuis la Phase 0 sous le nom de « déclencheurs » (`specs/regles-couche.md` §8). **C'est maintenant le bon moment** : des cas réels tirés de vraies parties existent, ce qui manquait pour concevoir sans deviner.

---

## 3. Lua : non, et voici pourquoi

L'intuition — « il faut un langage pour rendre les règles vraiment personnalisables » — vise le bon problème. La solution proposée est celle qui coûte le plus et rapporte le moins ici.

### Cinq raisons, par ordre d'importance

**1. Un modèle ne peut pas produire du Lua qu'on puisse valider.**

C'est l'argument décisif, et il est propre à ce projet. Toute l'architecture repose sur : le modèle propose → Zod valide la forme → la logique métier valide le sens → on applique. Cette chaîne fonctionne parce que les propositions sont des **données**.

Un script Lua généré par une IA ne se valide pas. On peut vérifier qu'il compile, pas qu'il fait ce qu'il prétend. Il faudrait l'exécuter pour le savoir — c'est-à-dire faire exactement ce qu'on cherche à éviter.

Ce projet veut que l'IA aide à créer des règles (V1-F2, V2-G7) **et** qu'elle mène des parties. Les deux exigent des règles vérifiables. Lua les rend invérifiables.

**2. L'auteur ne connaît pas Lua.**

Un système de personnalisation qui exige d'apprendre un langage sera utilisé par une seule personne, rarement, et abandonné à la première session où il faut jouer plutôt que déboguer. Le formulaire engendré par les schémas Zod, lui, est déjà utilisé.

**3. Ça inverse le principe qui a le mieux servi ce projet.**

« Aucun `eval`, grammaire fermée, exécution bornée » date de la Phase 0 (CLAUDE.md règle 7). C'est ce qui fait qu'aucune formule n'a jamais pu geler le serveur ni ouvrir une faille. Embarquer un interpréteur généraliste, c'est rouvrir cette porte volontairement.

**4. Le bac à sable coûte cher et n'est jamais fini.**

Il faut une machine virtuelle (`wasmoon`, `fengari`), retirer `io`, `os`, `require`, `debug`, plafonner les instructions, couper les boucles infinies, borner la mémoire. Un script qui part en boucle bloque le serveur lui-même. C'est du travail réel, permanent, pour une fonctionnalité peu utilisée.

**5. 80 % de ce que Lua apporterait existe déjà.**

Formules, modificateurs, effets actifs, surcharges. Il manque les déclencheurs et les conditions — deux mécanismes précis, pas un langage.

### La règle des trois s'applique

Si, après avoir construit le système déclaratif ci-dessous, **trois règles des livres utilisés** restent inexprimables, alors la question d'une échappatoire se posera sérieusement. Pas avant.

Le pari : il n'y en aura pas trois.

---

## 4. Les déclencheurs, en données

Extension du modèle existant, dans le même esprit que les formules.

```json
{
  "id": "concentration",
  "when": { "event": "damage_taken", "subject": "self" },
  "if": {
    "op": "and",
    "args": [
      { "op": "has_condition", "who": "self", "key": "concentrating" },
      { "op": "gte", "args": [{ "ref": "event.damage" }, { "num": 1 }] }
    ]
  },
  "then": [
    {
      "action": "saving_throw",
      "who": "self",
      "ability": "con",
      "dc": { "op": "max", "args": [
        { "num": 10 },
        { "op": "floor", "args": [{ "op": "div", "args": [{ "ref": "event.damage" }, { "num": 2 }] }] }
      ]},
      "on_fail": [{ "action": "remove_condition", "key": "concentrating" }]
    }
  ]
}
```

### Le vocabulaire d'événements

`turn_start` · `turn_end` · `round_start` · `round_end` · `attack_hit` · `attack_miss` · `damage_taken` · `damage_dealt` · `save_passed` · `save_failed` · `condition_applied` · `condition_removed` · `spell_cast` · `movement` · `short_rest` · `long_rest` · `enters_area` · `dies`

**Fermé, comme le reste.** Ajouter un événement est une décision d'architecture consignée en ADR, pas un ajout à la volée.

### Les conditions réutilisent l'AST

Aucune grammaire nouvelle. Le `if` est un nœud d'AST, étendu de quelques opérations booléennes : `and`, `or`, `not`, `eq`, `gte`, `lte`, `has_condition`, `has_feature`, `in_range`.

Le contexte d'évaluation contient `event.*` (les données de l'événement) et l'accès aux fiches dérivées des participants.

### Les effets réutilisent le vocabulaire existant

`saving_throw` · `apply_modifier` · `apply_condition` · `remove_condition` · `deal_damage` · `heal` · `spend_resource` · `move` · `roll` · `narrate_hint`

`apply_modifier` produit exactement les `Modifier` que `sheet.ts` sait déjà empiler. **Rien de nouveau à écrire côté fiche.**

`narrate_hint` mérite mention : c'est ainsi qu'un déclencheur signale à l'IA ce qui mérite d'être raconté — « le baril d'huile est dans la zone » — sans lui donner à décider.

### Les bornes, obligatoires

| Borne | Valeur | Raison |
|---|---|---|
| Profondeur de chaînage | 4 | un déclencheur qui en réveille un autre, jusqu'à quatre |
| Déclencheurs par événement | 32 | au-delà, on rejette et on journalise |
| Un même déclencheur par chaîne | 1 fois | interdit A → B → A |
| Effets par déclencheur | 8 | |

Sans ces bornes, deux règles qui se répondent bloquent la partie. Avec elles, c'est impossible par construction — la propriété exacte que Lua ne peut pas offrir.

### Ce que ça donne, concrètement

Écrit une fois dans le moteur, tout ceci devient de la donnée saisissable au formulaire :

- Concentration rompue par les dégâts
- Attaque d'opportunité (`movement` + `in_range`)
- Sang froid, Second souffle, Action bonus de rage
- Poison qui inflige des dégâts au début du tour
- Résistances et immunités
- Aura de paladin (`apply_modifier` conditionné à `in_range`)
- Règles maison, sans écrire une ligne de code

---

## 5. Économie d'action

```ts
interface ActionBudget {
  action: number;        // 1
  bonus: number;         // 1
  reaction: number;      // 1, recharge au début du tour
  movement: number;      // en mètres, dérivé de la vitesse
  free: number;          // interactions gratuites
}
```

Consommé par `resolveAction`, remis à zéro par `turn_start`. Un déclencheur peut en accorder (Fougue du guerrier) ou en retirer.

**Signaler, ne pas interdire.** Une action sans budget est marquée « hors budget » et reste jouable. Les tables dérogent en permanence ; un outil qui bloque devient un outil qu'on contourne.

---

## 6. État de scène

C'est ce qui manque le plus pour le solo, et c'est simple.

```ts
interface SceneState {
  locationId: string;
  presentEntities: { entityId: string; disposition?: string }[];
  time: { day: number; hour: number; minute: number };
  lighting: 'bright' | 'dim' | 'dark';
  activeCombatId: string | null;
  recentEvents: SessionEventRef[];   // les 5 derniers
}
```

**Tenu par le moteur, jamais par le modèle.** Un LLM perd le fil du temps qui passe et de qui est présent — c'est la première cause d'incohérence en jeu solo. L'heure avance parce que le code la fait avancer, sur repos, voyage ou action longue.

Le modèle **reçoit** cet état ; il ne le modifie que par proposition validée.

### Les distances sans grille tactique

Pour `in_range` et les zones, une grille de combat n'est pas nécessaire. Trois zones abstraites suffisent et couvrent l'immense majorité des cas :

`engaged` (contact) · `near` (même mêlée, ~9 m) · `far` (à portée de vue)

C'est le modèle qu'emploient plusieurs systèmes narratifs, il se joue sans plateau, et il se code en une journée. Une vraie grille reste possible plus tard ; commencer par là serait construire une table virtuelle, ce que le hors-périmètre exclut depuis le début.

---

## 7. Ce que le modèle reçoit

Un tour de jeu solo, une fois tout ceci en place :

```
Entrée du joueur
  ↓
Le moteur interprète l'intention, résout, applique les déclencheurs
  ↓
Le modèle reçoit :
    l'état de scène (~80 tokens)
    les PNJ présents avec leur psyché (~60 tokens chacun)
    le résultat mécanique du tour (~140 tokens)
    les indices de narration
  ↓
Il raconte. Il ne calcule rien, ne lance rien, ne décide d'aucune règle.
```

Environ **400 à 500 tokens d'entrée par tour**, contre plusieurs milliers dans une approche par empilement de prompt. C'est ce qui rend un modèle local viable — et ce que le spike S1 devait vérifier (ADR 0009 : verdict repli sur le MJ assisté, le lien fait-mécanique → narration reste à reboucler de bout en bout).

---

## 8. Découpage

| Ticket | Contenu | Taille |
|---|---|---|
| **V3-A1** | Schéma des déclencheurs, évaluateur, bornes — `src/core/rules/triggers.ts`, **tests d'abord** | `L` |
| **V3-A2** | Vocabulaire d'événements branché sur `resolveAction` et le combat | `M` |
| **V3-A3** | Économie d'action | `M` |
| **V3-A4** | État de scène et zones abstraites | `M` |
| **V3-A5** | Éditeur de déclencheurs au formulaire, avec bac à sable | `L` |
| **V3-A6** | Conversion des règles SRD 2024 qui ont des déclencheurs | `L` |

**A1 est le cœur.** Fonction pure, sans base ni réseau, testable exhaustivement. Tests avant le code : les cas dorés sont les règles réelles des parties jouées.

---

## 9. Critères d'acceptation

- [ ] Les déclencheurs sont des données validées par Zod, jamais du code exécuté.
- [ ] Deux déclencheurs qui se répondent s'arrêtent à la profondeur 4, avec une erreur explicite.
- [ ] Un déclencheur ne peut pas apparaître deux fois dans une même chaîne.
- [ ] La concentration rompue par les dégâts est exprimée **entièrement en données**, sans code spécifique.
- [ ] Une règle maison créée au formulaire se déclenche en jeu sans redémarrage.
- [ ] L'état de scène est tenu par le moteur ; aucun champ n'est écrit depuis une sortie de modèle sans validation.
- [ ] Un tour complet envoie moins de 600 tokens au modèle.
- [ ] `src/core/rules/triggers.ts` n'importe rien de `next`, `react` ni `@supabase`.

---

## 10. Ce qui reste ouvert

| Question | Recommandation |
|---|---|
| Faut-il une grille tactique ? | non — trois zones abstraites, et on y revient seulement si ça manque vraiment |
| Les déclencheurs peuvent-ils appeler l'IA ? | non. `narrate_hint` lui passe l'information, le déclencheur ne l'attend pas |
| Que faire d'une règle inexprimable ? | la noter. À la troisième, rouvrir la question d'une échappatoire — pas avant |
| Concurrence de deux déclencheurs sur le même événement | ordre déclaré par priorité, comme les couches de modificateurs |
