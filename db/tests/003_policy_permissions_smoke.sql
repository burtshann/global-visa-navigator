BEGIN;

CREATE ROLE gvn_smoke_reader IN ROLE gvn_policy_reader;
CREATE ROLE gvn_smoke_stager IN ROLE gvn_policy_stager, gvn_policy_reviewer;
CREATE ROLE gvn_smoke_reviewer IN ROLE gvn_policy_reviewer;
CREATE ROLE gvn_smoke_other;

DO $$
BEGIN
  IF has_function_privilege('gvn_smoke_other', 'public.gvn_stage_policy(jsonb,jsonb,jsonb,text,text,text)', 'EXECUTE')
    OR has_function_privilege('gvn_smoke_other', 'public.gvn_review_policy(text,bigint,text,text)', 'EXECUTE')
    OR has_function_privilege('gvn_policy_stager', 'public.gvn_review_policy(text,bigint,text,text)', 'EXECUTE')
    OR has_function_privilege('gvn_policy_reviewer', 'public.gvn_stage_policy(jsonb,jsonb,jsonb,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Policy commands must be restricted to dedicated roles';
  END IF;
END;
$$;

INSERT INTO public.country VALUES ('XZ', 'Fixture', '测试', 'https://example.test');
INSERT INTO public.visa_route
VALUES ('fixture-permissions', 'XZ', 'job-search', 'Fixture', '测试', 'Fixture', '测试', 'https://example.test');
INSERT INTO public.policy_version
  (route_id, policy_key, version, stage, scope_en, scope_zh, git_revision, snapshot_sha256, rule_snapshot,
   review_status, reviewed_at, reviewed_by, review_reference)
VALUES ('fixture-permissions', 'legacy-fixture', '1', 'application', 'Fixture', '测试', repeat('a', 40), repeat('b', 64),
        '{"id":"legacy-fixture","version":"1","stage":"application"}', 'approved', CURRENT_TIMESTAMP,
        'caller-supplied', 'legacy-reference');

SET SESSION AUTHORIZATION gvn_smoke_stager;
SELECT set_config('gvn.smoke_id', id::text, true)
FROM public.gvn_stage_policy(
  '{"id":"XZ","name":{"en":"Fixture","zh":"测试"},"officialUrl":"https://example.test"}',
  '{"id":"fixture-permissions","countryId":"XZ","category":"job-search","name":{"en":"Fixture","zh":"测试"},
     "description":{"en":"Fixture","zh":"测试"},"officialUrl":"https://example.test"}',
  '{"id":"fixture-permissions","version":"1","stage":"application","conditions":[{
     "id":"fixture-condition","input":"answer:fixture","operator":"eq","expected":true,
     "label":{"en":"Fixture","zh":"测试"},"nextStep":{"en":"Fixture","zh":"测试"},
     "source":{"url":"https://example.test/rule","applicableWhen":{"en":"Fixture","zh":"测试"},
       "effectiveFrom":"2026-01-01","lastVerifiedAt":"2026-11-23","reviewStatus":"verified"}}]}',
  repeat('a', 40), repeat('c', 64), 'staging-evidence');

DO $$
BEGIN
  IF (SELECT staged_by FROM public.gvn_policy_review_queue WHERE id = current_setting('gvn.smoke_id')::bigint)
      IS DISTINCT FROM SESSION_USER THEN
    RAISE EXCEPTION 'Unexpected staging actor';
  END IF;
  BEGIN
    PERFORM public.gvn_review_policy('approve', current_setting('gvn.smoke_id')::bigint, repeat('c', 64), 'self');
    RAISE EXCEPTION 'Expected self-approval to be rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.policy_publication_event (policy_version_id, to_status, reviewer, actor_role, review_reference)
      VALUES (current_setting('gvn.smoke_id')::bigint, 'pending', 'spoof', 'spoof', 'spoof');
    RAISE EXCEPTION 'Expected direct audit writes to be rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET SESSION AUTHORIZATION;

ALTER ROLE gvn_smoke_stager RENAME TO gvn_smoke_stager_renamed;
SET SESSION AUTHORIZATION gvn_smoke_stager_renamed;
DO $$
BEGIN
  BEGIN
    PERFORM public.gvn_review_policy('approve', current_setting('gvn.smoke_id')::bigint, repeat('c', 64), 'self-renamed');
    RAISE EXCEPTION 'Renaming an account must not allow self-approval';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION gvn_smoke_reader;
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.gvn_approved_policy_snapshot WHERE route_id = 'fixture-permissions') THEN
    RAISE EXCEPTION 'The reader can see pending or legacy snapshots';
  END IF;
  BEGIN
    PERFORM id FROM public.gvn_policy_review_queue;
    RAISE EXCEPTION 'Expected reviewer queue access to be rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.policy_version SET review_status = 'approved' WHERE id = current_setting('gvn.smoke_id')::bigint;
    RAISE EXCEPTION 'Expected a reader policy update to be rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION gvn_smoke_reviewer;
DO $$
BEGIN
  BEGIN
    UPDATE public.policy_version SET review_status = 'approved' WHERE id = current_setting('gvn.smoke_id')::bigint;
    RAISE EXCEPTION 'Expected a reviewer direct table update to be rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
SELECT (public.gvn_review_policy('approve', current_setting('gvn.smoke_id')::bigint, repeat('c', 64), 'review-evidence')).review_status;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION gvn_smoke_reader;
DO $$
BEGIN
  IF (SELECT array_agg(policy_key ORDER BY policy_key) FROM public.gvn_approved_policy_snapshot
      WHERE route_id = 'fixture-permissions') IS DISTINCT FROM ARRAY['fixture-permissions'] THEN
    RAISE EXCEPTION 'Reader should see the independently approved version only';
  END IF;
END;
$$;
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION gvn_smoke_reviewer;
SELECT (public.gvn_review_policy('withdraw', current_setting('gvn.smoke_id')::bigint, repeat('c', 64), 'withdrawal-evidence')).review_status;
RESET SESSION AUTHORIZATION;

DO $$
BEGIN
  IF EXISTS (SELECT FROM public.gvn_approved_policy_snapshot WHERE route_id = 'fixture-permissions') THEN
    RAISE EXCEPTION 'The withdrawn version remains visible';
  END IF;
  IF (SELECT array_agg(actor_role::text || ':' || to_status ORDER BY id) FROM public.policy_publication_event
      WHERE policy_version_id = current_setting('gvn.smoke_id')::bigint) IS DISTINCT FROM
      ARRAY['gvn_smoke_stager:pending', 'gvn_smoke_reviewer:approved', 'gvn_smoke_reviewer:withdrawn'] THEN
    RAISE EXCEPTION 'The publication history did not record authenticated actors';
  END IF;
END;
$$;

ROLLBACK;
