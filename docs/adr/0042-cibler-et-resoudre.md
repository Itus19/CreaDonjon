# 0042 — Cibler et résoudre : un cœur commun extrait du tour solo

**Date :** 2026-10-09
**Statut :** acceptée (conception de V3.1-21 ; prolonge l'ADR 0036 §6)

## Contexte

Le solo sait viser un participant, lire sa CA, établir le verdict et appliquer les effets (`executeIntent` dans `turnIntent.ts`, `applyResolvedTurn` dans `turnLoop.ts`), mais mêlé à l'interprétation d'une phrase, au budget d'action et à la narration. La table veut la même résolution depuis l'outil de dés (ADR 0035), sans phrase ni IA.

## Options envisagées

- **A.** Appeler `playTurn` depuis l'outil de dés avec une phrase fabriquée — couple la table à l'IA et au budget du solo.
- **B.** Extraire un service `resolveTargetedRoll` que le solo et la table appellent.

## Décision

B. `src/server/services/targetedRoll.ts` :
- entrée (Zod) : `{ campaignId, actorEntityId | actorParticipantId, kind: attack | damage | spell_attack | spell_save | heal, actionRef, targetId, advantage, secret }` ;
- il lit la cible dans le combat en cours (`combats` `running` + participants — suffisant pour les PNJ sans fiche : CA, PV, états y sont), lance par le serveur (règle 8), résout par le moteur (`resolveAttackRoll`, `resolveDamageRoll`, `eventsForAttack`, déclencheurs), calcule les changements (`applyEffects`) et les **écrit** (participants ; `entity_runtime_state` pour un PJ) ;
- une touche réussie renvoie une **demande de dégâts chaînée** (même cible, dés doublés au critique) que l'outil de dés montre en bande ;
- chaque étape écrit un `session_events` (`roll`, `rule_application`) ; « Annuler » écrit l'inverse, jamais un effacement ;
- un jet secret qui touche reste secret (`visibility_level` : auteur et MJ, ADR 0038) mais s'applique ; les autres voient seulement le changement d'état de blessure ;
- **qui peut** : le MJ, avec n'importe quel participant ; un joueur, avec son PJ (`canEditEntity`) — l'écriture sur une cible qu'il ne contrôle pas attend l'ADR 0041.
`applyResolvedTurn` du solo appelle ce service pour sa partie « appliquer » ; il garde la phrase, le budget, la scène et la narration.

## Conséquences

Un refactor du solo, couvert par ses tests existants (aucun comportement solo ne change). « Cibler » s'allume dans l'outil de dés pour le MJ dès ce service ; pour les joueurs après l'ADR 0041.
