# V3.2 — Les colonnes du solo

*Partie du backlog V3.2. L'index et la feuille de route : [`docs/BACKLOG_V3.2.md`](../BACKLOG_V3.2.md).*

---

### ☐ V3.2-7 — L'onglet Wiki : chercher et lire sur place · `M` · sans modèle IA — **prêt (Sonnet), Opus relit l'audience**

**Demandé le 18 novembre** : « j'aimerais revoir l'onglet wiki pour qu'il permette de voir la page wiki d'un élément directement dedans. Mais du coup il faudrait un champ de recherche dedans. »

**Aujourd'hui**, la colonne gauche du solo (V3-D3) liste les fiches connues par groupe, et chaque nom est un **lien qui quitte l'écran de jeu** pour l'onglet Wiki. En pleine séance, on perd la scène, le fil, et la place qu'on avait dans le texte — pour relire trois lignes sur une auberge.

**À faire.**
- Un **champ de recherche** en tête de l'onglet. La logique pure existe déjà : `filtrerWiki` (`lib/ui/solo.ts`) filtre les groupes par nom, accents et casse ignorés, et vide les groupes sans résultat. Rien à inventer, juste à poser.
- La fiche **s'ouvre dans la colonne**, sans quitter le jeu : le même composant que la fiche d'accompagnement du cahier (`FicheCompanion`, qui sait déjà afficher une entité ou une règle dans un panneau, et se replie au téléphone en feuille du bas).
- Un retour franc vers la liste, et le fil qui ne bouge pas derrière.

**Ce qu'Opus relit** : l'audience. La colonne ne liste que les fiches **découvertes** (V3-C4) ; ouvrir une fiche sur place doit passer par le même filtrage côté serveur que l'onglet Wiki, jamais par un rendu plus bavard parce qu'il est « dans le jeu » (règle absolue 5).

**Câblage** (`docs/CABLAGE.md`) : la liste arrive déjà avec la page. Le contenu d'une fiche se charge **au clic**, une fois, jamais en masse à l'ouverture de la colonne.

**Critères d'acceptation**
- [ ] Chercher « fan » trouve « Mabelle, du Fanal » ; la fiche s'ouvre dans la colonne ; le fil n'a pas bougé.
- [ ] Une fiche non découverte reste introuvable et illisible.
- [ ] À 390 px, la fiche s'ouvre en feuille du bas et se referme sur la liste.
- [ ] Aucun chargement de plus à l'ouverture de l'écran solo.

---

### ☐ V3.2-8 — Les volets : le fil s'étale, un onglet au bord de chaque volet · `M` · sans modèle IA — **prêt (Sonnet)**

**Demandé le 25 novembre**, captures à l'appui : volets fermés, le texte reste étroit au centre ; les languettes de repli sont mal placées (surtout la gauche, isolée loin du texte) et touchent la barre de défilement du fil et les bulles des PNJ. Esquisses et choix de l'auteur : <https://claude.ai/artifact/SY2zL6VoSLivR8tuu8yxgh> (options **A2** et **C1**).

**Aujourd'hui** (`components/solo/SoloShell.tsx`) : volets fermés, le fil est plafonné à `max-w-[80ch]` et centré (choix délibéré de V3.1-36, que l'auteur renverse). Les deux `PoigneeRepli` sont à mi-hauteur, dans la gouttière de 12 px, et le Monde replié disparaît entièrement.

**À faire.**
- **Le fil s'étale (A2).** Le cadre du fil (barre de défilement, bulles du joueur, boîte de saisie) prend toute la largeur libérée. Seuls les paragraphes de narration gardent un plafond, vers 110 caractères. Retirer le commentaire « le fil ne s'étale pas » et dire pourquoi le plafond est sur le paragraphe, pas sur la colonne.
- **Un onglet accroché au volet (C1).** Chaque bouton de repli devient un onglet qui sort du bord intérieur de son volet, **en haut**, au niveau de la première ligne du fil. Même recette que l'onglet du menu principal (`Rail.tsx`, « replierMenu » : bordure ouverte côté volet, coins arrondis côté fil). Ouvert ou fermé, l'onglet garde sa hauteur et suit le bord.
- **Un couloir de 20 px** entre les colonnes au lieu de 12, et la barre de défilement du fil rentrée d'un cran (marge intérieure) pour ne jamais toucher l'onglet.
- **Le Monde replié devient une bande** d'environ 44 px, comme la fiche devient une bande de jauges. La bande montre les icônes des quatre onglets (Wiki, Quêtes, Présents, Règles) ; un clic rouvre le volet sur cet onglet. Garder le piège noté dans le code : les deux bornes de `grid-template-columns` doivent rester des `minmax()` de même forme.
- Ne pas toucher à la boîte « Que fais-tu ? » au-delà de sa largeur (V3.2-2).

**Catalogue** : mettre à jour la planche `docs/catalogue/Solo.dc.html` (onglet de volet, bande du Monde, couloir).

**Critères d'acceptation**
- [ ] À 1440 px, les deux volets fermés : la barre de défilement du fil est au bord de la bande de la fiche, les bulles du joueur à droite, la narration plafonnée vers 110 caractères.
- [ ] Volets ouverts ou fermés, aucun onglet ne chevauche la barre de défilement, une bulle ou le nom d'un PNJ.
- [ ] Monde fermé : bande de 44 px, onglet à son bord ; un clic sur l'icône Présents rouvre le volet sur Présents.
- [ ] L'onglet garde sa hauteur entre ouvert et fermé ; le chevron indique ce qui va se passer.
- [ ] Rien ne change sous 1024 px (onglets de tablette, vues du téléphone).
- [ ] Le pli reste mémorisé par monde ; sans animation si les animations sont réduites.

---

### ☐ V3.2-9 — L'attitude **perçue** des présents arrive à l'écran · `M` · sans modèle IA — **à concevoir (Opus)**

**Demandé le 25 novembre**, avec une précision qui fait tout le ticket : ce que l'écran montre est **la perception du joueur**. Un PNJ peut ne pas ressentir ce qu'il montre, et tromper le joueur.

**Aujourd'hui** : `SceneView.present[].disposition` et `sketches[].disposition` existent mais **rien ne les écrit**. Les attitudes réelles vivent dans `entity_attitudes.axes` (sept axes, bandes nommées, `specs/psyche-pnj.md` §3), mais rien ne dit ce qu'un PNJ **laisse voir**.

**À trancher par l'ADR.**
- **Où vit la façade.** Une attitude affichée distincte de l'attitude réelle : seconde série d'axes par paire, champ « feint » sur le bloc `relationship`, ou dérivation (perçu = réel sauf dissimulation déclarée). Toute option qui touche au schéma passe par une migration nouvelle et `docs/SCHEMA.md` (règle 14) : **s'arrêter et demander** avant de l'écrire.
- **Ce qui part au client.** Seulement la bande perçue d'amitié (et d'attirance, voir plus bas), en mots, jamais le nombre (`specs/psyche-pnj.md` §1.5). La vraie valeur, quand elle diffère, ne quitte jamais le serveur (règle absolue 5) — pas même dans un champ inutilisé du JSON.
- **L'attirance.** La spécification la range du côté MJ par défaut, désactivable pour tout un monde. Proposition faite le 25 novembre, à confirmer par l'auteur : le rose ne s'affiche que si le monde active l'axe **et** que le PNJ l'a montré.
- **Ce que reçoit le modèle** (règle 11). Pour jouer une tromperie, le narrateur doit-il connaître l'attitude réelle ? Si oui, sous quelle consigne, pour qu'il narre la façade sans la trahir (même fuite que `known_as`, §3).
- **Les esquisses** (V3-C2) : un personnage sans fiche a-t-il une attitude perçue, et d'où vient-elle (tirage à graine fixe, ADR 0104) ?
- **Quand la perception change** : qui l'écrit (moteur, proposition de l'IA validée, règle 9), et le signal de deux crans ou plus déjà prévu par la spécification.

**Lien** : V3.1-227 (les inconnus dans Présents) tranche ce qu'un présent non découvert montre ; les deux ADR doivent rester cohérents.

**Critères d'acceptation (de la conception)**
- [ ] ADR écrit ; tickets prêts découpés.

---

### ☐ V3.2-10 — Les présents dans la bande du Monde fermé · `S` · sans modèle IA — **prêt (Sonnet) après V3.2-8 et V3.2-9**

**Demandé le 25 novembre.** Volet gauche fermé, la bande montre un rond par personne présente, avec ses initiales et un anneau qui dit comment elle **semble** percevoir le personnage. Esquisses : <https://claude.ai/artifact/SY2zL6VoSLivR8tuu8yxgh#presents>, option **D2** choisie.

**À faire.**
- **L'anneau est une jauge.** Couleur du cran d'amitié perçu (du rouge « haineux » au vert-bleu « dévoué ») **et** longueur de l'arc (un petit bout pour « haineux », la moitié pour « indifférent », le tour complet pour « dévoué ») : même langage que l'anneau des PV, et lisible sans distinguer le rouge du vert. Couleurs par jetons (`src/styles/tokens.css`), contraste vérifié.
- **L'attirance a son cercle.** Un second cercle fin, rose, à l'extérieur, rempli au tiers, aux deux tiers ou en entier (intrigué·e, attiré·e, épris·e), seulement quand V3.2-9 l'autorise.
- **Rangés par distance** (au contact, proche, loin), séparés d'un trait ; les lointains un peu pâlis.
- **Pointillés** pour une esquisse sans fiche, comme sa carte dans l'onglet Présents.
- **Halo** léger sur le PNJ qui a parlé au dernier tour.
- **Au survol**, une étiquette : nom et crans en mots (« Mabelle du Fanal · cordiale · intriguée »). **Au clic**, le volet se rouvre sur Présents, à cette personne. Le rond est un bouton, avec un nom accessible complet.
- Le même rond devant chaque carte de l'onglet Présents ouvert.
- Un changement de deux crans ou plus fait pulser l'anneau une fois (rien si les animations sont réduites).

**Câblage** : aucune requête de plus, la scène arrive déjà avec la page ; les données viennent du champ posé par V3.2-9.

**Catalogue** : nouvelle entrée « rond de présent » sur `docs/catalogue/Solo.dc.html`.

**Critères d'acceptation**
- [ ] Les cinq personnes des esquisses s'affichent avec le bon cran, dans l'ordre des distances.
- [ ] Un PNJ qui feint l'amitié montre l'anneau de l'amitié feinte ; sa vraie attitude n'est nulle part dans la réponse du serveur.
- [ ] Monde sans axe d'attirance : aucun cercle rose, jamais.
- [ ] En niveaux de gris, les sept crans restent distincts par la longueur de l'arc.
