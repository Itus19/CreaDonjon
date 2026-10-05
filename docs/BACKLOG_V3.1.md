# Backlog V3.1 — Rugosités trouvées en jouant

**Version :** 1.0 — 27 septembre 2026

Différent de V2 et V3 : pas de lots planifiés à l'avance, pas de découpage en
phases. Ce backlog recueille les petites corrections trouvées **au fil de
l'utilisation réelle** de l'outil — un formulaire qui coince sur un cas
concret, un avertissement qui ment, un détail qui gêne à la table. Un ticket
s'y ajoute quand quelque chose de ce genre est constaté, pas quand il est
planifié. Taille attendue : `S` ou `M` presque toujours — si un ticket ici
grossit au point de devenir un vrai chantier, il migre vers V2 ou V3.

**Lire les titres.** ☑ : ticket terminé. ☐ : il reste du travail, y compris
une simple vérification en direct chez l'auteur. Un ticket « fait » dont des
points sont reportés ou réservés (et écrits comme tels) est coché. Sous chaque
titre, le **modèle conseillé** : *Sonnet* quand le ticket est bien spécifié et
local (interface d'après une esquisse décidée, saisie, fonction pure) ; *Opus*
quand il faut concevoir, ou qu'il touche au noyau du moteur, à l'IA, au schéma,
à la RLS ou à la sécurité. Le critère n'est pas la taille mais le risque et
l'ambiguïté : un petit ticket de sécurité va à Opus, un gros écran déjà dessiné
à Sonnet.

---

### ☐ V3.1-1 — `REQUIRED_BLOCKS` trop strict sur les sorts sans effet chiffré · `S`

**Modèle conseillé : Sonnet** — assouplir une validation, cas bien décrits.

Constaté le 27 septembre en créant la sous-classe « Serment de vengeance »
(Paladin) et en relisant le ticket V2-N2 : sur les 339 sorts de la base SRD
5.2.1 (2024), seuls 66 portent un bloc `effects`/`scaling` — la grande
majorité des sorts (buffs, utilitaires, mise en scène pure) n'ont
légitimement **aucun** effet chiffré structuré. Le formulaire manuel « Créer
un sort » (`CreateHomebrewSpellForm.tsx`, V2-N2) le sait déjà et n'écrit pas
de bloc `effects` quand la section reste vide — mais `REQUIRED_BLOCKS`
(`src/core/rules/requiredBlocks.ts`), qui liste les blocs attendus par type
d'entrée (`entry-types.ts`), exige `effects` pour **tout** sort sans
distinction. Résultat : une fiche de sort sans effet chiffré affiche à tort
l'avertissement « bloc manquant » — déjà visible aujourd'hui sur Détection de
la magie, et ça vaudrait pour n'importe quel sort maison créé sans effet.

Le ticket V2-N2 l'avait déjà noté en passant, sans ouvrir de ticket dédié :
*« c'est plutôt `REQUIRED_BLOCKS` qui est trop strict pour les sorts, à revoir
à part »*.

**Critères**
- [ ] Un sort sans effet chiffré légitime (buff, utilitaire, mise en scène)
  n'affiche plus d'avertissement de bloc manquant.
- [ ] Un sort qui devrait porter un effet chiffré (jet d'attaque ou de
  sauvegarde décrit en prose) continue de le signaler s'il n'en a pas —
  la relecture ne doit pas juste supprimer `effects` de la liste sans
  y réfléchir, sous peine de perdre le signal utile sur les 66 sorts qui en
  ont besoin.
- [ ] Aucune régression sur les autres types d'entrée qui utilisent
  `REQUIRED_BLOCKS` (sous-classe, don, historique…).

---

### ☐ V3.1-2 — Aucun moyen d'éditer une fiche maison déjà créée · `M`

**Modèle conseillé : Sonnet** — réutiliser le formulaire de création en édition, verrous déjà connus.

Constaté le 27 septembre en corrigeant le don « Chanceux » : son texte,
recopié depuis une mauvaise source, s'est révélé faux une fois la bonne page
du manuel sous les yeux. Chaque fiche de règle (`RuleEntryView.tsx`) ne
propose qu'un bouton « Supprimer » (`disable_entry`, via `/api/worlds/[slug]/
regles/[cle]/disable`) — aucun « Modifier ». La seule façon de corriger un
texte a été de supprimer la fiche puis de la recréer entièrement avec le
formulaire d'origine, en resaisissant tous les champs déjà justes. Ça marche
(la clé se libère : `disable_entry` retire la fiche de `existingKeys`, la
recréation reprend le même slug), mais c'est un détour pour ce qui devrait
être une simple correction de coquille ou de texte mal recopié.

Vaut pour les cinq formulaires de la famille « Créer un/une… » (arme,
historique, don/aptitude, sous-classe, sort) : aucun n'a d'équivalent en
édition, contrairement aux entités du wiki (`EditEntityForm`).

**Critères**
- [ ] Une fiche maison (`content_origin` `user_created` ou
  `personal_reference`) propose un bouton « Modifier » qui rouvre son
  formulaire de création, pré-rempli avec les valeurs actuelles.
- [ ] Valider le formulaire modifie la fiche en place (même `entry_key`,
  mêmes blocs mis à jour) — jamais une nouvelle fiche à côté de l'ancienne.
- [ ] Un renvoi existant vers cette fiche (`ruleset_entry_refs`, une classe
  qui la référence comme sous-classe, un personnage qui la porte comme don)
  continue de pointer dessus après modification.
- [ ] Une base officielle reste inéditable — même verrou que la création.

---

### ☐ V3.1-3 — Les dons à choix (Initié à la magie, etc.) n'ont aucune UI de choix · `L`

**Modèle conseillé : Opus** — mécanisme générique de choix pour les dons, partagé avec V3.1-6 et V3.1-7.

**À concevoir ensemble : V3.1-3, V3.1-6 et V3.1-7.** Les trois demandent le
même mécanisme générique de choix (dons, traits d'espèce, sous-classes) :
le concevoir une fois, avec Opus, avant d'en coder un seul. V3.1-4 se branche
ensuite dessus, avec Sonnet.

Constaté le 27 septembre en accordant « Initié à la magie » via l'historique
« Guide ». Le don s'affiche sur la fiche en texte descriptif, mais l'assistant
de création de personnage ne propose **aucune étape** pour résoudre ses
choix (classe de sorts, deux sorts mineurs, un sort de 1er niveau) — et ce
n'est pas propre au contenu maison : **aucun don du jeu, même officiel,
n'a cette UI aujourd'hui.** `CharacterCreatorWizard.tsx` ne liste aucune étape
de type « FeatsStep » ; `AsiStep.tsx` (amélioration de caractéristique) ne
contient aucune logique de don ; la résolution des dons
(`resolvedRuleset.ts`) ne gère qu'un bloc `modifiers` générique (bonus fixes),
sans mécanisme de sous-choix comparable à celui déjà construit pour les
langues d'un historique (`RemainingChoice`, `resolvedRuleset.ts`).

Déjà noté comme hors périmètre, sans ticket dédié : *« Hors périmètre, à ne
pas faire ici : choix de don (nécessite une UI de création/montée de niveau,
gros morceau à part)... »* (`docs/BACKLOG_V1.md:619`).

**Taille assumée au-delà du format habituel de ce backlog** (voir l'intro :
`S`/`M` presque toujours) — à traiter comme un signal qu'il migre vers V2 ou
V3 le jour où il est pris, pas comme un ticket à boucler sur une session.

**Critères**
- [ ] Un don qui accorde un choix (classe de sorts, sorts mineurs, sort de
  niveau) présente ce choix dans l'assistant de création de personnage, au
  moment où le don est accordé (historique, don libre, etc.).
- [ ] Le choix résolu est appliqué mécaniquement — les sorts choisis
  deviennent réellement disponibles sur la fiche (onglet Actions), pas
  seulement consignés en texte.
- [ ] Le mécanisme est générique (comme `RemainingChoice` pour les langues),
  pas câblé au cas par cas pour Initié à la magie seul — un deuxième don à
  choix (ex. Chanceux répétable, un futur don maison) doit pouvoir le
  réutiliser sans nouveau code de choix.
- [ ] Un don sans choix (la majorité) continue de s'afficher tel quel, sans
  étape supplémentaire imposée à l'assistant.

**Vaut aussi pour un don accordé par une espèce** (constaté le 27 septembre
sur « Polyvalent »/Versatile, trait humain — don d'origine au choix) : la
branche qui résout l'espèce (`resolvedRuleset.ts:342-351`) ne gère aucun don
du tout, contrairement à l'historique qui en accorde au moins un fixe
(`extractBackgroundFeat`). Un don accordé par une espèce est donc un cran
plus creux que le cas déjà décrit ci-dessus — même critère, pas de ticket
séparé.

---

### ☐ V3.1-4 — Un trait d'espèce qui accorde une maîtrise au choix ne l'accorde jamais · `S`/`M`

**Modèle conseillé : Sonnet** — brancher un choix déjà lu par extractSkillChoices.

Constaté le 27 septembre sur « Compétent »/Skillful, trait humain : « Vous
gagnez la maîtrise d'une compétence de votre choix. » Les classes ont déjà ce
mécanisme — `extractSkillChoices` lit `fields.proficiency_choices` et fait
apparaître un choix de compétence dans l'assistant (`resolvedRuleset.ts:435`).
La branche espèce, elle, ne lit que `mapSpeciesModifiers`/`mapProficiencies`/
`extractLanguages` sur les champs de l'espèce elle-même
(`resolvedRuleset.ts:342-351`) — jamais les `proficiency_choices` portés par
un trait individuel de l'espèce (les traits d'espèce ne sont que des
références `{index, name}` côté données SRD, la maîtrise à choisir vit sur la
fiche du trait, jamais rejointe ici). Résultat : choisir Humain n'accorde
aujourd'hui aucune maîtrise de compétence, ni choix ni maîtrise silencieuse.

Plus contenu que V3.1-3 : le mécanisme de choix existe déjà (celui des
classes), il s'agit de l'étendre aux traits d'espèce plutôt que d'en
inventer un nouveau.

**Critères**
- [ ] Un trait d'espèce portant un `proficiency_choices` (compétence, langue,
  outil...) présente ce choix dans l'assistant, comme le fait déjà un choix
  de compétence de classe.
- [ ] Le choix résolu produit une vraie maîtrise sur la fiche (test de
  compétence concerné, bonus de maîtrise appliqué).
- [ ] Aucune régression sur les maîtrises fixes déjà accordées par une
  espèce (celles qui ne portent pas de choix).

---

### ☐ V3.1-5 — Le Repos long ne déclenche aucun effet lié aux traits (Inspiration héroïque, etc.) · `M`

**Modèle conseillé : Sonnet** — un effet de Repos long sur le vocabulaire de déclencheurs existant.

**4 octobre — ADR 0036 §7** : V3.1-24 fait émettre `long_rest` par `takeLongRest` ; ce ticket n'a plus qu'à donner à « Ingénieux » un déclencheur `long_rest` — l'effet qui accorde l'inspiration manque au vocabulaire fermé des déclencheurs : l'ajouter s'écrit en ADR. **Dépend de** : V3.1-24.

Constaté le 27 septembre sur « Ingénieux »/Resourceful, trait humain : « Vous
gagnez l'Inspiration héroïque lorsque vous terminez un Repos long. »
L'inspiration existe bien comme ressource réelle sur la fiche (`inspiration:
number`, `src/core/schemas/runtimeState.ts:77`, réglable à la main via
`CharacterSheetHeader.tsx:519-540`), et le bouton « Repos long » appelle une
vraie action serveur (`takeLongRest`, `src/server/services/
characterActions.ts:634-693`). Mais cette fonction ne touche que PV, dés de
vie, épuisement, emplacements de sort et ressources nommées — jamais
l'inspiration — et ne vérifie nulle part si le personnage porte le trait
« resourceful ». Un personnage humain qui clique sur Repos long n'obtient
donc jamais son Inspiration héroïque.

Contrairement à V3.1-3/V3.1-4, ce n'est pas un choix à la création : c'est un
effet qui doit se déclencher en jeu, à chaque repos — plus proche des
déclencheurs (V3-A5) que de l'assistant de personnage.

**Critères**
- [ ] Terminer un Repos long avec un personnage portant « Ingénieux »
  accorde l'Inspiration héroïque (si elle n'est pas déjà à son maximum,
  selon la règle 2024).
- [ ] Un personnage sans ce trait n'est pas affecté.
- [ ] Le mécanisme reste ouvert à d'autres effets liés au Repos long portés
  par un trait/don futur, plutôt que câblé en dur pour Ingénieux seul.

---

### ☐ V3.1-6 — Aucun mécanisme générique pour les traits d'espèce à choix · `L`

**Modèle conseillé : Opus** — mécanisme générique des traits à choix, cinq formes de choix.

**À concevoir ensemble : V3.1-3, V3.1-6 et V3.1-7.** Les trois demandent le
même mécanisme générique de choix (dons, traits d'espèce, sous-classes) :
le concevoir une fois, avec Opus, avant d'en coder un seul. V3.1-4 se branche
ensuite dessus, avec Sonnet.

Suite à V3.1-3/V3.1-4 (Humain seulement) : relevé le 27 septembre sur les 9
espèces officielles du SRD 5.2.1, quels traits portent un choix.

| Espèce | Trait à choix | Nature du choix |
|---|---|---|
| Elfe | Lignage elfique (Elven Lineage) | choisir un lignage (Drow / Haut-elfe / Elfe des bois) — chacun accorde un cantrip au niveau 1, un sort de plus aux niveaux 3 et 5, et une caractéristique d'incantation à choisir (Int/Sag/Cha) |
| Elfe | Sens aiguisés (Keen Senses) | choisir une compétence parmi Intuition/Perception/Survie — **même mécanisme que V3.1-4** |
| Gnome | Lignage gnomique (Gnomish Lineage) | choisir Gnome des forêts ou Gnome des roches — chacun accorde des cantrips et un sort/objet différents |
| Goliath | Ascendance de géant (Giant Ancestry) | choisir un des 6 bénéfices (Nuage/Feu/Givre/Colline/Pierre/Tempête) — capacité rechargeable, utilisations = bonus de maîtrise, récupérées au Repos long |
| Humain | Compétent (Skillful) | choisir une compétence — **V3.1-4** |
| Humain | Polyvalent (Versatile) | choisir un don d'origine — **V3.1-3** |
| Tieffelin | Legs infernal (Fiendish Legacy) | choisir un legs (Abyssal / Chthonien / Infernal) — même forme que le lignage elfique (résistance + cantrip niveau 1, sorts niveaux 3/5, caractéristique d'incantation à choisir) |

Aucun choix pour Drakéide, Nain, Halfelin, Orc — vérifié, rien à faire sur ces
quatre.

**Le vrai trou n'est pas seulement Compétent/Polyvalent** (déjà couverts) :
c'est le **lignage/legs à choix qui empaquette plusieurs effets** (un
cantrip immédiat, un sort supplémentaire à deux paliers de niveau, une
caractéristique d'incantation choisie une fois pour tout le lignage) — un
schéma qui revient trois fois (Elfe, Gnome, Tieffelin) sans qu'aucun
mécanisme ne l'accueille aujourd'hui. Traiter ce ticket au cas par cas
(un lignage elfique câblé en dur, puis un legs tieffelin câblé en dur...)
serait exactement l'inverse de ce qui est demandé : un mécanisme **générique**
de « trait d'espèce à choix », pour qu'une espèce maison future avec un trait
du même genre marche sans nouveau code — même esprit que `RemainingChoice`
pour les langues d'historique.

**Critères**
- [ ] Un trait d'espèce à choix simple (compétence, langue, outil) suit
  V3.1-4 — ce ticket n'y ajoute rien de plus.
- [ ] Un trait d'espèce à choix de don suit V3.1-3.
- [ ] Un trait d'espèce à choix de lignage/legs présente les options
  (Drow/Haut-elfe/Elfe des bois, etc.) dans l'assistant, applique le
  bénéfice de niveau 1 immédiatement, et prévoit la montée en puissance aux
  niveaux 3 et 5 (nouveau sort toujours préparé, comme un don à sort fixe).
- [ ] La caractéristique d'incantation du lignage/legs (Int/Sag/Cha, choisie
  une fois) est mémorisée et réutilisée pour tous les sorts qu'il accorde.
- [ ] Un trait d'espèce à choix de capacité rechargeable (Ascendance de
  géant) présente le choix, et la capacité se récupère au Repos long comme
  n'importe quelle ressource nommée (déjà un mécanisme existant, à réutiliser
  plutôt qu'à dupliquer).
- [ ] Une espèce maison créée sans ce genre de trait n'est pas affectée —
  aucune étape supplémentaire imposée quand il n'y a rien à choisir.

---

### ☐ V3.1-7 — Une sous-classe n'apporte jamais d'effet mécanique, choix ou pas · `L`

**Modèle conseillé : Opus** — sous-classes mécaniques : touche characterSheet() et les choix rechoisis.

**À concevoir ensemble : V3.1-3, V3.1-6 et V3.1-7.** Les trois demandent le
même mécanisme générique de choix (dons, traits d'espèce, sous-classes) :
le concevoir une fois, avec Opus, avant d'en coder un seul. V3.1-4 se branche
ensuite dessus, avec Sonnet.

Constaté le 28 septembre en vérifiant les 12 sous-classes officielles pour le
même genre de trou que V3.1-3/V3.1-6. Le trou est plus profond que prévu :
ce n'est pas seulement que les *choix* de sous-classe ne sont pas résolus,
c'est qu'**aucune sous-classe n'apporte jamais le moindre effet mécanique**,
choix ou pas.

Cause racine : `CreationSelection.classes` (`resolvedRuleset.ts:72`) est
`{key, level}[]` — **aucun champ pour la sous-classe choisie**. La fonction
qui assemble la fiche résolue (`assembleResolvedRuleset`, même fichier)
résout espèce, historique et classe génériquement, mais n'ajoute jamais la
clé de la sous-classe au lot résolu. Le schéma des blocs de sous-classe
(`zSubclassFeatureEntry`, `src/core/schemas/rule-blocks/blocks.ts:442`) ne
porte que `{name, level, description}` — aucune place pour un modificateur,
une résistance, un type de dégâts ou une liste de sorts. L'écran de la fiche
(`LevelClassesStep.tsx:327-330` → `SubclassFeatures`,
`blockContentRenderer.tsx:930-948`) ne fait que trier par niveau et afficher
le texte. **Ça vaut aussi pour « Serment de vengeance »** (créé le 27
septembre dans cette même session) : ses aptitudes sont dans le même cas,
ce n'est pas un recul propre au contenu maison.

Cinq cas relevés sur les sous-classes officielles, qui couvrent trois formes
différentes de ce qui manque :

| Sous-classe | Aptitude | Ce qui manque |
|---|---|---|
| Cercle de la Terre (Druide) | Sorts du Cercle de la Terre | choix de terrain **rechoisi à chaque Repos long**, change la liste de sorts toujours préparés |
| Sorcellerie draconique (Ensorceleur) | Affinité élémentaire (niv. 6) | choix d'un type de dégâts, **une fois** — résistance + bonus de dégâts |
| Protecteur Fiélon (Occultiste) | Résilience fiélonne (niv. 10) | choix d'un type de dégâts, **rechoisi à chaque repos** — résistance |
| Chasseur (Rôdeur) | Proie du chasseur / Tactiques défensives | choisir une aptitude passive parmi deux, **échangeable à chaque repos** |
| Collège du Savoir (Barde) / Évocateur (Magicien) | Découvertes magiques / Savant en évocation | choisir des sorts à ajouter — **même mécanisme que V3.1-3** (dons à sorts) |

**Aparté positif, à vérifier en direct plutôt qu'à corriger** : le choix de
*lignage* d'espèce (Haut-elfe, Gnome des roches...) existe bien
génériquement (`SpeciesStep.tsx:73-105`, filtre par `parentSpeciesKey`). Les
10 couleurs d'Ascendance draconique du Drakéide semblent suivre la même
forme en base, mais le script d'import standard ne les génère pas
(`scripts/ingest-srd.ts:1992-1995` ne parcourt pas le tableau imbriqué
`Species[].subspecies` du SRD) — impossible de confirmer sans lire la base
réelle si elles portent un vrai modificateur ou seulement un nom.

**Critères**
- [ ] La sous-classe choisie est résolue au même titre que l'espèce,
  l'historique et la classe — sa clé rejoint le lot dont les blocs
  `modifiers` sont appliqués.
- [ ] Un type de dégâts/caractéristique choisi une fois (Affinité
  élémentaire) est mémorisé et appliqué (résistance, bonus de dégâts).
- [ ] Un choix rechoisi à chaque repos (Cercle de la Terre, Résilience
  fiélonne, Chasseur) est présenté à nouveau après un Repos court/long,
  pas seulement à la création — recoupe V3.1-5 sur le déclenchement au
  Repos long.
- [ ] Un choix de sorts accordé par une sous-classe (Découvertes magiques,
  Savant en évocation) réutilise le mécanisme de V3.1-3, pas un nouveau.
- [ ] Une sous-classe purement descriptive (la majorité des niveaux, sur
  toutes les sous-classes) continue de s'afficher telle quelle, sans rien
  d'imposé en plus.

---

### ☑ V3.1-8 — Aucune demande structurée de disponibilités pour la prochaine séance · `L` — fait

**Modèle conseillé : Opus** — nouveau flux de demande de disponibilités, schéma et RLS.

Constaté le 27 septembre, captures de crab.fit à l'appui : le Calendrier réel
(V2.1-4, `docs/BACKLOG_V2.1.md:639`) ne connaît qu'un mode — la joueuse
renseigne librement ses disponibilités sur les 12 mois à venir, à tout
moment, sans qu'aucune question précise ne lui ait été posée ; le MJ découvre
ensuite ce qui a été rempli en consultant le classement des jours
(`SchedulingMjPanel.tsx`). Ce n'est pas ce qui se passe à table : le MJ sait
qu'il cherche une date sur une fenêtre donnée (« un des dix prochains
jours », « un mardi ou jeudi soir ») et veut pouvoir le demander
explicitement, comme crab.fit (nommer l'évènement, choisir les dates
candidates au clic-glissé sur un calendrier ou par jour de semaine, choisir
la plage horaire par curseurs) — avec la DA de CreaDonjon, jamais une reprise
visuelle de crab.fit.

Deux volets demandés, imbriqués :
1. **Côté MJ** — un bouton « Demander prochaines disponibilités » dans le
   Calendrier réel, qui ouvre un assistant en plusieurs étapes (nom, dates
   candidates, plage horaire).
2. **Côté joueuse** — une pastille de notification sur le bouton « Prochaine
   session » (voir aussi V3.1-9) dès qu'une demande est ouverte, qui invite à
   répondre sur les dates candidates précises de cette demande, pas sur un
   calendrier ouvert de 12 mois.

**Décision de modèle, actée avec l'auteur avant ce ticket** : le flux guidé
**remplace** le libre-service actuel — une joueuse ne renseigne plus ses
disponibilités sans qu'une demande soit ouverte par le MJ. Ça introduit une
vraie notion de **ronde de demande** : un objet avec ses propres dates
candidates (une liste de dates précises, ou un motif par jour de semaine sur
une fenêtre), sa propre plage horaire candidate, un statut ouvert/fermé, et
ses propres réponses — pas un deuxième calendrier libre, un sondage fermé sur
un choix limité, remis à zéro à chaque nouvelle demande. Ça se rapproche de
la piste C (Doodle) écartée en V2.1-4 au profit de la piste D (dispos
libres), mais seulement pour le tour de la demande — le classement par
chevauchement déjà écrit et testé (`src/core/scheduling/overlap.ts`) reste
réutilisé tel quel une fois les réponses en main, rien à refaire là-dessus.

**Modèle de données**

Nouvelle table `availability_requests` (une ronde par ligne) : `id`,
`campaign_id`, `title` (nullable, généré si vide), les dates candidates
(liste de dates précises, ou motif jour de semaine + fenêtre — à trancher à
l'implémentation selon ce que le schéma existant permet le plus simplement),
`starts_at`/`ends_at` (plage horaire candidate), `status` (`open`/`closed`),
`created_by`, `created_at`. RLS même motif que `real_sessions` (écriture MJ,
lecture ouverte à tout membre du monde).

`real_session_availabilities` gagne une colonne `request_id` (FK vers
`availability_requests`, nullable) — une réponse répond toujours à une ronde
précise. Les lignes déjà en base (saisies en libre-service avant ce ticket,
**en production**, cf. mémoire « migrations appliquées à la main ») restent
lisibles pour l'historique mais ne sont rattachées à aucune ronde — ne pas
les supprimer, ne pas les migrer de force vers une ronde fictive. Nouvelle
migration, jamais de modification d'une migration déjà appliquée (règle
absolue n°14) ; SCHEMA.md ne documente aujourd'hui ni `real_sessions` ni
`real_session_availabilities` (angle mort antérieur à ce ticket, à combler
en même temps qu'on y touche).

**Fait le 29 septembre.** Deux allers-retours en cours de ticket, après
retour utilisateur sur la première version livrée :
- **Formulaire en ligne, jamais dans une fenêtre pop-up** — la toute
  première version ouvrait un assistant en plusieurs étapes dans une boîte
  de dialogue (`RequestAvailabilityWizard.tsx`, supprimé). Refait en une
  seule page qui s'affiche directement dans le Calendrier réel
  (`RequestAvailabilityForm.tsx`), à l'image de la vraie page de crab.fit
  (retour utilisateur : « je voulais un quasi copié-collé de ce que propose
  crab.fit ») — nom, dates candidates, plage horaire empilés et visibles
  d'un coup, pas de Suivant/Précédent.
- **Plage horaire par curseur à deux poignées** (`TimeRangeSlider.tsx`), pas
  deux champs heure — même retour utilisateur, plus proche de crab.fit que
  le motif déjà utilisé pour le réglage manuel.
- `AvailabilityCalendar.tsx` n'a pas été réutilisé pour l'écran de réponse
  joueuse : ce composant naviguait un calendrier libre sur 12 mois, un
  besoin qui n'existe plus une fois la joueuse restreinte à une poignée de
  dates candidates fixes — un nouveau composant plus simple
  (`AvailabilityRequestResponse.tsx`, une ligne par date candidate) l'a
  remplacé, et `AvailabilityCalendar.tsx` a été supprimé (plus aucun appelant
  après ce ticket).

Le clic-glissé pour sélectionner des dates (retour utilisateur en cours de
ticket : « ajoute aussi l'option du cliquer-glisser ») est implémenté et
vérifié directement au niveau des évènements DOM (`mousedown` +
`mouseover`/`relatedTarget`, la façon dont React synthétise réellement
`onMouseEnter` en interne) — le simple clic reste possible en plus.

**Étapes**
1. Fait — Migration `20260929120000_availability_requests.sql` :
   `availability_requests` (dates candidates en `date[]`, résolues côté
   formulaire que l'origine soit un clic ou un motif « jours de semaine »),
   colonne `request_id` sur `real_session_availabilities`, RLS, index partiel
   `availability_requests_one_open_per_campaign`. `docs/SCHEMA.md` complété
   au passage (angle mort antérieur à ce ticket).
2. Fait — Formulaire MJ en ligne (`RequestAvailabilityForm.tsx`), affiché à
   la place du classement tant qu'aucune ronde n'est ouverte : nom, dates
   candidates (onglets « Dates précises » au clic/clic-glissé,
   `expandWeekdayPattern` en pur pour « Jours de la semaine »), plage
   horaire (`TimeRangeSlider.tsx`), bouton Créer — tout sur une page.
3. Fait — Écran de réponse joueuse sur une grille à peindre
   (`AvailabilityPaintGrid.tsx`, refondu — voir plus bas), une colonne par
   date candidate de la ronde ouverte.
4. Fait — `SchedulingMjPanel.tsx` : le classement par chevauchement porte
   sur `request.candidate_dates` (`getRankedDaysForRequest`), plus de
   navigation libre par mois. Une date candidate sans aucune réponse
   apparaît quand même, classée en dernier.
5. Fait — Pastille sur `NextSessionBadge.tsx`, disparaît dès la réponse
   enregistrée (`onResponded`, sans attendre la confirmation MJ).
6. Fait — `createRealSession`/`cancelAvailabilityRequest` ferment la ronde
   ouverte de la campagne.

**Deuxième vague, après retour utilisateur sur la première version livrée**
(mêmes critères, complétés en dessous) :
- **Grille à peindre plutôt que deux champs heure par date**
  (`AvailabilityPaintGrid.tsx`, retour utilisateur : "sélectionner les
  plages horaires par jours" comme sur crab.fit) — clic ou clic-glissé sur
  des cases d'une demi-heure, colonnes = dates candidates, lignes = la
  plage horaire suggérée par le MJ. Peindre reste une **façon de saisir**
  la même plage continue par jour (`rangeFromSlots`,
  `src/core/scheduling/availabilityGrid.ts`, pur/testé) — comble les trous
  plutôt que d'les refuser, aucun changement du modèle de données V2.1-4
  ("jamais deux disponibilités disjointes le même soir").
- **Carte de chaleur côté MJ** (`AvailabilityHeatmap.tsx`, retour
  utilisateur : "des zones de plus en plus foncées... avec une infobulle au
  survol") — complète le classement/bouton Confirmer déjà existant, ne le
  remplace pas : une case par (date, créneau de 30 min), teintée selon le
  nombre de joueuses dont la réponse couvre ce créneau précis, infobulle au
  survol listant qui.
- **Le MJ peut aussi renseigner ses propres disponibilités** (retour
  utilisateur : "le MJ doit aussi pouvoir mettre ses dispos") — section
  « Mes disponibilités » dans `SchedulingMjPanel.tsx`, même
  `AvailabilityPaintGrid.tsx` que côté joueuse, même endpoint
  (`GET`/`POST .../scheduling/availability`, qui a toujours résolu
  « mes propres réponses » depuis l'appelant authentifié — aucun
  changement d'API nécessaire). `totalMembers` compte désormais **tout le
  monde** (MJ inclus), pas seulement les joueuses — renverse le choix
  d'origine V2.1-4 qui excluait le MJ parce qu'il ne répondait jamais ;
  `resolveNamesIncludingGm` (copie locale, jamais `resolvePlayerNames`
  lui-même, réutilisé ailleurs) donne au MJ le nom « MJ » dans les rosters/
  infobulles, faute de PJ associé.
- **Écran joueuse en ligne, jamais en fenêtre pop-up** (retour utilisateur :
  "à l'image de ce que le joueur peut voir pour les autres onglets") —
  nouvelle page `/joueur/prochaine-session` (`app/m/[worldSlug]/joueur/
  prochaine-session/page.tsx`), au même titre que Notes ou Wiki.
  `NextSessionBadge.tsx` n'ouvre plus de `createPortal`/dialogue : c'est
  désormais un lien de navigation, plus léger.
- **Bouton "Prochaine session" invisible sur mobile, corrigé** (retour
  utilisateur : "le bouton de prochaine session disparaît" sur téléphone) —
  il n'existait que pour desktop (`hidden md:block`). Deux présentations
  du même lien dans `NextSessionBadge.tsx` : la bannière verticale habituelle
  à partir de `md:`, une icône + libellé court ("Session") en dessous,
  intégrée à la barre d'onglets du bas comme les six autres destinations.

**Critères**
- [x] Le MJ ouvre une demande avec un nom (ou vide → généré), des dates
  candidates (précises ou par jour de semaine sur une fenêtre), une plage
  horaire.
- [x] Toute joueuse de la campagne voit une pastille sur « Prochaine
  session » tant qu'elle n'a pas répondu à la demande ouverte — visible sur
  mobile comme sur desktop.
- [x] La pastille disparaît dès que la joueuse a répondu, sans attendre que
  le MJ confirme une séance.
- [x] La joueuse (et le MJ) ne répond que sur les dates candidates précises
  de la demande en cours, sur une grille à peindre — plus de calendrier
  ouvert sur 12 mois sans demande, plus de champs heure séparés.
- [x] Le classement des jours et la carte de chaleur côté MJ ne portent que
  sur la demande ouverte en cours, MJ inclus dans l'effectif.
- [x] Confirmer une séance, ou annuler la demande, la ferme : plus de
  pastille, plus d'invite à répondre, pour tout le monde.
- [x] Une seule demande ouverte à la fois par campagne (garanti par l'index
  partiel en base).
- [x] L'écran joueuse ("Prochaine session" et ses trois onglets) est une
  page normale de la coquille, jamais une fenêtre pop-up.

Vérifié en direct sur ClaudeLand (compte de test à la fois MJ et joueuse) :
création d'une ronde par clic (dates précises) et par motif « jours de
semaine sur une fenêtre » (`expandWeekdayPattern` vérifié bout en bout),
glissement des deux poignées du curseur horaire, peinture de cases sur la
grille (glissé réel, pas seulement clic isolé), réponse joueuse **et** MJ,
classement et carte de chaleur mis à jour (« 1/3, session raccourcie » une
fois le MJ compté), confirmation créant la séance et fermant la ronde,
annulation d'une ronde sans séance, page `/joueur/prochaine-session`
atteignable sans pop-up, bouton visible en largeur mobile. `npm run
typecheck && npm run lint && npm run test:core` passent.

---

### ☑ V3.1-9 — Bouton « Prochaine session » mal calibré selon l'écran · `S`/`M` — fait

**Modèle conseillé : Sonnet** — ajustement d'affichage.

Constaté le 27 septembre, capture à l'appui : la bannière verticale
(`NextSessionBadge.tsx`), texte tourné à 90°, taille en
`clamp(7px,1.15vh,10px)`, devient illisible/écrasée sur certaines hauteurs
d'écran — le vrai problème étant que tout le texte (« Prochaine session —
dimanche 27 septembre 2026 ») était concaténé en un seul bloc continu. Le
bouton doit aussi donner accès aux dates passées, aux dates à venir, et — si
une demande est ouverte par le MJ (V3.1-8) — au remplissage des
disponibilités : jusque-là il n'ouvrait que la saisie
(`AvailabilityCalendar.tsx`) une fois une séance déjà confirmée, sans aucun
accès à `getPastSessions`/`getUpcomingSessions` (déjà écrits côté service,
`src/server/services/scheduling.ts`, jamais consultés côté joueuse).

Lié à V3.1-8 mais indépendant : ce ticket vaut même si V3.1-8 n'est pas
encore pris (l'onglet « Mes disponibilités » reste alors toujours visible,
faute de demande à conditionner dessus — voir plus bas).

**Fait le 29 septembre.** Première version basculée à l'horizontal (deux
lignes de texte normal) — corrigée après retour utilisateur : l'orientation
verticale devait être **gardée**, seul le texte tout attaché posait
problème. Version finale : le bouton reste vertical
(`writing-mode: vertical-rl`, `rotate(180deg)`), mais scindé en deux blocs
(« Prochaine session » / la date) plutôt qu'une seule chaîne concaténée —
deux blocs sous `vertical-rl` deviennent deux colonnes côte à côte,
chacune bien plus courte que l'ancien texte tout collé, sans changer
l'esthétique voulue.

**Étapes**
- Fait — Bouton normal (contour fin couleur `accent`, sans fond plein, même
  famille que l'ancien bouton « Renseigner mes disponibilités »), texte
  vertical scindé en deux blocs plutôt qu'un seul.
- Fait, puis refondu (V3.1-8, retour utilisateur : "à l'image de ce que le
  joueur peut voir pour les autres onglets") — le clic ouvrait d'abord un
  panneau à onglets en fenêtre pop-up ; il mène désormais à une vraie page
  (`/joueur/prochaine-session`, `NextSessionPanel.tsx`), plus de
  `createPortal`. Trois onglets inchangés (À venir / Passées / Mes
  disponibilités), réutilisant `getUpcomingSessions`/`getPastSessions`.
- Fait, puis complété (retour utilisateur : "le bouton de prochaine session
  disparaît" sur téléphone) — n'existait que pour desktop (`hidden
  md:block`). `NextSessionBadge.tsx` porte désormais deux présentations du
  même lien : la bannière verticale à partir de `md:`, une icône + libellé
  court intégrée à la barre d'onglets du bas en dessous, comme les six
  autres destinations de `PlayerShell.tsx`.
- Fait — Vérifié sur des hauteurs de fenêtre resserrées (jusqu'à 480px) :
  aucun débordement, aucun chevauchement avec les autres destinations de la
  coquille joueuse (`PlayerShell.tsx`).

**Critères**
- [x] Le texte est lisible sur toutes les hauteurs de fenêtre déjà couvertes
  par `PlayerShell.tsx` (desktop) — et visible tout court sur mobile, où il
  n'apparaissait pas du tout.
- [x] Le bouton mène à un écran à onglets (passé/à venir/mes dispos), une
  page normale de la coquille plutôt qu'une fenêtre pop-up ou le seul
  calendrier de saisie.
- [x] L'onglet « Mes disponibilités » affiche la réponse à la ronde ouverte
  (V3.1-8, fait depuis) si une demande est en cours, sinon un message
  explicite plutôt qu'un onglet vide.

---

### ☑ V3.1-10 — Connexion par identifiant/mot de passe plutôt que lien à retrouver · `L` — fait

**Modèle conseillé : Opus** — authentification.

Constaté le 27 septembre : les joueuses redemandent systématiquement le lien
d'invitation à l'auteur. Ce n'est pas un oubli isolé, c'est la conséquence
directe d'un choix déjà acté — [docs/adr/0015-provisioning-comptes-invites.md](../adr/0015-provisioning-comptes-invites.md)
: un compte invité (`provisionInviteSession`,
`src/server/services/accountProvisioning.ts:11`) n'a **jamais** d'email réel
ni de mot de passe, seulement une adresse synthétique invisible et une
reconnexion par lien magique. Rien qu'une joueuse puisse retenir ou
retrouver seule.

**Vision retenue, sur plusieurs échanges les 27 et 28 septembre — remplace
toutes les versions précédentes de ce ticket.**

**Comptes et mondes sont découplés.** Un compte peut exister sans être
membre d'aucun monde — au moment de sa création, ou après une révocation.

**Deux familles de comptes, un seul écran de connexion (`/login`,
`app/login/actions.ts`) :**
- **Comptes ordinaires** (email réel + mot de passe) — inchangés, l'auteur
  y compris. `/signup`/`/login` existants ne bougent pas.
- **Comptes « tag »** — un nom affiché (pas unique : deux comptes peuvent
  s'appeler « Julie ») accompagné d'un identifiant à **4 chiffres** généré
  automatiquement (`#0000`–`#9999`, régénéré en cas de collision sur la
  paire nom+chiffres), **invisible partout sauf dans les réglages du compte
  concerné** — jamais dans une liste de membres, jamais dans l'attribution
  publique d'une création. Chaque compte en a un, y compris celui de
  l'auteur (`Gabriel#0000`) : le tag sert à l'attribution interne, pas
  seulement aux comptes invités.
  *Amendé le 1ᵉʳ octobre par V3.1-15 et l'ADR 0032 : le tag devient
  visible du MJ de la campagne, dans la Gestion de campagne, pour distinguer
  deux comptes de même nom. Invisible partout ailleurs, comme avant.*
- **À la connexion, on tape juste un nom et un mot de passe** — jamais le
  tag. La résolution essaie, dans l'ordre, chaque compte « tag » portant ce
  nom contre ce mot de passe (collisions rares à l'échelle d'une table de
  jeu), puis retombe sur un email classique si rien ne correspond.
- **N'importe qui peut créer un compte « tag » sans invitation**, depuis
  `/login` (bascule « créer un compte ») — atteignable aussi par un bouton
  que le MJ pose lui-même sur son wiki public, qui mène au même écran. Un
  tel compte ne donne accès à rien tant que personne ne l'invite dans un
  monde.

**Un lien d'invitation rattache un compte (nouveau ou déjà existant) à un
monde et un rôle — il ne crée plus de mot de passe, la personne le choisit
elle-même en cliquant le lien pour la première fois :**
- **Lien joueur : réutilisable par plusieurs personnes** — un lien = un
  monde, pas une personne. Renverse la décision nominative de V2-M4 (« un
  lien par personne »), volontairement : la nominativité perd son intérêt
  une fois que c'est la personne elle-même, pas le MJ, qui choisit son
  identité et son mot de passe.
- **Lien MJ : reste nominatif, à usage unique**, comme aujourd'hui — rôle
  plus sensible (droits d'édition sur tout le monde), pas de raison de le
  rendre partageable.
- Le mot de passe optionnel déjà existant sur un lien (`password_hash` sur
  `campaign_invites`, `verifyInvitePassword`) reste disponible comme verrou
  de groupe supplémentaire — d'autant plus utile qu'un lien joueur peut
  désormais circuler plus largement qu'à une seule personne.

**Personnage choisi après coup, pas à la création du compte.** Première
visite d'un monde en tant que joueuse sans PJ assigné : écran listant les
PJ ouverts (non réclamés) du monde, plus une option « Nouveau PJ » vers
l'assistant de création existant. Le MJ garde la main pour réassigner qui
joue quel PJ ensuite.

**Révoquer une joueuse = l'expulser du monde**, rien de plus : retire son
adhésion (`campaign_members`), libère le PJ qu'elle jouait
(`campaign_characters.user_id = null`) — même geste que `revokeInvite`
aujourd'hui. Le compte survit, inchangé ailleurs (autres mondes, ou aucun).
Ne touche plus au lien lui-même, qui reste ouvert pour d'autres puisqu'il
est désormais réutilisable.

**Mot de passe oublié — pas de miracle sans email, donc ça reste médié :**
un bouton « Mot de passe oublié » sur l'écran de connexion dépose une
demande plutôt que d'exiger un aller-retour hors de l'app (Discord, SMS...).
Elle apparaît dans le panneau de tout MJ dont ce compte est membre d'un
monde. **Si le compte n'est membre d'aucun monde** (créé en libre-service,
jamais invité, ou révoqué de partout), aucun MJ ordinaire n'a d'autorité
dessus — c'est le superadmin qui la voit et agit (point suivant).

**Le superadmin (compte de l'auteur, `profiles.account_role = 'superadmin'`,
déjà posé par la migration `20260830090001_superadmin_role.sql`) étend ses
pouvoirs déjà existants** (`app/api/admin/*`, `deleteInvitedAccount`, « voir
comme ») avec trois gestes nouveaux, pour couvrir précisément les comptes
qu'aucun MJ particulier ne gère :
- réinitialiser le mot de passe de n'importe quel compte de la plateforme ;
- supprimer n'importe quel compte — généralise `deleteInvitedAccount`
  (`accountProvisioning.ts:192`), dont le garde-fou actuel (« refuse si
  jamais réclamé par un lien d'invitation ») ne tient plus une fois les
  comptes « tag » libre-service possibles, à revoir dans le même geste ;
- transférer un ruleset personnel d'un compte à un autre
  (`rulesets.created_by`) — jamais sur `is_official_base = true`, règle
  absolue n°18, inchangée.

**Corrections par rapport aux versions précédentes de ce ticket :**
- Un mot de passe de **compte** passe par le mécanisme natif de Supabase
  Auth (`admin.auth.admin.createUser({ email, password })`,
  `signInWithPassword`) — jamais par `hashSharePassword`/scrypt
  (`src/core/shareLinks/password.ts`), qui reste réservé aux mots de passe
  de **lien** (partage, invitation), lesquels ne correspondent à aucune
  identité `auth.users`. Une version antérieure de ce ticket proposait à
  tort de réutiliser scrypt pour les mots de passe de compte.
- Le lien magique (`mintSessionForInvitedAccount`/`mintSessionForOwnAccount`,
  `accountProvisioning.ts`) reste exactement ce qu'il est aujourd'hui,
  réservé à « voir comme » côté superadmin — il ne joue plus aucun rôle dans
  la connexion ordinaire, contrairement à ce qu'une version antérieure de ce
  ticket envisageait.
- « Forcer une réinitialisation » (MJ ou superadmin, sur un compte
  existant) ne suppose ni mot de passe temporaire tapé à la main, ni lien
  magique : ça génère un jeton à usage unique — même primitive que les
  liens d'invitation, pas une nouvelle mécanique — qui mène à l'écran de
  choix d'un nouveau mot de passe (jamais de connexion automatique).

**Modèle de données**

- `profiles` gagne `handle_name` (texte) + `handle_tag` (4 chiffres),
  uniques ensemble (pas `handle_name` seul), et `must_change_password`
  (booléen). Aucune colonne de mot de passe applicatif — le mot de passe
  vit dans `auth.users`, géré par Supabase Auth.
- `campaign_invites` : les liens de rôle `player` perdent leur sémantique
  « réclamé une seule fois » — plus de `claimed_by_user_id` singulier pour
  ce rôle, la liste de qui a rejoint via un monde redevient simplement
  `campaign_members` (source de vérité déjà existante, pas de nouvelle
  table de suivi). Les liens de rôle `gm` gardent le comportement actuel à
  l'identique.
- Demande de réinitialisation en attente : petite table ou flag +
  horodatage sur `profiles`, lisible par tout MJ d'un monde dont ce compte
  est membre, et par le superadmin dans tous les cas.

**Étapes**

1. Nouvel ADR actant : mots de passe natifs Supabase (jamais de lien
   magique comme canal de connexion courant), liens joueurs réutilisables
   (renverse V2-M4), comptes utilisables sans monde, réinitialisation
   médiée par jeton à usage unique. L'ADR 0015 et le commentaire « un lien
   par personne » de V2-M4 ne sont jamais réécrits — ce nouvel ADR
   documente la suite, pas une correction de l'ancien.
2. Migration : `handle_name`/`handle_tag`/`must_change_password` sur
   `profiles` (avec attribution d'un tag à chaque compte existant,
   `Gabriel#0000` pour l'auteur), assouplissement de `campaign_invites`
   pour les liens joueur, table/flag de demande de réinitialisation.
3. Écran de connexion unique (`/login`) : « se connecter » (nom + mot de
   passe, ou email pour un compte ordinaire) et bascule « créer un compte »
   (nom, tag généré à la volée, mot de passe) — utilisable avec ou sans
   lien d'invitation en contexte.
4. Un lien d'invitation ouvert dans cet écran attache automatiquement le
   compte (nouveau ou existant) au monde/rôle visé, juste après connexion
   ou création de compte.
5. Première visite d'un monde en tant que joueuse sans PJ assigné : écran
   « Choisis ton personnage » (PJ ouverts + « Nouveau PJ » vers l'assistant
   existant).
6. Panneau MJ (gestion des invitations existante,
   `src/server/services/campaignInvites.ts`) : génération d'un lien joueur
   réutilisable vs un lien MJ nominatif ; « Révoquer » simplifié (retire
   l'adhésion + libère le PJ, ne touche plus au lien) ; bouton « Forcer une
   réinitialisation » par compte ; liste des demandes de réinitialisation
   en attente pour les mondes de ce MJ.
7. Écran de connexion : bouton « Mot de passe oublié » qui dépose une
   demande plutôt que d'exiger un canal externe.
8. Panneau Administration (superadmin) : tous les comptes de la plateforme,
   réinitialisation, suppression généralisée, transfert de ruleset
   personnel, et les demandes de réinitialisation orphelines (compte sans
   aucun monde).

**Critères**

- [x] N'importe qui peut créer un compte (nom + mot de passe, tag généré
  automatiquement) sans invitation, depuis `/login` ou le bouton du wiki
  public — ce compte n'a accès à aucun monde tant que personne ne l'y
  invite.
- [x] Un lien joueur peut être utilisé par plusieurs personnes différentes,
  chacune rejoignant le même monde avec son propre compte.
- [x] Un lien MJ reste utilisable par une seule personne, comme aujourd'hui.
- [x] À la première visite d'un monde comme joueuse, si aucun PJ n'est déjà
  assigné, la joueuse choisit parmi les PJ ouverts ou en crée un nouveau —
  jamais imposé au moment de la création du compte.
- [x] Révoquer une joueuse retire son accès au monde et libère son PJ ; son
  compte reste utilisable ailleurs (autres mondes, ou aucun) ; le lien
  d'invitation, lui, continue de fonctionner pour d'autres.
- [x] Une demande de réinitialisation envoyée sans mot de passe connu arrive
  dans le panneau d'un MJ compétent, ou du superadmin si le compte n'a
  aucun monde.
- [x] Le superadmin peut réinitialiser le mot de passe, supprimer, ou
  transférer un ruleset personnel de n'importe quel compte de la
  plateforme.
- [x] Le tag (`#NNNN`) n'est jamais visible ailleurs que dans les réglages
  du compte concerné.
- [x] Un nouvel ADR documente ce modèle, sans modifier l'ADR 0015 ni le
  commentaire de V2-M4.

Fait le 29 septembre (ADR 0031). Réalisé en six étapes, chacune vérifiée en
navigateur avec des comptes/mondes de test créés puis supprimés :

1. **Migration** (`20260929130000_native_password_accounts.sql`) :
   `profiles.handle_name`/`handle_tag`/`must_change_password`/
   `password_reset_requested_at`, génération de tag avec retry sur
   collision, `app.resolve_login_emails`/`app.request_password_reset_by_name`
   (anon-safe), `app.revoke_campaign_member`, `account_reset_tokens` (RLS
   sans aucune politique).
2. **Écran de connexion unique** (`/login`) : nom-ou-email essaie d'abord
   les comptes "tag", puis retombe sur un email ordinaire ; bascule "Créer
   un compte" (tag, libre-service) ; "mot de passe oublié" par nom.
3. **Liens joueurs réutilisables** : `provisionInviteSession` ne crée plus
   de compte lui-même (déplacé vers `accountAuth.createTagAccount`,
   appelé par `app/rejoindre/[token]/actions.ts` avant la connexion
   directe par mot de passe) ; `campaign_members` fait foi pour un lien
   joueur, `claimed_by_user_id` reste la source pour un lien MJ (nominatif,
   usage unique, inchangé).
4. **Panneau MJ** (`InviteLinkPanel`/`CampaignDetail`) : section "Liens
   joueurs" distincte (jamais "jamais ouvert"), révocation individuelle
   d'un membre (`app.revoke_campaign_member`, sans toucher au lien),
   "Forcer une réinitialisation" par membre avec lien affiché inline,
   indicateur "mot de passe oublié".
5. **Écran "Choisis ton personnage"** (`/joueur`, sans PJ assigné) : PJ
   ouverts de la campagne ou "Nouveau PJ" (même assistant que côté MJ,
   `CharacterCreatorWizard` gagne un prop `onCreate` optionnel pour
   réclamer la fiche immédiatement plutôt que la laisser flottante).
6. **Panneau superadmin** (`AdminPanel`) : section "Comptes — toute la
   plateforme" (jamais le tag), réinitialisation/suppression généralisées à
   tout compte, transfert de ruleset personnel — `deleteInvitedAccount`
   (ancien, borné aux comptes invités) supprimé, devenu mort code une fois
   `adminDeleteAccount` généralisé en place.

**Écarts assumés par rapport au ticket** :
- La demande "mot de passe oublié" par nom (ambigu, plusieurs comptes
  peuvent partager un `handle_name`) pose le drapeau sur TOUS les comptes
  de ce nom plutôt que d'exiger une désambiguïsation — négligeable à
  l'échelle d'une table de jeu personnelle, le MJ/superadmin reconnaît sa
  propre joueuse dans son panneau.
- Le panneau superadmin affiche `password_reset_requested_at` pour TOUS les
  comptes, pas seulement ceux sans monde (le critère garantit un minimum —
  "MJ compétent, ou superadmin si sans monde" — pas un maximum ; le
  superadmin voit de toute façon tout le reste).
- Réglages du compte affichant son propre `handle_tag` : non construit,
  hors des huit étapes listées par le ticket — actuellement aucun endroit
  ne montre jamais le tag à personne, y compris à son propriétaire.
- Bouton "créer un compte" posable par le MJ sur son wiki public : non
  construit (mentionné dans la vision, absent des critères d'acceptation
  et des étapes).
- Réouverture d'un lien MJ déjà réclamé sur un compte créé AVANT V3.1-10
  (sans mot de passe) : ne fonctionne plus pour un lien de rôle `player`
  (le garde-fou par rôle empêche la reconnexion par lien magique) — un tel
  compte a besoin d'une réinitialisation forcée (MJ/superadmin) pour
  obtenir son premier mot de passe. Cas rare (comptes antérieurs à ce
  ticket uniquement), non couvert par une migration de données faute de
  pouvoir deviner un mot de passe à leur place.

---

### ☑ V3.1-11 — Onglet « Solo » visible même avec un MJ humain déjà présent · `S` — fait

**Modèle conseillé : Sonnet** — une condition d'affichage.

Constaté le 28 septembre, en discutant de V3.1-10 : la coquille joueuse
(`PlayerShell.tsx:64`) liste « Solo » comme destination fixe, sans condition
— le mode solo (V3, IA locale) n'a de sens que pour une joueuse sans MJ
humain sur ce monde. Aujourd'hui il reste visible même dans un monde qui a
un vrai MJ, alors que `campaign_members` porte déjà un rôle `gm` par
campagne (`src/server/repos/campaigns.ts:138`) — une simple présence de ce
rôle suffit à savoir si ce monde a un MJ humain.

**Critères**
- [x] L'onglet « Solo » n'apparaît dans la coquille joueuse que si la
  campagne du monde consulté ne compte aucun membre de rôle `gm`.
- [x] Un monde sans MJ humain (solo par nature) continue d'afficher l'onglet
  normalement — aucune régression sur l'usage principal de ce mode.

Fait le 29 septembre. `hasHumanGm(supabase, campaignId)` (nouveau, dans
`src/server/services/campaigns.ts`) réutilise `listCampaignMembers` et
cherche un membre `role === "gm"` — même motif que `resolveNamesIncludingGm`
dans `scheduling.ts`. `app/m/[worldSlug]/joueur/layout.tsx` résout la
campagne du monde (`resolveCampaignId`, `null` traité comme « pas de MJ »)
et passe le résultat à `PlayerShell` en prop `hasHumanGm`, qui filtre
l'entrée « Solo » de son tableau `destinations` quand elle vaut `true`.

Vérifié en navigateur sur ClaudeLand/Faerûn (copie), qui a un MJ humain :
l'onglet Solo est bien absent de la coquille joueuse. Le cas inverse (monde
sans MJ humain) n'a pas pu être rejoué en direct — la création de monde
n'offre aujourd'hui que le mode « Campagne (MJ humain) », aucun moyen
d'obtenir un monde solo depuis cet écran — mais découle directement du code :
`createCampaign`/`insertCampaignMember` (`campaigns.ts:120`) n'insère un
membre `role: "gm"` que pour `mode: "campaign"`, jamais pour `mode: "solo"`
ni quand `resolveCampaignId` renvoie `null` (monde sans campagne).

---

### ☐ V3.1-12 — « Voir comme » accessible aux MJ de campagne, pas seulement au superadmin · `M`

**Modèle conseillé : Opus** — « voir comme » : usurpation d'identité, portée de sécurité.

Constaté le 28 septembre, en discutant de V3.1-10 : « voir comme »
(`startViewAs`, `src/server/services/viewAs.ts:24`) est aujourd'hui réservé
au superadmin (`isSuperadmin`), utilisable uniquement depuis la section
Administration (`AdminPanel.tsx`). Demandé : un MJ de campagne doit pouvoir
l'utiliser sur ses propres joueuses, depuis les options MJ du monde —
concrètement la liste « Membres » déjà affichée dans `CampaignDetail.tsx:163`
(Gestion de campagne, déjà gardée par `canManage`), à côté du bouton
« Révoquer » qui y est déjà.

**Décision**
- **Autorisation** : en plus du superadmin (portée globale, inchangée), un
  appelant peut démarrer « voir comme » sur `targetUserId` s'il est MJ de la
  campagne dont la cible est membre — vérifié côté serveur avec le
  `campaignId` transmis (jamais « est-il GM de N'IMPORTE quelle campagne
  contenant cette cible », toujours scopé à la campagne depuis laquelle le
  bouton est cliqué). Même garde que `canManage`/`isWorldAdmin` déjà utilisé
  ailleurs dans cet écran.
- **Garde-fou sur la cible, à redéfinir** : `mintSessionForInvitedAccount`
  (`accountProvisioning.ts:227`) refuse aujourd'hui tout compte qui n'a
  jamais réclamé une ligne `campaign_invites` — invariant qui ne tient plus
  une fois les liens joueur réutilisables et les comptes créés en
  libre-service (V3.1-10). Le vrai invariant à garder : ne jamais permettre
  « voir comme » sur un compte **ordinaire** (email réel, `/signup`/`/login`)
  — seulement sur un compte « tag » (identité interne à l'app, jamais un
  email personnel externe). Peut se coder dès aujourd'hui sur le signal déjà
  disponible (email synthétique), et se réaligne naturellement une fois
  V3.1-10 posé.
- **Retour (`returnFromViewAs`)** : le contrôle actuel
  (`isSuperadminByIdViaServiceRole`) rejetterait à tort un MJ ordinaire qui
  revient de son propre « voir comme ». La vraie garantie de sécurité est
  déjà le cookie httpOnly posé par le serveur au démarrage (jamais
  falsifiable côté client, jamais lu ni écrit ailleurs) — le contrôle au
  retour se limite à vérifier que le compte d'origine existe toujours, plus
  de condition superadmin.

Indépendant de V3.1-10 : peut se faire avant, pendant ou après.

**Étapes**
1. `startViewAs` : accepte un `campaignId` optionnel ; si fourni et que
   l'appelant est MJ de cette campagne et la cible en est membre, autorise —
   sinon retombe sur la vérification superadmin actuelle.
2. Redéfinir le garde-fou de `mintSessionForInvitedAccount` : refuse un
   compte ordinaire (email réel), plus « jamais réclamé par un lien ».
3. `returnFromViewAs` : retire la condition superadmin, garde uniquement
   l'existence du compte d'origine.
4. Bouton « Voir comme » sur chaque ligne de `data.members` dans
   `CampaignDetail.tsx`, visible seulement si `canManage`.

**Critères**
- [ ] Un MJ (non superadmin) peut lancer « voir comme » sur une joueuse de
  sa propre campagne, depuis la liste des membres de « Gestion de
  campagne ».
- [ ] Un MJ ne peut pas lancer « voir comme » sur un compte qui n'est pas
  membre d'une campagne qu'il gère.
- [ ] « Voir comme » reste impossible sur un compte ordinaire (email réel),
  qu'on soit MJ ou superadmin.
- [ ] Le superadmin garde sa portée actuelle (n'importe quel compte « tag »,
  n'importe où).
- [ ] Revenir de « voir comme » fonctionne identiquement, que ce soit un MJ
  ou le superadmin qui l'ait démarré.

---

### ☐ V3.1-13 — Sous-classes manquantes pour les classes des 4 joueuses actives · `M`

**Modèle conseillé : Sonnet** — saisie de règles d'après les livres de l'auteur.

Différent des autres tickets de ce backlog : pas un trou dans l'outil, un
manque de **contenu** — relevé le 28 septembre en comparant les sous-classes
présentes sur Valdoria à la liste complète du Manuel des joueurs 2024, pour
les classes des 4 joueuses de la table (Roublard, Barde, Druide, Guerrier,
Paladin). Le SRD gratuit n'apporte qu'une seule sous-classe par classe (deux
pour le Roublard) ; le reste vient du livre payant et doit être saisi à la
main, comme « Serment de vengeance ».

| Classe | Déjà présentes | Manquantes |
|---|---|---|
| Roublard | Voleur, Arnaqueur arcanique | Assassin, Sabre-psychique (Soulknife) |
| Barde | Collège du Savoir | Collège de la Danse, Collège du Glamour, Collège de la Vaillance |
| Druide | Cercle de la Terre | Cercle de la Lune, Cercle de la Mer, Cercle des Étoiles |
| Guerrier | Champion | Maître de guerre (Battle Master), Chevalier occulte (Eldritch Knight), Guerrier psi (Psi Warrior) |
| Paladin | Serment de Dévotion, Serment de vengeance | Serment des Anciens, Serment de Gloire |

Soit 11 sous-classes à saisir. Chacune suit le même chemin que Serment de
vengeance : le texte vient du manuel de l'auteur (jamais deviné, jamais
recopié depuis la mémoire d'un modèle), passé par le formulaire « Créer une
sous-classe » de la variante active.

**À savoir avant de saisir, pas un frein** : tant que V3.1-7 n'est pas pris,
ces aptitudes resteront purement descriptives, comme toutes les sous-classes
du jeu aujourd'hui — cohérent, pas un recul propre à ce contenu.

**Critères**
- [ ] Les 11 sous-classes listées existent sur Valdoria, chacune rattachée à
  sa classe parente et sélectionnable à l'assistant de création de
  personnage au bon niveau.
- [ ] Chaque fiche recopie fidèlement le texte du manuel de l'auteur (aucune
  aptitude devinée) — l'auteur fournit le texte, capture ou photo à l'appui,
  comme pour Serment de vengeance.
- [ ] Une sous-classe saisie ici n'est pas bloquée par l'avertissement de
  bloc manquant (V3.1-1, si toujours ouvert) ni par un défaut d'édition
  (V3.1-2, si toujours ouvert) — dépendances à vérifier au moment de
  saisir, pas à résoudre avant.

---

### ☐ V3.1-14 — Aucun moyen pour une joueuse de créer elle-même son PJ sans personnage déjà assigné · `M`

**Modèle conseillé : Opus** — une joueuse crée sa fiche : propriété, RLS, canEditEntity.

Constaté le 29 septembre, en vérifiant V3.1-9 : le lien de test donné par
l'auteur menait à l'écran « Bienvenue » (`app/rejoindre/[token]/JoinForm.tsx`)
avec « Aucun personnage disponible pour l'instant » — le rôle joueur exige
aujourd'hui qu'un PJ non réclamé existe déjà (sinon `missing_entity`,
`accountProvisioning.ts:69`), et la seule façon d'en créer un est que le MJ
le fasse à la main au préalable (nouvelle fiche, puis dropdown « PNJ (sans
joueur) » dans Gestion de campagne pour la laisser ouverte).

Même trou côté onglet Personnage (`ParticipantCharacterSheet.tsx:37`) : le
bouton « Créer mon personnage » n'amorce l'assistant (`CharacterCreatorWizard`)
qu'en `entityMode` — sur une entité **déjà assignée** (`entityId`/
`entityVersion` transmis par la page appelante) — jamais pour une joueuse qui
n'a encore aucun PJ du tout.

Pourtant `CharacterCreatorWizard` sait déjà créer une entité de zéro (mode
hors `entityMode`, ligne 116 : « Requis seulement hors `entityMode` (création
d'une nouvelle entité) », utilisé aujourd'hui seulement côté MJ via
`EditEntityForm.tsx`) — la brique existe, elle n'est simplement jamais
proposée à une joueuse sans PJ.

**Décision** : une joueuse sans PJ assigné peut lancer l'assistant en mode
création (pas seulement édition d'une entité existante), qui crée directement
une fiche marquée PJ (`is_pc: true`) et attribuée à elle
(`campaign_characters.user_id`) — éditable ensuite par elle-même et par le MJ
comme n'importe quel PJ (`canEditEntity`, aucun mécanisme nouveau à écrire
pour ça).

Deux points d'entrée à couvrir :
- Le bouton « Créer mon personnage » du menu Personnage
  (`ParticipantCharacterSheet.tsx`), quand la joueuse n'a aucun PJ du tout —
  pas seulement « PJ sans fiche », le cas déjà couvert aujourd'hui.
- L'écran « Bienvenue » (`JoinForm.tsx`) — remplacer « Aucun personnage
  disponible pour l'instant » par une option « Créer mon personnage » quand
  la liste des PJ ouverts est vide.

Recoupe l'étape « Nouveau PJ » prévue par V3.1-10 (choix du PJ à la première
visite d'un monde, une fois le nouveau système de connexion en place) — même
mécanisme, à ne construire qu'une fois : ce ticket peut se faire
indépendamment et avant, V3.1-10 le réutilise plutôt que d'en réécrire un
second.

**Étapes**
1. Identifier où « aucun PJ du tout » atteint aujourd'hui
   `ParticipantCharacterSheet.tsx` (actuellement ce composant n'est monté
   qu'avec un `entityId` déjà connu — la page appelante doit d'abord
   accepter ce cas).
2. Proposer l'assistant en mode création (hors `entityMode`) à cet endroit ;
   à la validation, marquer la nouvelle entité PJ et l'attribuer à l'auteure
   de la création (`campaign_characters` upsert, `is_pc: true`, `user_id`) —
   un seul geste, pas une création suivie d'une attribution manuelle séparée
   par le MJ.
3. `JoinForm.tsx`/`actions.ts` : quand `characters.length === 0` (rôle
   joueur), remplacer le message bloquant par une option « Créer mon
   personnage » qui ouvre le même assistant avant de finaliser la connexion.
4. Le MJ garde la main ensuite : la fiche reste réassignable/révocable comme
   n'importe quel PJ (`CampaignDetail.tsx`, déjà existant) — rien de nouveau
   à construire ici.

**Critères**
- [ ] Une joueuse sans aucun PJ assigné peut créer le sien elle-même via
  l'assistant, depuis le menu Personnage.
- [ ] La fiche créée est immédiatement un PJ attribué à elle — éditable par
  elle et par le MJ, sans étape manuelle supplémentaire du MJ.
- [ ] L'écran « Bienvenue » (rejoindre un monde) propose la création d'un PJ
  quand aucun n'est disponible, au lieu d'un message bloquant sans issue.
- [ ] Une joueuse qui a déjà un PJ (avec ou sans fiche) n'est pas affectée —
  comportement actuel inchangé pour ce cas.

---

### ☐ V3.1-15 — La Gestion de campagne illisible : invitations en haut, une carte par personne · `M` — **codé le 1ᵉʳ octobre, à vérifier en direct**

**Modèle conseillé : Sonnet** — interface d'après l'esquisse ; reste la vérification en direct.

Constaté le 1ᵉʳ octobre par l'auteur, captures à l'appui : la fenêtre « Gestion
de campagne » (`CampaignDetail.tsx` + `InviteLinkPanel.tsx`) est « assez
illisible, avec une interface peu claire ». Elle empile cinq listes sans lien
visible entre elles — Membres, À la table, Liens joueurs, Liens MJ en attente,
Personnages attribués, Octrois d'édition — et c'est au MJ de recouper de tête
qui joue quoi et qui peut modifier quoi.

**Esquisse retenue : la piste A**, sur le canevas
[Gestion de campagne — esquisses](https://claude.ai/artifact/KvM1bxgB61kUaJT2n1CxT2)
(artboard « A — Invitations en haut, une fiche par personne », fichier
`Main.dc.html`). Quatre pistes y ont été comparées le 1ᵉʳ octobre : A (cartes
par personne), B (liste à gauche, détail à droite), C (tableau fiches ×
joueurs), D (onglets). **A l'emporte** : elle répond d'un coup d'œil à « qui
est à la table, et qu'est-ce que chacun peut toucher » — et sa seule faiblesse,
s'allonger avec le nombre de joueurs, ne joue pas ici : une table dépasse
rarement 4-5 joueuses (auteur). Comme pour V2.1-24/25, **l'esquisse fait foi**
pour la disposition ; le code fait foi pour tout le reste (jetons, `Dropdown`,
`ActionsMenu`, `ConfirmDialog`).

**Ce que l'écran actuel cache, et que le ticket corrige** — relevé sur les
captures, chacun vérifié dans le code :

1. **« Révoquer » veut dire deux choses.** Dans « Membres », il retire la
   personne de la campagne et libère son personnage (`revokeMember`,
   `ConfirmDialog` « Révoquer ce membre ? ») ; dans « Personnages attribués »,
   il libère seulement le PJ (`revokeCharacterClaim`). Même mot, même couleur,
   deux portées. Deux libellés distincts : **« Retirer de la campagne »** et
   **« Libérer le personnage »**.
2. **« Forcer une réinitialisation » est répété sur chaque ligne** comme un
   lien de texte, alors que c'est un geste rare. Il descend dans le menu ⋮ de
   la carte, avec « Retirer de la campagne ». Une **demande de
   réinitialisation en attente** (`passwordResetRequests`) reste en revanche
   visible sur la carte, sous forme d'étiquette — c'est la seule raison
   d'aller chercher ce geste.
3. **Une même personne est dispersée** entre « Membres » (son compte),
   « Personnages attribués » (son PJ) et « Octrois d'édition » (ses fiches).
   La carte les réunit.
4. **« Personnages attribués » mélange PJ et PNJ sans joueur.** Les PJ
   passent sur les cartes ; les PNJ de la campagne (`is_pc: false`, sans
   `user_id`) vont dans un encart à part, en bas.
5. **Deux comptes portent le même nom** (« Tamara » deux fois, l'un sans
   personnage ni fiche). Rien à l'écran ne permet de les distinguer. **Tranché
   le 1ᵉʳ octobre : le tag à 4 chiffres** — voir « Le tag, visible du MJ »
   ci-dessous.

**La disposition (piste A)**

- **En haut, un panneau « Invitations »** : la création d'une invitation sur
  une ligne (courriel *ou* lien, rôle, mot de passe optionnel, un seul bouton
  principal), puis les liens actifs en lignes calmes — rôle, date de création,
  étiquette « protégé », `Copier` visible, le reste dans ⋮ (`InviteRow`
  existant, déjà ainsi depuis V2.1-25). Le compte des liens dans l'en-tête du
  panneau (« 5 liens joueurs actifs · 0 lien MJ en attente »). L'état vide
  « Aucun lien MJ en attente » se réduit à cette mention : il n'a pas à
  occuper un grand cadre pointillé.
- **« À la table » : les MJ sur une ligne** (nom, étiquette MJ, et ce qu'ils
  ont en plus — ex. « Peut éditer : Prologue »). Un MJ peut déjà tout
  modifier : une carte entière pour lui serait du bruit.
- **Une carte par compte joueur**, en grille (3 colonnes sur grand écran,
  1 sur téléphone) :
  - en-tête : initiale, nom **suivi de son tag** (`Tamara#4821`, le tag en
    `text-ink-muted` et en chiffres tabulaires, plus discret que le nom),
    rôle, menu ⋮ du compte (« Forcer une réinitialisation », « Retirer de la
    campagne », tous deux confirmés) ;
  - **le PJ joué**, mis en avant (fond d'accent), avec son propre ⋮ («
    Ouvrir la fiche », « Libérer le personnage ») — ou, sans PJ, une zone
    pointillée « Aucun personnage — attribuer un PJ » qui ouvre le choix ;
  - **« Peut aussi modifier »** : les fiches octroyées en étiquettes, chacune
    retirable par ×, puis « + Partager une fiche » (le `Dropdown` de fiches
    existant, à l'endroit de la personne — on ne choisit plus le joueur dans
    un second menu, il est déjà donné par la carte).
- **En bas, « PNJ de la campagne · sans joueur »** : les PNJ attribués en
  étiquettes, et « + Ajouter un PNJ » (le geste « Attribuer » actuel, cas
  « PNJ (sans joueur) »).

**Étapes**

1. Relire `CampaignDetail.tsx` et `InviteLinkPanel.tsx` sur `master` (tous
   deux retouchés par V3.1-10) et lister chaque geste existant ; **aucun ne
   disparaît**, chacun reçoit une place dans la carte, le panneau ou l'encart.
2. Regrouper côté client les données que `/api/campaigns/[id]` renvoie déjà
   (`members`, `characters`, `grants`, `displayNames`,
   `passwordResetRequests`) en une vue par personne. **Aucune route ni
   requête nouvelle** : si ce regroupement semble en demander une, s'arrêter
   et le dire. Le regroupement est une fonction pure, testée.
3. **Le tag** (ADR 0032) : `/api/campaigns/[id]` renvoie
   `handleTags: Record<userId, string>` quand l'appelant gère la campagne,
   rien sinon ; test d'intégration des deux cas (MJ reçoit, joueuse ne reçoit
   pas). Nouvelle migration qui remplace le commentaire de colonne
   `profiles.handle_tag` (l'ancienne, appliquée, ne se modifie pas).
4. Composants : `CampaignPersonCard` (une carte), le panneau Invitations
   (réorganisation de `InviteLinkPanel`, `InviteRow` gardé tel quel),
   l'encart PNJ. `CampaignDetail` les assemble.
5. Libellés : « Retirer de la campagne » / « Libérer le personnage » /
   « Partager une fiche » ; textes des `ConfirmDialog` relus pour dire chacun
   sa portée exacte.
6. Vérifier en navigateur sur la campagne réelle (La Croisade des Ombres),
   aux largeurs bureau et 375 px, dans les quatre modes de la charte.

**Critères**

- [ ] La fenêtre suit la piste A de l'esquisse : Invitations en haut, MJ sur
  une ligne, une carte par compte joueur, personnages sans joueur en bas.
  **Vérifié au banc, à revoir chez l'auteur** sur la vraie campagne.
- [x] Chaque geste de l'écran actuel existe encore, et un seul endroit le
  porte — liste de l'étape 1 :

  | Geste d'avant | Où il vit maintenant |
  |---|---|
  | Inviter par courriel | Panneau Invitations, même ligne que le lien : un courriel saisi change le bouton en « Inviter par courriel » (et le rôle choisi s'applique, là où l'ancien formulaire n'envoyait que « joueur ») |
  | Générer un lien (rôle, mot de passe) | Panneau Invitations |
  | Copier, mot de passe, réinitialiser le personnage, révoquer un lien | `InviteRow`, inchangé |
  | Forcer une réinitialisation | Menu ⋮ de la carte (ou de la ligne MJ) |
  | Révoquer un membre | « Retirer de la campagne », menu ⋮ de la carte, confirmé |
  | Attribuer un PJ à une joueuse | Sa carte : « Aucun personnage — attribuer un PJ » (un PNJ peut toujours devenir son PJ) |
  | Attribuer un personnage sans joueur, ou à un MJ | Encart « Personnages sans joueur » : « PNJ (sans joueur) » ou « MJ — … » |
  | Révoquer une fiche PJ | « Libérer le personnage », menu ⋮ du PJ, **désormais confirmé** |
  | Accorder l'édition d'une fiche | « + Partager une fiche », sur la carte : plus de second menu pour choisir la joueuse |
  | Retirer un octroi | × sur l'étiquette de la fiche |
  | Rappels « référence personnelle » | En tête du panneau Invitations |

- [x] « Révoquer » n'apparaît plus pour deux portées différentes : « Retirer
  de la campagne » et « Libérer le personnage » sont distincts, et chacun
  confirme en nommant la personne et ce qu'elle garde.
- [x] « Forcer une réinitialisation » n'est plus répété sur chaque ligne ; une
  demande en attente reste visible sur la carte (« mot de passe oublié »).
- [x] Partager une fiche se fait depuis la carte de la personne, sans choisir
  de joueur dans un second menu.
- [x] Chaque compte tag est nommé `Nom#0000` partout dans cet écran, y
  compris dans les confirmations ; deux comptes de même nom se distinguent.
- [ ] Le tag n'est renvoyé par `/api/campaigns/[id]` qu'à qui gère la
  campagne — **codé** (`isWorldAdmin` dans la route), **pas de test
  d'intégration** : il ne tournerait pas sans base dans la session cloud. À
  vérifier en direct avec un compte joueuse (la réponse ne doit porter aucun
  `handleTags` rempli).
- [x] Aucune nouvelle route ; une seule migration
  (`20261001120000_handle_tag_visible_to_gm.sql`), celle du commentaire de
  colonne. Le reste est de la présentation.
- [ ] Lisible à 375 px de large ; les quatre modes et le contraste élevé
  testés (charte §6) — **à faire en direct** : la grille passe à une colonne
  sous 768 px, deux jusqu'à 1 280, trois au-delà.
- [x] `npm run typecheck && npm run lint && npm run test` passent.

**Comment c'est construit.** Le regroupement par personne est une fonction
pure, `groupCampaignPeople` (`src/core/campaigns/people.ts`, tests d'abord) :
MJ, joueuses, et les personnages que personne ne tient — PNJ, PJ libérés, et un
personnage resté au nom d'un compte qui n'est plus membre, qu'on ne perd pas.
Le panneau Invitations est `InviteLinkPanel`, réorganisé : son champ courriel
n'apparaît que dans la Gestion de campagne (l'onglet Accès de l'accueil,
Administration, le monte sans).

**Vérifié au banc** (Chromium, vrai CSS, données des captures de l'auteur) :
les huit tags affichés, plus aucun « Révoquer » à l'écran, la confirmation
« Retirer Tamara#0377 de la campagne ? ».

**Écarts avec l'esquisse, voulus :**
- Les liens MJ déjà utilisés (« Claude, lien créé le 27 septembre ») restent
  dans le panneau Invitations sous « Liens MJ utilisés » plutôt que sur la ligne
  du MJ : c'est là que vivent leurs gestes (mot de passe, révocation).
- « Ouvrir la fiche » n'est pas dans le menu du PJ : l'écran ne connaît que
  l'identifiant et le nom des fiches, pas leur adresse. Ce n'était pas un geste
  de l'ancien écran.
- La RLS de `profiles` laisse encore lire `handle_tag` à tout compte qui
  partage un monde : c'est l'état laissé par V3.1-10. Le filtrage voulu par
  l'ADR 0032 est fait par la route, comme la règle absolue 5 le demande ; une
  restriction en base serait un autre ticket.

**Le tag, visible du MJ — tranché le 1ᵉʳ octobre (ADR 0032).** Deux comptes
peuvent porter le même nom ; c'est précisément ce que le tag à 4 chiffres de
V3.1-10 sert à distinguer. Il s'affiche donc **au MJ de la campagne, dans cet
écran**, après le nom : `Tamara#4821`. Ce choix amende V3.1-10 et l'ADR 0031,
qui le voulaient « invisible hors des réglages du compte concerné » ; il reste
invisible partout ailleurs (liste vue par une joueuse, attribution publique,
wiki). Trois conséquences :

- **Filtrage serveur** (règle absolue 5) : `/api/campaigns/[id]` ajoute les
  tags à sa réponse **seulement** si l'appelant gère la campagne (la garde qui
  alimente déjà `canManage`). Une joueuse qui ouvre la même route ne reçoit
  aucun tag — pas un champ envoyé puis masqué.
- **Partout où le MJ nomme une personne dans cet écran** — cartes, ligne des
  MJ, textes des `ConfirmDialog` (« Retirer Tamara#4821 de la campagne ? ») —
  le tag suit le nom, pour qu'aucun geste ne vise le mauvais compte.
- Un compte ordinaire (courriel, sans tag) affiche son nom seul.

C'est une petite entorse au « aucune route nouvelle » des critères : la
route existe, elle gagne un champ. `getDisplayNamesForUsers` (ou une
variante) lit `handle_tag` en plus de `display_name`.

**Hors périmètre, et dit comme tel** : les cinq liens joueurs réutilisables
se ressemblent tous (seule leur date les distingue). Un seul suffit sans
doute ; les révoquer est un geste du MJ, pas un changement d'écran (mais voir
le bug ci-dessous : avant le correctif du 1ᵉʳ octobre, ce geste expulsait). Les
nommer (« lien Discord », « lien table du jeudi ») serait une fonctionnalité
neuve, à rouvrir si le besoin se confirme.

**Complément du 1ᵉʳ octobre — retirer un second MJ.** Demande de l'auteur :
pouvoir éjecter un MJ de la partie depuis le ⋮ de sa ligne, sauf le créateur du
monde.
- Le ⋮ d'un MJ propose « Retirer de la campagne » **si ce n'est pas le
  créateur du monde** (`worlds.owner_id`). La règle tient dans
  `canRemoveFromCampaign` (`src/core/campaigns/people.ts`, tests d'abord) ;
  `/api/campaigns/[id]` renvoie `worldOwnerId` au seul MJ (même borne que les
  tags).
- La confirmation parle d'un MJ : « n'est plus MJ de cette campagne… Son lien
  MJ, déjà utilisé, ne resservira pas : pour le faire revenir, génère un
  nouveau lien MJ. »
- **Faille fermée en base** (migration `20261001130000`) :
  `app.revoke_campaign_member` vérifiait que l'appelant gère le monde, jamais
  qui était visé. Or tout MJ de campagne gère le monde : un second MJ pouvait
  expulser le créateur en appelant la route à la main. La fonction refuse
  maintenant toute cible qui est le créateur du monde.
- Un MJ invité au niveau du monde (`world_members`, lien MJ de monde) perd sa
  place dans la campagne mais garde ses droits sur le monde : c'est
  « Révoquer » sur son lien qui les retire.
- Test d'intégration ajouté (`campaigns.integration.test.ts`), sauté sans base.
- [ ] À vérifier en direct : le ⋮ de Gabriel (créateur) n'a pas « Retirer » ;
  celui d'un second MJ l'a, et le retrait le fait disparaître de « À la table ».

**Bug trouvé en jouant (1ᵉʳ octobre) — révoquer un lien joueur expulsait des
joueuses.** L'auteur a révoqué les liens joueur en double pour n'en garder
qu'un (celui du 2 septembre) : les joueuses ont disparu de « À la table » et
leur PJ est redevenu libre. L'écran promettait pourtant « Celles qui l'ont
déjà utilisé gardent leur accès ».
- **Cause** : `app.revoke_campaign_invite_access` (V2.1-25) retire l'accès de
  `claimed_by_user_id`. Les liens joueur sont réutilisables depuis V3.1-10 et
  n'écrivent plus ce champ — mais ceux créés **avant**, sous l'ancien régime à
  usage unique, le portaient encore. Révoquer l'un d'eux expulsait la joueuse
  qui l'avait utilisé en premier.
- **Correctif** (migration `20261001140000`) : un lien joueur révoqué cesse
  seulement de fonctionner ; personne n'est expulsé. Retirer quelqu'un, c'est
  « Retirer de la campagne » dans son ⋮. Un lien MJ garde l'ancien
  comportement (le révoquer retire son MJ — c'est ce qui a servi à retirer
  Claude).
- Les comptes, eux, n'ont jamais été touchés : identifiant, mot de passe et
  tag restent valides. Seules les lignes `campaign_members` ont disparu.
  Réintégration donnée à l'auteur : une requête qui recrée la ligne
  `campaign_members` (rôle `player`) pour chaque `claimed_by_user_id` des liens
  joueur révoqués, puis réattribution des PJ depuis « Personnages sans
  joueur » ou « Attribuer un PJ ».
- Test d'intégration ajouté (`campaignInvites.integration.test.ts`), sauté
  sans base.

**Retour en jouant (1ᵉʳ octobre) — le sélecteur « attribuer un PJ » se
chevauchait.** Dans une carte joueuse, la liste, « Attribuer » et « Fermer »
ne tenaient pas sur une ligne et se repliaient les uns sur les autres ; le
chevron de la liste passait sous son libellé (`triggerClassName` remplace le
style de base du `Dropdown`, `inline-flex` compris). Désormais : une petite
boîte, la liste sur toute la largeur, puis « Annuler » et « Attribuer » (ou
« Partager ») en bouton plein, alignés à droite. Pour le PJ, la boîte remplace
la case pointillée au lieu de s'empiler dessous. Vérifié au banc.

**Retour en jouant (1ᵉʳ octobre) — plus de « peut aussi modifier » sur la
ligne d'un MJ.** Un MJ modifie déjà tout le monde : afficher ses octrois
d'édition (« peut aussi modifier : Prologue ») ne disait rien d'utile. La
mention disparaît de la ligne des MJ ; les cartes joueuses la gardent. Les
octrois eux-mêmes restent en base (rien n'est supprimé) : ils resserviraient
tels quels si ce compte redevenait joueur.

---

### ☐ V3.1-16 — Le Calendrier réel refait : une grille à bascule, côté MJ comme côté joueuse · `M`/`L` — **codé le 1ᵉʳ octobre, à vérifier en direct**

**Modèle conseillé : Sonnet** — interface d'après l'esquisse ; reste la vérification en direct.

Constaté le 1ᵉʳ octobre par l'auteur, captures à l'appui : le Calendrier réel
du MJ (`SchedulingMjPanel.tsx`) empile deux grilles hautes qu'il faut faire
défiler dans les deux sens, perd les heures dès qu'on défile vers la droite,
affiche « ? » au survol à la place de l'auteur, et liste les 31 jours même
quand personne n'est disponible. La vue joueuse (`NextSessionPanel.tsx`,
page `joueur/prochaine-session`) est « pas ouf » : trois onglets, la
prochaine séance cachée derrière l'un d'eux, et aucune vue de la table.

**L'esquisse fait foi, au pixel près pour la grille** — canevas
[Calendrier réel — esquisses](https://claude.ai/artifact/Lh9FKyKz4zF3LbMSBCcXe5),
interactif (bouton Play de chaque cadre) :

- **Vue MJ** : cadre « A — Retenue : une grille, bascule Mes dispos / Toute
  la table », fichier `Main.dc.html`.
- **Vue joueuse** : cadre « Vue joueuse — même écran, sans les outils MJ »,
  fichier `Joueuse.dc.html`.

Les cadres B, C et D (une grille avec panneau latéral, une semaine à la fois,
jours en lignes) ont été regardés et écartés ; ils restent sur le canevas.
Dans l'esquisse, les disponibilités de l'auteur (11, 24, 25 octobre 10:00–22:00,
31 octobre 10:00–18:30) et les séances listées sont réelles ; **celles des
joueuses sont inventées** pour que la carte de chaleur ait quelque chose à
montrer. Comme pour V3.1-15, l'esquisse fait foi pour la disposition et les
comportements ; le code fait foi pour les jetons (`--accent`, `--edge`,
`--panel-*`), `Dropdown`, `ConfirmDialog` et la charte.

#### La grille — commune aux deux vues

Un seul composant de grille remplace `AvailabilityPaintGrid.tsx` et
`AvailabilityHeatmap.tsx` à l'affichage (la logique de peinture et
d'enregistrement de `AvailabilityPaintGrid` est reprise, pas réécrite).

- **Bascule « Mes disponibilités / Toute la table »** (segments, comme dans
  l'esquisse), au-dessus de la grille. Une seule grille à l'écran, jamais deux
  empilées.
  - *Mes disponibilités* : on peint ses créneaux (clic, ou glisser pour
    cocher ou décocher une plage), case pleine en `--accent`. À côté de la
    bascule, le total coché (« 9,5 h cochées »).
  - *Toute la table* : carte de chaleur, fond `--accent` d'autant plus opaque
    qu'il y a de monde, et la légende « Moins → Toute la table » sous la grille.
- **Géométrie de l'esquisse** : colonnes de jour de 40 px, lignes d'une
  demi-heure de 20 px, en-tête de dates de 46 px (jour abrégé au-dessus, numéro
  en dessous), colonne des heures de 68 px avec un libellé par heure pleine.
  Trait vertical plus marqué entre dimanche et lundi ; samedi et dimanche
  légèrement teintés dans l'en-tête.
- **Toutes les heures visibles sans défilement vertical** : la grille prend sa
  hauteur entière (créneau proposé de 08:00 à 22:00 = 28 lignes ≈ 600 px).
  **Une ligne de clôture affiche la dernière heure** (« 22:00 », en accent)
  sous la dernière demi-heure : on voit où finit le créneau proposé. Seul le
  défilement horizontal subsiste, sur les jours.
- **La colonne des heures reste à gauche** quand on défile vers la droite
  (`position: sticky`), et la ligne des dates reste en haut.
- **Surbrillance en croix au survol** : la date dans l'en-tête et l'heure dans
  la colonne de gauche passent en fond accent atténué ; la ligne et la colonne
  de la case s'éclaircissent légèrement ; la case visée est entourée. Vrai dans
  les deux modes.
- **Info-bulle au survol en mode « Toute la table »** : jour en toutes lettres
  et demi-heure (« samedi 24 oct. · 16:00–16:30 »), le décompte (« 5/8
  disponibles »), puis les noms, **la personne qui regarde en tête avec
  « (toi) »**. L'info-bulle passe à gauche de la case près du bord droit.
- **Barre de défilement aux couleurs de l'application** : celle de
  `app/globals.css` (6 px, piste transparente, poignée `--edge`,
  `--edge-strong` au survol), et une marge sous la grille pour qu'elle ne
  couvre jamais la ligne « 22:00 ». Ces règles `::-webkit-scrollbar` ne
  touchent pas Firefox, qui garde la barre du système — limite connue de
  `globals.css`, hors de ce ticket.

#### Les dates possibles — commune aux deux vues

- **Seulement les jours où au moins une personne est disponible.** Les jours
  à « 0/8 — aucun créneau commun » disparaissent.
- Une ligne par jour, comme dans l'esquisse : rang, décompte en grand (« 5/8 »),
  date, meilleur créneau et sa durée (« 14:00–22:00 · 8 h »), étiquette
  « Session complète » ou « Moins de 5 h » (selon la durée visée), les noms des
  présents sur ce créneau, une barre de remplissage.
- **Changement de règle, voulu** : le « meilleur créneau » d'un jour est la plus
  longue plage où le **plus grand nombre** de personnes est disponible, et le
  classement trie par ce nombre, puis par la durée. Aujourd'hui
  (`computeOverlap`/`rankDays`, `src/core/scheduling/overlap.ts`) il faut un
  créneau commun à **toutes** les personnes ayant répondu ce jour-là : une
  seule joueuse dispo le matin seulement suffit à classer le jour « aucun
  créneau commun », alors que quatre autres pourraient jouer 5 h. Fonction
  pure dans `src/core/scheduling`, **tests d'abord**, avec ce cas-là.

#### Vue MJ (`Main.dc.html`)

De haut en bas : en-tête (titre de la demande, « Créneau proposé · N jours ·
X réponses sur Y », durée visée, « Annuler la demande ») → la grille à bascule
→ « Dates possibles » avec un bouton « Confirmer » par ligne (accent plein pour
une session complète) → trois cartes côte à côte : « Régler une date à la
main », « Séances à venir » (avec « Annuler »), « Déjà jouées ».

#### Vue joueuse (`Joueuse.dc.html`)

La même page **sans aucun outil MJ** : ni durée visée, ni « Annuler la
demande », ni « Confirmer », ni date à la main, ni « Annuler » sur les séances.
Elle remplace les trois onglets actuels par une seule page :

1. **La prochaine séance confirmée, en tête et en grand** (carte avec la date
   en pavé, « Dimanche 18 octobre · 16:00 », « environ 6 h · dans 17 jours »).
2. **La demande ouverte** : titre, une phrase qui dit ce que le MJ propose
   (« du 1ᵉʳ au 31 octobre, entre 08:00 et 22:00 — coche tout ce qui t'irait »),
   l'état de sa réponse (« Réponse enregistrée »), puis la grille à bascule —
   **« Toute la table » compris**.
3. **« Les dates qui se dessinent »** : le même classement, en lecture seule,
   avec « c'est le MJ qui choisit ».
4. « Séances à venir » et « Déjà jouées », côte à côte, en lecture seule.

Sans demande ouverte, la section 2 se réduit à une ligne (« Aucune demande de
disponibilités pour le moment ») et la 3 disparaît.

**La joueuse voit la table : aucun droit nouveau.** La RLS de
`real_session_availabilities` ouvre déjà la lecture à tout membre du monde
(« rien ici n'est sensible entre coéquipières », migration
`20260913140000_real_scheduling.sql`). La route
`/api/campaigns/[id]/scheduling/requests/open`, qui renvoie la carte de chaleur
et le classement, ne vérifie que l'authentification : elle sert déjà à une
joueuse, il suffit que sa page l'appelle. Les champs propres au MJ (durée visée)
peuvent rester dans la réponse : ils ne sont pas secrets, seulement inutiles.

#### Deux bugs relevés en lisant le code — corrigés par ce ticket

1. **Le « ? » à la place de l'auteur.** `resolveNamesIncludingGm`
   (`src/server/services/scheduling.ts`) ne nomme que **le premier** MJ trouvé
   (`members.find(m => m.role === "gm")`). Avec deux MJ (Claude et Gabriel),
   l'autre reste sans nom, rendu « ? » par `AvailabilityHeatmap`. Tous les MJ
   sont nommés.
2. **Le « /8 ».** `totalMembers` compte tous les membres de la campagne : les
   deux MJ et le doublon « Tamara ». Le dénominateur devient **les personnes
   attendues à la table** : les joueuses et le MJ qui a ouvert la demande — pas
   un second MJ qui ne répond pas.

#### Points tranchés par l'esquisse, à respecter

- **Les noms affichés sont ceux des personnes**, pas de leurs PJ : l'info-bulle
  et les dates possibles disent « Soso », pas « Fine Lââm ». Aujourd'hui
  `resolvePlayerNames` renvoie le nom du PJ. Lire `display_name` (et le tag de
  V3.1-15 si deux comptes portent le même nom, côté MJ seulement — ADR 0032).
- **Enregistrement côté joueuse** : l'esquisse montre un bouton « Enregistrer
  mes disponibilités ». Aujourd'hui `AvailabilityPaintGrid` enregistre seule, à
  chaque relâchement de la souris. **On garde l'enregistrement automatique** (un
  bouton oublié perd une réponse) et le bouton de l'esquisse devient une ligne
  d'état à la même place : « Enregistrement… » puis « Enregistré ✓ », et l'erreur
  en `--danger` si l'écriture échoue. À rouvrir si l'auteur préfère le bouton.
- Côté MJ, la grille « Mes disponibilités » remplace la grille de peinture
  actuelle : le MJ répond comme une joueuse.

**Étapes**

1. Noyau (`src/core/scheduling`), **tests d'abord** : meilleur créneau d'un jour
   (plus grand nombre, puis plus longue plage), classement, filtrage des jours
   vides, total coché.
2. Serveur : nommer tous les MJ, dénominateur « attendus à la table », noms de
   personnes au lieu des PJ. Tests d'intégration sur deux MJ.
3. Composant de grille unique (bascule, sticky, croix, info-bulle, ligne
   22:00, barre de défilement), monté par les deux vues.
4. `SchedulingMjPanel` réorganisé selon `Main.dc.html`.
5. `NextSessionPanel` réécrit selon `Joueuse.dc.html` (fin des trois onglets).
6. Vérifier en navigateur, avec un compte MJ et un compte joueuse, sur la
   campagne réelle : bureau et 375 px, les quatre modes, le contraste élevé.

**Critères**

- [ ] Vue MJ et vue joueuse conformes à `Main.dc.html` et `Joueuse.dc.html`,
  comparées côte à côte avec l'esquisse. **À faire chez l'auteur**, sur la
  campagne réelle, avec un compte MJ et un compte joueuse.
- [x] Une seule grille par vue, avec la bascule « Mes disponibilités / Toute la
  table » (`AvailabilityGrid.tsx`, monté par `SchedulingMjPanel` et
  `NextSessionPanel` ; `AvailabilityPaintGrid` et `AvailabilityHeatmap`
  supprimés).
- [x] De 08:00 à 22:00, toutes les heures sont visibles sans défilement
  vertical, la ligne « 22:00 » comprise, et la barre de défilement ne la
  couvre pas.
- [x] Les heures restent visibles en défilant vers la droite. *La ligne des
  dates n'a plus besoin de rester en haut : la grille n'a plus de défilement
  vertical.* La colonne des heures a un fond opaque (le panneau posé sur le fond
  de page) : `--panel` est translucide, et les cases défilant dessous
  transparaissaient.
- [x] Au survol, la date et l'heure de la case s'allument, sa ligne et sa
  colonne s'éclaircissent (ombre intérieure, visible aussi sur une case vide) ;
  en « Toute la table », l'info-bulle donne les noms, le sien en tête avec
  « (toi) », et **jamais « ? »** : tous les MJ sont nommés.
- [x] Les dates possibles ne listent que les jours où quelqu'un est disponible,
  classées par nombre de présents puis par durée (`bestWindow.ts`, tests
  d'abord : le cas « une joueuse le matin ne casse plus la journée », et deux
  groupes contigus de même taille jamais fusionnés).
- [x] La vue joueuse ne montre aucun outil MJ, met la prochaine séance en tête,
  et laisse voir la table. Page élargie (`max-w-lg` → `max-w-5xl`).
- [x] La barre de défilement reprend le style de `app/globals.css` (rien à
  écrire : la règle globale s'applique).
- [x] Sans demande en cours, le MJ voit la prochaine séance et un écran vide
  avec « Demander les disponibilités » ; le formulaire s'ouvre au clic, avec
  l'aperçu en direct de la grille (`SansDemande.dc.html`, `Formulaire.dc.html`).
- [x] La grille suit la forme de la demande : colonnes élargies jusqu'à 140 px
  quand il y a peu de dates, mois dans l'en-tête (`EnCours.dc.html`).
- [x] `npm run typecheck && npm run lint && npm run test` passent.

#### Avant et après la demande — ajouté le 1ᵉʳ octobre

Le ticket ne disait rien de l'écran **sans demande en cours**, ni du
**formulaire** qui en ouvre une. L'auteur a demandé à les voir, et à vérifier
que la grille s'adapte à une demande d'une autre forme. Trois cadres ajoutés au
même canevas, rangée « Avant et après la demande », retenus tels quels
(« Allons comme ça ») :

- **`SansDemande.dc.html` — MJ sans demande en cours** : la prochaine séance
  confirmée en tête (la même carte que chez la joueuse, `NextSessionCard`), un
  panneau vide « Aucune demande de disponibilités en cours » avec une phrase
  d'explication et le bouton « Demander les disponibilités », puis les trois
  cartes du bas. Le formulaire ne s'affiche plus d'office : il s'ouvre au clic.
- **`Formulaire.dc.html` — formuler une demande** : trois étapes numérotées
  (nom, dates, plage horaire) et, dessous, **l'aperçu en direct de la grille
  que verront les joueuses** (`AvailabilityGrid` en mode `preview` : ni
  bascule, ni peinture, ni enregistrement). « Annuler » revient à l'écran vide,
  « Envoyer la demande » crée la ronde, comme le « Créer » d'avant.
- **`EnCours.dc.html` — une autre demande** : week-ends de 19:00 à 23:00 sur
  deux mois, pour montrer l'adaptation.

**La grille s'adapte à la demande — c'était déjà vrai, deux choses ajoutées.**
Ses colonnes sont les dates proposées (et elles seules, même non contiguës), ses
lignes la plage horaire par demi-heure, sa ligne de clôture l'heure de fin. Le
curseur va de 00:00 à 24:00 : une demande ne passe jamais minuit. Ajouté :

- **Colonnes élargies quand il y a peu de dates** : la largeur se mesure
  (`ResizeObserver`) et se répartit, entre 40 et 140 px. Huit dates en font
  122 ; trente et une restent à 40, avec défilement.
- **Le mois dans l'en-tête**, au premier jour puis à chaque changement
  (« oct. », « nov. ») : une demande à cheval sur deux mois ne disait pas à quel
  mois appartenait le « 1 ». L'en-tête passe de 46 à 58 px.

**Le formulaire, ce qui change et ce qui reste.**
- Deux mois côte à côte au lieu d'un, flèches pour avancer ; clic et
  clic-glissé comme avant. **Les jours passés ne se choisissent plus** (ils
  restent visibles) : une date candidate passée n'a jamais de sens.
- L'onglet « Jours de la semaine » **garde son fonctionnement** (jours cochés,
  « Du … au … », « Appliquer ») : l'esquisse le simplifiait sur deux mois fixes,
  ce qui aurait perdu la plage libre. Seul le style change.
- Le curseur horaire (`TimeRangeSlider`) se glisse toujours, et gagne des
  boutons − / + d'une demi-heure de chaque côté et une échelle 00:00 → 24:00.
- Même envoi au serveur qu'avant : aucune route ni donnée touchée.

**Vérifié au banc** (même méthode que plus bas) : 8 dates de week-end sur deux
mois → colonnes de 122 px, « oct. » et « nov. » dans l'en-tête ; dans le
formulaire, cinq dates cliquées → l'aperçu en compte cinq, et « Finir plus
tard » ajoute une ligne (40 → 45 cases).

#### Bug trouvé en jouant — corrigé le 1ᵉʳ octobre

**Constat (auteur)** : régler une date à la main pendant la demande d'octobre
a fermé la demande, et les disponibilités cochées ont disparu de l'écran.

**Cause** : `createRealSession` fermait la demande ouverte à **chaque** séance
confirmée, manuelle comprise (comportement de V3.1-8, étape 6, pensé pour le
seul bouton « Confirmer » des dates possibles). **Rien n'était effacé** :
fermer une demande ne fait que passer `availability_requests.status` à
`closed`, et les réponses restent en base, rattachées à elle
(`real_session_availabilities.request_id`).

**Correction** : seule une séance confirmée **depuis les disponibilités**
(`source: "availability"`) ferme la demande ; une date réglée à la main
(`source: "manual"`) est indépendante et la laisse ouverte. Test
`scheduling.createRealSession.test.ts`, écrit avant la correction et vu
échouer dessus.

**Récupérer la demande fermée par erreur** : la rouvrir suffit, les réponses
reviennent avec elle. À faire à la main dans l'éditeur SQL de Supabase (aucun
écran ne rouvre une demande aujourd'hui).

**Ce qui a été vérifié, et comment.** Sans base dans la session cloud, la grille
a été montée seule dans Chromium (Playwright), alimentée par une demande
d'octobre et des réponses de test : réponse existante relue (44,5 h cochées),
colonne des heures immobile à 600 px de défilement, info-bulle « 3/6 disponibles
· Gabriel (toi) · Soso · Leïla », classement des dates, et un glisser sur quatre
cases qui enregistre **une seule plage** `10:00–12:00` — la forme d'avant. Les
routes, la RLS et les deux écrans complets n'ont pas tourné : c'est la
vérification en direct qui reste.

**Les réponses déjà déposées pour octobre ne bougent pas** (demande de l'auteur
pendant le codage) : aucune migration, aucune écriture nouvelle. Une réponse
reste « une plage par jour et par personne » ; seuls le calcul du classement et
l'affichage changent.

**Décisions prises en codant :**
- Noms : **la personne seulement** (`profiles.display_name`), tranché par
  l'auteur le 1ᵉʳ octobre — l'ancien commentaire « les comptes s'identifient par
  leur personnage partout » ne vaut plus pour cet écran. `resolvePlayerNames`
  (nom du PJ) reste inchangé pour le Livre de sessions. Le tag de V3.1-15 n'est
  pas ajouté ici : il vient avec V3.1-15.
- Dénominateur : les joueuses, le MJ qui a ouvert la demande, et tout autre
  membre qui a répondu (`expectedAtTable`). Le doublon « Tamara » compte encore,
  c'est un vrai membre : V3.1-15 permettra de le retirer.
- Enregistrement : automatique au relâchement, comme avant, avec une ligne
  d'état « Enregistrement… / Enregistré ✓ » à côté de la bascule.
- `computeOverlap`/`rankDays` supprimés avec leurs tests : plus aucun appelant.
- Pas de test d'intégration sur deux MJ : il ne tournerait pas sans base. La
  règle du dénominateur est testée dans le noyau ; les noms viennent d'une seule
  requête groupée sur `profiles`.

---

### ☐ V3.1-17 — Un catalogue d'interface visuel, et une charte qui y renvoie · `M` — **fait le 1ᵉʳ octobre**

**Modèle conseillé : Sonnet** — documentation et planches.

**Constat.** Les défauts d'esthétique revenaient sur des éléments que la charte
ne décrivait pas (l'ascenseur de la grille du calendrier, la bulle de date du
navigateur, le sélecteur de PJ qui se chevauchait) ou qu'on réécrivait à la main
sans voir l'original. Une charte en mots ne suffit pas : il faut voir l'élément,
ses états et ses animations, et y puiser pour créer les suivants. L'auteur avait
amorcé `CHARTE-UI-verre-mineral.md` dans une autre session dans ce but.

**Ce qui est fait** (ADR 0033) :
- **Le catalogue** — canevas https://claude.ai/artifact/LcTPxvcvSbg1TdMqyrJD3G,
  sources dans `docs/catalogue/` (neuf planches `.dc.html` + `canvas.json`).
  Deux rangées : les briques (1 Fondations, 2 Boutons et champs, 3 Onglets,
  puces, menus, 4 Surfaces et retours, 5 Éléments d'écran, 6 Fiche de
  personnage, 7 Mode solo), puis les éléments d'écran riches (8 Wiki visuel,
  9 Outils du MJ). Chaque section : la règle, le composant à utiliser, la
  transition réelle, les états qui existent côte à côte, un exemplaire vivant
  (« Rejouer » pour les animations), un sélecteur de mode (sombre, tamisé,
  doux, clair, contraste élevé).
- **Aucun style recopié** : `scripts/catalogue/build-css.mjs` compile
  `app/globals.css` avec les planches comme source et dérive `.st-hover`,
  `.st-focus`, `.st-active` des vraies règles `:hover`, `:focus-visible`,
  `:active`. `app/globals.css` exclut `docs/` du scan Tailwind
  (`@source not "../docs"`) pour que la feuille de l'application ne gonfle pas.
- **La charte** (`docs/CHARTE-UI.md`) gagne trois sections : §9 l'index des
  planches et les écarts relevés, §10 icônes et glyphes (jamais d'émoji), §11
  la coquille — les sections 0 à 16 de « verre minéral », vérifiées contre le
  code. Deux cases de plus à la vérification du §6. **Un seul fichier fait foi** :
  « verre minéral » n'entre pas dans le dépôt ; ses propositions de refonte
  (§17-18) deviennent V3.1-19.
- **`CLAUDE.md`** : le catalogue dans le tableau des documents, et la règle
  « avant de créer un élément, cherche-le ; un élément nouveau ou modifié met sa
  planche à jour ; jamais d'émoji ».
- **Mode d'emploi** : `docs/catalogue/README.md` (anatomie d'une section,
  reconstruire le CSS, publier, limite de 8 000 px par planche).

**Méthode, et ce qu'elle a appris.** Chaque planche a été écrite à partir des
classes réelles des composants (relevées fichier par fichier), puis vérifiée
dans un rendu local avec le vrai CSS. Deux reprises en route : une première
version tenait sur une seule page et était coupée après 8 000 px (limite du
canevas) ; une première passe n'avait parcouru que les composants partagés et
la coquille — l'auteur a signalé l'oubli du bouclier de CA, des jauges du mode
solo et des boutons de jet. L'inventaire complet a ajouté les planches 6 à 9.

**Écarts relevés** (charte §9) : émojis (→ V3.1-18) ; `MissingBlocksBanner` en
ambre Tailwind en dur ; deux règles de couleur pour une barre qui baisse
(accent/danger sur la fiche, accent/terracotta/danger sur l'initiative et les
rencontres) ; aucun état « appuyé » propre sur les boutons.

**Au passage, sur « verre minéral »** : la radio du rail reste visible quand le
rail se replie (seul le libellé disparaît), avec le point d'activité au centre
de l'icône, vert en lecture, rouge à l'arrêt — corrigé dans l'esquisse (MJ et
joueur, desktop et tablette).

**Critères d'acceptation**
- [x] Chaque élément d'interface réutilisable a sa section, avec les états qui existent dans le code.
- [x] Le style vient du CSS compilé, jamais d'une copie (`build-css.mjs` produit la feuille publiée à l'octet près).
- [x] La charte renvoie au catalogue ; `CLAUDE.md` impose de le tenir à jour.
- [ ] À vérifier par l'auteur : les exemplaires vivants et le sélecteur de mode dans le canevas.

---

### ☐ V3.1-18 — Retirer les émojis de l'interface · `S` — **fait le 1ᵉʳ octobre**

**Modèle conseillé : Sonnet** — remplacements mécaniques.

**Constat** (relevé pour V3.1-17) : des émojis en couleur, qui ne suivent ni
les jetons ni les modes et changent d'aspect selon l'appareil.

| Fichier | Émojis | Remplacement proposé |
|---|---|---|
| `components/shell/InitiativeTracker.tsx` | 🎲 (relancer l'initiative) | `DieIcon sides={20}` |
| même fichier | 🧑 ❓ 💀 devant le nom (entité, personnalisé, monstre) | trois icônes au trait du même style que `EyeIcon` |
| `components/blocks/characterCreatorSteps/SpellSelectionStep.tsx` | 👁 | `EyeIcon` |

Les glyphes de texte (`✕ ✓ ☰ ☐ ☑ ✦`, ~20 occurrences) restent : la charte §10
les autorise.

**Correction du relevé** : les trois ⚙ signalés dans les pages MJ
(Personnalisation, Publication, Règles actives) ne sont que dans des
commentaires de code (« gomme le bouton ⚙ ») — rien ne s'affiche. Le premier
relevé ignorait les lignes `//` et `*`, pas celles qui ouvrent un `/**`.

**Ce qui est fait** :
- Initiative : relancer = `DieIcon sides={20}`, avec un `aria-label` qui nomme
  le combattant. Devant le nom, `ParticipantKindIcon` (dans le même fichier :
  un seul usage, pas de composant partagé — règle des trois) : silhouette pour
  une entité du monde, point d'interrogation cerclé pour un combattant
  improvisé, crâne au trait pour un monstre. Trait 1,8, `currentColor`,
  `text-ink-muted`, `role="img"` + `title` pour en dire le sens.
- Sélection des sorts : « En savoir plus » = `EyeIcon` ouvert (▴ quand déplié,
  inchangé).
- Planche 9 du catalogue mise à jour et republiée ; charte §9 mise à jour.

**Le circuit tient** : corriger le composant, reporter les mêmes tracés dans la
planche (aucune classe nouvelle : le CSS du catalogue est resté identique, pas
besoin de le republier), mettre à jour la charte. Le README du catalogue a
suffi.

**Critères d'acceptation**
- [x] Plus aucun émoji affiché dans `components/` ni `app/` (il en reste dans des commentaires).
- [x] Les icônes nouvelles sont au trait, `currentColor`, avec un `aria-label` sur les boutons qui n'ont qu'elles.
- [x] Planche 9 (Suivi d'initiative) mise à jour, la mention « écart à la charte » retirée ; §9 de la charte mis à jour.
- [ ] À vérifier en direct : les trois icônes dans un vrai combat, aux quatre modes.

C'est le premier ticket qui suit la règle de V3.1-17 : il sert aussi à vérifier
que le circuit « corriger le composant → mettre à jour la planche → mettre à
jour la charte » tient.

---

### ☐ V3.1-19 — Refonte « verre minéral » (ticket parent) · `XL` — **lots a à h découpés (V3.1-24 à 36) ; lot i (outils du MJ) à concevoir**

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
| — | Jauges de l'initiative et du budget de rencontre | à trancher |

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
- **Générateurs — en cours (5 octobre), trois propositions** (planche
  « Propositions · Générateurs », rangée Lot i, à droite des Rencontres).
  - Ce qui existe : outils en onglets (taverne, échoppe, PNJ…), variantes
    en listes déroulantes (dont « Aléatoire »), sections tirées une à une,
    prose de l'IA en 40 / 80 / 120 mots, « Éditer les tables » en fenêtre,
    « Détails des tirages » (↻ par emplacement), menu de taverne en mise en
    page dédiée, « Créer la fiche » (promotion en entité).
  - Commun aux trois : variantes en puces, « Tout relancer », menu en deux
    colonnes (une au téléphone), marque « IA » sur les passages écrits par
    le modèle (le résultat reste de la donnée, revu avant création).
  - **A · La fiche qui se compose** : l'aperçu de la fiche à créer, chaque
    morceau tiré souligné en pointillé et relançable seul ; tables en
    panneau à droite.
  - **B · Les sections en cartes** : l'existant au style verre minéral, une
    carte par section avec « Détails des tirages » dépliable.
  - **C · Les tirages à gauche, la fiche à droite** : emplacements (dé,
    résultat, ↻) et aperçu côte à côte.
  - Téléphone du MJ : Outils › Générateurs, pilule des outils, variantes en
    feuille du bas, aperçu de la fiche, « Créer la fiche ».
  - À trancher : A, B ou C.

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

### ☐ V3.1-21 — Cibler et résoudre depuis les boutons de jet · `L` — **décidé le 4 octobre, à concevoir**

**Modèle conseillé : Opus** — résolution partagée par MJ, joueur et solo ; dés lancés par le serveur (règle 8).

**4 octobre — ADR 0036 §6** : cœur commun extrait de `playTurn` ; l'initiative en cours, c'est `combats` et ses participants ; un jet secret qui touche reste secret mais s'applique. L'outil de dés (V3.1-33) livre « Cibler » grisé, ce ticket l'allume.

**Constat.** Les boutons de jet de la fiche (touche, dégâts, sorts, soins)
lancent un dé et l'affichent ; c'est ensuite à la table de calculer et de
reporter le résultat à la main sur la cible. Le mode solo, lui, sait déjà
viser une cible du combat en cours, lire sa CA et établir le verdict
(V3-B1), puis appliquer les effets (V3-B2).

**Décision de l'auteur.** Partout dans l'application (desktop, tablette,
téléphone ; fiche, outil Table, outil Initiative) : **quand une initiative
est lancée**, un bouton de jet demande d'abord une **cible parmi les
participants**, puis tout se résout et s'applique seul — jet de touche
contre la CA, jet de sauvegarde de la cible contre le DD, dégâts (dés doublés
au critique, PV temporaires d'abord), états posés, soins, emplacement dépensé,
PJ à 0 PV → jets contre la mort, créature à 0 PV → sortie de l'initiative.
Sans initiative, rien ne change : le jet s'affiche, sans cible.

Esquissé : fiche complète (bouton « Voir hors combat / en combat ») et outil
Table (au tour du Worg, « Morsure » sur un PJ : touche, dégâts, JS de Force,
À terre).

**Revu le 4 octobre : tout passe par l'outil de dés (ADR 0035).** Un bouton de jet de la
fiche (touche, dégâts, sort, soin, caractéristique, sauvegarde, compétence,
initiative) **ouvre l'outil de dés pré-rempli** (dés, modificateur, libellé)
au lieu de lancer ; on peut encore ajouter un dé, l'avantage ou le secret, puis
on **confirme par « Lancer »**. L'outil gagne un bouton **« Cibler »** sur la
ligne de « Lancer » et « Effacer » : il liste les participants de
l'initiative (alliés pour un soin), affiche la cible retenue, et se grise hors
initiative ou pour un jet sans cible (test, sauvegarde). Une touche réussie
fait apparaître la bande « Lancer les dégâts » (V3.1-33 ; dés doublés au critique), même cible
conservée. Partout : MJ, joueur, **solo** (la barre d'intention de V3-B1 y
pré-remplit l'outil de la même façon). Avis : bonne idée — un seul endroit
pour l'avantage, le modificateur, le secret et la cible ; le coût est un
toucher de plus par jet, compensé par le pré-remplissage.

**Contraintes (règles absolues).** Les dés sont lancés par le serveur et la
résolution passe par le moteur (`resolveAttackRoll`, `resolveDamageRoll`,
`eventsForAttack`…) : le client ne calcule rien. Chaque étape est journalisée
comme en solo ; « Annuler » est une écriture inverse journalisée, pas un
effacement. L'autorisation passe par `canEditEntity` (un joueur cible avec
son PJ, le MJ avec n'importe quel participant).

**À trancher avant de coder.**
- Réutiliser telle quelle la résolution du tour solo (`playTurn`) ou en
  extraire le cœur commun — probablement la seconde : le solo ajoute
  l'interprétation et la narration, que la table n'a pas.
- Où vit « l'initiative en cours » côté multijoueur : la table `combats`
  (participants, CA) existe ; vérifier qu'elle suffit pour les PNJ sans fiche.
- Ce qui est montré au joueur ciblé et aux autres (visibilité côté serveur).

**Critères d'acceptation**
- [ ] Initiative lancée : tout bouton de jet offensif ou de soin demande une cible parmi les participants.
- [ ] Touche, sauvegarde, dégâts, états et soins résolus par le moteur et appliqués, journalisés.
- [ ] Même comportement depuis la fiche, l'outil Table et l'outil Initiative, sur tous les écrans.
- [ ] Sans initiative, les jets restent de simples jets.
- [ ] « Annuler » revient en arrière par une écriture journalisée.

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

---

### ☐ V3.1-23 — Ce que les joueurs modifient eux-mêmes (Règles actives) · `M` — **décidé le 4 octobre, à concevoir**

**Modèle conseillé : Opus** — droits d'écriture des joueurs, appliqués côté serveur ; schéma à vérifier.

**4 octobre — ADR 0036 §5, accepté par l'auteur** : colonne `table_settings jsonb` sur `campaigns`, validée par `zCampaignTableSettings`, qui porte aussi le maximum d'inspiration (1 par défaut, réglé dans Règles actives). Migration et mise à jour de `docs/SCHEMA.md` dans ce ticket.

**Constat.** Un joueur peut aujourd'hui toucher à tout ce que sa fiche affiche
en commande. À la table, certaines valeurs sont la prérogative du MJ — les
états (Charmé, À terre…) surtout, et l'inspiration — d'autres sont plus
pratiques tenues par le joueur (PV, pièces, emplacements, dés de vie).

**Décision de l'auteur.** Dans l'outil MJ **Règles actives**, une section
« **Ce que les joueurs modifient eux-mêmes** » : un interrupteur par valeur —
leurs **états**, leur **inspiration**, leurs **PV**, leurs **pièces**, leurs
**emplacements de sorts**, leurs **dés de vie**. Réglage de la campagne, valable
**partout dans l'application** : fiche sur ordinateur, tablette et téléphone,
fenêtres du MJ, tout écran où le joueur voit sa fiche.

- Par défaut : états et inspiration au MJ seul ; PV, pièces, emplacements et
  dés de vie au joueur.
- Interrupteur coupé : le joueur voit la valeur, sans commande (pas de
  « + état », pas de ▲▼ sur l'inspiration) ; le MJ la change depuis la fiche
  ou l'outil Table.
- Interrupteur allumé : le joueur la change sur sa fiche ; chaque changement
  est journalisé.
- Les changements faits par le moteur (dégâts résolus par V3.1-21, repos) ne
  dépendent pas de ces réglages.

Esquissé : planche « Téléphone du MJ — feuilles ouvertes », écran Outils →
Règles actives ; planche « Décidé · fiche vue par le MJ et par le joueur »
(zone « Fiche de personnage ») : les six interrupteurs, vivants, pilotent la
fiche de la joueuse — coupé, la commande disparaît (« + état », ▲▼ de
l'inspiration, des PV, des pièces ; colonnes « niv. » de l'égaliseur
inertes ; « Dépenser un dé » du repos court remplacé par « Le MJ dépense
tes dés de vie »).

**À vérifier avant de coder** (règles de méthode) : où vit ce réglage
(table ou colonne de campagne) et si `docs/SCHEMA.md` le prévoit — sinon
s'arrêter et demander. L'autorisation passe par le serveur (`canEditEntity`
étendu, ou une vérification à côté) : un interrupteur coupé refuse
l'écriture côté serveur, pas seulement l'affichage du bouton.

**Critères d'acceptation**
- [ ] Six interrupteurs dans Règles actives, réglage de campagne, valeurs par défaut ci-dessus.
- [ ] Interrupteur coupé : aucune commande côté joueur, et l'écriture est refusée par le serveur.
- [ ] Même comportement sur ordinateur, tablette et téléphone.
- [ ] Le MJ garde toutes les commandes, quels que soient les réglages.


---

## Tickets de la refonte « verre minéral » prêts pour Sonnet (4 octobre)

Découpage de V3.1-19, sur la base de l'ADR 0036 (données) et de l'esquisse
https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm (planches citées par leur
titre). Ordre conseillé : 24, puis 25 à 36 dans l'ordre des dépendances ;
V3.1-20 (lot g) peut partir dès que 25 est fait.

**Règles communes à ces tickets** — à relire avant d'en prendre un :
- Lire `docs/CHARTE-UI.md` et la planche du catalogue concernée **avant**
  d'écrire ; réutiliser ce qui existe ; mettre la planche à jour avec le code.
- Un écran n'est fini que s'il marche à **390 px**, à 820 px (tablette) et
  sur ordinateur, dans les quatre modes et en contraste élevé.
- Mouvement : chaque animation est sautée sous `prefers-reduced-motion`.
- Aucun calcul de règle côté client ; aucune donnée cachée envoyée au client.
- Ce qui n'est pas dans le ticket n'est pas fait : un manque trouvé en
  route s'écrit dans ce backlog, il ne s'ajoute pas au ticket.
- Fini quand `npm run typecheck && npm run lint && npm run test` passent.

### ☐ V3.1-24 — Les services de jeu sous la refonte · `M` — **prêt**

**Modèle conseillé : Sonnet** — décisions toutes prises dans l'ADR 0036 ; noyau pur, tests d'abord.

Fondation des tickets 32, 33 et 34. Aucune interface.

**À faire**
1. `src/core/rules/deathSaves.ts` (tests d'abord) : les règles 2024 de
   l'ADR 0036 §8 — Inconscient à 0 PV, mort directe si les dégâts restants
   atteignent les PV max, un échec par coup à 0 PV (deux au critique), jet
   (10+ réussit, 1 = deux échecs, 20 = 1 PV), trois réussites stabilisé,
   trois échecs mort, tout soin remet à zéro et retire Inconscient.
   `changeHp` et les dégâts résolus l'appliquent.
2. Concentration (ADR 0036 §3) : champ `concentration` dans `zRuntimeState`
   (`.default(null)`, test de relecture d'une ligne ancienne comme pour
   `inspiration`) ; `castSpell` la pose pour un sort de concentration et
   remplace la précédente ; service `breakConcentration` ; synchronisation
   avec `combat_participants.concentration` comme les états ; l'état
   `concentrating` des déclencheurs est dérivé de ce champ.
3. Monnaie et équipement (ADR 0036 §1) : services `changeCurrency`
   (delta par pièce, `depositCoins` / `spendCoins`, refus si le total ne
   suffit pas) et `setItemEquipped`. **Électrum exclu du regroupement**
   (décision du 4 octobre) : `recompose` ne forme jamais de pe ; l'électrum
   déjà détenu reste tel quel et ne se casse que si le reste ne suffit pas
   — tests d’abord dans `currency.test.ts`. Écriture du bloc `inventory` avec
   contrôle de version ; routes Zod. `InventoryPanel` les utilise à la place
   du renvoi du bloc entier.
4. Repos (ADR 0036 §7) : `takeShortRest` / `takeLongRest` émettent
   `short_rest` / `long_rest` dans `runTriggers` après leurs effets de base.
5. **PV temporaires** (vérifié le 4 octobre) : ils sont stockés (`hp.temp`,
   `combat_participants.temp_hp`) et le tour solo les entame d'abord
   (`applyDamage`, `src/core/rules/turn.ts`), mais `changeHp` (fiche) les
   ignore et aucune commande ne permet d'en donner. `changeHp` négatif passe
   par la même règle que `applyDamage` ; nouveau service `changeTempHp`
   (les PV temporaires ne se cumulent pas : en 2024, on choisit de garder
   les anciens ou de prendre les nouveaux — l'interface propose le plus
   grand par défaut).

**Critères d'acceptation**
- [ ] Les cas de jets contre la mort ci-dessus, chacun un test du noyau.
- [ ] Une fiche enregistrée avant ce ticket se relit sans `concentration` (test).
- [ ] Dépenser 3 po avec 1 pp et 0 po rend la monnaie ; dépenser plus que le total est refusé sans rien écrire.
- [ ] Ajouter 5 pa à 0 pa ne forme pas d'électrum ; 2 pe détenues restent 2 pe après un dépôt.
- [ ] Un repos long émet `long_rest` (test d'intégration avec un déclencheur factice).
- [ ] −7 PV sur 15/15 avec 5 temporaires laisse 13/15 et 0 temporaire (test).
- [ ] Aucune migration SQL.

### ☐ V3.1-25 — La pilule glissante remplace `BinderTabs` · `S` — **prêt**

**Modèle conseillé : Sonnet** — composant décidé (ADR 0034), usages listés.

**Planche** : « Décidé · accueil : tableau de bord, onglets en pilule
glissante ». **Départ** : `components/shared/BinderTabs.tsx`.

Un composant d'onglets unique : fond qui glisse sous l'onglet actif (260 ms,
sauté sous mouvement réduit), clavier (flèches, Début, Fin), rôles ARIA
`tablist` / `tab` / `tabpanel`. Il remplace `BinderTabs` partout : fiche
jouable, fiche solo, colonne Monde et coquille du solo, aperçu du créateur.
Sur téléphone, la pilule défile horizontalement si elle déborde.

**Critères d'acceptation**
- [ ] Plus aucun import de `BinderTabs` ; le fichier est supprimé.
- [ ] Clavier et lecteur d'écran : un test de composant.
- [ ] Charte §3 et planche 3 du catalogue mises à jour.

### ☐ V3.1-26 — Fiche d'ordinateur à jauges et commande E · `M` — **prêt**

**Modèle conseillé : Sonnet** — interface esquissée, services existants.

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
- [ ] Les quatre jauges et l'inspiration conformes à la planche, aux quatre modes.
- [ ] Commande E : ±1 champ vide, ±N champ rempli, champ vidé après usage.
- [ ] Un composant `CommandeE` réutilisable (il resservira en 32 et 34), avec sa planche au catalogue.

### ☐ V3.1-27 — Rail repliable et dalle Outils (lots a, b) · `M` — **prêt**

**Modèle conseillé : Sonnet** — mesures et comportements donnés par V3.1-19.

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
- [ ] Déplier / replier à la souris et au clavier ; état gardé au rechargement.
- [ ] Radio et dé utilisables rail replié.
- [ ] Planches « Pastille chrome », « Bouton de dés », « Rail du joueur » mises à jour ; planche « Rail repliable » créée.

### ☐ V3.1-28 — Tablette : la fiche s'adapte à sa fenêtre (lot f) · `S` — **prêt**

**Modèle conseillé : Sonnet** — règle simple, planche à trois largeurs.

**Planche** : « Décidé · fiche sur tablette : elle suit la largeur de sa
fenêtre (piste B) » (zone « Fiche de personnage » ; la fiche y prend, sous
~640 px, la disposition du téléphone). **Dépend de** : 26.

La fiche lit la largeur de **sa** fenêtre (requête de conteneur CSS, pas
la largeur de l'écran) : sous ~640 px, les six caractéristiques passent en
ligne au-dessus des onglets.

**Critères d'acceptation**
- [ ] La même fiche à 960, 680 et 540 px de fenêtre, conforme à la planche.
- [ ] Aucune lecture de `window.innerWidth` pour cette règle.

### ☐ V3.1-29 — Coquille téléphone : barre flottante et feuilles du bas (lot c) · `L` — **prêt**

**Modèle conseillé : Sonnet** — entrées, gabarits et comportements fixés par les planches.

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

**Critères d'acceptation**
- [ ] Les deux barres conformes aux planches à 390 px ; aucune page à défilement horizontal.
- [ ] Feuille du bas : clavier, lecteur d'écran, glisser pour fermer.
- [ ] Au-dessus de 768 px, rien ne change.
- [ ] Planche « Tiroir » remplacée par « Feuille du bas » ; planche « Barre flottante » créée.

### ☐ V3.1-30 — Wiki et Règles sur téléphone : ☰ et consultées récemment · `M` — **prêt**

**Modèle conseillé : Sonnet** — parcours esquissé ; stockage tranché (ADR 0036 §4).

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
- [ ] Le parcours accueil → fiche → retour, pour le MJ et le joueur.
- [ ] Le joueur ne reçoit jamais un passage MJ (test serveur existant toujours vert).
- [ ] Navigation privée ou stockage bloqué : la liste est vide, rien ne casse.

### ☐ V3.1-31 — Éditeur plein écran en accordéon (téléphone) · `M` — **prêt**

**Modèle conseillé : Sonnet** — option A tranchée et esquissée.

**Planche** : « Décidé · téléphone du MJ — plein écran et infobulles ».
**Dépend de** : 29.

Plein écran, barre flottante masquée, « Annuler » / « Enregistrer » en
haut. Tous les blocs dans la page, repliés en une ligne de résumé, un seul
ouvert à la fois ; poignée ⠿ pour réordonner (aussi au clavier) ; « + bloc »
en bas. Le joueur a le même éditeur, limité à ses droits (`canEditEntity`).
Les éditeurs de blocs existants sont réutilisés tels quels à l'intérieur.

**Critères d'acceptation**
- [ ] Ouvrir, modifier deux blocs, réordonner, enregistrer : une seule écriture, contrôle de version compris.
- [ ] Annuler avec des changements demande confirmation.
- [ ] Un joueur ne voit pas les blocs qu'il ne peut pas modifier.

### ☐ V3.1-32 — Fiche sur téléphone : jets, infobulles de règles, sac · `L` — **prêt**

**Modèle conseillé : Sonnet** — fiche entièrement esquissée ; services fournis par 24.

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
- [ ] La fiche de Candide de la sous-planche, reproduite à 390 px.
- [ ] Chaque type de nom ouvre la bonne règle, joueur et MJ.
- [ ] À 0 PV : jets contre la mort, puis stabilisé ou mort selon 24.

### ☐ V3.1-33 — L'outil de dés unique (feuille, panneau, scintillement) · `L` — **prêt**

**Modèle conseillé : Sonnet** — ADR 0035, ADR 0036 §6, planches précises ; la cible reste à V3.1-21.

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
- [ ] Jet avec avantage : deux d20 affichés, seul le retenu dans le total et les derniers jets.
- [ ] Le client n'envoie jamais un résultat (test de la route).
- [ ] Même outil sur téléphone, tablette et ordinateur.
- [ ] Titre : le nom du bouton touché, ou « Jet libre » ; Secret dans l'en-tête ; DD sous la grille, « DD privé » pour le MJ (le joueur lit « contre DD ? »).
- [ ] Zone de résultat toujours visible, hauteur fixe : « — » et un carré vide par dé du prochain jet avant le lancer.
- [ ] Verdict seulement contre une CA ou un DD, en remplissage de la case : vert, rouge, or au 20 naturel ; mouvement réduit : teinte sans mouvement.
- [ ] Bande « Lancer les dégâts » seulement sur une réussite suivie de dégâts ; le jet de dégâts s'applique à la cible et affiche l'effet à la place du verdict, sans remplissage.
- [ ] Monstre qui touche un joueur : « Valider · dégâts » / « Faire échouer » côté MJ.
- [ ] Bande d'après-jet (décision A du 5 octobre, V3.1-19) : sur un d20 raté de son personnage, Relancer (Inspiration héroïque), Avantage (Chanceux), + d6 (Inspiration bardique reçue) selon ce que la fiche possède ; une fois par jet ; le point est retiré côté serveur et le nouveau jet est lancé par le serveur ; rien sur une réussite.

### ☐ V3.1-34 — L'outil Table du MJ · `L` — **prêt**

**Modèle conseillé : Sonnet** — tout est esquissé ; données et règles fournies par 24.

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
- [ ] Les gestes de la planche, chacun journalisé une fois.
- [ ] Partage de 10 po entre trois PJ : 3 po chacun, le reste affiché.
- [ ] Un repos long sur trois PJ : trois résultats, trois événements `long_rest`.
- [ ] Ordinateur : la carte réutilise le composant du haut de fiche, sans le dupliquer.

### ☐ V3.1-35 — Accueil en tableau de bord (lot h) · `M` — **prêt**

**Modèle conseillé : Sonnet** — proposition 3 tranchée ; « Reprendre » rangé dans le navigateur (ADR 0036 §4).

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
- [ ] Un compte MJ dans un monde et joueur dans un autre voit les bons outils pour chacun.
- [ ] « Rejoindre une table » accepte un lien d'invitation valide et refuse un lien invalide, sans rien créer.
- [ ] « Reprendre » absent si rien n'est mémorisé.

### ☐ V3.1-36 — Le solo : ailes d'ordinateur et téléphone modèle A (lot d) · `L` — **prêt**

**Modèle conseillé : Sonnet** — planches définitives ; le moteur solo ne change pas.

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
- [ ] Un tour complet sur téléphone : intention, outil de dés, Lancer, le tour dans le fil.
- [ ] Aucun changement du moteur de tour (tests solo existants verts sans modification).

### ☐ V3.1-37 — L'initiative vue des joueurs : sécurité, invitation, temps réel · `M` — **à concevoir**

**Modèle conseillé : Opus** — RLS à resserrer, nouvelle vue filtrée pour les joueurs, signal temps réel.

**Constat (lu le 4 octobre, `20260818120001_combats.sql`).** Les politiques
de `combats` et `combat_participants` sont restées celles de la « Phase 0 » :
**tout membre du monde lit et écrit** les deux tables. Un joueur peut donc
déjà, par l'API, lire les PV et la CA des adversaires ou modifier un combat
— la règle absolue 5 n'est tenue que parce qu'aucun écran joueur ne les
affiche. À corriger avant tout écran joueur.

**À faire**
1. **RLS** (nouvelle migration) : écriture réservée au MJ de la campagne sur
   les deux tables ; lecture de `combat_participants` réservée au MJ. La
   ligne `combats` (statut, round, tour) reste lisible des membres : elle
   ne porte rien de secret et sert de signal.
2. **Vue joueur** côté serveur (`GET`, Zod) : l'ordre, le tour, le round ;
   pour chaque participant, son nom **affiché** (le renommage est le
   `label`, le nom d'origine se lit de `rule_key` ou de l'entité et ne sort
   que pour le MJ) ; PV pour les alliés, **état de blessure** calculé côté
   serveur pour les adversaires (Indemne ≥ max, Blessé > ½, En sang > 0,
   Hors de combat 0) ; jamais de CA adverse.
3. **Invitation et jets** : statut « jets d'initiative » entre préparation et
   round 1 ; un joueur dont le PJ combat lance son initiative (serveur) ou
   saisit un vrai dé, avec ou sans modificateur (même principe que
   « annoncé à la main », V3-B5) ; le MJ peut saisir à sa place ; le combat
   terminé (confirmé par le MJ) ramène la fiche normale.
4. **Temps réel** : un signal sans donnée sensible (changement de la ligne
   `combats`, ou canal de diffusion) ; le client du joueur relit la vue
   filtrée. Reprendre le mécanisme déjà utilisé par le chat
   (`ChatPanel.tsx`).
5. Vérifier `docs/SCHEMA.md` : si le statut « jets d'initiative » demande
   une valeur de plus dans le `check` de `combats.status`, c'est un
   changement de schéma — le mettre à jour dans le même ticket.

**Critères d'acceptation**
- [ ] Test d'intégration RLS : un joueur ne lit aucune ligne de `combat_participants` et n'écrit ni `combats` ni `combat_participants`.
- [ ] La vue joueur ne contient ni PV ni CA ni nom d'origine d'un adversaire (test).
- [ ] Invitation, jet du joueur, saisie du MJ, fin confirmée : chacun journalisé.

### ☐ V3.1-38 — L'outil Initiative refondu, MJ et joueur · `L` — **prêt après V3.1-37**

**Modèle conseillé : Sonnet** — planche définitive, données fournies par V3.1-37.

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
- [ ] Le parcours de la planche, de « Commencer » à la fin confirmée, avec un MJ et deux joueurs (dont un sans l'application).
- [ ] « Quitter le combat » puis « Reprendre tel quel » : ordre, PV et états intacts ; « Recommencer » relance l'initiative et renvoie l'invitation.
- [ ] Côté joueur, le mode combat garde la fiche complète (même composant que hors combat), l'ordre du tour en tête.
- [ ] Un dégât porté depuis la fiche du joueur se voit aussitôt dans l'initiative du MJ, et inversement (même état de jeu).
- [ ] À 390 px et sur ordinateur, côté MJ et côté joueur.
- [ ] Planche du catalogue « Initiative » créée ou mise à jour.

### ☐ V3.1-39 — Les sauvegardes demandées à la cible · `L` — **à concevoir**

**Modèle conseillé : Opus** — nouveau flux joueur ↔ MJ, et une donnée de règle à ajouter aux effets.

**Demande (4 octobre).** Un sort comme Moquerie cruelle ne se « lance »
pas sur la cible : c'est **la cible qui résiste** par un jet de sauvegarde.
Quand une action impose une sauvegarde, la cible reçoit une demande au
premier plan — « Résiste à Moquerie cruelle · JS Sagesse DD 13 » — avec,
comme pour l'initiative : lancer via l'application, saisir un vrai dé
(interrupteur « modificateur inclus »), ou laisser le MJ saisir la valeur.
Le résultat revient à l'outil de dés de l'auteur, qui affiche le verdict et
enchaîne les dégâts ou l'effet.

**Où le MJ répond.** En combat : dans l'outil Initiative (la demande s'y
affiche en bandeau). Hors combat : dans l'outil **Table**, qui liste déjà
les PJ — c'est la bonne place (avis : d'accord) ; une pastille sur le dé
encoché signale une demande en attente, où qu'on soit. Un PNJ ou un
monstre ciblé : le MJ lance ou saisit, comme pour l'initiative.

**Les règles exactes.** Le moteur doit vérifier la cible avant de demander
quoi que ce soit : Charme-personne ne vise qu'un humanoïde, certains effets
ignorent les créatures immunisées à un état. **Constat (lu le 4 octobre)** :
un effet (`zEffectData`, `src/core/schemas/rule-blocks/blocks.ts`) porte sa
sauvegarde (`save.ability`) ou son attaque, mais **aucune restriction de
cible** ; les types de créature existent sur les blocs de stats et les
espèces. À ajouter : un champ optionnel de restriction (types de créature,
immunités d'état), validé par Zod — pas de migration SQL (`jsonb`), mais
les fiches SRD concernées devront le recevoir. Aucun ticket existant ne le
couvre ; il complète V3.1-21 (résolution) et V3-A6 (règles à
déclencheurs).

**Dépend de** : V3.1-21, V3.1-37 (signal temps réel), V3.1-34 (Table).

**Critères d'acceptation**
- [ ] Une sauvegarde imposée à un PJ arrive à son joueur ; lancer, vrai dé ou saisie du MJ y répondent.
- [ ] Le résultat revient à l'auteur du jet ; verdict, puis dégâts ou effet appliqués.
- [ ] Une cible hors restriction (Charme-personne sur un mort-vivant) est refusée avant toute demande (test du noyau).
- [ ] Hors combat, la demande s'affiche dans l'outil Table ; en combat, dans l'Initiative.

### ☐ V3.1-40 — Ressources de classe : magie de pacte et recharge partielle · `M` — **à concevoir**

**Modèle conseillé : Opus** — deux formes de données que le moteur ne connaît pas encore.

**Constat (lu le 5 octobre).** Les ressources de classe sont génériques
(`src/core/schemas/blocks/resources.ts` : maximum en formule, recharge
`short_rest` / `long_rest` / `dawn` / `never`) et les emplacements de sorts
se dérivent de la progression de la classe (`spellcasting.ts`). Deux règles
2024 n'y entrent pas :
- **la magie de pacte** de l'occultiste : des emplacements tous du même
  niveau (5 au niveau 20), rendus au repos court, distincts des
  emplacements ordinaires (un multiclassé a les deux) ; l'Arcanum mystique
  (un sort précis par niveau 6 à 9, une fois par repos long) ;
- **la recharge partielle** : Rage, Conduit divin, Forme sauvage, Second
  souffle rendent **une** utilisation au repos court et toutes au repos long.

**À faire** : une valeur de recharge de plus (une au repos court), une
source d'incantation « pacte » dans `spellcasting`, les repos (V3.1-24) qui
les appliquent, et la ligne d'égaliseur (planche « Décidé · emplacements et
ressources de classe ») qui les affiche. Validé par Zod, sans migration SQL
(`jsonb`). Les libellés français des ressources (points de focalisation,
Ruse magique…) sont à vérifier dans le manuel de l'auteur.

**Critères d'acceptation**
- [ ] Un occultiste 20 a 4 emplacements de pacte de niveau 5, rendus au repos court ; un multiclassé garde les deux réserves séparées.
- [ ] Un repos court rend une Rage, un repos long toutes (test du noyau).
- [ ] Une ressource de plus de six utilisations s'affiche en compteur.

