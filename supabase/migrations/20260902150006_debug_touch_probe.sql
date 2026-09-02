-- Diagnostic TEMPORAIRE (3e sonde) : meme mecanique que la 2e sonde, mais
-- modifie une colonne SANS RAPPORT avec deleted_at (juste touche
-- updated_at) -- pour savoir si le probleme est specifique a deleted_at ou
-- si TOUTE ecriture sur entities via ce chemin echoue.
create or replace function public.debug_touch_probe(p_entity_id uuid)
returns table (ok boolean, sqlstate_ text, message_ text)
language plpgsql security invoker as $$
begin
  begin
    update entities set updated_at = now() where id = p_entity_id;
    raise exception 'debug_touch_probe: annulation volontaire';
  exception
    when others then
      if sqlstate = 'P0001' then
        return query select true, null::text, null::text;
      else
        return query select false, sqlstate::text, SQLERRM;
      end if;
  end;
end;
$$;

grant execute on function public.debug_touch_probe(uuid) to authenticated;
