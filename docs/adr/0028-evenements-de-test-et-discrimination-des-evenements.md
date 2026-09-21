# 0028 — Les tests de caractéristique et de compétence deviennent des événements, et un événement peut dire lequel il est

**Date :** 2026-09-21
**Statut :** acceptée

## Contexte

`specs/moteur-de-jeu.md` §4 ferme le vocabulaire d'événements à 18 entrées et pose la règle : *« Ajouter un événement est une décision d'architecture consignée en ADR, pas un ajout à la volée. »* Cet ADR est cette décision.

Deux constats l'ont provoquée, tous deux relevés en implémentant V3-A2, pas en relisant la spec.

**Premier constat : le jeu hors combat n'émet rien.** Sur les 18 événements, 14 ne se produisent qu'en combat. `src/server/services/checkRolls.ts` expose pourtant quatre types de jets — caractéristique, compétence, sauvegarde, initiative — et **seule la sauvegarde** a ses événements (`save_passed` / `save_failed`). Une Persuasion réussie, une Intuition ratée, une Investigation n'émettent rien qu'une règle puisse entendre. L'auteur l'a formulé ainsi : *« il faut aussi bien prendre en compte la partie histoire et purement storytelling qui est le 80 % du jeu »*. Le moteur, tel qu'il était, ne pouvait rien y accrocher.

**Second constat : un événement ne peut pas dire lequel il est.** `FiredEvent` ne porte que `data: Record<string, number>`. Aucun opérateur de condition ne lit de chaîne : `has_condition` et `has_feature` interrogent un **acteur**, jamais l'événement. Conséquence, déjà vraie avant cet ADR :

- `spell_cast` ne permet pas de demander *quel sort* ;
- `condition_applied` ne permet pas de demander *quelle condition* ;
- et un `check_failed` n'aurait pas permis de demander *quelle compétence*.

Trois cas concrets, dont deux préexistants. La règle des trois du projet est satisfaite : ce n'est pas une généralisation anticipée.

## Options

1. **N'ajouter que les deux événements.** Court, mais `check_failed` serait alors indiscriminable : un déclencheur ne pourrait pas distinguer un Athlétisme raté d'un mensonge éventé. Inutilisable en pratique pour ce qui motive l'ADR.
2. **Encoder la compétence dans le nom de l'événement** (`check_failed_deception`…). Ferait exploser un vocabulaire dont la fermeture est justement la garantie.
3. **Encoder la compétence en drapeau numérique** (`event.skill.deception = 1`), lisible par un `gte` existant. Aucune grammaire nouvelle, mais un détour que personne ne devinerait, et que le formulaire de V3-A5 devrait engendrer en le cachant.
4. **Les deux événements, plus un opérateur de condition qui interroge l'événement.**

## Décision

**L'option 4.**

Le vocabulaire passe de 18 à **20 événements** : `check_passed` et `check_failed`, strictement symétriques de `save_passed` / `save_failed`. Leur producteur existe déjà — `rollAbilityCheck` et `rollSkillCheck` —, ce qui est la condition pour qu'un événement entre dans le vocabulaire.

`FiredEvent` gagne des **étiquettes** (`tags`), et `ConditionNode` un opérateur **`event_has`** qui les interroge. Un test de Tromperie raté émet `check_failed` étiqueté `skill:deception` et `ability:cha` ; la condition s'écrit `{ op: "event_has", key: "skill:deception" }`.

`event_has` est délibérément le miroir exact de `has_condition` / `has_feature` : même forme, même nature, mais sur l'événement plutôt que sur un acteur. C'est un opérateur de plus, pas un concept de plus.

**Ce que cet ADR n'ajoute PAS**, faute de producteur aujourd'hui : `attitude_changed` (psyché PNJ), `discovery_made` (V3-C4), `quest_step`, `time_advanced`. Tous plausibles, aucun n'a de code qui l'émettrait. Ils reviendront avec le lot qui les produira, chacun par son ADR.

## Conséquences

- Le vocabulaire compte 20 événements. Le test « ni plus ni moins » de `triggers.test.ts` est mis à jour avec ce nombre : c'est lui qui rend un ajout à la volée impossible.
- **Deux événements préexistants gagnent une capacité qu'ils n'avaient pas** : `spell_cast` et `condition_applied` peuvent désormais être étiquetés et donc discriminés. C'est la vraie portée de cet ADR, au-delà de son titre.
- Les étiquettes sont des chaînes libres côté moteur. Le catalogue des préfixes (`skill:`, `ability:`, `spell:`, `condition:`) est une convention, pas une contrainte de type — et V3-A5 devra offrir une liste déroulante, jamais un champ libre, pour que l'auteur n'ait pas à les connaître.
- Le solo hors combat devient accroçhable : un don qui donne l'avantage face à un noble, un PNJ dont l'attitude bouge sur une Intimidation ratée, un `narrate_hint` qui souffle « il a vu que tu mentais ». Ce dernier reste le seul effet narratif du vocabulaire — si l'écriture du monde en demande d'autres, ce sera un ADR du lot C, pas celui-ci.
