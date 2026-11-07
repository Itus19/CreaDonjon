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

### V3.1-179 — Trois sous-classes pour « La Croisade des Ombres », saisies et jouables (sans modèle IA)

**Modèle conseillé : Opus** (saisie par l'éditeur de briques, relevé des briques manquantes). **Attend les textes de l'auteur** pour les deux sous-classes hors SRD.

**Contexte.** Ruleset « DnD 2024 » (personnel, hérite du SRD 5.2.1).
- **Champion (Guerrier)** : déjà présent, hérité du SRD ; son Critique amélioré est jouable depuis V3.1-158. À faire : vérifier toutes ses aptitudes jusqu'au niveau 20 et compléter, par une surcharge dans « DnD 2024 » s'il le faut (règle 18).
- **Arnaqueur arcanique (Roublard)** et **Collège de la séduction (Barde)** : absents. L'auteur fournit le texte (captures). Saisie **avec l'éditeur de règles de l'application** (fiches et briques), comme le ferait l'auteur, pour éprouver l'outil. La mécanique en briques, la prose en référence de page (CLAUDE.md, « Saisir des règles »). Le contenu va en base, jamais dans un fichier suivi par Git.

**À faire.**
- Saisir les deux sous-classes et leurs aptitudes par l'éditeur ; noter chaque brique qui manque ou chaque geste impossible.
- Vérifier la jouabilité de chaque aptitude dans l'application : ciblage, effets, ressources et leur recharge, avantages, sorts (l'Arnaqueur est un tiers-lanceur : sa progression d'emplacements doit exister). Ce qui n'est pas jouable devient un critère du chantier qui le couvre (135 intervenir sur un jet, 136 actions modifiées, 137 conditions de jeu) ou un ticket nouveau.

**Critères.** Les trois sous-classes se choisissent à la création pour un PJ de la campagne ; chaque aptitude est jouable ou rattachée à un ticket nommé ; le compte rendu liste les briques manquantes de l'éditeur.

**Relevé du 7 novembre** (avant saisie, en lisant l'éditeur et la base).
- **Champion** : complet dans le SRD 5.2.1 hérité — six aptitudes, chacune avec sa fiche (`champion-improved-critical` 3, `champion-remarkable-athlete` 3, `champion-additional-fighting-style` 7, `champion-heroic-warrior` 10, `champion-superior-critical` 15, `champion-survivor` 18 ; la 2024 n'a rien au 20). Rien à surcharger ; sa jouabilité aptitude par aptitude reste à vérifier.
- **Arnaqueur arcanique** : déjà saisi par l'auteur dans « DnD 2024 » le 4 septembre (description, aptitudes, tableau, emplacement de sous-classe du Roublard). Sa magie n'est qu'un tableau de texte : le moteur ne connaît pas d'incantation accordée par une sous-classe → **V3.1-185**.
- **Collège de la séduction** : texte fourni (Manuel des joueurs 2024, p. 66, PDF de l'auteur). Le formulaire « Créer une sous-classe » couvre la fiche et ses quatre aptitudes en texte. **Un obstacle d'accès** : « DnD 2024 » appartient au compte de l'auteur ; une session ne peut écrire qu'au nom d'un compte de test, qui n'a pas la main sur ce ruleset.
- **Ce que l'éditeur ne sait pas faire pour cette sous-classe** : rendre jouable une aptitude d'une sous-classe maison (**V3.1-181**) ; ses sorts toujours préparés et lancés sans emplacement (**V3.1-182**) ; des PV temporaires, et regagner une utilisation en dépensant autre chose (**V3.1-183**) ; une utilisation qui se propose après un sort lancé (**V3.1-184**) ; « sauvegarde ou l'attaque rate » et l'échec automatique d'une créature charmée (**V3.1-186**, avec 135 et 163).

### V3.1-181 — Sous-classe maison : rendre jouable chacune de ses aptitudes (sans modèle IA)

**Modèle conseillé : Opus** (serveur des surcharges, clé des aptitudes).

**Constat** (relevé de V3.1-179). Une aptitude de sous-classe devient jouable par une fiche séparée qui porte ses briques, de clé `<sous-classe>-<aptitude>` (V3.1-163 ; le Champion en a une par aptitude). Pour une sous-classe maison, aucun écran ne crée cette fiche : le formulaire « Créer une sous-classe » n'écrit que le bloc des aptitudes, et l'éditeur de briques ne s'ouvre que sur une fiche existante. De plus `subclassFeatureSlug` jette les lettres accentuées (« Magie envoûtante » → `magie-envo-tante`).

**À faire.** Sur la page d'une sous-classe maison, chaque aptitude a un bouton « Rendre jouable » qui crée (ou rouvre) sa fiche à briques sous la bonne clé, dans la même variante, et ouvre l'éditeur de briques. La clé tient les accents (normalisation avant de retirer le reste), sans changer celles des aptitudes du SRD (noms anglais, sans accent) ni les choix déjà stockés.

**Critères.** Une aptitude du Collège de la séduction reçoit une ressource et une utilisation par l'écran seul ; elles apparaissent sur la fiche d'un barde de ce collège au bon niveau, pas avant ; tests de la clé (accents, SRD inchangé).

### V3.1-182 — Formulaire de sous-classe : sorts toujours préparés et lancés sans emplacement (sans modèle IA)

**Modèle conseillé : Sonnet**, schéma déjà prêt (`spells` d'une aptitude : `always_prepared`, `free_cast`).

**Constat.** « Les sorts *charme-personne* et *image miroir* sont toujours préparés » (Magie envoûtante), « *injonction* est toujours préparé ; vous pouvez le lancer sans dépenser d'emplacement, une fois par repos long » (Mante de majesté) : le moteur les sait (`zSubclassFeatureEntry.spells`), le formulaire ne les propose pas.

**À faire.** Sous chaque aptitude du formulaire, « Sorts accordés » : un sélecteur de sorts du monde, avec « toujours préparé » et « lancer sans emplacement (n par repos) ». La relecture en modification les retrouve.

**Critères.** Le Collège de la séduction déclare ses trois sorts par l'écran ; ils sont préparés sur la fiche d'un barde de niveau 3 (injonction au 6) ; le lancer gratuit se décompte et revient au repos long.

### V3.1-183 — Briques : des PV temporaires, et regagner une utilisation en dépensant autre chose (sans modèle IA)

**Modèle conseillé : Opus** (vocabulaire fermé des effets, ADR si l'on ajoute une action).

**Constat.** Mante d'inspiration donne « autant de PV temporaires que le double du nombre obtenu sur le dé d'Inspiration bardique » : les effets savent soigner (`heal`), pas donner des PV temporaires. Magie envoûtante se récupère « en dépensant une Inspiration bardique », Mante de majesté « en dépensant un emplacement du 3e niveau ou supérieur » : une ressource ne se recharge qu'au repos.

**À faire.** Un effet « gagne N PV temporaires » (formule, la règle 5e du plus grand des deux) ; et, sur une ressource, « regagner une utilisation en dépensant… » (une autre ressource, ou un emplacement d'un niveau minimal), proposé sur la fiche quand la ressource est vide.

**Critères.** Mante d'inspiration se joue de bout en bout (dépense, jet du dé par le serveur, PV temporaires ×2 aux cibles choisies) ; Magie envoûtante vide se recharge contre une Inspiration bardique ; tests du noyau.

### V3.1-184 — Une utilisation proposée après un sort lancé (sans modèle IA)

**Modèle conseillé : Opus** (déclencheurs, ADR 0075).

**Constat.** « Aussitôt après avoir lancé un sort d'Enchantement ou d'Illusion par un emplacement de sort, vous pouvez contraindre une créature… » (Magie envoûtante). Une utilisation se joue au clic ou en réaction à un jet ; l'événement `spell_cast` existe pour les déclencheurs, pas pour proposer une utilisation, et rien ne filtre par école ni par « avec un emplacement ».

**À faire.** Un déclencheur d'utilisation « après un sort lancé » (école, avec emplacement), qui ouvre la fenêtre de proposition comme une réaction ; sinon, l'utilisation reste jouable au clic.

**Critères.** Après *charme-personne* lancé par un emplacement, la fiche propose Magie envoûtante ; pas après un sort mineur ni un sort d'une autre école.

### V3.1-185 — Une sous-classe qui lance des sorts : sa progression d'emplacements (sans modèle IA)

**Modèle conseillé : Opus** (noyau, `characterSheet`).

**Constat.** L'Arnaqueur arcanique (et le Chevalier occulte) sont des tiers de lanceur : la sous-classe donne caractéristique d'incantation, sorts connus et emplacements. Le moteur ne lit une incantation que sur la classe (`spellcasting_progression`) ; la saisie de l'auteur la porte en tableau de texte. Un Arnaqueur n'a donc ni emplacements ni DD de sort sur sa fiche.

**À faire.** Une sous-classe peut déclarer sa progression d'incantation (même bloc que la classe, au tiers) ; le moteur la compte, multiclassage compris (règle du tiers arrondi à l'inférieur) ; l'écran de saisie la propose.

**Critères.** Un Arnaqueur 3 a deux emplacements du 1er niveau, son DD et son attaque de sort ; tests du noyau (tiers de lanceur seul, multiclassé).

### V3.1-186 — « Sauvegarde ou l'attaque rate », et l'échec automatique d'une créature charmée (sans modèle IA)

**Modèle conseillé : Opus**, dans la lignée de V3.1-135 et 163 (fenêtre de réaction).

**Constat.** Majesté souveraine : « chaque fois qu'une créature vous touche avec un jet d'attaque pour la première fois d'un tour, l'assaillant doit réussir un jet de sauvegarde de Charisme contre votre DD, sans quoi l'attaque rate ». Les opérations sur un jet ajoutent un dé, relancent, fixent le d20, donnent un bonus de CA : aucune ne fait « sauvegarde de l'assaillant, sinon raté ». Mante de majesté : « une créature Charmée par vous rate automatiquement son jet de sauvegarde contre toute *injonction* que vous lancez » : rien ne fait échouer d'office une sauvegarde selon un état et un sort.

**À faire.** Une opération de réaction « sauvegarde imposée à l'assaillant ; échec : l'attaque rate » (automatique, une fois par tour, tant qu'un effet dure) ; et une règle d'échec automatique d'une sauvegarde (état de la cible, sort lancé).

**Critères.** Sous Majesté souveraine, une attaque qui touche la barde déclenche la sauvegarde ; un échec la fait rater ; une *injonction* contre une créature charmée par elle échoue d'office.

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
