-- CASE expressions made from string literals resolve to text. Cast the
-- selected processing job explicitly so photo and video finalisation can
-- insert into the processing_job_type enum column.

do $$
declare
  v_signature text;
  v_function regprocedure;
  v_definition text;
  v_uncast_expression constant text :=
    'case when v_item.media_type = ''video'' then ''generate_video_poster'' else ''generate_image_variants'' end';
  v_cast_expression constant text :=
    '(case when v_item.media_type = ''video'' then ''generate_video_poster'' else ''generate_image_variants'' end)::public.processing_job_type';
begin
  foreach v_signature in array array[
    'public.finalize_guest_media_upload(uuid,text,bigint,text,integer,integer,integer,text,text)',
    'public.finalize_host_media_upload(uuid,bigint,text,integer,integer,integer,text,text)'
  ] loop
    v_function := to_regprocedure(v_signature);

    if v_function is null then
      raise exception 'upload finalisation function not found: %', v_signature;
    end if;

    select pg_get_functiondef(v_function::oid) into v_definition;

    if position(v_cast_expression in v_definition) > 0 then
      continue;
    end if;

    if position(v_uncast_expression in v_definition) = 0 then
      raise exception 'expected processing job expression not found in: %', v_signature;
    end if;

    execute replace(v_definition, v_uncast_expression, v_cast_expression);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
