# 0070 — Le journal de session à deux versions : les phrases pour tous, les chiffres pour le MJ

**Date :** 2026-11-01
**Statut :** acceptée (V3.1-149)

## Contexte

`session_events` se lisait par tout membre du monde. Les jets ciblés du MJ y écrivaient « … contre CA 15 », « Worg : 26 → 13 PV » et les changements bruts, et le journal de combat y gardait les lignes de participant avant/après, CA comprise. Un joueur lisait donc par l'API ce que la vue filtrée (ADR 0040) lui cache. La politique d'écriture, en `FOR ALL`, ouvrait en plus la lecture et la modification à tout membre.

## Options envisagées

- **Une colonne réservée au MJ** dans `session_events` : impossible, la RLS de Postgres filtre des lignes, pas des colonnes selon l'utilisateur.
- **Deux événements par jet** (un public, un pour le MJ) : double le fil, les numéros et chaque lecteur.
- **Une table à part, `session_event_gm_details`**, liée à l'événement, lisible du MJ seul : l'événement porte ce que les joueurs lisent, la table ses chiffres.

## Décision

**La table à part.** Un jet du MJ (cibler, sauvegarde d'un monstre) écrit au journal les phrases de `playerFacing.ts` et range dans `session_event_gm_details` ce qui diffère (CA, PV, effets et changements bruts) ; un jet secret n'y laisse que « Jet secret du MJ. ». Le dépôt (`repos/sessions.ts`) joint la table à la lecture (ressource imbriquée, une requête) : la RLS rend les chiffres au MJ et `null` au joueur. Le fil du MJ et la narration ne changent pas.

Les événements `combat` (lignes avant/après d'un participant) se lisent par l'administrateur du monde et par leur auteur : un joueur relit la ligne de son PJ qu'il vient de journaliser. L'écriture se découpe : insérer reste aux membres, modifier et supprimer à l'administrateur (journal en ajout seul). Le numéro suivant se lit par `next_session_event_seq` (qui compte tous les événements), sans quoi un joueur prendrait un numéro déjà donné à un événement qu'il ne voit pas.

## Conséquences

- Le journal d'activité d'un joueur ne montre plus les lignes de combat des autres participants.
- Le tour solo et la sauvegarde d'un joueur sur son PJ écrivent comme avant : rien n'y est caché à leur seul lecteur.
- Un joueur peut toujours insérer un événement `combat` qu'« Annuler » du MJ rejouerait : l'annulation ne vérifie pas encore l'auteur (relevé au registre, `SECURITE.md`).
