# V3.2 — 9. L'écran de jeu : rail de jeu, volet de consultation, personnes, combat

**Décision :** [ADR 0120](../adr/0120-l-ecran-de-jeu-rail-volet-et-personnes.md)

Demandé le 26 novembre après la partie test avec Mabelle ; maquettes validées le 27 : écran entier <https://claude.ai/artifact/PVTf6Lvj167TpHx43vFzPA>, volet d'une personne et matrice <https://claude.ai/artifact/WBb2ad4MJytXezSDnQmUzs>.

**Ordre :** lot 1 (V3.2-55 à 58) et lot 3 (V3.2-59), sans migration ; les petits correctifs (V3.2-69 à 71) ; lot 2 (V3.2-60 à 65), après V3.2-15 et V3.2-49 pour ce qui en dépend ; lot 4 (V3.2-66 à 68), après son ADR.

---

## Lot 1 — Le rail de jeu et le volet de consultation

### ☐ V3.2-55 — En jeu, le rail devient le rail de jeu · `M` · sans modèle IA · Modèle conseillé : Opus

- Sur `/joueur/solo` (ordinateur), `PlayerShell` remplace ses destinations par : Quitter (vers Personnage), puis un emplacement que la page remplit par un portail (Quêtes, Changements, Wiki, Règles, Notes, puis les présents), puis Réglages (apparence), l'atelier pour qui administre, et la dalle du dé. Chat et Prochaine session disparaissent en jeu.
- Les présents : six visages au plus, rangés par distance (au contact, proche, loin), esquisses en pointillés, puis « +x » qui ouvre la liste groupée dans le volet. Rail déplié : nom et attitude perçue à côté de chaque visage.
- Le repli du rail (204 ↔ 64 px) et son animation restent ceux de `Rail.tsx`.
- `/mj/distance` et `/joueur/distance` ne changent pas (ADR 0103).

**Critères d'acceptation**
- [ ] Sur la page solo, le rail ne montre plus Chat ni Prochaine session ; Quitter ramène à Personnage.
- [ ] Huit présents : six visages puis « +2 ».
- [ ] Une page solo sans personnage garde un rail avec Quitter.

### ☐ V3.2-56 — Le volet de consultation · `M` · sans modèle IA · Modèle conseillé : Opus

- La colonne gauche de `SoloShell` devient un volet de 380 px, fermé à 0 px, animé en 320 ms (deux bornes `minmax()` de même forme, piège noté dans le code). Fermé, le fil prend toute la largeur.
- Le volet montre l'entrée choisie dans le rail, sans onglets : un titre, un bouton de fermeture. Un second clic sur l'entrée active le ferme. Il reste ouvert pendant les tours.
- L'ancienne bande du Monde replié n'existe plus sur la page solo (le rail porte les présents).

**Critères d'acceptation**
- [ ] Clic sur Quêtes : le volet s'ouvre sur les quêtes ; second clic : il se ferme et le fil s'élargit.
- [ ] Le choix ouvert/fermé et l'entrée survivent à un rechargement (confort de navigateur, `localStorage`).

### ☐ V3.2-57 — Les fiches et les règles se lisent en entier dans le volet · `M` · sans modèle IA · Modèle conseillé : Opus

- Une fiche du wiki choisie dans le volet s'affiche en entier dans le volet, avec le même corps de fiche que `/joueur/wiki/[slug]` (lecture seule, vue joueur), au lieu de l'extrait et du lien qui faisait quitter la partie.
- Une règle (onglet Règles, ou renvoi cliqué dans le fil) s'affiche dans le volet par la route `/window` des règles, comme `PanneauRenvoi`.
- Un bouton « retour » ramène à la liste. Aucune requête au rendu de la page : la fiche se charge au clic (`docs/CABLAGE.md`).

**Critères d'acceptation**
- [ ] Ouvrir Mabelle depuis le Wiki du volet n'ouvre aucune autre page.
- [ ] Un renvoi de règle dans le récit s'ouvre dans le volet.

### ☐ V3.2-58 — Les notes dans le volet · `S` · sans modèle IA · Modèle conseillé : Sonnet

- L'entrée Notes ouvre dans le volet une prise de notes simple de la partie, au lieu de la page Notes.

**Critères d'acceptation**
- [ ] Écrire une note pendant la partie sans quitter l'écran de jeu.

---

## Lot 3 — La date

### ☐ V3.2-59 — La date et la saison, dans le bandeau et pour l'IA · `S` · sans modèle IA · Modèle conseillé : Opus

- Le bandeau affiche jour de la semaine, jour, mois, année et saison avant l'heure, quand le calendrier du monde a une date du jour à la précision du jour (`calendar.currentDate`) ; sinon rien (comportement actuel de `sceneDateLabel`).
- `formatDate` gagne un vocabulaire de saison (d'après le mois et l'hémisphère du calendrier, ou la saison de la météo).
- La même date entre dans le contexte du tour de l'IA, à côté de la météo (`describeWeatherForAi`).

**Critères d'acceptation**
- [ ] Tests du noyau : « jeudi 14 brumaire 1247, automne ».
- [ ] Le contexte du tour porte la date ; sans date du jour, il n'en invente pas.

---

## Lot 2 — Le volet d'une personne

### ☐ V3.2-60 — Le volet d'une personne : portrait, état, humeur · `M` · sans modèle IA · Modèle conseillé : Opus

- Clic sur un visage du rail : le volet montre cette personne. En tête, l'anneau-jauge de 116 px avec le portrait du wiki dedans (initiales sinon), le nom pour la table, puis l'état physique (indemne vert, blessé jaune, en sang rouge, à terre gris, jamais les PV), les conditions visibles et l'humeur visible.
- Lien vers sa page du wiki (dans le volet, V3.2-57).

**Critères d'acceptation**
- [ ] Mabelle indemne : pastille verte, aucun chiffre de PV dans la réponse du serveur.

### ☐ V3.2-61 — « Envers toi » : barres continues avec zone floue · `M` · sans modèle IA · Modèle conseillé : Opus

- Le serveur envoie, pour chaque axe perçu, la valeur perçue arrondie à 5 et une largeur de flou ; jamais la valeur ressentie (règle 5).
- Sept barres continues, zone floue autour du curseur ; l'attirance toujours affichée (« rien de perceptible » sinon) ; « T'appelle » (`known_as`).

**Critères d'acceptation**
- [ ] Test : un PNJ qui feint l'amitié envoie la valeur feinte arrondie, et aucune trace de la vraie.

### ☐ V3.2-62 — Fiche, inventaire et magie découverts · `M` · sans modèle IA · Modèle conseillé : Opus — **après V3.2-49**

- La fiche (allégée ou complète) ne montre que les facettes découvertes, « ? » pointillé sinon ; elle passe en tête pendant un combat.
- Classe d'armure estimée d'après l'armure vue, resserrée par les attaques du personnage. Jamais PV max, FP, ressources restantes.
- Inventaire vu, bourse en mots ; sorts vus (« sait lancer des sorts »), nommés sur un jet d'Arcanes dont le moteur fixe le DD.

**Critères d'acceptation**
- [ ] Garde en cotte de mailles et bouclier : « CA 18 », sans jet.
- [ ] Aucune facette non découverte dans la réponse, même vide.

### ☐ V3.2-63 — La psyché découverte · `M` · sans modèle IA · Modèle conseillé : Opus — **après V3.2-49**

- Tempérament (6 pôles), Convictions (7), Aspirations, Lignes et limites, Façon de parler, Ses liens, Ce qui a changé son attitude : seulement les éléments découverts, chacun avec « comment tu le sais » au survol.
- Facettes de psyché dans la table de V3.2-49 (ADR 0120 §7).

**Critères d'acceptation**
- [ ] Une aspiration cachée n'apparaît qu'après un jet de Perspicacité réussi ou un aveu.

### ☐ V3.2-64 — Ce que l'IA observe, le moteur l'enregistre · `M` · **avec** modèle IA · Modèle conseillé : Opus

- La sortie structurée du tour gagne des observations (façon de parler, objet vu, émotion visible, humeur de scène) ; le moteur les confronte au wiki, écrit les facettes découvertes et l'humeur dans `scene.disposition` ; ce que le wiki n'a pas passe par `ai_proposals`.
- Aux tours suivants, l'IA reçoit les observations comme faits établis.

**Critères d'acceptation**
- [ ] Une observation contraire au wiki est refusée et journalisée.

### ☐ V3.2-65 — L'orientation dans la personnalité · `S` · sans modèle IA · Modèle conseillé : Opus

- Le bloc `personality` gagne trois champs facultatifs : orientation sexuelle, romantique, relationnelle (liste fermée plus texte libre). Le moteur plafonne l'attirance d'un PNJ envers un personnage qui n'y entre pas ; le narrateur la reçoit.
- Le défaut d'un PNJ généré : en attente du choix de l'auteur (recommandé : vide, tiré à graine fixe à la première scène d'attirance, puis fixe).

**Critères d'acceptation**
- [ ] Tests du noyau : l'attirance plafonne pour un personnage hors orientation.

---

## Lot 4 — Le combat

### ☐ V3.2-66 — ADR : le moteur ouvre un combat en solo · `M` · sans modèle IA · Modèle conseillé : Opus

- Qui entre, de quel côté, contre qui : décidé par le moteur d'après les relations, le rôle et le courage ; l'IA raconte. Initiative par `rollInitiativeCheck` (cible de modificateur `initiative`, fil « Rendre jouables les 7 règles partielles »).

### ☐ V3.2-67 — Le combat dans le rail · `M` · sans modèle IA · Modèle conseillé : Opus — **après V3.2-66**

- L'entrée Combat passe au rouge, pulse et ouvre le volet sur le combat ; historique des combats, déroulé round par round. Contour rouge autour de la zone de jeu ; pastille d'état dans le bandeau ; distances en mètres.

### ☐ V3.2-68 — L'initiative dans le fil · `M` · sans modèle IA · Modèle conseillé : Opus — **après V3.2-66**

- Pastille de jet d'initiative dans le fil (rangs des PNJ cachés tant qu'on n'a pas lancé), puis la carte « Ordre d'initiative ». Rounds de 6 s, économie d'action en pastilles.

---

## Petits correctifs vus pendant la partie test

### ☐ V3.2-69 — « Demande honorée » ne sort plus dans Changements · `S` · sans modèle IA · Modèle conseillé : Sonnet

- La note interne de `turnIntent.ts` (`note: "Demande honorée"`) ne doit pas s'afficher dans l'onglet Changements.

### ☐ V3.2-70 — Une attaque demande sa cible ; l'attaque à mains nues existe · `S` · sans modèle IA · Modèle conseillé : Opus

- Une attaque sans cible demande « sur qui ? » parmi les présents. Frappe à mains nues du SRD 5.2 (1 + modificateur de Force, contondant, ou empoigner / pousser).

### ☐ V3.2-71 — L'outil de dés s'ouvre avant le résultat · `S` · sans modèle IA · Modèle conseillé : Sonnet

- Le panneau de dés s'ouvrait après l'affichage du résultat : il doit s'ouvrir au moment du lancer.
