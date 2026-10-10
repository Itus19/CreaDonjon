# Backlog V3.1 — La refonte « verre minéral » : ticket parent et décisions transverses (V3.1-19 à 23)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

### ☐ V3.1-19 — Refonte « verre minéral » (ticket parent) · `XL` — **lots a à h découpés (V3.1-24 à 36) ; lot i découpé (V3.1-41 à 62)**

**Modèle conseillé : Opus** — ticket parent : la conception et le découpage ; chaque lot décidé se code ensuite avec Sonnet, sauf mention contraire.

Ce ticket regroupe **toute** la refonte graphique en cours. Chaque lot se code
et se livre seul, dans l'ordre qu'on voudra ; le ticket est fini quand tous les
lots le sont.

| Lot | Contenu | État |
|---|---|---|
| a | Rail repliable, MJ + joueur, desktop et tablette | décidé, à coder |
| b | Dalle « Outils » : dés encochés + radio (point vert/rouge) | décidé, à coder |
| c | Téléphone : barre flottante à six entrées et dé encoché (MJ : Monde, Règles, Fiches, Table, Chat, Outils ; joueur : Perso., Édition, Notes, Wiki, Règles, Chat), feuilles du bas, wiki et règles (☰ + récents), éditeur plein écran en accordéon, outil de dés | décidé, à coder — planches définitives |
| d | Ailes du solo : bande repliée (bouclier CA, PV, Niveau, Charge) ; téléphone : modèle A (Jeu, Monde, Fiche \| Quêtes, Règles, Notes) | décidé, à coder — planches définitives |
| e | Fiche de personnage à jauges circulaires, commande E ; onglets en pilule glissante | décidé, à coder |
| f | Tablette : la fiche s'adapte à sa fenêtre (piste B) | décidé, à coder |
| g | Fenêtres du MJ en deux volets à onglets → **V3.1-20** | décidé, à coder |
| h | Page d'accueil en tableau de bord, rail joueur, « Nouveau monde » à trois choix, onglets en pilule glissante | décidé, à coder |
| — | Outil de dés unique, partout (téléphone, ordinateur, solo) : pré-rempli, Cibler · Lancer · Effacer — détail en V3.1-21 | décidé, à coder |
| — | Outil MJ « Table » (les PJ en direct) | décidé, à coder |
| — | Droits des joueurs sur leur fiche, réglés dans Règles actives → **V3.1-23** | décidé, à concevoir |
| — | Jauges de l'initiative et du budget de rencontre | tranché dans le lot i (C9 : PV en anneau, « menace restante ») → V3.1-38, V3.1-44 |

**Règle transverse (4 octobre) : chaque lot livre aussi sa vue
smartphone.** Un lot n'est pas fini tant que son écran ne marche pas à 390 px :
mêmes principes que la planche « Smartphone du MJ » de l'esquisse (barre du
bas flottante, dé encoché, ce qui s'ouvre vient du bas, onglets en pilule,
une fiche à la fois). Le lot c fixe la coquille téléphone ; les autres lots
y adaptent leur contenu :
- **a** rail → sur téléphone, la barre du bas (le rail n'existe pas sous 768 px) ;
- **b** dalle Outils → dé encoché dans la barre ; radio et outils MJ dans la feuille « Outils » ;
- **d** solo → la fiche repliée devient une bande de jauges au-dessus du fil ; barre Jeu, Monde, Fiche | Quêtes, Règles, Notes (modèle A) ;
- **e** fiche à jauges → bouclier CA, PV (commande E), niveau en une ligne, pilule à cinq onglets ;
- **f** tablette → sans objet ;
- **g** fenêtres → une fiche à la fois, pile « N fiches » en feuille (même adresse `?avec=`) ;
- **h** accueil → les colonnes deviennent une pilule Je mène / Je joue / Solo,
  le monde choisi s'ouvre en feuille, « Nouveau monde » en grand bouton.

Le détail de chaque décision suit.


Esquisse : https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm (huit fenêtres :
MJ, joueur, solo en desktop ; MJ, joueur en tablette ; MJ, joueur en
smartphone ; wiki public). Les sections 0 à 16 de son fichier descriptif sont
entrées dans la charte (§11) ; restent les **propositions**, qui changent
réellement la coquille :

1. **Rail repliable** (`Sidebar.tsx`, `PlayerShell.tsx`) — flottant, coins
   arrondis, marge au bord ; 204 px déployé ↔ 64 px replié
   (`width 380ms cubic-bezier(.4,0,.2,1)`), libellés qui s'effacent (opacité
   180-200 ms, `max-width` 260-320 ms). Poignée en onglet plaquée au bord droit
   (16 × 44 px). Replié, l'arborescence s'ouvre en menu flottant au survol.
   Toute liste du rail pose `overflow-y: auto` **et** `overflow-x: hidden`.
2. **Dalle « Outils »** — le bouton de dés quitte sa place flottante
   (`DiceRollPanel`) et s'encoche dans le bord supérieur d'une dalle en bas du
   rail (48 px, anneau de 6 px couleur du panneau) ; la radio quitte la
   pastille chrome pour cette dalle. **La radio reste visible rail replié**
   (icône seule), point d'activité au centre de l'icône : vert en lecture,
   rouge à l'arrêt. L'horloge n'est pas reprise.
3. **Téléphone** — MJ : le rail devient un tiroir flottant, déjà déployé.
   Joueur : la barre du bas devient flottante, le dé encoché dedans.
4. **Mode solo** (`SoloShell.tsx`) — poignées de repli sur les bords de la
   fenêtre du Jeu ; Monde disparaît à 0 px ; la Fiche repliée devient une bande
   de 96 px de jauges (CA, PV, Niveau).

**À trancher avant de coder** :
- Le trou de 768 à 900 px (tablette en portrait) : grille de fiche adaptative,
  ou rail replié plus tôt ?
- ~~Les jauges de la bande repliée~~ — **tranché le 1ᵉʳ octobre** : la CA est
  un bouclier à la taille des jauges (pas d'anneau), plié comme déplié ; la
  bande gagne une jauge de **charge du sac** (encombrement). Bande repliée :
  bouclier CA, PV, Niveau, Charge. Esquisse Solo-Desktop mise à jour.
  `JaugeCirculaire` existe déjà (`FicheJouableEnTete.tsx`), contrairement à ce
  que disait l'esquisse.
- ~~Le trou de 768 à 900 px~~ — **tranché le 1ᵉʳ octobre : piste B**, la fiche
  s'adapte à la largeur de SA fenêtre (pas de l'écran) : sous ~640 px,
  caractéristiques au-dessus des onglets, en ligne de six. Planche
  « Question · le trou sur tablette » (la même fiche à 960, 540 et 680 px).
- ~~Une seule commande jauge + ±~~ — **tranché le 1ᵉʳ octobre : option E**
  (sur cinq propositions, les autres retirées de l'esquisse) : trois pastilles
  accrochées au bord droit de la jauge — ▲ ajoute, un champ d'écart au milieu
  (« — » tant qu'il est vide), ▼ retire. Champ vide : ±1 ; champ rempli (250 XP,
  7 dégâts) : ▲/▼ appliquent ce nombre, puis le champ se vide. Bornes : PV et
  épuisement plafonnés, XP et charge non (charge en danger au-delà du maximum).
  Planche « Décidé · jauge à commandes (option E) » : états + PV, XP, Charge,
  Épuisement vivants. Reportée dans la proposition de fiche à jauges. Dans la proposition de fiche à
  jauges, l'Inspiration prend la taille exacte d'un badge (72 × 56 px), ▲▼
  intégrés.
- ~~Étendre les jauges circulaires à toutes les barres de progression~~ —
  **tranché le 1ᵉʳ octobre : oui pour la fiche de personnage**, avec la
  commande E (PV, niveau/XP, épuisement ; charge du sac dans l'Inventaire). La
  CA reste un bouclier, les constantes restent des badges, l'Inspiration prend
  la taille d'un badge. Planche « fiche avec jauges circulaires ». L'initiative
  et le budget de rencontre ne sont pas encore tranchés.
- ~~Page d'accueil (lot h)~~ — **tranché le 1ᵉʳ octobre : proposition 3,
  tableau de bord** (sur cinq, les autres retirées de l'esquisse). Un même
  compte est MJ dans un monde et joueur dans un autre : le panneau de droite
  montre les outils du rôle tenu dans le monde choisi, pas ceux du compte.
  - Rail : celui du joueur V4 (repliable, poignée). Dalle navigation : Mondes,
    Compte, Administration (superadmin seulement), Déconnexion en pied. Dalle
    Outils : les dés seuls, la radio appartenant à une campagne.
  - En haut : prochaines séances de tous les mondes, et « Reprendre » sur la
    dernière visite (donnée nouvelle à mémoriser).
  - Bouton « Nouveau monde » agrandi, à gauche, au-dessus des colonnes. Il
    ouvre trois choix : **Mener une partie** (nom, ruleset, créer ou
    importer), **Jouer en solo** (nom, ruleset, puis le personnage),
    **Rejoindre une table** (coller un lien d'invitation : ne crée rien, mais
    donne enfin une place à ce lien).
  - Colonnes « Je mène » (+ « En solo ») et « Je joue » alignées sur une même
    ligne de titres ; panneau du monde à droite.
  - ~~Style des onglets du panneau MJ~~ — **tranché le 1ᵉʳ octobre : A,
    pilule glissante** (sur cinq : pilule, soulignement, pastilles à icônes,
    liste latérale, dalles résumé). **Elle remplace aussi les onglets
    « classeur » de la fiche de personnage** : une seule présentation
    d'onglets dans l'application (ADR 0034, qui remplace en partie l'ADR 0026).
    Glissement du fond 260 ms, sauté sous `prefers-reduced-motion`. Usages de
    `BinderTabs` à convertir : accueil, fiche jouable, fiche solo, colonne
    Monde et coquille du solo, aperçu du créateur. Charte §3 et planche 3 du
    catalogue mises à jour avec le code.
- **Smartphone du MJ (lot c)** — proposé le 4 octobre, revu le jour même
  sur retour de l'auteur. Planche « Smartphone du MJ » : six écrans vivants
  (accueil, Monde, Règles, Fiches, Table, Outils).
  - Le tiroir disparaît : le MJ reçoit la même barre flottante que le joueur,
    **six entrées** (nombre pair, trois de chaque côté du dé encoché, comme
    celle du joueur) : Monde, Règles, Fiches | Table, Chat, Outils.
  - **Règles** : le wiki de règles du ruleset du monde (recherche,
    catégories, consultées récemment) ; une règle s'ouvre en feuille du bas.
  - **Fiches** : une fiche à la fois, pastille « N fiches » qui ouvre la pile.
  - **Table** — nouvel outil, pas l'initiative (qui reste dans Outils).
    **Tranché le 4 octobre : outil MJ à part entière**, sur desktop comme sur
    téléphone (il rejoint la liste des outils du rail). Les PJ de la campagne
    modifiables en direct sans ouvrir chaque fiche ; une ligne par PJ (jauge
    de PV, inspiration, états), toucher la déplie :
    - jauge circulaire de PV + commande E, PV temporaires ;
    - inspiration **en quantité** (commande E). Les règles 2024 en font un
      oui/non (on l'a ou pas) : le maximum vient du ruleset, 1 par défaut,
      plus dans un ruleset personnel ;
    - dés de vie ;
    - les cinq pièces (pp, po, pe, pa, pc), chacune ▲/▼ ; le champ d'écart de
      la commande E sert aux grosses sommes ;
    - emplacements de sorts par niveau : une pastille par emplacement, la
      toucher le dépense ou le rend ;
    - états : puces retirables, « + état » ouvre les quatorze états 2024 en
      feuille ; épuisement à part (niveaux 0 à 6, commande E) ;
    - suggestions de l'esquisse, à confirmer : ressource de classe
      (Inspiration bardique 2/3…), concentration (sort maintenu, « Rompre »),
      ajout d'objet ;
    - en-tête de chaque PJ : nom + **niveau**, sous le nom « joueur · CA · PV »
      puis la ligne des états s'il y en a ; à droite, **classe et
      sous-classe** (plus d'étoile) ;
    - **monnaie automatique** : retirer une pièce d'un compteur vide rompt la
      plus proche pièce supérieure (1 po → 2 pe → 5 pa…), ajouter regroupe
      dès qu'une pièce supérieure est complète (10 pc → 1 pa, 5 pa → 1 pe,
      2 pe → 1 po, 10 po → 1 pp). Taux 2024 ; un message dit le change fait.
      À noter : avec le regroupement, l'électrum se forme dès 5 pa — à
      revoir si l'auteur préfère l'en exclure ;
    - **à 0 PV, la ligne du PJ se transforme** : fond rouge, « Contre la
      mort » et ses pastilles ; déplié, trois réussites / trois échecs,
      « Stabilisé » ou « Mort », « Soigner +1 PV » qui remet les jets à zéro.
      L'état Inconscient s'ajoute et se retire de lui-même ;
    - suggestions **retenues** par l'auteur : dés de vie, ressource de classe,
      concentration, ajout d'objet, jets contre la mort ;
    - « Toute la table » : chaque bouton ouvre une feuille, avec « Pour qui »
      (PJ cochés) :
      - **+ XP** : à partager ou à chacun, aperçu par PJ, signale qui monte de
        niveau (la montée se fait dans la fiche) ;
      - **± pièces** : un montant par type (négatif = retirer), à partager ou
        à chacun ; le reste d'un partage est affiché, la monnaie se fait seule ;
      - **repos court** : dés de vie à dépenser par PJ (lancés par le
        serveur), ressources « repos court » rendues ;
      - **repos long** : PV au max, dés de vie, emplacements, ressources,
        épuisement −1, inspiration héroïque des humains.
    - pas d'ascenseur visible sur téléphone (`no-scrollbar`, comme le
      sommaire du joueur) ; sur ordinateur, la barre fine de `globals.css`.
    Chaque modification passe par le serveur comme depuis la fiche (même
    autorisation, même journal) ; rien de dérivé n'est stocké (règle 16).
    Le détail complet du personnage reste dans la fiche.
  - **Fiche complète d'un PJ sur téléphone** (lot e) : planche « fiche
    complète » (Candide, barde 2), téléphone vivant + déroulé de chaque
    partie. En-tête (portrait, espèce · classe · historique, joueuse),
    bouclier CA, jauges PV (temporaires d'abord) et niveau/XP avec commande E,
    constantes (initiative, vitesse, maîtrise, inspiration ▲▼), perception
    passive, dés de vie, épuisement, concentration, états, six
    caractéristiques avec leurs sauvegardes, compétences repliables, puis la
    pilule des cinq onglets réels (Actions, Inventaire, Magie, Traits,
    Maîtrises) collée en haut au défilement. À 0 PV, les jauges cèdent la
    place aux jets contre la mort.
    - **4 octobre** : l'épuisement devient une **jauge circulaire** (0 à 6,
      commande E) au même étage que la CA, les PV et le niveau ; le bonus de
      touche (« +4 ») est un **bouton** de jet, comme les dégâts. Ce que ces
      boutons font pendant une initiative : V3.1-21.
  - **Écran des dés (lot c)** — le bouton central de la barre ouvre une
    feuille : dés à empiler (d4 à d100, compteur sur chaque dé), modificateur
    (commande E), avantage / désavantage en pilule, public ou secret (les
    deux modes de `DiceRollPanel`), « Lancer » qui récapitule la formule,
    résultat avec chaque dé (max en ambre, 1 en rouge, dé écarté barré),
    derniers jets de la table. Planche « Smartphone du MJ », écran 7.
    **La référence à jour de l'outil est V3.1-33** (et la planche « Décidé ·
    le jet en animation ») : ce qui suit retrace comment on y est arrivé.
    - **Revu le 4 octobre** : le modificateur prend la case libre sous le
      d10 (gain de hauteur) ; « Effacer » rejoint « Lancer » sur la même
      ligne, même gabarit en version secondaire. **Avantage / désavantage** :
      les deux d20 sont tirés et affichés **ensemble**, dans une paire
      étiquetée ; le d20 retenu est cerclé d'ambre, l'écarté s'efface. Seul
      le résultat retenu compte et entre dans les derniers jets.
    - **Animation de lancer** — une seule pour toute l'application (feuille
      des dés, boutons de la fiche, Table, chat). Cinq propositions vivantes,
      ancienne planche « Animations de lancer » : A rouleau, B dé qui roule,
      C secousse et éclat, D scintillement, E retournement. Dans tous les
      cas : l'animation part au toucher et masque l'attente du serveur (qui
      seul lance) ; les chiffres qui défilent sont décoratifs ; mouvement
      réduit → résultat immédiat. **Tranché le 4 octobre : D,
      scintillement** — les chiffres défilent flous puis se figent un par un,
      le total compte jusqu'à sa valeur. Les quatre autres sont retirées ; la
      planche est devenue « Décidé · le jet en animation », sur l'outil réel.
    - La feuille des dés s'ouvre **à la hauteur de la feuille Outils** (revu
      ensuite : plus haute, pour loger la zone de résultat permanente) ; les
      derniers jets (30 gardés) défilent dans leur zone, avec l'ascenseur fin
      de l'application (6 px, couleur `edge`, coins ronds, comme
      `globals.css`).
  - **Outils** : les outils MJ en grille par moment (séance, préparation,
    campagne), radio comprise ; le chat n'y figure plus (il est dans la barre).
  - **À valider par l'auteur.**
- **Smartphone du joueur (lot c)** — esquissé le 4 octobre sur le modèle du
  MJ, planche « Smartphone du joueur » (huit écrans vivants). Barre à six
  entrées (Perso., Édition, Notes | Wiki, Règles, Chat), dé encoché.
  - Accueil : le même que le MJ, ouvert sur « Je joue ».
  - Personnage : la fiche complète (jauges, boutons de jet, ciblage pendant
    l'initiative — V3.1-21).
  - Édition : ce que le MJ laisse modifier (fiche, pages, faction confiée),
    éditeur en feuille avec « Qui le voit » (moi / moi et le MJ / la table).
  - Notes : les miennes / partagées à la table, en pilule ; les noms sont des
    liens vers le wiki.
  - Wiki : ce que le personnage a découvert, et rien d'autre (filtré côté
    serveur) ; une page s'ouvre en feuille, « Ajouter à mes notes ».
  - Règles et Dés : identiques au MJ.
  - Chat : table ou MJ en privé ; les jets arrivent en cartes (total, dés,
    verdict de l'initiative), un jet secret n'est vu que du joueur et du MJ.
  - **À valider par l'auteur.**
- **Retours du 4 octobre sur la fiche et le téléphone joueur**
  - **Règles en infobulle** (fiche joueur et MJ, partout) : tout nom d'arme,
    de sort, d'objet, d'aptitude, d'action de base, d'état (Charmé,
    Inconscient…), la concentration et l'épuisement ouvrent leur fiche de
    règle en feuille du bas (propriétés, effet, renvoi « Ouvrir dans
    Règles »). Sur ordinateur, même contenu en fenêtre de règle — partir de
    ce qui existe déjà (`useOpenRuleLink`, puces de référence de la fiche).
  - **Caractéristiques** : chaque case a deux boutons — le haut lance le
    test, le bas le jet de sauvegarde. **Compétences** : toucher une ligne
    lance le test. **Initiative** et **attaque de sort** : boutons aussi.
  - **Inventaire** : chaque objet se bascule « Équipé » / « Au sac » ; la
    charge du sac se recalcule.
  - **Inspiration** : même taille de chiffre que Initiative, Vitesse,
    Maîtrise ; ▲▼ seulement si le joueur a le droit de la changer.
  - **Droits des joueurs sur leur fiche** — réglage du MJ dans **Règles
    actives**, « Ce que les joueurs modifient eux-mêmes » : leurs états,
    leur inspiration, leurs PV, leurs pièces, leurs emplacements, leurs dés
    de vie (interrupteurs). Par défaut : états et inspiration au MJ seul, le
    reste au joueur. Sans le droit, le joueur voit la valeur sans commande
    (pas de « + état »). **Ticket à part, pour toute l'application :
    V3.1-23.**
  - **Wiki du joueur sur téléphone** : la peau actuelle (`BookSkin`) reste
    telle quelle — fiche en pleine largeur, sommaire en tiroir à gauche,
    groupes par type repliables (7 à 10 types, PJ déplié par défaut). Le
    tiroir s'ouvre par ☰ **ou** en touchant « Wiki » une seconde fois dans
    la barre flottante.
  - **Édition d'une fiche de wiki sur téléphone (MJ et joueur)** : toujours
    en plein écran, barre flottante masquée, « Annuler » / « Enregistrer »
    en haut ; le joueur a le même éditeur, limité à ses droits. Quatre
    propositions vivantes, planche « Édition d'une fiche sur téléphone » :
    A accordéon, B sommaire puis bloc en plein écran, C lecture avec un
    crayon par bloc, D pas à pas. Exemple avec Chronologie et Personnalité.
    **Tranché le 4 octobre : A, accordéon** — tous les blocs dans la page,
    repliés en une ligne de résumé, un seul ouvert à la fois, sur place ;
    poignée ⠿ pour réordonner, « + bloc » en bas.
  - Corrections de règles 2024 dans l'esquisse : un barde n'a pas la
    maîtrise des armes de guerre ni de botte d'arme (rapière → dague) ;
    Mot de guérison soigne 2d4 + mod.
- **Passe du 4 octobre — l'esquisse devient la référence**
  - **Wiki et Règles sur téléphone (MJ et joueur)** : toucher « Monde » /
    « Wiki » / « Règles » dans la barre ouvre un écran d'accueil — le bouton
    ☰ (sommaire complet, types repliables) et la liste des fiches consultées
    récemment, avec la recherche. Une fois une fiche choisie, elle s'affiche
    dans la peau du wiki actuelle (`BookSkin`) ; ☰ reste en haut à gauche.
    Toucher de nouveau l'entrée de la barre ramène à l'accueil. Le tiroir
    commence lui aussi par « Récemment ». Côté MJ : « + » nouvelle entité,
    passages MJ en orange (le joueur ne les reçoit jamais), crayon qui ouvre
    l'éditeur plein écran en accordéon. Règles : même parcours, la règle en
    page (propriétés, effet).
  - **Outil de dés unique** : le même partout — dé central de la barre,
    boutons de jet de la fiche, « Morsure » de l'outil Table (Cibler sur les
    PJ, dégâts sur les PV temporaires d'abord, JS de Force, À terre), et sur
    ordinateur et tablette un panneau flottant ancré au dé du rail.
  - **Chat du MJ** : pilule « Salon de table / Fils privés », liste des fils
    par joueur avec leurs non-lus (salon et jets : V3.1-22).
  - **Fiche d'ordinateur** mise au même niveau que le téléphone : onglets en
    pilule glissante, jauges E (PV, niveau, épuisement), Inspiration au
    gabarit d'un badge, boutons de jet ; en dessous de ~640 px de fenêtre,
    caractéristiques en ligne de six au-dessus des onglets (piste B).
  - **Esquisse nettoyée** : planches abandonnées supprimées (propositions
    d'accueil, d'onglets, de fenêtres, d'éditeur, quatre animations
    écartées, anciennes planches téléphone). Restent les décisions : ordinateur
    et tablette, fiche à jauges, jauge à commandes, outil de dés sur
    ordinateur, animation (scintillement), fenêtres à deux volets, accueil,
    et **six planches définitives du téléphone** — MJ et joueur, chacune en
    trois états (écrans ; feuilles ouvertes ; plein écran et infobulles) —
    plus la fiche complète déroulée en sous-planche.
- **Solo sur téléphone (lot d) — décidé : modèle A** (les propositions B, C
  et D sont retirées de l'esquisse). Trois planches définitives « Solo sur
  téléphone » (écrans ; feuilles ouvertes ; plein écran et infobulles) :
  - **Barre flottante** : Jeu, Monde, Fiche | Quêtes, Règles, Notes, dé
    encoché au centre (outil de dés).
  - **Pas de doublon** : la colonne Monde du desktop (Wiki, Quêtes, Présents,
    Règles) perd Quêtes et Règles, qui n'existent qu'une fois, dans la barre.
    L'écran **Monde** = le wiki du joueur (☰ sommaire, fiche dans la peau du
    wiki) avec en tête « Présents dans la scène », puis les fiches consultées
    récemment.
  - **Jeu** : bandeau lieu/heure, bande de jauges (bouclier CA, PV, niveau,
    charge, épuisement), fil, barre d'intention. « Jouer » ouvre l'outil de
    dés **pré-rempli** (arme, cible) ; le joueur confirme par « Lancer » — le
    serveur lance (règle 8), le tour s'ajoute au fil. ✦ ouvre la feuille des
    conséquences (« Déjà écrit dans le monde » / « En attente de relecture »).
  - **Fiche** : exactement la fiche du joueur hors solo — jets depuis les
    caractéristiques, compétences, attaques et sorts via l'outil de dés
    pré-rempli, Cibler sur les participants, infobulles de règles sur chaque
    nom, état et concentration, inventaire avec équipement, pièces.
  - **Quêtes** : pilule En cours / Terminées, une quête s'ouvre en feuille avec
    ses étapes ; le moteur ouvre et ferme les quêtes, ce qu'il propose passe
    par la relecture.
  - **Règles** : comme partout (☰ + règles récentes, puis la règle en page).
  - **Notes** : pilule Les miennes / Journal de partie (le récit tour par tour).
- La refonte n'est pas figée : l'auteur prévoit encore des retouches de
  l'esquisse avant tout code.
- **Fiche de personnage — réorganisation de l'esquisse (faite le 5
  octobre).** Constat de l'auteur : les planches de la fiche sont éparpillées
  (téléphone seul en partie par partie, ordinateur incomplet et mêlé aux
  décisions de l'outil de dés, mode combat seulement dans l'Initiative).
  Plan validé : une zone « Fiche de personnage » — fiche d'ordinateur
  vivante et déroulée partie par partie, téléphone, tablette (piste B),
  fiche en combat, fiche vue par le MJ et par le joueur (droits V3.1-23),
  jauge à commandes — et une zone « Outil de dés » à part.
  **Fait** : toutes les vues tirent la même fiche vivante (un seul moteur) ;
  l'ancienne planche « fiche à jauges circulaires » et l'ancienne planche
  tablette (dessin de fiche périmé) sont retirées. Zone **« Fiche de
  personnage »** :
  - « Décidé · fiche sur ordinateur, vivante et déroulée partie par partie »
    (deux colonnes dans sa fenêtre : en-tête à gauche, pilule des onglets à
    droite ; outil de dés ancré au dé du rail, règles en panneau) ;
  - « Décidé · fiche sur téléphone, vivante et déroulée partie par partie » ;
  - « Décidé · fiche sur tablette : elle suit la largeur de sa fenêtre
    (piste B) » — tablette de 820 px, rail déployé, fenêtre ≈ 556 px : une
    colonne, comme au téléphone ;
  - « Décidé · fiche en combat » (téléphone et ordinateur, ordre du tour en
    tête, même moteur que l'Initiative) ;
  - « Décidé · fiche vue par le MJ et par le joueur » : deux téléphones, la
    même fiche, réglés par les six interrupteurs de V3.1-23 ; le MJ garde
    toutes les commandes, ses notes privées et « DD privé » ;
  - « Décidé · jauge à commandes » et « Décidé · emplacements et ressources
    de classe ».
  Zone **« Outil de dés »** : « Décidé · outil de dés sur ordinateur et
  tablette », « Décidé · le jet en animation ».
  **Manques relevés en comparant au code**, remis dans toutes les vues :
  - Magie : **Préparé / Préparer** sur chaque sort (existe :
    `MagicTab.tsx`), compteur de sorts préparés, étiquettes Rituel et
    Concentration ;
  - **niveau d'emplacement au lancer** (existe : sélecteur de
    `ActionsTab.tsx`, `castSpell` accepte un niveau supérieur) — **tranché
    le 5 octobre : D, le bouton divisé** : il lance au plus petit niveau
    disponible, sa flèche « niv. 1 ▾ » ouvre le menu des niveaux du
    personnage (jusqu'à 9, le menu défile) avec restes et dés ; pour
    l'occultiste, l'emplacement de pacte seul ;
  - **emplacements et ressources de classe — tranché le 5 octobre :
    l'égaliseur à pastilles rondes** (planche « Décidé · emplacements et
    ressources de classe »). Une seule ligne pour tout ce qui se dépense :
    une colonne de pastilles par niveau d'emplacement (jusqu'à 9 ; lanceur
    complet de niveau 20 : 4·3·3·3·3·2·2·1·1), puis, après un trait,
    l'emplacement de pacte (violet) et chaque ressource de classe (ambre).
    Une ressource de plus de six utilisations (points de sorcellerie, de
    focalisation, Imposition des mains) devient un **compteur à commandes**
    de la même hauteur. Sous chaque colonne, sa recharge (court, long,
    « court +1 »). Toucher une colonne dépense ; toucher une pastille vide la
    rend. La ligne défile si elle déborde.
  - **Pas d'onglet par classe** (tour des douze classes, 5 octobre) : tout
    ce qui se compte entre dans la ligne ci-dessus (bloc `resources`
    générique, déjà en base) ; les options de classe entrent dans les
    onglets existants — manœuvres et techniques de moine dans Actions,
    métamagie et grimoire du magicien dans Magie, manifestations
    d'occultiste dans Traits ; la Rage du barbare devient un état actif.
    Manques de données → **V3.1-40** ; la **forme sauvage** du druide
    demande sa propre vue, à esquisser ;
  - Actions : sections Armes, Sorts préparés, Sorts mineurs, Ressources ;
  - Inventaire : contenants, quantité, poids, harmonisation (3 au plus),
    ajouter un objet ;
  - En-tête : Repos court (dés de vie) et Repos long, Monter de niveau
    quand l'XP le permet, identité (âge, genre, pronoms) ;
  - **Repos court — précisé le 5 octobre** : le bouton ouvre un panneau
    « Repos court · 1 heure » sous la barre des repos : dés de vie restants
    (pastilles et « 2/2 d8 »), « **Dépenser un dé · 1d8 + 1** » qui ouvre
    l'outil de dés pré-rempli (le serveur lance, règle 8) et rend 1d8 + mod.
    de Constitution en PV, plafonnés au maximum ; bouton inerte à 0 dé ou à
    PV pleins. « Terminer le repos » recharge ce qui revient au repos court.
    Le repos long rend PV **et tous les dés de vie** (règles 2024).
    L'interrupteur « Leurs dés de vie » de V3.1-23 porte sur ce seul bouton :
    coupé, la joueuse lit « Le MJ dépense tes dés de vie » ;
  - Combat : ordre du tour, économie d'action, PV temporaires par-dessus la
    jauge.
  - **Retouches de l'auteur (5 octobre)**, appliquées à toutes les vues :
    - Inspiration : même gabarit que les autres badges (chiffre et libellé
      centrés), ▲▼ dans une marge à droite.
    - Sous la ligne Initiative / Vitesse / Maîtrise / Inspiration, une
      seconde ligne au même style : Perception passive, Dés de vie, un champ
      unique **États · concentration** (états en rouge, concentration
      « ◎ Fou rire » en violet, « + » en coin pour le MJ ou si permis), puis
      **Repos court** et **Repos long** l'un sur l'autre. Elle passe
      au-dessus de « Ce qui se dépense ». Plus de puces séparées ni de
      ligne « États ».
    - Plus de bouton « Niveau 3 à 900 XP » : quand l'XP le permet, la
      légende sous la jauge de niveau devient « monter de niveau ▸ ».
    - Titres de section des onglets (Armes, Sorts mineurs, Ressources…)
      plus visibles : capitales ambre, filet qui se prolonge ; les indices
      passent sur une ligne discrète dessous.
    - Pièces : la commande E (▲, champ, ▼) à droite de chaque pièce, sur
      une seule rangée. Le regroupement ne forme jamais d'électrum (ADR
      0036 : 10 pa → 1 po).
    - Magie : les emplacements en pastilles rondes, comme l'égaliseur
      (toucher dépense) ; plus de renvoi « voir Ce qui se dépense ».
    - Traits : l'explication passe sous le titre, même quand le titre est un
      lien de règle.
    - **Capacités qui jouent après un jet — tranché le 5 octobre : A, la
      bande d'après-jet.** Trois variantes ont été comparées (A options dans
      la bande, B bouton « Modifier le jet » et menu, C pastilles dans la
      case) ; B et C sont retirées de l'esquisse. Sur un jet de d20 raté de
      son propre personnage (attaque, test, sauvegarde ; ou sans DD connu),
      la bande du bas propose, côte à côte et en violet (pour ne pas la
      confondre avec « Lancer les dégâts », ambre) : **Relancer**
      (Inspiration héroïque : nouveau d20, il remplace l'ancien),
      **Avantage** (Chanceux : second d20, le meilleur compte),
      **+ d6** (Inspiration bardique reçue d'un autre barde, après un
      échec). Une fois par jet ; le point est retiré à l'usage ; la case
      rejoue scintillement et verdict, une ligne dit ce qui a changé ; le
      serveur lance toujours (règle 8). Sur une réussite, rien : la bande
      garde « Lancer les dégâts ». Dans l'onglet Actions, Chanceux garde
      ses pastilles. Le moment exact de Chanceux (don 2024) est à vérifier
      dans le Manuel des joueurs. Ticket : **V3.1-33**.
  - **Deuxièmes retouches (5 octobre)** :
    - Cause trouvée des badges « Inspiration » et « Dés de vie » différents
      dans le canevas : la valeur dynamique y est enveloppée dans un `span`
      qui héritait du style des libellés (9 px, capitales). Le style du
      libellé ne touche plus la valeur. **À retenir pour le code** : un
      sélecteur de libellé (`.badge span`) ne doit jamais atteindre la
      valeur.
    - Dés de vie : « 2/2 » en grand, « Dés de vie d8 » en libellé, comme
      Perception passive.
    - Repos court / long : recette « bouton fantôme accent » de la charte
      (§3 : contour et texte ambre, `rounded-full`, survol `accent/10`).
    - Inventaire : la jauge de charge sur la ligne des pièces (« Charge et
      pièces ») ; sur téléphone, jauge de 50 px puis les cinq pièces, chacune
      avec sa commande E.
    - Actions → Ressources : restes en pastilles rondes ambre (Inspiration
      bardique ●●○, Chanceux ●●).
    - « Ce qui se dépense » : le titre unique laisse place à des **groupes
      titrés répartis horizontalement** — « Emplacements de sorts »
      (niveaux, puis pacte), « Classe », « Traits » (dons, espèce) — chacun
      avec ses colonnes de pastilles réparties sous son titre, séparés par un
      filet. La planche « égaliseur, douze classes » suit (largeur de groupe
      proportionnelle à ses colonnes).

#### Conception et découpage — fait le 4 octobre

**A et B sont traités par l'ADR 0036** (`docs/adr/0036-les-donnees-de-la-refonte-verre-mineral.md`), après lecture du code :
- **A1 pièces et équipement** : restent dans le bloc `inventory` (l'économie
  et le journal lisent les révisions) ; écrits par des services serveur
  `changeCurrency` / `setItemEquipped`. La monnaie automatique et la bascule
  « Équiper » existaient déjà.
- **A2 maximum d'inspiration** : réglage de campagne (Règles actives), 1 par
  défaut — pas une règle de ruleset, qui est figé une fois publié.
- **A3 concentration** : champ `concentration` de l'état de jeu, sans
  migration ; l'état `concentrating` des déclencheurs en est dérivé.
- **A4 « Reprendre » et « Consultées récemment »** : dans le navigateur.
- **A5 droits des joueurs** : colonne `table_settings jsonb` sur `campaigns`
  (avec le maximum d'inspiration) — **proposé, à valider** : changement de
  schéma.
- **B6 résolution** : cœur commun extrait de `playTurn` (V3.1-21, Opus) ;
  l'outil de dés n'attend pas, « Cibler » reste grisé jusque-là.
- **B7 repos** : `takeShortRest` / `takeLongRest` seuls chemins, ils émettent
  `short_rest` / `long_rest` (V3.1-5 s'y branche).
- **B8 jets contre la mort** : fonctions pures du noyau, règles 2024.

**C. Tranché par l'auteur le 4 octobre**
- ~~10. Électrum~~ — **exclu du regroupement** : la monnaie ne forme jamais
  d'électrum toute seule (10 pa → 1 po) ; celui qu'on reçoit est gardé tel
  quel, et ne se casse que si les autres pièces ne suffisent pas. À coder
  dans V3.1-24.
- ~~12. Colonne `table_settings`~~ — **acceptée**, avec le maximum
  d'inspiration réglé par campagne (ADR 0036 §5). V3.1-23 peut partir.
- ~~11. Esquisse figée~~ — **non** : l'auteur veut d'abord **refondre
  visuellement chaque outil du MJ** → lot i ci-dessous. Les tickets V3.1-24
  à 36 restent valables : ils ne touchent pas l'intérieur des outils, sauf la
  Table (34), déjà esquissée.
- 9. Jauges de l'initiative et du budget de rencontre — **reporté au lot i**
  (outils Initiative et Rencontres).

**Lot i — refonte visuelle des outils du MJ (ouvert le 4 octobre, à
concevoir).** Passer outil par outil, esquisse à l'appui, dans la même
méthode que les lots précédents (propositions vivantes, choix de l'auteur,
planches définitives, ticket prêt pour Sonnet). Les outils, rangés par
moment comme dans la feuille Outils du téléphone :
- **Séance** : Initiative, Table, Chat, Livre de sessions, Notes ;
- **Préparation** : Rencontres, Générateurs, Probabilités, Création de
  personnage ;
- **Campagne** : Gestion de campagne, Calendrier, Calendrier réel, Règles
  actives, Personnalisation, Publication, Journal historique.
Chaque outil sur ordinateur (fenêtre) et sur téléphone (écran ou feuille).

- **Initiative — décidé le 4 octobre : A, la liste vivante, retouchée**
  (planche « Décidé · initiative », parcours vivant MJ ↔ joueur ; B, C et D
  retirés de l'esquisse). Tickets : **V3.1-37** (données, sécurité, temps
  réel — Opus) puis **V3.1-38** (interface — Sonnet).
  - **MJ** : une ligne par participant, dans l'ordre ; jauge de PV, bouclier
    de CA et PV **alignés en colonnes à droite** sur toutes les lignes.
    Toucher le **score d'initiative** le rend modifiable (▲▼, OK) et l'ordre
    se refait. Toucher la ligne la déplie : PV (−5, −1, +1, + PV temporaires),
    + état, **toutes les actions** — monstre, PNJ ou PJ (pour jouer à la
    place d'un joueur sans l'application).
  - **Renommer un adversaire** : « Gobelin 1 » devient « Monstre non
    identifié » ; le MJ garde le nom d'origine en petit à côté (« Gobelin ») ;
    le joueur ne reçoit que le nouveau nom.
  - **Déroulé** : « Commencer le combat » lance l'initiative des adversaires
    (serveur) et envoie une **invitation** aux joueurs dont le PJ combat. Le
    MJ voit qui manque et peut saisir la valeur d'un joueur sans
    l'application (« … »). « Round 1 » quand tout le monde a lancé. Quand le
    dernier adversaire tombe, le **MJ confirme** la fin (« Continuer » reste
    possible : renforts, ennemi qui se relève).
  - **Joueur** : l'initiative n'a pas d'entrée dans la barre — c'est un
    **écran de situation dans Perso.** L'invitation passe au premier plan
    (« Vous entrez en combat ») : « Lancer l'initiative · d20 +2 », ou un vrai
    dé saisi avec un **interrupteur « modificateur inclus »** (éteint : l'app
    ajoute le +2 ; allumé : on saisit le total). Si le MJ saisit la valeur,
    l'invitation se ferme seule. **Revu le 4 octobre** : toucher « Lancer
    l'initiative » change le bouton, par un balayage de gauche à droite, en
    **la zone de résultat de l'outil de dés** (la même) ; le scintillement
    part, le résultat s'affiche, et **4 secondes plus tard** il est validé
    et la fenêtre se ferme (« validé dans 4 s… » en décompte). En combat, Perso. passe en **mode combat** :
    l'ordre du tour, l'économie d'action (action, action bonus, réaction),
    puis **Actions · Sorts · Capacités** en pilule, prêts à lancer, sur
    téléphone comme sur ordinateur. Combat terminé : la fiche redevient
    normale.
  - **Ce que voit le joueur** : ses alliés en PV ; les adversaires en **état
    de blessure** (Indemne, Blessé, En sang, Hors de combat), jamais leurs
    PV, leur CA ni leur nom d'origine — filtré par le serveur. Le verdict
    d'une attaque dit « Touché — Worg », sans la CA.
  - **Pour tous** : chaque attaque a **deux boutons, touche puis dégâts**
    (ou DD pour une sauvegarde) ; chacun ouvre l'outil de dés pré-rempli,
    Cibler parmi les participants (alliés pour un soin) ; une touche propose
    la bande « Lancer les dégâts » de l'outil, même cible (dés doublés au critique).
  - **PV temporaires** : arc bleu autour de la jauge, annotation « 20/15 »
    (PV + temporaires / max) ; les dégâts les entament d'abord.
  - **Retouches du 4 octobre (2 et 3)** : l'outil de dés de l'initiative est
    **exactement** celui de partout (V3.1-33). « **Quitter le combat** »
    (MJ) suspend sans rien perdre — fausse manipulation, oubli ; ensuite,
    deux choix : **« Reprendre tel quel »** (même ordre, même round, mêmes
    PV) ou **« Recommencer »** (l'initiative se relance, invitation renvoyée
    aux joueurs). Côté joueur, le mode combat **ne remplace pas la fiche** :
    il ajoute en tête l'ordre du tour, et dessous c'est **la fiche
    elle-même**, exactement la même que hors combat — jauges, Actions,
    Inventaire, Magie, Traits, Maîtrises, avec leurs boutons de jet, leurs
    infobulles de règles, les emplacements de sorts et la bascule Équipé /
    Au sac (les potions sont dans l'inventaire). Les **PV temporaires** sont
    une seconde jauge bleue posée **par-dessus** la verte, qui n'existe que
    s'il y en a et se consomme d'abord — **sur la fiche aussi** (V3.1-26,
    V3.1-32), annotation « 18/15 ».
  - **C9 tranché** : PV de chaque participant en anneau ; pendant le combat,
    la « menace restante » (XP des adversaires encore debout rapportée à la
    rencontre) remplace le budget de rencontre.

- **Bloc-notes — décidé le 5 octobre : A, le cahier refait, avec le
  partage à la table** (planche « Décidé · bloc-notes (A) », rangée Lot i ;
  B — fiches dans l'autre volet — et C — journal de séance — retirées de
  l'esquisse ; le journal pourra revenir avec le Livre de sessions).
  - **Rail toujours présent** sur ordinateur et tablette (rappel de
    l'auteur) : le bloc-notes est un outil du MJ, « MJ » allumé dans le
    rail.
  - **MJ en fenêtre, joueur en page pleine** (rappel de l'auteur) : le MJ
    ouvre le bloc-notes dans les fenêtres à volets (V3.1-20) ; le joueur n'a
    pas de fenêtres, « Notes » est une entrée de son rail qui s'ouvre en page
    pleine, même disposition (sommaire « Mes notes » puis « Partagées à la
    table », page, fiche citée).
  - Ordinateur : sommaire arborescent à gauche (« Mon cahier » : pages,
    fiches ◆ et règles § épinglées ; puis « Partagées à la table »), la page
    au centre, la fiche citée ou épinglée dans le panneau de droite — le
    cahier d'aujourd'hui (`NotebookWorkspace.tsx`) au style verre minéral.
  - Tablette (fenêtre ≈ 556 px) : sommaire en tiroir ☰, fiche en panneau
    par-dessus la page ; au-dessus de ~640 px, la disposition d'ordinateur.
  - Téléphone du MJ : Outils › Bloc-notes, épinglées en puces, « Mon
    cahier » puis « Partagées à la table » en liste, page en plein écran,
    fiche citée en feuille du bas.
  - Téléphone du joueur : Notes, pilule « Les miennes / Partagées à la
    table ».
  - **Partage à la table (voulu par l'auteur)** : chaque page de son cahier
    porte « Privée | La table ». Partagée, la table la lit (MJ et joueurs),
    seule son autrice l'écrit ; elle reste à sa place, marquée « partagée »,
    et apparaît chez les autres sous « Partagées à la table » avec son
    autrice. Privée, elle n'est envoyée à personne, MJ compris. Un nom cité
    que la table n'a pas découvert s'affiche sans lien (filtré côté
    serveur).
  - **En base — principe accepté le 5 octobre, ADR 0037**
    (`docs/adr/0037-une-page-partagee-devient-une-entite.md`) : sur le modèle
    du Livre de sessions, une page partagée devient sa propre entité
    (genre `shared_note`, visibilité de la table), son autrice en reçoit
    l'octroi d'écriture (`entity_grants`, que le MJ peut reprendre), et le
    cahier garde un lien vers elle. Pas de nouvelle table ; une migration,
    `docs/SCHEMA.md` et un ADR. Ces entités ne rejoignent pas les listes du
    wiki (comme `session_journal`).

- **Chat — décidé le 5 octobre : B, le salon en grand, le privé sur le
  côté** (planche « Décidé · chat (B) », rangée Lot i ; A et C retirées).
  - MJ, ordinateur : la fenêtre Chat montre toujours le salon de table (où
    passent les jets publics) ; les joueurs en pastilles en haut, avec leurs
    non-lus ; une pastille ouvre son fil privé en colonne à droite, × la
    referme.
  - Tablette : le fil privé s'ouvre en panneau par-dessus le salon.
  - Joueur : page pleine, deux conversations (« Salon de table », « MJ, en
    privé »). Téléphones : planches déjà décidées.
  - Jets en cartes : total, dés, modificateur, verdict vert / rouge s'il y
    avait une CA ou un DD ; secret en pointillé violet, vu de son auteur et
    du MJ ; avec « DD privé », pas de verdict côté joueur.
  - **Demande de modification retirée** (décision de l'auteur : le MJ donne
    ou reprend le droit d'édition par les octrois).
  - Données : **ADR 0038** — salon = `thread_user_id` nul dans la même
    table ; jets lus dans `dice_rolls` et intercalés, jamais recopiés ;
    jet secret de joueur = niveau `roller` et `rolled_by_user_id`.

- **Table — décidé le 5 octobre : B retouchée, une carte par PJ = le haut
  de la fiche** (planche « Décidé · outil Table », rangée Lot i ; A et C
  retirées). Idée de l'auteur : la carte reprend exactement le haut de la
  fiche (bouclier de CA, PV et temporaires, niveau et XP, épuisement avec la
  commande E ; initiative, vitesse, maîtrise, inspiration ; Perception
  passive, dés de vie, états · concentration, repos court et long ; « Ce qui
  se dépense » en groupes), plus la charge et les pièces en dessous. Le même
  composant que la fiche, en mode MJ.
  - ▲▼ ajoutés sur les **dés de vie**, au gabarit de l'inspiration.
  - **Pas de commande sur la CA** (décision de l'auteur) : elle reste
    calculée par le moteur (armure, Dextérité, bouclier), comme initiative,
    vitesse, maîtrise et Perception passive (règle 16).
  - Deux cartes par rangée dans la fenêtre du MJ ; une seule quand la
    fenêtre partage l'écran avec un second volet, et sur tablette. À 0 PV,
    les jauges cèdent la place aux jets contre la mort.
  - En tête : « Toute la table » et le bandeau d'initiative. Le téléphone
    garde ses lignes dépliables (planches décidées).
  - **Validé par l'auteur le 5 octobre.** Rappel de l'auteur, valable pour
    tout le lot i : les ascenseurs suivent la charte (fins, 6 px, piste
    transparente, curseur `edge` arrondi, `edge-strong` au survol — règle
    globale de `app/globals.css`) ; aucun ascenseur natif. L'esquisse est
    corrigée partout.

- **Livre de sessions — décidé le 5 octobre : A, le registre, avec les
  trois ajouts** (planche « Décidé · Livre de sessions », rangée Lot i ; B et
  C retirées).
  - MJ, ordinateur : une ligne par séance (date en jeu, titre, autrice,
    séance réelle, état : Rédigée, En attente, Pas de devoir) ; en tête, la
    prochaine séance et « Assigner le devoir » (feuille : séance réelle et
    date en jeu proposées d'office, « Qui l'écrit ») ; une entrée — ou un
    devoir en attente, avec « Relancer » et « Annuler le devoir » — s'ouvre
    en lecture dans la colonne de droite.
  - Tablette : registre réduit (date · titre · état), lecture en panneau
    par-dessus. Téléphone du MJ : Outils › Livre de sessions, prochaine
    séance puis registre en liste, entrée en plein écran.
  - Joueur (ordinateur en page pleine, téléphone) : le bandeau du devoir,
    puis le Livre en premier chapitre du sommaire du wiki.
  - **Ajouts retenus** : (1) suggestion « à qui le tour » — la personne qui
    n'a pas écrit depuis le plus longtemps (ou jamais) ; (2) « Relancer » —
    un rappel posé dans le fil privé du chat (V3.1-22), journalisé ; (3) le
    Livre en chapitre de tête du sommaire du wiki joueur (aujourd'hui, seule
    la page d'ouverture y mène).
  - Données : rien de nouveau en base pour (1) et (3) (assignations et
    entrées existent) ; (2) dépend du salon / des fils de V3.1-22.

- **Rencontres — décidé le 5 octobre : A, l'atelier en trois colonnes**
  (planche « Décidé · Rencontres », rangée Lot i ; B et C retirées).
  - Ordinateur : à gauche le groupe (PJ de la campagne, vrais niveaux, un
    absent se décoche), la difficulté visée, « Mes rencontres » (une
    rencontre se rouvre) ; au centre le catalogue du ruleset (recherche,
    filtres par type) ; à droite la barre de budget (trois paliers 2024 et
    la difficulté visée), la rencontre en cours (± nombre, ×), « Génération
    aléatoire », sauvegarder, « Lancer le combat » vers l'Initiative.
  - Tablette : les colonnes s'empilent. Téléphone du MJ : Outils ›
    Rencontres — le groupe en pastilles (prénom · niveau, toucher un absent
    le retire, le budget suit ; ajouté à la demande de l'auteur), la
    difficulté et la barre, la rencontre en cours, le catalogue en feuille
    du bas, « Lancer le combat ».
  - Inchangé : budget en donnée de ruleset (`encounter_budget`), solveur du
    code, table `campaign_encounters` (C, la rencontre comme bloc d'une
    fiche, écartée).
- **Rail des planches du lot i (5 octobre, remarque de l'auteur)** : les
  planches du lot i dessinaient un rail simplifié. Elles reprennent
  désormais le rail décidé à l'identique (V3.1-27, planches « MJ · Desktop »
  et « Joueur · Desktop ») : poignée de repli, logo du monde et son point,
  dé encoché à l'anneau de 6 px, radio et son point ; côté joueur, sept
  destinations (Solo compris) et « Mes mondes » en pied. **La référence du
  rail reste V3.1-27**, jamais une planche d'outil.
- **Générateurs — décidé le 5 octobre : C, les tirages à gauche, la fiche
  à droite** (planche « Décidé · Générateurs », rangée Lot i ; A et B
  retirées).
  - Ordinateur : en haut la pilule des outils (taverne, échoppe, PNJ…) et
    les variantes en puces (dont « Aléatoire »), qui remplacent les listes
    déroulantes. À gauche les tirages : chaque section et ses emplacements
    (dé, résultat, ↻ par emplacement, ↻ par section). À droite l'aperçu de
    la fiche assemblée : chaque morceau tiré, souligné en pointillé, se
    relance aussi d'un toucher ; prose de l'IA marquée « IA » en 40 / 80 /
    120 mots ; menu de taverne en deux colonnes (plats par palier,
    boissons) ; « Tout relancer ». « Éditer les tables » prend la place des
    tirages dans la colonne de gauche ; « Copier le texte » ; « Créer la
    fiche » promeut le résultat en entité (visible du MJ seul).
  - Tablette : l'aperçu de la fiche d'abord, les tirages dessous.
    Téléphone du MJ : Outils › Générateurs, pilule des outils, variantes
    et « Les tirages » en feuilles du bas, aperçu de la fiche (↻ par
    morceau, menu en une colonne), « Créer la fiche ».
  - Inchangé : les tables restent des fiches de règles pondérées du
    ruleset ; la prose de l'IA reste de la donnée revue avant création
    (règle 10) ; rien de nouveau en base.

- **Probabilités — décidé le 5 octobre : A, la matrice, avec deux ajouts
  de l'auteur** (planche « Décidé · Probabilités », rangée Lot i ; B et C
  retirées).
  - Ordinateur : une seule grille, les PJ de la campagne en colonnes ; en
    lignes **les six caractéristiques (jet de caractéristique : Force,
    Dextérité, Constitution, Intelligence, Sagesse, Charisme ; ajout de
    l'auteur)** puis les dix-huit compétences. Le pourcentage au DD choisi
    (5 à 30, pas à pas ou en puces). Le meilleur de chaque ligne est
    encadré ; une case touchée explique son calcul (caractéristique,
    maîtrise ou expertise, touche-à-tout, avantage ou désavantage de la
    fiche). Campagne en sélecteur compact.
  - **Couleurs (ajout de l'auteur)** : un spectre continu du rouge (peu de
    chances) au vert (presque sûr), fond et chiffre teintés selon le
    pourcentage — pas trois paliers.
  - Tablette : la même grille, qui défile. Téléphone du MJ : Outils ›
    Probabilités, le DD (pas à pas et puces), le détail de la case touchée,
    la grille compacte (noms abrégés, sans la colonne de caractéristique).
  - Code : le calcul pur (`src/core/rules/probability.ts`) gagne les jets
    de caractéristique (même formule, touche-à-tout compris), tests
    d'abord. Rien en base (règle 16).

- **Création de personnage — structure décidée le 5 octobre : A, le
  chemin qui se ramifie** (planche « Décidé · Création de personnage »,
  rangée Lot i ; B et C retirées). Les écrans viennent ensuite, un par un
  (origines, classe, caractéristiques, sorts, équipement, aperçu).
  - Étapes à gauche : Identité, Espèce, Classe, Caractéristiques, Points
    de vie (seulement au-delà du niveau 1), Historique, Équipement, Sorts
    (seulement pour un incantateur), Aperçu. L'onglet Compétences
    disparaît, ses trois contenus sont redistribués : chaque choix de
    compétence et de maîtrise d'armes vit sous l'étape qui l'accorde ; **les
    langues (le Commun, plus deux au choix) vivent sous Identité** — en
    2024 elles appartiennent au personnage, ni à l'espèce ni à
    l'historique (le code les rattache déjà à « Personnage »,
    `resolvedRuleset.ts`) ; une langue donnée par une classe (Roublard :
    Argot des voleurs acquis, plus une au choix) sous Classe, une langue
    fixe (druidique) affichée comme acquise ; un historique ou une espèce
    maison qui en donne les fait naître sous son étape. La grille des
    dix-huit compétences et de leurs modificateurs passe dans l'aperçu
    (colonne de droite et étape Aperçu). Remarque de l'auteur, 5 octobre.
  - **Sous chaque étape, les choix qu'elle fait naître**, en sous-étapes
    (point doré à faire, vert fait ; « n à faire » sur l'étape) : lignage ou
    legs et sa caractéristique d'incantation, Sens aiguisés, Compétent,
    Polyvalent → don → sorts en cascade, taille (Espèce) ; Ordre divin,
    Style de combat, compétences de classe, Expertise (qui attend les
    compétences), maîtrise d'armes, équipement A/B, sous-classe à son
    niveau (Classe) ; répartition +2/+1 ou +1/+1/+1, don d'origine et ses
    choix, jeu ou outil, équipement (Historique) ; sorts mineurs et
    préparés (Sorts). Un choix naît là où sa source est choisie et
    disparaît si elle change.
  - L'écran au centre ; Précédent / Suivant parcourent étapes et
    sous-étapes dans l'ordre ; l'aperçu en direct à droite (le vrai moteur
    de la fiche). Un choix ouvert n'empêche pas de créer (rappelé sur la
    fiche).
  - **Identité (remarque de l'auteur, 5 octobre)** : deux champs, Prénom
    et Nom, puis genre et pronoms. **La naissance dans le calendrier du
    monde** : on saisit l'âge (± ou au clavier), on choisit le jour et le
    mois (les mois du calendrier du monde) ; l'année se calcule depuis la
    date du jour en jeu (`calendar.currentDate`) : année du jour − âge,
    moins un si l'anniversaire n'est pas encore passé cette année
    (121 ans au 14 Germinal 1492, né un 3 Messidor → 1370). Une phrase
    résume : « Née le 3 Messidor 1370 · 121 ans au 14 Germinal 1492 ».
    Si le MJ n'a jamais réglé la date du jour, l'année se saisit à la main
    (et l'âge attend la date du jour).
  - **Données, à décider par un ADR avant de coder** (règle 16 : une
    valeur dérivée n'est jamais stockée) : la fiche stocke la **date de
    naissance** (une `GameDate` du calendrier du monde) et plus l'âge ;
    l'âge devient dérivé de la date du jour en jeu et vieillit avec la
    campagne. Le bloc `character` gagne `given_name` et `family_name` ;
    le nom de l'entité (wiki, mentions, recherche) reste « Prénom Nom »
    composé à la création, et **recomposé automatiquement** quand on
    édite le prénom ou le nom (décidé par l'auteur le 5 octobre). Reprise de l'âge
    existant : `age` devient une date de naissance au 1er du premier mois,
    à corriger à la main.
  - MJ : dans une fenêtre. Joueur : en page pleine (rail joueur, pas de
    fenêtres), mêmes droits que le MJ — niveau de départ et multiclassage
    (décidé le 6 octobre, voir Classe). Tablette : sans la colonne d'aperçu (l'étape Aperçu
    reste). Téléphone : une étape par écran, barre de progression.
  - Dépendance : le mécanisme générique des choix (V3.1-3, V3.1-6,
    V3.1-7) reste à concevoir ; cette structure est l'endroit où il
    s'affiche.

- **Création — les Origines (Espèce, Historique) : décidé le 5 octobre,
  A, la grille puis la fiche, avec les deux sous-étapes communes**
  (planche « Décidé · Création — les Origines » ; B et C retirées).
  - Espèce et Historique : les options en petites cartes (trois par ligne,
    deux sur tablette et téléphone), dessous la fiche de la sélection —
    traits en une ligne chacun, « Ce qui en naît » en pastilles qui mènent
    aux sous-étapes.
  - Lignage, legs, lignage gnomique : tableau comparatif (une colonne par
    option, niveaux 1, 3 et 5 ; une carte par option au téléphone).
    Valeurs de caractéristique de l'historique : jetons « +2 et +1 » ou
    « +1 à chacune », le total s'affiche.
  - **Choix expliqués (demande de l'auteur)** : la caractéristique
    d'incantation dit à quoi elle sert (DD et attaque des sorts du trait,
    rien d'autre) et chaque option montre son effet chiffré pour ce
    personnage (« mod. +2 → DD 12, attaque +4 »), en signalant celle de la
    classe ou la meilleure. Sens aiguisés : ce que couvre chaque
    compétence, le total qu'elle donnerait, et « déjà maîtrisée
    (Acolyte) : ce choix ne donnerait rien de plus ».
  - Libellé : la compétence Insight se dit **Intuition** (comme
    `src/i18n/fr.ts`) ; les planches qui écrivaient « Perspicacité » sont
    corrigées.

- **Création — la Classe : décidé le 6 octobre, B (la progression) avec
  les emplacements de multiclassage, et le même écran pour monter de
  niveau** (planche « Décidé · Création — la Classe » ; A et C retirées).
  - En tête, les classes du personnage en emplacements, « + Ajouter une
    classe » avec le contrôle des prérequis (le MJ peut passer outre).
    L'emplacement choisi ouvre sa grille et sa fiche ; le niveau de cette
    classe se règle par − / + ou d'un toucher (1, 5, 10, 15, plafond) ; le
    niveau de personnage, somme des classes, ne dépasse pas le plafond.
  - **La progression porte les choix de classe** : tous les niveaux de la
    classe, une ligne chacun (acquis en vert, niveau atteint en doré, la
    suite estompée avec ce qui viendra). Chaque choix d'un niveau atteint
    (sous-classe, améliorations, don épique, Expertise du roublard…) est
    une pastille sur sa ligne qui ouvre le choix. L'étape Classe, à gauche,
    ne liste que les choix du niveau 1, plus « Choix de niveau · n à faire »
    — sinon un personnage de niveau 20 noierait la colonne.
  - Points de vie : une ligne par niveau au-delà du premier (classe, dé,
    moyenne ou jet du serveur, à basculer), « Moyenne pour tous » ou
    « Lancer tous ».
  - **Monter de niveau** : le même écran, ouvert par « monter de niveau ▸ »
    sur la fiche. On choisit la classe qui gagne le niveau (existante ou
    nouvelle), combien de niveaux (plusieurs d'un coup) ; les niveaux
    acquis sont verrouillés, les nouveaux en doré ; les étapes se réduisent
    à ce qui change (points de vie, choix des nouveaux niveaux, sorts),
    puis un aperçu avant → après. Remplace `LevelUpWizard.tsx`.
  - **Joueur (décidé le 6 octobre)** : il choisit lui-même son niveau de
    départ (de bonne foi, entre amis et en solo) et multiclasse lui-même,
    à la création comme au passage de niveau. `playerRestricted` /
    `hideAddClass` disparaissent.
  - **Tout vient du ruleset (remarque de l'auteur)** : aucune règle de
    personnage écrite en dur — plafond de niveau (20 en D&D 2024, un autre
    pour un ruleset maison), progression de chaque classe, niveau de la
    sous-classe, niveaux d'amélioration et don épique, dé de vie, budget de
    sorts, prérequis de multiclassage. Déjà en données :
    `class_progression` (avec `max_level`), `subclass_slot.chosen_at_level`,
    le dé de vie, la progression d'incantation. **À structurer avant de
    coder** : les prérequis (`prerequisites` n'est que du texte libre —
    sans structure, le contrôle reste indicatif), les améliorations et dons
    comme choix accordés par une ligne de progression, et un plafond de
    niveau de personnage porté par le ruleset (aujourd'hui seul le plafond
    par classe existe). Rejoint le mécanisme générique des choix
    (V3.1-3, V3.1-6, V3.1-7).

- **Création — les Caractéristiques : décidé le 7 octobre, C, la
  suggestion puis l'échange** (planche « Décidé · Création — les
  Caractéristiques » ; A et B retirées).
  - « Répartir pour un clerc » place les valeurs selon la classe (ordre
    lu dans le ruleset), puis on touche deux cases pour échanger leurs
    valeurs. Six grandes cases : total, modificateur, d'où vient le total.
    Achat de points : − / + par case, jauge du budget qui refuse de
    dépasser. Tirage fait par le serveur, puis suggestion et échange.
  - Le tableau, le budget et ses coûts, la formule du tirage viennent du
    ruleset — aujourd'hui constantes de `src/core/rules/abilityGeneration`,
    à déplacer en données. Le bonus d'historique se répartit dans sa
    sous-étape, les améliorations de niveau dans la leur.
- **Création — l'Historique, ses sous-étapes : décidé le 7 octobre, C, le
  don et la fiche du sort** (planche « Décidé · Création — l'Historique » ;
  A et B retirées). L'écran Historique et ses jetons +2/+1 étaient décidés
  avec les Origines.
  - Une seule sous-étape « Don : Initié à la magie (Clerc) · n/3 » sous
    Historique ; son écran regroupe les choix du don en sections
    (caractéristique d'incantation avec son effet chiffré, deux sorts
    mineurs, un sort de niveau 1), chacune avec son compte ; à côté, la
    fiche du sort touché (école, temps, portée, durée, effet).
  - **Un seul sélecteur de sorts** (cartes + fiche du sort) : celui de
    l'étape Sorts et de tout choix de sorts né d'un trait (lignage, legs,
    Polyvalent → Initié à la magie) ou d'une sous-classe — mécanisme
    générique des choix (V3.1-3, V3.1-6, V3.1-7).
  - Équipement A ou B : deux cartes, la liste des objets de l'option A face
    aux pièces de l'option B. L'outil à choisir (le jeu du Soldat) en
    cartes.
  - Tablette et téléphone : la fiche du sort passe sous les sections, les
    cartes d'équipement s'empilent.

- **Création — les Sorts (7 octobre)** : pas de propositions à part —
  l'étape reprend le sélecteur décidé pour l'Historique (cartes + fiche du
  sort), avec le budget de la classe (sorts mineurs, sorts préparés, lu
  dans la progression d'incantation du ruleset).
- **Création — l'Équipement : décidé le 7 octobre, C, les emplacements,
  avec deux demandes de l'auteur** (planche « Décidé · Création —
  l'Équipement » ; A et B retirées).
  - Armure, main principale, main secondaire en trois cases, chacune avec
    la fiche chiffrée de l'objet ; la CA et l'attaque qui en découlent
    (jamais stockées, règle 16). Le sac dessous : provenance (Clerc A,
    Acolyte A, acheté, objet magique), fiche de l'objet, « équiper » qui
    remplit l'emplacement, × (revu : voir la bande d'équipement ci-dessous).
  - Bourse et charge en tête : l'or des options de départ (A/B de la
    classe et de l'historique), dépensé aux prix du ruleset ; charge selon
    la Force (Force × 7,5 kg en 2024, lu dans le ruleset).
  - **Changer ce qui est équipé (question de l'auteur)** : chaque
    emplacement a « changer ▾ » — les objets compatibles du sac, ou la
    boutique filtrée (« armure », « arme », « bouclier ») — et
    « déséquiper », qui remet l'objet au sac ; dans le sac, « équiper →
    Armure » dit où va l'objet, l'ancien revient au sac.
  - **Rendre ou vendre (demandes de l'auteur)** : pendant la création, ×
    **rend** l'objet et le **rembourse en entier** (on corrige une
    erreur) ; une fois en jeu, sur la fiche, × **vend** à la moitié du prix
    (règle 2024, ratio lu dans le ruleset). Un objet magique de départ se
    change dans sa sous-étape. **Poids et prix affichés et alignés en
    colonnes pour toutes les entrées** : emplacements, sac, boutique.
  - **Porter un objet : la bande d'équipement (décidée par l'auteur le
    7 octobre, après refus des quatre propositions)**. À gauche de chaque
    objet qui se porte, une bande-bouton sur toute la hauteur de la ligne
    (comme l'écran actuel), avec **le symbole du type** — armure, arme,
    bouclier, icônes au trait — au lieu d'un texte : éteinte quand l'objet
    est rangé, dorée quand il est porté. **Animation douce** : allumer un
    objet éteint en fondu celui qui occupait l'emplacement. Les objets qui
    ne se portent pas gardent la place de la bande, vide, pour l'alignement.
    Mouvement réduit : sans animation.
  - Téléphone et tablette : la ligne passe sur deux rangées (« rendre » ou
    « acheter » dessous) et **la bande couvre toute la hauteur de la
    carte** ; marge à droite pour que le prix ne touche pas le bord
    (remarques de l'auteur).
  - **Inventaire par ordre alphabétique** (demande de l'auteur), objets
    portés compris ; symbole de l'arme : une petite épée dessinée au trait
    (lame, garde, poignée, pommeau), comme les autres icônes du projet —
    aucune bibliothèque d'icônes (charte §10).
  - **Tuiles sans boutons, qui scintillent** : armure, main principale,
    main secondaire montrent ce qui est porté ; au remplacement, la tuile
    **scintille comme les dés** (nom et fiche défilent flous, parmi les
    objets du même type, puis se figent) et la CA compte jusqu'à sa
    nouvelle valeur. « Changer ▾ » et « déséquiper » disparaissent : tout se
    fait par la bande.
  - **Colonnes communes à l'inventaire et à la boutique** : bande (ou
    symbole du type en boutique), nom et fiche, poids, prix, action
    (« rendre », « acheter ») — poids et prix exactement au même endroit.
  - **Boutique cherchable (demande de l'auteur)** : une zone de recherche
    (nom, type, propriété — « épée », « armure », « perforants ») ; **sous
    chaque objet, sa fiche chiffrée** : dés de dégâts et propriétés, botte
    d'arme, CA et limite de Dextérité, Force requise, discrétion, poids.
    « Acheter » grisé si la bourse ne suffit pas.
  - **Départ à haut niveau (décidé le 7 octobre)** : d'après la table
    « Commencer à un niveau supérieur » du ruleset, au-delà du niveau 4 de
    l'or en plus (une somme fixe et un jet fait par le serveur) et, aux
    niveaux élevés, des objets magiques à choisir — une sous-étape
    d'Équipement. Les valeurs de la planche sont un exemple : **à vérifier
    dans le MdJ 2024** avant de saisir la table dans le ruleset.
  - Tablette et téléphone : les emplacements passent sur deux colonnes.

- **Création — l'Aperçu : décidé le 7 octobre, la fiche de personnage
  décidée, rien à réinventer** (remarque de l'auteur). L'étape Aperçu
  affiche la fiche telle qu'elle sera en jeu — celle des planches de la
  fiche (ordinateur V3.1-26, tablette V3.1-28, téléphone V3.1-32), même
  composant et même moteur, comme le fait déjà `PreviewStep.tsx` avec la
  fiche actuelle. Le personnage n'existe pas encore : les actions de jeu
  (jets, repos, PV) restent inactives, l'inventaire reste modifiable.
  Seuls ajouts, déjà présents aujourd'hui : les choix encore ouverts (un
  toucher ramène à leur sous-étape ; un personnage incomplet ou illégal
  reste créable, la fiche le rappellera) et « Créer le personnage ». Pas de
  planche dédiée.

- **Outils de Campagne (7 octobre)** : Gestion de campagne, Calendrier,
  Calendrier réel, Règles actives, Personnalisation, Publication, Journal
  historique.
- **Gestion de campagne — décidé le 7 octobre** : la disposition est
  décidée depuis le 1er octobre (V3.1-15, piste A, codée) et n'est pas
  rediscutée ; la planche « À valider · Gestion de campagne » la transpose
  au verre minéral — fenêtre à volets du MJ et rail, panneaux en verre,
  carte de joueuse en verre sombre avec le PJ en ambre, menus ⋮ et
  confirmations en surfaces flottantes (elles nomment `Nom#0000`), boutons
  de la charte ; tablette : deux cartes par rangée ; téléphone (Outils ›
  Gestion de campagne) : cartes l'une sous l'autre, ligne de lien réduite au
  rôle, Copier et ⋮.
  - **« Voir comme » (demande de l'auteur)** : en tête du menu ⋮ de
    chaque carte de joueuse, avant « Forcer une réinitialisation » et
    « Retirer de la campagne » : « Voir comme Inès#4821 » — l'application
    telle que la joueuse la voit, avec un bandeau pour revenir. Autorisation
    et garde-fous : **V3.1-12** (MJ de cette campagne seulement, comptes tag
    seulement, retour sûr).

- **Calendrier ingame — décidé le 7 octobre : la C, « l'année d'un coup
  d'œil »**. Ce qui existe aujourd'hui est `CalendarSettingsPanel` (jour
  actuel, semaine et repère de l'an 0, mois, ères, Enregistrer). Aucune donnée
  nouvelle : tout vit déjà dans `CalendarConfig`, remplacé en entier à
  l'enregistrement.
  - En haut, la **frise des ères** (largeur proportionnelle à la durée, le
    jour actuel marqué). À côté, **le jour actuel** : son jour de la semaine,
    son ère, l'an de l'ère et « jour 44 sur 360 ». Les pas Veille,
    Lendemain et « + une semaine » (libellé « décade » pour 10 jours) le
    déplacent ; « Changer la date » ouvre jour, mois et an.
  - Dessous, **les douze mois de l'année en vignettes** (nom, durée,
    mini-grille, le jour actuel allumé). **La semaine en puces** : › décale,
    × supprime, « + jour ». Le jour du 1er de l'an 0 se règle en ‹ ›.
  - Toucher un mois ou une ère ouvre **son réglage à droite**. Pour un mois :
    nom, durée en − / + (1 à 60), position ↑ ↓, la grille du mois, ajouter un
    mois après, supprimer. Toucher un jour de la grille le sélectionne
    (« dans 6 jours ») et propose « En faire aujourd'hui ». Raccourcir un
    mois recale le jour actuel.
  - Rien n'est enregistré avant « Enregistrer » ; la barre du bas dit s'il
    reste des modifications.
  - Tablette : la frise puis le jour actuel l'un sous l'autre, trois
    vignettes par rangée, le réglage sous l'année.
  - Téléphone (Outils › Calendrier) : le jour actuel, la frise, trois
    vignettes par rangée, la semaine. Un mois ou une ère touché s'ouvre en
    feuille du bas ; Enregistrer est en haut.

- **Calendrier réel — décidé le 7 octobre** : la disposition est
  décidée et codée depuis le 1er octobre (V3.1-16 : une grille à bascule
  « Mes disponibilités / Toute la table », toutes les heures visibles avec la
  ligne « 22:00 », colonne des heures fixe, croix au survol, info-bulle
  « (toi) » en tête, dates possibles classées par nombre puis par durée). Elle
  n'est pas rediscutée. La planche « Décidé · Calendrier réel » la
  transpose au verre minéral.
  - MJ : fenêtre à volets et rail. En-tête : titre, réponses, durée visée en
    − / +, « Annuler la demande » en danger fantôme. La grille et les dates
    possibles sont dans des panneaux en verre ; « Confirmer » est plein pour
    une session complète ; trois cartes en bas. Tablette : les cartes l'une
    sous l'autre. Téléphone (Outils › Calendrier réel) : la même colonne, la
    grille défile à l'horizontale.
  - Joueuse : page pleine « Prochaine séance » dans sa coquille (rail du
    joueur, barre du joueur au téléphone), sans aucun outil MJ. On y trouve
    la prochaine séance en grand, la demande ouverte et sa grille (« Toute la
    table » comprise) et les dates en lecture seule. L'enregistrement reste
    automatique (« Enregistrement… » puis « Enregistré ✓ »).

- **Règles actives — décidé le 7 octobre : la B, deux volets.**
  - **À gauche, le ruleset** :
    - le ruleset de la campagne et ses variantes, en arbre sous leur base ;
    - sur chaque ligne : Choisir, Exporter (jamais pour une référence
      personnelle), et × confirmé en surface flottante ; supprimer la
      variante active ramène la campagne à sa base ;
    - « Créer une variante » : base en puces, nom, interrupteur « Référence
      personnelle » avec son avertissement ;
    - « Importer des règles » : ajouter à la variante active, ou créer un
      ruleset personnel ; les erreurs sont listées ligne à ligne.
  - **À droite, la table** :
    - « Ce que les joueurs modifient eux-mêmes » (V3.1-23) : six
      interrupteurs, chacun dit qui tient la valeur (« le MJ » ou « la
      joueuse ») ; « Par défaut » remet les six réglages ;
    - l'inspiration au plus, en − / + ;
    - **l'aperçu de la fiche de la joueuse**, qui suit les interrupteurs en
      direct : « + état », ▲▼, emplacements inertes, « Le MJ dépense tes dés
      de vie ». C'est la fiche réelle en lecture.
  - **Données** : rien de neuf — `worlds.default_ruleset_id` et
    `campaigns.table_settings` (ADR 0036 §5).
  - **Tablette** : un seul volet, la table et l'aperçu d'abord, puis le
    ruleset et l'atelier.
  - **Téléphone** (Outils › Règles actives) : le ruleset, la table, l'aperçu,
    puis « Variantes et import » replié.

- **Personnalisation — décidé le 8 octobre : la C, « le fond d'abord ».**
  - **Barre en tête** :
    - le mode en pilule à quatre ; un mode que le fond ne permet pas est
      grisé, avec sa raison au survol ;
    - le flou du fond, de 0 à 40 px ;
    - le contraste élevé, en interrupteur.
  - **Galerie des fonds** : les fonds en grandes vignettes (les vraies
    miniatures), chacun avec ses modes lisibles en points de couleur.
    - Les images personnelles suivent, avec × pour supprimer, et « + Ajouter
      une image » en dernière vignette.
    - Choisir un fond qui ne permet pas le mode en cours bascule sur un mode
      permis, et le dit.
  - **Données** : rien de neuf. Les cookies `mode`, `contrast`, `background`
    et `bgBlur` (sur cet appareil, appliqués aussitôt) et la bibliothèque
    personnelle. Une ligne le dit sous la galerie.
  - **Tablette** : deux vignettes par rangée. **Téléphone** (Outils ›
    Personnalisation) : la barre en colonne, puis la galerie en deux
    colonnes.
  - **Ouverte aux joueuses (accord de l'auteur, 8 octobre)** : c'est un
    réglage personnel, et une joueuse n'y a aujourd'hui aucun accès. Le même
    écran lui est donné. **Emplacement validé le 8 octobre** :
    - « Compte » dans l'accueil (V3.1-35), pour tout le monde, à côté du
      profil ;
    - une entrée « Apparence » en pied du rail du joueur, au-dessus de
      « Mes mondes », qui ouvre l'écran en page pleine ;
    - au téléphone, par Accueil › Compte, car la barre est pleine ;
    - le MJ garde son outil.
- **À faire dans Publication (demande de l'auteur, 8 octobre)** : le même
  écran choisit le **fond par défaut du wiki public** (galerie, modes
  lisibles, flou), dans l'outil de partage du wiki. C'est un réglage du
  monde publié, pas un cookie de visiteur.

- **Publication — décidé le 8 octobre : la B**, les réglages à gauche et ce
  que voit un visiteur à droite.
  - **À gauche** :
    - « Partage en lecture seule » : alias, mot de passe, Créer un lien, le
      lien créé à copier, puis la liste (créé le…, protégé, Copier,
      Révoquer) ;
    - le message d'accueil (500 caractères, Enregistrer) ;
    - le fond par défaut du wiki : galerie de la Personnalisation, modes
      lisibles en points, mode des pages, flou. Choisir un fond qui ne
      permet pas le mode bascule sur un mode permis.
  - **À droite** : « Ce que voit un visiteur », la page d'accueil du wiki en
    petit (le message en titre, le sommaire, le fond, le mode, le flou), qui
    suit chaque changement. « Prévisualiser ↗ » ouvre le vrai.
  - **Le fond par défaut** est un réglage du monde. Il s'applique au wiki
    public (`/partage`) **et à l'onglet Wiki des joueuses** (décision de
    l'auteur), qui utilisent le même `BookSkin`. Une fiche qui a son propre
    fond (V2-G13) le garde.
    - **Donnée nouvelle** : le fond, le mode et le flou par monde. À écrire
      dans `docs/SCHEMA.md`, avec un ADR, avant de coder.
  - **Tablette** : un seul volet, l'aperçu d'abord, puis le message, le fond
    et les liens.
  - **Téléphone** (Outils › Publication) : les liens, le message, le fond,
    puis l'aperçu ; « Prévisualiser ↗ » en haut.

- **Journal historique — décidé le 8 octobre : la C**, « par fiche, ou
  chronologique ».
  - **Bascule en tête** :
    - « Par fiche » : une carte par objet modifié (nom, type, nombre de
      modifications), avec ses changements dedans (quand, qui, partie
      modifiée et détail). Toucher le nom ne montre que cette fiche.
    - « Chronologique » : la liste groupée selon le tri (plus récent, plus
      ancien, par personne, par fiche), chaque ligne dépliable.
  - **Filtres communs** :
    - la recherche (personne, fiche, mot) ;
    - « Qui » et « Élément » (fiches de personnage, PNJ, lieux, factions,
      objets, pages, jeu) en puces avec leur nombre ;
    - les filtres actifs en étiquettes (×, « Tout effacer »).
  - Les fiches supprimées sont à droite, avec « Rétablir ».
  - **Données** : le journal renvoie en plus `entity_kind`. Filtres et tri
    se font côté client, sur des entrées déjà réservées au MJ (contrôle
    serveur inchangé).
  - **Tablette** : une colonne, les fiches supprimées en bas.
  - **Téléphone** : la bascule et la recherche en tête, et « Filtres » en
    feuille du bas (tri, Qui, Élément, Partie modifiée, « Voir n
    résultats »).
- **Lot i terminé le 8 octobre** : les seize outils du MJ ont leur planche
  « Décidé ». **Découpé le 8 octobre en V3.1-41 à V3.1-62** (en fin de
  fichier, « Tickets du lot i »), plus V3.1-22, 23, 34, 37 et 38 déjà
  écrits.

- **Après le lot i — la fiche du wiki sur ordinateur : décidé le 8
  octobre, la A, « tout éditable, mieux rangé »** (planche « Décidé · Fiche
  du wiki sur ordinateur », `Wiki-Fiche-Decide.dc.html` ; B et C retirées).
  C'est l'écran le plus utilisé du MJ ; le téléphone garde l'éditeur décidé
  (V3.1-30, 31).
  - La fiche s'édite directement, au verre minéral, dans la fenêtre à volets
    (V3.1-20).
  - **En-tête** :
    - le titre (nom par défaut sélectionné sur une fiche neuve) ;
    - le type ▾ (PJ, PNJ, Lieu… « + Créer une catégorie ») ;
    - l'historique et l'œil du wiki public ;
    - l'adresse (slug) dessous ;
    - Alias et Relations en pastilles (× et « + ») ;
    - le portrait à droite.
  - **Une carte de verre par bloc.** Son en-tête :
    - ⠿ pour glisser, aussi au clavier ;
    - ▾ / ▸ pour replier ;
    - le titre, éditable sur place ;
    - le type en pastille ;
    - « Enregistré », annoncé poliment ;
    - **la visibilité en pastille de couleur** (vert Public, bleu Joueurs,
      orange MJ, gris Privé), qui ouvre un menu disant qui la voit (« le MJ
      seul — jamais envoyé aux joueurs ») ;
    - ⋮ : Monter, Descendre, Dupliquer, Choisir la visibilité…,
      Supprimer… La suppression est confirmée et rappelle l'historique. Les
      ▲▼ d'aujourd'hui passent dans ⋮.
    - **Revu le 8 octobre** : toucher la pastille fait passer à la
      visibilité suivante, avec « Annuler » (voir les blocs Récit).
  - **Texte** : toucher un paragraphe ouvre la bulle de l'éditeur riche
    (niveau de titre, G / I / S, Lier à une fiche, Créer une fiche,
    Spoiler, visibilité du paragraphe : Public, Joueurs, MJ). Un passage MJ
    est bordé d'orange (`--gm`) et marqué « MJ » ; un passage Joueurs est
    bordé de bleu.
  - **« + Ajouter un bloc »** ouvre la palette en familles :
    - Récit : Texte, Encadré, Image, Tableau, Chronologie ;
    - Personnage : Personnage, Inventaire, Incantation, Ressources, Fiche de
      créature ;
    - Psyché et liens : Personnalité, Relation, Convictions, Réseau,
      Généalogie ;
    - Outils de jeu : Table aléatoire, Quête, Musique, Carte.
  - **Fenêtre étroite** (tablette, volet partagé ; requête de conteneur) :
    portrait réduit, personnalité sur une colonne, type de bloc masqué dans
    l'en-tête de carte.
  - **Données** : rien de neuf.
  - **Ensuite, les blocs eux-mêmes (question de l'auteur)** : l'intérieur de
    chaque éditeur, par famille — Récit, puis Psyché et liens, puis Outils
    de jeu. Les blocs de personnage sont déjà décidés avec la fiche.

- **Les blocs de la fiche du wiki — 1 · Récit : décidé le 8 octobre**
  (planche « Décidé · Blocs de la fiche — 1 · Récit »,
  `Blocs-Recit-Decide.dc.html`). Tout est accepté tel que proposé ; pour
  l'Image, la B.
  - **Texte** : la lettrine en interrupteur dans l'en-tête de la carte ;
    l'assistance IA en encart violet sous le texte, la proposition en
    pointillé à sa place, rien d'écrit avant « Accepter » (règle 9), le
    budget visible.
  - **Encadré** : lignes lues comme dans le wiki, éditées sur place ; ⠿ ;
    « @ » cite une fiche ; intitulés suggérés selon le type de fiche (liste
    à décider en codant : code ou données).
  - **Tableau** : un vrai tableau ; × de colonne et de ligne au survol ;
    « + » au bout des en-têtes, « + Ligne ».
  - **Image (B)** :
    - toucher l'image fait paraître une barre flottante (Gauche, Centre,
      Droite ; − taille + ; « Le texte contourne ») ;
    - l'aperçu montre l'image dans le texte, telle qu'elle sera dans le
      wiki, avec sa légende ;
    - à part : l'emplacement (bloc autonome ou dans un bloc de texte), la
      parallaxe, et le fond de la page du wiki (non, en fond et dans la
      fiche, seulement en fond) avec flou et fondu.
  - **Chronologie** : l'axe en bande (périodes, jour actuel en trait doré) ;
    une ligne par événement, genre et visibilité en pastilles, « → en faire
    une fiche ».
- **La pastille de visibilité au toucher (demande de l'auteur, 8 octobre),
  pour tous les blocs et les événements de la Chronologie** :
  - un toucher fait passer à la visibilité suivante : Public → Joueurs →
    MJ → Privé → Public ; couleur et libellé suivent ;
  - chaque changement s'annonce (« visible par le MJ seul ») avec
    « Annuler » ; quand le bloc redevient plus visible, l'annonce le dit ;
  - le choix direct reste dans ⋮ « Choisir la visibilité… ».
  - **Limite connue** : l'écriture est immédiate, donc un clic de trop sur
    un bloc MJ le rend visible jusqu'à « Annuler » — d'où l'annonce. La
    visibilité reste filtrée côté serveur (règle 5).

- **Les blocs de la fiche du wiki — 2 · Psyché et liens (8 octobre,
  décidé ; tours 2 à 4 le même jour)** : la première planche (une seule proposition) est remplacée, à la
  demande de l'auteur, par **trois propositions par bloc**, une planche par
  bloc (`Psy-pers`, `Psy-conv`, `Psy-rel`, `Psy-net`, `Psy-fam`
  `-Propositions.dc.html`). Toutes suivent `specs/psyche-pnj.md` :
  −100…+100 en base, **bandes nommées à l'écran**, valeur exacte au survol
  pour le MJ (§1.5). L'auteur veut garder les **graphes en radar** qui
  existent aujourd'hui, au moins pour la Personnalité et les Convictions.
  - **Décidé (8 octobre)** — planche « Décidé · Psyché et liens »
    (`Psy-Decide.dc.html`), ordinateur et téléphone ; la tablette reprend le
    dessin d'ordinateur dans la colonne de la fiche.
    - **Personnalité : A.** Radar en tête (bandes nommées aux sommets), six
      barres bipolaires pour régler, ★ pour les deux pôles prioritaires ;
      aspirations en trois colonnes (Une vie, En ce moment, Ce soir), « Ne
      fera jamais » / « Fera, à contrecœur », façon de parler, souvenirs
      repliables. Téléphone : radar au-dessus, chaque barre sur trois lignes
      (les deux pôles, la barre, le mot), colonnes empilées.
    - **Convictions : deux blocs, même dessin** (pas de fusion : une faction
      a des convictions sans tempérament, chaque bloc garde sa visibilité).
      « Comparer avec » pose la faction en pointillé bleu sur le radar et en
      trait bleu sur les barres ; la tension s'écrit dessous (calcul
      d'affichage dans le noyau, testé d'abord).
    - **Deux renommages, libellés seulement** (clés et valeurs inchangées,
      aucune migration) : `curiosity_caution` → « Circonspection ↔
      Curiosité » (fin du doublon « Prudence ») ; `wealth_honor` → « Profit ↔
      Honneur ». « Calme ↔ Emportement » n'est pas retenu.
    - **Réseau : B.** Liens du wiki (table `relations`) en vignettes
      (portrait, sinon icône du type) avec un liseré par type ; filtres par
      type avec leur nombre ; « Trouver… » ; le survol allume les liens et
      les voisins et écrit le type de lien ; toucher ouvre la carte de la
      fiche. Téléphone : pas de survol — un toucher allume la vignette et
      fait paraître les noms voisins, un second ouvre la fiche ; seuls les
      noms utiles s'affichent ; filtres en bande qui défile. Le portrait
      s'ajoute à `GraphEntityInput` côté service (une requête groupée).
    - **Généalogie : B.** Grands portraits, nom en pastille à cheval sur le
      bas, dates dessous, traits arrondis, ex-partenaire en pointillé
      orange, défunt en gris, zoom ; toucher : ouvrir, centrer l'arbre ici,
      ajouter un des neuf liens. Téléphone : cartes plus petites, prénoms
      seuls, l'arbre se parcourt du doigt et s'ouvre centré sur la fiche.
    - **Dates de naissance et de mort : en attente.** La donnée n'existe pas
      (ni `relations`, ni le bloc `character`) : `SCHEMA.md` et ADR avant
      tout code.
  - **Relation — décidé (8 octobre) : la A du tour 4**, ajoutée à la
    planche « Décidé · Psyché et liens » (ordinateur et téléphone).
    Quatre tours : radar et barres, puis fil/boussole/courbe, puis
    perles/faisceau/face-à-face, enfin trois croisements de la finesse des
    perles et du résumé central.
    - **En tête, le face-à-face** : deux portraits (ceux de la Généalogie B,
      colonnes de 184 px pour que les noms tiennent dans le bloc) — la
      fiche, et la cible qu'on change (« Envers ▾ » : n'importe quelle fiche,
      personnage, faction, créature).
    - **Au milieu, le résumé** : « Sildar envers Gundren », les bandes
      fortes en mots (« aveugle, amical, admiratif et obligé »), le nombre de
      souvenirs et la date du dernier. Recalculé en direct à partir des
      valeurs et du journal, jamais stocké (règle 16).
    - **Dessous, les fils sur toute la largeur** : un fil par axe, une perle
      qui glisse au point près, son mot dedans ; vers l'autre portrait = le
      sentiment le vise, au milieu = neutre ; survol (toucher sur
      téléphone) = pourquoi, d'après le journal ; « MJ » sur Attirance.
    - « ⇄ Voir l'autre sens » lit le bloc de la cible envers la fiche (sa
      visibilité à lui) ; s'il n'existe pas, on propose de le créer.
      « Attirance » est masquée quand la cible n'est pas une personne.
    - Téléphone : portraits plus petits, prénoms seuls, mêmes fils.
    - Données : la cible accepte déjà toute entité (`target.kind:
      "entity"`) ; le portrait vient de `entity_assets` (rôle `portrait`),
      sinon l'icône du type.
    - Inspirations notées (à décider à part, données nouvelles) : une
      étiquette de lien nommée à la Dwarf Fortress / Crusader Kings
      (« compagnon d'armes », « rancune »…), et le compteur de rencontres
      — dérivable du journal, donc sans stockage.
  - **Vu dans le code** :
    - les curseurs affichent aujourd'hui le nombre, contre la spec §1.5 ;
    - deux pôles portent le même nom, « Prudence » (curiosité ↔ prudence,
      impulsivité ↔ prudence). Proposé : « Conservatisme » pour le premier,
      comme dans la spec.
  - Les exemples « trait, idéal, lien, défaut » des planches de la fiche
    (Personnalité) n'étaient pas le vrai modèle : c'est celui-ci qui fait
    foi.
  - **Dates de naissance et de mort — décidé (8 octobre)** : naissance
    du bloc `character` (V3.1-48) ; mort = champ optionnel `death`
    (`GameDate`) du même bloc, « défunt » = `death` renseigné ; une fiche
    sans bloc `character` n'a pas de dates dans l'arbre. Ticket V3.1-74.

- **Les blocs de la fiche du wiki — 3 · Outils de jeu (8 octobre,
  décidé)** : une planche par bloc, trois propositions vivantes chacune
  (`Outil-{tab,quest,music,map,crea}-Propositions.dc.html`). La Fiche de
  créature est rangée dans la famille Personnage de la palette, mais n'avait
  pas encore de dessin : elle est traitée ici. Le Générateur reste l'outil
  du MJ déjà décidé (planche « Décidé · Générateurs »), pas un bloc de la
  palette.
  - **Décidé le 8 octobre** — planche « Décidé · Outils de jeu »
    (`Outils-Decide.dc.html`), ordinateur et téléphone ; la tablette reprend
    le dessin d'ordinateur dans la colonne de la fiche.
    - **Table aléatoire : A.** La table telle qu'on la lit, « Tirer · d20 »
      au-dessus, résultat en carte, liens vers les fiches, sous-tirage
      `{table:…}` écrit dessous, « Sans répétition », prix et palier,
      attribution. **Le tirage reprend l'animation de l'outil de dés**
      (scintillement, V3.1-33) : les dés défilent flous puis se figent un
      par un (le d20, puis le dé de la sous-table), le temps que le serveur
      lance (règle 8) ; la ligne sortie ne s'allume qu'à la fin ; mouvement
      réduit → résultat immédiat.
    - **Quête : C.** Repliée en une ligne (anneau de progression, état,
      commanditaire, prochain objectif) ; dépliée : pilule d'état à cinq
      choix, objectifs à cocher, récompenses et prérequis (l'un sous l'autre
      sur téléphone).
    - **Musique : A, complétée.** La platine en tête, la liste dessous.
      Ajouts demandés : « ⋯ » sur une piste règle où elle commence et où
      elle finit (`startSeconds` / `endSeconds`, YouTube seulement ; pour
      Spotify et SoundCloud le bloc dit pourquoi c'est impossible) ; durée
      des fondus entrant et sortant réglable (`fadeInMs` / `fadeOutMs`, 0 à
      5 s par pas de 0,5 s). Lancer à la visite, boucle, fondus en
      interrupteurs. Rien de neuf en base : les champs existent déjà
      (ADR 0022).
    - **Carte : C.** La carte et sa liste rangée par couches ; toucher un
      nom centre la carte ; pastilles de visibilité au toucher ; une punaise
      n'est vue que si sa couche l'est aussi (ADR 0017) ; « Voir comme les
      joueurs ». Téléphone : la liste passe sous la carte.
  - **Fiche de créature — décidé (8 octobre) : A, la fiche en deux
    colonnes** (planche « Décidé · Fiche de créature »,
    `Creature-Decide.dc.html`, ordinateur et téléphone). Demande de l'auteur
    : reprendre les éléments et l'apparence de la fiche de personnage.
    Exemple : Venomfang (jeune dragon vert), pour la capacité à recharge.
    - **Colonne de gauche** : en-tête à portrait (nom, taille, type,
      alignement, FP, PX, repaire) ; jauges : bouclier de CA, anneau de PV à
      commandes (▲ — ▼), anneau de FP à la place du niveau ; **constantes en
      quatre tuiles égales, libellés sur une ligne** — Initiative (jet),
      Vitesse, Maîtrise, Taille — et les autres vitesses dessous (« Aussi :
      vol 24 m · nage 12 m ») ; Perception passive et boîte des états sur la
      ligne suivante, comme la fiche ; « Ce qui se recharge » (point prêt /
      dépensé, jet « Recharge d6 ») ; caractéristiques à deux boutons (test,
      sauvegarde ; le point plein = maîtrise du jet).
    - **Colonne de droite** : pilule glissante Actions / Traits / Maîtrises.
      Actions : attaques (attaques multiples, chaque attaque avec ses
      pastilles « toucher » et « dégâts »), capacités (souffle : DD, dégâts,
      estompé une fois dépensé), réactions, actions de base en puces. Traits
      : traits, repaire (lien de fiche). Maîtrises : jets de sauvegarde,
      compétences (jets), défenses, sens et langues.
    - Tablette : la fiche suit la largeur de sa fenêtre (piste B, comme la
      fiche de personnage). Téléphone : une colonne, la pilule après les
      caractéristiques.
    - Inchangé : valeurs plates saisies (`statblock`), seuls les
      modificateurs se calculent (règle 16) ; chaque pastille ouvre l'outil
      de dés pré-rempli, le serveur lance (règle 8). Données : « Ce qui se
      recharge » et l'état prêt / dépensé du souffle sont du jeu (suivi
      d'initiative, specs/outils-mj.md §5), pas du bloc ; la recharge
      elle-même (5–6) est écrite dans le texte de la capacité — à
      structurer plus tard si un cas l'exige.
  - **Outils de jeu : tout est décidé.** Découpé le 8 octobre en tickets
    V3.1-63 à V3.1-79 (avec la fiche du wiki, Récit et Psyché et liens),
    en fin de fichier.

- **Règles sur ordinateur — décidé le 8 octobre : la A, le sommaire et la
  fenêtre à volets** (planche « Décidé · Règles sur ordinateur »,
  `Regles-Ordi-Decide.dc.html` : MJ sur ordinateur, joueur en page pleine,
  fenêtre étroite ; B et C retirées). Le téléphone reste V3.1-30.
  - **Aujourd'hui** (`RulesSidebar.tsx`, `RuleEntryView.tsx`) : une barre de
    280 px hors fenêtre, puis une fenêtre par règle (titre, type, source,
    cadre d'illustration vide côté MJ, blocs, fiche de monstre, renvois).
  - **Le sommaire passe dans la fenêtre** (250 px) : recherche, « Récemment »
    (les règles ouvertes dernièrement), catégories repliables avec leur
    nombre de fiches, sous-classes sous leur classe et sous-espèces sous leur
    espèce (comme aujourd'hui) ; en pied, « + Ajouter une règle ▾ » (arme,
    historique, don, sous-classe, sort maison) et « Bacs à sable ▾ »
    (formules, déclencheurs).
  - **La règle au centre** : titre, type, source ; « Modifiée dans ta
    variante » et, sur le bloc modifié, la bascule **Officiel / Ta
    variante** ; propriétés en encadré ; texte, renvois soulignés en
    pointillé ; « Aux niveaux supérieurs » ; **Cette règle cite / Citée
    par** en pied. Plus de cadre d'illustration vide.
  - **Toucher un renvoi l'ouvre dans le volet de droite** (V3.1-20), sans
    perdre la règle lue ; × le ferme. **Chaque règle ouverte devient un
    onglet** de la fenêtre.
  - ⋮ : épingler au Bloc-notes, copier le lien pour le wiki, créer une
    version maison (copie dans la variante, éditable), Modifier (fiches
    maison seulement, V3.1-2 ; une règle officielle ne se modifie jamais,
    règle 18).
  - **Fenêtre étroite** (tablette, volet partagé ; requête de conteneur) :
    sommaire en tiroir ☰, renvoi en panneau opaque par-dessus la page
    (340 px).
  - **Joueur** (page pleine, sans fenêtre) : même page ; sommaire sans
    « Ajouter » ni bacs à sable ; pas de ⋮ ; pas de bascule Officiel /
    Variante (il lit les règles de sa table, badge « Règle de la table ») ;
    pas de données brutes (comme aujourd'hui).
  - **Données** : rien de neuf ; la liste des règles reste lue à la demande
    (V2-G1), « Récemment » vit dans le navigateur comme au téléphone
    (V3.1-30).

- **Chronologie du monde — décidé le 9 octobre** : la B retenue, **refaite à
  l'horizontale** à la demande de l'auteur, avec le réglage des ères —
  planche « Décidé · Chronologie du monde » (`Chrono-B-Horizontale.dc.html` ;
  A et C retirées).
  - **Aujourd'hui** (`/m/[monde]/chronologie`, `WorldTimelineView.tsx`,
    `src/server/services/timeline.ts`) : une liste de cartes — toutes les
    entrées visibles de tous les blocs Chronologie du monde, triées et
    regroupées par ère ; chaque carte : genre, date, titre (lien si
    l'entrée est devenue une fiche), résumé, « Depuis la fiche de… ». MJ
    seulement, par le sommaire du Monde.
  - **Retours du 9 octobre (auteur)** : le fleuve horizontal est retenu ;
    il se parcourt à la molette et se zoome ; la chronologie générale
    devient aussi une page des joueurs ; les séances n'y paraissent pas ; on
    ajoute un événement directement dans la frise générale ou par un bloc
    Chronologie d'une fiche.
  - **Le fleuve à l'horizontale** : un axe horizontal, **proportionnel au
    temps** ; les événements de part et d'autre (une carte au-dessus, la
    suivante au-dessous), reliés à leur point, couleur du genre ; les **ères
    en bandeaux colorés** sur l'axe, leur nom suit la vue ; graduations
    selon le zoom (250, 100, 50, 10, 5 ans) ; « aujourd'hui » en trait doré.
  - **Se déplacer** : **molette haut / bas = défiler de gauche à droite** ;
    **Ctrl + molette (ou pincer) = zoomer** autour du point visé ; − / + ;
    glisser ; ‹ › ; préréglages Le monde, Une ère, Un siècle, Une vie ;
    **« ◎ Centrer sur aujourd'hui »** (demande de l'auteur) ramène la vue sur
    le jour actuel, au même zoom, si l'on a défilé trop loin (MJ et joueurs).
  - **Le zoom règle le niveau de détail** : chaque date a une **portée** —
    **Monde** (paraît de loin), **Région** (à l'échelle d'une ère, au-dessous
    de ~400 ans), **Détail** (au-dessous de ~130 ans : naissances et morts
    des personnages, rencontres…). La barre dit ce qu'on voit (« Vue : 120
    ans · tout, jusqu'aux naissances ») et combien de dates attendent un
    zoom de plus. Des cartes qui se chevaucheraient se rangent en « + n
    autour » sur la carte voisine, qui zoome dessus. Le MJ change la portée
    d'un toucher sur la carte (Monde → Région → Détail).
  - **D'où viennent les dates** : la frise générale rassemble toutes les
    dates du monde — les entrées des blocs Chronologie des fiches, **les
    naissances et morts des fiches personnage** (V3.1-48, 74), et les
    événements **ajoutés directement dans la frise générale** (« + Événement
    » → « dans : la frise générale » ou une fiche). Chaque carte dit d'où
    vient sa date. **Pas de séances.**
  - **Visibilité** : chaque date garde la sienne (celle de l'entrée, ou du
    bloc personnage pour une naissance ou une mort) ; pastille au toucher
    (V3.1-64) ; « Voir comme les joueurs ».
  - **Joueurs : une page du Wiki** (rail du joueur ; téléphone : Wiki ›
    Chronologie) : la même frise, **seulement ce qu'ils peuvent voir** (une
    date MJ ou privée n'est pas envoyée, règle 5) ; mêmes gestes et niveaux
    de détail ; ni ères à régler, ni « + Événement », ni pastilles.
  - **Les ères (« Ères… »)** : panneau à droite — nom, année de début (fin =
    début de la suivante), ×, « + Ajouter une ère », « Enregistrer ». Rien de
    neuf en base : `CalendarConfig.eras` (`name`, `startYear`), le même
    réglage que l'outil Calendrier (V3.1-55).
  - **Communs** : filtres par genre et par fiche, recherche, « → en faire
    une fiche » (route `timeline-promote` existante).
  - **Données à décider (Opus, ADR)** : (1) **la portée** d'une entrée
    (`major` / `notable` / `detail`), par défaut selon le genre — guerre,
    catastrophe, fondation → Monde ; bataille, découverte, serment,
    trahison → Région ; naissance, mort, rencontre → Détail ; naissances et
    morts des fiches personnage → Détail ; (2) **où vit un événement ajouté
    directement** dans la frise générale — proposé : le bloc Chronologie
    d'une fiche système « Chronologie du monde », hors des listes du wiki
    (comme le Livre de sessions), plutôt qu'une table nouvelle ; (3) le
    service qui agrège (`getWorldTimeline`) lit aussi naissances et morts,
    en une requête groupée, visibilité filtrée côté serveur.
  - **Décidé** (9 octobre), avec le bouton « Centrer sur aujourd'hui ». Les
    trois points de données ci-dessus restent à trancher par Opus, ADR à
    l'appui, avant de coder la page.
- **Compte — décidé le 9 octobre : la A, une page en sections** (planche
  « Décidé · Compte »). Dans le rail de l'accueil (Mondes, Compte,
  Administration, Déconnexion — V3.1-35). Aujourd'hui, la colonne « Profil »
  de l'accueil (`HomeProfilePanel`) porte email, nom affiché, mot de passe,
  « Mon lien d'invitation » et la zone dangereuse ; la langue
  (`setLocaleAction`) et l'identifiant « nom #0000 » (V3.1-10) existent côté
  serveur sans écran. Aucune donnée nouvelle.
  - Sections empilées en cartes de verre : **Identité** (nom affiché,
    identifiant « Léonie #4821 » avec sa note — visible ici et par le MJ des
    campagnes —, email seulement pour les comptes ouverts avec un email),
    **Connexion** (nom et mot de passe ; oublié : réinitialisé par le MJ ou
    l'administrateur, aucun email), **Mon lien d'invitation** (seulement si
    l'on a rejoint par un lien), **Apparence**, **Langue** (Français /
    English, enregistrée sur le compte), **Supprimer le compte** en rouge,
    en bas (taper SUPPRIMER). Un sommaire à gauche (200 px) allume et
    rejoint la section.
  - **Apparence = la Personnalisation décidée (C)**, le même composant que la
    fenêtre Personnalisation des outils du MJ (un code, deux portes) : la
    barre (pilule des quatre modes, contraste élevé, puis le flou du fond sur
    toute la largeur) et la galerie de fonds avec leurs modes lisibles,
    images personnelles (+, ×). Plus de lien « Toute la personnalisation ».
  - Tablette : le sommaire devient une rangée de pastilles en tête (Identité,
    Connexion, Invitation, Apparence, Langue, Supprimer), galerie à deux
    vignettes. Téléphone : Accueil › Compte (« ‹ Accueil »), mêmes pastilles,
    champs sous leur libellé, la barre de l'apparence en colonne.
    **Au téléphone (corrigé le 9 octobre)** : dans la barre en colonne, le
    flou ne prend jamais « toute la largeur » par `flex-basis: 100%` (en
    colonne, cela devient toute la hauteur et pousse le flou hors de
    l'écran) ; la pilule des modes garde sa hauteur, libellés en 11 px ; un
    bouton à côté d'un champ (« Enregistrer », « Supprimer définitivement »)
    passe sous le champ plutôt que de se couper sur deux lignes.
  - Écartées : B (onglets), C (carte d'identité et lignes de réglages).
- **Choix du personnage — décidé le 9 octobre : la C2** (planche
  « Décidé · Choix du personnage »). Aujourd'hui, `ChooseCharacterScreen`
  (V3.1-10) est une liste de noms en boutons, avec « Nouveau PJ ». Il
  s'affiche dans l'onglet Personnage quand une joueuse membre d'un monde n'a
  pas de PJ (ajoutée par email, ou PJ libéré par le MJ).
  `claimCharacterAction` réclame le PJ, et le MJ peut le réattribuer. Le lien
  ouvert (`/rejoindre`) propose les mêmes PJ dans un menu déroulant. Les
  trois propositions demandent à `listUnclaimedCharacters` le portrait
  (`entity_assets`, rôle portrait, l'initiale à défaut), le `summary` et
  l'identité calculée par `characterSheet()` (espèce, classe, niveau). Rien
  n'est stocké, et seules les fiches que la joueuse peut voir sont envoyées.
  - **Retenue : la C, la sélection de héros** (9 octobre). Un carrousel :
    un personnage au centre, ses voisins en retrait, des flèches, des points
    et les touches ← →. A (galerie) et B (liste et aperçu) sont écartées.
  - **Décidé : la C2** (9 octobre). « Nouveau personnage » est une carte du
    carrousel, en pointillés avec un grand + ; centrée, le bouton unique
    devient « + Créer mon personnage ». La variante C1 (deux boutons
    jumeaux) est écartée.
  - **La page s'ouvre sur « Nouveau personnage »** : à sa gauche le dernier
    personnage ouvert, à sa droite le premier (le carrousel boucle). Sans
    personnage ouvert, la carte est seule, sans flèches ni points.
  - Tablette : le même carrousel, sans flèches (on glisse), cartes de
    280 px. Téléphone : onglet Perso. de la barre du joueur, une carte de
    250 px au centre, les voisines qui dépassent des bords, le bouton sur
    toute la largeur au-dessus de la barre.
- **Écrans d'entrée — décidé le 9 octobre : la C, « Antre Nous » et le
  d20** (planche « Décidé · Écrans d'entrée »). Aujourd'hui, `/login` (V3.1-10) est une carte
  simple : bascule « Se connecter / Créer un compte », « Nom ou email » et
  mot de passe, création d'un compte sans email (nom et mot de passe), et
  deux liens « Mot de passe oublié ? » (avec email : `/auth/forgot-password` ;
  sans email : « Signaler », la demande arrive chez le MJ). `/signup`
  (compte à email) ne change pas.
  - Proposé dans les trois : **un seul « Mot de passe oublié ? »**. Un champ
    « nom ou email », le serveur choisit la voie (lien par email, ou demande
    au MJ ou à l'administrateur), et la même réponse s'affiche que le compte
    existe ou non : l'écran ne révèle jamais si un nom existe.
  - **Retenue : la C, l'écran-titre**. Le titre en très grand sur le fond
    flouté, un menu de trois gros boutons (Se connecter, Créer un compte,
    J'ai un lien d'invitation) ; choisir ouvre un petit panneau à la place
    du menu, « ‹ Menu » pour revenir. A (carte de verre) et B (image et
    panneau) sont écartées.
  - **Marque décidée : « Antre Nous »** (l'antre du dragon, et « entre
    nous », la table d'amis), phrase d'accueil « Le repaire de ta table. »,
    **logo d20** au trait en tuile d'accent. Elle s'affiche sur l'écran-titre,
    en tête du rail de l'accueil (hors d'un monde), dans l'onglet du
    navigateur (titre et favicon). « CreaDonjon » reste le nom du dépôt.
  - **Le superadmin la change** : Administration › Identité de
    l'application. Nom (32 caractères), phrase d'accueil (80), logo parmi
    les douze au trait (d20, porte du donjon, œil du dragon, gobelet, plume
    et dé, clé, grimoire, tour, dédale, écaille, antre, carte) ou une image
    téléversée (PNG ou WebP carré de 512 px, **jamais de SVG téléversé** :
    il peut porter du script). Aperçu en direct, « Enregistrer » l'applique
    à tous, « Rétablir « Antre Nous » » revient au défaut.
  - **À trancher par Opus (ADR), changement de schéma** : où vit
    l'identité de l'application. Rien n'existe dans `docs/SCHEMA.md`.
    Proposé : une table à ligne unique `app_identity` (`name`, `tagline`,
    `logo_key` parmi les douze, `logo_asset_path` via l'interface de
    stockage), RLS en lecture pour tous (l'écran-titre la lit avant
    connexion), écriture réservée au superadmin. Les textes par défaut
    restent dans `messages/`.
- **Administration — décidé le 9 octobre : la B, le tableau de bord**
  (planche « Décidé · Administration »), dans le rail de l'accueil (marque
  Antre Nous).
  Aujourd'hui, `AdminPanel` affiche deux tableaux sur l'accueil :
  - « Liens d'invitation — tous mondes » : monde, campagne, rôle, réclamé
    par, état ; le menu ⋮ propose copier, voir comme, mot de passe,
    réinitialiser le lien, révoquer, supprimer le compte ;
  - « Comptes — toute la plateforme » : nom, réinitialisation demandée ; le
    menu ⋮ propose forcer une réinitialisation, transférer un ruleset,
    supprimer.

  Les trois propositions gardent chaque geste, ajoutent « Identité de
  l'application » (décidée) et une recherche de compte. Le numéro (#4821)
  n'apparaît jamais ici (V3.1-10).
  - **Retenue : la B.** Quatre tuiles en tête : À traiter (nombre en
    accent), Comptes, Liens d'invitation actifs, Identité de l'application
    (logo et nom). La tuile choisie ouvre sa liste dessous, et la page
    s'ouvre sur « À traiter ».
  - **À traiter** : les demandes de réinitialisation de tous les comptes,
    chacune avec « Forcer une réinitialisation » en un clic (lien à usage
    unique, à transmettre hors de l'application). Pour mémoire, sans geste :
    les comptes qui doivent changer leur mot de passe
    (`must_change_password`). Sans rien à traiter, la tuile affiche 0 et la
    page s'ouvre sur Comptes.
  - **Comptes et Liens d'invitation** : les deux tableaux d'aujourd'hui en
    lignes de verre, avec leurs étiquettes (superadmin, réinitialisation
    demandée, doit changer son mot de passe) et ⋮. Les gestes ne changent
    pas ; les destructeurs sont en rouge et confirmés (`ConfirmDialog`).
    Recherche de compte par nom.
  - **Identité de l'application** : le panneau décidé avec les écrans
    d'entrée.
  - Tablette : tuiles en 2 × 2, lignes de lien sur deux lignes, ⋮ en haut à
    droite. Téléphone : Accueil › Administration, « ‹ Accueil », mêmes
    tuiles, champs sous leur libellé.
  - **Titres des joueurs (ajouté le 9 octobre, demande de l'auteur)** : une
    cinquième tuile, « Titres des joueurs », où le superadmin paramètre tout
    des titres du volet « Je joue » : pour chacune des quatre cases (Chance,
    Malchance, Bourse, Action favorite), ses **paliers** — plage (de … à …),
    nom, petit texte à variables, icône parmi douze, couleur parmi cinq.
    Voir V3.1-92.
  - Écartées : A (sections et sommaire), C (liste et fiche du compte).
- **Accueil, volet « Je joue » : statistiques — décidé le 9 octobre :
  l'histogramme de B et les titres de C** (planche « Décidé · Accueil,
  volet « Je joue » »). L'auteur veut, sous
  « Mon personnage » et « Prochaine séance », des statistiques rigolotes qui
  remplissent le volet sans défiler : pièces gagnées et dépensées, d20
  moyen, nombre de 20 et de 1 naturels, action la plus utilisée. Ajoutés en
  proposition : séances et heures de jeu, plus gros coup, fois à terre et
  jets contre la mort réussis. Bascule « Cette campagne / Dernière séance ».
  - **Retenu** : sous « Tes dés et tes titres » (avec la bascule), l'**histogramme
    du d20** (combien de fois chaque face est sortie ; le 1 en rouge, le 20
    en vert ; survol d'une barre : « 14 : 13 fois »). **Au-dessus** : au
    centre la moyenne en grand (« 11,4 », ~26 px) et « 214 jets » en petit
    (12 px) à côté ; le nombre de 1 en rouge au-dessus de la colonne du 1,
    le nombre de 20 en vert au-dessus de la colonne du 20, en taille
    intermédiaire (~17 px). Puis les **quatre titres** en 2 × 2. La
    bande de chiffres de la C est retirée. Les tuiles (A) et le carnet (B)
    sont écartés.
  - **Les titres** sont calculés, jamais stockés : la chance (« Béni des
    dés » si plus de 20 naturels que la moyenne de la table, « Chat noir »
    pour les 1), la bourse (« Bourse percée » si l'on dépense plus qu'on ne
    gagne, « Écureuil » sinon), l'action favorite (un titre par sorte :
    « Lame de l'ombre » pour les attaques sournoises, « Arcaniste » pour
    les sorts…). **Titres, seuils, icônes et couleurs sont paramétrables
    par le superadmin** (Administration › Titres des joueurs, V3.1-92) ;
    les valeurs livrées sont des valeurs par défaut.
  - Téléphone : le même volet en feuille, la bascule sous son titre,
    histogramme plus bas, titres resserrés, bouton sur toute la largeur.
  - **Point de données pour Opus** : voir V3.1-89. `dice_rolls` ne dit
    ni qui a lancé ni pour quel personnage (`who` n'est qu'un nom affiché),
    ni quel d20 est gardé en cas d'avantage. L'argent gagné et dépensé est
    déjà calculé à partir des révisions du bloc `inventory`
    (`campaignEconomy.ts`), à vérifier depuis V3.1-24.
  - Le cadre retenu habillera aussi Rejoindre (`/rejoindre/[token]`), sa
    porte à mot de passe, et Réinitialiser (`/reinitialiser/[token]`).
  - **PJ ouvert sans fiche de personnage** (fiche de wiki seulement, pas de
    bloc `character`) : à la place de l'espèce et de la classe, l'étiquette
    « Fiche de personnage à créer » ; le portrait et le `summary` viennent de
    la fiche de wiki. Le bouton dit « Jouer Mirelle · créer sa fiche ».
  - **Après le choix**, l'onglet Personnage montre la fiche jouable du PJ.
    Sans fiche, la réclamation ouvre directement l'assistant de création
    (Création décidée, A), déjà au nom et au portrait de la fiche de wiki.
    Aujourd'hui, il faut encore toucher « Créer la fiche » sous « Aucune
    fiche de personnage » (`ParticipantCharacterSheet`). « Créer mon
    personnage » ouvre l'assistant sur une entité nouvelle, réclamée par la
    joueuse à la fin de l'assistant.

**D. Découpage** — treize tickets prêts, plus V3.1-20 déjà écrit :

| Ticket | Contenu | Dépend de |
|---|---|---|
| V3.1-24 | Services de jeu : jets contre la mort, concentration, monnaie, équipement, repos | — |
| V3.1-25 | Pilule glissante à la place de `BinderTabs` | — |
| V3.1-26 | Fiche d'ordinateur à jauges, commande E | 25 |
| V3.1-27 | Rail repliable et dalle Outils (a, b) | — |
| V3.1-28 | Tablette, piste B (f) | 26 |
| V3.1-29 | Coquille téléphone : barre flottante, feuilles du bas (c) | 27 |
| V3.1-30 | Wiki et Règles sur téléphone (☰ + récents) | 29 |
| V3.1-31 | Éditeur plein écran en accordéon | 29 |
| V3.1-32 | Fiche sur téléphone : jets, infobulles, sac | 24, 26, 29 |
| V3.1-33 | Outil de dés unique | 29 |
| V3.1-34 | Outil Table | 24, 26, 29, 33 |
| V3.1-35 | Accueil en tableau de bord (h) | 25, 27 |
| V3.1-36 | Solo : ailes et téléphone modèle A (d) | 29, 32, 33 |
| V3.1-20 | Fenêtres du MJ en deux volets (g) | 25 |

Tous à Sonnet. Restent à Opus : V3.1-21 (cible et résolution), V3.1-22
(salon), V3.1-23 (droits des joueurs).

**Planches** : chaque lot met
à jour ses planches (Pastille chrome, Tiroir, Bouton de dés, Rail du joueur, et
une planche « Rail repliable » à créer).

---

### ☐ V3.1-20 — Fenêtres du MJ en deux volets à onglets · `L` — **décidé le 1ᵉʳ octobre, à coder**

**Modèle conseillé : Sonnet** — interface décidée et esquissée, sans nouvelle donnée.

Lot g du ticket parent V3.1-19 (refonte « verre minéral »).

**Constat.** Les fenêtres du MJ se déplacent librement, s'aimantent à une
moitié d'écran contre un bord, se réduisent en bas, mais **ne se
redimensionnent pas** ; elles s'ouvrent à 860 px, décalées en cascade. L'auteur
veut que la place se répartisse toute seule.

**Décision** (sur quatre propositions esquissées et vivantes dans « verre
minéral », rangée « Fenêtres du MJ » : 1 tuiles à deux, 2 une grande + une
pile, 3 deux volets à onglets, 4 une fiche + des vignettes) : **la 3**, avec
son évolution faite tout de suite.

- **Une fiche** prend toute la zone de travail.
- **Une deuxième** ouvre un second volet, moitié-moitié ; le séparateur se fait
  glisser, un double-clic le ramène au milieu.
- **Au-delà**, une fiche ne remplace rien : elle s'ajoute **en onglet** dans le
  volet actif (le dernier cliqué). Les onglets vivent dans la barre de titre du
  volet, chacun avec son ×.
- **Glisser un onglet** :
  - sur l'autre volet → il y passe (c'est ainsi qu'on choisit ce qui s'affiche
    de chaque côté) ;
  - hors de la barre d'onglets, sur la moitié vide quand il n'y a qu'un volet →
    il crée le second volet.
- Un volet dont on ferme le dernier onglet disparaît ; l'autre reprend toute la
  place.
- Les pastilles restent : agrandir un volet le temps de lire, fermer.

**Ce qui ne change pas** : chaque fiche reste dans l'adresse (`?avec=`, ADR
0006/0011) — l'URL devra porter aussi le volet et l'onglet actif de chaque
fiche, pour qu'un rechargement rende la même disposition. Sur téléphone, rien
ne change (plein écran, une fiche à la fois).

**À trancher en le codant** : la barre des fiches réduites (V2-K4) devient
inutile si plus rien ne se réduit — onglets à la place. Un ADR remplacera la
partie « fenêtres flottantes » de l'ADR 0006.

**Tranché le 4 octobre, pour que le ticket parte à Sonnet** : la barre des
fiches réduites (V2-K4) disparaît, les onglets la remplacent ; l'ADR qui
remplace la partie « fenêtres flottantes » de l'ADR 0006 s'écrit dans ce
ticket. Sur téléphone, la pile « N fiches » en feuille est faite par
V3.1-29. **Dépend de** : V3.1-25 (pilule).

**Critères d'acceptation**
- [ ] Une, deux, trois fiches et plus : disposition conforme ci-dessus.
- [ ] Glisser un onglet d'un volet à l'autre, et hors de la barre pour créer le second volet.
- [ ] Séparateur glissable, double-clic au milieu.
- [ ] Rechargement : même disposition (URL).
- [ ] Catalogue mis à jour (planche « Fenêtre flottante » remplacée).

---

### ☐ V3.1-22 — Salon de groupe et jets dans le chat · `M` — **décidé le 5 octobre, à coder**

**Modèle conseillé : Opus** — nouveau salon : schéma, RLS, temps réel.

**Constat (vérifié dans le code le 4 octobre).** Le chat n'a que des fils
privés joueur ↔ MJ : `campaign_chat_messages` porte un `thread_user_id`
(migration `20260901130001`, V2-M13) et la RLS ne montre un fil qu'à son
joueur et au MJ. Le salon partagé de la première migration a été remplacé.
Les jets vivent dans `dice_rolls`, à part ; aucun n'apparaît dans le chat.

**Demande.** L'esquisse du téléphone joueur (écran Chat) montre une pilule
« Table / MJ, en privé » et les jets arrivant en cartes (total, dés, verdict
de l'initiative ; un jet secret visible du seul joueur et du MJ).

**Tranché le 5 octobre — ADR 0038** (`docs/adr/0038-salon-de-table-et-jets-dans-le-chat.md`).
- Salon : `thread_user_id` nullable, `null` = salon, RLS membres de la
  campagne ; les fils privés ne changent pas.
- Jets : lus dans `dice_rolls` et intercalés par `created_at`, jamais
  recopiés en message.
- Jet secret d'un joueur : `rolled_by_user_id` (posé par le serveur) et
  niveau de visibilité `roller` (lanceur et MJ).
- Interface : fenêtre B du MJ (salon en grand, fil privé en colonne à
  droite), page pleine du joueur, tablette en panneau — planche « Décidé ·
  chat (B) ».
- La « Demande de modification » est retirée : `RequestEditButton`,
  `relatedEntityId` (schéma Zod, route, repo) et leur affichage côté MJ.

**Critères d'acceptation**
- [ ] Un salon commun MJ + joueurs, à côté des fils privés.
- [ ] Les jets publics apparaissent dans le salon en cartes ; les secrets seulement pour leur auteur et le MJ.
- [ ] RLS : un joueur ne lit jamais le fil privé d'un autre.
- [ ] RLS : un joueur ne lit jamais le jet `roller` d'un autre ; il lit le sien.
- [ ] Fenêtre du MJ conforme à la planche B ; page pleine côté joueur ; tablette en panneau.
- [ ] Plus aucune trace de la demande de modification (bouton, champ, route).
- [ ] `docs/SCHEMA.md` à jour, migration nouvelle (aucune migration appliquée modifiée).
