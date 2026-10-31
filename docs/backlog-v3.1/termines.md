

---

### ☑ V3.1-79 — Fiche de créature (A) : la fiche de personnage, pour une créature · `L` · sans modèle IA — **fait le 26 octobre**

**Critères d'acceptation**
- [x] Les quatre tuiles de constantes ont la même largeur et leurs libellés tiennent sur une ligne à 920 px et 390 px.
- [x] Les composants de la fiche sont importés, pas recopiés (extraits une fois : `BouclierCA`, `EtatsEnCours`, `TuileCaracteristique`, variantes de `StatBadge` et `CommandeE`).
- [x] Une pastille ouvre l'outil de dés avec la bonne formule (test de la construction du jet).
- [x] Hors combat : aucune écriture de PV ou d'état possible depuis le bloc ; aucun champ de jeu ajouté au schéma `statblock`.
- [x] Les modificateurs sont calculés (FOR 19 → +4), jamais stockés (test).

**Réalisé** (serveur par Opus ; interface par Sonnet, relue par Opus ; vérifié en direct, hors combat et en combat, 920 et 390 px)
- Serveur : route `GET /api/entities/[id]/creature-combat` (`creatureCombat.ts`, MJ seulement, combat en cours seulement) ; une fiche de créature entre dans l'initiative (CA et PV lus dans son `statblock`) ; **seul un personnage partage son état de jeu avec sa ligne de combat** — sans cela, le déclencheur de V3.1-38 recopiait les PV d'une instance sur toutes les instances de la même créature (trouvé en direct, test d'intégration).
- Interface : `CreatureSheet.tsx` en deux colonnes, sélecteur d'instance numéroté (« … · 1 »), écritures par la route du participant sans engager le bloc. Logique pure dans `lib/ui/creature.ts`. L'anneau écrit la valeur et le maximum sur deux lignes au-delà de cinq signes (« 136 » / « /136 »).
- Reste connu : « Ce qui se recharge » reste en lecture même en combat (aucun champ de recharge dans une instance — ajout de schéma à décider) ; le repaire et les défenses ne s'affichent pas faute de champs dans `statblock` ; la tuile de caractéristique de la fiche de personnage passe ses libellés de 10–11 px à 12 px (plancher du lint).

---

### ☑ V3.1-78 — Carte (C) : la carte et sa liste par couches · `M` · sans modèle IA — **fait le 26 octobre**

**Critères d'acceptation**
- [x] Toucher un nom centre la carte sur l'élément.
- [x] Une punaise publique sur une couche MJ n'arrive pas au joueur (vérifié en direct depuis ce bloc : la joueuse ne reçoit que la punaise publique d'une couche publique).
- [x] « Voir comme les joueurs » ne reçoit aucun élément MJ dans la réponse (test) — ajouté le 26 octobre : d'abord reporté à tort (V3.1-12 était livré, son index n'était pas à jour). `mapViewer.integration.test.ts`.
- [x] Téléphone : liste sous la carte.

**Réalisé** (interface par Sonnet, relue par Opus ; vérifié en direct, MJ, joueuse et téléphone)
- La liste par couches (`components/entities/map/CarteListe.tsx`) : en-tête de couche et ses éléments, chacun avec sa pastille de visibilité écrite par sa propre route (`map-pins`, `map-regions`, `map-layers`), sans engager le bloc ; l'annonce d'une punaise dit « (et seulement si sa couche l'est aussi) » (ADR 0017). Toucher un nom centre et agrandit (`MapCanvas` expose `centrerSur`, `zoomer`, `recadrer`). Mode référent en lecture seule. Logique pure dans `lib/ui/carte.ts`.
- « Voir comme les joueurs » (MJ seulement) : le serveur calcule la carte avec un lecteur joueur générique de la campagne (`genericPlayerViewer`, `src/core/visibility` ; `resolveMapViewer`, `mapViewer.ts`) au lieu d'emprunter un compte (« voir comme » de V3.1-12 bascule toute la session) ; `?vue=joueurs` sur les lectures de punaises, zones et couches, refusé (403) à qui n'est pas MJ — sinon un simple membre du monde y gagnerait le niveau `players`. Liste en lecture seule pendant la vue. Vérifié en direct : la vue joueurs du MJ rend exactement ce que reçoit une vraie joueuse.
- Écarts : « + Punaise » et « + Zone » ouvrent la vue agrandie (l'outil de pose vit dans `MapWorkspace`) ; dans l'aperçu public, toucher une punaise liée l'allume au lieu d'ouvrir la fiche (la vue agrandie navigue toujours) ; le wiki public montre une liste plate, faute de couches dans la donnée publique.

---

### ☑ V3.1-77 — Musique (A) : la platine, les bornes, la durée des fondus · `M` · sans modèle IA — **fait le 26 octobre**

**Critères d'acceptation**
- [x] « 0:12 » écrit `startSeconds: 12` ; vide l'efface ; fin ≤ début refusé avec le message du schéma.
- [x] Les champs de bornes n'apparaissent pas pour Spotify / SoundCloud.
- [x] Pas-à-pas bornés à 0 et 5 s ; la platine applique la nouvelle durée au fondu suivant.
- [x] Aucun changement du lecteur de la page de lecture.

**Réalisé** (interface par Sonnet, relue par Opus ; vérifié en direct)
- Platine (service, ce qu'il permet, bornes en cours, ◂◂ lecture ▸▸), liste rangeable (dnd-kit), « ⋯ » sous la piste (bornes m:ss pour YouTube, phrase pour Spotify / SoundCloud, « Retirer la piste »), réglages (trois interrupteurs, deux pas-à-pas), ajout d'un lien avec la validation du schéma, rappel sous le bloc. Logique pure dans `lib/ui/musique.ts` (la validation réutilise `zMusicBlockData`).
- Lecteur inchangé (`MusicVoice`, `MusicPlaybackContext`, `youtubeApi`, `PublicMusicToggle`) : la durée des fondus est lue à chaque lancement de piste.
- Reste à faire : la barre de progression, les temps de la platine et la durée de chaque piste — le lecteur partagé ne publie pas la position et la donnée n'a pas de durée ; il faudra que le lecteur l'expose (ticket à part). Le fondu sortant d'une piste déjà en cours garde l'ancienne durée jusqu'à la piste suivante.

---

### ☑ V3.1-76 — Quête (C) : une ligne, dépliable · `S` · sans modèle IA — **fait le 26 octobre**

**Critères d'acceptation**
- [x] L'anneau et « Prochain » suivent les cases cochées sans rechargement.
- [x] Les cinq états s'enregistrent (route existante).
- [x] Téléphone : récompenses et prérequis empilés.

**Réalisé** (interface par Sonnet, relue par Opus ; vérifié en direct)
- Repliée : anneau de progression, état, commanditaire, « Prochain » ; dépliée : pilule à cinq états, objectifs à cocher (barrés quand atteints), récompenses et prérequis côte à côte (empilés sous 36 rem). Ligne partagée avec le wiki public (`components/entities/quest/QuestLigne.tsx`, `PublicQuestBlock.tsx`). Logique pure dans `lib/ui/quete.ts`.
- Opus : une case d'objectif déclenchait, en plus de sa propre route, l'enregistrement du bloc (`Checkbox` → ADR 0023) : les deux écritures partaient ensemble et l'une revenait en 409. `Checkbox` gagne `ecritAilleurs`. La pilule d'état s'engage tout de suite, comme le menu d'avant (sinon perdue en quittant la page). `QUEST_STATE_LABELS_FR`, devenue inutile, est retirée.

---

### ☑ V3.1-75 — Table aléatoire (A) et le dé animé · `M` · sans modèle IA — **fait le 26 octobre**

**Critères d'acceptation**
- [x] Le tirage vient du serveur (aucun `Math.random` côté client hors des chiffres décoratifs de l'animation).
- [x] La ligne s'allume après la fin de l'animation, pas avant.
- [x] Avec sous-tirage : deux dés se figent l'un après l'autre.
- [x] Mouvement réduit : pas d'animation (test avec la préférence simulée).
- [x] « Sans répétition » : une entrée sortie ne ressort pas avant « Remettre à zéro » (test de la route).

**Réalisé** (serveur et cœur par Opus, tests d'abord ; interface par Sonnet, relue par Opus ; vérifié en direct, ordinateur, téléphone et mouvement réduit)
- Cœur : chaque tirage rend son chiffre et l'indice de la ligne (`drawOnce`), `drawExcluding` tire parmi les lignes non encore sorties (rejet borné, puis repli par le RNG avec un chiffre dans la plage), `TableExhaustedError` quand tout est sorti.
- Service et route : le tirage rend le dé, le chiffre, la ligne et les sous-tirages (`subDraws`, dé et chiffre de chaque `{table:…}`) ; `exclude` (Zod) porte les lignes déjà sorties, 409 quand la table est épuisée.
- Interface : l'animation de l'outil de dés extraite une fois (`components/shared/DeAnime.tsx`, `lib/ui/animationDe.ts`) et partagée ; la table telle qu'on la lit, renvois `{table:…}` en pastille ; résultat en carte avec ses sous-tirages ; lignes sorties barrées, « Remettre à zéro ». Logique pure dans `lib/ui/tirageTable.ts`.
- Le champ « nombre de tirages » de l'ancien bloc disparaît (absent de la planche) ; le serveur sait toujours tirer plusieurs fois.
- Reste connu : les `refs` d'une entrée s'affichent sous le résultat (le moteur ne les place pas dans le texte) ; les lignes n'ont toujours pas d'éditeur de `refs`.

---

### ☑ V3.1-73 — Généalogie (B) : les grands portraits · `M` · sans modèle IA — **fait le 25 octobre**

**Critères d'acceptation**
- [x] Conforme à la planche à 920 px et 390 px.
- [x] « Centrer l'arbre ici » change la racine sans rien enregistrer.
- [x] Ajouter un lien depuis la barre crée la relation (choix source/cible extrait et testé : `lib/ui/liensFamille.ts` ; route inchangée).
- [x] Sans données de dates, aucune ligne vide sous les noms.

**Réalisé** (donnée et cœur par Opus ; interface par Sonnet, relue par Opus ; vérifié en direct à 920 et 390 px)
- Donnée : `hasPortrait` sur chaque nœud, lu en une requête avec les dates — une carte sans portrait ne demande plus d'image vouée au 404. Le wiki public reçoit le calendrier quand l'arbre porte une date.
- Cœur : `FamilyTreeEdge.ex` (ex-partenaire) ; les ex se placent à gauche de la fiche, les partenaires actuels à droite — un ex ne se glisse plus entre un couple (test d'abord).
- Interface : cartes 100 × 130 (66 × 88 et prénoms au téléphone), nom en pastille, dates, défunt en gris, traits arrondis, ex en pointillé `--gm`, case « + enfant », zoom en bas à droite, barre sous l'arbre (ouvrir, centrer ici, ajouter et les neuf liens), glisser et pincer au doigt. Logique pure dans `lib/ui/arbre.ts` et `lib/ui/liensFamille.ts`.
- « Centrer l'arbre ici » relit l'arbre par la même route avec une autre racine (l'arbre chargé est borné en profondeur, un recalcul local ne suffisait pas) ; la donnée du bloc ne change pas (vérifié en direct).

---

### ☑ V3.1-72 — Réseau (B) : vignettes, filtres, survol qui allume · `M` · sans modèle IA — **fait le 25 octobre**

**Critères d'acceptation**
- [x] Le survol allume exactement les liens et voisins de la vignette (test de la fonction de voisinage).
- [x] Les portraits arrivent en une seule requête (test du service : nombre d'appels au dépôt).
- [x] Filtrer un genre ne masque jamais la fiche du centre.
- [x] Téléphone : premier toucher = sélection, second = ouverture.

**Réalisé** (donnée par Opus ; interface par Sonnet, relue par Opus ; vérifié en direct, ordinateur et téléphone tactile)
- Donnée : `hasPortrait` sur chaque nœud, lu par `listEntityIdsWithPortrait` en une requête pour tout le graphe (`relationsGraph.test.ts`).
- Interface : vignettes (portrait ou icône du genre, liseré par genre : personnes `link-entity`, lieux `success`, factions `gm`, objets `players`, autres neutre), survol qui allume le voisinage (reste à 0,2) et écrit le type des liens, carte de la fiche au clic avec « Ouvrir la fiche », filtres par genre avec leur nombre, « Trouver… », « Tout montrer ». Logique pure dans `lib/ui/reseau.ts`.
- Opus : le clic sur une vignette remontait au fond, qui désélectionnait — la carte ne paraissait jamais.
- Changement de comportement : sur ordinateur, cliquer une vignette ouvre sa carte au lieu de la fiche ; « Ouvrir la fiche » est dans la carte.

---

### ☑ V3.1-71 — Relation (A) : deux portraits, le résumé, les fils à perle · `L` · sans modèle IA — **fait le 25 octobre**

**Critères d'acceptation**
- [x] Les noms longs tiennent dans le bloc (points de suspension, test visuel à 920 px et 390 px).
- [x] Le résumé change pendant le glissé, avant même l'enregistrement.
- [x] « Voir l'autre sens » ne montre jamais un bloc inverse invisible du lecteur (test serveur) ; « Créer ce bloc » absent sans droit d'écriture sur la cible.
- [x] Une cible faction ne montre pas Attirance.
- [x] Le nombre de souvenirs est calculé, jamais stocké.

**Réalisé** (serveur par Opus ; interface par Sonnet, relue par Opus ; vérifié en direct à 1440, 920 et 390 px)
- Serveur : route `GET /api/entities/[id]/relationship-face?targetId=` (`relationshipFace.ts`) — portraits, valeurs, nombre de souvenirs compté (`count: "exact"`), bloc de la paire seulement s'il est visible du lecteur ; appelée sens échangé pour « ⇄ Voir l'autre sens ». Le MJ lit les valeurs même avant l'enregistrement d'une nouvelle cible.
- Faille vue en chemin et corrigée : tout membre du monde lisait et écrivait les relations des PNJ (`docs/SECURITE.md`, registre) — gardes `canReadRelationship` et `canWriteRelationship` sur les quatre routes des attitudes et souvenirs.
- Interface : `VueRelation` (face-à-face, résumé en direct, prénoms), `PortraitRelation` (184 px, 70 × 92 au téléphone), `FilsPerles` (sept fils, « pourquoi » au survol ou au toucher, Attirance masquée hors personne), souvenirs par `SouvenirsPsyche` (troisième genre, confirmation au-delà de 40). Table unique `RELATIONSHIP_AXES_FR`. Logique pure dans `lib/ui/relationFace.ts`.
- Le résumé d'un réglage manuel ne porte plus de nombre (« Réglage manuel, vers Confiance »).
- Reste connu : une joueuse qui choisit une nouvelle cible pour la relation de son PJ voit les fils à zéro jusqu'au rechargement (le bloc n'est pas encore enregistré quand la face est relue).

---

### ☑ V3.1-65 — Bloc Texte : lettrine, bulle du paragraphe, assistance IA en encart · `M` · **avec modèle IA** — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — tout existe ; c'est un rangement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, carte « Texte ». **Départ** :
`components/blocks/TextBlockEditor.tsx`,
`components/entities/richtext/RichTextEditor.tsx`,
`src/core/schemas/blocks/text.ts`, `src/server/services/aiProposals.ts`.
**Dépend de** : 63.

**Ce qui est décidé**
- La **lettrine** devient un **interrupteur dans l'en-tête de la carte**
  (passé par `BlockCard` en action d'en-tête), au lieu d'un réglage dans le
  corps. Même champ qu'aujourd'hui.
- Toucher un paragraphe ouvre **la bulle de l'éditeur riche** : niveau de
  titre, G / I / S, Lier à une fiche, Créer une fiche, Spoiler, et la
  **visibilité du paragraphe** (Public, Joueurs, MJ). Un passage MJ est
  bordé à gauche d'orange (`--gm`) et marqué « MJ » ; un passage Joueurs
  bordé de bleu. Rappel : Spoiler est de la mise en forme, jamais de la
  sécurité (règle 6) ; le secret passe par la visibilité du paragraphe.
- **L'assistance IA** (MJ seulement, jamais dans la coquille joueur) en
  **encart violet sous le texte** : la consigne, le budget visible (ce
  qu'il reste), « Proposer ». La proposition apparaît **en pointillé à sa
  place** dans le texte ; **rien n'est écrit avant « Accepter »** (règle 9 :
  `ai_proposals` → validation → application) ; « Refuser » l'efface.

**Critères d'acceptation**
- [x] Lettrine activée depuis l'en-tête : le rendu public la montre.
- [x] Un paragraphe MJ n'est jamais envoyé à un joueur ni au wiki public (test serveur existant étendu au nouveau rendu).
- [x] Une proposition de l'IA ne modifie pas le bloc tant qu'elle n'est pas acceptée (test).
- [x] L'encart IA n'existe pas dans la coquille joueur.

**Réalisé** (Opus — ticket « avec modèle IA », vérifié contre le modèle local)
- La lettrine quitte le corps du bloc pour l'en-tête de la carte (`LettrineBouton`, emplacement `lettrine` de `BlockCard`). Elle est **aussi** dans l'en-tête de l'éditeur plein écran du téléphone : sans ça elle y devenait injoignable, faute de carte de verre.
- La bulle du paragraphe avait déjà tout ce que le ticket demande (niveau de titre, G/I/S/U, Lier à la Fiche, Créer comme Fiche, Spoiler, visibilité) : rien à coder.
- Le liseré dit désormais le niveau — bleu Joueurs (`--players`), terracotta MJ **plus la mention « MJ »**, parce que la couleur seule ne doit jamais porter l'information (impression en noir et blanc, mode fort contraste où les deux jetons deviennent le même noir).
- Encart violet (`--link-entity`, le violet du projet ; aucun jeton violet propre, même décision qu'aux emplacements de pacte) et **budget restant affiché** : `decideRateLimit` rend `remaining`, exposé par `GET /api/ai/budget`. La limite horaire existait côté serveur et n'était jamais annoncée — « Proposer » tombait en 429 sans prévenir. La proposition s'affiche en pointillé à sa place sous le texte ; rien n'est écrit avant « Accepter ».
- Tout ce qui s'affiche se décide dans `lib/ui/assistanceTexte.ts` (pur, testé) : `masquee` vide l'encart **et** les propositions en attente — une proposition d'IA ne passe jamais sous les yeux d'un joueur.

*Défaut trouvé à l'écran, invisible aux tests* : le `:not([data-visibility="public"])` de la règle existante pesait (0,3,0) et battait les règles par niveau en (0,2,0) — le bleu Joueurs ne sortait jamais. Corrigé en `:not(:where(…))`, revérifié sur les styles calculés.

*Réserve* : « l'encart n'existe pas dans la coquille joueur » est couvert par le test pur seulement, faute de compte joueur sous la main ; le câblage `hideAiAssist={playerRestricted}` n'a pas été touché.

---

### ☑ V3.1-70 — Personnalité (A) et Convictions (même dessin, comparer avec une faction) · `L` · sans modèle IA — **fait le 25 octobre**

**Critères d'acceptation**
- [x] Aucun nombre à l'écran pour un joueur (test de rendu public) ; le MJ voit la valeur au survol seulement.
- [x] ★ : deux au plus, ordre conservé (test).
- [x] Souvenir > 40 : confirmation demandée ; refuser n'écrit rien (test).
- [x] « Comparer avec » ne propose que les factions liées, puis « Autre… » ; une faction au bloc Convictions MJ n'est pas proposée à un joueur (test serveur).
- [x] La phrase de tension apparaît à 3 crans, pas à 2.

**Réalisé** (serveur par Opus ; interface par Sonnet, relue par Opus ; vérifié en direct, MJ et joueuse)
- Serveur : route `GET /api/entities/[id]/worldview-comparisons` (`worldviewComparisons.ts`) — factions liées par `member_of`, `serves`, `leads` (deux sens), ou recherche « Autre… » ; une fiche n'est proposée que si son bloc Convictions est visible du lecteur (règle 5, test d'intégration).
- Faille vue en chemin et corrigée : une aspiration MJ d'un bloc Personnalité visible partait aux joueurs et au wiki public (`docs/SECURITE.md`, registre).
- Interface : radar commun `PoleRadar` (bande nommée à chaque sommet, faction en pointillé bleu), barres `PoleBars` (★, mot de la bande, trait bleu, valeur exacte en `title` pour le MJ seulement), `PersonnaliteChamps` (aspirations en trois colonnes avec pastille de visibilité, lignes, façon de parler), `SouvenirsPsyche` (repliable, chargé à l'ouverture, saisie en une ligne, confirmation au-delà de 40, brut et appliqué). Logique pure dans `lib/ui/psycheBloc.ts`.
- Le wiki public dit « vers Curiosité » au lieu d'un écart chiffré ; le résumé d'un réglage manuel aussi (« Réglage manuel, vers Curiosité »). Les anciens souvenirs gardent leur texte.
- Reste à regarder : les mots des sommets du radar sont petits sur téléphone (le dessin est large et réduit).

---

### ☑ V3.1-69 — Noyau psyché : libellés uniques, bandes des pôles, tension, résumé · `S` · sans modèle IA — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — fonctions pures, tests d'abord.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Départ** : `src/core/psyche/` (`keys.ts`, `bands.ts`), et les libellés
aujourd'hui **dupliqués** dans `components/entities/psyche/`
(`PersonalityPoleSliders.tsx`, `WorldviewPoleSliders.tsx`,
`WorldviewRadar.tsx`, `WorldviewEventTable.tsx`, `PersonalityRadar.tsx`).
**Dépend de** : —.

**Ce qui est décidé**
1. **Une seule source pour les libellés des pôles** (personnalité,
   convictions) dans `src/i18n/fr.ts`, à côté des descriptions existantes
   (`PERSONALITY_POLE_DESCRIPTIONS_FR`, `WORLDVIEW_POLE_DESCRIPTIONS_FR`).
   Les composants ne gardent plus leurs propres tables.
2. **Deux renommages, libellés seulement** (clés et valeurs inchangées,
   aucune migration) :
   - `curiosity_caution` : « Circonspection ↔ Curiosité » (fin du doublon
     « Prudence » avec `impulse_prudence`) — mettre aussi à jour la
     description (« Circonspection : préfère le connu… ») ;
   - `wealth_honor` : « Profit ↔ Honneur » (description : « Profit : … »).
3. **Bandes nommées des pôles** : `poleBandLabel(ends, value)` → « neutre —
   ne s'en soucie pas » (bande 0) ou « <pôle> <léger|fort|extrême> », le pôle
   étant celui du côté de la valeur, l'adjectif **accordé** au genre du
   pôle (Altruisme fort, Dureté légère, Circonspection extrême). Seuils :
   `bandTierFor` existant (≤ −67, −34, −12, 11, 33, 66).
4. **Tension faction** : `worldviewTension(entity, faction)` → l'axe au plus
   grand écart en **crans** (différence des bandes), et l'écart ; tension
   quand l'écart ≥ 3 (specs/psyche-pnj.md §2).
5. **Résumé d'une relation** : `relationshipSummary(axes)` → les mots des
   axes dont la bande vaut ±2 ou ±3, dans l'ordre des axes
   (« aveugle, amical, admiratif et obligé ») ; « rien de marquant » s'il
   n'y en a aucun. Mots : `RELATIONSHIP_AXIS_BAND_LABELS_FR` existant.

**Critères d'acceptation**
- [x] Tests : les sept bandes de deux pôles (accord masculin et féminin), les bornes exactes des seuils.
- [x] Tests : tension à 2 crans (non), à 3 (oui), choix de l'axe le plus écarté.
- [x] Tests : résumé vide, un mot, plusieurs mots (« a, b et c »).
- [x] `grep` : plus aucune table de libellés de pôles dans `components/`.

**Réalisé** (Sonnet, tests d'abord ; relu par Opus)
- Source unique : `PERSONALITY_POLES_FR` et `WORLDVIEW_POLES_FR` (`src/i18n/fr.ts`) — libellé, mot court du radar, et les deux bouts avec leur genre grammatical en donnée ; les dix composants qui avaient leur table la lisent.
- Renommages (libellés seulement) : « Circonspection ↔ Curiosité », « Profit ↔ Honneur », descriptions comprises.
- `poleBandLabel` (accord du genre, « extrême » invariable), `worldviewTension` (écart en crans, seuil 3, pôles saisis des deux côtés seulement), `relationshipSummary` (« a, b et c »). Pas encore branchées : 70 à 73.
- Opus : identifiants du noyau remis en anglais (`gap`, `gender`…).

---

### ☑ V3.1-68 — Bloc Chronologie : l'axe en bande et une ligne par événement · `M` · sans modèle IA — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — dessin décidé, schéma inchangé.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, carte « Chronologie ».
**Départ** : `components/blocks/TimelineBlockEditor.tsx`,
`components/entities/timeline/`, `src/core/schemas/blocks/timeline.ts`,
`components/shared/useWorldCalendar.ts`. **Dépend de** : 63, 64.

**Ce qui est décidé**
- En tête, **l'axe en bande** : les périodes (ères) en segments nommés, les
  événements en points, **le jour actuel en trait doré** (date du jour du
  calendrier du monde ; pas de trait si le MJ ne l'a pas réglée).
- Dessous, **une ligne par événement** : date, titre, **genre en pastille**
  (`kind`), **visibilité en pastille** (`VisibilityPill` de V3.1-64, un
  événement MJ n'est jamais envoyé à un joueur), et « → en faire une
  fiche » (crée une entité liée, même service que « Créer une fiche » du
  texte).

**Critères d'acceptation**
- [x] Le trait doré tombe sur la date du jour du monde ; absent sans date.
- [x] La pastille d'un événement suit le cycle de V3.1-64 ; un événement MJ n'arrive pas au joueur (test serveur).
- [x] « → en faire une fiche » crée l'entité et lie l'événement.

**Réalisé** (Sonnet, relu et corrigé par Opus)
- Axe en bande (`AxeBande`, positions pures testées dans `lib/ui/axeBande.ts`) : ères en segments, périodes en barres, événements en points, trait doré à la date du jour du monde (absent sans date) ; toucher l'axe ajoute un point, glisser une période.
- Une ligne par événement : genre en pastille, date, titre, `VisibilityPill` (écriture optimiste, « Privé » sauté hors auteur), « → en faire une fiche » par la route de promotion existante, puis « ◆ nom ».
- Test serveur ajouté (Opus) : un événement MJ de la Chronologie d'une fiche ne part jamais au visiteur du wiki public, l'événement public si (`publicShare.integration.test.ts`).
- Défaut corrigé en vérifiant (Opus) : « → en faire une fiche » échouait (409). Le bouton se désactivait pendant l'envoi, perdait le focus, et la carte s'enregistrait « à la perte du focus » en même temps : la promotion arrivait avec une version périmée. Le bouton reste focusable, se dit occupé et ignore le second clic.
- Colonne du genre de largeur fixe (les titres se décalaient).
- Vérifié au navigateur (fiches de test supprimées) : pastille Public → Joueurs enregistrée, promotion qui crée la fiche et lie l'événement.

*Écarts* : plus de zoom ni de panoramique dans l'éditeur (bande fixe de la planche) ; couleurs de genre regroupées en cinq jetons.

---

### ☑ V3.1-67 — Bloc Image : la barre flottante et l'aperçu dans le texte (B) · `M` · sans modèle IA — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — tous les champs existent déjà ; c'est l'interface.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, carte « Image ». **Départ** :
`components/blocks/ImageBlockEditor.tsx`, `src/core/schemas/blocks/image.ts`
(lire son commentaire en entier), `src/core/images/blockAnchor.ts`.
**Dépend de** : 63.

**Ce qui est décidé (B)**
- Aujourd'hui : neuf réglages en liste sous l'image. Demain :
- **Toucher l'image fait paraître une barre flottante** sur elle :
  Gauche / Centre / Droite (`align`), « − taille + » (`sizePct`, 50–200 %,
  pas de 10), « Le texte contourne » (interrupteur : `anchorFlow` `float`
  quand activé, `break` sinon).
- **L'aperçu** montre l'image **dans le texte**, telle qu'elle sera dans le
  wiki, avec sa légende dessous (éditable sur place).
- **À part, dans un encart sous l'aperçu** :
  - Emplacement : « Bloc autonome » (`placement: "flow"`) ou « Dans un bloc
    de texte » (`placement: "anchored"` + choix du bloc et du paragraphe,
    curseur à N + 1 crans comme aujourd'hui) ;
  - Parallaxe (`parallaxPct`, 0–40) ;
  - Fond de la page du wiki, trois choix : « Non » (`useAsWikiBackground:
    false`), « En fond et dans la fiche » (`true` + `alsoShowInFlow: true`),
    « Seulement en fond » (`true` + `alsoShowInFlow: false`) ; avec flou
    (`backgroundBlurPx`) et fondu (`fadeMs`) **seulement si** un fond est
    choisi.
- `wrapMode` n'apparaît pas (lu seulement, comme aujourd'hui).

**Critères d'acceptation**
- [x] Chaque contrôle de la barre écrit le bon champ (test de la correspondance contrôle → champ).
- [x] Les trois choix de fond donnent les bonnes paires de valeurs (test).
- [x] Flou et fondu n'apparaissent qu'avec un fond.
- [x] Un bloc enregistré avant ce ticket s'affiche à l'identique (pas de réécriture en base).

**Réalisé** (Sonnet, relu par Opus)
- `ImageBlockEditor` refait : toucher l'image ouvre la barre (Gauche / Centre / Droite, − taille +, « Le texte contourne »), Échap la ferme ; aperçu dans le vrai texte du bloc hôte, légende éditable dessous ; encart Emplacement, Parallaxe, Fond (trois choix), flou et fondu seulement avec un fond. Libellés de l'éditeur sortis du code vers `fiche.image`.
- Correspondance contrôle → champ et choix de fond en fonctions pures (`lib/ui/imageBloc.ts`, testées) ; test qu'aucun `onChange` ne part au montage.
- Vérifié au navigateur (fiche de test supprimée) : ouvrir la fiche n'écrit rien ; Droite, 110 %, ancrage dans le texte, fond « en fond et dans la fiche » enregistrés ; flou et fondu absents sans fond.
- Catalogue : Encadré, Tableau et Image passent de la planche 3 (qui dépassait 8 000 px) à la planche 8 « Wiki visuel » ; la deuxième rangée du canevas descend sous la première.

*Choix* : « Centre » coupe le contournement (un flottement centré n'existe pas en CSS) ; sans ancrage dans un texte, « Le texte contourne » est grisé avec la raison.

---

### ☑ V3.1-66 — Blocs Encadré et Tableau · `M` · sans modèle IA — **fait le 25 octobre (ADR 0067)**

**Modèle conseillé : Sonnet** — décisions prises ; une seule à trancher dans le ticket (tranchée ci-dessous).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, cartes « Encadré » et
« Tableau ». **Départ** : `components/blocks/InfoboxBlockEditor.tsx`,
`components/blocks/CustomTableBlockEditor.tsx`,
`src/core/schemas/blocks/infobox.ts`, `customTable.ts`. **Dépend de** : 63.

**Encadré — ce qui est décidé**
- Les lignes se **lisent comme dans le wiki** (intitulé à gauche, valeur à
  droite) et **s'éditent sur place** (toucher l'intitulé ou la valeur) ;
  ⠿ pour réordonner ; × au survol pour retirer ; « + ligne ».
- **« @ » dans une valeur cite une fiche** (même mention que dans le texte).
- **Intitulés suggérés selon le type de fiche** : en tapant un intitulé, une
  liste propose ceux du type (PNJ : Race, Âge, Rôle, Allégeance… ; Lieu :
  Région, Population, Dirigeant… ; Faction : Siège, Chef, Fondation…).
  **Tranché ici : une constante dans le fichier de libellés**, clé = genre
  d'entité (`entityKind`), pas une table en base (rien à migrer ; à revoir
  au troisième besoin de personnalisation). Pour un genre sans liste : pas
  de suggestion.

**Tableau — ce qui est décidé**
- Un **vrai tableau** (`<table>` accessible) éditable en cellules.
- × de colonne (dans l'en-tête) et × de ligne (au bout) **au survol** ;
  « + » au bout des en-têtes pour une colonne, « + Ligne » dessous.

**Critères d'acceptation**
- [x] Encadré : réordonner, éditer sur place, « @ » qui crée une vraie mention (même test que le texte).
- [x] Les suggestions dépendent du genre de la fiche (test de la fonction de suggestion).
- [x] Tableau : ajouter et retirer lignes et colonnes ; navigation au clavier entre cellules (Tab).

**Réalisé** (Sonnet pour les éditeurs, Opus pour la mention et un défaut d'affichage)
- Encadré : lecture comme au wiki, édition sur place, ⠿ souris et clavier, × au survol et au focus, « + Ligne », intitulés proposés selon le genre (`lib/ui/encadre.ts`, testé ; listes dans les libellés, en pastilles comme la planche).
- **Mention « @ »** (ADR 0067, choix de l'auteur : des nœuds comme le texte) : `zInfoboxValue` = chaîne ou nœuds ; champ `ValeurAvecMentions` (liste des fiches, flèches, Entrée, Échap ; mention en pastille avec ×) ; saisie pure testée (`lib/ui/mentionValeur.ts`) ; résolution serveur comme le texte (wiki public et vue joueur) ; test d'intégration : une fiche masquée citée ne devient jamais un lien.
- Tableau : vrai `<table>`, × de colonne et de ligne au survol et au focus, « + » et « + Ligne », Tab de cellule en cellule, noms de colonne en double suffixés (« Prix 2 ») (`lib/ui/tableauBloc.ts`, testé).
- **Défaut ancien corrigé** (vu en vérifiant, présent avant V3.1-63 et en production) : un bloc Image, Encadré ou Tableau ajouté n'apparaissait qu'après rechargement — son éditeur, chargé à la demande, suspendait la carte sans frontière. Le corps de chaque carte est désormais dans un `Suspense`.
- Vérifié au navigateur sur une fiche Lieu de test (supprimée) : suggestions, mention enregistrée en nœuds, colonnes et lignes ajoutées et retirées, Tab.

*Écart* : les intitulés proposés sont des pastilles (planche) plutôt qu'une liste sous le champ (ticket).

---

### ☑ V3.1-64 — La pastille de visibilité au toucher, avec « Annuler » · `S` · sans modèle IA — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — comportement entièrement décrit ; route existante.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html` (toutes les cartes ; essayer la
pastille). **Départ** : `BlockCard` (V3.1-63),
`components/shared/visibilityOptions.ts`, la route de mise à jour de
visibilité d'un bloc utilisée aujourd'hui par `EntityBlocks.tsx`.
**Dépend de** : 63.

**Ce qui est décidé (demande de l'auteur)**
- Un toucher sur la pastille fait passer à la visibilité **suivante** :
  Public → Joueurs → MJ → Privé → Public. Couleur et libellé suivent
  aussitôt (mise à jour optimiste, remise en place si le serveur refuse).
- Chaque changement **s'annonce** dans une annonce discrète en bas de la
  fiche : « « Rumeurs de Phandaline » : visible par le MJ seul. » avec un
  bouton **« Annuler »** (remet la valeur précédente). Quand le bloc devient
  **plus visible** qu'avant (MJ → Privé → Public…), l'annonce ajoute
  « Attention : il redevient visible. ».
- Phrases exactes : Public = « tout le monde, wiki public compris » ;
  Joueurs = « la table, pas le wiki public » ; MJ = « le MJ seul » ; Privé =
  « son auteur seul ».
- Le choix direct reste dans ⋮ « Choisir la visibilité… » (tous les
  niveaux, y compris campagne et utilisateur, qui **ne font pas partie du
  cycle** : un bloc à l'un de ces niveaux passe à Public au premier
  toucher, avec l'annonce).
- Valable pour **tous les blocs**, et pour la pastille de chaque événement
  de la Chronologie (V3.1-68), chaque aspiration (V3.1-70), chaque punaise
  et couche de la Carte (V3.1-78) — un seul composant `VisibilityPill`.
- **Limite assumée** : l'écriture est immédiate, d'où l'annonce et
  « Annuler ». La visibilité reste filtrée côté serveur (règle 5).

**À faire** : composant `VisibilityPill` (props : niveau, `onChange`,
libellé de l'objet pour l'annonce) ; annonce avec « Annuler » (réutiliser le
composant d'annonce existant s'il y en a un, sinon le créer une fois) ;
planche du catalogue.

**Critères d'acceptation**
- [x] Quatre touchers ramènent à la visibilité de départ ; chaque étape est enregistrée (test de composant + route).
- [x] « Annuler » rétablit la valeur précédente côté serveur.
- [x] L'annonce dit « Attention : il redevient visible. » quand on va vers plus visible.
- [x] Lecteur d'écran : la pastille annonce sa valeur et l'action (« Visibilité : MJ. Toucher pour passer à Privé »).
- [x] Un refus du serveur remet l'ancienne pastille et l'annonce le dit.

**Réalisé** (Sonnet, relu et corrigé par Opus)
- `VisibilityPill` (composant partagé, pour 68, 70, 78) ; cycle, « plus visible que » et annonce en fonctions pures (`lib/ui/visibilitePastille.ts`, testées) ; annonce `AnnonceVisibilite` avec « Annuler », créée faute d'existante ; écriture optimiste par la route de bloc existante, ancienne valeur rendue sur refus.
- Vérifié au navigateur : quatre touchers enregistrés (200), annonces et avertissement, « Annuler » rétablit côté serveur.
- Opus :
  - les libellés étaient rangés dans l'espace `outilDes` (pastille sans nom accessible) : déplacés dans `fiche` ;
  - **« Privé » = son auteur seul** : la RLS refusait qu'un MJ y passe le bloc d'un autre, la route répondait 500 et le cycle restait bloqué. Désormais `updateBlockContent` refuse proprement (403), `listVisibleBlocks` marque `nonAuteur`, et la pastille comme le choix de ⋮ sautent Privé pour ces blocs (test d'intégration « V3.1-64 », `entityHistory.integration.test.ts`).

*Écarts* : « plus visible » au sens strict (seul Privé → Public, ou campagne/utilisateur → Public, avertit ; MJ → Privé restreint). Le choix direct de ⋮ n'offre pas campagne et utilisateur (il faudrait un sélecteur de campagne ou de personne).

---

### ☑ V3.1-63 — Fiche du wiki sur ordinateur : en-tête, cartes de verre, palette en familles · `L` · sans modèle IA — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — planche définitive, aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Wiki-Fiche-Decide.dc.html`. **Départ** :
`app/m/[worldSlug]/(monde)/f/[entitySlug]/page.tsx` et `EditEntityForm.tsx`,
`components/blocks/EntityBlocks.tsx` (`BLOCK_TYPE_LABELS`,
`BlockDataEditor`, l'ajout de bloc), `components/shared/ActionsMenu.tsx`,
`components/shared/visibilityOptions.ts`, `components/entities/RelationsChips.tsx`,
`components/entities/PortraitUpload.tsx`, `components/entities/EntityHistoryPanel.tsx`.
**Dépend de** : 20 (fenêtres à volets), 25 (pilule).

**Ce qui est décidé**
- La fiche **s'édite directement**, au verre minéral, dans la fenêtre à
  volets du MJ (V3.1-20). C'est l'écran le plus utilisé du MJ. Le téléphone
  garde l'éditeur de V3.1-30 et 31 (rien à changer ici sur téléphone).
- **En-tête** :
  - le titre, éditable sur place ; sur une fiche neuve, le nom par défaut
    est **sélectionné** (on tape directement par-dessus) ;
  - le **type ▾** (PJ, PNJ, Lieu… et « + Créer une catégorie » en bas du
    menu — même service que la création de catégorie d'aujourd'hui) ;
  - l'**historique** (ouvre `EntityHistoryPanel`) et l'**œil du wiki
    public** (même lien qu'aujourd'hui) ;
  - l'**adresse** (slug) dessous, en petit ;
  - **Alias** et **Relations** en pastilles, × pour retirer, « + » pour
    ajouter (relations : `RelationsChips`, même route qu'aujourd'hui) ;
  - le **portrait à droite** (`PortraitUpload`).
- **Une carte de verre par bloc.** En-tête de la carte, de gauche à droite :
  - ⠿ pour glisser (réordonner), **aussi au clavier** (focus sur ⠿, puis
    flèches haut/bas, Entrée pour poser, Échap pour annuler) ;
  - ▾ / ▸ pour replier / déplier (l'état replié est une préférence locale
    de l'éditeur, pas une donnée du bloc) ;
  - le titre du bloc, **éditable sur place** (`display.label`) ;
  - le type en pastille (« Texte », « Relation »…, `BLOCK_TYPE_LABELS`) ;
  - « Enregistré », annoncé poliment (`aria-live="polite"`) après chaque
    sauvegarde réussie ;
  - **la visibilité en pastille de couleur** : vert Public, bleu Joueurs,
    orange MJ, gris Privé (jetons de la charte ; « campagne » et
    « utilisateur » gardent leur libellé actuel). Son comportement au
    toucher est V3.1-64 ; ici elle ouvre seulement l'infobulle qui dit qui
    la voit (« le MJ seul — jamais envoyé aux joueurs ») ;
  - ⋮ (`ActionsMenu`) : Monter, Descendre, Dupliquer, Choisir la
    visibilité…, Supprimer…. **Les ▲▼ d'aujourd'hui passent dans ⋮.** La
    suppression est confirmée (`ConfirmDialog`) et rappelle que
    l'historique la garde.
- **« + Ajouter un bloc »** en bas ouvre la palette **en familles**, dans
  cet ordre :
  - Récit : Texte, Encadré, Image, Tableau, Chronologie ;
  - Personnage : Personnage, Inventaire, Incantation, Ressources, Fiche de
    créature ;
  - Psyché et liens : Personnalité, Relation, Convictions, Réseau,
    Généalogie ;
  - Outils de jeu : Table aléatoire, Quête, Musique, Carte.
  - `generator`, `note_tree` et `session_journal_meta` **n'apparaissent
    pas** dans la palette (comme aujourd'hui pour le dernier).
- **Fenêtre étroite** (tablette, volet partagé — requête de conteneur, pas
  `window.innerWidth`) : portrait réduit, blocs Personnalité et Convictions
  sur une colonne, pastille de type masquée dans l'en-tête de carte.
- **Données** : rien de neuf.

**À faire**
1. Extraire l'en-tête de carte en un composant partagé `BlockCard`
   (`components/blocks/BlockCard.tsx`) : il porte ⠿, ▾, titre, type,
   « Enregistré », pastille, ⋮, et reçoit l'intérieur en `children`. Tous
   les blocs passent par lui ; les tickets 65 à 79 n'y touchent pas.
2. Refaire l'en-tête de fiche dans `EditEntityForm.tsx`.
3. Palette en familles (constante ordonnée dans `EntityBlocks.tsx`, libellés
   des familles dans le fichier de libellés).
4. Planche du catalogue : en-tête de fiche, `BlockCard`, palette.

**Ne pas faire** : toucher l'intérieur des blocs (tickets suivants) ;
changer le téléphone ; ajouter un type de bloc.

**Critères d'acceptation**
- [x] Une fiche neuve s'ouvre le nom sélectionné ; taper le remplace.
- [x] Réordonner un bloc au clavier (⠿ + flèches + Entrée) fonctionne et s'annonce.
- [x] Les ▲▼ ont disparu des cartes ; Monter / Descendre sont dans ⋮.
- [x] La palette montre quatre familles, dans l'ordre ci-dessus, sans `generator`, `note_tree`, `session_journal_meta`.
- [x] En fenêtre étroite (volet partagé), la pastille de type disparaît et le portrait se réduit (test visuel à 820 px de volet).
- [x] Aucun changement côté téléphone (390 px).

**Réalisé** (Sonnet, relu et corrigé par Opus)
- `BlockCard` (⠿, ▾/▸ en préférence locale, titre éditable, type, « Enregistré », pastille de visibilité, ⋮ : Monter, Descendre, Dupliquer, Choisir la visibilité…, Supprimer…) ; `SortableBlockCard` ne garde que le câblage.
- En-tête de fiche refait (`EditEntityForm.tsx`) ; portrait réduit en fiche étroite.
- Palette en familles (`lib/ui/ficheBlocs.ts`, testée) ; `BarreAjoutBloc` reste celle de l'éditeur téléphone.
- Glisser au clavier : celui de dnd-kit (Entrée, flèches, Entrée, Échap) avec des annonces françaises calculées par `annonceReordonnancement`.
- Jeton `players` (bleu Joueurs) ajouté à la charte, tous modes.
- Vérifié au navigateur : 1440 px, 820 px (type masqué, portrait sous l'en-tête), 390 px ; menu ⋮ et palette.

*Écarts* :
- La fiche affichée au téléphone (pas l'éditeur) prend aussi les cartes de verre : elle partage le composant. Le titre de bloc y était coupé ; corrigé par une taille réduite en carte étroite (`.block-title-carte`, requête de conteneur).
- `session_journal_meta` ne se pose plus à la main sur ordinateur, comme le demande le ticket.
- La pastille vit dans `BlockCard` ; V3.1-64 l'extrait en `VisibilityPill`.

---

### ☑ V3.1-114 — Ressources : repos et égaliseur · `S` · sans modèle IA — **fait le 25 octobre (ADR 0045)**

**Modèle conseillé : Sonnet.** **Dépend de** : 113, 24, 26.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `takeShortRest` rend les emplacements de pacte et une utilisation des
  `short_rest_one` ; `takeLongRest` rend tout.
- L'égaliseur (planche « Décidé · emplacements et ressources de classe »)
  montre la réserve de pacte à part ; une ressource de plus de six
  utilisations en compteur.

**Reçu de V3.1-113** (13 octobre) : les deux repos rendent déjà la réserve de pacte et une utilisation des `short_rest_one` (`rechargeTrackers`). Il reste l'écran :
- montrer `sheet.spellcasting.pactSlots` et `pact_slots_used`, à part ;
- d'ici là, un occultiste ne voit pas ses emplacements de pacte, mais `castSpell` les dépense déjà.

**Critères d'acceptation**
- [x] Les trois cas de V3.1-40 se voient sur la fiche.

**Réalisé**
- Égaliseur (`components/blocks/Egaliseur.tsx`, Sonnet, relu) d'après la planche « Fiche-Emplacements » : groupes « Emplacements de sorts » (niveaux, puis la réserve de pacte à part), « Classe », « Traits » ; compteur au-delà de six ; recharge sous chaque colonne ; la ligne défile au téléphone. Il remplace la ligne d'emplacements et la liste « Ressources » de l'onglet Actions.
- Répartition pure `lib/ui/egaliseur.ts` (tests d'abord) : « Classe » = ressource dont la source est une classe ou sous-classe du personnage.
- Route `actions/spell-slot` : dépenser ou rendre un emplacement ou un de la réserve de pacte à la main, borné, derrière l'interrupteur « spell_slots » (test d'intégration, docs/SECURITE.md).
- Vérifié au navigateur (ordinateur et 390 px), fiches de test du MJ supprimées : occultiste 3 (« Pacte niv. 2 », court) ; clerc 3 / magicien 2 (4/3/2) ; Conduit divin « 1 au court » en Classe, 8 points de chance en compteur ; geste de pacte enregistré.

*Écart* : pas de jeton violet propre au pacte ; emplacements et pacte prennent `link-entity`, le pacte se distingue par son libellé et un séparateur.


---

### ☑ V3.1-112 — Sauvegardes : les écrans · `M` · sans modèle IA — **fait le 24 octobre (ADR 0044)**

**Modèle conseillé : Sonnet.** **Dépend de** : 111, 33, 34, 38.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- La cible reçoit un **bandeau au premier plan** : « Résiste à Moquerie
  cruelle · JS Sagesse DD 13 » — « Lancer », « J'ai un vrai dé »
  (interrupteur « modificateur inclus »), « Laisser le MJ saisir ».
- Le MJ répond dans l'outil **Initiative** en combat (bandeau), dans
  l'outil **Table** hors combat ; une **pastille sur le dé encoché** compte
  les demandes en attente, où qu'on soit.
- L'outil de dés de l'auteur affiche le verdict revenu, puis enchaîne.

**Critères d'acceptation**
- [x] Les trois façons de répondre fonctionnent, sur ordinateur et téléphone.

**Réalisé** (détail dans l'ADR 0044, « Réalisation des écrans »)
- Migration `20261024120000_save_requests_realtime.sql` (appliquée le 24 octobre) : `save_requests` en temps réel.
- `SauvegardesProvider` (AppShell) : la liste arrive avec la page, un seul canal la suit ; `lib/ui/sauvegardes.ts` pur et testé.
- Bandeau de la cible, liste du MJ (Initiative : le combat ouvert ; Table : toutes), pastille du dé encoché, verdict dans l'outil de l'auteur (Sonnet, relu).
- Libellé de la demande : nom traduit du sort (« Flamme sacrée · JS Dextérité DD 13 »).
- Vérifié au navigateur, MJ et Testeuse A, ordinateur et 390 px : lancer, vrai dé « modificateur inclus », laisser le MJ puis saisie du MJ ; bandeau et pastille en direct ; « En attente » puis verdict chez l'auteur. PV de A remis à 12/12.

*Écart* : « Laisser le MJ saisir » n'écrit rien (le bandeau se replie, le temps de la page).
*Restes* (audit V3.1-144) : sauvegardes laissées en attente par un combat supprimé ; clé du sort dans l'historique des jets.


---

### ☑ V3.1-106 — Cibler côté MJ : outil de dés, Table, Initiative · `M` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet.** **Dépend de** : 105, 33 (outil de dés), 34, 38.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- « Cibler » s'allume dans l'outil de dés **pour le MJ** quand une
  initiative est `running` : liste des participants (alliés pour un soin),
  cible retenue affichée ; grisé hors initiative ou pour un jet sans cible.
- « Lancer » appelle `resolveTargetedRoll` ; une touche fait apparaître la
  bande « Lancer les dégâts » (même cible) ; verdict et changements affichés.
- Même chemin depuis l'outil Table (action d'un PNJ) et l'outil Initiative.
- *Repris de V3.1-33 (17 octobre)* : les boutons d'attaque, de sort et de
  dégâts de la fiche ouvrent l'outil pré-rempli (`openDiceTool`) ; la bande
  du pied (place déjà réservée dans `OutilDes.tsx`) devient « Lancer les
  dégâts » sur une touche, et « Valider · dégâts » / « Faire échouer » quand
  un monstre touche un joueur (critères de V3.1-33 restés ouverts).

*Déjà fait le 24 octobre, depuis l'outil Initiative (suite de V3.1-38)* :
« Cibler » et la liste des participants, les dés du jet ciblé affichés,
l'avantage au choix, la bande « Lancer les dégâts » après une touche (même
cible, critique compris). Reste : l'outil de dés **ouvert seul** par le MJ
pendant une initiative, l'outil Table, les boutons de la fiche, et
« Valider · dégâts » / « Faire échouer ». *Relevé le 24 octobre* : après
« Lancer les dégâts », la grille de l'outil garde le d20 de l'attaque (le
préréglage n'est pas remplacé par celui des dégâts) — à régler ici.

**Critères d'acceptation**
- [x] Au tour du Worg, « Morsure » sur un PJ : touche, dégâts, JS, À terre
  appliqués (planche de la Table).
- [x] Hors initiative, les jets restent de simples jets.

**Livré le 24 octobre.** Interface (Sonnet) : les boutons Attaquer, Dégâts,
attaque de sort et lancer de sort de la fiche ouvrent l'outil de dés
pré-rempli (mêmes routes ; dés, paire et d20 gardé par `rollsForDisplay`) ;
après une touche, « Lancer les dégâts · formule » (critique compris,
`pendingCrit` retiré) ; pour le MJ pendant une initiative en cours, au
toucher du bouton, « Cibler » et `targeted-roll` (`lib/ui/ficheDesApi.ts`,
deux lectures) ; effet à la place du verdict (« Worg : 26 → 13 PV ») ;
« Valider · dégâts » / « Faire échouer » quand un monstre touche un PJ
(`lib/ui/jetCibleOutil.ts`, partagé avec l'initiative) ; la grille passe aux
dés des dégâts. Corrections d'Opus : (1) depuis la fiche, l'attaque de sort
n'est JAMAIS ciblée — `spell_attack` dépense l'emplacement et applique les
dégâts d'un coup, et le bouton « Dégâts » du même sort l'aurait relancé
(emplacement dépensé deux fois) ; un sort ciblé se lance depuis la ligne de
l'initiative ; (2) **défaut de 105 trouvé en vérifiant** : le serveur
cherchait l'action d'un monstre dans le bloc brut (« Bite ») alors que
l'écran envoie le nom traduit (« Morsure ») — aucune attaque de monstre
ciblée n'aboutissait en français, et une variante ne trouvait pas le
monstre de sa base ; `loadMonsterBlocks` lit désormais par
`getRuleEntryForWorld` (chaîne du ruleset, surcharges, langue), et le test
d'intégration envoie le nom traduit comme l'écran. Vérifié en direct (MJ de
test, combat avec un Worg du bestiaire et Testeuse A) : depuis la fiche de
A ouverte dans l'initiative, Attaquer → Cibler le Worg → touché → « Lancer
les dégâts · 2d6+3 » → Worg 26 → 13 PV, grille en 2d6+3 ; Morsure du Worg
sur A → touché → « Valider · dégâts » / « Faire échouer » → les PV de A
restent à 12. Combats d'essai supprimés, PV remis. Planche : section
« Outil de dés unique » de `Ecrans.dc.html`. *Écarts* : l'outil Table ne
liste que des PJ (aucune action de PNJ à brancher) ; les dégâts à deux
mains restent un simple jet (`targeted-roll` ne les connaît pas) ; l'effet
s'écrit « Worg : 26 → 13 PV » plutôt que « Worg −13 PV ».

*Relevé par l'auteur le 24 octobre, corrigé* : ancré au dé du rail par le
bas, le panneau de l'outil de dés grandissait vers le haut sans limite et
son en-tête (titre, Secret, ×) sortait de l'écran. Sa hauteur se borne
maintenant à l'espace au-dessus de son ancrage, et il défile au-delà
(`PanneauFlottant`, `OutilDes.tsx`) ; vérifié à 1280×800 et 1280×640.

---

### ☑ V3.1-38 — L'outil Initiative refondu, MJ et joueur · `L` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet** — planche définitive, données fournies par V3.1-37.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · initiative (A retouchée) ». **Départ** :
`components/shell/InitiativeTracker.tsx`, `app/m/[worldSlug]/mj/initiative/page.tsx`.
**Dépend de** : V3.1-37, V3.1-24 (PV temporaires), V3.1-26 (jauges),
V3.1-29 (téléphone), V3.1-33 (outil de dés).

- MJ, ordinateur et téléphone : tout le détail de la décision (V3.1-19,
  lot i) — colonnes CA / PV alignées, score modifiable qui réordonne,
  lignes dépliables avec toutes les actions en deux boutons (touche,
  dégâts), PV temporaires, renommage avec le nom d'origine en petit,
  menace restante, Commencer / Round 1 / fin confirmée.
- Joueur : invitation au premier plan (lancer, ou vrai dé avec
  l'interrupteur « modificateur inclus »), mode combat dans Perso. (ordre,
  économie d'action, Actions · Sorts · Capacités), retour à la fiche
  normale à la fin.

**Critères d'acceptation**
- [x] Le parcours de la planche, de « Commencer » à la fin confirmée, avec un MJ et deux joueurs (dont un sans l'application).
- [x] « Quitter le combat » puis « Reprendre tel quel » : ordre, PV et états intacts ; « Recommencer » relance l'initiative et renvoie l'invitation.
- [x] Côté joueur, le mode combat garde la fiche complète (même composant que hors combat), l'ordre du tour en tête.
- [x] Un dégât porté depuis la fiche du joueur se voit aussitôt dans l'initiative du MJ, et inversement (même état de jeu).
- [x] À 390 px et sur ordinateur, côté MJ et côté joueur.
- [x] Planche du catalogue « Initiative » créée ou mise à jour.
- [x] Un adversaire saisi à la main reçoit CA et PV dès l'ajout ; la liste des combats suit l'état (commencé, terminé) sans recharger (vu par la vérification du 11 octobre).

**Livré le 24 octobre.** Serveur (Opus) : migration
`20261024090000_combat_paused_realtime` (appliquée le 24 octobre) — statut
`paused` (choix de l'auteur : suspendu ≠ terminé), `combats` publiée en temps
réel, et un déclencheur qui recopie PV, PV temporaires et états d'un PJ vers
ses combats non terminés (sans lui, un dégât porté depuis la fiche ne
remontait jamais chez le MJ). Conséquence corrigée : une sauvegarde ratée par une
joueuse lisait l'« avant » de sa ligne de combat après la recopie, et
l'annulation du MJ ne rendait rien ; l'« avant » se lit désormais dans sa
vue filtrée, avant d'écrire (`saveRequests.ts`). Noyau `canPauseCombat`, `resumedCombatStatus`
(tests d'abord) ; services et routes `pause`, `resume`, `restart` ; un combat
suspendu n'est plus « en cours » pour les joueuses ; renommer un participant
(`label`, annulable) ; CA et PV d'un adversaire saisi à la main ; le jet
d'initiative d'une joueuse renvoie son d20. Tests d'intégration
(`combatPause.integration.test.ts`, 5 cas). ADR 0040 complétée, SCHEMA.md.
Interface (Sonnet, deux agents en parallèle) : outil du MJ refait
(`components/shell/initiative/`, `lib/ui/initiative.ts`, `initiativeApi.ts`,
temps réel sur `combats`) ; côté joueuse, `components/shell/combat/`
(invitation, ordre du tour, économie d'action au-dessus de la fiche
inchangée), `lib/ui/combatJoueur.ts`. Vérifié en direct (MJ de test,
Testeuse A, Testeur B joué « sans l'application ») : gobelin saisi à 13 CA
et 7 PV ; « Commencer » lance les adversaires et l'invitation arrive chez A
sans recharger ; jet, résultat, « validé dans 4 s… », fermeture ; saisie du
MJ pour B ; Round 1 ; ordre du tour chez A ; PV fiche → MJ (12 → 11 par la
route de la fiche) et MJ → fiche (9/12) ; Quitter (A revient à sa fiche),
Reprendre tel quel (round, PV, initiatives intacts), Recommencer
(invitation renvoyée) ; renommé « Monstre non identifié », A ne voit jamais
« Gobelin » ; ordinateur et 390 px des deux côtés. Combats d'essai supprimés,
PV de A (12/12) et B (10/11) remis. Planche : section « Initiative » de
`OutilsMJ.dc.html` refaite.

*Restes* : la fin confirmée et la liste des combats en temps réel n'ont pas
été rejouées en direct (code relu) ; au téléphone, les noms du MJ
sont très tronqués ; le volet de dés s'ouvre après le jet d'initiative,
par-dessus la fiche ; le bleu des PV temporaires est une constante locale,
à promouvoir en jeton.

*Suite du 24 octobre — les dés des jets ciblés* : le serveur renvoie
`dice` (total, étapes, paire d'avantage, d20 gardé) pour l'attaque, les
dégâts et l'attaque de sort (`rollsForDisplay`, `src/core/dice/diceTool.ts`,
testé) ; l'outil de dés laisse choisir l'avantage d'un jet ciblé d'attaque
(`avantageLibre`) et propose, après une touche, « Lancer les dégâts » sur la
même cible, critique compris (`SuiteDeJet`, d'après le `chained` du
serveur). Vérifié en direct : attaque avec avantage (d20 1 et 8, 8 gardé,
total 13, « Touché »), puis dégâts 2d6+3 = 15 sur le gobelin. Le
doublement au critique passe par le chemin serveur déjà testé
(`targetedRoll.integration.test.ts`) ; non rejoué en direct, faute de 20
naturel. Après les dégâts, la grille de l'outil garde le d20 de l'attaque
(le préréglage n'est pas remplacé) : cosmétique.

---

### ☑ V3.1-57 — Règles actives : le ruleset à gauche, la table à droite · `M` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; données et serveur de V3.1-23.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Regles-Decide.dc.html`. **Départ** :
`components/rules/RulesetSelector.tsx`, `RulesetImportMappingDialog.tsx`,
cas `regles-actives`. **Dépend de** : **23** (interrupteurs,
`campaigns.table_settings`, refus serveur), 26 (fiche).

**Ce qui est décidé**
- **À gauche, le ruleset** :
  - « Ruleset de la campagne » : les variantes **en arbre sous leur base**
    (trait de rattachement) ; pastilles « officiel », « variante »,
    « référence personnelle » ; « ● actif » ou « Choisir » ; « Exporter »
    sur une variante **jamais sur une référence personnelle** ; × sur une
    variante, confirmé en surface flottante (« Supprimer la variante « … » ?
    Ses fiches de règles disparaissent ; la campagne revient à … » si elle
    est active) ;
  - « Créer une variante » : la base en puces, le nom, « Créer » (grisé sans
    nom), l'interrupteur « Référence personnelle » (« Contenu saisi depuis
    un ouvrage que je possède ») et son avertissement
    (`referencePersonnelleAvertissement`, texte inchangé) ;
  - « Importer des règles » : « Ajouter à la variante active » / « Créer un
    nouveau ruleset personnel » en puces, l'aide (textes existants de
    `messages/fr.json`), « Choisir un fichier JSON… », le résultat et les
    erreurs ligne à ligne (correspondance des colonnes inchangée).
- **À droite, la table** :
  - « Ce que les joueurs modifient eux-mêmes » : les six interrupteurs de
    V3.1-23 (états, inspiration, PV, pièces, emplacements, dés de vie), chacun
    avec ce qu'il commande en petit et **qui tient la valeur** (« le MJ » /
    « la joueuse ») ; « Par défaut » remet les six réglages ;
  - « Inspiration au plus » en − / + ;
  - **l'aperçu de la fiche de la joueuse** (une fiche de PJ de la campagne,
    en lecture) qui suit les interrupteurs **en direct** : « + état »
    apparaît, ▲▼ apparaissent, emplacements inertes, « Le MJ dépense tes dés
    de vie ». C'est **la fiche réelle** (composant de V3.1-26) en mode
    lecture, pas un dessin à part.
- **Tablette** : un volet — la table et l'aperçu d'abord, puis le ruleset et
  l'atelier. **Téléphone** : le ruleset, la table, l'aperçu, puis
  « Variantes et import » replié.

**Critères d'acceptation**
- [x] Choisir un ruleset : fiches, création et règles le suivent sans rechargement (caches clients vidés comme aujourd'hui).
- [x] « Exporter » absent d'une référence personnelle.
- [x] Basculer un interrupteur change l'aperçu aussitôt et l'écrit (une requête).

**Livré le 24 octobre.** Serveur (Opus) : `chargerReglesActives`
(`src/server/services/reglesActives.ts`) lit ensemble les rulesets (avec leur
parent, pour l'arbre), l'actif, les interrupteurs de la campagne et un PJ
pour l'aperçu (une joueuse de préférence), page et fenêtre ; la page lance
la fiche de l'aperçu avec elle (ADR 0056). `DELETE /api/rulesets/[id]?worldSlug=`
(`deleteRulesetVariantFromWorld`) : la variante ACTIVE rend la campagne à sa
base avant de disparaître, et le monde la reprend si elle ne peut pas
disparaître (test d'intégration, trois cas) ; Zod ajouté sur cette route qui
n'en avait pas. Interface (Sonnet) : `ReglesActivesPanel`, `RulesetSelector`
refait sans chargement au montage, `Interrupteur`, logique pure
`lib/ui/reglesActives.ts` (testée) ; l'aperçu est la vraie fiche
(`ParticipantCharacterSheet`) en `inert`, avec `commandesImposees` calculées
par `sheetControls` sur les interrupteurs locaux. Correction d'Opus : en
grande fenêtre, l'atelier tombait sous la hauteur de l'aperçu (rangées de
grille), corrigé par `auto auto 1fr`. Vérifié en direct avec le MJ de test :
« Leur inspiration » allumé fait apparaître ▲▼ dans l'aperçu aussitôt, une
requête, persiste au rechargement ; « Par défaut » remet tout en une
requête (réglages du banc d'essai remis). Créer, importer et supprimer une
variante n'ont pas été rejoués en direct (le test d'intégration couvre la
suppression). Limite : « Variantes et import » s'ouvre de force dès `@md`
par `::details-content` (Chromium 131+, Firefox 143+) ; plus ancien, il
reste replié mais s'ouvre à la main.

---

### ☑ V3.1-109 — Droits des joueurs : la fiche obéit aux interrupteurs · `M` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet.** **Dépend de** : 108, 26, 32. L'écran
Règles actives est V3.1-57.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Partout où la joueuse voit sa fiche (ordinateur, tablette, téléphone) :
  interrupteur coupé → la valeur se voit, sans commande (« + état » absent,
  ▲▼ de l'inspiration, des PV, des pièces absents, colonnes « niv. » de
  l'égaliseur inertes, « Le MJ dépense tes dés de vie » à la place de
  « Dépenser un dé ») — planche « Décidé · fiche vue par le MJ et par le
  joueur ». Le MJ garde toutes les commandes.

**Critères d'acceptation**
- [x] Les six interrupteurs pilotent la fiche de la joueuse sur les trois
  écrans.

**Livré le 24 octobre.** Noyau (Opus) : `sheetControls(settings, { callerIsGm })`
(`src/core/campaigns/tableSettings.ts`, testé) — le MJ garde tout, hors
campagne il n'y a pas de table. Serveur (Opus) : la réponse de la fiche
calculée (`/sheet` et chargement avec la page) porte `controls`, calculés
pour l'appelant et la campagne (`loadSheetControls`, deux lectures en
parallèle, seulement dans une campagne ; test d'intégration). Interface
(Sonnet) : aucune commande tant que la fiche calculée n'est pas arrivée
(`lib/ui/commandesFiche.ts`, testé) ; PV (jauge et soins du bloc mourant),
inspiration et pièces perdent leurs commandes quand leur interrupteur est
coupé ; « Le MJ dépense tes dés de vie » sous la rangée de badges. Constat :
la fiche de la joueuse n'a ni « + état », ni égaliseur d'emplacements, ni
« Dépenser un dé » — ces commandes n'existent que dans l'outil Table du MJ ;
rien à cacher pour ces champs. Vérifié en direct avec Testeuse A (réglages
par défaut, puis PV et dés de vie coupés), réglages du banc d'essai remis.

---

### ☑ V3.1-60 — Publication : les réglages, et ce que voit un visiteur · `M` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; galerie de 58, données de 59.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Publication-Decide.dc.html`. **Départ** :
`components/shell/PublicationPanel.tsx`, `ShareLinkPanel.tsx`,
`BookSkin.tsx` (pour l'aperçu). **Dépend de** : 58 (galerie), 59.

**Ce qui est décidé**
- **À gauche** :
  - « Partage en lecture seule » : texte d'aide inchangé ; alias
    (« /partage/ » + champ), mot de passe, « Créer un lien » ; « Lien créé : »
    avec « Copier » (« Copié ✓ ») ; la liste (adresse, « Créé le … »,
    « protégé », Copier, Révoquer) ; textes existants de `ShareLinkPanel`.
  - « Message d'accueil » : 500 caractères avec compteur, « Enregistrer »
    (« Enregistré ») ; « Remplace le grand titre de la page d'accueil. Vide :
    le nom de la campagne. »
  - « Fond par défaut du wiki public » : **la galerie de V3.1-58** (même
    composant), « une fiche qui a son propre fond le garde », « Mode des
    pages » en puces (modes non permis grisés), « Flou du fond ».
- **À droite, « Ce que voit un visiteur »** : la page d'accueil du wiki en
  petit — le message en titre (ou le nom de la campagne), le sommaire, le
  fond, le mode, le flou — qui **suit chaque changement** avant
  enregistrement ; « Prévisualiser ↗ » ouvre le vrai (`/m/[slug]/apercu`).
- **Tablette** : un volet — l'aperçu d'abord, puis le message, le fond, les
  liens. **Téléphone** : les liens, le message, le fond, puis l'aperçu ;
  « Prévisualiser ↗ » en haut.

**Critères d'acceptation**
- [x] L'aperçu suit message, fond, mode et flou sans requête au serveur.
- [x] Choisir un fond qui ne permet pas le mode des pages bascule sur un mode permis et l'annonce.
- [x] Liens : créer, copier, révoquer inchangés (tests existants verts).

**Livré le 24 octobre.** Serveur (Opus) : `chargerPublication`
(`src/server/services/publication.ts`) lit ensemble les liens, le message,
le nom de la campagne, le sommaire public (même service que le wiki public,
donc jamais plus que ce qu'un visiteur voit) et le fond enregistré, pour la
page comme pour la fenêtre ; noyau `publicationBackgroundState` et
`wikiBackgroundInputFromRef` (testés). Entrée `keep` ajoutée à la route du
fond (ADR 0047, complément) : sans elle, le mode d'une copie ne se réglait
pas, et chaque geste sur le flou aurait recopié l'image. Interface (Sonnet) :
`PublicationPanel` en deux colonnes par requêtes de conteneur,
`ApercuVisiteur` sans requête, `lib/ui/publication.ts` (testé). Corrections
d'Opus : envois du fond mis en file (un `keep` n'arrive jamais avant le choix
qui le précède) ; au téléphone, carte des liens doublée et « Créer un lien »
hors de l'écran. Vérifié en direct avec le MJ de test : l'aperçu suit la
frappe sans aucune requête ; un fond fourni, le mode, le flou : un envoi par
geste, tout persiste au rechargement ; banc d'essai remis sans fond. Le
deuxième critère (bascule annoncée) passe par le même `modeApresChoixDeFond`
que V3.1-58 : les fonds fournis permettant tous les quatre modes, il ne se
voit qu'avec une image personnelle limitée. Planche : section
« Publication » de `OutilsMJ.dc.html`.

---

### ☑ V3.1-58 — Personnalisation : le fond d'abord, et pour les joueuses · `M` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Perso-Decide.dc.html`. **Départ** :
`components/shell/PersonnalisationPanel.tsx`, `BackgroundPicker.tsx`,
`src/core/theme/builtinBackgrounds.ts`, `HomeProfilePanel.tsx`,
`PlayerShell.tsx`. **Dépend de** : 27 (rail), 35 (Compte sur l'accueil).

**Ce qui est décidé**
- **Barre en tête** : le mode en **pilule à quatre** (Sombre, Demi-sombre,
  Demi-clair, Clair) — un mode que le fond ne permet pas est grisé, raison
  au survol (« Ce fond ne permet pas ce mode de façon lisible ») ; « Flou
  du fond » (0 à 40 px, pas de 2) ; « Contraste élevé » en interrupteur
  (« Palette neutre sombre et traits nets, quel que soit le mode »).
- **Galerie des fonds** en grandes vignettes (les miniatures réelles,
  `thumbDataUrl`), chacune avec **ses modes lisibles en points** (un point
  teinté par mode permis, vide sinon) ; les images personnelles à la suite,
  avec × ; « + Ajouter une image » en dernière vignette (téléversement
  existant). Choisir un fond qui ne permet pas le mode en cours **bascule**
  sur un mode permis et **le dit** (message court).
- Sous la galerie : « Ces réglages sont les tiens, sur cet appareil : ils
  s'appliquent aussitôt, sans enregistrer. Tes images personnelles te
  suivent sur tous tes appareils. »
- **Données** : rien de neuf — cookies `mode`, `contrast`, `background`,
  `bgBlur` et la bibliothèque personnelle (`/api/settings/background`).
- **Tablette** : deux vignettes par rangée. **Téléphone** : la barre en
  colonne, puis la galerie en deux colonnes.
- **Pour tout le monde (accord de l'auteur, 8 octobre)** : le même écran
  dans **« Compte » de l'accueil** (V3.1-35), à côté du profil ; une entrée
  **« Apparence »** en pied du rail du joueur, au-dessus de « Mes mondes »,
  qui l'ouvre en page pleine ; au téléphone, par Accueil › Compte. Le MJ
  garde son outil. Un seul composant pour les trois accès.

**Critères d'acceptation**
- [x] Un compte joueur sans aucun monde mené règle son mode et son fond depuis Compte.
- [x] Choisir un fond à deux modes en mode clair bascule en sombre et l'annonce.
- [x] Un seul composant monté aux trois endroits (aucun doublon).

**Livré le 24 octobre.** L'essentiel était déjà en place depuis V3.1-80
et 81 (barre à quatre modes grisés, flou, contraste, galerie, section
Apparence du Compte). Reste fait par Opus, sans délégation : la bascule de
mode imposée par un fond est annoncée sous la barre (`role="status"`) ;
chaque vignette porte toujours quatre points, vides pour les modes non
lisibles (logique pure `lib/ui/apparence.ts`, testée) ; « Apparence » en
pied du rail du joueur, au-dessus de « Mes mondes », ouvre la page pleine
`/m/[monde]/joueur/apparence`, qui monte le même `PersonnalisationPanel`.
Vérifié en direct avec Testeuse A (ordinateur et téléphone). Les fonds
fournis permettent tous les quatre modes : la bascule ne se produit qu'avec
une image personnelle, d'où le test unitaire plutôt qu'un téléversement.

---

### ☑ V3.1-42 — Bloc-notes : le cahier refait, MJ et joueuse · `L` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; données fournies par 41.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Notes-Decide.dc.html` (« Décidé · bloc-notes (A) avec le
partage à la table »). **Départ** :
`components/shell/notebook/NotebookWorkspace.tsx`,
`components/shell/notebook/FicheCompanion.tsx`,
`app/m/[worldSlug]/joueur/notes/page.tsx`, cas `notes` de
`components/shell/MjToolWindowContent.tsx`. **Dépend de** : 41, 20, 25, 29.

**Ce qui est décidé**
- **Ordinateur** : sommaire arborescent à gauche — « Mon cahier » (pages,
  fiches ◆ et règles § épinglées), puis « Partagées à la table » (chaque
  page avec son autrice) ; la page au centre ; la fiche citée ou épinglée
  dans le panneau de droite (`FicheCompanion`). En bas du sommaire :
  « + Nouvelle page », « + Préparation de séance » (MJ seul), « ◆ Épingler
  une fiche ou une règle ».
- **Partage** : chaque page de **son** cahier porte un sélecteur « Privée |
  La table » (services de 41). Partagée, elle reste à sa place, marquée
  « partagée ». Une page partagée par quelqu'un d'autre s'ouvre en lecture
  seule, « <autrice> · lecture seule ».
- **MJ** : en fenêtre (V3.1-20), rail présent. **Joueuse** : « Notes » de
  son rail, en page pleine, même disposition, sommaire « Mes notes » puis
  « Partagées à la table » (pas de « Préparation de séance »).
- **Tablette** (fenêtre ≈ 556 px) : sommaire en tiroir ☰, fiche en panneau
  par-dessus la page ; au-dessus de ~640 px de fenêtre, la disposition
  d'ordinateur.
- **Téléphone du MJ** : Outils › Bloc-notes — épinglées en puces, « Mon
  cahier » puis « Partagées à la table » en liste, page en plein écran,
  fiche citée en feuille du bas. **Téléphone de la joueuse** : Notes, pilule
  « Les miennes / Partagées à la table ».

**Critères d'acceptation**
- [x] Les quatre écrans de la planche (MJ fenêtre, joueuse page pleine, tablette, deux téléphones).
- [x] Partager puis repasser en privée depuis la page ; l'autre compte voit la page apparaître puis disparaître.
- [x] Une page partagée par une autre personne n'offre aucune commande d'écriture.
- [x] Première vue sans écran « Chargement… » (données en props, règle commune 6).

**Livré le 19 octobre.** Serveur (Opus) : `loadNotebookWorkspace` charge le
cahier ET les pages partagées en un seul `Promise.all`, dans la fenêtre du
MJ comme dans les deux pages pleines ; `SharedNoteView` porte `shared`,
`blockId` et `version`. Interface (Sonnet) : `NotebookWorkspace` découpé en
`SommaireCahier`, `PageCahier`, `LecturePage`, `SelecteurPartage`,
`BoutonEpingler`, `TelephoneCahier` ; logique pure dans `lib/ui/cahier.ts`
(19 cas). Vérifié en direct avec Testeuse A et Testeur B : partager (200),
B lit « PJ de Testeuse A · lecture seule » sans aucune commande d'écriture,
repasser en privée (204), B ne la voit plus ; aucun « Chargement… » ;
captures MJ ordinateur, tablette (« ☰ Sommaire ») et téléphone joueuse.
Planche : section « Cahier » de `OutilsMJ.dc.html`. Limite connue : une
page partagée (ou qui l'a été) ne se supprime pas depuis le cahier, faute
de route qui retire l'entité `shared_note`.

---

### ☑ V3.1-43 — Livre de sessions : le registre et ses trois ajouts · `M` · sans modèle IA — **fait le 19 octobre (sauf « Relancer », qui attend V3.1-22)**

**Modèle conseillé : Sonnet** — planche définitive ; aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Livre-Decide.dc.html`. **Départ** :
`components/shell/sessionJournal/SessionJournalMjPanel.tsx`,
`components/shell/sessionJournal/SessionJournalBanner.tsx`, cas
`livre-de-sessions` de `MjToolWindowContent.tsx`. **Dépend de** : 20, 29 ;
l'ajout (2) « Relancer » dépend de V3.1-22 (fils du chat).

**Ce qui est décidé**
- **MJ, ordinateur** : une ligne par séance — date en jeu, titre, autrice,
  séance réelle, état (« Rédigée », « En attente », « Pas de devoir »). En
  tête : la prochaine séance et « Assigner le devoir » (feuille : séance
  réelle et date en jeu proposées d'office, « Qui l'écrit »). Une entrée —
  ou un devoir en attente, avec « Relancer » et « Annuler le devoir » —
  s'ouvre en lecture dans la colonne de droite.
- **Tablette** : registre réduit (date · titre · état), lecture en panneau
  par-dessus. **Téléphone du MJ** : Outils › Livre de sessions, prochaine
  séance puis registre en liste, entrée en plein écran.
- **Joueuse** (page pleine et téléphone) : le bandeau du devoir, puis le
  Livre en **premier chapitre du sommaire** de son wiki.
- **Ajouts** : (1) « à qui le tour » — la feuille propose la personne qui
  n'a pas écrit depuis le plus longtemps (ou jamais) ; (2) « Relancer » —
  un rappel posé dans le fil privé du chat de l'autrice (V3.1-22),
  journalisé ; tant que 22 n'est pas livré, le bouton n'apparaît pas ;
  (3) le Livre en chapitre de tête du sommaire du wiki de la joueuse.

**Critères d'acceptation**
- [x] Assigner, annuler un devoir ; chaque geste journalisé une fois (`sessionJournalGestes.test.ts`). « Relancer » : absent tant que V3.1-22 n'est pas livré, comme décidé.
- [x] « À qui le tour » : test du choix (jamais écrit > plus ancien > égalité par nom).
- [x] La joueuse voit le Livre en tête de son sommaire, jamais une entrée réservée au MJ.

**Livré le 19 octobre.** Opus : `nextWriter` (src/core/sessionJournal,
6 tests) ; assigner et annuler écrits une fois au journal de la campagne
(événement `system` du MJ dans `session_events`), annuler ne journalise
rien si aucun devoir n'a été effacé (`deleteAssignment` rend la ligne) ;
**faille corrigée** : le groupe épinglé du Livre échappait au filtre de
visibilité de la joueuse, le titre d'une entrée réservée au MJ lui
apparaissait (test d'intégration, rouge sur l'ancien code) ; la route des
devoirs renvoie les séances réelles et, par devoir, le nom et le slug de
l'entrée rédigée ; `campaignId`/`assignmentId` validés par Zod ; le roster
porte le rôle, et « à qui le tour » ne propose d'office qu'une joueuse.
Sonnet : registre, lecture, feuille « Assigner le devoir », tablette et
téléphone, bandeau au verre ; logique pure `lib/ui/livreDeSessions.ts`
(12 tests, jour local de création vérifié en trois fuseaux). Vérifié en
navigateur (Testeur MJ) : registre à 1280, 820 et 390 px, feuille avec la
suggestion d'une joueuse. Puis, à la demande de l'auteur, le parcours
complet : le MJ assigne un devoir à Testeuse A et un à Testeur B (201,
deux « En attente »), annule celui de B (confirmation, 204) ; Testeuse A
voit le bandeau, rédige « Essai du Livre (test) » (201), le bandeau
disparaît et le Livre ouvre son sommaire avec l'entrée ; le MJ retrouve
l'entrée, « Ouvrir la fiche » mène à sa page, et la suggestion passe à
Testeur B. Chaque geste s'écrit une fois au journal ; il s'y affichait
« Système » seul : le fait passe maintenant par `note`, et le journal dit
« Système — Livre de sessions : devoir assigné à PJ de Testeur B ».
Nettoyage : devoir et entrée de test retirés (l'entrée est dans la
corbeille), aucun devoir restant. Constat hors ticket (tâche proposée) :
l'éditeur d'une entrée du Livre affiche le type brut « session_journal ».
Planche OutilsMJ : section « Livre de sessions ».

---

### ☑ V3.1-45 — Générateurs : les tirages à gauche, la fiche à droite · `M` · **avec modèle IA** — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; tables et IA inchangées.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Generateurs-Decide.dc.html`. **Départ** :
`components/shell/GeneratorToolPanel.tsx`, cas `generateurs`. **Dépend de** :
20, 25 (pilule), 29.

**Ce qui est décidé**
- **En haut** : la pilule des outils (Taverne, Échoppe, PNJ…) et les
  variantes **en puces** (dont « Aléatoire ») — elles remplacent les listes
  déroulantes.
- **À gauche, les tirages** : chaque section et ses emplacements (dé,
  résultat, ↻ par emplacement, ↻ par section). « Éditer les tables » prend
  la place des tirages dans cette colonne (retour par ×).
- **À droite, l'aperçu de la fiche assemblée** : chaque morceau tiré est
  souligné en pointillé et se relance d'un toucher (↻) ; la prose écrite
  par l'IA est marquée « IA », longueur 40 / 80 / 120 mots ; menu de taverne
  en deux colonnes (plats par palier, boissons) ; « Tout relancer » ;
  « Copier le texte » ; « Créer la fiche » promeut le résultat en entité
  visible du MJ seul.
- **Tablette** : l'aperçu d'abord, les tirages dessous. **Téléphone** :
  pilule des outils, variantes et « Les tirages » en feuilles du bas,
  aperçu (↻ par morceau, menu en une colonne), « Créer la fiche ».
- **Inchangé** : les tables restent des fiches de règles pondérées du
  ruleset ; la prose de l'IA reste de la donnée, revue avant création
  (règle 10), passée par `src/server/ai/` ; aucun tirage côté client (le
  serveur tire).

**Critères d'acceptation**
- [x] Relancer un emplacement ne relance que lui (test existant du service : `generators.integration.test.ts`, « onlySlotKey : ne tire que l'emplacement désigné » ; en direct, le corps envoie la seule clé visée).
- [x] « Créer la fiche » crée une entité visible du MJ seul (test `lib/generators/promoteVisibility.test.ts` ; la route créait des blocs publics, corrigé).
- [x] Les variantes n'utilisent plus aucune liste déroulante.

**Livré le 19 octobre.** Opus : « Créer la fiche » naît en visibilité `gm`
(elle naissait publique : un PNJ ou une taverne inventés apparaissaient aux
joueurs). Sonnet : `GeneratorToolPanel.tsx` découpé dans
`components/shell/generateurs/` (état unique `useTirages`, colonne des
tirages, aperçu, menu de taverne, édition des tables en colonne, puces de
variantes) ; logique pure `lib/ui/generateurs.ts` (12 tests). Vérifié en
navigateur (Testeur MJ) : pilule des outils, puces, aucune liste
déroulante ; « Tout relancer » = une requête par section, une après
l'autre ; relancer un emplacement n'envoie que sa clé, les autres ne
bougent pas ; édition des tables ouverte et refermée par × ; au téléphone,
feuilles « Variantes » et « Les tirages » (Échap), pilule qui défile.
Limites : les sections du banc d'essai n'ont aucune table (le serveur rend
`slots: []`), donc ni contenu réel ni prose « IA » vus en direct ;
« Créer la fiche » non cliqué (la fiche resterait en base). Longueurs de
prose gardées à 30 / 100 / 250 mots (`PROSE_LENGTH_PRESETS`, aussi lues
par le schéma des blocs générateurs) au lieu des 40 / 80 / 120 de la
planche : à trancher par l'auteur. Planche OutilsMJ : section
« Générateurs ».

---

### ☑ V3.1-44 — Rencontres : l'atelier en trois colonnes · `M` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; budget et solveur inchangés.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Rencontres-Decide.dc.html`. **Départ** :
`components/shell/EncounterBuilder.tsx`, cas `rencontres` de
`MjToolWindowContent.tsx` et de la route
`app/api/worlds/[worldSlug]/mj/[tool]/window/route.ts`. **Dépend de** : 20, 29.

**Ce qui est décidé**
- **Ordinateur, trois colonnes** : à gauche le groupe (PJ de la campagne
  avec leurs vrais niveaux ; un absent se décoche et le budget suit), la
  difficulté visée, « Mes rencontres » (une rencontre sauvegardée se
  rouvre) ; au centre le catalogue du ruleset (recherche, filtres par type) ;
  à droite la barre de budget (les trois paliers 2024 et la difficulté
  visée), la rencontre en cours (± nombre, ×), « Génération aléatoire »,
  « Sauvegarder », « Lancer le combat » (vers l'Initiative).
- **Tablette** : les colonnes s'empilent. **Téléphone du MJ** : le groupe en
  pastilles (prénom · niveau ; toucher un absent le retire, le budget
  suit), la difficulté et la barre, la rencontre en cours, le catalogue en
  feuille du bas, « Lancer le combat ».
- **Inchangé** : le budget est une donnée du ruleset (`encounter_budget`),
  le solveur reste celui du code, la table `campaign_encounters` reste.
- Jauge : pendant un combat, la « menace restante » remplace le budget
  (décidé avec l'Initiative, V3.1-38) — ce ticket n'affiche que le budget.

**Critères d'acceptation**
- [x] Décocher un PJ change le budget (même calcul que le serveur, aucun calcul de règle côté client : le budget vient de la réponse).
- [x] Sauvegarder, rouvrir, lancer le combat : la rencontre arrive dans l'Initiative (lancement vérifié en direct ; sauvegarde et réouverture non exercées en direct : une rencontre sauvegardée ne s'efface pas, elle resterait en base).
- [x] Le catalogue cherche dans le ruleset actif, sans requête par monstre.

**Livré le 19 octobre.** Serveur (Opus) : `memberBudgetShares` dans
`src/core/rules/encounter.ts` (la ligne d'un niveau ; la somme des parts
redonne `encounterBudget`, testé) ; `src/server/services/encounterWorkshop.ts`
(`listEncounterParty` : PJ, niveau total des classes, trois lectures
groupées ; `withBudgetShares` ; `chargerAtelierRencontres`, chargeur commun
de la page et de la fenêtre) ; la génération accepte `partyLevels` (Zod,
1 à 20 niveaux de 1 à 20), l'ancien corps reste valide. Écran (Sonnet,
retouché par Opus) : trois colonnes par requête de conteneur, empilées en
fenêtre étroite, téléphone sous 28rem (pastilles, catalogue en feuille du
bas) ; budget = somme des parts des présents, sans règle côté client ;
repli « groupe hypothétique » si la campagne n'a aucun PJ ; types de
créatures regroupés par base et traduits (`typeDeBase`,
`CREATURE_TYPE_LABELS_FR`). Vérifié en navigateur (Testeur MJ) : deux PJ de
niveau 1 → 100 / 150 / 200 PX, un absent → 50 / 75 / 100 ; génération avec
`partyLevels: [1, 1]` ; lancement → Initiative (combat de test effacé) ;
tablette en colonnes empilées ; téléphone en pastilles, feuille du bas
(recherche, ajout, Échap).

---

### ☑ V3.1-56 — Calendrier réel au verre minéral, côté MJ et côté joueuse · `M` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — disposition déjà codée (V3.1-16) ; transposition seulement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Calendrier-Reel.dc.html`. **Départ** :
`components/shell/scheduling/*` (`SchedulingMjPanel.tsx`,
`NextSessionPanel.tsx`, `AvailabilityGrid.tsx`),
`app/m/[worldSlug]/joueur/prochaine-session/page.tsx`. **Dépend de** : 20,
27, 29.

**Ce qui est décidé** : la disposition de V3.1-16 **ne change pas**
(grille à bascule « Mes disponibilités / Toute la table », géométrie, ligne
« 22:00 », colonne des heures fixe, croix au survol, info-bulle « (toi) »
en tête, dates possibles classées par nombre puis par durée,
enregistrement automatique de la joueuse). Le verre minéral :
- **MJ** : fenêtre à volets ; en-tête — titre, « Créneau proposé · N jours ·
  X réponses sur Y », **durée visée en − / +**, « Annuler la demande » en
  danger fantôme ; la grille et les dates possibles dans des panneaux en
  verre ; « Confirmer » **plein** pour une session complète, contour accent
  sinon ; trois cartes (« Régler une date à la main », « Séances à venir »
  avec « Annuler », « Déjà jouées »). Tablette : les cartes l'une sous
  l'autre. Téléphone (Outils › Calendrier réel) : la même colonne, la
  grille défile à l'horizontale.
- **Joueuse** : page pleine « Prochaine séance » dans sa coquille, sans aucun
  outil MJ — la prochaine séance en grand (pavé de date), la demande ouverte
  et sa grille (« Toute la table » comprise), « Les dates qui se
  dessinent » en lecture seule (« c'est le MJ qui choisit »), « Séances à
  venir » et « Déjà jouées ». Ligne d'état « Enregistrement… » puis
  « Enregistré ✓ ».

**Critères d'acceptation**
- [x] Tests de V3.1-16 verts, sans modification.
- [x] Aucun outil MJ dans la page de la joueuse (test de rendu).
- [x] La grille défile à l'horizontale au téléphone, la colonne des heures reste visible (code de V3.1-16 inchangé : `overflow-x-auto`, colonne `sticky left-0` à fond opaque ; non revérifié en direct, aucune demande ouverte dans le banc d'essai).

**Livré le 19 octobre.** Panneaux et cartes en verre (coins 18 px, flou
`--blur`). MJ : durée visée en − / + (pas de 30 min, de 1 h à 14 h), un
seul `PATCH …/scheduling/settings` 500 ms après le dernier clic ;
« Annuler la demande » et « Annuler » d'une séance en danger fantôme ;
« Confirmer » plein si `category === "full"` (créneau ≥ durée visée),
contour accent sinon ; cartes et séances empilées par requête de conteneur.
Joueuse : page « Prochaine séance », pavé de date agrandi. Test de rendu
`lib/ui/prochaineSeance.test.ts` (aucun outil MJ, avec une demande ouverte,
un jour complet et des séances ; d'abord posé sous `components/`, où Vitest
ne cherche pas, et déplacé le 19 octobre avec V3.1-45 : il ne tournait pas). Vérifié en navigateur sans demande ouverte :
MJ à 1280, 820 et 390 px, quatre clics − / + = une requête, durée inchangée
(5 h) ; Testeuse A à 1280 et 390 px, aucun outil MJ. Non exercé en direct :
la grille et l'en-tête d'une demande ouverte (en ouvrir une laisserait une
demande fermée en base). Planche OutilsMJ : section « Calendrier réel ».

---

### ☑ V3.1-143 — Journal : « supprimée … par X », et les fiches supprimées dans la fenêtre d'outil · `S` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Opus** — une migration (une colonne et un déclencheur) ; l'affichage est court.

**Demande de l'auteur (19 octobre)**, après V3.1-61 : la planche
`Journal-Decide.dc.html` dit « supprimée le 6 oct. par Gabriel », mais la
base ne garde pas l'auteur d'une suppression ; et la fenêtre d'outil du
journal (`MjToolWindowContent`, cas `journal-historique`) ne montre pas les
fiches supprimées, que la page montre.

**Ce qui est décidé**
- **Migration** : `entities.deleted_by uuid null references auth.users(id) on delete set null` (à la livraison, `auth.users` comme `created_by` plutôt que `profiles` : une suppression ne doit jamais échouer faute de ligne de profil). Rempli par la BASE, pas par l'application : un déclencheur `before update` met `deleted_by = auth.uid()` quand `deleted_at` passe de `null` à une date, et `deleted_by = null` quand la fiche est rétablie (`deleted_at` revient à `null`). Aucun chemin de suppression ne peut l'oublier, et un client ne peut pas l'écrire à la main (le déclencheur l'écrase). RLS inchangée ; `docs/SCHEMA.md` mis à jour. Les suppressions d'avant la migration restent sans auteur.
- **Lecture** : la liste des fiches supprimées (`/api/worlds/[worldSlug]/deleted-entities`) renvoie aussi le nom de l'auteur (`getDisplayNamesForUsers`, une lecture groupée, jamais une par fiche) ; « supprimée le 6 oct. par Gabriel », ou sans « par … » quand l'auteur est inconnu.
- **Fenêtre d'outil** : le cas `journal-historique` de `MjToolWindowContent` monte aussi `DeletedEntitiesPanel` (même disposition que la page : dessous sous 1024 px, à droite au-delà). « Rétablir » y passe par la même action serveur (`restoreEntityAction`).

**Critères d'acceptation**
- [x] Supprimer une fiche puis lire la corbeille : « supprimée le … par » le compte qui l'a supprimée (test d'intégration avec les comptes de test, `docs/TESTS.md`).
- [x] Rétablir efface l'auteur ; une écriture directe de `deleted_by` par un client est écrasée par le déclencheur.
- [x] La fenêtre d'outil du journal montre les fiches supprimées, et « Rétablir » y fonctionne sans rechargement.

**Livré le 19 octobre.** Migration `20261019090000_entities_deleted_by`
(colonne, déclencheur `stamp_entities_deleted_by`, `list_deleted_entities`
recréée avec `deleted_by`), appliquée par l'auteur. Le service lit les noms
des auteurs en une fois (`getDisplayNamesForUsers`). La page et la fenêtre
d'outil partagent `journal/JournalEtCorbeille.tsx`, qui bascule sur la
largeur du conteneur (64rem) et non plus de l'écran. Tests d'intégration
`entitiesDeletedBy.integration.test.ts` (4 cas : écriture directe écrasée
sur une fiche vivante comme supprimée, auteur posé et nommé, effacé au
rétablissement). Vérifié en navigateur en Testeur MJ : « Essai Naissance »
rétablie depuis la fenêtre d'outil sans rechargement, supprimée de nouveau,
puis « supprimée le 19 oct. par Testeur MJ » ; elle reste dans la corbeille,
comme avant, désormais avec un auteur.

---

### ☑ V3.1-54 — Gestion de campagne au verre minéral, avec « Voir comme » · `S` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — disposition déjà codée (V3.1-15) ; transposition seulement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Campagne-Gestion.dc.html`. **Départ** :
`components/shell/CampaignsPanel.tsx`, `components/shell/CampaignDetail.tsx`,
`InviteLinkPanel.tsx`. **Dépend de** : 20, 29 ; l'entrée « Voir comme »
dépend de **V3.1-12** (autorisation et garde-fous).

**Ce qui est décidé** : la disposition de V3.1-15 (piste A) **ne change
pas** — invitations en haut, « À la table » avec les MJ sur une ligne, une
carte par compte joueur, les PNJ sans joueur en bas. Le verre minéral :
panneaux en verre (coins 18 px), carte en verre sombre avec le PJ en ambre,
menus ⋮ et confirmations en **surfaces flottantes** (elles nomment
`Nom#0000`), boutons de la charte. Tablette : deux cartes par rangée.
Téléphone : cartes l'une sous l'autre, ligne de lien réduite au rôle,
Copier et ⋮.
- **« Voir comme Inès#4821 »** en tête du menu ⋮ de chaque carte, avant
  « Forcer une réinitialisation » et « Retirer de la campagne ». Tant que
  V3.1-12 n'est pas livré, l'entrée n'apparaît pas.

**Critères d'acceptation**
- [x] Les gestes existants inchangés (tests de V3.1-15 verts).
- [x] Menus et confirmations en surfaces flottantes, au clavier (Échap ferme).
- [x] « Voir comme » visible seulement si V3.1-12 l'autorise côté serveur.

**Livré le 19 octobre.** Panneau de campagne, invitations, cartes joueurs
et « Personnages sans joueur » en verre (coins 18 px, flou `--blur`) ;
grille d'une, deux puis trois cartes (téléphone, `md`, `xl`). Menu ⋮
(`ActionsMenu`, coins 14 px) et `ConfirmDialog` (coins 18 px) en surfaces
flottantes en verre ; Échap ferme le menu **et rend le focus au bouton ⋮**
(le menu vit en portail). Au téléphone, la sous-ligne d'un lien
d'invitation est masquée (`hidden sm:block`) : la ligne se réduit au rôle,
Copier et ⋮. « Voir comme » était déjà en tête du menu (V3.1-12) ; le
serveur l'autorise au MJ de la campagne sur un compte « tag » membre,
l'entrée reste donc. Vérifié en navigateur à 1280, 820 et 390 px (3, 2, 1
colonnes), Échap et focus, et l'aller-retour « Voir comme » sur Testeuse A.
Non exercé : la ligne réduite d'un lien, aucune invitation n'existant dans
le banc d'essai. Planches Navigation (menu ⋮) et Surfaces (confirmation)
mises à jour.

---

### ☑ V3.1-61 — Journal historique : par fiche, ou chronologique · `M` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; un champ de plus côté serveur.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Journal-Decide.dc.html`. **Départ** :
`components/shell/GmJournalPanel.tsx`, `DeletedEntitiesPanel.tsx`,
`src/server/services/activityJournal.ts`,
`app/m/[worldSlug]/mj/journal-historique/page.tsx`, cas
`journal-historique`. **Dépend de** : 20, 29.

**Demande de l'auteur (8 octobre)** : chercher par personne, trier,
filtrer par objet modifié ou par élément (wiki, fiche de personnage…).

**Ce qui est décidé**
- **Serveur** : `JournalEntry` gagne `entityKind` (le type de la fiche,
  déjà connu du serveur, lu dans la même requête — pas de requête par
  ligne) et le nom du bloc modifié reste `blockLabel`. Accès réservé au MJ,
  inchangé.
- **Bascule en tête** (pilule) :
  - « **Par fiche** » : une carte par objet modifié — nom (lien entité,
    toucher = ne montrer que cette fiche), type en pastille, « n
    modifications » ; dedans, une ligne par changement : quand (« 8 oct.
    10:42 »), qui, et « partie modifiée — détail » (le détail d'inventaire
    existant, ligne par ligne). Les événements de jeu sans fiche se
    regroupent dans « Sans fiche (jeu) ».
  - « **Chronologique** » : la liste groupée selon le tri — plus récent
    (par jour : « Aujourd'hui · mercredi 8 octobre »), plus ancien, par
    personne, par fiche ; chaque ligne : heure, avatar (initiale ; ✦ pour
    « IA / système »), « Inès a modifié Inventaire de Sakaburin », type en
    pastille, première ligne du détail et « révision #14 », pastille
    « wiki » / « jeu » ; toucher la ligne **déplie** le détail complet.
- **Filtres communs** : la recherche (« Chercher une personne, une fiche, un
  mot… » — dans la personne, la fiche, la partie modifiée, le détail,
  l'élément) ; « Qui » en puces (chaque personne avec son nombre, « IA /
  système » compris) ; « Élément » en puces (Fiches de personnage, PNJ,
  Lieux, Factions, Objets, Pages, Jeu (jets, actions, narration)) avec
  leur nombre — **les nombres suivent les autres filtres** ; les filtres
  actifs en étiquettes (× par étiquette, « Tout effacer ») et « n
  modifications sur N ».
- Filtres et tri **côté client**, sur les entrées déjà reçues (pas de
  requête par filtre).
- **Fiches supprimées** à droite (texte « … · PNJ · supprimée le 6 oct. par
  Gabriel », « Rétablir »). Rétablir met à jour l'arborescence **sans
  `window.location.reload()`** (règle commune 6).
- **Tablette** : une colonne, les fiches supprimées en bas. **Téléphone** :
  la bascule et la recherche en tête, « Filtres » (avec le nombre de
  filtres actifs) ouvre une **feuille du bas** — tri, Qui, Élément, Partie
  modifiée (cases à cocher avec nombres), « Voir n résultats » ; les cartes
  l'une sous l'autre.

**Critères d'acceptation**
- [x] `entityKind` renvoyé sans requête supplémentaire par ligne (test du service).
- [x] « Inès » + « Fiches de personnage » : seules ses modifications de fiches de PJ ; les nombres des autres puces suivent.
- [x] Toucher « Sakaburin » ne montre que cette fiche ; l'étiquette se retire d'un ×.
- [x] Rétablir une fiche : elle revient dans l'arborescence, sans rechargement de la page.

**Clôture (19 octobre).**
- Serveur (Opus) : `JournalEntry` gagne `entityKind` (lu dans la même requête que le nom de la fiche), `pc` (les PJ de la campagne lus une fois pour tout le journal) et `revisionNumber` ; test du service (une lecture des PJ, une des fiches d'événements, jamais par ligne). « Rétablir » devient une action serveur (`restoreEntityAction`, Zod, droit vérifié par `restoreDeletedEntity`) qui revalide la mise en page du monde : plus de `window.location.reload()`, aucun `router.refresh()` ajouté (C5).
- Interface (Sonnet) : `GmJournalPanel`, `components/shell/journal/`, `DeletedEntitiesPanel` ; logique pure testée (`lib/ui/journalHistorique.ts` : éléments, filtres, comptes qui suivent les autres filtres, regroupements). Correction d'Opus : une révision qui touche plusieurs parties (« Personnage, Inventaire ») comptait comme une partie à part ; chaque partie a maintenant sa case (tests).
- Vérifié au navigateur en Testeur MJ (Banc d'essai) : « Testeur MJ » + « Fiches de personnage » → 20 modifications sur 73, la puce « Fiches de personnage » passe de 42 à 20 ; toucher « PJ de Testeuse A » ne garde qu'elle (24 sur 74) et l'étiquette se retire d'un × ; bascule et quatre tris ; « Rétablir » sans aucun rechargement, la fiche est dans l'arborescence au passage suivant sur le wiki ; feuille « Filtres » au téléphone, aucun débordement. La fiche rétablie pour l'essai a été remise à la corbeille (sa date de suppression est maintenant le 19 octobre).
- Restes : « supprimée … par X » n'est pas affiché, la base ne garde pas l'auteur d'une suppression (une migration, à décider) ; la fenêtre d'outil du journal ne montre pas les fiches supprimées (inchangé) ; « IA / système » n'est pas traduit (il vient du serveur).

---

### ☑ V3.1-55 — Calendrier ingame : l'année d'un coup d'œil · `M` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Calendrier-Decide.dc.html`. **Départ** :
`components/shell/CalendarSettingsPanel.tsx`, `src/core/calendar/*`
(`weekday.ts`, `formatDate.ts`), cas `calendrier`. **Dépend de** : 20, 29.

**Ce qui est décidé**
- **En haut, la frise des ères** : une bande, chaque ère de largeur
  proportionnelle à sa durée (la dernière court jusqu'à « an actuel +
  300 »), le jour actuel marqué d'un trait accent et de son année. Toucher
  une ère ouvre le réglage des ères.
- **À côté, le jour actuel** : son jour de la semaine, la date, son ère et
  « an N de l'ère », « jour 44 sur 360 ». Pas : « ‹ Veille »,
  « Lendemain › », « + une semaine » (libellé « + une décade » pour une
  semaine de 10 jours, sinon « + N jours ») ; « Changer la date » ouvre
  jour, mois (‹ ›) et an.
- **Dessous, les douze mois en vignettes** (nom, durée, mini-grille, le
  jour actuel allumé ; le mois actuel bordé d'accent). **La semaine en
  puces** : › décale d'un rang, × supprime, « + jour » ; « Le 1er jour de
  l'an 0 était un ‹ Primidi › ».
- **Réglage contextuel à droite** : toucher un mois ouvre nom, durée en − /
  + (1 à 60), position ↑ ↓, la grille du mois (‹ › pour changer de mois),
  « + Ajouter un mois après », « Supprimer ce mois » ; toucher un jour de
  la grille le sélectionne (« samedi 30 Brumaire 1492 — dans 6 jours ») et
  propose « En faire aujourd'hui ». Toucher une ère ouvre la liste des ères
  (nom, « dès l'an », ×, « + Ajouter une ère »).
- **Raccourcir un mois recale le jour actuel** sur le dernier jour du mois.
- **Rien n'est enregistré avant « Enregistrer »** (le calendrier est
  remplacé en entier, comme aujourd'hui) ; la barre du bas dit
  « Modifications non enregistrées » ou « Tout est enregistré ».
- **Tablette** : la frise puis le jour actuel l'un sous l'autre, trois
  vignettes par rangée, le réglage sous l'année. **Téléphone** : le jour
  actuel, la frise, trois vignettes par rangée, la semaine ; un mois ou une
  ère touché s'ouvre en **feuille du bas** ; « Enregistrer » en haut.
- Calculs (jour de la semaine, jour de l'année, décalage de N jours) dans
  `src/core/calendar`, **tests d'abord** ; le composant n'en fait aucun.

**Critères d'acceptation**
- [x] Tests du noyau : lendemain du dernier jour de l'an, veille du 1er jour de l'an 0 (année négative), décalage de 10 jours sur deux mois.
- [x] Raccourcir Brumaire à 10 jours quand on est le 14 : le jour actuel devient le 10.
- [x] Changer le 1er jour de l'an 0 décale toutes les vignettes.
- [x] Rien n'est écrit avant « Enregistrer » (test : aucune requête).

**Clôture (18 octobre).**
- Noyau (Opus, tests d'abord) : `src/core/calendar/navigation.ts` — `shiftDate`, `daysBetween`, `dayOfYearNumber`, `clampDayToCalendar`, `yearInEra`, `eraBand`, `monthGrid`. Les trois cas du ticket sont testés (lendemain du dernier jour de l'an, veille du 1er de l'an 0, dix jours sur deux mois), et le décalage des grilles par le 1er jour de l'an 0.
- Interface (Sonnet) : `CalendarSettingsPanel.tsx` et `components/shell/calendrier/` ; un réducteur pur testé (`lib/ui/calendrierEdition.ts`), une seule requête, celle d'« Enregistrer ». Corrections d'Opus : le jour actuel suit SON mois quand on déplace, ajoute ou supprime un mois (le 14 Brumaire restait le 14 du mois qui prenait sa place), et le jour du 1er de l'an 0 suit son jour de semaine quand on décale ou supprime un jour (tests ajoutés).
- Vérifié au navigateur en Testeur MJ (Banc d'essai) : régler le jour actuel, Lendemain, « + une décade » → « jour 12 sur 360 » ; choisir le 14 Brumaire dans la grille (« dans 43 jours »), « En faire aujourd'hui », raccourcir Brumaire à 10 jours → le 10 ; changer le 1er jour de l'an 0 décale la vignette ; **aucune requête avant « Enregistrer », une seule après** ; l'enregistrement tient après rechargement ; feuille du bas au téléphone ; aucun débordement à 820 et 390 px. Le calendrier du Banc d'essai a été remis à l'identique ensuite.
- Le 19 octobre, à la demande de l'auteur : « Ne plus régler le jour actuel » rend le jour actuel « non réglé » (action `jourEffacer`, testée), comme la case de l'ancien panneau.
- Restes : un nom vide grise « Enregistrer » (le schéma le refuse) ; saisir un an négatif passe par le clavier.

---

### ☑ V3.1-46 — Probabilités : la matrice, caractéristiques et compétences · `M` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet** — calcul pur à étendre, tests d'abord ; planche définitive.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Probabilites-Decide.dc.html`. **Départ** :
`src/core/rules/probability.ts` (+ `probability.test.ts`),
`components/shell/PartyProbabilityTable.tsx`, cas `probabilites`.
**Dépend de** : 20, 29.

**Ce qui est décidé**
- **Noyau, tests d'abord** : `probability.ts` gagne les **jets de
  caractéristique** (Force, Dextérité, Constitution, Intelligence, Sagesse,
  Charisme) — même formule que les compétences, touche-à-tout compris,
  avantage / désavantage de la fiche compris. Rien en base (règle 16).
- **Ordinateur** : une seule grille ; les PJ de la campagne en colonnes ;
  en lignes **les six caractéristiques**, puis les dix-huit compétences.
  Le pourcentage au DD choisi (5 à 30, pas à pas ou puces 10 / 15 / 20 /
  25). Le meilleur de chaque ligne est encadré ; une case touchée explique
  son calcul (caractéristique, maîtrise ou expertise, touche-à-tout,
  avantage ou désavantage). Campagne en sélecteur compact.
- **Couleurs** : un **spectre continu** du rouge (peu de chances) au vert
  (presque sûr), fond et chiffre teintés selon le pourcentage — pas trois
  paliers. Interpolation dans l'espace OKLCH entre deux jetons de la charte
  (`--danger` et `--success`), contraste du chiffre vérifié dans les quatre
  modes.
- **Tablette** : la même grille, qui défile. **Téléphone** : le DD (pas à pas
  et puces), le détail de la case touchée, la grille compacte (noms
  abrégés, sans la colonne de caractéristique).
- Libellé : Insight = **Intuition** (`src/i18n/fr.ts`).

**Critères d'acceptation**
- [x] Tests du noyau : jet de Force sans maîtrise avec touche-à-tout ; avec avantage ; DD 5 et DD 30 aux bornes.
- [x] La grille montre 6 + 18 lignes, le meilleur de chaque ligne encadré.
- [x] Teinte continue : 50 % et 51 % ont deux teintes différentes ; contraste AA du chiffre dans les quatre modes.

**Clôture (18 octobre).**
- **Découverte** : le moteur de fiche ignorait le Touche-à-tout et n'avait pas de jet de caractéristique à part. Décision d'Opus, dans le sens du ticket (« touche-à-tout compris ») : un effet de règle `half_proficiency` (cible `check` ou `check.<car>`, la moitié de la maîtrise arrondie vers le bas sur un jet sans maîtrise), un résultat `abilityChecks` dans `characterSheet()`, une compétence qui lit aussi l'avantage de sa caractéristique (`check.<car>`), et l'encombrement qui pénalise aussi les jets de caractéristique. Tests d'abord (`sheet.test.ts`, `probability.test.ts`). Les jets réels (outil de dés, solo) lisent `abilityChecks` : le tableau et le dé disent le même chiffre. Deux endroits qui comptaient « tout sauf `none` » comme une maîtrise corrigés (résumé des compétences, choix déjà accordés).
- Donnée : `bard-jack-of-all-trades` dans `data/srd/modifiers-2024.json` (testé) ; SRD réimporté le 18 octobre (1 905 fiches, 0 échec, aucune fiche retirée), les trois scripts d'après import rejoués, bloc vérifié en base.
- Calcul : `checkLines` (6 + 18 lignes, sources pour le détail), `bestIndices` (une ligne toute à égalité n'est pas encadrée), DD 5 à 30. Service `getPartyCheckLines`, PJ résolus ensemble (C3).
- Teinte (Opus) : `lib/ui/teinteProbabilite.ts`, interpolation OKLCH entre `--danger` et `--success`, mêlée au panneau et à l'encre **en OKLab** (en OKLCH, le rouge tournait au violet sur un fond de monde violacé) ; test de contraste AA calculé d'après `tokens.css` dans les quatre modes et sur trois teintes de fond.
- Interface (Sonnet) : `PartyProbabilityTable.tsx` (page et fenêtre), DD réglable, détail de la case, légende. Corrections d'Opus : noms de colonne courts mais distincts (`nomsCourts` : « PJ Testeuse A » et « PJ Testeur B » donnaient deux « PJ »), teinte plus franche (45 % / 20 %), encadrement sans égalité, en-tête de colonne accessible.
- Vérifié au navigateur en Testeur MJ (Banc d'essai, 2 PJ) à 1280, 820 et 390 px : 24 lignes, aucun débordement de page, Force 35 % → 10 % de DD 15 à 20, détail « Testeur · Force · DD 20 : 10 % · Force +1 », DD borné à 5.
- Restes : le Touche-à-tout ne vaut que pour le SRD 2024 (comme la Ténacité naine) ; l'initiative ne le compte pas encore (en 2024, c'est un jet de Dextérité) ; aucun barde au Banc d'essai, le Touche-à-tout n'a été vu qu'en test.

---

### ☑ V3.1-88 — Administration › Identité de l'application · `S` · sans modèle IA — **fait le 18 octobre**

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
- [x] L'aperçu suit la saisie sans enregistrer.
- [~] Enregistrer change l'écran-titre et la tête du rail pour tous.
- [~] Rétablir revient au nom, à la phrase et au d20 par défaut.

**Clôture (18 octobre).**
- Serveur : rien de neuf, l'action et ses contrôles viennent de V3.1-84 (`updateAppIdentityAction`, `resetAppIdentityAction`, `updateTag`). La page `/admin` transmet en plus la phrase d'accueil.
- Interface (Sonnet) : `PanneauIdentite.tsx`, règle d'envoi du logo en fonction pure testée (`lib/ui/identiteApp.ts` : téléverser, retirer ou garder), champs réalignés sur l'identité enregistrée sans effet de synchronisation, aperçu du fichier révoqué. Corrections d'Opus : la grille appelle `LogoApp` au lieu d'en recopier le balisage ; le champ fichier n'a de nom que pendant un vrai téléversement (un fichier abandonné pour un dessin ne part plus avec le formulaire).
- Vérifié au navigateur sur une page d'essai locale (jamais commitée) à 1280 et 390 px : douze dessins plus « Téléverser » (7 puis 4 par rangée), l'aperçu suit nom, phrase et logo sans aucune requête, `logoAction` reste `keep` sur un dessin, le dialogue de Rétablir s'ouvre et s'annule. Aucun débordement.
- Restes : Enregistrer et Rétablir n'ont pas été exécutés. Aucun compte de test n'est superadmin, et le faire changerait l'identité de l'application pour tous les visiteurs. **À vérifier par l'auteur** : un enregistrement (l'écran-titre et la tête du rail changent), un téléversement PNG ou WebP et un refus, le passage d'un logo téléversé à un dessin, Rétablir.

---

### ☑ V3.1-87 — Administration (B) : le tableau de bord · `M` · sans modèle IA — **fait le 18 octobre**

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
- [~] Chaque geste d'`AdminPanel` est présent et fonctionne.
- [x] Un compte non superadmin reçoit une 404 sur la page (pas un écran vide).
- [x] Les compteurs des tuiles suivent les gestes sans rechargement.

**Clôture (18 octobre).**
- Décision d'Opus : Administration est une **route**, `/admin`, et non plus une destination locale de l'accueil. La 404 du critère n'existe que pour une page qui a une adresse. La coquille de l'accueil l'habille (`HomeShell page="admin"`) : ses lignes Mondes et Compte y mènent à `/` et `/?vue=compte`. La section Admin de l'accueil a disparu.
- Serveur (Opus) : la page vérifie `isSuperadmin` avant tout rendu, puis lit comptes, liens, identité et nombre de titres ensemble, avec elle (C1, C3) ; `countPlayerTitleTiers` compte sans lire de ligne. **Changement de sens** : forcer une réinitialisation efface la demande en attente (`accountAuth.forcePasswordReset`), chez le MJ comme ici ; le compte passe de « à traiter » à « doit changer son mot de passe ». Sans cela, la ligne restait à traiter après le geste. `SCHEMA.md` le dit.
- Interface (Sonnet) : `PageAdministration.tsx`, logique pure `lib/ui/administration.ts` (testée) ; les gestes d'`AdminPanel` repris avec les mêmes requêtes et les mêmes confirmations ; `AdminPanel.tsx` supprimé, cliquet du câblage 59 → 58. Correction d'Opus : le calcul « il y a … », écrit deux fois, en un seul hook.
- Vérifié au navigateur : `/admin` répond 404 à Testeur MJ et Testeuse A, et leur rail n'a pas d'Administration ; `/?vue=compte` ouvre le Compte. Mise en page, recherche, menu ⋮ et tuile d'ouverture vérifiés à 1280, 820 et 390 px sur une page d'essai locale (données fictives, jamais commitée), aucun débordement.
- Restes : aucun compte de test n'est superadmin. Les gestes eux-mêmes (forcer, transférer, supprimer, révoquer, mot de passe, voir comme) et les compteurs après un vrai geste sont **à vérifier par l'auteur**, avec son compte. La mention « compte sans email » de la planche manque : `AdminAccountRow` ne porte pas cette donnée. Les panneaux Identité et Titres arrivent avec V3.1-88 et V3.1-92.

---

### ☑ V3.1-83 — Choix : PJ sans fiche et « Créer mon personnage » · `S` · sans modèle IA — **fait le 18 octobre**

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
- [x] Réclamer un PJ sans fiche ouvre l'assistant avec son nom pré-rempli.
- [x] Créer un personnage de zéro le rend réclamé par la joueuse.
- [x] Annuler ne laisse ni entité ni réclamation orpheline.

**Clôture (18 octobre).**
- Décision d'Opus, dans l'esprit du ticket : un PJ sans fiche se réclame **à la validation** de l'assistant, pas au clic sur la carte. Une joueuse ne peut pas rendre un PJ (seul le MJ écrit dans `campaign_characters`) : réclamer d'abord aurait laissé une réclamation orpheline à chaque annulation, contre le troisième critère. Rien n'a changé dans le schéma.
- Serveur (Opus) : `reclamerEtCreerFiche` (`src/server/services/choixPersonnage.ts`, 4 tests) réclame puis écrit (la réclamation donne le droit d'écrire), n'écrit jamais un PJ pris par une autre, et reprend à l'écriture si le PJ est déjà à elle (seconde tentative). Action `reclamerEtCreerFicheAction`, schéma Zod de l'écrasement.
- Page `/joueur/nouveau-personnage` : sans `pj`, la création de zéro (chemin existant, réclamée à la fin) avec un bouton Annuler ; avec `?pj=`, l'assistant au nom et au portrait de la fiche, après que le serveur a revérifié que ce PJ est réclamable et sans fiche (un lien recopié renvoie au carrousel). L'assistant accepte une action de remplacement et une note de bandeau (`entityMode.onSubmit`, `note`) et un `onCancel` hors `entityMode`.
- Carte : étiquette pointillée « Fiche de personnage à créer », bouton « Jouer {prénom} · créer sa fiche ».
- Restes du 82 vérifiés en vrai (trois PJ libres créés en Testeur MJ, puis supprimés) : portrait, phrase, identité, rotation par flèches, clavier, points et glissé, boucle, aucun débordement à 1280 et 390 px. Corrigé au passage : le niveau s'affichait deux fois (« Clerc 1 1 » : `classesLabel` porte déjà les niveaux).
- Critères vérifiés au navigateur : réclamer Mirelle ouvre l'assistant prérempli et la rend sienne à la validation (message « Mirelle est à toi ») ; « Testine Essai » créée de zéro est réclamée ; annuler dans les deux cas laisse les réclamations et les lignes de campagne inchangées. Données du Banc d'essai rendues à leur état d'avant.
- Restes : un PJ ouvert dont le bloc `character` est réservé au MJ passe pour « sans fiche » aux yeux de la joueuse, et l'assistant lui créerait un second bloc ; cas jugé improbable, non traité. Le message de validation de l'assistant reste en anglais quand aucune classe n'est choisie (« Too small… »), défaut antérieur.

---

### ☑ V3.1-82 — Choix du personnage (C2) : le carrousel · `M` · sans modèle IA — **fait le 18 octobre**

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

**Clôture (18 octobre).**
- Serveur (Opus) : `listCartesPersonnage` lit tout par lot (blocs, portraits, lecteur, libellés), avec un test d'une requête par nature de donnée et un test qu'aucune donnée cachée ne sort ; `premierePhrase` (noyau, tests d'abord) saute le texte marqué `spoiler` ; `libellesIdentite` est partagé avec `listWorldPlayerCharacters`. Décision de l'auteur : la phrase est la première du premier texte visible (la colonne `summary` du ticket n'existe plus).
- Interface (Sonnet) : le carrousel, `lib/ui/carrousel.ts` testé.
- Corrections d'Opus : message « c'est réclamé » par `?reclame=1` après la redirection ; le clavier marche sans `autoFocus` (plus d'anneau au chargement).
- Vérifié en Testeur MJ à 1280 et 390 px : carte « Nouveau » seule, aucun débordement, Entrée mène à la création.
- Restes : les cartes de PJ et la rotation n'ont pas été vues en vrai (aucun PJ libre au Banc d'essai) ; le cas « PJ sans fiche » revient à V3.1-83.

---

### ☑ V3.1-81 — L'Apparence du Compte est la Personnalisation C · `S` · sans modèle IA — **fait le 18 octobre**

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
- [x] Un compte joueur sans monde mené règle son mode et son fond depuis
  Compte (critère déjà posé par V3.1-35).
- [x] Téléphone 390 px : le flou est entièrement visible et réglable.
- [x] Aucune duplication de `PersonnalisationPanel`.

**Clôture** : Opus — `lirePersonnalisation` (`src/server/services/personnalisation.ts`) lit les cookies de l'appareil pour les trois portes (page et fenêtre Personnalisation des outils du MJ, section Apparence du Compte : règle des trois, la lecture était recopiée deux fois) ; l'accueil monte `PersonnalisationPanel` dans l'emplacement `apparence` de `PageCompte`. Interface (Sonnet) — la barre de la planche : pilule `Tabs` des quatre modes et interrupteur « Contraste élevé » sur une ligne, flou sur toute la largeur (sans `basis-full`), galerie à points de modes lisibles, « + » et « × », note de la planche ; en colonne sur téléphone ; `Tabs` accepte des onglets désactivés (mode illisible sur ce fond, avec son explication). Corrigé par Opus : les flèches du clavier sautent désormais un onglet désactivé au lieu de s'y arrêter ; la rangée de pastilles du Compte, collante, est floutée (le texte passait au travers). Vérifié dans le navigateur (Testeuse A, compte sans monde mené) : Apparence dans le sommaire et la page ; mode Clair appliqué, flou réglé à 10 px ; 390 px : curseur du flou visible (144 px de large), pilule sans débordement, aucun défilement horizontal ; page Personnalisation du MJ (Testeur MJ) avec son curseur. Réglages limités aux cookies du navigateur de test.

*Restes* : les libellés de la pilule restent en 12 px (la charte interdit 11 px, la règle de lint l'a refusé) — « Demi-sombre » tient à 390 px. Le « + » (envoi d'une image) et le « × » (retrait) ne sont pas rejoués : leur comportement n'a pas changé, seule la présentation.

---

### ☑ V3.1-80 — Compte (A) : une page en sections · `M` · sans modèle IA — **fait le 18 octobre**

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
- [x] Chaque geste de `HomeProfilePanel` est présent et fonctionne.
- [x] Le numéro n'apparaît qu'en Identité.
- [x] « Mon lien d'invitation » est absent pour un compte qui n'a pas
  rejoint par un lien.
- [x] Changer la langue bascule l'interface sans rechargement manuel.
- [x] Téléphone 390 px : aucun bouton coupé, aucun défilement horizontal.

**Clôture** : données (Opus) — `getOwnHandle` (repo : le nom et le numéro de son propre compte) ; la page d'accueil assemble `DonneesCompte` avec elle (C1) : numéro, email seulement s'il n'est pas synthétique, invitation réduite à `{ id, hasPassword }` (l'ancienne route envoyait l'invitation entière, jeton compris), langue, mondes possédés nommés, contexte compté par `repartirMondes` ; `compteDuContexte` et `sectionsCompte` (`lib/ui/compte.ts`, tests d'abord). Interface (Sonnet, interrompu une fois par une limite de session puis relancé) — `PageCompte` : six cartes de verre, sommaire de 200 px suivi par `IntersectionObserver`, pastilles sur tablette et téléphone ; `PasswordForm` gagne « Encore une fois » (bouton désactivé et message rouge tant qu'ils diffèrent) ; `MyInvitePanel` reçoit l'invitation avec la page et ne charge plus rien au montage (cliquet 60 → 59) ; `DeleteAccountSection` nomme les mondes possédés, champ toujours visible ; `HomeProfilePanel` supprimé. Opus : la destination Compte de `HomeShell` passe de `max-w-2xl` à `max-w-4xl` (le sommaire n'y tenait pas). Vérifié dans le navigateur (Testeuse A) : 1280 et 390 px sans défilement horizontal ; le numéro une seule fois, en Identité ; « Mon lien d'invitation » absent (compte sans lien) ; mots de passe différents → message et bouton désactivé ; suppression désactivée tant que SUPPRIMER n'est pas tapé ; English bascule l'interface sans rechargement, puis retour au français (la langue de Testeuse A est revenue au français). Rien d'écrit sur le compte de test hors la langue, restaurée.

*Restes* : la section Apparence attend V3.1-81 (emplacement prévu, absent tant qu'il est vide). Non rejoués ici : l'enregistrement du nom et du mot de passe (actions inchangées, comptes de test à préserver), un compte à email et un compte qui a rejoint par un lien (aucun sous la main). La ligne de contexte dit « joueur » au neutre (le genre n'est pas connu).

---

### ☑ V3.1-86 — La marque partout : rail, onglet, Rejoindre, Réinitialiser · `S` · sans modèle IA — **fait le 18 octobre**

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
- [x] Changer le nom en administration change l'onglet du navigateur au
  rechargement suivant.
- [x] Les trois formulaires gardent tous leurs champs et messages, sauf le
  choix du personnage de Rejoindre (déplacé, V3.1-100).

**Clôture** (Opus, sans délégation : quelques fichiers, contexte déjà chargé par 85) — onglet : `generateMetadata` (`app/layout.tsx`) lit `getAppIdentity()` (titre = nom, description = phrase) ; icône = l'image téléversée, sinon `/api/app-identity/icone?cle=…` qui dessine la tuile d'une des douze clés (Zod, `next/og`, publique dans le middleware, cache d'un an : une adresse donne toujours la même image ; les dessins de `LogoApp` partagés par `DESSINS_LOGO`) ; le favicon par défaut de Next (`app/favicon.ico`, celui de create-next-app) est retiré. Tête du rail de l'accueil : `LogoApp` de 26 px et le nom. `CadreTitre` (`components/brand/`) extrait de l'écran-titre, sans état : Rejoindre (lien invalide, porte à mot de passe, lien déjà servi, formulaire) et Réinitialiser (lien invalide, formulaire) y posent leur formulaire **actuel** dans le panneau de verre ; le choix du personnage était déjà sorti de Rejoindre (V3.1-100). Vérifié dans le navigateur : les douze icônes rendues, une clé inconnue refusée (400), titre « Antre Nous » sur /login, /rejoindre, /reinitialiser et l'accueil, lien `rel=icon` vers la tuile ; tête du rail ; les deux portes avec un lien invalide.

*Restes* : le changement de nom en administration n'est pas rejoué ici (il toucherait l'identité réelle) ; il repose sur l'invalidation déjà en place de `getAppIdentity` (`updateTag`, V3.1-84). Les formulaires avec un jeton valide ne sont pas vus à l'écran (aucun jeton de test, jamais affiché) : seules leurs enveloppes ont changé.

---

### ☑ V3.1-85 — Écran-titre (C) : connexion, création, mot de passe oublié · `M` · sans modèle IA — **fait le 18 octobre**

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
- [x] Les trois actions existantes fonctionnent depuis le nouvel écran.
- [x] Mot de passe oublié : même message pour un nom inconnu, un nom connu,
  un email inconnu, un email connu (test).
- [x] Le nom, la phrase et le logo viennent de l'identité (V3.1-84).

**Clôture** : serveur (Opus) — `voieReinitialisation` et `requestResetSchema` (`lib/auth/reinitialisation.ts`, tests d'abord : un email valide part par le lien, tout le reste est un nom, jamais un email deviné) ; `demanderReinitialisation` (`src/server/services/passwordReset.ts`) ne rend rien et ne lève jamais, l'envoi de l'email passe par `sendPasswordResetEmail` (repo) ; `requestResetAction` répond `{ success: true }` dans tous les cas, test des quatre cas (nom connu ou non, email connu ou non) avec la base simulée. Interface (Sonnet) — `app/login/page.tsx` devient serveur et lit `getAppIdentity()` ; `EcranTitre` (menu de trois pilules, quatre panneaux de verre, chacun son propre état) ; `components/brand/LogoApp.tsx` dessine les douze logos de la planche d'administration (réutilisé par 86) ; `cheminInvitation` (`lib/ui/ecranTitre.ts`) s'appuie sur `jetonDepuisLien`. Corrigé par Opus : React vidait le nom après une faute de mot de passe ; le nom (jamais le mot de passe) est désormais gardé, à la connexion comme à la création. Le pilote de mesure ouvre le formulaire par « Se connecter ». Vérifié dans le navigateur : 1280 et 390 px conformes à la planche (logo au-dessus du nom sur téléphone) ; un lien sans jeton dit « Ce lien n'est plus valide. » sans naviguer ; « Mot de passe oublié » sur un nom inexistant rend le message unique (rien déposé) ; mauvais mot de passe puis connexion de Testeuse A, arrivée sur l'accueil.

*Restes* : la création de compte n'est pas essayée en direct (jamais de compte neuf, `docs/TESTS.md`) ; elle appelle l'action `createAccount` inchangée. `app/auth/forgot-password/` n'est plus lié d'ici, gardé tel quel. Le titre du panneau d'invitation (« Lien d'invitation ») n'était pas dessiné : choisi par Sonnet.

---

### ☑ V3.1-36 — Le solo : ailes d'ordinateur et téléphone modèle A (lot d) · `L` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet** — planches définitives ; le moteur solo ne change pas.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Solo-Desktop » ; « Décidé · solo sur téléphone (modèle A) »
(trois planches). **Départ** : `SoloShell.tsx`, `IntentBar.tsx`,
`ScenePanel`, `ConsequencesDrawer`. **Dépend de** : 29, 32, 33.

- Ordinateur : poignées de repli sur les bords de la fenêtre du Jeu ; Monde
  disparaît replié ; la Fiche repliée devient une bande de 96 px — bouclier
  CA, PV, Niveau, Charge.
- Téléphone : barre Jeu, Monde, Fiche | Quêtes, Règles, Notes, dé encoché.
  Monde = wiki du joueur avec « Présents dans la scène » en tête, puis
  récents (Quêtes et Règles n'y sont plus). Jeu : bandeau lieu / heure,
  bande de jauges, fil, barre d'intention ; ✦ ouvre la feuille des
  conséquences. Fiche : la fiche de 32. Quêtes : pilule En cours /
  Terminées, une quête en feuille avec ses étapes. Notes : Les miennes /
  Journal de partie.
- « Jouer » ouvre l'outil de dés pré-rempli (33) ; « Lancer » confirme, le
  tour suit le chemin actuel de V3-B5.

**Critères d'acceptation**
- [x] Un tour complet sur téléphone : intention, outil de dés, Lancer, le tour dans le fil.
- [x] Aucun changement du moteur de tour (tests solo existants verts sans modification).

**Clôture** : interface (Sonnet), relue par Opus. Ordinateur — deux poignées sur les bords du Jeu (`SoloShell`) ; le Monde disparaît replié, la Fiche devient une bande de 96 px (`BandeFiche` : CA, PV, Niveau, Charge en kg). La fiche publie ses jauges par `SoloContexte` (une page serveur ne peut pas passer de fonction à `SoloShell`) : elle reste le seul endroit qui charge la feuille. Téléphone — barre du solo dans `PlayerShell`, vues `?vue=` écrites par `history.replaceState` (aucune navigation de document, vérifié), Monde (présents, wiki avec recherche, récents), Quêtes (pilule, feuille avec étapes), bande de jauges et ✦ des conséquences en feuille du bas. « Jouer » ouvre l'outil de dés (`PreReglage.lancer`) ; « Lancer » appelle `encaisser-fiche`, le serveur tire le dé ; une attaque qui touche rouvre l'outil sur les dégâts. Logique pure dans `lib/ui/solo.ts` (23 tests). Aucun fichier du moteur, des routes ni de `lib/solo` touché ; tests solo existants verts sans modification. Corrigé par Opus : l'outil affiche le DD figé de la demande (il montrait « — ») ; poignées redessinées en languettes neutres (cerclées d'accent et ouvertes, elles encadraient une ligne du fil comme une sélection). Vérifié dans le navigateur (Testeuse A, Banc d'essai) : 390 px — cinq tours d'Investigation complets (intention, outil, Lancer, tour au fil), vues Monde, Quêtes, Fiche ; 1440 px — Fiche en bande, puis les deux repliées (Jeu centré). Les cinq tours restent au journal de la campagne de test.

*Restes* : Notes sans « Les miennes / Journal de partie » (la page existante est liée telle quelle) ; « Terminées » = toutes les étapes faites, faute de quêtes closes chargées ; attaque, dégâts enchaînés et avantage non joués à l'écran (pas de cible dans la scène de test). En dev, le fil affiché prend jusqu'à 20 s de retard : l'écran sonde `/sheet` deux fois toutes les 4 s (fil et fiche), ce qui préexistait au ticket.

---

### ☑ V3.1-34 — L'outil Table du MJ · `L` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet** — tout est esquissé ; données et règles fournies par 24.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Décidé · téléphone du MJ — écrans » (Table) et « —
feuilles ouvertes » (Toute la table). **Départ** : `mjToolWindows.ts`,
`MjToolWindowContent.tsx` (un outil de plus dans la liste). **Dépend de** :
24, 26 (commande E), 29, 33.

- Une ligne par PJ de la campagne : nom + niveau ; dessous « joueur · CA ·
  PV » puis la ligne des états ; à droite classe et sous-classe. Toucher
  déplie.
- Déplié — **revu le 5 octobre** (alignement sur la fiche et la carte de
  l'ordinateur) : la ligne dépliée **est** le haut de la fiche du téléphone,
  même composant que la carte de l'ordinateur — bouclier de CA ; PV
  (temporaires par-dessus), niveau et XP, épuisement, chacun avec la
  commande E ; initiative, vitesse, maîtrise, inspiration ▲▼ ; Perception
  passive, dés de vie ▲▼, états · concentration (× retire ou rompt, « + »
  ouvre les états du ruleset en feuille), repos court et long du PJ ; « Ce
  qui se dépense » en groupes ; charge et pièces avec commande E
  (`changeCurrency`, un message dit le change fait). Aucune commande sur
  CA, initiative, vitesse, maîtrise, Perception passive. La ligne repliée ne
  change pas.
- À 0 PV, la ligne se transforme : fond rouge, « Contre la mort »,
  trois réussites / trois échecs, « Soigner +1 PV » (règles de 24).
- « Toute la table » : + XP, ± pièces, repos court, repos long — chacun en
  feuille avec « Pour qui » ; XP et pièces à partager ou à chacun, aperçu par
  PJ, qui monte de niveau est signalé ; les repos passent par
  `takeShortRest` / `takeLongRest` pour chaque PJ coché.
- Chaque geste passe par le même service que la fiche (même journal) ; le
  MJ a toutes les commandes. Sur ordinateur : fenêtre d'outil MJ, ascenseur
  fin ; sur téléphone : `no-scrollbar`.
- **Ordinateur et tablette — décidé le 5 octobre** (planche « Décidé ·
  outil Table ») : une carte par PJ, qui **est** le haut de la fiche
  (composant partagé avec V3.1-26 / V3.1-32, en mode MJ), plus la charge et
  les pièces ; ▲▼ sur les dés de vie ; aucune commande sur CA, initiative,
  vitesse, maîtrise, Perception passive (valeurs dérivées). Deux cartes par
  rangée, une seule dans un volet partagé ou sur tablette.

**Critères d'acceptation**
- [x] Les gestes de la planche, chacun journalisé une fois.
- [x] Partage de 10 po entre trois PJ : 3 po chacun, le reste affiché.
- [x] Un repos long sur trois PJ : trois résultats, trois événements `long_rest`.
- [x] Ordinateur : la carte réutilise le composant du haut de fiche, sans le dupliquer.

**Clôture** : serveur (Opus) — `partagerEgalement` (noyau, tests d'abord : 10 po entre trois PJ, 3 chacun et 1 de reste) ; trois gestes qui manquaient, derrière la porte commune et l'interrupteur de table : `actions/conditions` (poser ou retirer un état), `actions/concentration` (rompre, par `setConcentration`), `actions/hit-dice` (dés de vie ▲▼ bornés au total) ; `getTableParty` (chaque PJ résolu comme sa fiche) servi par la fenêtre d'outil MJ `table` ; `characterActions.integration.test.ts` 11/11. Interface (Sonnet) — `RangeeChiffree` extraite de `CharacterSheetHeader` et partagée (la fiche est inchangée, vérifié à l'écran), `OutilTable` (cartes, lignes, 0 PV en rouge, compteurs par recharge, charge et pièces), `FeuilleToutelaTable` (Pour qui, à partager ou à chacun, aperçu, un appel par PJ), page `/mj/table`, entrées MJ et téléphone. Corrigé par Opus : la charge sortait en livres sous l'unité kg (même défaut corrigé sur la fiche solo, `FicheJouableSac`). Vérifié dans le navigateur en MJ (Banc d'essai) : 1280 px — +10 po à partager (+5 par PJ, aperçu juste), puis rendus ; « À terre » posé puis retiré ; 390 px — lignes repliées et dépliées ; la fiche d'un PJ identique à avant. Les bourses de test sont revenues à 5 et 18 po.

*Restes* : PV temporaires sans commande dans la carte (affichage « +N temp. » seul) ; les trois événements `long_rest` d'un repos sur trois PJ suivent du code testé ailleurs (`takeLongRest`, un appel par PJ), non revérifiés à l'écran.

---

### ☑ V3.1-35 — Accueil en tableau de bord (lot h) · `M` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — proposition 3 tranchée ; « Reprendre » rangé dans le navigateur (ADR 0036 §4).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · accueil : tableau de bord, onglets en pilule
glissante ». **Départ** : `HomeShell.tsx`, `HomeScreen.tsx`,
`CampaignsPanel.tsx`. **Dépend de** : 25, 27.

- Rail du joueur : Mondes, Compte, Administration (superadmin seulement),
  Déconnexion en pied ; dalle Outils avec les dés seuls.
- En haut : prochaines séances de tous les mondes ; « Reprendre » sur la
  dernière visite (mémorisée dans le navigateur).
- Bouton « Nouveau monde » agrandi, à gauche : Mener une partie, Jouer en
  solo, Rejoindre une table (coller un lien d'invitation).
- Colonnes « Je mène » (+ « En solo ») et « Je joue » sur une même ligne de
  titres ; panneau du monde choisi à droite, avec les outils du **rôle tenu
  dans ce monde**.
- Téléphone : pilule Je mène / Je joue / Solo, le monde en feuille,
  « Nouveau monde » en grand bouton.

**Critères d'acceptation**
- [x] Un compte MJ dans un monde et joueur dans un autre voit les bons outils pour chacun.
- [x] « Rejoindre une table » accepte un lien d'invitation valide et refuse un lien invalide, sans rien créer.
- [x] « Reprendre » absent si rien n'est mémorisé.

**Clôture** : serveur (Opus) — prochaine séance de chaque monde dans les cartes de l'accueil, en une requête (`listNextSessionsForCampaigns`, même règle que `getNextSession`) ; `POST /api/invitations/verifier` (lien collé → valide ou non, rien de créé ; `jetonDepuisLien` testé ; test d'intégration dans `campaignInvites.integration.test.ts`, 12/12) ; `POST /api/dice-rolls` (jet hors de tout monde, lancé par le serveur, jamais enregistré) ; « Reprendre » : la dernière fiche ouverte, gardée dans le navigateur avec les fiches récentes (`lib/ui/recents.ts`, testé). Interface (Sonnet) — `HomeShell` sur le rail du joueur (dé seul `DeSeulDalle`), `AccueilHaut`, `NouveauMonde`, `RejoindreTable`, colonnes et panneau par rôle, téléphone en pilule et feuille du bas ; logique dans `lib/ui/accueil.ts` (testée). Corrigé par Opus : la date et l'heure d'une séance sont deux colonnes (la requête plantait l'accueil), pilule du téléphone ouverte sur le premier onglet non vide, dé dans la barre du bas du téléphone (le bouton flottant la recouvrait). Vérifié dans le navigateur : Testeur MJ à 1280 px (« Je mène », classeur Journal / Joueurs / Accès / Réglages, lien invalide refusé sans quitter l'accueil, jet de dés hors campagne sans « Secret ») ; Testeuse A à 1280 et 390 px (« Je joue », Mon personnage, Prochaine séance, MJ, stats ; « Reprendre » après une fiche ouverte, absent dans un navigateur neuf).

*Restes* : PV et XP du personnage dans le panneau joueur, et « Où tu en étais » d'un monde solo (planche) : ils demandent des lectures que l'accueil ne fait pas ; entre 768 et 1280 px, le panneau du monde passe sous les colonnes.

---

### ☑ V3.1-20 — Fenêtres du MJ en deux volets à onglets · `L` · sans modèle IA — **fait le 17 octobre (ADR 0066)**

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
- [x] Une, deux, trois fiches et plus : disposition conforme ci-dessus.
- [x] Glisser un onglet d'un volet à l'autre, et hors de la barre pour créer le second volet.
- [x] Séparateur glissable, double-clic au milieu.
- [x] Rechargement : même disposition (URL).
- [x] Catalogue mis à jour (planche « Fenêtre flottante » remplacée).

**Clôture** : logique (Opus) — `lib/ui/volets.ts`, testée d'abord (placer, retirer, glisser, partage, adresse `?volets=` qui rend la même disposition, ancien lien et adresse abîmée tolérés) ; ADR 0066, qui remplace la partie « fenêtres flottantes » de l'ADR 0006. Interface (Sonnet) — `VoletsLayer.tsx` (une boîte stable par fiche, la primaire y entre par un portail : changer de volet ne remonte jamais une fiche), `DesktopWindowsProvider` réécrit (disposition dérivée de l'adresse), onglets glissables (HTML5), séparateur à capture de pointeur ; `WindowFrame` et la barre des fiches réduites retirés ; `?volets=` suit `?avec=` au changement de section. Corrigé par Opus : onglets qui débordaient d'un volet étroit, volets collés au rail (désormais un cadre arrondi à 8 px). Vérifié dans le navigateur à 1280 et 820 px (MJ) : une, deux, trois fiches ; glisser vers l'autre volet ; dépôt sur la moitié droite qui crée le second volet ; séparateur à 31 % puis rechargement identique ; aucun remontage d'une fiche déplacée ; téléphone inchangé (390 px, pile « 2 fiches »).

*Restes* : navigation au clavier par flèches dans une barre d'onglets (chaque onglet reste atteignable à la tabulation) ; la couche suit la zone par sa taille, pas par un simple décalage sans changement de taille.

---

### ☑ V3.1-33 — L'outil de dés unique (feuille, panneau, scintillement) · `L` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — ADR 0035, ADR 0036 §6, planches précises ; la cible reste à V3.1-21.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : téléphones (feuille des dés), « Décidé · outil de dés sur
ordinateur et tablette », « Décidé · le jet en animation » (l'outil réel,
issue du d20 forçable : réussite, échec, critique). C'est le même gabarit
sur toutes les planches qui ont un outil de dés (zone « Fiche de
personnage » entière, six téléphones MJ et joueur, trois téléphones solo,
outil de dés sur ordinateur, Initiative).
**Départ** : `DiceRollPanel.tsx`, `POST /api/campaigns/[id]/dice-rolls`.
**Dépend de** : 29.

- Point d'entrée serveur étendu (Zod) : dés, **modificateur**, **avantage /
  désavantage**, **libellé**, secret. Le serveur lance ; avec avantage, il
  renvoie les deux d20 et lequel est retenu.
- Une seule interface : feuille du bas sur téléphone (hauteur de la feuille
  Outils), panneau ancré au dé du rail sur ordinateur et tablette. Dés d4 à
  d100 empilables avec compteur ; modificateur dans la case sous le d10
  (commande E) ; pilule Normal / Avantage / Désavantage ; une ligne
  **Cibler · Lancer · Effacer** — Cibler grisé tant que V3.1-21 n'est pas
  livré.
- Résultat : chaque dé (max en ambre, 1 en rouge) ; avantage : paire
  étiquetée, d20 retenu cerclé d'ambre, l'autre effacé. Derniers jets (30)
  qui défilent avec l'ascenseur fin de `globals.css`.
- Animation scintillement : les chiffres défilent flous puis se figent un
  par un, le total compte jusqu'à sa valeur ; elle couvre l'attente du
  serveur ; chiffres décoratifs seulement ; mouvement réduit → résultat
  immédiat.
- API de pré-remplissage utilisée par la fiche (32), la Table (34) et le
  solo (36) : `openDiceTool({ dice, modifier, label, advantage? })`.
- **Revu le 4 octobre (lot i)** :
  - **Un seul gabarit, toujours le même** : seule la présélection change
    selon le bouton touché ; son nom s'affiche en titre (« Dague — touche »).
    Ouvert depuis le dé, sans bouton : « **Jet libre** ».
  - **Secret** : interrupteur dans l'en-tête de l'outil (il existait dans
    `DiceRollPanel` et manquait à l'esquisse). Un jet secret n'est vu que de
    son auteur et du MJ ; les jets d'un monstre sont secrets par défaut.
  - **DD** (retour de l'auteur, 4 octobre : l'outil en ligne, `DiceRollPanel`,
    l'a déjà et l'esquisse l'avait perdu) : une ligne DD sous la grille —
    ▼ valeur ▲, vide = pas de DD — et, pour le MJ seul, **« DD privé »** :
    le joueur voit « contre DD ? », jamais la valeur. Le « Lancé public » de
    l'outil en ligne devient l'interrupteur Secret.
  - **Verdict, dans la case du résultat** (aucune place en plus) : il ne
    s'affiche que s'il y a quelque chose à battre — une CA (attaque), un DD
    (test, sauvegarde). Réussite en vert, **échec en rouge**, **critique en
    or lumineux**. Animation **tranchée le 4 octobre : B, la case se
    remplit** — la couleur du verdict envahit la case de gauche à droite
    puis se pose en teinte légère derrière le résultat (planche « Décidé ·
    verdict d'un jet ») ; mouvement réduit : la teinte seule. Le même outil
    servant partout, le verdict est le même partout.
  - **Zone de résultat permanente** (4 octobre) : elle est toujours là,
    même avant le premier jet — « — » et **un carré vide par dé** du
    prochain lancer (deux pour un d20 avec avantage), qui se remplissent au
    lancer. Sur téléphone, la feuille des dés monte plus haut pour la
    loger. Sa hauteur ne change jamais.
  - **« Lancer les dégâts » dans la zone de résultat — tranché le 4
    octobre : la bande du bas** (sur quatre propositions, les autres
    retirées de l'esquisse). Une bande fine au pied de la zone, dont la
    place est **toujours réservée** (la hauteur ne bouge jamais) :
    - **invisible** s'il n'y a rien à battre (ni cible, ni DD) ou pas de
      suite ;
    - avant le jet : rien (revu le 4 octobre : la bande n'annonçait la suite
      que pour s'effacer sur un raté — elle n'apparaît plus que sur une
      réussite suivie de dégâts) ;
    - **touché** : toute la bande devient le bouton « Lancer les dégâts » ;
      côté MJ, un monstre qui touche un joueur donne « Valider · dégâts » /
      « Faire échouer » ;
    - **raté** : pas de bande du tout ;
    - **dégâts lancés depuis la bande** : la partie du dessus rejoue le
      scintillement avec les dés de dégâts, **sans remplissage** (un jet de
      dégâts ne réussit ni n'échoue) ; à la place du verdict, l'effet
      (« Worg −3 PV », « Tharnok +7 PV ») ; la bande disparaît.
    Les détails (« contre CA 13 », « JS Force : raté — À terre ») restent
    en lignes sous la zone.
  - **Enchaînement** : « Touché » /
    « Raté » (ou « Résiste » / « Pas résisté ») puis le bouton suivant. Si l'attaque réussit, le bouton « **Lancer les
    dégâts · 1d4 + 2** » apparaît : un toucher lance les bons dés sur la
    même cible et les dégâts s'appliquent seuls.
  - **Critique** : un 20 naturel touche toujours et double les **dés** de
    dégâts, pas le modificateur (1d4+2 → 2d4+2) ; un 1 naturel rate
    toujours. Règle 2024, déjà dans l'outil.
  - **Validation du MJ** : quand un monstre touche un joueur, l'outil du MJ
    s'arrête sur « Valider la touche » / « Faire échouer » avant les dégâts.
  - **Limites relevées, tranchées avec l'auteur, à traiter dans V3.1-21** :
    - **bonus après la touche** : l'outil **lit la fiche du lanceur** et
      propose ce qui est disponible à ce moment (Attaque sournoise si l'arme
      et la situation la permettent et qu'elle n'a pas servi ce tour,
      Châtiment divin s'il reste un emplacement, Inspiration bardique
      reçue…) ; le joueur coche, les dés s'ajoutent avant le lancer ;
    - **réactions** : en 2024, Bouclier est une **réaction prise quand on
      est touché** (+5 CA, y compris contre l'attaque qui la déclenche) —
      elle se joue donc **après** le « Touché », avant les dégâts. Il faut
      une courte fenêtre de réaction côté cible ; si elle fait passer la CA
      au-dessus du jet, la touche devient un raté ;
    - **résistances, immunités, vulnérabilités** de la cible appliquées par
      le moteur, et **JS de concentration** déclenché quand une cible
      concentrée subit des dégâts (DD 10 ou moitié des dégâts, au plus 30) ;
    - **zones** : le lanceur choisit **plusieurs cibles** dans « Cibler » ;
      un jet de sauvegarde par cible, dégâts lancés une fois.

**Critères d'acceptation**
- [x] Jet avec avantage : deux d20 affichés, seul le retenu dans le total et les derniers jets.
- [x] Le client n'envoie jamais un résultat (test de la route).
- [x] Même outil sur téléphone, tablette et ordinateur.
- [x] Titre : le nom du bouton touché, ou « Jet libre » ; Secret dans l'en-tête ; DD sous la grille, « DD privé » pour le MJ (le joueur lit « contre DD ? »).
- [x] Zone de résultat toujours visible, hauteur fixe : « — » et un carré vide par dé du prochain jet avant le lancer.
- [x] Verdict seulement contre une CA ou un DD, en remplissage de la case : vert, rouge, or au 20 naturel ; mouvement réduit : teinte sans mouvement.
- [ ] *(V3.1-106)* Bande « Lancer les dégâts » seulement sur une réussite suivie de dégâts ; le jet de dégâts s'applique à la cible et affiche l'effet à la place du verdict, sans remplissage.
- [ ] *(V3.1-106)* Monstre qui touche un joueur : « Valider · dégâts » / « Faire échouer » côté MJ.
- [x] Bande d'après-jet (décision A du 5 octobre, V3.1-19) : sur un d20 raté de son personnage, Relancer (Inspiration héroïque), Avantage (Chanceux), + d6 (Inspiration bardique reçue) selon ce que la fiche possède ; une fois par jet ; le point est retiré côté serveur et le nouveau jet est lancé par le serveur ; rien sur une réussite.

**Clôture** : serveur (Opus) — noyau `src/core/dice/diceTool.ts` (formule de l'outil, paire d'avantage lue dans la trace, verdict contre un DD, or au 20 naturel ; tests d'abord) ; migration `20261017170000_dice_rolls_roller_visibility.sql` (niveau `roller` de l'ADR 0038 : le jet secret d'un joueur, vu de lui et du MJ) ; `POST …/dice-rolls` étendu (modificateur, avantage, libellé, DD, DD privé jamais écrit), schéma strict qui refuse tout champ de résultat ; jets de fiche secrets pour les joueurs ; `POST …/actions/heroic-reroll` (le serveur retire l'Inspiration héroïque puis relance) ; `checkRolls.integration.test.ts` 14/14. Interface (Sonnet) — `OutilDes.tsx` dans la feuille du bas sous 768 px et un panneau ancré au rail au-delà, scintillement, verdict en remplissage, bande de relance ; les tests de caractéristique, sauvegarde, compétence et l'initiative de la fiche (et du solo) ouvrent l'outil pré-rempli. Corrigé par Opus : le panneau s'ouvrait sur le rail. Vérifié dans le navigateur : Testeuse A à 390 et 820 px (test de Sagesse avec avantage contre DD 30, jet libre secret, relance payée par l'Inspiration donnée par le MJ, puis rendue à 0), MJ à 1280 px (jet libre 1d20+2d6+3 contre DD 10, DD privé sous `/mj`).

*Restes* : la bande « Lancer les dégâts » et « Valider · dégâts » / « Faire échouer » demandent une cible : V3.1-106 (place de la bande réservée). Les attaques, sorts et dégâts de la fiche passent encore par leurs boutons : ils rejoindront l'outil avec le ciblage (106). Chanceux et Inspiration bardique reçue ne sont modélisés par aucune fiche : la bande ne propose que la relance par l'Inspiration héroïque. « DD privé » n'apparaît qu'en mode MJ (`/mj`), comme l'ancien interrupteur. Retirer un seul dé : non voulu (décision de l'auteur, 17 octobre : « Effacer » suffit).

---

### ☑ V3.1-32 — Fiche sur téléphone : jets, infobulles de règles, sac · `L` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — fiche entièrement esquissée ; services fournis par 24.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Décidé · fiche sur téléphone, vivante et déroulée partie
par partie », « Décidé · fiche en combat », téléphone du joueur (trois
planches). **Dépend de** : 24, 26, 29.

- Ordre de la sous-planche : en-tête, bouclier CA et jauges PV, niveau,
  épuisement (commande E de 26), constantes, perception passive, dés de vie,
  concentration, états, six caractéristiques, compétences repliables, puis
  la pilule des cinq onglets collée en haut au défilement.
- Boutons de jet : chaque case de caractéristique a deux boutons (haut :
  test, bas : sauvegarde) ; une compétence se touche ; initiative, attaque
  de sort, bonus de touche et dégâts sont des boutons. Tous ouvrent l'outil
  de dés pré-rempli (33) — en attendant 33, ils appellent le chemin actuel.
- Infobulles de règles : tout nom d'arme, sort, objet, aptitude, action,
  état, la concentration et l'épuisement ouvrent leur règle en feuille du
  bas (« Ouvrir dans Règles ») — partir de `useOpenRuleLink`. Même contenu
  en fenêtre sur ordinateur.
- Inventaire : « Équipé » / « Au sac » par objet (`setItemEquipped`, 24) ;
  la charge se recalcule.
- À 0 PV, les jauges cèdent la place aux jets contre la mort (24).

**Critères d'acceptation**
- [x] La fiche de Candide de la sous-planche, reproduite à 390 px.
- [x] Chaque type de nom ouvre la bonne règle, joueur et MJ.
- [x] À 0 PV : jets contre la mort, puis stabilisé ou mort selon 24.

**Clôture** : serveur (Opus) — `rollDeathSaveForCharacter` et `POST /api/entities/[id]/actions/death-save` (d20 du serveur ou vrai dé annoncé, refusé hors de 0 PV, journalisé ; `characterActions.integration.test.ts` 10/10). Interface (Sonnet) — ordre de l'esquisse sous 40rem, caractéristiques en 3 colonnes, pilule collée au défilement, `aria-label` des jets ; `NomDeRegle` (arme, objet, sort, aptitude, épuisement, état s'il a une règle, sort de concentration) : feuille du bas chargée au toucher sous 768 px, fenêtre au-dessus ; `BlocMourant` à 0 PV (`lib/ui/etatMourant.ts`) ; concentration affichée (sans bouton pour la rompre : aucune action serveur). Corrigé par Opus : « Ouvrir dans Règles » mène le joueur à `/joueur/regles/…`, libellé « Épuisement » en capitales. Cliquet du câblage porté à 60 (chargement au toucher, CABLAGE §6). Vérifié dans le navigateur à 390 px en MJ et en Testeuse A : règle de l'épée à deux mains, deux jets de mort (7 : échec, 14 : réussite), soin, PV remis à 12.

---

### ☑ V3.1-31 — Éditeur plein écran en accordéon (téléphone) · `M` · sans modèle IA — **fait le 17 octobre (ADR 0065)**

**Modèle conseillé : Sonnet** — option A tranchée et esquissée.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · téléphone du MJ — plein écran et infobulles ».
**Dépend de** : 29.

Plein écran, barre flottante masquée, « Annuler » / « Enregistrer » en
haut. Tous les blocs dans la page, repliés en une ligne de résumé, un seul
ouvert à la fois ; poignée ⠿ pour réordonner (aussi au clavier) ; « + bloc »
en bas. Le joueur a le même éditeur, limité à ses droits (`canEditEntity`).
Les éditeurs de blocs existants sont réutilisés tels quels à l'intérieur.

**Critères d'acceptation**
- [x] Ouvrir, modifier deux blocs, réordonner, enregistrer : une seule écriture, contrôle de version compris.
- [x] Annuler avec des changements demande confirmation.
- [x] Un joueur ne voit pas les blocs qu'il ne peut pas modifier.

**Clôture** : serveur (Opus) — `public.save_entity_blocks` (migration `20261017150000`, `security invoker`, tout ou rien), `saveEntityBlocks` (droit, appartenance, Zod, une révision), `PATCH /api/entities/[id]/blocks` ; `saveEntityBlocks.integration.test.ts` 5/5. Interface (Sonnet) — `EditeurPleinEcran` (portail dans `<body>`, ajouté par Opus : la couche restait sous la barre flottante), crayon `md:hidden`, Identité puis blocs repliés, un seul ouvert, ⠿ au doigt et aux flèches (`aria-live`), « + bloc », confirmation d'« Annuler » ; logique pure `lib/ui/editeurPlein.ts`. Les éditeurs à sous-écriture reprennent la version renvoyée ; carte et fiche de personnage « se modifient sur la fiche ». Passages MJ teintés en lecture (reporté de V3.1-30). Vérifié dans le navigateur à 390 px : un seul `PATCH …/blocks` par enregistrement, ordre conservé au rechargement, confirmation, menus au-dessus de la couche. Catalogue : planche « 10 · Téléphone » créée (Ecrans dépassait 8 000 px).

---

### ☑ V3.1-30 — Wiki et Règles sur téléphone : ☰ et consultées récemment · `M` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — parcours esquissé ; stockage tranché (ADR 0036 §4).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : téléphones MJ et joueur, écrans Monde / Wiki / Règles et
leurs feuilles. **Départ** : `BookSkin.tsx`, `TwoPaneReaderLayout.tsx`,
`PlayerRulesSidebar.tsx`. **Dépend de** : 29.

- Toucher Monde / Wiki / Règles ouvre un écran d'accueil : recherche,
  bouton ☰ (sommaire complet, types repliables, PJ déplié par défaut) et
  la liste des fiches consultées récemment.
- Une fiche choisie s'affiche dans la peau actuelle (`BookSkin`), ☰ en
  haut à gauche ; le tiroir commence lui aussi par « Récemment ».
- « Récemment » vit dans le navigateur (identifiants et titres seulement,
  20 au plus, par monde) ; une fiche devenue invisible n'est pas affichée
  (le serveur répond à l'ouverture).
- Côté MJ : « + » nouvelle entité, passages MJ en orange, crayon vers
  l'éditeur (31). Règles : même parcours, la règle en page.

**Critères d'acceptation**
- [x] Le parcours accueil → fiche → retour, pour le MJ et le joueur.
- [x] Le joueur ne reçoit jamais un passage MJ (test serveur existant toujours vert).
- [x] Navigation privée ou stockage bloqué : la liste est vide, rien ne casse.

**Clôture** : `AccueilLecteur` (sous 768 px) sur Monde, Règles (MJ et joueur) et Wiki joueur : recherche locale sur l'arbre déjà chargé, ☰, « Consultées récemment » ; « + » côté Monde MJ. Liste dans le navigateur (`lib/ui/recents.ts`, `useRecents`, 20 par monde et par espace, adresses et titres seulement), enregistrée par les pages de fiche (jamais `/apercu` ni `/partage`). Wiki joueur : `?accueil=1` saute la redirection vers le Livre de sessions (la barre téléphone y pointe ; le rail garde la redirection). Les ☰ de `BookSkin` et `TwoPaneReaderLayout` ouvrent une feuille du bas, celles du MJ commencent par « Récemment » ; le ☰ ne chevauche plus le titre de la fiche MJ. Vérifié dans le navigateur à 390 px (MJ, joueur, stockage bloqué) et à 1 280 px ; `visibilityRls.integration.test.ts` 7/7. Pas de crayon (V3.1-31) ; les passages MJ ne sont pas encore teintés (`--gm` inutilisé par les segments) — à reprendre avec 31.

---

### ☑ V3.1-29 — Coquille téléphone : barre flottante et feuilles du bas (lot c) · `L` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — entrées, gabarits et comportements fixés par les planches.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Décidé · téléphone du MJ — écrans » et « — feuilles
ouvertes », mêmes planches côté joueur. **Départ** : `PlayerShell.tsx`,
`AppShell.tsx`, `useMatchMedia.ts`. **Dépend de** : 27 (dalle Outils).

- Sous 768 px : barre du bas flottante à six entrées, dé encoché au centre.
  MJ : Monde, Règles, Fiches | Table, Chat, Outils. Joueur : Perso.,
  Édition, Notes | Wiki, Règles, Chat. Toucher de nouveau une entrée active
  ramène à son écran d'accueil.
- Un composant « feuille du bas » unique (poignée, glisser pour fermer,
  piège du focus, Échap) : tout ce qui s'ouvre vient du bas.
- **Fiches** (MJ) : une fiche à la fois, pastille « N fiches » qui ouvre la
  pile en feuille, même adresse `?avec=`.
- **Outils** (MJ) : grille par moment (séance, préparation, campagne),
  radio comprise ; le chat n'y est plus.
- Écrans Table, Wiki, Règles, Édition, dés : des emplacements, remplis par
  30, 31, 33 et 34.

**Tranché le 17 octobre** (reporté de V3.1-28) : sous 640 px de fiche, les compétences deviennent une ligne repliable « Compétences » **fermée par défaut**, entre les caractéristiques et les onglets, comme l'esquisse « Fiche PJ — téléphone » (résumé fermé : « N maîtrisées · meilleure compétence +X ▾ », ouvert : « replier ▴ », la liste puis la légende ● expertise · ◐ maîtrise). Le sélecteur « Points de vie : valeur fixe / jetés » passe **dans ce bloc replié**, sous la liste (choix de l'auteur) ; au-delà de 640 px, rien ne change.

**Critères d'acceptation**
- [x] Les deux barres conformes aux planches à 390 px ; aucune page à défilement horizontal.
- [x] Feuille du bas : clavier, lecteur d'écran, glisser pour fermer.
- [x] Au-dessus de 768 px, rien ne change.
- [x] Planche « Tiroir » remplacée par « Feuille du bas » ; planche « Barre flottante » créée.

**Clôture** : `FeuilleDuBas` (`components/shared/`, portail, piège du focus, Échap, glisser ; seuil dans `lib/ui/feuilleDuBas.ts`) ; `BarreFlottante` commune, `BarreTelephoneMj` montée une fois dans `AppShell` (classement des pages : `lib/ui/barreMj.ts`) ; barre joueur dans `PlayerShell` (monde sans MJ : « Solo » remplace « Chat »). Fiches : pile lue dans l'état des fenêtres, même `?avec=`. Outils : grille par moment, radio en tête ; un outil s'ouvre en page (pas dans la feuille : `MjToolWindowContent` demanderait un chargement de plus). Table : feuille « bientôt » (V3.1-34). Le ☰ de Monde et Règles ouvre une feuille ; celui du MJ disparaît. Le dé flottant se retire là où une barre ou une dalle le remplace (`enregistrerDalle(portee)`). Fiche étroite : compétences repliables fermées par défaut, sélecteur de PV dedans (`lib/ui/resumeCompetences.ts`). Vérifié dans le navigateur à 390 px (MJ et joueur) et à 1 280 px (rien ne change). Reste au ticket 30 : le ☰ de la fiche qui chevauche son titre, le tiroir de `BookSkin`.

---

### ☑ V3.1-27 — Rail repliable et dalle Outils (lots a, b) · `M` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — mesures et comportements donnés par V3.1-19.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : MJ et joueur, ordinateur et tablette. **Départ** :
`Sidebar.tsx`, `MjSidebar.tsx`, `PlayerShell.tsx`, `RadioWidget.tsx`,
`ChromePill.tsx`, `DiceRollPanel.tsx`.

- Rail flottant, coins arrondis : 204 px déployé ↔ 64 px replié
  (`width 380ms cubic-bezier(.4,0,.2,1)`), libellés qui s'effacent ;
  poignée en onglet 16 × 44 px sur le bord droit ; replié, l'arborescence
  s'ouvre en menu flottant au survol et au clavier. Listes :
  `overflow-y: auto` et `overflow-x: hidden`. État replié mémorisé dans le
  navigateur (`localStorage` protégé).
- Dalle « Outils » en bas du rail : le dé s'y encoche (48 px, anneau de 6 px
  couleur du panneau) et ouvre le panneau de dés existant ; la radio y
  passe, visible rail replié, point vert en lecture / rouge à l'arrêt.
  L'horloge n'est pas reprise.
- Au-dessous de 768 px, le rail n'existe pas (le téléphone est 29).

**Critères d'acceptation**
- [x] Déplier / replier à la souris et au clavier ; état gardé au rechargement.
- [x] Radio et dé utilisables rail replié.
- [x] Planches « Pastille chrome », « Bouton de dés », « Rail du joueur » mises à jour ; planche « Rail repliable » créée.

**Clôture** : `components/shell/Rail.tsx` (rail, lignes, menu flottant en portail, dalle Outils) sert les quatre rails (Monde, Règles, MJ, joueur) ; un seul arbre DOM par barre, sous 768 px tiroir et barre du bas inchangés. État replié dans `localStorage` (`creadonjon:rail:replie`, `lib/ui/rail.ts`) lu par `useSyncExternalStore` : changer de section ne rejoue pas l'animation. Le dé de la dalle ouvre le volet existant (`ouvrirVolet`) ; le bouton flottant ne se cache que tant qu'une dalle est montée (une page sans rail garde son dé). Radio du rail : point vert en lecture, rouge à l'arrêt ; `ChromePill` retirée en vue ordinateur, horloge non reprise. Vérifié dans le navigateur (MJ Monde/MJ/Règles, joueur, 390 px). Écarts : les menus repliés lisent l'arbre du chargement de la page (un duplicata n'y paraît qu'à la navigation suivante) ; Règles repliées : une ligne pointillée regroupe « Ajouter une règle » et les bacs à sable.

---

### ☑ V3.1-28 — Tablette : la fiche s'adapte à sa fenêtre (lot f) · `S` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — règle simple, planche à trois largeurs.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · fiche sur tablette : elle suit la largeur de sa
fenêtre (piste B) » (zone « Fiche de personnage » ; la fiche y prend, sous
~640 px, la disposition du téléphone). **Dépend de** : 26.

La fiche lit la largeur de **sa** fenêtre (requête de conteneur CSS, pas
la largeur de l'écran) : sous ~640 px, les six caractéristiques passent en
ligne au-dessus des onglets.

**Critères d'acceptation**
- [x] La même fiche à 960, 680 et 540 px de fenêtre, conforme à la planche.
- [x] Aucune lecture de `window.innerWidth` pour cette règle.

**Clôture** : `@container` sur la fiche entière (`PlayableCharacterSheet.tsx`), variantes `@min-[40rem]:` à la place de `md:` (y compris le filet de l'en-tête). Vérifié dans le navigateur à 960, 680 (colonne de gauche) et 540 px (six tuiles en ligne, aucun défilement horizontal). Fait par Opus, sans délégation : quatre classes.

---

### ☑ V3.1-26 — Fiche d'ordinateur à jauges et commande E · `M` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — interface esquissée, services existants.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** (zone « Fiche de personnage ») : « Décidé · fiche sur
ordinateur, vivante et déroulée partie par partie », « Décidé · jauge à
commandes (option E) ». **Départ** :
`CharacterSheetHeader.tsx`, `JaugeCirculaire` (`FicheJouableEnTete.tsx`).
**Dépend de** : 25.

- Bouclier de CA ; jauges circulaires PV (temporaires d'abord), niveau / XP,
  épuisement (0 à 6), chacune avec la commande E : ▲, champ d'écart, ▼ —
  champ vide = ±1, champ rempli = ce nombre puis le champ se vide.
- Bornes : PV et épuisement plafonnés ; XP sans plafond.
- Constantes en badges (initiative, vitesse, maîtrise) ; Inspiration au
  gabarit exact d'un badge (72 × 56 px), même taille de chiffre, ▲▼ intégrés.
- Les onglets de la fiche en pilule (25).
- Les commandes appellent les services existants (`changeHp`, `changeXp`,
  `changeExhaustion`, `changeInspiration`) ; aucune valeur posée par le client.

**Critères d'acceptation**
- [x] Les quatre jauges et l'inspiration conformes à la planche, aux quatre modes.
- [x] Commande E : ±1 champ vide, ±N champ rempli, champ vidé après usage.
- [x] Un composant `CommandeE` réutilisable (il resservira en 32 et 34), avec sa planche au catalogue.
- [x] Jamais de valeur provisoire fausse (CA 11, PV 0/0) ni de clé technique d'objet pendant le chargement de la fiche ; vitesses au format français, arrondies au mètre (« 9 m ») (vu par la vérification du 11 octobre). Le 13 octobre, la même CA provisoire provoque une erreur d'hydratation de React : le serveur rend 11, le navigateur 16 quand les règles sont déjà en cache.

**Clôture** : `CommandeE` (`components/shared/CommandeE.tsx`, écart seul, règles dans `lib/ui/commandeE.ts`, testées) porte PV, niveau/XP et épuisement ; bouclier de CA, badges, Inspiration 72 × 56 ; squelette sans chiffre tant que les règles et l'état de jeu ne sont pas arrivés (`useResolvedRuleset` part toujours de vide : plus d'erreur d'hydratation) ; vitesse au mètre. Vérifié dans le navigateur (Banc d'essai, chargement froid et chaud, écart 2 puis ±1). Planche « Jauge à commandes » dans `Fiche.dc.html`.

---

### ☑ V3.1-25 — La pilule glissante remplace `BinderTabs` · `S` · sans modèle IA — **fait le 17 octobre (ADR 0034)**

**Modèle conseillé : Sonnet** — composant décidé (ADR 0034), usages listés.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; recenser les usages à remplacer avant de coder, puis vérifier qu'il n'en reste aucun ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · accueil : tableau de bord, onglets en pilule
glissante ». **Départ** : `components/shared/BinderTabs.tsx`.

Un composant d'onglets unique : fond qui glisse sous l'onglet actif (260 ms,
sauté sous mouvement réduit), clavier (flèches, Début, Fin), rôles ARIA
`tablist` / `tab` / `tabpanel`. Il remplace `BinderTabs` partout : fiche
jouable, fiche solo, colonne Monde et coquille du solo, aperçu du créateur.
Sur téléphone, la pilule défile horizontalement si elle déborde.

**Critères d'acceptation**
- [x] Plus aucun import de `BinderTabs` ; le fichier est supprimé.
- [x] Clavier et lecteur d'écran : un test de composant.
- [x] Charte §3 et planche 3 du catalogue mises à jour.

**Réalisé** (délégué à `dev-sonnet`, planche à `aide-haiku`, relu par Opus)
- `components/shared/Tabs.tsx` : pilule glissante, fond positionné d'après l'onglet actif mesuré (suit le défilement sur téléphone), 260 ms, sauté sous mouvement réduit ; `TabPanel` (`role="tabpanel"`, relié par `idPrefix`). Clavier sorti en fonction pure (`lib/ui/tabsKeyboard.ts`).
- Les 7 usages convertis ; `BinderTabs.tsx` supprimé. Charte §3 et §9, planche `Navigation.dc.html`.
- Tests : `lib/ui/tabsKeyboard.test.ts`, `lib/ui/tabs.test.ts` (balisage ARIA rendu côté serveur, sans dépendance ajoutée).
- Vérifié dans le navigateur (Banc d'essai, Testeur MJ) : fiche de personnage sur ordinateur et téléphone — flèche et Fin changent l'onglet, le focus suit, un seul onglet tabulable, le fond reste aligné, la pilule défile sur téléphone.

*À voir à l'œil* : accueil (onglets d'un monde ouvert), solo, aperçu du créateur.


---

### ☑ V3.1-111 — Sauvegardes : la demande et la réponse (données, serveur) · `M` · sans modèle IA — **fait le 17 octobre (ADR 0044)**

**Modèle conseillé : Opus** — table nouvelle, RLS. **ADR 0044.**
**Dépend de** : 105, 110.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration : table `save_requests` (champs de l'ADR), RLS (lecture :
  auteur, cible, MJ ; réponse par `app.answer_save_request`) ;
  `docs/SCHEMA.md`.
- `resolveTargetedRoll` (105) : un effet à sauvegarde vérifie la cible
  (`isValidTarget`), puis crée la demande au lieu d'appliquer ; la réponse
  (lancer côté serveur, vrai dé avec « modificateur inclus », ou saisie du
  MJ) est traitée **au nom de celui qui répond** : verdict, puis dégâts ou
  état appliqués, journal, et le résultat revient au jet de l'auteur.

**Critères d'acceptation**
- [x] Une sauvegarde imposée à un PJ n'est lisible que de l'auteur, du
  joueur de la cible et du MJ (test RLS).
- [x] Réponse → verdict → effet appliqué, journalisé (test de service).

**Réalisé** (détail dans l'ADR 0044, « Réalisation de la demande et de la réponse »)
- Migration `20261017120000_save_requests.sql` (appliquée le 17 octobre, après correction : `natural` est un mot réservé, la colonne s'appelle `natural_roll`) : table, RLS, `answer_save_request`, `set_own_participant_vitals`.
- Noyau : `zSaveRequestEffect`, `saveTotal`, `effectsForSaveOutcome` (`src/core/rules/saveRequest.ts`), tests d'abord.
- « Cibler » avec un sort à sauvegarde : `isValidTarget` avant de lancer (aucun emplacement dépensé sur un refus), puis la demande. Réponse `answerSaveRequest` au nom du répondant ; routes `GET …/save-requests` et `POST …/save-requests/[requestId]/answer`.
- Tests d'intégration : 14/14 (`saveRequests.integration.test.ts`, `targetedRoll.integration.test.ts`) — RLS avec deux comptes joueurs, réponse → verdict → effet → journal, annulation par le MJ.

*Écart* : `set_own_participant_vitals`, écriture étroite du joueur sur la ligne de combat de son PJ (ADR 0040 l'avait fermée).
*Restes* : les écrans (bandeau de la cible, pastille du dé) et la publication temps réel de `save_requests` ; la création par un joueur (V3.1-104).


---

### ☑ V3.1-110 — Sauvegardes : la restriction de cible (noyau) · `S` · sans modèle IA — **fait le 17 octobre (ADR 0044)**

**Modèle conseillé : Sonnet** — noyau pur, tests d'abord. **ADR 0044.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `zEffectData` gagne `target?: { creature_types?, exclude_creature_types?,
  immune_conditions_block? }` (Zod) ; `isValidTarget(effect, target)` dans
  `src/core/rules/` lit le type de créature (bloc de stats, espèce) et les
  immunités d'état.
- L'import SRD pose la restriction sur les sorts concernés (Charme-personne :
  humanoïde, etc.) — liste à relever dans le SRD, le contenu reste l'import.

**Critères d'acceptation**
- [x] Charme-personne sur un mort-vivant : refusé (test) ; sur un humanoïde :
  accepté ; un immunisé à Charmé : refusé.

**Réalisé** (par Opus : noyau du moteur et contexte déjà chargé, skill `deleguer` §1)
- `zEffectData.target` ; `isValidTarget`, `creatureTypeOf` (`src/core/rules/targetRestriction.ts`), tests d'abord.
- `data/srd/spell-targets.json` par édition (15 sorts en 2014, 7 en 2024, relevés dans le texte du SRD), testé (`srdSpellTargetsData.test.ts`) ; `mergeSpellTargets` dans l'import, qui crée le bloc `effects` s'il manque. SRD réimporté le 17 octobre, scripts d'après import rejoués.
- Fiche d'un sort : la restriction s'affiche sous l'effet.

*Écart* : `immune_conditions_block` est une liste d'états, pas un booléen (ADR 0044, « Réalisation »).
*Restes* : Amitié avec les animaux (Intelligence 4 ou plus) n'est pas modélisée ; Domination de bête est laissée sans restriction, son texte SRD dit « créature ».


---

### ☑ V3.1-105 — Cibler : le cœur commun de résolution · `L` · sans modèle IA — **fait le 17 octobre (ADR 0042)**

**Modèle conseillé : Opus** — extraction du tour solo, moteur. **ADR 0042.**
**Dépend de** : 101.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `src/server/services/targetedRoll.ts` : `resolveTargetedRoll` (entrée
  Zod de l'ADR) — lit la cible dans le combat `running`, lance (serveur),
  résout (`resolveAttackRoll`, `resolveDamageRoll`, sauvegarde contre DD
  pour un sort à jet du MJ, `eventsForAttack`, déclencheurs), calcule
  (`applyEffects`) et écrit ; touche → demande de dégâts chaînée (dés
  doublés au critique) ; PJ à 0 PV → jets contre la mort (ADR 0036 §8) ;
  créature à 0 PV → hors de l'initiative ; journal ; « Annuler » = écriture
  inverse journalisée.
- `applyResolvedTurn` (solo) délègue sa partie « appliquer » à ce service ;
  les tests du solo restent verts **sans modification**.
- Autorisation : MJ → tout participant ; joueur → son PJ comme acteur, et
  écriture refusée sur une cible qu'il ne contrôle pas (verdict seulement)
  tant que V3.1-104 n'est pas fait.

**Critères d'acceptation**
- [x] Touche, dégâts, états, soins résolus par le moteur et appliqués,
  journalisés (tests de service).
- [x] Les tests du solo passent tels quels.
- [x] « Annuler » rend l'état d'avant par une écriture inverse.

**Réalisé** (détail dans l'ADR 0042, « Réalisation »)
- Noyau, tests d'abord : `src/core/rules/targeting.ts` (`attackVerdict` 2024, `damageAfterSave`, `monsterSaveBonus`, `isOutOfFight`, `advanceTurnSkipping`/`retreatTurnSkipping`) ; `eventsForDamage` ; un critique sur un PJ à 0 PV coûte deux échecs (`turn.ts`).
- `src/server/services/targetedRoll.ts` : `applyResolvedEffects` (extrait du solo, qui l'appelle) et `resolveTargetedRoll` (attaque, dégâts, sort à attaque, sort à sauvegarde, soin ; acteur personnage ou monstre). Route `POST …/combats/[combatId]/targeted-roll` (MJ).
- `patchCombatParticipant` porte et annule les jets contre la mort ; le passage de tour saute une créature à 0 PV ; `castSpell` peut dépenser l'emplacement sans lancer de dégâts.
- Tests : `targetedRoll.integration.test.ts` 9/9 (dont un tour solo de bout en bout), `targetedRoll.noAi.test.ts` ; tests du solo inchangés et verts (`turnIntent.noAi`, `turnIntent.pendingRequest`, `characterActions`, `ownInitiative`).

*Écart* : un joueur n'a pas encore le « verdict seulement » prévu — il ne lit plus la CA adverse (ADR 0040) ; il viendra avec V3.1-104.
*Restes* : « Cibler » dans l'outil de dés (écran) ; jets secrets d'une fiche (ADR 0038) ; données de sauvegarde et de soins des sorts SRD (rares).


---

### ☑ V3.1-103 — Initiative : les jets d'initiative des joueurs · `M` · sans modèle IA — **fait le 17 octobre (ADR 0040)**

**Modèle conseillé : Opus** — changement de schéma. **ADR 0040.**
**Dépend de** : 101.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration : `combats.status` accepte `rolling` (« jets d'initiative »)
  entre `draft` et `running` ; `docs/SCHEMA.md`.
- Fonction `app.set_own_initiative(p_participant uuid, p_value int)` : seul
  le joueur dont le PJ (`campaign_characters.user_id`) est ce participant,
  seulement en `rolling`, valeur −10 à 40.
- Route `POST …/combats/[combatId]/my-initiative` (Zod) : `{ mode: "roll" }`
  (le serveur tire le d20 et ajoute l'initiative de la fiche, règle 8) ou
  `{ mode: "die", natural: 1..20, modifierIncluded: boolean }`.
- Le MJ : « Demander les jets » (draft → rolling), saisir à la place d'un
  joueur, « Commencer » (rolling → running), « Terminer » (confirmé).
- Chaque étape écrit un `session_events` de genre `combat`.

**Critères d'acceptation**
- [x] Un joueur ne peut écrire que l'initiative de son PJ, et seulement en
  `rolling` (test).
- [x] Invitation, jet, saisie du MJ, fin : journalisés.

**Réalisé**
- Migration `20261017090000_combat_rolling_own_initiative.sql` (appliquée le 17 octobre) : statut `rolling`, `public.set_own_initiative` (renvoie avant/après, `null` si refus).
- Noyau : `ownInitiativeFromDie`, `isOwnInitiativeInRange` (`src/core/rules/combat.ts`), tests d'abord ; schéma Zod `myInitiativeSchema` testé.
- Service `setMyInitiative` (`src/server/services/ownInitiative.ts`) : « lancer » par `rollInitiativeCheck` (jet enregistré et attribué, V3.1-89), « vrai dé » plus la Dextérité de la fiche ; journal au nom de la joueuse (`actor: player`), annulable. Route `POST …/combats/[combatId]/my-initiative`.
- Écran du MJ : statut « Jets d'initiative », « Demander les jets », « ▶ Commencer », « ■ Stop » confirmé ; planche `OutilsMJ.dc.html` complétée.
- Tests d'intégration : 3/3 (`ownInitiative.integration.test.ts`).

*Restes* : l'écran des joueuses qui appelle la route vient avec V3.1-38.


---

### ☑ V3.1-102 — Initiative : la vue filtrée des joueurs · `M` · sans modèle IA — **fait le 17 octobre (ADR 0040)**

**Modèle conseillé : Opus.** **ADR 0040.** **Dépend de** : 101.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Fonction `app.combat_player_view(p_combat uuid)` (`security definer`,
  `row_security = off`), vérifie que l'appelant est membre de la campagne ;
  renvoie par participant : `id`, `label`, `initiative`, ordre, `is_current`,
  `side`, états ; allié (PJ ou `is_ally`) : PV courants, max, temporaires ;
  adversaire : `wound` parmi `unhurt` (≥ max), `hurt` (> ½), `bloodied`
  (> 0), `down` (0). Jamais `ac`, `rule_key`, ni le nom d'entité d'un
  adversaire. Plus la ligne `combats` (statut, round, tour).
- Service `getPlayerCombatView`, route `GET
  /api/campaigns/[campaignId]/combats/active/player` (Zod).
- Le MJ touche `combats.updated_at` à chaque changement de participant
  (signal temps réel des joueurs).

**Critères d'acceptation**
- [x] La vue ne contient ni PV, ni CA, ni nom d'origine d'un adversaire (test).
- [x] Un non-membre reçoit un refus.

**Réalisé**
- Migration `20261016120000_combat_player_view.sql` (appliquée le 16 octobre) : `public.combat_player_view` (refus `42501` pour un non-membre) et trois déclencheurs par instruction qui touchent `combats.updated_at`.
- Noyau : `orderPlayerCombatView` (`src/core/rules/combatPlayerView.ts`), tests d'abord — même tri que l'écran du MJ, d'où `display_order` plutôt qu'un rang calculé en SQL.
- Service `getPlayerCombatView` (`src/server/services/playerCombatView.ts`), route `GET /api/campaigns/[campaignId]/combats/active/player`.
- Tests d'intégration : 4/4 (`playerCombatView.integration.test.ts`) — ni PV, ni CA, ni bestiaire, ni fiche d'origine d'un adversaire ; même tour que le MJ ; refus d'un non-membre ; signal du combat.

*Restes* : l'écran des joueuses (V3.1-38) lira cette route et ajoutera `combats` à la publication temps réel.


---

### ☑ V3.1-100 — Rejoindre sans choisir de PJ ; le lien qui vise un PJ précis · `M` · sans modèle IA — **fait le 16 octobre (ADR 0049)**

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
- [x] Une joueuse rejoint par un lien ouvert sans aucun PJ disponible, puis
  crée le sien depuis le carrousel.
- [x] Par un lien nominatif : carrousel réduit au PJ visé et à « Nouveau
  personnage », ouvert sur le PJ ; une autre joueuse ne voit pas ce PJ.
- [x] Réclamer le PJ réservé avec un autre compte est refusé par le serveur
  (test).

**Réalisé**
- Migration `20261016090000_nominative_player_invites.sql` (appliquée le 16 octobre) : `campaign_invites.entity_id`, `public.list_claimable_characters`, `public.claim_campaign_character`, `resolve_campaign_invite` renvoie `entity_id`, liste anonyme des PJ par jeton supprimée.
- Rejoindre ne choisit plus de PJ ; une joueuse sans PJ arrive sur `/joueur`. Un lien nominatif sert une fois (`claimed_by_user_id`) ; déjà utilisé par un autre, la page le dit avant le formulaire.
- Noyau : `claimableView` (`src/core/campaigns/claimable.ts`), tests d'abord. L'écran de choix reçoit `characters` et `startOn` du serveur ; le carrousel (V3.1-82) les lira.
- « Nouveau PJ » d'une joueuse : la fiche est réclamée avant l'écriture de ses blocs (`createCharacterFromWizard`, `claimInCampaignId`).
- Gestion de campagne : « pour : [PJ] » à la génération d'un lien joueur.
- Tests d'intégration : 11/11 (`campaignInvites.integration.test.ts`).

*Faille relevée en route, fermée* : `campaign_characters_write` laissait tout compte connecté s'attribuer une fiche, donc en devenir éditeur. Écriture directe réservée au MJ ; inscrite au registre de `SECURITE.md`.


---

### ☑ V3.1-89 — Statistiques : attribuer chaque jet (données, ADR) · `M` · sans modèle IA — **fait le 14 octobre (ADR 0064)**

**Modèle conseillé : Opus** — changement de schéma, quatre chemins
d'écriture, RLS d'une table temps réel.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Le problème** : `dice_rolls` ne dit pas **qui** a lancé (seulement
`rolled_by` : player, gm, ai, system) ni **pour quel personnage** ; `who`
est un nom affiché, instable (renommage, homonymes). Et avec avantage ou
désavantage, la trace porte les deux d20 sans dire lequel est gardé.

**Proposé (à trancher, ADR à l'appui)**
- **Qui a lancé** : `dice_rolls.rolled_by_user_id`, **déjà décidé par
  l'ADR 0038** (salon et jets secrets, V3.1-22) et posé par le serveur.
  Ne pas créer de seconde colonne : si V3.1-22 n'est pas encore fait, ce
  ticket ajoute cette colonne-là, sous ce nom, et V3.1-22 la réutilise.
- Migration nouvelle : `dice_rolls.entity_id uuid null references
  entities(id) on delete set null` ; index `(campaign_id, entity_id,
  created_at desc)`. Rempli par les quatre chemins d'écriture : l'entité du
  jet quand il y en a une — jet libre : l'entité réclamée par l'appelant
  dans la campagne, sinon null.
- `detail.naturalD20` (entier 1 à 20, ou absent sans d20) : **le d20
  gardé**, écrit au moment du jet par le serveur (règle 8). `detail.kind` :
  `attack`, `damage`, `check`, `save`, `spell`, `heal`, `free` — pour
  regrouper « l'action la plus utilisée » sans analyser du texte.
- **Jets anciens** (sans ces champs) : `entity_id` reste null ; on ne
  devine pas par le nom (homonymes). Ils sont **exclus** des statistiques
  personnelles (**confirmé par l'auteur le 9 octobre** : pas de rattrapage),
  et le volet le dit (« Statistiques depuis le … », date de la migration).
- **Les jets secrets ne comptent jamais** (décision de l'auteur, 9
  octobre) : `listRollsForStats` ne lit que les jets `visibility_level =
  'public'` — ni les jets cachés du MJ (`gm`), ni les jets secrets d'un
  joueur (`roller`, ADR 0038), **pas même pour leur auteur**. Même règle pour
  la moyenne de la table.
- RLS : inchangée en lecture. Les nouvelles colonnes ne s'écrivent que côté
  serveur.
- **Monnaie** : vérifier que les mouvements de monnaie (services de jeu,
  V3.1-24) créent encore une révision du bloc `inventory` ; si la monnaie a
  migré vers `entity_runtime_state`, `campaignEconomy.ts` ne la voit plus et
  il faut une autre source (journal de mouvements ou `session_events`).
  Trancher, et documenter dans l'ADR.
- **Les titres sont des données** (le superadmin les change, V3.1-92) :
  proposé, une table `player_title_tiers` (`family` parmi `luck`, `bad_luck`,
  `purse`, `favorite_action` ; `position` ; `range_from numeric`,
  `range_to numeric null` (null = sans borne) pour les trois premières ;
  `action_kind` pour la quatrième ; `name` ; `template` (petit texte à
  variables) ; `icon_key` parmi douze icônes **du code** ; `color_token`
  parmi `success`, `danger`, `accent`, `link_entity`, `link_rule`),
  globale à la plateforme. RLS : lecture pour tout compte connecté,
  écriture superadmin. Valeurs par défaut insérées par la migration
  **comme réglages**, pas comme contenu de règles. Zod valide `icon_key`,
  `color_token` et les variables du `template`.
- Contrat pour V3.1-90/91 : `listRollsForStats(campaignId, entityId,
  sinceSessionId?)` renvoie `{ naturalD20, kind, what, result, sessionId,
  createdAt }[]` (repo) ; `getPlayerEconomy(entityId, sinceSessionId?)`.

**Critères d'acceptation**
- [x] ADR ; migration ; `docs/SCHEMA.md` ; types régénérés.
- [x] Les quatre chemins écrivent `rolled_by_user_id`, `entity_id`,
  `naturalD20`, `kind` (tests d'intégration).
- [x] Avantage : `naturalD20` = le plus haut des deux ; désavantage : le
  plus bas (test).
- [x] Aucun jet `gm` ni `roller` n'apparaît dans `listRollsForStats`, même
  lu par son auteur (test).

**Réalisé**
- Migration `20261014090000_dice_rolls_attribution.sql` (appliquée le 14 octobre) : `rolled_by_user_id` (posé par la base, `default auth.uid()`) et `entity_id` ; index `(campaign_id, entity_id, created_at desc)` ; `dice_rolls_insert` refuse un autre compte et un personnage que l'auteur ne peut pas modifier ; table `player_title_tiers` et ses quatorze paliers.
- Noyau : `naturalD20FromTrace` et `DICE_ROLL_KINDS` (`src/core/dice/rollAttribution.ts`), `zPlayerTitleTier` et `DEFAULT_TITLE_TIERS` (`src/core/stats/titleTiers.ts`), tests d'abord.
- `DiceRollAttribution` obligatoire dans `insertDiceRoll` : les quatre chemins la fournissent. Contrat pour 90 et 91 : `listRollsForStats` (jets publics seulement) et `listPlayerRolls`, `getPlayerEconomy` (`src/server/services/playerStats.ts`).
- Monnaie : toujours dans le bloc `inventory`, donc dans ses révisions ; `campaignEconomy` reste la source.
- Tests d'intégration : 30/30 sur les trois fichiers des jets.

*Faille relevée en route, fermée* : l'usurpation du compte ou du personnage d'un jet. *Reste ouvert, antérieur* : un membre peut insérer lui-même un jet public au résultat inventé ; il ne fausse que ses propres statistiques. Les deux sont inscrits au registre de `SECURITE.md`.


---

### ☑ V3.1-96 — Chronologie : portée, événements directs, naissances et morts (données, ADR) · `M` · sans modèle IA — **fait le 14 octobre (ADR 0048)**

**Modèle conseillé : Opus** — forme d'une donnée de bloc, une fiche
système, une agrégation filtrée côté serveur.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Départ** : `src/core/schemas/blocks/timeline.ts`,
`src/server/services/timeline.ts` (`getWorldTimeline`), la route
`timeline-promote`. **Dépend de** : V3.1-74 (dates de naissance et de mort).

**À trancher, ADR à l'appui** (les trois points de la décision du 9 octobre)
1. **La portée** d'une entrée de chronologie : champ `scope` parmi `major`
   (Monde), `notable` (Région), `detail` (Détail), **optionnel** — absent =
   défaut selon le genre : guerre, catastrophe, fondation → `major` ;
   bataille, découverte, serment, trahison → `notable` ; naissance, mort,
   rencontre → `detail`. Naissances et morts des fiches personnage →
   `detail`. Nouvelle version du schéma de bloc (`__v`), migration des
   données lue par le schéma, pas de réécriture en base.
2. **Où vit un événement ajouté directement** dans la frise générale.
   Proposé : le bloc Chronologie d'une **fiche système « Chronologie du
   monde »**, une par monde, hors des listes du wiki (comme le Livre de
   sessions), plutôt qu'une table nouvelle. À confirmer ou remplacer.
3. **L'agrégation** : `getWorldTimeline` lit aussi les naissances et morts
   des blocs personnage (V3.1-74), **en une requête groupée** (pas de N+1),
   et filtre chaque date par sa visibilité **côté serveur** (règle 5) : une
   date MJ ou privée n'est jamais envoyée à une joueuse.
- Chaque entrée renvoyée dit d'où elle vient (`source` : fiche et bloc, ou
  frise générale, ou naissance / mort d'un personnage) pour « Depuis la
  fiche de… ». Les séances n'y entrent pas.
- Une action serveur pour **changer la portée** d'une entrée (MJ) et pour
  **ajouter un événement** dans la frise générale ou dans une fiche ; Zod.

**Critères d'acceptation**
- [x] ADR ; schéma de bloc versionné ; `docs/SCHEMA.md` à jour si une table
  ou une fiche système naît.
- [x] Une joueuse ne reçoit aucune date qu'elle ne peut pas voir (test).
- [x] Une seule requête pour les naissances et morts d'un monde (test).

**Note de clôture (14 octobre, Opus).** Détail dans l'[ADR 0048](../adr/0048-les-donnees-de-la-chronologie.md), section « Réalisé ».

*Fait* :
- portée (`resolveScope`) et entrées de naissance et de mort (10 tests du noyau) ;
- fiche système `world_timeline` (migration `20261013160000`, appliquée par l'auteur le 14 octobre) ;
- `getWorldTimeline` en une requête, filtrée bloc puis entrée (3 tests) ;
- deux actions serveur Zod : ajouter un événement, changer une portée ;
- `WIKI_HIDDEN_KINDS` pour les fiches système.

*Faille relevée en route, fermée* : un joueur pouvait créer la fiche système avant le MJ. Inscrite au registre de `SECURITE.md`. Le test d'intégration échouait avant la migration et passe après (3/3).

*Restes* : l'écran de la frise (portées, filtres, ajout d'un événement) vient avec V3.1-97 et 98, qui lisent `scope` et `source`.

### V3.1-146 — Musique : la position et la durée de la piste YouTube (26 octobre)

Codé par `dev-sonnet`, relu par Opus.
- Le lecteur partagé relève la position de la voix YouTube une fois par seconde, **seulement en lecture** : arrêt en pause, à la fin, au changement de piste et au démontage (`actionReleve`, testée).
- Un contexte à part, `MusicProgressContext`, publie la position : la radio et le bouton public ne se redessinent pas chaque seconde.
- Les durées connues restent en mémoire : aucun champ au schéma `music`, aucune requête.
- La platine montre la barre et « 0:30 / 1:18 », relatifs aux bornes.
- La liste montre la durée une fois connue, masquée au téléphone.
- Spotify, SoundCloud et la page de lecture ne changent pas.

*Reste* : la durée se perd au rechargement de la page (choix du ticket).

### V3.1-147 — Fiche de créature : le repaire et les défenses (26 octobre)

Opus : schéma et serveur. `dev-sonnet` : interface.
- Le schéma `statblock` gagne `lair` (une fiche) et `defenses` (quatre listes), tous deux facultatifs ; un ancien bloc reste valide (tests du schéma).
- `statblockLair.ts` résout le repaire pour le lecteur, dans le wiki public (fiches publiques) et la coquille joueur (`listPlayerVisibleEntityIds`). Un repaire caché est retiré de la donnée du bloc. Tests d'intégration : public et vrai compte joueur.
- La fiche affiche « · repaire » dans l'en-tête (lien de fiche) et « Défenses » dans Maîtrises, une ligne par catégorie présente.
- Le formulaire gagne le choix du repaire et quatre listes en pastilles.
- Aucune règle de dégâts ne change : V3.1-137 lira ces listes.

*Faille relevée en route, fermée le même jour* : dans la coquille joueur, une mention de texte ou d'Encadré vers une fiche réservée au MJ envoyait son nom et son slug. Les fiches citées sont désormais filtrées par ce que le joueur voit (registre de `SECURITE.md`, test d'intégration).


### V3.1-49 — Création : le chemin qui se ramifie (31 octobre)

Opus, de bout en bout (ADR 0068). Deux décisions de l'auteur en route : ajouter au 49 l'Expertise et l'Argot des voleurs, absents des données, et poser un sélecteur générique en attendant les sélecteurs fins du 118.
- **Noyau** : un choix de compétence peut être une `expertise`. `resolveChoices` ne la retient que sur une compétence maîtrisée ailleurs (`otherFeatures`, ou un autre choix). Chaque source de choix porte son origine (espèce, classe, historique), et les aptitudes de classe ouvrent leurs choix au niveau de leur classe.
- **Données** : `rogue-expertise` (deux au niveau 1, deux au niveau 6) et `rogue-thieves-cant` (Argot imposé, plus une langue). L'import accepte les choix des aptitudes de classe ; `ingest-srd` relancé le 31 octobre.
- **Chemin** (`lib/ui/cheminCreation.ts`, pur, 16 tests) : les étapes, les sous-étapes nées de chaque source, l'ordre Précédent / Suivant et les compteurs. Il est recalculé à chaque rendu, donc un choix disparaît quand sa source change.
- **Assistant** :
  - étapes à gauche, écran au centre, aperçu en direct à droite (grille des 18 compétences) ;
  - plus d'étape Compétences, les langues sous Identité ;
  - un choix ouvert n'empêche pas de créer ;
  - tablette sans colonne d'aperçu, téléphone avec une étape par écran et une barre de progression ;
  - la mise en page suit la largeur du conteneur, donc de la fenêtre du MJ.
- **Joueuse** : mêmes droits que le MJ ; `playerRestricted` et `hideAddClass` disparaissent.
- **Fiche jouable** : un bandeau rappelle les choix ouverts.
- **Vérifié au navigateur** :
  - Humain → Don d'origine → Initié à la magie → Liste → Sorts mineurs (7 sorts du clerc), puis disparition en passant à Elfe ;
  - un Guerrier 3 / Roublard 2 créé côté MJ avec 8 choix ouverts, rappelés sur la fiche, puis supprimé ;
  - Testeuse A : niveau de départ et seconde classe accessibles, sans valider ;
  - mise en page à 1440, 820 et 390 px.

*Restes* :
- les sélecteurs fins par genre de choix (118) ;
- l'équipement A/B et la sous-classe en sous-étapes (50 à 53) ;
- l'Expertise du Barde et du Rôdeur, à saisir sur le même modèle ;
- `RemainingChoicesStep` sert encore à la montée de niveau (51).

### V3.1-50 — Création : Origines, Historique et un seul sélecteur de sorts (31 octobre)

Opus : le noyau et les données ; `dev-sonnet` : les écrans ; relu et corrigé par Opus.
- **Noyau** : `spellNumbers`, la seule formule du DD et de l'attaque des sorts (le moteur l'écrivait deux fois). `choiceEffects.ts` chiffre chaque option d'un choix pour ce personnage : DD et attaque d'une caractéristique d'incantation, total d'une compétence, et « déjà maîtrisée (Acolyte) ».
- **Chemin** : le don qu'accorde l'historique devient une seule sous-étape, « Don : Initié à la magie (Clerc) · n/3 », dont l'écran réunit les choix en sections. La cascade de Polyvalent sous Espèce garde ses sous-étapes.
- **Écrans** :
  - un seul sélecteur de sorts (`SelecteurSorts`, avec la fiche du sort touché), pour l'étape Sorts comme pour tout choix de sort ;
  - Espèce et Historique en petites cartes, avec la fiche de la sélection et « Ce qui en naît » ;
  - un tableau comparatif des lignages aux niveaux 1, 3 et 5 ;
  - les jetons « +2 et +1 » ;
  - l'équipement de l'historique en deux cartes A et B.
- **Maîtrises** : `dedoublonnerMaitrises` réunit les doublons et traduit, par exemple l'outil de l'Acolyte. Le jeu du Soldat était un `proficiency_choices` du SRD, que le serveur ignorait. Il devient un choix d'outil en données (`soldier`, sous-étape « Un jeu » en cartes), affiché dans les maîtrises ; `ingest-srd` relancé le 31 octobre.
- **Corrections d'Opus** :
  - les jetons de l'historique recalculaient le modificateur et codaient un plafond de 20 : ils lisent maintenant la fiche du moteur ;
  - la vitesse d'une option de lignage s'affichait en pieds : elle est en mètres.
- **Vérifié au navigateur** :
  - le don de l'Acolyte et ses sections ;
  - le tableau du lignage elfique (Vitesse +1,5 m) ;
  - « mod. +0 → DD 10, attaque +2 », avec « celle de votre classe » ;
  - Sens aiguisés : « déjà maîtrisée (Acolyte) » ;
  - le Soldat : Échecs draconiques dans les maîtrises, aucun doublon, tout en français.

*Restes* :
- la double « Lance » de la vérification du 11 octobre n'a pas été reproduite ; le dédoublonnage la couvre, mais le serveur pousse toujours une ligne par source ;
- les vitesses d'espèce s'écrivent « 9.1 m » (point décimal), comme avant.

### V3.1-51 — Création : la Classe, et le même écran pour monter de niveau (31 octobre)

Opus : le noyau et la route. `dev-sonnet` : les écrans. Relu, et un correctif d'Opus.
- **Noyau** :
  - chaque choix ouvert porte le niveau qui l'ouvre et sa classe (`atLevel`, `classKey`), et les sous-étapes du chemin aussi ;
  - `progressionClasse` (pure) donne une ligne par niveau (acquis, atteint, nouveau, à venir) avec ses pastilles (choix, sous-classe, amélioration) et le compte « Choix de niveau · n à faire » ;
  - `sousEtapesNouvelles` réduit la montée de niveau à ce qui change.
- **« Lancer tous »** : `roll-hp` lance plusieurs dés de vie en un appel. Son corps est strict : un client qui envoie un résultat est refusé (`lib/characterCreator/desDeVie.ts`, testé).
- **Écrans** :
  - les classes en emplacements, avec les prérequis et le plafond du ruleset ;
  - la progression avec ses pastilles ;
  - les Points de vie ligne par ligne ;
  - la montée de niveau dans le même assistant : classe existante ou nouvelle, plusieurs niveaux d'un coup, aperçu avant → après, UNE écriture (`level-up`, PV en intentions).
- **Suppressions** : `LevelUpWizard.tsx`, `HpRollStep.tsx` et `RemainingChoicesStep.tsx` n'existent plus.
- **Correctif d'Opus** : la validation de la montée renvoyait 409. Le bouton se désactivait pendant l'envoi ; le focus quittait alors la carte du bloc, dont la sauvegarde sur perte de focus faisait monter la version pendant la requête. Le bouton n'est plus désactivé, un garde empêche le double envoi.
- **Vérifié au navigateur** :
  - Clerc 3 / Guerrier 2 : deux emplacements, niveau 5, pastilles « compétences » (ligne 1) et « Sous-classe » (ligne 3), « Choix de niveau · 1 à faire » ;
  - montée de 3 niveaux en ajoutant une classe (Moine) : aperçu « Niveau 8 → 11 », une seule écriture, 200, PV en moyenne calculés par le serveur.

*Restes* :
- la sauvegarde sur perte de focus des cartes de bloc enregistre même un bloc inchangé, et fait monter sa version à chaque fois : des écritures inutiles, et un risque de 409 ailleurs ;
- aucun test d'intégration ne couvre `applyLevelUp` ;
- les prérequis de multiclassage s'affichent à la création sans la bloquer (le serveur ne les vérifie qu'à la montée).
