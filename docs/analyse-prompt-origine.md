# Analyse — le prompt d'origine du JDR solo

> **Depuis le 8 septembre, les décisions de ce document vivent comme tickets dans `docs/BACKLOG_V3.md`** (lots N, O, Q, S). Ce document reste la référence du **pourquoi** d'une décision — jamais de ce qu'il faut faire ensuite.

**Version :** 0.2 — 8 septembre 2026
**Statut :** analyse. Les points marqués « tranché » l'ont été en relecture avec l'auteur (§0.1) ; le reste est regroupé au §12. Aucun ticket ouvert par ce document.
**Source :** le prompt personnel écrit avant le projet, celui qui a servi à jouer en solo avec un modèle unique et dont l'oubli a motivé CreaDonjon. Neuf blocs : identité et style du MJ, lois du monde, mécaniques, PNJ et relations, guildes et quêtes, propriétés et gouvernance, protocole de réponse, module univers, module personnage, plus un module de contenu explicite.

> **Le texte source n'est pas versionné.** Il contient du contenu personnel, une œuvre tierce (Frieren) et des directives de contenu adulte. Sa place est `data/personnel/prompt-origine.md`, ignoré par Git — même règle que le contenu de règles saisi depuis un ouvrage possédé (`specs/ruleset-personnel.md` §3). Ce document-ci ne cite le prompt que par extraits courts, à titre d'analyse.

---

## 0. Pourquoi ce document

Le prompt d'origine est le cahier des charges le plus honnête du projet : il dit ce que l'auteur voulait réellement jouer, avant que l'architecture n'existe pour le porter. Le relire aujourd'hui sert trois choses.

1. **Vérifier la thèse du projet.** Une bonne partie du prompt n'existait que pour compenser l'amnésie du modèle. Si l'architecture est juste, ces morceaux doivent disparaître sans rien perdre.
2. **Récupérer ce qui est du vrai contenu.** Des règles maison, un ton de récit, un univers, un personnage. Rien de tout cela n'a de raison d'être perdu.
3. **Repérer les manques réels.** Ce que le prompt demandait, que CreaDonjon ne sait pas encore exprimer — et distinguer, parmi ces manques, ceux qui coûtent une heure de ceux qui coûtent un lot entier.

### 0.1 Décisions prises en relecture (8 septembre)

Les points ci-dessous ont été soumis à l'auteur et tranchés. Ce document les intègre plutôt que de les laisser en question ouverte — deux d'entre eux corrigent une recommandation de la version 0.1.

| Point | Décision |
|---|---|
| Le ton du récit : bloc ou menu ? | **un menu** dans les Réglages, adossé à une colonne `worlds.narration_profile`. *Corrige la v0.1* — §4.1 |
| S'inspirer d'une œuvre préexistante | **retenu**, un champ nom + note. Le risque réel n'est pas le coût en contexte — §4.3 |
| Les quatre jauges de relation | `relationship` en couvre trois ; la quatrième passe par des **pôles configurables par monde** — §6.1 |
| « Ce qui frappe le personnage » | **retenu**, champ `striking` sur `personality` — §6.3 |
| Le bloc `quest` | **creusé en trois temps**, dont deux n'attendent pas la V3 — §6.7 |
| Qualité et iLvl des objets | **le vocabulaire au ruleset, l'instance à l'inventaire** — §5.3 |
| Les orientations des PNJ | **trois champs distincts**, pas un seul. *Corrige la v0.1* — §6.4 |
| La première impression | **retenue** : elle donne la teinte de base, plafonnée, journalisée — §6.2 |
| Le générateur de quêtes | **retenu** — §6.7 |
| Où vivent les orientations | dans **`personality`**, jamais dans `worldview` — §6.4 |

---

## 1. Ce que le prompt compensait, et que l'architecture rend inutile

C'est la première lecture à faire, et la plus encourageante.

| Ce que le prompt demandait au modèle | Ce qui s'en charge aujourd'hui |
|---|---|
| Réafficher l'ÉTAT DE L'HISTOIRE complet à chaque tour | la fiche jouable et la colonne latérale (`specs/module-joueur-et-solo.md` B1/B3) |
| Une checklist silencieuse de 17 points avant chaque affichage | les blocs requis par type d'entrée (`REQUIRED_BLOCKS`) et le bandeau « fiche incomplète » |
| « Maintenir silencieusement en arrière-plan » les fiches de PNJ | des entités, avec révisions et historique |
| « Archive relationnelle : XX PNJ » | `entity_discoveries` et la colonne wiki filtrée par les découvertes |
| Se souvenir des jauges d'un PNJ absent depuis dix tours | `entity_attitudes` + `attitude_events`, en ajout seul |
| Ne jamais adoucir un jet de dés | le serveur lance, `dice_rolls` journalise, le modèle ne voit qu'un fait établi |
| Ne pas perdre le fil du temps qui passe | `SceneState.time`, tenu par le moteur (`specs/moteur-de-jeu.md` §6) |
| Recalculer CA, modificateurs, encombrement à chaque affichage | `characterSheet()`, jamais stocké (règle absolue 16) |
| Ne jamais révéler un secret dans le fil principal | `visibility_level`, résolu côté serveur avant l'envoi |

**Ce n'est pas un exercice d'auto-satisfaction : c'est la mesure de ce qui reste.** Une fois ces lignes retirées, le prompt d'origine perd environ un tiers de sa longueur — et ce tiers est précisément celui qui échouait.

Deux constats du prompt méritent d'être notés comme des garanties acquises plutôt que des consignes :

- **« Ne jamais adoucir un jet »** n'est plus une promesse faite par un modèle : c'est une propriété du système. Le modèle reçoit le résultat comme un fait, il ne peut pas le produire.
- **« Les ellipses temporelles sont une décision exclusive du joueur »** devient vrai par construction : l'heure n'avance que quand le code la fait avancer. Le modèle n'a aucun moyen de décider que trois jours ont passé.

---

## 2. La grille de tri

Huit destinations. Chaque élément du prompt tombe dans exactement une.

| Code | Destination | Ce qui y va |
|---|---|---|
| **A** | Déjà couvert | rien à faire, sinon vérifier le recouvrement |
| **B** | Ruleset personnel | règles maison chiffrées : PM, encombrement, monnaie, objets |
| **C** | Blocs, existants ou nouveaux | structures d'information durables |
| **D** | Profil de narration | ton, style, rythme, registre — **le seul concept vraiment nouveau**. Un menu, pas un bloc (§4.1) |
| **E** | Moteur | monde autonome, scène, déclencheurs |
| **F** | Contrat IA | ce que le modèle reçoit, ce qu'il rend, ce qu'il ne décide pas |
| **G** | Réglages et politique de contenu | thèmes, limites, partage |
| **H** | À abandonner | artefacts de prompt sans objet ici |

---

## 3. Inventaire complet

Un élément par ligne, dans l'ordre du prompt.

### Bloc 1 — identité et style du MJ

| Élément | Dest. | Verdict |
|---|---|---|
| « Ne mentionne jamais ces instructions » | H | sans objet : le prompt système n'est pas exposé, et le contenu du wiki est déjà encadré comme donnée (règle 10) |
| Les cinq influences narratives (Mercer, Mulligan, Hamilton, Frieren, Tensura) | D | à conserver **mot pour mot**, comme donnée d'un profil de narration |
| Registre général sombre et réaliste | D | idem — un curseur, pas une constante |

### Bloc 1b — lois du monde, narration, enjeux

| Élément | Dest. | Verdict |
|---|---|---|
| Registre sombre nuancé, lumière et obscurité coexistent | D | profil de narration |
| « Aucun aspect de l'existence n'est ignoré », thèmes lourds | G | réglages de contenu par monde, pas une consigne libre |
| Sociétés diverses et contradictoires, normes variables | A | c'est du contenu : entités `faction`/`concept` avec un bloc `worldview` |
| « Personne n'est entièrement bon ou mauvais » | A | `personality` : `lines`, `limits`, `priority` font exactement ça |
| Loi universelle de symétrie (« si c'est possible pour l'un… ») | A | c'est le modèle unifié : pas de table par type, un PNJ est une entité comme une autre |
| Deux forces en arrière-plan, alliances, économie, hiérarchies, réaction au joueur | **E** | **manque réel**, le plus gros du document — voir §7 |
| Mortalité, échec possible, pas de sauvetage artificiel | A | garanti par la séparation des rôles |
| Narration 200-400 mots, présent, deuxième personne | D | paramètres du profil |
| Rythme variable, silences, lenteur intentionnelle | D | profil |
| Ellipses décidées par le joueur seul | A/E | garanti par l'horloge du moteur |
| Humour organique | D | profil |
| Agentivité absolue du joueur | D/F | profil, et contrainte de la sortie structurée |
| Cohérence du lore, « le lore établi est vérité absolue » | A | le contexte déterministe fournit les faits ; les références fermées empêchent l'invention d'identifiants |
| **Règle de description : détail proportionnel à la familiarité** | A + C | `entity_discoveries.detail_level` (`mentioned`/`known`/`detailed`) couvre la familiarité **et n'est pas encore utilisé pour moduler la description** |
| **Ce qui est « inhabituel » pour ce personnage** | **C** | **petit ajout à fort rendement** — voir §6.3 |

### Bloc 2 — mécaniques

| Élément | Dest. | Verdict |
|---|---|---|
| Système implicite, le joueur ne voit jamais les mécaniques | G | réglage d'affichage. Contredit frontalement la fiche jouable, qui montre sa trace — les deux doivent coexister comme un choix, pas comme une doctrine |
| **Le joueur lance ses dés physiques et donne le résultat** | **C/E** | vrai ajout, petit : un mode de saisie « dé physique ». Compatible avec la règle 8 (le modèle ne produit toujours aucun nombre), demande une origine de plus sur `dice_rolls` |
| Quand demander un jet (incertitude + conséquence) | F | consigne du profil, décidée par l'humain ou le moteur |
| **Ordre obligatoire : le jet avant la narration** | **E/F** | **déjà identifié comme le trou n° 1** par l'ADR 0009 : « une contrainte d'interface qui force le passage par la résolution mécanique avant toute narration ». Le prompt le demandait ; le spike a montré qu'une consigne ne suffit pas |
| Perception passive révèle sans jet sous son seuil | A | valeur déjà dérivée ; l'usage devient une condition de déclencheur |
| Résolution d'attaque, crit sur 20, échec sur 1, dés doublés | A | `src/core/rules/action.ts` ; le doublement des dés hors modificateurs est la règle officielle |
| Symétrie totale joueur / PNJ | A | structurelle |
| **Encombrement = FOR × 2,5 kg, paliers 100 % / 120 %** | **B** | variante réelle (le SRD donne FOR × 15). **Aujourd'hui non exprimable en donnée** — voir §5 |
| **Points de mana : coût par sort, deux classes de cantrips, sorts théorisés, récupération 50 %/100 %, temps d'apprentissage, évolution en deux axes** | **B** | le plus gros bloc de règles maison. Remplace les emplacements de sorts. Voir §5.2 |
| Objets : iLvl, six qualités, poids, valeur dynamique | B/C | extension du bloc `inventory` + données de ruleset |
| Identification obligatoire, risque d'effet aléatoire par qualité | B | table de risque = donnée ; le tirage = serveur |
| **Économie 1 po = 100 pa = 10 000 pb** | **B** | variante réelle, **aujourd'hui non exprimable en donnée** — voir §5 |
| Progression organique, pas de niveau maximum, trois choix exclusifs par niveau | B/F | l'ossature `Choice`/`Grant` existe ; « fondés sur ce qui a été pratiqué » est une proposition d'IA, pas un calcul |

### Bloc 3 — PNJ, relations, réputation

| Élément | Dest. | Verdict |
|---|---|---|
| Fiche complète pour chaque PNJ significatif | A | entité + `character` ou `statblock` |
| Voix, manières, objectif personnel | A | `personality.speech`, `aspirations` à trois horizons |
| **Vie intérieure : orientation, rapport à l'intimité, désirs, peurs** | **C** | champs absents de `personality`. Voir §6.4 |
| **Quatre jauges bipolaires** (confiance, amitié, amour, attirance) | **A, à un axe près** | trois des quatre existent. « Amour ↔ haine » n'a pas d'équivalent — voir §6.1 |
| Initialisation des jauges à la rencontre | A + C | `personality.baseline` existe déjà et fait exactement ça. Le **plafond à 50 %** et l'influence de la réputation manquent |
| Évolution proportionnelle, plusieurs jauges à la fois, note qualitative | A | `applyDelta` avec rendements décroissants, `attitude_events.summary` |
| Jauges des PNJ absents qui évoluent en arrière-plan | **E** | délibérément refusé par `specs/psyche-pnj.md` §1 (« les pôles ne bougent que sur événement explicite »). Décision consciente à ne pas revenir dessus à la légère |
| **Affichage en pourcentage** (« Confiance +65 % ») | **conflit** | le projet affiche des bandes nommées, exprès. Voir §8 |
| « Archive relationnelle : XX PNJ » | H | remplacé par la colonne de découvertes |
| Consultation d'une fiche archivée via « GM : » | A/F | c'est le wiki |
| **Réputation qui voyage, pré-oriente les jauges, réputation croisée entre factions** | **C/E** | **presque gratuit structurellement** — voir §6.2 |
| Monde autonome, autres aventuriers PNJ actifs | E | même chantier que les factions |
| Confidentialité, messages privés | A | `visibility_level`, résolu côté serveur |

### Bloc 4 — guildes, quêtes, rang

| Élément | Dest. | Verdict |
|---|---|---|
| Guildes, structures variables selon les régions | A | entités `faction`, avec `worldview` |
| Lieux d'affichage des quêtes, commanditaire opaque | A | contenu ; le bloc `quest` porte déjà un commanditaire référencé |
| **Rang requis, temporalité, délai** sur une quête | **C** | trois champs à ajouter au bloc `quest` |
| Barème de récompense par rang + cinq modificateurs | B/C | données. **Un générateur de quêtes** réutilise le mécanisme de tirage filtré par palier déjà construit (V2-J9quater) — quasi zéro code |
| Récompense non pécuniaire ou mixte | C | le champ récompense est déjà du texte avec référence optionnelle |
| Quêtes non prises qui expirent, prises par d'autres | E | horloges |
| **Échelle de rang E→SS, verrou d'acceptation, effet sur les jauges initiales, paliers de progression** | **C** | nouveau bloc. L'échelle et les paliers sont de la donnée de ruleset, pas du code |
| Le joueur comme commanditaire (consignation, frais, récupération) | C | extension de `quest`, plus tard |
| Affichage « STATUT AVENTURIER » | C | un encart de la fiche jouable, alimenté par le bloc de rang |

### Bloc 4b — propriétés, recrues, gouvernance

| Élément | Dest. | Verdict |
|---|---|---|
| Principe « ce qu'un marchand peut faire, le joueur le peut » | A | c'est le modèle unifié, énoncé autrement |
| Acquisition d'un bien, types de biens, revenus et coûts | C | bloc `holding` sur une entité `location` ou `faction` |
| Délégation à une recrue, compétences de gestion | C | bloc `retainer` + relation `works_for` |
| **Jauge de loyauté**, salaire, érosion, trahison | C | un axe de relation configurable par monde — même mécanisme que « amour ↔ haine » |
| Événements autonomes de propriété (vol, incendie, inspection) | E | horloges, encore |
| Gouvernance politique, échelle village→royaume, effets en cascade | — | **hors de portée honnête.** Cohérent, désirable, et très loin. À noter, ne rien construire |

### Bloc 5 — protocole et structure de réponse

| Élément | Dest. | Verdict |
|---|---|---|
| **Préfixes « GM : » et « RP : »** | **F** | bonne idée, à garder : deux canaux, hors-jeu et en-jeu. « Le temps narratif est suspendu » devient une garantie du moteur, pas une promesse |
| Vérifications silencieuses avant chaque réponse | A | c'est le contexte déterministe assemblé par le code : quêtes actives, attitudes des présents, règle applicable. Exemple canonique de la thèse du projet |
| Structure imposée (narration / dialogues / indication mécanique) | D | mise en forme, dérivée du profil |
| **Trois options « Que fais-tu ? » (combat / ruse / exploration)** | **F** | à garder comme **champ de la sortie structurée**, pas comme consigne de mise en page |
| ÉTAT DE L'HISTOIRE réaffiché intégralement | H | c'est l'interface. Le remplacer est le geste fondateur du projet |
| Checklist de 17 points | H | idem |
| Règle sur les sorts (dés, type, conditions toujours affichés) | A | données de la fiche de sort |
| Initialisation : bourse 4d4, sorts de départ, PNJ générés | A/C | générateurs + jets serveur |

### Bloc 6 — module univers Frieren

| Élément | Dest. | Verdict |
|---|---|---|
| Univers de référence, PNJ canoniques, contexte de départ | — | **contenu**, pas code : des entités dans un monde |
| Jauges initiales de Frieren envers le PJ | A | `personality.baseline` puis `entity_attitudes` |
| Quêtes de fond qui émergent progressivement | A | bloc `quest` + visibilité `gm` |
| Intrigue latente tirée à 50/50, jamais révélée d'un coup | A | visibilité et découvertes — élégamment couvert |
| Magie « langue plutôt qu'outil » | D | profil de narration du monde |
| **Statut juridique de ce monde** | **G** | **trou identifié** : le verrou de partage existe pour un *ruleset* `personal_reference`, pas pour un *monde* bâti sur une œuvre tierce. Voir §9.2 |

### Bloc 7 — module personnage Néphaël

| Élément | Dest. | Verdict |
|---|---|---|
| Identité, apparence, personnalité, origine, famille | — | contenu : bloc `character` + `personality` |
| Statistiques, bonus raciaux, maîtrises, équipement de départ | A | ruleset SRD + fiche |
| Tirage secret d'origine mythique, éléments non révélés | A | visibilité `gm` |
| PM progressant plus vite que la normale | B | règle maison sur une entité — un modificateur, pas un cas particulier de code |
| Quêtes de fond personnelles | A | bloc `quest` |
| **Éléments « inhabituels » pour ce personnage** | **C** | voir §6.3 |
| Orientation et éveil | C/G | contenu sensible : visibilité `gm`, jamais partagé, désactivable |

### Bloc X — contenu explicite

| Élément | Dest. | Verdict |
|---|---|---|
| Autorisation générale du contenu adulte | G | réglage de monde, jamais un défaut |
| Cohérence obligatoire avec la psyché du PNJ | **F** | c'est le meilleur passage du bloc : il décrit un **refus mécanique**, pas une consigne de style. Une proposition qui contredit `lines`/`limits` doit être rejetée par la validation, pas par la politesse du modèle |
| Vie intérieure sexuelle des PNJ | C | mêmes champs qu'au bloc 3, visibilité `gm` |
| Compléments sur un personnage canonique | — | contenu |
| Prostitution, trafics, dynamiques de pouvoir | G | réglage thématique |
| **Limites absolues** (mineurs, non-consenti jamais désirable, psyché jamais trahie) | **G** | à conserver. Voir §9.1 pour ce qui est réellement garantissable et ce qui ne l'est pas |

---

## 4. Le concept vraiment nouveau : le profil de narration

Tout le bloc 1, la moitié du bloc 1b et la structure du bloc 5 décrivent **une même chose que le projet ne nomme nulle part** : comment on veut que ce monde soit raconté.

Aujourd'hui, la seule consigne de style du dépôt est une chaîne codée en dur dans `src/server/ai/spikeSolo.ts`. C'était juste pour un spike ; ce n'est pas tenable pour un monde qu'on joue.

### 4.1 Tranché : un menu, pas un bloc

La version 0.1 de ce document proposait un bloc `narration_profile`. **C'était une erreur d'ergonomie.** Le ton du récit n'est pas une fiche de wiki : on ne le consulte pas, on le règle une fois puis on l'oublie.

Le précédent exact existe déjà dans le dépôt — **le calendrier** : une colonne `worlds.calendar jsonb`, un panneau `components/shell/CalendarSettingsPanel.tsx`, un onglet dans les Réglages. Le récit prend la même forme.

| Quoi | Où |
|---|---|
| La donnée | `worlds.narration_profile jsonb`, exactement comme `worlds.calendar` |
| L'écran | un onglet « Récit » dans les Réglages — V2-K5 les a déjà mis à onglets, V2-K6 y a déjà déplacé le ruleset actif |
| La lecture | assemblée dans le contexte du tour, bornée par l'audience de la sortie (règle absolue 11) |

**Ce qu'on perd en passant du bloc à la colonne, et qu'il faut assumer : l'historique.** Un bloc est versionné par `entity_revisions` ; une colonne de monde ne l'est pas. On ne pourra pas relire « le 12 mars, j'ai adouci le registre ». Jugé sans importance pour un réglage qu'on touche trois fois par an — et si la trace devient utile un jour, un `session_event` à chaque changement coûte trois lignes.

### 4.2 Ce que contient le menu

Deux familles, et la distinction compte : les valeurs fermées produisent une consigne stable, reproductible et traduisible ; le texte libre produit du ton.

**Des curseurs nommés** — registre (lumineux ↔ sombre), rythme (nerveux ↔ contemplatif), longueur de réponse, humour (absent ↔ présent), mortalité (indulgente ↔ implacable), crudité.

**Deux zones libres** — les influences (§4.3) et des consignes en clair.

```json
{
  "register": 3,
  "pacing": 4,
  "length": { "min_words": 200, "max_words": 400 },
  "humor": 2,
  "lethality": 5,
  "person": "second_singular",
  "tense": "present",
  "agency": "strict",
  "options_per_turn": 3,
  "influences": [
    { "name": "Frieren", "note": "mélancolie, temps long, la magie comme une langue" }
  ],
  "free_notes": "Les silences comptent autant que les scènes."
}
```

**`agency` n'est pas un curseur : c'est une validation.** « Tu ne prends jamais le contrôle du personnage joueur » était la consigne la plus violée du prompt d'origine, parce qu'une consigne ne contraint rien. Ici, une proposition de tour qui fait agir le personnage joueur peut être **rejetée par le code**, exactement comme un identifiant inventé l'est déjà. C'est le seul champ du menu qui doit descendre dans la validation plutôt que dans le prompt.

`options_per_turn` mérite la même remarque : les trois options « Que fais-tu ? » du bloc 5 sont un **champ de la sortie structurée**, pas une consigne de mise en page. Le nombre se règle ici ; la forme est garantie par le schéma.

### 4.3 Tranché : s'inspirer d'une œuvre préexistante — le risque n'est pas celui qu'on croit

La crainte naturelle est le coût en contexte. Elle est infondée : nommer une œuvre coûte une poignée de tokens. Ce qui surcharge un modèle, c'est qu'on lui déverse du lore, pas qu'on le nomme.

Les deux vrais risques sont ailleurs :

1. **Un petit modèle local connaît mal l'œuvre citée** et comblera les trous avec assurance — du faux canon énoncé sur le ton du vrai.
2. **L'inspiration entre en concurrence avec le wiki.** Le modèle préfère ce qu'il croit se rappeler à ce que la fiche dit. C'est exactement la panne que ce projet existe pour corriger.

Le garde-fou est déjà structurel : les **références fermées**. Le modèle ne peut citer que des identifiants fournis dans le contexte du tour. Une invention à la sauce d'une œuvre tierce peut colorer une phrase ; elle ne peut pas devenir une entité du monde sans passer la validation.

**Décision : le champ existe, sous la forme d'un nom et d'une note.** Avec une recommandation d'usage : décrire la sensation plutôt que nommer l'œuvre. « Mélancolie, temps long, la magie comme une langue » marche sur n'importe quel modèle ; « Frieren » ne marche que sur ceux qui l'ont vue. C'est vérifiable en dix tours — cinq avec le nom seul, cinq avec la seule note.

---

## 5. Les règles maison, et le mur qu'elles rencontrent

### 5.1 Le constat inattendu

`CLAUDE.md` règle 18 et `specs/ruleset-personnel.md` promettent qu'une variante est un ruleset de plus. C'est vrai pour tout ce qui est saisi comme fiche de règle. **Ce ne l'est pas pour les constantes du moteur.**

Vérifié dans le dépôt :

| Constante | Où | Modifiable en donnée ? |
|---|---|---|
| Taux de change des pièces | `COIN_VALUE_CP` dans `src/core/rules/currency.ts` | **non**, constante |
| Dénominations disponibles (pp/po/pe/pa/pc) | schéma Zod de `inventory` | **non**, enum fermé |
| Capacité de charge FOR × 15, paliers ×5 / ×10 | `src/core/rules/encumbrance.ts` | **non**, constantes |

Les trois variantes du prompt — monnaie centésimale à trois dénominations, encombrement à FOR × 2,5 kg, paliers 100 %/120 % — **exigent donc aujourd'hui une modification de code**, pas une saisie de règle. C'est le seul endroit où j'ai trouvé un écart entre la promesse de personnalisation et l'implémentation.

**Ce n'est pas un bug**, et il ne faut surtout pas « corriger » ça en passant : au moment où ces constantes ont été écrites, il n'existait aucun deuxième cas. La règle des trois s'applique. Mais on tient maintenant deux cas concrets (monnaie, encombrement) et l'échelle de rang en ferait un troisième. **Le moment de l'ADR approche.** Sa question : *quelles constantes du moteur deviennent de la donnée de ruleset, et où vit cette donnée ?*

### 5.2 Le système de mana

C'est le morceau le plus substantiel, et il est cohérent — bien plus qu'un simple remplacement des emplacements de sorts.

Ce qui se pose sans difficulté :

- La **réserve de PM** est un compteur du bloc `resources` (maximum par formule, donc dépendant du niveau).
- Le **coût d'un sort** est un champ à ajouter au bloc `spell_casting`, ou un bloc de surcharge dans le ruleset personnel.
- Les **sorts théorisés** sont un statut de plus dans le bloc `spellcasting` — connu / préparé / théorisé.
- L'**évolution d'un sort** (coût réduit **ou** effet amplifié, exclusifs) est exactement la primitive `Choice` avec deux `Grant`.
- Le **temps d'apprentissage** est de la donnée : un palier par tranche de coût.

Ce qui accroche, et qu'il faut savoir avant de commencer :

| Point | Difficulté |
|---|---|
| Récupération de 50 % au repos court | `recharge` est un enum (`short_rest`/`long_rest`/`dawn`/`never`), pas une fraction. Un champ de plus, petit |
| Deux classes de cantrips (0 PM vs 1-2 PM) | classification par intention, pas par donnée SRD. Se saisit à la main, ne s'importe pas |
| « Un sort ne s'apprend que si on peut le lancer une fois » | une condition, exprimable dès que les déclencheurs existent |
| Interaction avec les emplacements SRD | un personnage utilise l'un **ou** l'autre. Le ruleset doit pouvoir désactiver la progression d'incantation officielle |

Le dernier point est le vrai : ce n'est pas une variante additive, c'est une **substitution**. Le mécanisme de surcharge (`ruleset_overrides`) sait ajouter et modifier ; il faut vérifier qu'il sait retirer.

### 5.3 Les objets — tranché : le vocabulaire au ruleset, l'instance à l'inventaire

iLvl, six qualités, identification obligatoire, risque d'effet aléatoire par qualité : cohérent, et presque entièrement de la donnée. La distinction à ne pas rater, sous peine de se coincer à l'implémentation :

| Quoi | Où |
|---|---|
| La liste des six qualités, l'échelle d'iLvl, la table de risque par qualité, les paliers de temps d'identification | **le ruleset** — c'est du vocabulaire de règles |
| « Cette dague-ci est Ancienne, iLvl 3, non identifiée » | **le bloc `inventory`** — c'est un fait sur un objet possédé |

Le ruleset définit ce que « Ancien » veut dire ; l'inventaire dit quels objets le sont. Les deux sont nécessaires, et **seul le premier est du contenu de ruleset** — c'est la moitié qu'on oublie en croyant que « tout va dans le ruleset ».

La **valeur marchande dynamique** est l'exception : le prompt la voulait simulée. Recommandation de ne pas la simuler. Les générateurs savent déjà tirer un prix filtré par palier de richesse et de zone (V2-J9quater, V2-J10) — un prix qui varie selon la boutique et la région, sans aucune simulation économique de fond. C'est 90 % de l'effet voulu pour 0 % du travail.

---

## 6. Les ajouts à fort rendement

Classés par rapport valeur / effort, du meilleur au moins bon.

### 6.1 « Amour ↔ haine » : un pôle, pas un axe de code

Les sept axes de `relationship` couvrent trois des quatre jauges du prompt :

| Jauge du prompt | Axe existant |
|---|---|
| Confiance ↔ Méfiance | `trust_distrust` |
| Amitié ↔ Rivalité | `friendship_hostility` (bande extrême : « haineux » / « dévoué ») |
| Attirance ↔ Dégoût | `attraction_repulsion` |
| **Amour ↔ Haine** | **aucun** |

L'amour n'est ni l'amitié poussée à l'extrême ni l'attirance : c'est l'axe qui produit le sacrifice. Il manque réellement.

**Mais il ne faut pas l'ajouter à la liste fermée.** `specs/psyche-pnj.md` §8 a déjà tranché la bonne réponse : *« Les pôles sont-ils configurables par monde ? oui »*. Un monde ajoute `love_hatred`, un autre ajoute `loyalty` pour les recrues, un troisième `loyauté ↔ ambition` pour une cour. Une seule mécanique, trois besoins du prompt satisfaits.

C'est aussi ce qui rend possible la jauge de loyauté du bloc 4b sans rien inventer.

**Confirmé en relecture :** le bloc `relationship` couvre bien le besoin, et la configuration par monde est la voie retenue plutôt qu'un huitième axe ajouté à la liste fermée.

### 6.2 La réputation est déjà là, sans qu'on l'ait remarqué

Le prompt décrit longuement un système de réputation : elle voyage, elle pré-oriente les PNJ, elle se croise entre factions rivales.

Trois faits du schéma actuel se rejoignent :

1. Le groupe de joueurs **est une entité `faction`** (`campaigns.party_entity_id`).
2. `entity_attitudes` porte des attitudes **dirigées** (A envers B), à la portée campagne.
3. `worldview` est attachable à une **faction**.

Donc *« votre réputation auprès de la Guilde des Marchands »* est déjà exprimable : c'est l'attitude de la faction « Guilde des Marchands » envers la faction « le groupe ». Aucun concept nouveau, aucune table nouvelle.

Ce qui manque vraiment se réduit à deux choses. **La propagation** — un fait connu d'une faction devient connu d'une autre, fidèlement ou déformé : c'est un mécanisme, et il attend les horloges du §7. Et **le pré-remplissage à la première rencontre**, retenu ci-dessous.

#### Tranché : la première impression donne la teinte de base

Au premier contact, une fonction pure calcule l'attitude de départ à partir de quatre entrées :

1. la `baseline` du PNJ — **ce champ existe déjà** sur le bloc `personality` (`trust`, `affinity`, `respect`, `fear`) ;
2. l'attitude de sa faction envers le groupe, c'est-à-dire la réputation ci-dessus ;
3. le rang de l'aventurier, s'il en a un ;
4. les circonstances de la rencontre.

Plafonnée, comme le prompt le demandait : **±50 sur l'échelle −100/+100**, sauf réputation vraiment établie et connue du PNJ avant la rencontre.

Le point qui rend ça tenable : **c'est un amorçage unique, pas une simulation.** Il s'écrit comme un `attitude_event` d'origine `system`, donc il apparaît dans l'historique (« première rencontre : réservé — la Guilde vous tient en piètre estime »), il se rejoue à l'identique, et il se corrige d'un curseur. C'est l'effet que le prompt cherchait — un PNJ qui a déjà un avis avant d'ouvrir la bouche — sans rien faire tourner en arrière-plan.

### 6.3 « Ce qui le frappe » — ce qui est inhabituel pour ce personnage

La règle du bloc 1b est excellente et je ne l'ai vue formulée nulle part ailleurs : *le niveau de détail d'une description est proportionnel à la familiarité, sauf pour ce qui est inhabituel pour le personnage, qui reçoit toujours une description complète.*

La moitié existe déjà : `entity_discoveries.detail_level` distingue `mentioned` / `known` / `detailed` — exactement la familiarité. Il n'est simplement jamais utilisé pour moduler ce que le modèle reçoit.

L'autre moitié n'a **nulle part où vivre** aujourd'hui. Les six lignes écrites pour Néphaël — la nudité, la proximité chargée de tension, les coutumes étrangères à son village, les objets magiques inconnus, les architectures hors de son expérience, les manifestations de puissance magique exceptionnelle — ne se rangent dans aucun champ existant.

D'où un champ sur `personality`, clé technique `striking`, libellé **« Ce qui le frappe »** :

```json
"striking": [
  { "text": "la nudité, la sienne ou celle d'autrui", "visibility": { "level": "gm" } },
  { "text": "les architectures hors de son expérience passée" },
  { "text": "les manifestations de puissance magique exceptionnelle" }
]
```

Coût : un champ optionnel et une ligne de contexte. Effet : une auberge ordinaire tient en deux phrases et un mur de cristal en dix, sans qu'on ait rien à demander. Sans lui, tout est décrit avec la même richesse — et c'est la première chose qui trahit une narration automatique.

### 6.4 La vie intérieure des PNJ — tranché : trois orientations distinctes

Le prompt demande que chaque PNJ significatif reçoive, à sa création, une orientation, un rapport à l'intimité, des désirs et des contradictions — jamais annoncés, révélés par le comportement.

`personality` porte déjà `aspirations`, `lines`, `limits`, `speech`. Manquent l'orientation et le rapport à l'intimité.

**Une seule « orientation » ne suffit pas** — la version 0.1 se trompait sur ce point. Quelqu'un peut être hétéroromantique et bisexuel, ou aromantique et polyamoureux. Trois champs, pas un :

| Champ | Exemples |
|---|---|
| orientation **relationnelle** | monogame, polyamoureux, libertin, célibataire par choix |
| orientation **romantique** | hétéro-, homo-, bi-, pan-, aro- |
| orientation **sexuelle** | hétéro-, homo-, bi-, pan-, asexuel |

Plus un champ pour le **rapport à l'intimité et à la nudité** : à l'aise, pudique, tabou culturel, curieux, réprimé.

#### Tranché : dans `personality`, jamais dans `worldview`

La question se pose parce que les deux blocs décrivent « qui est cette personne ». La ligne de partage posée par `specs/psyche-pnj.md` §2 la tranche sans hésitation :

> Une guilde a des convictions ; elle n'a pas de tempérament.

`worldview` est attachable à une **faction** — c'est même sa raison d'être, puisque c'est ce qui permet de comparer un PNJ à son ordre et d'en faire tomber une tension. Une faction n'a pas d'orientation. Mettre l'intimité dans `worldview`, ce serait la rendre attachable à une guilde, et casser la seule chose que ce bloc sait faire de plus que l'autre.

Reste `personality`, et trois arguments positifs plutôt qu'un défaut :

1. **Il porte déjà de l'intime sensible.** `aspirations` contient « retrouver qui a brûlé sa maison » en visibilité `gm`, `lines` et `limits` disent ce qu'on ne fera jamais. Un sous-objet de plus n'ouvre aucune porte qui ne le soit pas.
2. **La visibilité par élément y est déjà précédente.** Les aspirations portent chacune la leur ; les orientations et le rapport à l'intimité feront pareil, plutôt qu'une visibilité de bloc unique qui obligerait à tout cacher ou tout montrer.
3. **Un bloc séparé serait lui-même une divulgation.** Un encart « Intimité » sur une fiche dit quelque chose *par sa seule présence*, même vide, et même quand on l'a désactivé au niveau du monde. Un sous-objet absent d'un bloc existant ne dit rien.

#### Les précautions, dont une qui n'est pas négociable

- **Liste suggérée, saisie libre.** Un enum fermé finira toujours par manquer un cas, et c'est un outil personnel.
- **Visibilité `gm` par défaut**, par élément, et **le même interrupteur de monde que l'axe `attraction_repulsion`** (`specs/psyche-pnj.md` §3) — un seul réglage « contenu intime », pas deux qui finiront par diverger.
- **Valable aussi pour le personnage joueur** — Néphaël en a un, et c'est ce qui rend son éveil jouable plutôt que décoratif.
- **La résolution est serveur, jamais un masquage d'affichage.** Un champ « caché » envoyé au client puis masqué en CSS est une fuite, pas une visibilité — c'est exactement la faute que la règle absolue 6 interdit pour la marque `spoiler`, et l'orientation d'un PNJ est précisément le genre de champ sur lequel on serait tenté de la commettre.

Les « contradictions internes » n'ont pas besoin de champ : deux pôles opposés avec `priority` qui tranche produisent exactement ça, et c'est déjà en place.

### 6.5 Les dés physiques

Le prompt part d'un fait : l'auteur lance ses vrais dés. C'est un mode de saisie, pas une entorse.

Ce que ça demande : un champ d'origine sur `dice_rolls` (`server` / `physical`), une saisie du résultat brut, et le moteur applique modificateurs, comparaison à la CA, critique. La règle 8 tient intégralement — le modèle ne produit toujours aucun nombre.

Ce que ça apporte : la seule façon d'assumer qu'un joueur solo joue avec ses dés sans que le système lui mente sur ce qui s'est passé.

### 6.6 « GM : » et « RP : »

Deux canaux dans une seule saisie. Hors-jeu : réponse méta, aucune écriture dans le monde, l'horloge ne bouge pas. En-jeu : le tour complet.

C'est peu de travail et ça résout un vrai problème du jeu solo : poser une question sur une règle sans faire avancer l'histoire. Aujourd'hui, rien ne distingue les deux.

### 6.7 Rang et quêtes — tranché : en trois temps

Le bloc `quest` existe depuis V2-H4, mais à l'état d'ébauche. Le creuser d'un coup serait une erreur : les trois morceaux n'ont pas les mêmes dépendances.

| Temps | Contenu | Dépend de |
|---|---|---|
| **Maintenant, `S`** | trois champs sur `quest` : rang requis, temporalité, délai | rien |
| **Maintenant, contenu** | le générateur de quêtes | rien — le mécanisme existe |
| **V3** | verrou d'acceptation par rang, joueur commanditaire, quêtes qui expirent ou que d'autres accomplissent | l'horloge et l'état de scène du moteur |

**Le générateur de quêtes est le meilleur rapport de toute l'analyse, parce que c'est du contenu et non du code.** Les générateurs composés, les emplacements et le tirage filtré par palier existent déjà (V2-J9quater — celui qui fait qu'une échoppe réputée sort des objets chers). Le barème de récompense par rang du prompt *est* un axe de palier. Emplacements : commanditaire et sa motivation (en visibilité `gm`), objectif, lieu, complication, récompense, délai. Et le mécanisme de promotion existe : « générer » puis « créer la fiche » produit une entité avec son bloc `quest` prérempli.

**À savoir avant d'ouvrir le sujet :** V2-H4 a laissé un critère décoché — *« les quêtes actives entrent dans le contexte déterministe de la V3 »*. La fonction `listActiveQuestsForWorld` existe déjà, filtrée par visibilité, et **rien ne l'appelle**. Le crochet est posé, il attend son moteur.

Pour l'échelle de rang elle-même, voir §12 : elle tient dans un `custom_table` avant de mériter un bloc à elle.

---

## 7. Le monde autonome : le seul vrai chantier

Ce que le prompt demande, réparti sur trois blocs : des factions qui négocient et trahissent hors champ, des quêtes qui expirent, d'autres aventuriers qui accomplissent les missions avant le joueur, des propriétés frappées par un incendie ou une inspection, des conséquences politiques qui remontent des semaines plus tard.

C'est cohérent, c'est ce qui fait la différence entre un décor et un monde, **et rien dans le dépôt ne s'en approche.**

Deux avertissements avant d'en faire un ticket.

**Ce n'est pas une simulation continue.** `specs/psyche-pnj.md` §1 a explicitement refusé la dérive de fond, pour une raison qui vaut ici aussi : chaque mouvement coûte des tokens ou de l'attention. Un monde qui tourne en tâche de fond est ruineux des deux côtés.

**La forme qui tient est déclarative et paresseuse :** une **horloge** portée par une faction ou une propriété — un objectif, un nombre de crans, ce qui se produit quand elle se remplit, et ce qui la fait avancer. Elle n'avance que sur événement : le temps passé, une action du joueur, un déclencheur. On la consulte quand on entre dans la scène, pas toutes les heures.

C'est un mécanisme connu et éprouvé, il se pose sur les déclencheurs de `specs/moteur-de-jeu.md` §4 sans rien y ajouter, et il ne coûte rien quand personne ne regarde. Mais **c'est un lot, pas un ticket** — et il vient après les déclencheurs, jamais avant.

---

## 8. Un désaccord assumé : les pourcentages

Le prompt affiche « Confiance +65 % ». Le projet affiche « confiant », exprès (`specs/psyche-pnj.md` §1.5).

L'argument du projet reste le bon, et il ne concerne pas l'écran mais le modèle : `trust: -47` ne dit rien d'actionnable à un modèle, et deux modèles interpréteront ce nombre différemment. La bande nommée est ce qui rend un PNJ reconnaissable d'une séance à l'autre.

Recommandation : **garder les bandes**. Le besoin réel derrière le pourcentage — voir bouger une jauge, sentir la progression — est déjà satisfait autrement : le MJ voit la valeur exacte au survol, et `attitude_events` affiche le mouvement et son amortissement (« hostilité +10, appliqué +6 »), ce que le prompt ne pouvait pas faire.

Un curseur visuel sans chiffre couvrirait le reste, si le besoin se confirme à l'usage.

---

## 9. Contenu sensible, licence, partage

### 9.1 Ce qui est garantissable, et ce qui ne l'est pas

Le bloc X est écrit avec plus de soin que la plupart des prompts de ce genre : il pose des limites absolues et exige la cohérence avec la psyché établie. Il faut être franc sur ce que l'architecture peut réellement tenir.

| Ce que demande le bloc X | Garantissable par le code ? |
|---|---|
| Une scène ne trahit jamais la psyché établie d'un PNJ | **oui, partiellement** — une proposition contredisant `lines`/`limits` peut être rejetée à la validation |
| Le contenu reste dans le monde de son auteur | **oui** — visibilité, bornage du contexte par l'audience, journalisation |
| Les limites absolues (mineurs, etc.) | **non par le prompt seul.** Elles dépendent du modèle et du fournisseur |

Conséquences concrètes :

- Un **réglage de contenu par monde** (thèmes activés, intensité) est de la donnée, avec un défaut restrictif. Il borne ce que le profil de narration transmet.
- Les **limites absolues ne sont pas un réglage.** Elles vivent côté serveur, ne dépendent d'aucun monde, et ne s'affichent pas comme une case à décocher.
- Le **choix du fournisseur** décide de ce qui est réellement possible (`AiProvider`, `specs/cible-locale-et-ia.md`). Un monde marqué ainsi ne doit jamais partir vers un fournisseur distant sans décision explicite de l'auteur — c'est un argument de plus pour la cible locale, pas un détail de configuration.

### 9.2 Le trou : un monde bâti sur une œuvre tierce

`specs/ruleset-personnel.md` §3 verrouille en base le partage d'un monde dont le **ruleset** est `personal_reference`. Le monde du bloc 6 n'est pas dans ce cas : ses règles sont le SRD, parfaitement partageable. Ce qui ne l'est pas, c'est **son contenu** — des personnages canoniques d'une œuvre protégée.

Rien n'empêche aujourd'hui d'en créer un lien de partage public.

Le raisonnement de `ruleset-personnel.md` §1 s'applique mot pour mot : la mécanique n'est pas protégeable, l'expression et l'identité de produit le sont, et le cercle privé reste la ligne. Il manque simplement le verrou correspondant côté monde — un drapeau sur `worlds`, refusé par déclencheur à la création d'un `share_link`, exactement comme pour les rulesets. Petit, et à faire **avant** de saisir ce monde, pas après.

---

## 10. Frictions avec les règles absolues

Cinq passages du prompt contredisent une règle du projet. Aucun n'est un obstacle : dans les cinq cas, le besoin survit, le mécanisme change.

| Passage | Règle | Ce qui le remplace |
|---|---|---|
| « Tu décides seul des variations des jauges » | 8 — l'IA narre, le code arbitre | une proposition avec un delta, validée puis appliquée par `applyDelta` |
| « Fiches PNJ maintenues silencieusement en arrière-plan » | 9 — l'IA n'écrit jamais en base | `ai_proposals` ; « silencieusement » devient « signalé et annulable » |
| L'état de l'histoire réaffiche CA, modificateurs, encombrement | 16 — aucune valeur dérivée stockée | `characterSheet()` |
| « Les jets PNJ sont simulés silencieusement » | 8 + 13 | le serveur lance, `dice_rolls` journalise, « GM : » consulte la trace |
| Monnaie, encombrement, mana modifient les règles de base | 18 — les règles officielles ne sont jamais modifiées | un ruleset `user_created` avec `parent_ruleset_id` — sous réserve du §5.1 |

---

## 11. Ce que je recommande, dans l'ordre

Trois vagues. La première est du confort réel pour peu de travail ; la troisième est un projet.

**Vague 1 — petits, indépendants, tranchés**

1. Onglet « Récit » dans les Réglages et colonne `worlds.narration_profile`, champ d'inspirations compris (§4).
2. Verrou de partage d'un monde à contenu tiers (§9.2) — **avant** la saisie du monde Frieren, pas après.
3. Pôles de relation configurables par monde (§6.1) — débloque « amour ↔ haine » et la loyauté d'une seule pierre.
4. Champ `striking` sur `personality` (§6.3), et usage de `detail_level` dans le contexte.
5. Trois champs sur le bloc `quest` : rang, temporalité, délai (§6.7).
6. Les trois orientations et le rapport à l'intimité (§6.4).

**Vague 2 — contenu, puis ruleset personnel**

7. Générateur de quêtes (§6.7) — du contenu, pas du code. À faire avant le reste de la vague : c'est le plus rentable et le moins risqué.
8. Un ADR sur les constantes du moteur qui deviennent de la donnée (§5.1). **Préalable** aux deux points suivants, pas une conséquence.
9. Le ruleset mana : réserve, coût, sorts théorisés, évolution, apprentissage (§5.2) — avec la fraction de recharge, sans laquelle « 50 % au repos court » ne s'écrit pas.
10. Objets : vocabulaire de qualité au ruleset, `item_level`/`quality`/`identified` sur l'inventaire (§5.3).

**Vague 3 — après les déclencheurs**

11. Pré-remplissage des attitudes à la première rencontre (§6.2).
12. Mode « dés physiques » (§6.5) et canaux « GM : » / « RP : » (§6.6) — ils touchent le tour de jeu, donc après V3-A.
13. Verrou de rang, joueur commanditaire, quêtes qui expirent (§6.7).
14. Horloges de faction et de propriété (§7), et la propagation de réputation qui en dépend.

**Jamais, ou pas avant longtemps :** la gouvernance politique du bloc 4b, la simulation économique des valeurs marchandes, la dérive de fond des jauges de PNJ absents.

---

## 12. Questions à trancher

Ce qui a été réglé en relecture est au §0.1. Restent celles-ci — aucune n'est urgente, toutes changent le résultat si on y répond après coup.

| Question | Ma recommandation |
|---|---|
| **Quelles constantes du moteur deviennent de la donnée ?** | monnaie et encombrement d'abord, puis on s'arrête et on observe. **Seule question réellement bloquante** : tout le ruleset personnel en dépend |
| Le mana remplace-t-il les emplacements ou coexiste-t-il ? | il remplace, dans un ruleset dédié. À vérifier avant de s'engager : le mécanisme de surcharge sait-il **retirer** une règle, ou seulement en ajouter et en modifier ? |
| Pourcentages ou bandes nommées pour les attitudes ? | garder les bandes (§8) ; un curseur sans chiffre si le besoin de « voir bouger » persiste à l'usage |
| Les jauges des PNJ absents évoluent-elles en arrière-plan ? | maintenir le refus de `psyche-pnj.md` §1 — mais c'est un choix de jeu, pas d'architecture, et seul l'auteur sait si le monde lui a paru mort sans ça |
| « Système implicite » ou fiche qui montre sa trace ? | un réglage d'affichage, pas une doctrine. S'il faut vraiment jouer à l'aveugle, cela change la conception de l'écran solo, pas seulement une case |
| Le rang : `custom_table` ou vrai bloc ? | `custom_table` d'abord ; vrai bloc à la troisième insuffisance |
| Le rang est-il une donnée de ruleset ou de campagne ? | l'échelle et les paliers dans le ruleset ; le rang atteint dans l'état de campagne |
| Les réglages de contenu : par monde ou par compte ? | par monde, plafonné au compte, défaut restrictif (§9.1) |
| Le monde autonome : suite naturelle de la V3, ou « un jour » ? | à décider maintenant — cela change ce qu'on écrit dans le backlog dès aujourd'hui |
| Propriétés et gouvernance : « jamais » ou « un jour » ? | si « un jour », la jauge de loyauté (vague 1, point 3) devient un préalable à ne pas rater |
| Le mode « dés physiques » se règle-t-il par campagne ou par tour ? | par campagne, avec dérogation ponctuelle |

---

## 13. En une phrase

Le prompt d'origine contenait trois choses mêlées : de la mémoire, que l'architecture rend inutile ; des règles maison, qui sont de la donnée et attendent un ruleset ; et un ton de récit, qui est le seul concept que le projet ne sait pas encore nommer — et qui est aussi ce qui rendait ces parties bonnes.
