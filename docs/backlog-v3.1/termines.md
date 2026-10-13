

---

### ☑ V3.1-48 — Création : identité, prénom, nom, naissance au calendrier du monde · `M` · sans modèle IA — **fait le 13 octobre (ADR 0063)**

**Modèle conseillé : Sonnet** — décision prise ; ADR à écrire d'après elle, noyau pur, tests d'abord.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Creation-Decide.dc.html` (étape Identité). **Départ** :
`src/core/schemas/blocks/character.ts` (+ test),
`components/blocks/characterCreatorSteps/IdentityStep.tsx`,
`src/core/calendar/` (types, `formatDate.ts`).

**Ce qui est décidé (auteur, 5 octobre)**
- Deux champs **Prénom** et **Nom** (`given_name`, `family_name` dans le bloc
  `character`), puis genre et pronoms. Le nom de l'entité (wiki, mentions,
  recherche) reste « Prénom Nom », composé à la création et **recomposé
  automatiquement** quand on édite le prénom ou le nom.
- **Naissance** : on saisit l'âge (± ou au clavier) et on choisit jour et
  mois (les mois du calendrier du monde). L'année se calcule depuis
  `calendar.currentDate` : année du jour − âge, moins un si l'anniversaire
  n'est pas encore passé cette année (121 ans au 14 Germinal 1492, né un
  3 Messidor → 1370). Une phrase résume : « Née le 3 Messidor 1370 ·
  121 ans au 14 Germinal 1492 ». Sans date du jour réglée par le MJ,
  l'année se saisit à la main et l'âge attend la date du jour.
- **Règle 16** : la fiche stocke la **date de naissance** (`GameDate`), plus
  l'âge ; l'âge est **dérivé** de la date du jour en jeu et vieillit avec la
  campagne.
- **Reprise** : un `age` existant devient une date de naissance au 1er du
  premier mois, à corriger à la main (lecture tolérante dans Zod, test de
  relecture d'une fiche ancienne).

**À faire** : écrire l'ADR (décision ci-dessus, dix lignes) ; fonctions
pures `birthYearFromAge` et `ageAt` dans `src/core/calendar` (tests
d'abord, mois de longueurs différentes, anniversaire le jour même) ;
schéma Zod ; recomposition du nom côté serveur.

**Critères d'acceptation**
- [x] Le cas « 121 ans au 14 Germinal 1492, né un 3 Messidor → 1370 », et le cas « anniversaire aujourd'hui », en tests.
- [x] Une fiche enregistrée avec `age` se relit (test) ; l'âge affiché est calculé, jamais stocké.
- [x] Éditer le prénom renomme l'entité ; ~~les mentions suivent~~ les mentions pointent toujours l'entité par `id`, leur libellé écrit n'est jamais réécrit (spec §A1 ; reformulé le 13 octobre) (test serveur).
- [x] Les trois lecteurs actuels du champ `age` (V3-Z1) passent à l'âge dérivé : la rangée d'identité de `CharacterSheetHeader` (avec `AgeInput`), la colonne solo, et le refus de `applyLevelUp` (`forbidden_field_change`), qui porte désormais sur la date de naissance.
- [ ] *Repris de V3-Z1 (12 octobre)* : vérifié à la main dans l'assistant, la barre d'étapes, Précédent / Suivant et l'Aperçu avec l'étape Identité (`docs/TESTS.md` §4, Fiche).

**Note de clôture (13 octobre, Opus).** [ADR 0063](../adr/0063-naissance-en-date-de-jeu.md). Codé par Sonnet ; relu, et deux défauts locaux corrigés par Opus (précision « mois » d'une naissance sans jour ; import relatif dans le noyau).

*Décisions prises en route :*
- **Mentions** : une mention garde le texte que l'auteur a écrit (« le tavernier » pour Bram), comme le veut la spec. Le renommage ne casse aucun lien, puisque tout passe par l'`id`.
- **Calendrier** : le layout du monde le lit côté serveur, en même temps que le reste (une lecture d'une colonne par rendu, QUOTAS Q1), et le partage par un contexte (`WorldCalendarProvider`). Aucun écran ne le demande au montage.

*Vérifié* :
- 26 tests unitaires et 1 test d'intégration (renommage et mentions) ;
- en vrai, sur la fiche de Testeur B : Prénom, Nom, Âge, Jour, Mois ; son monde n'a pas de date du jour, donc « Année de naissance » s'affiche.

*À voir par l'auteur* : l'assistant avec une date du jour réglée (121 ans, 3 Messidor → « Née le 3 Messidor 1370 · 121 ans au 14 Germinal 1492 »).

*Reste* : une fiche ancienne qui n'a qu'un `age` devient une date de naissance à la première édition de l'âge, pas avant.
