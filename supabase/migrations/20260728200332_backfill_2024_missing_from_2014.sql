-- Le SRD 2024 importe (srd-2024.json) ne contient aucune entree pour
-- 'spells', 'rule-sections' et 'rules' (absents du fichier source
-- lui-meme, pas un bug d'import - voir migration precedente). Comme
-- les regles 2024 sont une revision de 2014 et pas un jeu separe, ces
-- categories n'ont pas ete retravaillees : on copie le contenu 2014
-- correspondant dans le ruleset 2024 pour que les mondes 2024 ne
-- se retrouvent pas avec des categories vides sans raison de jeu.
--
-- Volontairement exclu de cette copie : 'races'/'subraces' (2014).
-- Le 2024 a deja 'species'/'subspecies' qui couvrent le meme terrain
-- avec la terminologie/le contenu mis a jour ; copier les anciennes
-- races cote a cote creerait des doublons/incoherences plutot que de
-- combler un vrai trou.

insert into ruleset_entries (ruleset_id, entry_type, human_readable, structured_data)
select
  '336a0121-bb51-47b7-8125-a40673d53a77', -- D&D 2024 SRD
  entry_type,
  human_readable,
  structured_data
from ruleset_entries
where ruleset_id = '8c788102-6d8c-42ab-bd56-31a7cfe3e272' -- D&D 2014 SRD
  and entry_type in ('spells', 'rule-sections', 'rules');
