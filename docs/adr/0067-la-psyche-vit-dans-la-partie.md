# 0067 — La psyché vit dans la partie

**Date :** 2026-10-22
**Statut :** proposée (V4-A1)

## Contexte

`personality` et `worldview` appartiennent à l'entité, tous mondes confondus (« Bram est Bram partout », `specs/psyche-pnj.md` §6). Une simulation qui transforme une personne ne peut pas la transformer partout. Par ailleurs, la V4 doit simuler des milliers de personnes qui n'ont pas de fiche.

## Options envisagées

- **A.** Écrire l'état courant dans les blocs — simple, mais la simulation réécrirait le wiki, et deux parties d'un même monde se marcheraient dessus.
- **B.** Une table d'état par (campagne, entité) — propre, mais laisse de côté les personnes sans fiche.
- **C.** Une table `sim_figures` par campagne : toute personne simulée, avec ou sans fiche.

## Décision

**C.** Le bloc devient **l'état de départ** (saisi ou tiré). On réserve le mot « graine » au nombre qui régénère un monde (ADR 0081). L'état courant vit dans `sim_figures.state`, indexé par `campaign_id` (un monde n'a qu'une campagne vivante, index `campaigns_world_id_unique`). Une figure complète a toujours une fiche ; une figure légère n'en a pas forcément. Sans simulation active, aucune figure n'existe et la fiche affiche la graine. `personality_events` reçoit `campaign_id` : nul pour une retouche de la graine, renseigné pour un changement dans la partie. Détail : `specs/simulation-monde.md` §1 et §4.

## Conséquences

- Modifier la fiche en cours de partie : l'onglet « aujourd'hui » corrige l'état courant (un `personality_events` `gm_adjustment`) ; l'onglet « au départ » corrige l'état de départ, qui ne compte que pour une copie ou un nouveau départ.
- La fiche montre deux temps : « au départ » (état de départ) et « aujourd'hui » (état courant).
- `state` est un état, pas un cache rejouable : les besoins et le stress ne sont pas journalisés pas à pas. Ce qui se recalcule (humeur, bandes, poids, liens nommés) n'est jamais stocké (règle 16).
- `specs/psyche-pnj.md` §6 est remplacé sur ce point.
