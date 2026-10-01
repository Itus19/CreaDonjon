# Backlog V3.1 — Rugosités trouvées en jouant

**Version :** 1.0 — 27 septembre 2026

Différent de V2 et V3 : pas de lots planifiés à l'avance, pas de découpage en
phases. Ce backlog recueille les petites corrections trouvées **au fil de
l'utilisation réelle** de l'outil — un formulaire qui coince sur un cas
concret, un avertissement qui ment, un détail qui gêne à la table. Un ticket
s'y ajoute quand quelque chose de ce genre est constaté, pas quand il est
planifié. Taille attendue : `S` ou `M` presque toujours — si un ticket ici
grossit au point de devenir un vrai chantier, il migre vers V2 ou V3.

---

### V3.1-1 — `REQUIRED_BLOCKS` trop strict sur les sorts sans effet chiffré · `S`

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

### V3.1-2 — Aucun moyen d'éditer une fiche maison déjà créée · `M`

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

### V3.1-3 — Les dons à choix (Initié à la magie, etc.) n'ont aucune UI de choix · `L`

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

### V3.1-4 — Un trait d'espèce qui accorde une maîtrise au choix ne l'accorde jamais · `S`/`M`

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

### V3.1-5 — Le Repos long ne déclenche aucun effet lié aux traits (Inspiration héroïque, etc.) · `M`

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

### V3.1-6 — Aucun mécanisme générique pour les traits d'espèce à choix · `L`

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

### V3.1-7 — Une sous-classe n'apporte jamais d'effet mécanique, choix ou pas · `L`

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

### V3.1-8 — Aucune demande structurée de disponibilités pour la prochaine séance · `L` — fait

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

### V3.1-9 — Bouton « Prochaine session » mal calibré selon l'écran · `S`/`M` — fait

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

### V3.1-10 — Connexion par identifiant/mot de passe plutôt que lien à retrouver · `L` — fait

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

### V3.1-11 — Onglet « Solo » visible même avec un MJ humain déjà présent · `S` — fait

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

### V3.1-12 — « Voir comme » accessible aux MJ de campagne, pas seulement au superadmin · `M`

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

### V3.1-13 — Sous-classes manquantes pour les classes des 4 joueuses actives · `M`

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

### V3.1-14 — Aucun moyen pour une joueuse de créer elle-même son PJ sans personnage déjà assigné · `M`

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

### V3.1-15 — La Gestion de campagne illisible : invitations en haut, une carte par personne · `M` — **codé le 1ᵉʳ octobre, à vérifier en direct**

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

### V3.1-16 — Le Calendrier réel refait : une grille à bascule, côté MJ comme côté joueuse · `M`/`L` — **codé le 1ᵉʳ octobre, à vérifier en direct**

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

### V3.1-17 — Un catalogue d'interface visuel, et une charte qui y renvoie · `M` — **fait le 1ᵉʳ octobre**

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

### V3.1-18 — Retirer les émojis de l'interface · `S`

**Constat** (relevé pour V3.1-17) : des émojis en couleur, qui ne suivent ni
les jetons ni les modes et changent d'aspect selon l'appareil.

| Fichier | Émojis | Remplacement proposé |
|---|---|---|
| `components/shell/InitiativeTracker.tsx` | 🎲 (relancer l'initiative) | `DieIcon sides={20}` |
| même fichier | 🧑 ❓ 💀 devant le nom (entité, personnalisé, monstre) | trois icônes au trait du même style que `EyeIcon` |
| `components/blocks/characterCreatorSteps/SpellSelectionStep.tsx` | 👁 | `EyeIcon` |
| `app/m/[worldSlug]/mj/personnalisation/page.tsx`, `publication/page.tsx`, `regles-actives/page.tsx` | ⚙ | icône d'engrenage au trait |

Les glyphes de texte (`✕ ✓ ☰ ☐ ☑ ✦`, ~20 occurrences) restent : la charte §10
les autorise.

**Critères d'acceptation**
- [ ] Plus aucun émoji dans `components/` ni `app/` (hors esquisses et commentaires).
- [ ] Les icônes nouvelles sont au trait, `currentColor`, avec un `aria-label` sur les boutons qui n'ont qu'elles.
- [ ] Planche 9 (Suivi d'initiative) mise à jour, la mention « écart à la charte » retirée ; §9 de la charte mis à jour.

C'est le premier ticket qui suit la règle de V3.1-17 : il sert aussi à vérifier
que le circuit « corriger le composant → mettre à jour la planche → mettre à
jour la charte » tient.

---

### V3.1-19 — Refonte « verre minéral » : rail repliable, outils intégrés, ailes du solo · `L` — **à découper**

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
- Les jauges de la bande repliée : `JaugeCirculaire` existe déjà
  (`FicheJouableEnTete.tsx`), contrairement à ce que dit l'esquisse. Mais la CA
  n'a pas de maximum (d'où le bouclier) : la bande garde-t-elle le bouclier ?
- Étendre les jauges circulaires à toutes les barres de progression (piste
  ouverte par l'auteur) : décision de DA à prendre ici ou à part.

**Découpage proposé** : (a) rail repliable MJ + joueur desktop/tablette ;
(b) dalle Outils (dés + radio) ; (c) téléphone ; (d) ailes du solo. Chacun met
à jour ses planches (Pastille chrome, Tiroir, Bouton de dés, Rail du joueur, et
une planche « Rail repliable » à créer).
