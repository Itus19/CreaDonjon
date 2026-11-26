# 0114 — Les notes du monde s'écrivent d'office, la ligne du tour dit ce qui a changé

**Date :** 2026-11-26
**Statut :** acceptée le 26 novembre 2026 (choix de l'auteur dans le fil « Faire avancer l'intrigue en narration solo », sur esquisses) ; livrée par V3.2-27. Amende V1-F3 et V3-C3 (« relecture humaine obligatoire ») pour les seules notes du monde du solo.

## Contexte

Le bandeau « N changements dans le monde », sous le fil, comptait toute la séance et mélangeait trois choses : les notes de l'IA à accepter, ce qui était déjà écrit, et « Annuler le dernier tour ». On ne savait pas ce qu'un tour avait changé, ni si un repos ou une pièce avaient compté. Chaque note de l'IA attendait un clic « Accepter » : en jouant, c'est une corvée qu'on finit par ignorer. Enfin, l'heure n'était visible que dans l'en-tête, et un tour de combat ne disait pas qu'il dure 6 secondes.

## Options

- **A — Une ligne par tour, le reste dans un onglet « Changements » du Monde.** Retenue.
- **B — Tout dans l'onglet Monde**, le fil ne montre que le récit. Écartée : il faut ouvrir l'onglet pour savoir si le repos a compté.
- **C — Le bandeau, mais par tour.** Écartée : il faut l'ouvrir à chaque tour.

## Décision

1. **La ligne du tour.** Sous chaque tour de la personne qui joue, une ligne de puces : l'heure toujours en tête (« +8 h · 06:08, jour 2 » ; « Round · 6 s » en combat), puis les changements du moteur et du monde nés pendant le tour. Elle se relit du journal (`summarizeTurns`, `src/core/rules/turnSummary.ts`) : l'heure vient des relevés `undo_before.scene` que chaque tour pose déjà ; rien de nouveau n'est écrit pour elle. « Annuler ce tour » s'accroche au dernier tour, et à lui seul.
2. **Les notes du monde s'écrivent d'office.** Une note `world_note` du modèle, validée par Zod et rattachée à une entité connue, est ajoutée au bloc `text` de l'entité dès le tour (`proposeWorldNote`). Elle passe toujours par `ai_proposals` (règle absolue 9) : `applied` et `auto_applied`, et le paragraphe porte l'identifiant de la proposition. La personne qui joue la corrige ou la retire après coup (onglet « Changements », routes `correct` et `remove`) ; l'annulation du tour la retire aussi. Si l'écriture échoue (droit, conflit), la note reste à relire comme avant.
3. **L'onglet « Changements »** du Monde (feuille du bas sur téléphone) remplace le bandeau : « À relire », puis « Ajouté au monde pendant cette séance ». Il lit `/consequences` seulement quand il est ouvert.
4. **Le temps du combat.** Un tour en combat ne fait pas passer de minute ; à la fin du combat, la scène avance de 6 s par round (`minutesDeCombat`, arrondi à la minute au-dessus) et oublie `activeCombatId`.

## Conséquences

- Le fil ne sonde plus les conséquences toutes les 4 s : une lecture de scène s'ajoute à `/fil`, le sondage des conséquences ne tourne que onglet ouvert. Le compte de requêtes baisse.
- Une note fausse reste écrite tant que personne ne la corrige : c'est le prix de la fluidité, choisi par l'auteur. Le wiki d'auteur n'est touché que par ajout de paragraphe, jamais par réécriture.
- Les fiches nées d'office (esquisses ancrées) suivent déjà ce modèle (V3-C3) : rien ne change pour elles.
- La ligne d'un tour écrit avant V3-F2 n'a pas d'heure (pas de relevé).
