# 0105 — Le nom pour la table

**Date :** 2026-11-24
**Statut :** acceptée (AG-12, choix de l'auteur les 23 et 24 novembre)

## Contexte

La table a trouvé « le journal d'Aldren Voss » sans savoir à qui il est : le titre de la fiche gâche le secret. Or `entities.name` (et `aliases`, cherchables) est lisible par tout membre du monde (RLS d'`entities`) : un masquage à l'affichage ne protégerait rien (règle absolue 5).

## Options envisagées

- **A.** Une fiche « couverture » liée à la vraie : deux fiches à tenir, lourd pour un besoin ponctuel.
- **B.** Un champ « Nom pour la table » sur la fiche : `entities.name` devient le nom pour la table, le vrai nom part dans une table que le MJ seul lit. Retenu (« sans tout un système trop lourd derrière »).

## Décision

1. Table `entity_true_names` (vrai nom et ses alias), RLS : MJ du monde seul. Une ligne existe tant que le champ est rempli ; le vider remet le vrai nom (et ses alias) dans `entities` et supprime la ligne (`planNomTable`, noyau testé).
2. Le MJ voit le vrai nom dans l'en-tête de la fiche et l'y édite : `updateEntity` écrit alors dans `entity_true_names`, jamais dans `entities`. Le sommaire, la recherche, les onglets et tout ce que voit la table montrent le nom pour la table, MJ compris.
3. Les liens : remplir, changer ou vider le champ renomme les mentions de la fiche dont le texte est l'ancien nom (ou un ancien alias), dans le texte et l'Encadré (`renommerRefs`, choix du 24 novembre). Un texte de lien libre (« le vieux ») reste. Le vrai nom part dans `entity_true_names` avant que `entities` ne change : une écriture interrompue ne le perd jamais.
4. L'adresse de la fiche ne trahit rien : les slugs sont numériques depuis V0-06g.
5. Faille trouvée en le préparant : l'historique (`entity_revisions.snapshot`, instantané complet, blocs MJ compris) était lisible par tout membre. Sa lecture est désormais réservée au MJ, au superadmin et à qui peut modifier la fiche (migration 20261124130000, `docs/SECURITE.md`).

## Conséquences

- Ce que le MJ écrit lui-même ailleurs reste sous sa responsabilité : le résumé de la fiche, un bloc « Personnage » dont le prénom est visible, un texte qui écrit le vrai nom sans lien.
- La recherche du MJ ne trouve plus la fiche par son vrai nom tant que le champ est rempli.
- La duplication et l'export d'un monde ne recopient pas `entity_true_names` : la copie garde le nom pour la table comme nom.
- Coût : une lecture par clé de plus à l'ouverture d'une fiche côté MJ (et à chaque enregistrement de son en-tête) ; une lecture des blocs qui citent la fiche, puis une écriture par bloc renommé, quand le champ change.
