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

### ☐ V3.1-87 — Administration (B) : le tableau de bord · `M` · sans modèle IA — **prêt**

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

### ☐ V3.1-88 — Administration › Identité de l'application · `S` · sans modèle IA — **prêt**

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
