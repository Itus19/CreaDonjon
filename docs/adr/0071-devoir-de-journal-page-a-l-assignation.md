# 0071 — Le devoir de journal : la page naît à l'assignation, « Devoir fait » publie, le MJ valide

**Date :** 2026-11-01
**Statut :** acceptée (V3.1-150)

## Contexte

Jusqu'ici (V2.1-3), assigner un devoir de journal n'écrivait qu'une ligne `pending` dans `session_journal_entries`. La page naissait quand l'autrice cliquait sur une bannière, en haut de l'onglet Wiki seulement, et elle entrait aussitôt dans le Livre, brouillon compris. Une joueuse n'a jamais vu cette bannière : elle a écrit son résumé ailleurs, et la page s'est perdue (V3.1-150). Par ailleurs, la politique de modification de la table laissait l'autrice changer n'importe quelle colonne de son devoir.

## Options envisagées

- **Garder la bannière et la répéter dans Édition** : moins de changement, mais la page n'existe toujours pas tant que l'autrice ne pense pas à la créer.
- **Créer la page à l'assignation, côté MJ** : le MJ a déjà tous les droits d'écriture (fiche, blocs, octroi) ; rien de nouveau à ouvrir côté joueuse.
- **Masquer le brouillon par la visibilité des blocs** (niveau `user`) : le MJ ne le verrait plus (`canSee` ne fait pas d'exception administrateur pour ce niveau), et les blocs ajoutés par l'autrice garderaient leur visibilité par défaut.

## Décision

**La page naît à l'assignation**, créée par le MJ : fiche `session_journal` non publique, blocs « Séance » et « Récit », octroi d'édition à l'autrice, devoir `pending` qui la désigne. Une écriture ratée en chemin efface la fiche à moitié créée.

**Le brouillon est masqué côté serveur, au niveau de la fiche, pas des blocs.** `listPlayerVisibleEntityIds` (sommaire, recherche, listes de liens) écarte une fiche du Livre dont le devoir est `pending`, sauf pour celles et ceux qui peuvent l'éditer ; `getPlayerEntityDetail` répond « introuvable » aux autres. Le Livre ne liste que les devoirs `written` et `validated`.

**Trois états.** `pending` (en cours d'écriture) → `written` (« Devoir fait » : la page devient publique et entre dans le Livre ; définitif) → `validated` (le MJ valide ; la mention quitte la barre de la joueuse).

**Écriture du devoir.** La modification de `session_journal_entries` est réservée au MJ. L'autrice rend son devoir par `submit_journal_assignment(p_assignment_id)`, `security definer`, qui ne fait qu'une chose : passer à `written` un devoir `pending` qui lui est assigné et qui a sa page. Rendre la page publique et dater le bloc « Séance » passent par les services ordinaires (elle a l'octroi), avant le changement d'état : si l'un échoue, le devoir reste à rendre.

## Conséquences

- `claim_journal_entry_grant` ne sert plus : retirée.
- Un devoir `pending` sans page (ancien parcours) n'a plus de chemin pour en recevoir une ; il n'en existe aucun dans la base au 1ᵉʳ novembre. Le MJ l'annule et le réassigne.
- Annuler un devoir non rendu efface aussi sa page (suppression douce).
- L'autrice garde son octroi après la validation ; le retirer reste un geste du MJ, comme pour toute fiche.
- Limite connue : la RLS d'`entities` laisse tout membre du monde lire le **nom** d'une fiche. Le titre provisoire d'un brouillon (« Journal · date ») est donc lisible par l'API, jamais son contenu ni sa page. Il ne révèle qu'un devoir en cours, ce que le journal de la campagne dit déjà.
- Coût (`docs/QUOTAS.md`) : une requête de plus par page joueuse (le devoir, dans la vague du layout) et une par filtre de visibilité côté joueur (les brouillons du monde, dans la vague existante).
