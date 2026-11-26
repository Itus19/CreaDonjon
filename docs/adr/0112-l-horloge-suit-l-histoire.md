# 0112 — L'horloge suit l'histoire : le joueur écrit une durée, ou l'IA la propose dans une liste fermée

**Date :** 2026-11-25
**Statut :** acceptée le 25 novembre 2026 (choix de l'auteur dans le fil « Faire avancer l'intrigue en narration solo ») ; livrée par V3.2-18 ; **amendée le 26 novembre 2026** (voir la fin)

## Contexte

Séance du 25 novembre : la personne qui joue écrit « je fais ces trois heures de travail ». L'horloge reste à 19:54. Trois causes : une action libre vaut une minute, codée en dur (`minutesForTurn`, `turnLoop.ts`) ; la narration n'a aucun canal pour dire qu'une ellipse a eu lieu ; le bandeau, rendu par la page serveur, ne se recharge pas après un tour. Le temps de parole ne compte pas non plus.

L'heure est un résultat du moteur (règle absolue 8, ADR 0104) : un modèle ne doit jamais l'écrire lui-même.

## Options

- **A — Le moteur seul** : un lexique lit les durées écrites par le joueur. Sûr, mais muet quand la durée n'est pas écrite (« je dors », « je marche jusqu'au village »).
- **B — L'IA écrit l'heure dans sa narration.** Refusé : un nombre inventé par le modèle, impossible à vérifier.
- **C — A, plus une proposition de l'IA dans une liste fermée, bornée par le moteur.** Retenu.

## Décision

1. Une durée écrite par le joueur (« trois heures », « 2 h », « une demi-heure », « jusqu'au matin ») est lue par `dureeExplicite` (`src/core/rules/elapsed.ts`, une journée au plus). `playTurn` l'applique AVANT la narration et ajoute aux changements la phrase « 3 h passent. Il est maintenant 22h54 (jour 1). ». Elle l'emporte toujours sur une proposition de l'IA.
2. Sinon, la narration peut proposer `elapsed` parmi `instant`, `quelques_minutes`, `quart_d_heure`, `demi_heure`, `une_heure`, `plusieurs_heures` (2 à 8), `jusqu_au_matin` (7 h). `minutesProposees` la borne ; `advanceSceneAfterNarration` l'applique après la narration, en best-effort.
3. Un tour où l'on parle dure au moins 2 minutes, plus 1 par tranche de 100 mots échangés (texte du joueur et réplique du PNJ). On garde la plus longue des deux durées (proposée, parole).
4. Jamais d'ellipse en combat : un round dure six secondes et le combat a son propre temps.
5. L'heure atteinte revient dans la réponse du tour (`time`) ; le bandeau la relit par le contexte de la coquille solo (`HeureScene`), sans recharger la page.

## Conséquences

- Sans IA, seule la durée écrite fait avancer l'horloge au-delà d'une minute : le solo reste jouable.
- L'annulation du tour (V3-F2) restaure la scène d'avant le tour : le temps passé est défait avec le reste.
- La date du bandeau (jour du calendrier) ne se met pas encore à jour sans recharger la page quand une ellipse passe minuit. À reprendre si ça gêne en jouant.
- « Raconter autrement » relit les changements journalisés : la phrase de durée n'y est pas, l'horloge, elle, a déjà avancé.

## Amendement du 26 novembre 2026 : une ellipse est une décision du joueur

L'auteur a posé une règle d'écriture : « les ellipses temporelles, sauter des heures, des jours ou davantage, sont une décision exclusive du joueur ; le MJ ne prend jamais cette initiative ». La séance de la veille l'a montré : la personne qui joue écrit « je m'y installe », et l'IA fait dormir le personnage jusqu'à l'aube, ce qui prend aussi la main sur le personnage joué.

Le point 2 change : `elapsed` ne garde que les durées naturelles d'un geste, `instant`, `quelques_minutes`, `quart_d_heure`, `demi_heure` et `une_heure`. `plusieurs_heures` et `jusqu_au_matin` sont retirés de la liste. Une valeur hors liste envoyée quand même est **ignorée** (`.catch(undefined)`), pas fatale : la narration reste, seul le temps ne passe pas. La consigne le dit au modèle (`src/core/ai/narrationPrompt.ts`). La durée écrite par le joueur (point 1) ne change pas : « je dors jusqu'au matin » fait toujours passer la nuit.

Conséquence : dormir est une ellipse comme une autre. Quand le joueur écrit que son personnage dort, le moteur fait passer 8 h (ou la durée écrite) et applique le repos long s'il est valide (V3.2-26, `sleepRest.ts`) ; la narration ne peut plus le déclencher.
