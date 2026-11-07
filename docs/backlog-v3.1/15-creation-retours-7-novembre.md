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

### V3.1-170 — Pronoms : une liste à choix multiples, lue pour accorder (sans modèle IA)

**Modèle conseillé : Opus** (forme des données d'un bloc, lecture par le solo).

**Constat.** « Pronoms » est un champ de texte libre (`character.pronouns: string`). L'auteur veut choisir dans une liste, et pouvoir en cocher plusieurs (une personne genrée au masculin ET au féminin), avec des propositions qui serviront aussi au mode solo pour accorder.

**À faire.**
- Données : `pronouns` devient une liste de jeux de pronoms connus (il, elle, iel, ils, elles…) plus une saisie libre. Une ancienne valeur texte se relit comme saisie libre (Zod avec reprise, aucune migration SQL : la donnée vit dans le JSON du bloc). Les jeux proposés et leur accord (« il/le/lui », « elle/la/elle », « iel/lae/ellui »…) vivent dans le noyau, une seule liste.
- Écran (Identité de l'assistant, et le bloc Personnage) : des pastilles à cocher, plusieurs possibles, plus « Autre… ».
- Une fonction pure dit comment accorder une entité (premier jeu choisi, ou alternance quand il y en a plusieurs) : le contexte que le solo fournit au modèle la lira (règle 10 : la donnée reste de la donnée).

**Critères.** Plusieurs pronoms se choisissent et se relisent ; une fiche ancienne garde son texte ; tests du noyau (liste, reprise, accord) ; le contexte du solo porte les pronoms de l'entité.

### V3.1-171 — Identité : des champs à la même taille, et « le Commun est acquis » (sans modèle IA)

**Modèle conseillé : Sonnet.**

- Le sélecteur du mois de naissance n'a pas la hauteur des autres champs. Passer en revue **tous** les champs et boutons de l'assistant (chaque étape, 1440 et 390 px) : même hauteur, même rayon, mêmes recettes que la charte (`docs/CHARTE-UI.md`, champs et boutons).
- Langues : entre le titre et la liste, une ligne « Le Commun est acquis d'office ; choisis-en deux autres. » (le nombre et la langue acquise viennent du ruleset, pas du texte).

**Critères.** Aucun champ ni bouton de l'assistant hors gabarit (captures avant/après dans le compte rendu) ; la mention suit le ruleset.

**Sous-tâches Haiku.** Recenser les champs et boutons de l'assistant et leurs classes ; planche du catalogue.

### V3.1-172 — Espèce, don d'origine, historique : le texte entier, sans quitter l'écran (sans modèle IA)

**Modèle conseillé : Sonnet**, après 162 pour la mise en forme des textes. Revient sur « traits en une ligne chacun » (décision du 5 octobre).

**Constat.** La fiche de la sélection ne garde que la première phrase de chaque trait (`premierePhrase`, `SpeciesStep.tsx`) sur une ligne coupée (`truncate`) : « Ingénieux — Vous recevez l'Inspiration héroïque chaque fois que vous terminez… ». Le don d'origine est coupé à une longueur fixe (`ChoixDon.tsx`). Les traits d'historique n'ont pas d'explication.

**À faire.** Chaque trait garde sa ligne courte et **se déplie** sur place (le texte entier, gras et listes compris), sans quitter l'écran ; « Tout déplier » pour la fiche. Même composant pour Espèce, Don d'origine et Historique. Sur téléphone, le dépliage reste dans la carte.

**Critères.** Aucun texte de trait, de don ou d'historique n'est tronqué sans moyen de le lire ; un seul composant ; planche du catalogue.

### V3.1-174 — La sous-classe en sous-étape, ses choix expliqués (sans modèle IA)

**Modèle conseillé : Sonnet**, après 162. Revient sur « la sous-classe en pastille de la progression » (V3.1-51).

**Constat.** Le choix de sous-classe n'est pas clair. Ses choix internes non plus : Rôdeur, Chasseur, « Proie du chasseur » propose deux options sans dire ce qu'elles font.

**À faire.** Au niveau où la classe l'accorde, une sous-étape « Sous-classe » sous Classe, au même titre que compétences et maîtrises d'armes : les sous-classes du ruleset en cartes, la fiche de la sélection (aptitudes par niveau, texte dépliable comme 161), puis ses propres choix en sous-étapes, chaque option avec son texte. La pastille de la progression mène à cette sous-étape.

**Critères.** Rôdeur 3 : la sous-étape apparaît, le Chasseur s'explique, « Proie du chasseur » montre le texte de chaque option ; une sous-classe d'un ruleset personnel s'y range comme une officielle ; planche du catalogue.

### V3.1-176 — Points de vie : « Maximum » en plus de la moyenne et du jet (sans modèle IA)

**Modèle conseillé : Opus** (noyau : `HpGainChoice`, `sheet.ts`).

**À faire.** Un troisième mode par niveau, « Maximum » (le dé entier), avec « Maximum pour tous », à la création comme à la montée de niveau. Le noyau (`hpGainForLevel`) et l'intention envoyée au serveur l'acceptent ; le serveur continue de calculer (le client n'envoie qu'une intention).

**Critères.** Tests du noyau (moyenne, jet, maximum) ; une montée de niveau en « Maximum » écrit les bons PV ; l'écran propose les trois modes.

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
