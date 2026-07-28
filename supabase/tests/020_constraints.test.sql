-- Schema-level guarantees.
--
-- These assert invariants the application must be able to rely on, so that a
-- bug in client code cannot produce impossible data.

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'constraints@example.com', '', now(), now(), now());

create temporary table t as
select
  w.id as workspace_id
from public.workspaces w
join public.workspace_members wm on wm.workspace_id = w.id
where wm.user_id = '44444444-4444-4444-4444-444444444444'
limit 1;

insert into public.celebrations (id, workspace_id, created_by, title, public_slug)
values (
  '55555555-5555-5555-5555-555555555555',
  (select workspace_id from t),
  '44444444-4444-4444-4444-444444444444',
  'Constraint Fixture',
  encode(extensions.gen_random_bytes(16), 'hex')
);

insert into public.event_sessions (id, celebration_id, name, sequence_number, reveal_mode)
values
  ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555', 'Session One', 1, 'instant'),
  ('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'Session Two', 2, 'instant');

-- ---------------------------------------------------------------------------
-- Reveal configuration
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.event_sessions (celebration_id, name, sequence_number, reveal_mode)
    values ('55555555-5555-5555-5555-555555555555', 'Bad Reveal', 3, 'scheduled')$$,
  '23514',
  null,
  'a scheduled reveal without a time is rejected'
);

select throws_ok(
  $$insert into public.event_sessions (celebration_id, name, sequence_number, reveal_mode, reveal_at)
    values ('55555555-5555-5555-5555-555555555555', 'Bad Reveal 2', 4, 'manual', now())$$,
  '23514',
  null,
  'a manual reveal carrying a time is rejected'
);

-- ---------------------------------------------------------------------------
-- Session sequencing
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.event_sessions (celebration_id, name, sequence_number, reveal_mode)
    values ('55555555-5555-5555-5555-555555555555', 'Duplicate Sequence', 1, 'instant')$$,
  '23505',
  null,
  'two live sessions cannot share a sequence number'
);

select throws_ok(
  $$insert into public.event_sessions (celebration_id, name, sequence_number, reveal_mode)
    values ('55555555-5555-5555-5555-555555555555', 'Zero Sequence', 0, 'instant')$$,
  '23514',
  null,
  'a sequence number below 1 is rejected'
);

-- ---------------------------------------------------------------------------
-- Media idempotency and cross-event isolation
-- ---------------------------------------------------------------------------

insert into public.media_items (event_session_id, client_media_id, media_type, source)
values ('66666666-6666-6666-6666-666666666666', '88888888-8888-8888-8888-888888888888', 'photo', 'camera');

select throws_ok(
  $$insert into public.media_items (event_session_id, client_media_id, media_type, source)
    values ('66666666-6666-6666-6666-666666666666', '88888888-8888-8888-8888-888888888888', 'photo', 'camera')$$,
  '23505',
  null,
  'the same client_media_id cannot create a second row in one session — this is what makes upload retries idempotent'
);

select lives_ok(
  $$insert into public.media_items (event_session_id, client_media_id, media_type, source)
    values ('77777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888', 'photo', 'camera')$$,
  'the same client id in a different session is a genuinely different contribution and is allowed'
);

-- ---------------------------------------------------------------------------
-- Media integrity
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.media_items (event_session_id, client_media_id, file_size_bytes)
    values ('66666666-6666-6666-6666-666666666666', gen_random_uuid(), 0)$$,
  '23514',
  null,
  'a zero-byte media item is rejected'
);

select throws_ok(
  $$insert into public.media_items (event_session_id, client_media_id, checksum_algorithm)
    values ('66666666-6666-6666-6666-666666666666', gen_random_uuid(), 'sha256')$$,
  '23514',
  null,
  'a checksum algorithm without a value is rejected'
);

-- ---------------------------------------------------------------------------
-- Variants
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    $$insert into public.media_variants (media_item_id, variant_type, storage_path)
      values (%L, 'thumbnail', 'a/b/c'), (%L, 'thumbnail', 'a/b/d')$$,
    (select id from public.media_items where client_media_id = '88888888-8888-8888-8888-888888888888' limit 1),
    (select id from public.media_items where client_media_id = '88888888-8888-8888-8888-888888888888' limit 1)
  ),
  '23505',
  null,
  'a media item cannot have two variants of the same type'
);

-- ---------------------------------------------------------------------------
-- Secrets are digests
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.access_links (event_session_id, token_hash)
    values ('66666666-6666-6666-6666-666666666666', '\x0102'::bytea)$$,
  '23514',
  null,
  'an access link token that is not a 32-byte digest is rejected'
);

-- ---------------------------------------------------------------------------
-- Slug entropy
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    $$insert into public.celebrations (workspace_id, created_by, title, public_slug)
      values (%L, '44444444-4444-4444-4444-444444444444', 'Short Slug', 'abc')$$,
    (select workspace_id from t)
  ),
  '23514',
  null,
  'a short, guessable public slug is rejected'
);

select * from finish();

rollback;
