# ADR 0118 — Les règles d'un guerrier de niveau 3 rendues jouables

Date : 2026-11-27 · Statut : accepté · Fil « Rendre jouables les 7 règles partielles »

## Contexte

En solo, le bandeau « 7 règles de ton personnage ne sont pas entièrement jouables » listait, pour un Guerrier Champion de niveau 3 : Athlète accompli, Fougue (partielle), Maîtrise des armes, Sauvagerie martiale, Sens tactique, Sous-classe de Guerrier, Style de combat. L'ADR 0059 exige que toute règle soit jouable par le moteur. Trois cas différents se cachaient derrière ce bandeau.

## Décisions

1. **Une aptitude jouée en code se dit jouable.** Maîtrise des armes (choix d'après la colonne de la classe, bottes appliquées à chaque attaque) et Sous-classe de <classe> (le choix de la sous-classe) n'ont pas de brique, parce que leur mécanique vit dans le moteur. `playedByEngineCode` (`coverage.ts`) les nomme dans une liste fermée et testée, comme `ENGINE_CONDITIONS`. Le rapport, la vue du MJ et la fiche de la règle partagent ce verdict. Une lacune déclarée l'emporte toujours.
2. **« Une fois par tour » vaut aussi au clic.** La limite `limit` d'une activation, jusqu'ici comptée pour les réactions seulement, est vérifiée et datée par `activateFeature` (même compte `turn_usage.once`). Fougue n'a plus de lacune. Le refus `limit_reached` n'écrit rien.
3. **L'initiative est une valeur de la fiche.** Une cible de modificateur `initiative` (bonus, avantage, désavantage), calculée comme un test de Dextérité. Tous les jets d'initiative d'un PJ la lisent (le jet de la fiche, celui du MJ pour tout le monde, le dé de la table). Athlète accompli y pose l'avantage.
4. **Deux briques de jet.** `reroll_weapon_dice` relance les dés de l'arme d'un jet de dégâts et garde le meilleur (Sauvagerie martiale) : le jet de dégâts porte désormais les dés de l'arme quand sa formule est simple (`1d8`). Une réaction automatique limitée est comptée comme une réaction choisie. `refund_if_failed` rend le coût d'une réaction à un jet raté si le jet rate encore (Sens tactique).
5. **Le Style de combat se choisit.** Un bloc `choices` (don de la catégorie Style de combat). Archerie et Défense sont des modificateurs à condition d'équipement.

## Ce qui reste, en lacunes honnêtes

- Armes à deux mains : un plancher par dé de dégâts, et la prise à deux mains d'une arme Polyvalente.
- Combat à deux armes : l'attaque supplémentaire d'une arme Légère n'est pas une attaque du moteur.
- Athlète accompli : le déplacement après un coup critique (un moment « critique » et un effet qui accorde du mouvement). Les attaques d'opportunité ne sont pas encore jouées.

## Conséquences

Les données vivent dans `data/srd/*.json`. Elles n'arrivent en base qu'en relançant `npm run ingest:srd`. Le ticket V3.1-221 lisait mal Athlète accompli (le texte 2024 donne l'avantage, pas un plancher du d20) : il ne garde que Savoir-faire.
