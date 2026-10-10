# Backlog V3.1 — Tickets du compte, du choix du personnage, des écrans d'entrée et de l'administration (9 octobre)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Découpage des décisions du 9 octobre (sections « Compte », « Choix du
personnage », « Écrans d'entrée » et « Administration » de V3.1-19, plus
haut). Chaque ticket reprend la décision **en entier**.

### Comment lire ces tickets (à faire lire à Sonnet avant chaque ticket)

« Comment lire ces tickets » du lot i et de la fiche du wiki (plus haut)
vaut ici à l'identique : les planches font foi pour l'apparence et les
comportements ; leurs données sont des exemples ; jetons et recettes de la
charte plutôt que les couleurs en dur des planches ; libellés en français
dans `messages/` et `src/i18n/` ; typecheck + lint + test + planche du
catalogue avant de dire « fini ».

**Les planches** (canevas https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm,
rangée x = 5420, y ≈ 35 790 et dessous) :

| Fichier de planche | Contenu |
|---|---|
| `Compte-Decide.dc.html` | Compte (A) : ordinateur, tablette, téléphone ; Apparence = Personnalisation C |
| `Choix-Decide.dc.html` | Choix du personnage (C2) : carrousel ouvert sur « Nouveau personnage » |
| `Entree-Decide.dc.html` | Écran-titre (C), marque Antre Nous, panneau « Identité de l'application » |
| `Admin-Decide.dc.html` | Administration (B) : tableau de bord ; ordinateur, tablette, téléphone |

**Règles propres à ces tickets**
1. **Aucun geste ne disparaît.** Chaque ticket commence par relire les
   composants de départ et lister leurs gestes ; chacun reçoit une place.
2. **Le numéro (`handle_tag`) n'apparaît que dans Compte** (et chez le MJ
   de la campagne, V3.1-15) ; jamais dans Administration ni sur l'écran
   d'entrée (V3.1-10).
3. **Rien ne révèle l'existence d'un compte** : les messages de connexion
   et de mot de passe oublié sont identiques que le nom ou l'email existe
   ou non (comme `requestPasswordReset` et `requestResetByName` aujourd'hui).
4. Les écrans d'entrée sont hors connexion : ils ne lisent que des données
   publiques (l'identité de l'application, V3.1-84).

| Ticket | Contenu | Modèle | Dépend de |
|---|---|---|---|
| V3.1-80 | Compte (A) : page en sections, sommaire | Sonnet | 35 |
| V3.1-81 | Apparence du Compte = Personnalisation C | Sonnet | 80 |
| V3.1-82 | Choix du personnage (C2) : le carrousel | Sonnet | — |
| V3.1-83 | Choix : PJ sans fiche, « Créer mon personnage » | Sonnet | 82 |
| V3.1-84 | Identité de l'application : données (ADR) | **Opus** | — |
| V3.1-85 | Écran-titre (C) : connexion, création, oubli | Sonnet | 84 |
| V3.1-86 | La marque partout : rail, onglet, Rejoindre, Réinitialiser | Sonnet | 84, 85 |
| V3.1-87 | Administration (B) : tableau de bord | Sonnet | 35 |
| V3.1-88 | Administration › Identité de l'application | Sonnet | 84, 87 |
| V3.1-100 | Rejoindre sans choisir de PJ ; lien qui vise un PJ précis | **Opus** | 82, 83 |

**Ordre conseillé** : 84 (Opus) d'abord, en parallèle 80 → 81 et 82 → 83 ;
puis 85 → 86, 87 → 88.

---

### ☐ V3.1-80 — Compte (A) : une page en sections · `M` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Compte-Decide.dc.html`. **Départ** :
`components/shell/HomeProfilePanel.tsx` (et `DisplayNameForm`,
`PasswordForm`, `MyInvitePanel.tsx`, `DeleteAccountSection.tsx`),
`app/settings/actions.ts` (`setLocaleAction`), `app/page.tsx`.
**Dépend de** : V3.1-35 (« Compte » dans le rail de l'accueil).

**Ce qui est décidé**
- Une page « Compte » ouverte par l'entrée « Compte » du rail de l'accueil
  (au téléphone : Accueil › Compte, bouton « ‹ Accueil »). En-tête :
  « Compte » et une ligne de contexte (« Léonie · MJ d'un monde, joueuse
  dans trois », calculée).
- **Six sections empilées en cartes de verre**, dans cet ordre :
  1. **Identité** : nom affiché (champ + Enregistrer, `DisplayNameForm`) ;
     « Ton identifiant » : le nom et le numéro (`handle_tag`, en accent,
     chiffres tabulaires) avec la note « Le numéro distingue deux
     « Léonie ». Tu ne le tapes jamais pour te connecter ; il n'est visible
     qu'ici et par le MJ de tes campagnes. » ; l'email, seulement pour un
     compte à email (« · seulement pour les comptes ouverts avec un email »).
  2. **Connexion** : la note « Tu te connectes avec ton nom et ton mot de
     passe. Mot de passe oublié : ton MJ ou l'administrateur peut le
     réinitialiser — aucun email n'est envoyé. » (texte adapté pour un
     compte à email), nouveau mot de passe, « Encore une fois »,
     « Changer le mot de passe » (`PasswordForm`) ; « Les deux ne
     correspondent pas. » en rouge sous le bouton tant qu'ils diffèrent.
  3. **Mon lien d'invitation** (`MyInvitePanel`), **seulement si l'on a
     rejoint par un lien** : mot de passe du lien (vide pour retirer) +
     Enregistrer.
  4. **Apparence** : V3.1-81.
  5. **Langue** : deux pastilles Français / English (`setLocaleAction`,
     cookie + profil) et la note « Enregistrée sur ton compte (elle te suit
     d'un appareil à l'autre). Le contenu des mondes ne change pas de
     langue. »
  6. **Supprimer le compte**, bordure et titre en rouge
     (`DeleteAccountSection`) : ce qui est supprimé (le compte et les mondes
     dont on est propriétaire, nommés), « Tape SUPPRIMER », bouton
     « Supprimer définitivement » désactivé tant que le texte ne
     correspond pas.
- **Sommaire à gauche** (200 px) : Identité, Connexion, Mon lien
  d'invitation (absent si la section l'est), Apparence, Langue, Supprimer le
  compte (en rouge). Toucher une entrée fait défiler jusqu'à la section et
  l'allume (bordure d'accent) ; le défilement allume aussi l'entrée de la
  section visible.
- **Tablette** : le sommaire devient une rangée de pastilles en tête
  (Identité, Connexion, Invitation, Apparence, Langue, Supprimer).
  **Téléphone** : mêmes pastilles ; libellés au-dessus des champs ; un
  bouton à côté d'un champ (« Enregistrer », « Supprimer définitivement »)
  passe sous le champ plutôt que de se couper sur deux lignes.
- La colonne « Profil » de l'accueil disparaît (son contenu est ici).

**Critères d'acceptation**
- [ ] Chaque geste de `HomeProfilePanel` est présent et fonctionne.
- [ ] Le numéro n'apparaît qu'en Identité.
- [ ] « Mon lien d'invitation » est absent pour un compte qui n'a pas
  rejoint par un lien.
- [ ] Changer la langue bascule l'interface sans rechargement manuel.
- [ ] Téléphone 390 px : aucun bouton coupé, aucun défilement horizontal.

---

### ☐ V3.1-81 — L'Apparence du Compte est la Personnalisation C · `S` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Compte-Decide.dc.html`, section Apparence ;
`Perso-Decide.dc.html` (la Personnalisation décidée). **Départ** :
`components/shell/PersonnalisationPanel.tsx`. **Dépend de** : 80.

**Ce qui est décidé**
- La section Apparence **monte `PersonnalisationPanel` tel quel** (un code,
  deux portes : la fenêtre Personnalisation des outils du MJ, et le
  Compte, pour tout le monde). Pas de copie du composant.
- La barre : la **pilule des quatre modes** et le **contraste élevé** sur
  une ligne, le **flou du fond sur toute la largeur** en dessous ; puis la
  galerie des fonds avec leurs points de modes lisibles, les images
  personnelles (+, ×), et la note « Ces réglages sont les tiens, sur cet
  appareil… ».
- Tablette : galerie à deux vignettes. **Téléphone** : la barre en colonne
  (modes, contraste, flou), galerie à deux colonnes. **Piège corrigé sur la
  planche le 9 octobre** : en colonne, ne jamais donner au flou
  `flex-basis: 100%` (cela devient toute la hauteur et pousse le réglage
  hors de l'écran) ; libellés de la pilule en 11 px pour que
  « Demi-sombre » tienne.

**Critères d'acceptation**
- [ ] Un compte joueur sans monde mené règle son mode et son fond depuis
  Compte (critère déjà posé par V3.1-35).
- [ ] Téléphone 390 px : le flou est entièrement visible et réglable.
- [ ] Aucune duplication de `PersonnalisationPanel`.

---

### ☐ V3.1-82 — Choix du personnage (C2) : le carrousel · `M` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Choix-Decide.dc.html`. **Départ** :
`app/m/[worldSlug]/joueur/ChooseCharacterScreen.tsx`,
`app/m/[worldSlug]/joueur/page.tsx`, `listUnclaimedCharacters`
(`src/server/services/campaigns.ts`), `claimCharacterAction`.

**Ce qui est décidé**
- **Données** : `listUnclaimedCharacters` renvoie en plus, pour chaque PJ
  ouvert : le **portrait** (`entity_assets`, rôle `portrait`, URL signée
  comme ailleurs), le **`summary`**, et l'**identité calculée** par
  `characterSheet()` — espèce, classe(s) et niveau — ou `hasSheet: false`
  quand l'entité n'a pas de bloc `character`. Une requête groupée (pas de
  N+1). Rien n'est stocké (règle 16) ; seules les fiches visibles par la
  joueuse (règle 5).
- **Le carrousel** : la carte au centre en grand (portrait 330 px de haut,
  nom, « Elfe · Rôdeuse 3 » en accent, la phrase), bordure d'accent et
  halo ; ses voisines en retrait de part et d'autre (échelle 0,8, opacité
  0,45, désaturées) ; au-delà, masquées. Flèches ‹ ›, points (le point
  courant s'allonge), touches ← →, glisser au doigt ; le carrousel boucle.
  Toucher une voisine la centre.
- **« Nouveau personnage » est la dernière carte** : pointillés, grand +
  en accent, « Le tien, de zéro : l'assistant de création, pas à pas. »
- **La page s'ouvre sur « Nouveau personnage »** (à sa gauche le dernier
  PJ ouvert, à sa droite le premier). Sans PJ ouvert : la carte est seule,
  sans flèches ni points.
- **Arrivée par un lien qui vise un PJ précis** (V3.1-100) : le carrousel
  ne montre que **ce PJ et « Nouveau personnage »** (au cas où), et
  **s'ouvre sur le PJ**. Le composant reçoit la liste et la carte de départ
  du serveur ; il ne filtre rien lui-même.
- **Un seul bouton** sous le carrousel : « Jouer Naivara » (prénom), ou
  « + Créer mon personnage » quand la carte « Nouveau » est centrée.
  « Jouer » réclame (`claimCharacterAction`) puis l'onglet Personnage
  affiche la fiche jouable. Message après réclamation : « Naivara est à
  toi : l'onglet Personnage montre maintenant sa fiche. Ton MJ peut encore
  le réattribuer. » Échec (déjà pris) : message de l'action, le carrousel
  se recharge.
- En-tête : « Choisis ton personnage » et « {monde} · {campagne} — ton MJ
  a laissé {n} personnages ouverts. Tu peux aussi créer le tien. »
- **Tablette** : même carrousel, sans flèches, cartes de 280 px.
  **Téléphone** (onglet Perso. de la barre du joueur) : carte de 250 px,
  voisines qui dépassent des bords, bouton sur toute la largeur au-dessus
  de la barre.

**Critères d'acceptation**
- [ ] À l'ouverture, « Nouveau personnage » est centrée.
- [ ] Clavier : ← → font tourner ; Entrée déclenche le bouton.
- [ ] Une seule requête pour la liste enrichie (vérifiée en test de service).
- [ ] Un PJ caché à la joueuse n'apparaît pas.

---

### ☐ V3.1-83 — Choix : PJ sans fiche et « Créer mon personnage » · `S` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Choix-Decide.dc.html` (Mirelle Vantor, 3ᵉ carte).
**Départ** : `components/shell/ParticipantCharacterSheet.tsx` (`wizardOpen`,
« Aucune fiche de personnage pour cette entrée »),
`components/blocks/CharacterCreatorWizard.tsx`. **Dépend de** : 82.

**Ce qui est décidé**
- **PJ ouvert sans fiche** (`hasSheet: false`) : la carte garde portrait et
  phrase de la fiche de wiki ; à la place de l'espèce et de la classe,
  l'étiquette pointillée en accent « Fiche de personnage à créer » ; le
  bouton dit « Jouer Mirelle · créer sa fiche ». Réclamer **ouvre
  directement l'assistant de création** (la Création décidée, A), déjà au
  nom et au portrait de l'entité — plus besoin de toucher « Créer la
  fiche » sous « Aucune fiche de personnage ».
- **« + Créer mon personnage »** ouvre l'assistant sur une **entité
  nouvelle** ; la joueuse la réclame à la fin de l'assistant (même chemin
  serveur que la création depuis « Nouveau PJ » aujourd'hui). Annuler
  l'assistant revient au carrousel, rien n'est créé.

**Critères d'acceptation**
- [ ] Réclamer un PJ sans fiche ouvre l'assistant avec son nom pré-rempli.
- [ ] Créer un personnage de zéro le rend réclamé par la joueuse.
- [ ] Annuler ne laisse ni entité ni réclamation orpheline.

---

### ☐ V3.1-84 — Identité de l'application : où elle vit (ADR) · `M` — **prêt (Opus)**

**Modèle conseillé : Opus** — changement de schéma, RLS lue avant
connexion, téléversement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Ce qui est décidé (auteur, 9 octobre)** : la marque par défaut est
**« Antre Nous »**, phrase **« Le repaire de ta table. »**, logo **d20**
au trait ; le superadmin peut changer **nom** (32 caractères), **phrase**
(80), **logo** (l'un des douze au trait, ou une image téléversée PNG ou
WebP carrée de 512 px ; **jamais de SVG téléversé**, il peut porter du
script).

**À trancher, ADR à l'appui** (rien n'existe dans `docs/SCHEMA.md`) :
- Proposé : une table à **ligne unique** `app_identity` (`name`, `tagline`,
  `logo_key` parmi `d20`, `dungeon_door`, `dragon_eye`, `dice_cup`,
  `quill_die`, `key`, `grimoire`, `tower`, `maze`, `scale`, `lair`, `map`,
  `logo_asset_path` nullable via l'interface de stockage, `updated_at`,
  `updated_by`). RLS : lecture pour tous **y compris anonyme** (l'écran-titre
  la lit avant connexion), écriture réservée au superadmin
  (`is_superadmin()`). Aucune ligne → valeurs par défaut de `messages/`.
- Les douze logos sont des SVG **du code** (`components/brand/logos.tsx`),
  jamais des données ; Zod valide `logo_key` contre cette liste.
- Service `getAppIdentity()` (cache court, invalidé à l'écriture) et
  action `updateAppIdentityAction` (Zod, superadmin vérifié côté serveur).
- Contrôle du téléversement : type réel du fichier (signature), pas
  l'extension ; taille bornée.

**Critères d'acceptation**
- [ ] ADR écrit ; migration nouvelle ; `docs/SCHEMA.md` à jour ; types
  régénérés.
- [ ] Un visiteur non connecté lit l'identité ; un compte non superadmin ne
  peut pas l'écrire (test RLS).
- [ ] Un SVG renommé en .png est refusé.

---

### ☐ V3.1-85 — Écran-titre (C) : connexion, création, mot de passe oublié · `M` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Entree-Decide.dc.html`. **Départ** : `app/login/page.tsx`,
`app/login/actions.ts`, `app/auth/forgot-password/`. **Dépend de** : 84.

**Ce qui est décidé**
- **Le fond** de l'application (le fond par défaut), flouté et voilé ; au
  tiers haut, **la tuile du logo** (84 px, accent) **et le nom en très
  grand** (Outfit 800, ~72 px) sur une ligne, la **phrase d'accueil**
  dessous — lus dans `getAppIdentity()`.
- **Le menu** : trois gros boutons pilule de 340 px — **« Se connecter »**
  (plein, accent), **« Créer un compte »**, **« J'ai un lien
  d'invitation »** (verre). Survol : légère mise à l'échelle et bordure
  d'accent.
- Choisir **ouvre un panneau de verre (380 px) à la place du menu**,
  « ‹ Menu » en tête, son titre (« Bon retour », « Bienvenue », « Mot de
  passe oublié ») :
  - **Se connecter** : « Ton nom ou ton email », « Mot de passe », bouton,
    « Mot de passe oublié ? » en lien (action `login` inchangée).
  - **Créer un compte** : « Ton nom », « Mot de passe » (8 caractères au
    moins), la note « Pas d'email : tu te connectes avec ton nom et ce mot
    de passe. Un numéro (#4821) distingue deux comptes du même nom ; seul
    le MJ de tes campagnes le voit. Le compte n'ouvre aucun monde tant
    qu'on ne t'y invite pas. », « Créer mon compte » (`createAccount`).
  - **Mot de passe oublié — un seul champ** « Ton nom ou ton email » :
    une action nouvelle `requestResetAction` (Zod) qui choisit la voie —
    s'il y a un « @ », le chemin email (`requestPasswordReset`) ; sinon la
    demande au MJ (`requestResetByName`). **Réponse identique dans tous
    les cas** : « Demande envoyée. Si ce compte existe, un lien part vers
    son email, ou ton MJ reçoit la demande dans son panneau. »
    « ‹ Revenir à la connexion ».
  - **J'ai un lien d'invitation** : un champ pour coller le lien, qui mène
    à `/rejoindre/[token]` (le jeton est extrait côté client ; un lien
    invalide donne le message actuel « Ce lien n'est plus valide »).
- `/signup` (compte à email) ne change pas et n'est pas lié depuis ici.
- **Téléphone** : titre 46 px, logo au-dessus du nom ; menu de 300 px ;
  panneau de 340 px. Tablette : comme l'ordinateur.

**Critères d'acceptation**
- [ ] Les trois actions existantes fonctionnent depuis le nouvel écran.
- [ ] Mot de passe oublié : même message pour un nom inconnu, un nom connu,
  un email inconnu, un email connu (test).
- [ ] Le nom, la phrase et le logo viennent de l'identité (V3.1-84).

---

### ☐ V3.1-86 — La marque partout : rail, onglet, Rejoindre, Réinitialiser · `S` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : `Entree-Decide.dc.html`, `Admin-Decide.dc.html` (tête du
rail). **Départ** : `app/layout.tsx` (`metadata.title`),
`app/rejoindre/[token]/` (`InvitePasswordGate`, `JoinForm`),
`app/reinitialiser/[token]/ResetPasswordForm.tsx`, le rail de l'accueil.
**Dépend de** : 84, 85.

**Ce qui est décidé**
- **Tête du rail de l'accueil** (hors d'un monde) : la tuile du logo et le
  nom de l'application (à la place du nom du monde). Dans un monde, rien
  ne change.
- **Onglet du navigateur** : titre = nom de l'application
  (`generateMetadata` lisant `getAppIdentity()`), favicon = le logo choisi
  (les douze sont dessinés en clair sur la tuile d'accent ; image
  téléversée sinon).
- **Rejoindre, sa porte à mot de passe, Réinitialiser** prennent le cadre
  de l'écran-titre : même fond, même titre ; le panneau de verre à la
  place du menu porte leur formulaire **actuel** (rôle, nom, mot de passe ;
  nouveau mot de passe) — **sans le choix du personnage** : la joueuse le
  fait ensuite dans le carrousel (V3.1-100).

**Critères d'acceptation**
- [ ] Changer le nom en administration change l'onglet du navigateur au
  rechargement suivant.
- [ ] Les trois formulaires gardent tous leurs champs et messages, sauf le
  choix du personnage de Rejoindre (déplacé, V3.1-100).

---

### ☐ V3.1-87 — Administration (B) : le tableau de bord · `M` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Admin-Decide.dc.html`. **Départ** :
`components/shell/AdminPanel.tsx` (`InviteAdminRow`, `AccountAdminRow`),
`app/page.tsx`, `/api/admin/invites`, `/api/admin/accounts`. **Dépend
de** : V3.1-35 (« Administration » dans le rail, superadmin seulement).

**Ce qui est décidé**
- Une page « Administration » (« Superadmin seulement · toute la
  plateforme »), vérifiée côté serveur (`isSuperadmin`) avant tout rendu.
- **Cinq tuiles** en tête : **À traiter** (le nombre en accent),
  **Comptes**, **Liens d'invitation actifs**, **Identité de
  l'application** (tuile du logo + nom), **Titres des joueurs** (nombre de
  titres ; panneau : V3.1-92). La tuile choisie (bordure
  d'accent) ouvre sa liste dessous. **La page s'ouvre sur « À traiter »**,
  ou sur Comptes s'il n'y a rien à traiter.
- **À traiter** : une ligne par compte avec `password_reset_requested_at`
  (« Tamara a demandé une réinitialisation de mot de passe · il y a 2 h ·
  compte sans email »), bordure d'accent, bouton **« Forcer une
  réinitialisation »** (geste existant ; le lien à usage unique s'affiche
  comme aujourd'hui, « à transmettre hors application »). Puis, sans
  geste, les comptes avec `must_change_password` (« doit changer son mot
  de passe à sa prochaine connexion · rien à faire, pour mémoire »). Note :
  « Les demandes de réinitialisation arrivent aussi chez le MJ de la
  campagne ; ici, celles de tous les comptes. »
- **Comptes** : recherche par nom (filtrage côté client) ; une ligne de
  verre par compte : initiale, nom, « depuis le … », étiquettes
  (**superadmin** violet, **Réinitialisation demandée · il y a …** accent,
  **Doit changer son mot de passe** neutre), ⋮ avec les gestes
  d'`AccountAdminRow` **inchangés** (forcer une réinitialisation,
  transférer un ruleset…, supprimer le compte en rouge + `ConfirmDialog`).
  Jamais le numéro.
- **Liens d'invitation** : en-têtes Monde, Campagne, Rôle, Réclamé par,
  État ; une ligne de verre par lien ; ⋮ avec les gestes d'`InviteAdminRow`
  **inchangés** (copier le lien, voir comme, mot de passe, réinitialiser le
  lien, révoquer, supprimer le compte ; destructeurs en rouge et
  confirmés).
- **Tablette** : tuiles en 2 × 2 ; ligne de lien sur deux lignes, en-têtes
  masqués, ⋮ en haut à droite. **Téléphone** : Accueil › Administration,
  « ‹ Accueil », tuiles en 2 × 2, nom de la tuile Identité sur une ligne
  (15 px).
- La section Administration de l'accueil disparaît (son contenu est ici).

**Critères d'acceptation**
- [ ] Chaque geste d'`AdminPanel` est présent et fonctionne.
- [ ] Un compte non superadmin reçoit une 404 sur la page (pas un écran vide).
- [ ] Les compteurs des tuiles suivent les gestes sans rechargement.

---

### ☐ V3.1-88 — Administration › Identité de l'application · `S` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : `Entree-Decide.dc.html` (panneau de droite),
`Admin-Decide.dc.html` (tuile Identité). **Dépend de** : 84, 87.

**Ce qui est décidé**
- La tuile « Identité de l'application » ouvre le panneau : note « Ce que
  voient tous les visiteurs : l'écran-titre, le rail, l'onglet du
  navigateur. Un changement s'applique à tous, aussitôt enregistré. » ;
  **Nom** (32), **Phrase d'accueil** (80) ; **Logo** : grille des douze
  tuiles (7 par rangée ; 4 sur tablette et téléphone), le choisi bordé
  d'accent, puis « + Téléverser » (PNG ou WebP carré, 512 px ; note
  « jamais de SVG téléversé (il peut contenir du script) ») ; **Aperçu**
  en direct (fond flouté, tuile, nom, phrase) ; **Enregistrer** (« Enregistré
  ✓ ») et **« Rétablir « Antre Nous » »**.
- Écriture par `updateAppIdentityAction` (V3.1-84).

**Critères d'acceptation**
- [ ] L'aperçu suit la saisie sans enregistrer.
- [ ] Enregistrer change l'écran-titre et la tête du rail pour tous.
- [ ] Rétablir revient au nom, à la phrase et au d20 par défaut.

---

### ☐ V3.1-100 — Rejoindre sans choisir de PJ ; le lien qui vise un PJ précis · `M` — **prêt (Opus) — conçu le 9 octobre, ADR 0049**

**Modèle conseillé : Opus** — parcours d'adhésion, une colonne nouvelle,
une réservation à faire respecter côté serveur.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Décision de l'auteur (9 octobre)**
- **Rejoindre une table ne demande plus de choisir un PJ.** L'écran
  Rejoindre (V3.1-86) garde rôle, nom et mot de passe ; la joueuse arrive
  ensuite sur le **carrousel** (V3.1-82), ouvert sur « Nouveau personnage ».
  Plus de blocage « Aucun personnage disponible » (V3.1-14).
- **Un lien peut viser un PJ précis** (« ce lien est pour Naivara ») : la
  joueuse qui l'ouvre voit un carrousel réduit à **ce PJ et « Nouveau
  personnage »** (au cas où), **ouvert sur le PJ**.

**Constat (lu le 9 octobre)** : `campaign_invites` n'a pas de colonne de
personnage ; `accountProvisioning.ts` refuse un rôle joueur sans
`entityId` (`missing_entity`) et réclame le PJ au moment de rejoindre.

**À concevoir, ADR à l'appui**
- `campaign_invites.entity_id uuid null` (lien nominatif) ; la génération
  d'un lien joueur dans Gestion de campagne gagne « pour : [PJ ▾]
  (facultatif) » (avec V3.1-54).
- Adhésion sans réclamation : `accountProvisioning` accepte un joueur sans
  `entityId` ; la réclamation se fait ensuite par le carrousel.
- **Réservation** : tant que le lien nominatif est actif et non utilisé, son
  PJ n'apparaît pas dans le carrousel des autres joueuses ; la joueuse
  arrivée par ce lien peut le réclamer même s'il n'est pas « ouvert ». La
  règle est vérifiée par le serveur à la réclamation, pas seulement à
  l'affichage.
- Le serveur dit au carrousel quoi montrer et sur quelle carte s'ouvrir
  (V3.1-82).

**Critères d'acceptation**
- [ ] Une joueuse rejoint par un lien ouvert sans aucun PJ disponible, puis
  crée le sien depuis le carrousel.
- [ ] Par un lien nominatif : carrousel réduit au PJ visé et à « Nouveau
  personnage », ouvert sur le PJ ; une autre joueuse ne voit pas ce PJ.
- [ ] Réclamer le PJ réservé avec un autre compte est refusé par le serveur
  (test).
