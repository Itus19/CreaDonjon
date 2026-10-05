# ADR 0037 — Une page de notes partagée avec la table devient sa propre entité

**Date** : 5 octobre 2026 · **Statut** : accepté le 5 octobre 2026 (principe validé par l'auteur, lot i de V3.1-19, bloc-notes A) ; les points « à trancher en codant » restent ouverts

## Contexte

L'auteur veut qu'une page du bloc-notes puisse être partagée avec la table : la table la lit, seule son autrice l'écrit. Aujourd'hui le cahier entier tient dans **un seul bloc** `note_tree`, sur l'entité `notes` privée de chaque compte (`src/server/services/notebook.ts`), en visibilité `user` de son autrice. La RLS ne sait donc rien des pages : elle laisse lire tout le bloc à l'autrice, et rien aux autres.

## Options

1. **Un drapeau « partagée » par page dans le bloc, filtré par le service.** Les autres comptes n'ont pas le droit de lire le bloc : il faudrait le client service-role, confiné à `publicShare.ts` (règle absolue 2). Écarté.
2. **Un bloc par page partagée, sur l'entité `notes` de l'autrice.** La visibilité du bloc s'ouvrirait à la table, mais l'entité `notes` reste privée par construction (`isOwnPrivateNotes`, `can_edit_entity`) : on mélangerait une entité privée et des blocs publics, cas que rien ne prévoit. Écarté.
3. **La page partagée devient sa propre entité**, sur le modèle du Livre de sessions (ADR et migration V2.1-15) : entité visible de la table, droit d'écriture de l'autrice porté par un vrai `entity_grants`, que le MJ peut reprendre.

## Décision

**Option 3.** Partager une page crée une entité (genre `shared_note`, valeur indicative de `entity_kind`) qui porte son titre et son contenu, visible de la table ; l'autrice reçoit l'octroi d'écriture par une fonction étroite, comme `claim_journal_entry_grant`. Dans le cahier, la page laisse place à un lien vers cette entité (même mécanisme que `pinned_entity`), marqué « partagée ». Ces entités ne rejoignent pas les listes du wiki (comme `session_journal`). Une fiche citée que la table n'a pas découverte s'affiche sans lien, filtrée côté serveur.

## À trancher en codant

- La « table » d'un monde qui a plusieurs campagnes : visibilité `campaign` sur la campagne active du cahier, ou `players` du monde.
- « Ne plus partager » : le contenu revient comme page privée du cahier et l'entité est supprimée en douceur, ou l'entité repasse en visibilité `user`.

## Conséquences

Pas de nouvelle table. Une migration (fonction d'octroi, éventuel filtre de liste) et `docs/SCHEMA.md` mis à jour dans le ticket qui code le partage. Le cahier privé ne change pas : ce qui n'est pas partagé n'est jamais envoyé à personne, MJ compris.
