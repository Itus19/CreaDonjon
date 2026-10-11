# Vérification du 11 octobre 2026 : fiches du Banc d'essai et Initiative

Session de vérification (docs/TESTS.md §4 bis). Application en `npm run dev`, Chromium piloté par Playwright, un navigateur séparé par compte. Comptes : Testeur MJ, Testeuse A, Testeur B. Monde : `/m/banc-d-essai` uniquement. Captures : `2026-10-11-fiches-banc/`.

## Préparation

- Variables présentes : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MANUAL_TEST_PASSWORD`. Aucune valeur affichée.
- `npm ci` OK, serveur de développement prêt. Connexion des trois comptes par nom et mot de passe : OK (`POST /login` 303).
- Aucune écriture en base hors de l'interface. Une seule requête lancée à la main : un `POST /api/worlds/banc-d-essai/resolved-ruleset` sans effet en base, avec un corps mal formé de ma part. Réponse 400, sans rapport avec l'application.

## Testeuse A : « PJ de Testeuse A »

Entrée : onglet Personnage, bouton « Créer mon personnage » (le PJ n'avait pas de fiche, `GET /api/entities/…/blocks` renvoyait `[]`).

| Étape | Choix | Résultat |
|---|---|---|
| 1. Identité | nom conservé | OK |
| 2. Espèce | Humain | OK |
| 3. Classe | Guerrier niveau 1, équipement de classe Choix A | OK |
| 4. Caractéristiques | tableau standard : FOR 15, DEX 13, CON 14, INT 10, SAG 12, CHA 8 | OK |
| 5. Historique | Soldat, Choix A (boîte de jeux : Dés), bonus FOR +2, CON +1 | OK (voir pilotage) |
| 6. Équipement | cotte de mailles et épée à deux mains équipées ; 18 po | OK |
| 7. Compétences | maîtrises d'arme : épée à deux mains, javeline, fléau d'armes ; langues : elfique, nain ; Perception, Intuition (Guerrier), Survie (Humain Polyvalent) | OK |
| 8. Aperçu, puis « Enregistrer le personnage » | | OK (`POST /m/banc-d-essai/joueur` 200) |

- Fiche jouable : **CA 16, PV max 12**, FOR 17, CON 15, vitesse 6,1 m (encombré). C'est cohérent : 10 + CON +2 = 12, et la cotte de mailles donne CA 16.
- Jet d'Athlétisme : OK, `POST /api/entities/…/actions/skill-check` 200. Dé lancé par le serveur : 9 + 5 = 14, enregistré dans l'historique de campagne.

## Testeur B : « PJ de Testeur B »

| Étape | Choix | Résultat |
|---|---|---|
| Espèce | Nain | OK |
| Classe | Clerc niveau 1, Choix A (symbole sacré : Amulette) | OK |
| Caractéristiques | tableau standard : SAG 15, CON 14, FOR 13, DEX 12, INT 10, CHA 8 | OK |
| Historique | Acolyte, Choix A (symbole sacré : Emblème), bonus SAG +2, INT +1 | OK |
| Équipement | chemise de mailles, bouclier, masse d'armes équipés ; 15 po | OK |
| Compétences | langues : nain, céleste ; Médecine, Persuasion | OK |
| Sorts | mineurs : Flamme sacrée, Assistance, Thaumaturgie ; préparés : Soins, Bénédiction, Bouclier de la foi, Injonction | OK (3/3, 4/4) |
| Enregistrement | | OK (`POST /m/banc-d-essai/joueur` 200) |

- Fiche jouable : **CA 16, PV max 10**. La CA est juste : chemise de mailles 13 + DEX 1 + bouclier 2. **Les PV ne le sont pas, ils devraient valoir 11** (voir défaut 1).
- Jet de Médecine : OK, `skill-check` 200, 4 + 5 = 9.

## Testeur MJ : outil Initiative

- Nouveau combat : OK, `POST /api/campaigns/…/combats` 201. Le premier clic a mis plusieurs secondes à répondre (compilation de la route en mode dev). Un seul combat a été créé.
- « + Ajouter » : le premier menu s'ouvre sur « Monstre du ruleset » ; « Personnage joueur » est choisi. Lors des ajouts suivants, le menu garde le dernier type choisi.
- PJ de Testeur B : `POST …/participants` 201, CA 16, PV 10/10, comme la fiche.
- PJ de Testeuse A : `POST …/participants` 201, CA 16, PV 12/12, comme la fiche.
- Gobelin en saisie libre : `POST …/participants` 201 avec CA et PV vides. La CA 15 se règle ensuite sur la ligne (`PATCH …/participants/…` 200). **Les PV 7 n'ont pas pu être saisis** (voir défaut 2).
- « Lancer toutes les initiatives » : `POST …/roll-initiative` 200. Résultats : A 16, B 13, Gobelin 2.
- « ▶ Go » : `POST …/begin` 200, round 1, tour de Testeuse A. « ▷ » : `POST …/turn` 200, tour de Testeur B.

## Testeur B pendant le combat

- Écrans parcourus : Personnage, Accueil, Chat, Fiche. Le Gobelin n'y apparaît jamais. Sur 85 réponses reçues par la page (JSON, RSC, HTML), aucune ne contient « Gobelin » ni l'identifiant du participant.
- `GET /api/campaigns/…/combats` et `GET …/combats/<id>` répondent 403 « Réservé au MJ de la campagne. ». La CA et les PV du Gobelin ne fuient donc pas.
- Remarque : il n'existe aucune vue joueur du combat. Testeur B ne peut donc pas « suivre le tour » comme le prévoit la ligne Combat de TESTS.md §4.

## Défauts constatés (application)

1. **Ténacité naine ignorée** (Nain, Clerc 1) : PV max 10 au lieu de 11. La réponse `GET /api/entities/…/sheet` ne liste comme sources que « Des de vie (1d8) » 8 et « Constitution » 2. Le trait est pourtant affiché à l'étape Espèce.
2. **Saisie libre sans PV** : la ligne PV d'un participant n'est affichée que si ses PV max sont renseignés. Or le formulaire de saisie libre ne demande que le nom. Impossible de donner 7 PV au Gobelin depuis l'interface.
3. **Fiche jouable juste après l'enregistrement** : pendant quelques secondes, elle affiche CA 11, PV 0/0, dés de vie vides, « Aucune arme équipée » et aucun bonus d'historique. Elle se corrige ensuite toute seule à CA 16, PV 12/12 (capture `a-09`). Les données enregistrées étaient justes dès le départ.
4. **Liste « Mes combats »** : elle affiche « Pas engagé » alors que le combat est commencé, puis terminé. L'en-tête, lui, passe bien à « Commencé » puis « Terminé ».
5. **Assistant, étape Compétences** :
   - « Lance » apparaît deux fois dans les maîtrises d'arme ;
   - « Déjà acquis » affiche en anglais « Tool: Calligrapher's Supplies » (Acolyte) ;
   - côté Guerrier, la maîtrise d'outil du Soldat n'y figure pas.
6. **Assistant, choix absents** : aucun Style de combat proposé au Guerrier 1, aucun Ordre divin au Clerc 1 (règles 2024). Je n'ai pas vérifié s'ils ont été écartés volontairement.
7. **Espèce Humain** : le trait « Polyvalente » (propriété d'arme) est listé parmi ses traits, sans doute une confusion de référence avec « Polyvalent ». La taille Moyen/Petit ne propose aucun choix. Vitesses affichées en « 9.1 m » (point décimal anglais, au lieu de 9 m).
8. **Inventaire** :
   - pendant le chargement, les objets s'affichent sous leur clé technique (`chain-mail`, `greatsword`…) ;
   - la masse d'armes pèse 0,9 kg (le SRD donne 4 lb ≈ 1,8 kg) ;
   - le Guerrier est « Encombré (vitesse −3 m) » avec 75 kg pour une FOR de 17 : la règle d'encombrement variante est appliquée ; à confirmer si c'est voulu.
9. Les sources de CA de la fiche gardent les clés techniques (`chain-shirt`, `shield`) dans le JSON.

## Incidents de pilotage (pas des défauts)

- Historique : le bonus de caractéristique et la sélection du Choix A ne semblaient pas répondre. En réalité, la résolution du ruleset n'était pas encore revenue (première compilation), et mon clic au centre de l'encadré tombait sur la ligne « au choix », qui arrête volontairement la propagation. Un clic dans le coin de l'encadré a fonctionné.
- Les boutons +/− du bonus d'historique se désignent par leur `title`, pas par un nom accessible : le nom calculé est « ▲ ».

## Ménage

- Combat : terminé (`POST …/end` 200), puis supprimé (`DELETE` 200, `{"ok":true}`). Après rechargement : « Mes combats (0) », et `GET …/combats` renvoie `{"combats":[]}`.
- Les fiches des deux PJ restent en place, comme prévu au §3.
- Deux jets de compétence restent dans l'historique des dés de la campagne (Athlétisme 14, Médecine 9).
- Aucun compte créé ni supprimé, aucun autre monde touché.
