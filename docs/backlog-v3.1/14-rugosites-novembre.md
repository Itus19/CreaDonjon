# Rugosités de novembre

Ce qu'on a constaté en jouant, à partir du 1ᵉʳ novembre. Même règle que le reste de V3.1 : un ticket par constat, taille `S` ou `M`.

---

### V3.1-150 — Le devoir de journal : la page naît à l'assignation, « Devoir fait » la publie, le MJ valide (sans modèle IA)

**Modèle conseillé : Opus** (schéma, RLS, sécurité). ADR 0071. Esquisse décidée le 1ᵉʳ novembre : canevas « Esquisse · Devoir de journal » (privé, celui de l'auteur), piste A.

**Le constat (1ᵉʳ novembre).** Une joueuse a écrit son résumé de séance dans son cahier de notes, l'a partagé, puis a passé la page partagée en type `session_journal` avec le sélecteur de type. La page n'apparaissait alors nulle part : le sommaire écarte ce type, et le Livre de sessions ne liste que les fiches rattachées à un devoir rédigé. En cause aussi, le parcours du devoir lui-même : un devoir assigné ne créait rien. Seule une bannière, en haut de l'onglet Wiki, permettait de créer la page. La joueuse ne l'avait jamais vue, et son devoir était resté « en attente » un mois. Elle avait aussi, sans le vouloir, un second compte (ouvert par le lien d'invitation réutilisable).

**Ce qui change.**

0. **Un type système ne se choisit plus à la main** (déjà fait, commit du 1ᵉʳ novembre). Le sélecteur ne propose plus `session_journal`, `shared_note` ni `world_timeline` comme catégories ; le serveur refuse d'entrer dans un type système ou d'en sortir (`canChangeEntityKind`), et la création libre d'une fiche le refuse aussi.
1. **Assigner crée la page.** Le MJ assigne le devoir : la fiche `session_journal` est créée aussitôt, titre provisoire « Journal · <date en jeu> », avec ses blocs « Séance » et « Récit », non publique (`is_public = false`). L'autrice reçoit l'octroi d'édition : la page est dans son onglet Édition. Le MJ peut s'assigner le devoir à lui-même.
2. **Tant qu'il n'est pas rendu, le devoir est masqué.** La page n'est ni dans le Livre, ni dans le sommaire, ni dans la recherche, ni dans les listes « lien vers une fiche » d'un autre joueur, et sa lecture directe dans le wiki joueur répond « introuvable ». Seuls l'autrice et le MJ la voient.
3. **« Devoir fait » publie, et c'est définitif.** L'autrice clique « Devoir fait » : le devoir passe à `written`, la page devient publique (`is_public = true`), la date de rédaction se pose dans le bloc « Séance », et le fait s'écrit au journal de la campagne. La page entre dans le Livre pour toute la table. Pas d'annulation.
4. **Le MJ valide.** Un nouvel état, `validated`, que seul le MJ pose (« Valider le devoir » dans le registre). La validation retire la mention du devoir de la barre de la joueuse. L'autrice garde son droit d'édition ; le MJ peut le lui retirer comme pour toute fiche.
5. **Côté joueuse, piste A.** Sous « Édition », dans le rail, une sous-entrée « Devoir de journal » : « À rendre » (pastille dorée) tant qu'il n'est pas rendu, « Rendu · à valider » ensuite, rien une fois validé. Sur la page du devoir, un bandeau : séance et date en jeu, bouton « Devoir fait » ; après le rendu, un bandeau vert. Au téléphone, une pastille sur l'entrée « Édition » de la barre flottante. La bannière de l'onglet Wiki disparaît.
6. **Côté MJ.** Le registre montre trois états : « En cours d'écriture », « Rendue · à valider », « Validée ». « Annuler le devoir » reste possible tant qu'il n'est pas rendu, et efface aussi la page encore vide de toute publication.

**Sécurité.** La joueuse pouvait jusqu'ici modifier n'importe quelle colonne de son devoir (politique `session_journal_entries_update`) : avec un état `validated`, elle se serait validée elle-même. La modification devient réservée au MJ ; la joueuse ne passe son propre devoir de `pending` à `written` que par une fonction étroite (`submit_journal_assignment`). L'ancienne fonction `claim_journal_entry_grant`, qui ne sert plus, est retirée.

**Hors du ticket.** Fusionner deux comptes d'une même personne ; empêcher qu'un lien d'invitation ouvre un second compte (à trancher à part si le cas revient). Un devoir « en attente » sans page n'existe pas dans la base au 1ᵉʳ novembre (les trois devoirs existants sont rédigés) : rien n'est prévu pour ce cas, le MJ l'annule et le réassigne.

**Critères d'acceptation.**
- [x] Assigner un devoir crée la page, l'octroi et les deux blocs ; la page est dans l'onglet Édition de l'autrice et nulle part ailleurs pour un autre joueur.
- [x] Un autre joueur ne trouve la page ni dans le Livre, ni dans le sommaire, ni par la recherche, et sa lecture directe répond « introuvable ».
- [x] « Devoir fait » : devoir `written`, page publique, date de rédaction posée, fait au journal ; la page est dans le Livre.
- [x] La joueuse ne peut ni valider son devoir, ni modifier ses autres colonnes, ni rendre le devoir d'une autre.
- [x] « Valider » (MJ seul) passe le devoir à `validated` ; la mention quitte la barre de la joueuse.
- [x] Annuler un devoir non rendu efface aussi sa page.
- [x] `npm run typecheck`, lint, tests unitaires ; test d'intégration `sessionJournalDevoir.integration.test.ts` contre la vraie base (après application de la migration).

**Sous-tâches Haiku.** Planche du catalogue (sous-entrée du rail, bandeau du devoir, pastilles d'état du registre).

**Fait le 1ᵉʳ novembre** (Opus seul : schéma, RLS, sécurité ; le contexte était chargé).
- **Noyau** `src/core/sessionJournal/devoir.ts` (tests d'abord) : états, `canSubmitDevoir`, `canValidateDevoir`, `canCancelDevoir`, `mentionDevoir`, `titreProvisoire` ; « à qui le tour » compte un devoir validé comme écrit.
- **Migration** `20261102130000_session_journal_devoir` : état `validated` et `validated_at` ; modification réservée au MJ ; `submit_journal_assignment` ; `claim_journal_entry_grant` retirée. Types mis à jour à la main.
- **Serveur** (`sessionJournal.ts`) : `assignJournalEntry` crée page, octroi, blocs et devoir (MJ et autrice de la campagne vérifiés avant ; page effacée si une écriture rate) ; `submitMyJournalAssignment` publie, date, puis rend ; `validateJournalAssignment` ; `cancelJournalAssignment` refuse un devoir rendu et efface la page ; `getMyOpenDevoir`, `getDevoirBandeau`. Brouillon masqué dans `listPlayerVisibleEntityIds` et `getPlayerEntityDetail`. Routes : `submit` (« Devoir fait », Zod strict), `validate` (nouvelle), assigner et annuler disent leurs refus ; annuler vérifie la campagne de l'adresse. Retirés : la route `my-assignment` et la bannière du Wiki.
- **Écrans** : `SousEntreeDevoir` dans le rail (`PlayerShell`), pastille sur « Édition » rail replié et au téléphone ; `BandeauDevoir` sur la page de l'onglet Édition ; registre MJ à trois états, « Devoir fait » pour le MJ autrice, « Valider le devoir ». Planche « Livre de sessions » (`OutilsMJ.dc.html`), `docs/CABLAGE.md`, `docs/SCHEMA.md`, registre de `docs/SECURITE.md`.
- **Vérifié** : typecheck ; lint des fichiers touchés ; tests unitaires (292 fichiers) dont `devoir.test.ts` et `sessionJournalGestes.test.ts` (16 cas : ordre des écritures, refus, journal). `sessionJournalDevoir.integration.test.ts` contre la base réelle, migration appliquée : 6/6 ; aucun monde de test laissé ; les trois devoirs existants intacts (`written`).

*Restes* : publier la planche sur le canevas du catalogue (CSS à recompiler, `docs/catalogue/README.md`) ; vérifier au navigateur (Testeur MJ assigne, Testeuse A rend, Testeur B ne voit rien avant) ; `/security-review` sur la branche.
