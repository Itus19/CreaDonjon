# Lot D — L'interface solo

*Réécrit le 22 septembre, d'après l'esquisse jouable. Les six tickets qui suivent ne décrivent plus une intention : ils décrivent un écran qui a été dessiné, ouvert, cliqué et corrigé sept fois avec l'auteur.*

## Le dessin

**L'esquisse fait foi**, pas cet art ASCII : `components/solo/esquisse/` et la route `/m/[worldSlug]/joueur/solo/esquisse`. Ce schéma n'en est qu'un rappel. Elle devait partir avec D1 ; elle est restée jusqu'à D6 parce qu'elle documentait aussi les cinq tickets suivants. **D6 fait le 26 septembre : la condition d'origine est levée, mais l'auteur la garde** comme référence visuelle jusqu'à la fin de la V3 (26 septembre) — à supprimer à ce moment-là, pas avant.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Monde │ Port-Valdor · L'Ancre Rouillée · salle commune                 │
│         │        Mercredi 12 juillet  22:15  Pluie · 14 °C  ♪   Fiche ›  │
├────────────────┬───────────────────────────────┬────────────────────────┤
│ Wiki Quêtes    │  Tu pousses la porte. La      │ Naivara Amakiir [à terre]│
│ Présents Règles│  salle sent la bière…       ▪ │ Elfe · Roublarde 4 ·    │
│                │                               │ Criminelle · 127 ans    │
│ LIEUX          │        je cherche le comptoir │ [14] ◕11/17 ◔2900 ○0/6 │
│ Port-Valdor ◆  │                               │  CA   PV    Niv.4  Épuis│
│ L'Ancre R.  ◆  │  JET DEMANDÉ Perception · DD 12│ VIT 9 m · MAÎT +2 · ✦   │
│ L'entrepôt  ◇  │  ┌───────────────────────────┐│                         │
│                │  │PERCEPTION 16 ✓ · fiche    ││ ┌FOR┐┌DEX┐┌CON┐        │
│ PERSONNES      │  └───────────────────────────┘│ └+0─┘└+3─┘└+1─┘        │
│ Bram        ◆  │  Derrière le comptoir…      ~ │ ▸ COMPÉTENCES           │
│ L'elfe      ○  │                               │ Actions Sac Magie       │
│                │  ┌───────────────────────────┐│ Traits Maîtrises        │
│ ◆ connu        │  │ Sauvegarde de Dex DD 13 — ││ ┌────────────────────┐  │
│ ○ esquisse     │  │ lance depuis ta fiche…    ││ │ Épée longue        │  │
│ ◇ mentionné    │  └───────────────────────────┘│ │ +5 · 1d8+3         │  │
│                │  [ Jouer ] [ MJ ]             │ │ [attaquer][dégâts] │  │
└────────────────┴───────────────────────────────┴────────────────────────┘
```

**Huit passes avec l'auteur**, et ce que chacune a tranché :

| Ce qui a changé | Pourquoi |
|---|---|
| Fil **compact**, trace du jet dépliable | Ce qui encombre n'est pas l'interligne, c'est la trace |
| Onglets **en classeur** (`BinderTabs`) | Ceux de la fiche jouable — jamais une troisième présentation |
| **Le moteur demande, il ne lance pas** | C'est le déroulé d'une vraie table (voir V3-B5) |
| **Un seul champ** pour écrire et pour les jets | Un résultat se voit là où part tout le reste |
| **Deux boutons**, `Jouer` et `MJ` | Seul `Jouer` fait avancer l'horloge |
| Repli **depuis le bandeau**, boutons toujours visibles | La commande ne se déplace jamais |
| Colonnes **sans fond**, encadrés fins | Le haut de la fiche, qui ne pèse rien |
| **Une rangée unique** : bouclier de CA, trois anneaux, trois faits | Une barre coûte sa hauteur *plus* sa légende ; l'anneau porte son chiffre au centre, et la légende disparaît |

**Deux corrections à des tickets déjà écrits**, nées de l'esquisse :

- **L'adresse de D1 change.** Le ticket d'origine plaçait l'écran hors de la coquille joueur ; l'auteur veut la barre latérale et ses outils. L'écran solo est **une destination de `PlayerShell`**, sous `joueur/`, comme l'écran minimal de V3-B1.
- **La résolution de V3-B1 est dépassée.** « Lancer » résolvait le jet dans la foulée. Le vrai déroulé passe par une demande, puis une réponse — c'est **V3-B5**, ci-dessus dans le lot B. D1 à D6 le supposent fait.

*Partie du backlog V3. L'index, la feuille de route et la table de tous les tickets : [`docs/BACKLOG_V3.md`](../BACKLOG_V3.md). Le cadre commun (ce que S1 a changé, critères transverses) : [`00-cadre.md`](00-cadre.md).*

**Terminés** (dans [`termines.md`](termines.md)) : V3-D1, V3-D2, V3-D3, V3-D4, V3-D5, V3-D6.

**Aucun ticket ouvert dans ce lot.** Son introduction reste ici : c'est la référence de conception de ses tickets terminés.
