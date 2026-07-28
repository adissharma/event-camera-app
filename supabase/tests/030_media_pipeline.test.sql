-- Media pipeline failure matrix (brief §23).
--
-- Every case here is a way a guest's photograph gets lost, duplicated, or
-- uploaded somewhere it should not be. They are asserted against a real
-- database because the enforcement lives in SQL, not in the client.

begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'media-host@test.local', '', now(), now(), now());

create temporary table fx as
select w.id as workspace_id
from public.workspaces w
join public.workspace_members wm on wm.workspace_id = w.id
where wm.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
limit 1;

insert into public.celebrations (id, workspace_id, created_by, title, public_slug, status)
values ('bbbbbbbb-0000-0000-0000-000000000001', (select workspace_id from fx),
        'aaaaaaaa-0000-0000-0000-000000000001', 'Media Fixture',
        encode(extensions.gen_random_bytes(16), 'hex'), 'published');

-- An open event, and a second one used for the cross-event test.
insert into public.event_sessions (
  id, celebration_id, name, sequence_number, status, ends_at,
  reveal_mode, shot_limit_per_guest, capture_mode
)
values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Open Session', 1, 'published', now() + interval '2 hours', 'instant', 3, 'camera_and_library'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Other Session', 2, 'published', now() + interval '2 hours', 'instant', 10, 'camera_and_library'),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Closed Session', 3, 'closed', now() - interval '1 hour', 'instant', 10, 'camera_and_library');

insert into public.access_links (id, event_session_id, kind, token_hash, is_active)
values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'guest', private.digest_token('open-token'), true),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002',
   'guest', private.digest_token('other-token'), true),
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003',
   'guest', private.digest_token('closed-token'), true),
  ('dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001',
   'guest', private.digest_token('revoked-token'), false),
  ('dddddddd-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000001',
   'guest', private.digest_token('expired-token'), true);

update public.access_links set expires_at = now() - interval '1 minute'
where id = 'dddddddd-0000-0000-0000-000000000005';

-- ---------------------------------------------------------------------------
-- Guest join
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.join_event_session('open-token', 'Guest One', null, 'device-one')$$,
  'a guest with a valid token can join'
);

select throws_ok(
  $$select public.join_event_session('not-a-real-token')$$,
  '42501', null,
  'an unknown access token is refused'
);

select throws_ok(
  $$select public.join_event_session('revoked-token')$$,
  '42501', null,
  'a revoked access link is refused'
);

select throws_ok(
  $$select public.join_event_session('expired-token')$$,
  '42501', null,
  'an expired access link is refused'
);

-- A returning guest keeps their identity, so their shot count survives a reload.
create temporary table g1 as
select * from public.join_event_session('open-token', null, null, 'device-one');

select is(
  (select count(distinct id)::int from public.guest_sessions
   where event_session_id = 'cccccccc-0000-0000-0000-000000000001'),
  1,
  'rejoining with the same device reuses the guest session rather than creating a second'
);

-- ---------------------------------------------------------------------------
-- Upload intent — idempotency
-- ---------------------------------------------------------------------------

create temporary table t_guest as
select guest_session_id, guest_token from g1;

create temporary table i1 as
select * from public.create_media_upload_intent(
  'cccccccc-0000-0000-0000-000000000001',
  '11111111-aaaa-0000-0000-000000000001',
  'photo', 'camera', 'image/jpeg', 1024,
  (select guest_token from t_guest)
);

select isnt((select media_item_id from i1), null, 'an upload intent creates a media item');
select is((select is_existing from i1), false, 'the first intent reports a new media item');

select is(
  (select bucket from i1), 'event-media',
  'the intent targets the private event-media bucket'
);

select ok(
  (select storage_path from i1) like (select workspace_id from fx) || '/%',
  'the storage path begins with the workspace id, which is what storage policies authorise on'
);

-- The central idempotency property.
create temporary table i2 as
select * from public.create_media_upload_intent(
  'cccccccc-0000-0000-0000-000000000001',
  '11111111-aaaa-0000-0000-000000000001',
  'photo', 'camera', 'image/jpeg', 1024,
  (select guest_token from t_guest)
);

select is(
  (select media_item_id from i2), (select media_item_id from i1),
  'a duplicate intent returns the SAME media item — a retry never duplicates a photograph'
);

select is(
  (select upload_intent_id from i2), (select upload_intent_id from i1),
  'a duplicate intent reuses the live authorisation rather than minting a second'
);

select is((select is_existing from i2), true, 'the repeat intent reports an existing item');

select is(
  (select count(*)::int from public.media_items
   where event_session_id = 'cccccccc-0000-0000-0000-000000000001'),
  1,
  'only one media row exists after two intent requests'
);

-- ---------------------------------------------------------------------------
-- Upload intent — rejection cases
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000001', gen_random_uuid(),
    'photo', 'camera', 'application/x-msdownload', 1024, %L)$$,
    (select guest_token from t_guest)),
  '22023', null,
  'an unsupported MIME type is refused'
);

select throws_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000001', gen_random_uuid(),
    'photo', 'camera', 'image/jpeg', 999999999999, %L)$$,
    (select guest_token from t_guest)),
  '22023', null,
  'an excessively large file is refused'
);

select throws_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000001', gen_random_uuid(),
    'photo', 'camera', 'image/jpeg', 0, %L)$$,
    (select guest_token from t_guest)),
  '22023', null,
  'a zero-byte file is refused'
);

select throws_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000001', gen_random_uuid(),
    'video', 'camera', 'video/mp4', 1024, %L)$$,
    (select guest_token from t_guest)),
  '42501', null,
  'a media type the event does not permit is refused'
);

-- CROSS-EVENT: a valid token for event A must not upload to event B.
select throws_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000002', gen_random_uuid(),
    'photo', 'camera', 'image/jpeg', 1024, %L)$$,
    (select guest_token from t_guest)),
  '42501', null,
  'a guest token for one event cannot upload to another event'
);

select throws_ok(
  $$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000001', gen_random_uuid(),
    'photo', 'camera', 'image/jpeg', 1024, 'forged-guest-token')$$,
  '42501', null,
  'a forged guest token is refused'
);

-- UPLOAD AFTER CLOSE.
create temporary table gclosed as
select * from public.join_event_session('closed-token', null, null, 'device-closed');

select throws_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000003', gen_random_uuid(),
    'photo', 'camera', 'image/jpeg', 1024, %L)$$,
    (select guest_token from gclosed)),
  '42501', null,
  'live capture is refused once the event has closed'
);

-- ...but the host allowed camera-roll uploads after closing, so those continue.
select lives_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000003', gen_random_uuid(),
    'photo', 'library', 'image/jpeg', 1024, %L)$$,
    (select guest_token from gclosed)),
  'camera-roll uploads still succeed after close when the host allowed them'
);

-- SHOT LIMIT. The open session allows 3; one is already used.
select lives_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000001', gen_random_uuid(),
    'photo', 'camera', 'image/jpeg', 1024, %L)$$,
    (select guest_token from t_guest)),
  'a guest under the shot limit may contribute'
);

select lives_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000001', gen_random_uuid(),
    'photo', 'camera', 'image/jpeg', 1024, %L)$$,
    (select guest_token from t_guest)),
  'the guest reaches exactly the shot limit'
);

select throws_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000001', gen_random_uuid(),
    'photo', 'camera', 'image/jpeg', 1024, %L)$$,
    (select guest_token from t_guest)),
  '53400', null,
  'exceeding the shot limit is refused'
);

-- A retry of an EXISTING item must not be blocked by the limit it already counts
-- toward — otherwise a guest whose last upload fails can never retry it.
select lives_ok(
  format($$select public.create_media_upload_intent(
    'cccccccc-0000-0000-0000-000000000001',
    '11111111-aaaa-0000-0000-000000000001',
    'photo', 'camera', 'image/jpeg', 1024, %L)$$,
    (select guest_token from t_guest)),
  'retrying an existing upload still works at the shot limit'
);

-- ---------------------------------------------------------------------------
-- Finalisation
-- ---------------------------------------------------------------------------

select lives_ok(
  format($$select public.finalise_media_upload(%L, %L, 1024, null, null, %L)$$,
    (select media_item_id from i1), (select upload_intent_id from i1),
    (select guest_token from t_guest)),
  'a well-formed upload finalises'
);

select is(
  (select status::text from public.media_items where id = (select media_item_id from i1)),
  'verifying',
  'finalisation moves the item to verifying — never straight to ready'
);

select is(
  (select count(*)::int from public.processing_jobs
   where media_item_id = (select media_item_id from i1)),
  4,
  'finalisation enqueues the processing pipeline'
);

-- DUPLICATE FINALISATION. A client that loses the response and retries must not
-- double-enqueue work or reset progress.
select lives_ok(
  format($$select public.finalise_media_upload(%L, %L, 1024, null, null, %L)$$,
    (select media_item_id from i1), (select upload_intent_id from i1),
    (select guest_token from t_guest)),
  'finalising twice is a no-op rather than an error'
);

select is(
  (select count(*)::int from public.processing_jobs
   where media_item_id = (select media_item_id from i1)),
  4,
  'a duplicate finalisation does not enqueue the work twice'
);

select * from finish();

rollback;
