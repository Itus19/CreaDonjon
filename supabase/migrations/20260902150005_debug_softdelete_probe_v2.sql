-- Diagnostic TEMPORAIRE (2e sonde) : execute le VRAI update (security
-- invoker, sous les privileges reels de l'appelant, comme le ferait
-- PostgREST) dans un bloc que l'on force a annuler (savepoint implicite
-- d'un bloc EXCEPTION), pour capturer le detail complet d'une eventuelle
-- erreur sans jamais committer de vraie suppression via cette sonde.
create or replace function public.debug_softdelete_probe(p_entity_id uuid)
returns table (ok boolean, sqlstate_ text, message_ text, detail_ text, hint_ text, context_ text)
language plpgsql security invoker as $$
declare
  v_message text;
  v_detail text;
  v_hint text;
  v_context text;
begin
  begin
    update entities set deleted_at = now() where id = p_entity_id and deleted_at is null;
    raise exception 'debug_softdelete_probe: annulation volontaire, jamais un vrai commit';
  exception
    when others then
      get stacked diagnostics v_message = message_text, v_detail = pg_exception_detail, v_hint = pg_exception_hint, v_context = pg_exception_context;
      if sqlstate = 'P0001' then
        return query select true, null::text, null::text, null::text, null::text, null::text;
      else
        return query select false, sqlstate::text, v_message, v_detail, v_hint, v_context;
      end if;
  end;
end;
$$;

grant execute on function public.debug_softdelete_probe(uuid) to authenticated;
