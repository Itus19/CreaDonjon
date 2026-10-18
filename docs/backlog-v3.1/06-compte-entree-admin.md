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
