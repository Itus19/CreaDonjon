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

## Réalisation (V3.1-105, 17 octobre 2026)

- **Deux fonctions dans `targetedRoll.ts`.** `applyResolvedEffects` applique des effets déjà résolus, les écrit (participant par `patchCombatParticipant`, annulable ; personnage par `applyRuntimeStateChange`) et écrit le `rule_application` ; le solo l'appelle désormais pour sa partie « appliquer » (même journal, mêmes phrases). `resolveTargetedRoll` est le chemin de la table.
- **Entrée** : `{ kind, actor: character | participant, action: weapon | spell | monster_action, targetId, advantage, critical, secret }` (`targetedRollSchema`). L'acteur peut être un monstre du combat : ses actions et ses sauvegardes viennent de son bloc de stats.
- **Verdict d'attaque, règles 2024** (`attackVerdict`) : un 20 naturel touche, un 1 naturel rate. **Aligné partout le 17 octobre** : le solo (`executeIntent`, `finishResolution`) et `eventsForAttack` (donc `attack_hit`/`attack_miss` des déclencheurs) tranchent par la même fonction ; le journal du solo porte `critical_fail`. Le test du solo qui supposait « CA 1 : touche toujours » vérifie désormais la branche tombée (choix de l'auteur).
- **Sort à attaque** : l'emplacement est dépensé même sur un échec (`castSpell`, `rollDamage: false`), les dégâts ne sont lancés que sur une touche ; pas de demande chaînée pour un sort. **Sort à sauvegarde** : DD de sorts du lanceur contre la sauvegarde de la cible (fiche, bloc de stats, sinon 0 et on le dit) ; dégâts pleins, moitié ou rien selon le bloc `effects`. **Soin** : la formule du sort. Peu de sorts du SRD portent ces données (Soins n'a pas de formule) : le service refuse (`no_save_data`, `no_formula`) plutôt que d'inventer.
- **Jets contre la mort** : un participant qui est un PJ de la campagne porte ses jets ; un critique sur un PJ à 0 PV coûte deux échecs (`critical` sur l'effet de dégâts). `patchCombatParticipant` écrit les jets dans l'état de jeu et les garde dans le journal : « ↶ Annuler » les rend.
- **Hors de l'initiative** : rien n'est stocké (règle 16). Une créature (pas un PJ) à 0 PV est sautée par le passage de tour (`advanceTurnSkipping`) ; la soigner la remet dans l'ordre.
- **« Annuler »** : l'annulation existante du combat (une écriture inverse par événement `combat`), qui couvre désormais les jets contre la mort.
- **Qui** : le MJ seulement (garde des routes de combat), route `POST …/combats/[combatId]/targeted-roll`. Écart avec le ticket, qui prévoyait pour un joueur un « verdict seulement » : depuis l'ADR 0040, un joueur ne lit plus la CA d'un adversaire, et le serveur n'a pas d'autre client que le sien pour la lire. Le verdict d'un joueur arrive donc avec les changements signés (ADR 0041, V3.1-104).
- **Secret** : seulement pour un jet de monstre (`gm`) ; les jets d'une fiche restent publics tant que l'ADR 0038 (jets secrets d'un joueur) n'est pas réalisé.
