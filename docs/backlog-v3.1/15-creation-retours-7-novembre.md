# La Création de personnage : retours du 7 novembre

Retours de l'auteur après avoir créé une Rôdeuse de niveau 4 dans l'assistant (V3.1-49 à 53 et 118, livrés le 31 octobre). Vérifié avant d'écrire ces tickets :
- aucun ticket ouvert ne couvre ces points ; les restes de 49 à 53 et 118 non plus ;
- la structure décidée le 5 octobre (`02-refonte-parent.md`, « Création ») tient ; deux points reviennent sur une décision de l'époque et le disent (traits « en une ligne », 161 ; la sous-classe en pastille de la progression, 163) ;
- les infobulles de règles de la fiche existent (V3.1-32, `useOpenRuleLink`) : l'assistant les réutilise au lieu d'en inventer ;
- la Perception passive n'est calculée que dans l'écran (`RangeeChiffree.tsx`, 10 + mod.) ; le moteur ne connaît aucune valeur passive ;
- la source française du SRD 5.2.1 (`data/srd/fr-source/`) contient la description des compétences et des bottes d'armes, qui ne sont pas importées en base ;
- le ruleset de « La Croisade des Ombres » est « DnD 2024 », variante personnelle du SRD 5.2.1 : le Champion y est déjà (hérité du SRD) ; l'Arnaqueur arcanique et le Collège de la séduction n'y sont pas.

**Numéros.** Ces tickets ont d'abord été écrits V3.1-159 à 168 (sur une branche) ; ces numéros étaient déjà pris sur `master` par le chantier des réactions (159 à 163). Renumérotés **V3.1-170 à 179**, dans le même ordre, le 7 novembre. Les commits du 7 novembre qui disent « V3.1-164 » et « V3.1-167 » parlent de 175 et 178.

Ordre conseillé : 162 (les textes en données) avant 161 et 163 ; 167 (noyau) indépendant ; 164 attend son esquisse ; 168 attend les textes de l'auteur.

---

### V3.1-171 — Identité : des champs à la même taille, et « le Commun est acquis » (sans modèle IA)

**Modèle conseillé : Sonnet.**

- Le sélecteur du mois de naissance n'a pas la hauteur des autres champs. Passer en revue **tous** les champs et boutons de l'assistant (chaque étape, 1440 et 390 px) : même hauteur, même rayon, mêmes recettes que la charte (`docs/CHARTE-UI.md`, champs et boutons).
- Langues : entre le titre et la liste, une ligne « Le Commun est acquis d'office ; choisis-en deux autres. » (le nombre et la langue acquise viennent du ruleset, pas du texte).

**Critères.** Aucun champ ni bouton de l'assistant hors gabarit (captures avant/après dans le compte rendu) ; la mention suit le ruleset.

**Sous-tâches Haiku.** Recenser les champs et boutons de l'assistant et leurs classes ; planche du catalogue.

### V3.1-177 — Aperçu : la colonne s'efface, la fiche s'affiche comme sur la fiche (sans modèle IA)

**Modèle conseillé : Sonnet.**

**À faire.** À l'étape Aperçu, la colonne d'aperçu de droite se retire dans une animation douce (largeur et opacité, coupée sous mouvement réduit) et l'étape montre la fiche **telle qu'elle s'affichera** dans le bloc Personnage de la fiche (le même composant, en lecture), à la place de l'aperçu actuel.

**Critères.** Même rendu que la fiche une fois créée ; retour à l'étape précédente : la colonne revient ; tablette et téléphone inchangés (pas de colonne) ; planche du catalogue.

### V3.1-179 — Trois sous-classes pour « La Croisade des Ombres », saisies et jouables (sans modèle IA)

**Modèle conseillé : Opus** (saisie par l'éditeur de briques, relevé des briques manquantes). **Attend les textes de l'auteur** pour les deux sous-classes hors SRD.

**Contexte.** Ruleset « DnD 2024 » (personnel, hérite du SRD 5.2.1).
- **Champion (Guerrier)** : déjà présent, hérité du SRD ; son Critique amélioré est jouable depuis V3.1-158. À faire : vérifier toutes ses aptitudes jusqu'au niveau 20 et compléter, par une surcharge dans « DnD 2024 » s'il le faut (règle 18).
- **Arnaqueur arcanique (Roublard)** et **Collège de la séduction (Barde)** : absents. L'auteur fournit le texte (captures). Saisie **avec l'éditeur de règles de l'application** (fiches et briques), comme le ferait l'auteur, pour éprouver l'outil. La mécanique en briques, la prose en référence de page (CLAUDE.md, « Saisir des règles »). Le contenu va en base, jamais dans un fichier suivi par Git.

**À faire.**
- Saisir les deux sous-classes et leurs aptitudes par l'éditeur ; noter chaque brique qui manque ou chaque geste impossible.
- Vérifier la jouabilité de chaque aptitude dans l'application : ciblage, effets, ressources et leur recharge, avantages, sorts (l'Arnaqueur est un tiers-lanceur : sa progression d'emplacements doit exister). Ce qui n'est pas jouable devient un critère du chantier qui le couvre (135 intervenir sur un jet, 136 actions modifiées, 137 conditions de jeu) ou un ticket nouveau.

**Critères.** Les trois sous-classes se choisissent à la création pour un PJ de la campagne ; chaque aptitude est jouable ou rattachée à un ticket nommé ; le compte rendu liste les briques manquantes de l'éditeur.

### V3.1-180 — Textes français : recoller les phrases coupées par la mise en page du PDF (sans modèle IA)

**Modèle conseillé : Opus** (script contre la vraie base, contenu officiel).

**Constat** (relevé en dépliant les dons, V3.1-172). Dans les traductions françaises importées du SRD 5.2.1, une phrase coupée en fin de ligne par la mise en page du PDF garde son retour à la ligne : « **Deux sorts mineurs.** Vous apprenez deux sorts⏎mineurs de votre choix… ». Le rendu des textes de règle (`Prose`) fait de chaque retour un nouveau paragraphe : la phrase s'affiche en deux morceaux, sur la page de la règle comme dans l'assistant et la fiche. Mesuré le 7 novembre : **10 fiches** (des dons : `alert`, `magic-initiate`, `ability-score-improvement`, `boon-of-combat-prowess`…), **19 coupures** ; aucune dans le SRD 5.1.

**À faire.**
- Un script par clé, à blanc par défaut (`--write` pour écrire), dans la lignée de `scripts/fix-descriptions-fr-2024.ts` : dans les blocs des traductions françaises, remplacer un retour à la ligne pris entre deux morceaux de phrase (minuscule, virgule ou apostrophe avant ; minuscule, « ou ( après) par une espace. Les vrais retours (avant un intertitre en gras `**…**`, une liste, une nouvelle phrase en majuscule) restent.
- Le passage à blanc liste chaque coupure avec son contexte, pour relecture avant d'écrire.
- Même famille, relevée en préparant V3.1-174 : un texte qui **déborde sur la section suivante** du livre. « Défense de chasseur supérieure » (`hunter-superior-hunters-defense`) contient, après sa dernière phrase, tout le début du chapitre du Roublard (« Roublard Traits de base du Roublard… »). Recenser les textes qui débordent ainsi (fin de chapitre de classe, de section) et les couper à leur dernière phrase.
- Chercher pourquoi l'import l'a laissé passer (`translate-rules-2024-fr.ts` et voisins) et le corriger, pour qu'une réimportation ne recrée pas le défaut.

**Critères.** Aucune coupure de ce genre ne reste dans les traductions françaises des deux SRD (le script relancé à blanc n'en trouve plus) ; « Initié à la magie » se lit en paragraphes entiers sur la page de la règle et dans l'assistant ; les intertitres en gras gardent leur ligne.

**Portée.** Le texte n'existe qu'à un endroit, la traduction de la fiche (`ruleset_entry_translations`) : la page de la règle, l'assistant, la fiche du personnage et le contexte du solo le lisent tous de là, donc une correction vaut partout. Seule exception : une fiche d'un ruleset personnel qui aurait **recopié** ce texte dans sa propre surcharge garde sa copie (aucune connue aujourd'hui).
