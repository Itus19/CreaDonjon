-- V1-D7 : une ligne de ruleset_entry_translations peut desormais melanger un
-- bloc traduit fidelement depuis le SRD (ex. `background`, valeurs de
-- caracteristique/don/equipement) et un bloc de lore invente (ex.
-- `description` d'un historique, cf. CLAUDE.md "je vois trois blocs a
-- chaque fois... la description qui est un peu le lore"). Etiqueter toute
-- la ligne 'official_srd' serait faux pour ce second bloc : ce n'est pas du
-- contenu SRD, l'attribution CC-BY-4.0 ne le couvre pas (CLAUDE.md, rappel
-- juridique). Nouvelle valeur dediee plutot que de detourner 'user' (qui
-- designe le contenu qu'un MJ ecrit dans SA PROPRE variante, pas le lore
-- d'habillage de la base officielle) ou 'machine' (reserve au script de
-- traduction automatique brute, V1-A2).
alter table ruleset_entry_translations
  drop constraint ruleset_entry_translations_source_check;

alter table ruleset_entry_translations
  add constraint ruleset_entry_translations_source_check
  check (source in ('official_srd', 'community', 'machine', 'user', 'invented_lore'));
