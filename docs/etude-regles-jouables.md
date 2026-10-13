# Étude — des fiches de règles qui se jouent

**Statut :** échantillon fixé le 13 octobre 2026 · découpage à faire
**Esquisse visuelle :** fiche terminée, éditeur de briques, onglet Actions en jeu (Abjuration d'ennemis)

## Objet

Savoir si **un petit jeu de briques génériques** (coût, cibles, effets, durée, fin, recharge) suffit à rendre jouables les règles du SRD 2024 et nos règles maison, et lesquelles manquent.

On ne conçoit **pas** un formulaire par règle ni un bloc par type de règle : chaque règle doit s'écrire comme une combinaison de briques. Le moteur ne connaît que les briques.

Rien n'est construit tant que l'étude n'est pas finie. Sa sortie est un ADR.

## Ce qu'on part de

| Existe déjà | Où |
|---|---|
| Effets permanents d'une aptitude | bloc `modifiers` → `characterSheet()` |
| « Quand X arrive, fais Y » | bloc `triggers` → `src/core/rules/triggers.ts` (vocabulaire fermé d'événements et d'effets) |
| Compteurs et recharge aux repos | bloc `resources` du **personnage**, saisi à la main |
| Budget d'action, ciblage | ADR 0029, ADR 0042 |
| Compte des manques du vocabulaire | `src/core/rules/srdTriggers.test.ts` (quatre manques connus) |

Manques déjà identifiés, à confirmer ou infirmer par l'étude :

1. **Activation** : rien ne dit « cette règle se déclenche quand le joueur clique ».
2. **Ressources déclarées par les règles** : un compteur comme Conduit divin n'est déclaré par aucune fiche.
3. **Effets qui durent** : durée, fin sur événement, consommation au prochain jet (`entity_active_effects` jamais écrite).

## L'échantillon

Choisi pour que **chaque règle apporte une mécanique différente**. Une règle complexe qui répète des mécaniques déjà vues n'apprend rien. Toutes figurent dans l'import SRD 2024, vérifié par leurs traductions dans `scripts/data/`.

### A. Le quotidien — mesurer la couverture réelle

| # | Règle | Source | Ce qu'elle teste |
|---|---|---|---|
| 1 | Second souffle | Guerrier 1 | Action bonus, soin en formule (`1d10 + niveau`), recharge partielle (1 au repos court) |
| 2 | Rage | Barbare 1 | Effet qui dure avec plusieurs modificateurs (résistance, bonus de dégâts, avantage), fins multiples |
| 3 | Attaque sournoise | Roublard 1 | Dégâts en plus, conditionnels, une fois par tour, sans bouton propre |
| 4 | Imposition des mains | Paladin 1 | Réserve de points, montant choisi à l'usage, option alternative (guérir l'empoisonnement) |
| 5 | Inspiration bardique | Barde 1 | Donner un dé à un allié, qu'il dépense plus tard ; utilisations = mod. CHA |
| 6 | Sursaut d'action | Guerrier 2 | Accorder une action de plus (budget) |
| 7 | Action rusée | Roublard 2 | Rendre une action disponible en action bonus |
| 8 | Abjuration d'ennemis | Paladin 9 | Ressource partagée, cibles en formule, sauvegarde, état avec fin sur dégâts, restriction de tour |

### B. Les familles difficiles — trouver les briques manquantes

| # | Règle | Source | Ce qu'elle teste |
|---|---|---|---|
| 9 | Bouclier | Sort 1 | Réaction quand on est touché, modifie après coup une attaque déjà lancée |
| 10 | Esquive instinctive | Roublard 5 | Réaction, divise les dégâts d'une attaque |
| 11 | Bénédiction | Sort 1 | Concentration, plusieurs cibles, un **dé** ajouté aux jets (pas une valeur fixe) |
| 12 | Aura de protection | Paladin 6 | Aura : alliés à 3 m, + mod. CHA aux sauvegardes, tant qu'on n'est pas neutralisé |
| 13 | Arme sacrée | Paladin (Dévotion) 3 | Modificateur calculé lié à un objet, fin si on lâche l'arme |
| 14 | Métamagie : sort accéléré | Ensorceleur 2 | Modifie une autre action (temps d'incantation), coût en points de sorcellerie |
| 15 | Forme sauvage | Druide 2 | Transformation : profil remplacé, PV temporaires |
| 16 | Compagnon sauvage | Druide 2 | Dépenser une ressource à la place d'un emplacement ; invocation d'un familier |
| 17 | Source d'inspiration | Barde 5 | Règle qui change la recharge d'une autre ; conversion emplacement → usage |
| 18 | Résistance naine | Nain | Résistance à un type de dégâts, avantage à une sauvegarde contre un état |
| 19 | Mots cinglants | Barde (Savoir) 3 | Réaction au jet **d'un autre**, soustrait un dé |
| 20 | Chance | Halfelin | Relance d'un 1 naturel |
| 21 | Attaque supplémentaire | Guerrier 5 | Modifie l'action Attaquer : plusieurs attaques |
| 22 | Restauration magique | Magicien 1 | Récupérer des emplacements dans un budget à répartir (choix sous contrainte de somme) |
| 23 | Critique amélioré | Guerrier (Champion) 3 | Plage de critique 19-20 |
| 24 | Souffle | Drakéide | Zone (cône ou ligne au choix), dégâts croissant avec le niveau, utilisations = bonus de maîtrise |
| 25 | Défense sans armure | Barbare 1 | CA en formule alternative, conditionnée à l'équipement |

### C. Le haut niveau — vérifier que ça tient quand tout se cumule

| # | Règle | Source | Ce qu'elle teste |
|---|---|---|---|
| 26 | Aura étendue | Paladin 18 | Modifie une autre règle (portée de l'aura) |
| 27 | Indomptable | Guerrier 9 | Relancer une sauvegarde ratée avec un bonus, utilisations croissantes |
| 28 | Coup de chance | Roublard 20 | Transformer un échec en 20 |
| 29 | Rage persistante | Barbare 15 | Recharge sur un événement (jet d'initiative) ; fin d'effet supprimée |
| 30 | Paume vibratoire | Moine (Paume) 17 | Effet différé, déclenché plus tard par le joueur |

### D. Le maison — nos règles doivent passer aussi

| # | Règle | Ce qu'elle teste |
|---|---|---|
| 31 | « Donne 1 avantage à un jet de votre choix. Se recharge après un repos long » | Effet consommé au prochain jet choisi |
| 32 | *à fournir par l'auteur* | |
| 33 | *à fournir par l'auteur* | |

## Méthode de découpage

Pour chaque règle, une fiche de découpage :

| Champ | Contenu |
|---|---|
| Déclenchement | clic du joueur, réaction (à quoi), événement (lequel), passif |
| Coût | type d'action, ressource et quantité |
| Cibles | qui, combien (formule), portée, zone |
| Effets | suite de briques, avec branches si réussite ou si échec |
| Durée et fin | temps, concentration, fin sur événement |
| Recharge | repos, événement, aucune |
| Passages non exprimables | texte exact, et la brique qui manque |
| Verdict | jouable · partiellement (ce qui reste à la main) · texte seulement |

Chaque brique est notée **existe** (vocabulaire actuel), **proposée** (une des trois pièces ci-dessus) ou **manquante** (nouvelle).

## Ce que l'étude doit produire

1. Le **pourcentage** de règles jouables, partiellement jouables, en texte seulement, avec les briques existantes, puis avec les trois pièces proposées.
2. La **liste des briques manquantes**, classée par nombre de règles qu'elles débloquent. La règle des trois s'applique : une brique utile à une seule règle reste en texte.
3. Un **ADR** qui fixe le bloc d'activation, les ressources déclarées par les règles et les effets qui durent, puis le découpage en tickets.
