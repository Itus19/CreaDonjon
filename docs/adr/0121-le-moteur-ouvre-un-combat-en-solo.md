# 0121 — En solo, le moteur ouvre le combat, choisit les camps et joue les PNJ

**Date :** 2026-11-27
**Statut :** acceptée le 27 novembre 2026 (choix de l'auteur dans le fil « Corriger Notes et les cercles du rail » : l'attaque ouvre le combat d'office ; une attaque surprise suit la règle de surprise de D&D 2024). Le reste suit les ADR 0104, 0118 et 0120.

## Contexte

Partie test du 27 novembre : la personne qui joue attaque Mabelle trois fois. Chaque attaque est un jet isolé, « 14 (dé : 10) », sans « touché » ni « raté », sans dégâts, sans initiative. Deux causes :

- **Personne n'ouvre de combat en solo.** Seul l'outil du MJ humain en crée un (`createCombatFromMonsters`, `addEntityParticipant`).
- **Hors combat, une cible n'a pas de CA pour le moteur.** `loadTargets` (`turnIntent.ts`) ne lit la CA que chez les participants d'un combat qui tourne ; un présent de la scène arrive avec `ac: null`, donc pas de verdict (`attackVerdict`), donc pas de dégâts enchaînés.

Tout le reste existe déjà : participants avec CA et PV lus de la fiche allégée (`statblock`, ADR 0118), jet d'initiative (`rollInitiativeCheck`), ordre et rounds (`src/core/rules/combat.ts`), fenêtres de réaction, fin de combat qui fait avancer l'heure (`endCombat`), trois zones abstraites (spec moteur §6).

## Options

**Déclencheur.** (a) **Une attaque contre un présent ouvre le combat d'office**, et devient sa première action ; (b) le moteur demande d'abord « Engager le combat ? » ; (c) seul le récit ouvre un combat. (c) contredit la règle 8. (b) ajoute un clic à chaque bagarre, alors que « Annuler ce tour » rattrape déjà une erreur. **Retenu par l'auteur : (a).**

**Qui joue les PNJ.** (1) Le moteur seul, par une tactique fixe ; (2) **l'IA choisit dans une liste fermée que le moteur a construite, le moteur lance et applique** (déjà décidé par l'ADR 0118, point 6) ; (3) l'IA décrit librement. Retenu (2), avec (1) en secours quand le modèle ne répond pas ou choisit hors liste.

## Décision

1. **Ouverture.** Une attaque (arme ou mains nues) contre un présent ouvre le combat avant le jet. Jauger quelqu'un n'est pas l'attaquer (V3.2-46). Un PNJ qui passe à l'acte (le malfrat qui sort son couteau) ouvre aussi un combat, mais seulement par une **proposition** de l'IA (`ai_proposals`, `start_combat` : qui, contre qui) que le moteur valide : présent, en état d'agir, et une raison lisible (hostilité forte envers sa cible, archétype `malfrat` en situation, ordre reçu). Le moteur n'ouvre jamais un combat parce que le récit en parle.

2. **Les camps**, par une fonction pure de `src/core` (`campsDuCombat`), à graine fixe, sans IA :
   - **Agresseur** : celui qui frappe en premier, et ceux dont l'amitié envers lui atteint la bande « fort » (± 2, `bands.ts`) et qui sont au contact ou proches.
   - **Défenseur** : la cible, et ceux dont l'amitié envers elle ou la dette atteint « fort ».
   - **La garde** (archétype `garde`) entre contre l'agresseur quand le lieu relève de sa juridiction, quelle que soit son humeur.
   - **Le courage** décide qui reste hors du combat : l'assurance (axe `fear_assurance` envers l'agresseur), `impulse_prudence`, et l'archétype (`enfant`, `vieillard` ne se battent pas). Ceux-là fuient, se cachent ou appellent à l'aide, au tirage ; ils n'ont pas de rang d'initiative.
   - Les présents **loin** n'entrent pas au premier round. Le moteur refait le calcul à la fin de chaque round : un renfort peut arriver, un défenseur peut lâcher.

3. **Les participants** entrent par `addEntityParticipant` : CA et PV de leur fiche (fiche allégée pour un PNJ, fiche jouable pour le personnage). Une esquisse sans fiche reçoit d'abord sa fiche allégée (le rattrapage de V3.2-47) ; sans elle, elle reste hors du combat.

4. **L'initiative** (V3.2-68) : le serveur lance pour tous. Le personnage lance depuis une pastille du fil (`rollInitiativeCheck`), les PNJ avec la Dextérité de leur fiche. **Surprise**, exactement comme dans les règles 2024 : la surprise ne fait ni tour perdu ni attaque gratuite ; une créature surprise au début du combat lance son initiative avec désavantage. Le moteur la déclare surprise quand elle ne s'attendait à rien : pas d'hostilité perçue envers l'agresseur, pas de combat en cours, et l'agresseur n'a pas annoncé son geste (une menace, une arme tirée au tour d'avant). Un agresseur caché (état Caché, `combatHide.ts`) surprend toujours. Les rangs des PNJ restent cachés tant que le personnage n'a pas lancé.

5. **Le tour d'un PNJ.** Le moteur construit la liste de ses options d'après sa fiche et la scène : attaquer telle cible avec telle action, se désengager, fuir, se rendre, esquiver, aider. L'IA en choisit une, avec une phrase de raison, sous contrainte de schéma. Le moteur lance les dés, applique les dégâts (PV du personnage dans son état de jeu, PV du PNJ sur sa ligne de participant), puis l'IA raconte le round à partir de ces faits. Sans réponse valable du modèle, la tactique fixe joue : frapper celui qui l'a le plus blessé, sinon l'ennemi le plus proche.

6. **Distances.** Les trois zones restent la seule géométrie : au contact (≤ 1,5 m), proche (≤ 9 m), loin. L'écran les dit en mètres (V3.2-67). Se déplacer d'une zone coûte un déplacement de 9 m ; aucune grille (ADR 0104).

7. **Fin.** Un camp n'a plus personne qui veut ou peut se battre : hors de combat, en fuite, rendu. Le **moral** d'un PNJ se teste quand il tombe à la moitié de ses PV ou qu'un allié tombe, par une fonction pure (assurance, prudence, archétype) ; il fuit ou se rend. `endCombat` clôt le combat et fait avancer l'heure. Les changements d'attitude qui suivent passent par les événements d'attitude (V3.2-15), pas par ce ticket.

## Conséquences

- **Aucune migration** : `combats`, `combat_participants` et l'état de scène (`activeCombatId`) suffisent.
- Une attaque en solo touche ou rate enfin : la CA vient du participant.
- L'appel d'IA du tour d'un PNJ passe par `src/server/ai/` et `ai_usage_log` (règles 12, 13). Un round de trois PNJ coûte trois choix courts et un récit, pas trois récits.
- **Tickets** : V3.2-66 (cet ADR, puis `campsDuCombat` et l'ouverture), V3.2-67 (le combat dans le rail, les mètres), V3.2-68 (l'initiative dans le fil), V3.2-73 (le tour d'un PNJ), V3.2-74 (moral et fin du combat).
- **Hors périmètre** : empoigner et pousser, les sorts des PNJ, la poursuite.
