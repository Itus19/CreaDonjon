# ADR 0065 — L'éditeur plein écran enregistre ses blocs en une transaction

**Contexte.** V3.1-31 : sur téléphone, l'éditeur en accordéon garde un brouillon (plusieurs blocs modifiés, réordonnés) et « Enregistrer » doit écrire « une seule écriture, contrôle de version compris ». Jusqu'ici chaque bloc s'écrivait seul, avec sa propre version (`PATCH /api/blocks/[id]`, enregistrement à la volée de `EntityBlocks`).

**Options.** (a) Rejouer côté serveur les écritures bloc par bloc : un conflit sur le troisième laisse les deux premiers écrits, le brouillon est à moitié appliqué. (b) Une fonction PostgreSQL appelée par RPC, qui applique tous les changements dans une transaction. (c) Une version au niveau de la fiche : changerait le contrôle de tous les écrans existants.

**Décision.** (b) : `public.save_entity_blocks`, en `security invoker` — la RLS des blocs s'applique comme pour un bloc seul, la fonction n'ouvre aucun droit ; une version périmée lève `PT409` et annule tout. Le service garde les barrières d'avant, dans le même ordre (droit d'écrire, appartenance du bloc à la fiche, schéma Zod par type) et partage avec l'écriture d'un bloc seul ses effets de bord (`apresEcritureBloc` : fond de wiki, renommage d'un personnage, images d'une carte). Une seule révision d'entité par enregistrement.

**Conséquences.** Les éditeurs de blocs restent ceux d'aujourd'hui (données / `onChange`) : seul leur conteneur change (brouillon au lieu d'enregistrement à la volée). Les sous-écritures propres à certains éditeurs (événements de personnalité, objectifs de quête, carte…) restent immédiates ; le brouillon doit reprendre la version qu'elles renvoient, sinon l'enregistrement final serait refusé (409). Fonction à part, pas de changement de table : rien à migrer dans les données.
