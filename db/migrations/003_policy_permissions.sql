BEGIN;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gvn_policy_reader') THEN
    CREATE ROLE gvn_policy_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gvn_policy_stager') THEN
    CREATE ROLE gvn_policy_stager NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gvn_policy_reviewer') THEN
    CREATE ROLE gvn_policy_reviewer NOLOGIN;
  END IF;
END;
$roles$;

ALTER TABLE public.policy_version ADD COLUMN staged_by name, ADD COLUMN staged_role_oid oid;
ALTER TABLE public.policy_publication_event ADD COLUMN actor_role name, ADD COLUMN actor_role_oid oid;

CREATE FUNCTION public.gvn_protect_staging_actor() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp
AS $body$
BEGIN
  IF NEW.staged_by IS DISTINCT FROM OLD.staged_by OR NEW.staged_role_oid IS DISTINCT FROM OLD.staged_role_oid THEN
    RAISE EXCEPTION 'The original policy staging actor cannot be changed.';
  END IF;
  RETURN NEW;
END;
$body$;

CREATE TRIGGER policy_staging_actor_immutable
BEFORE UPDATE OF staged_by, staged_role_oid ON public.policy_version
FOR EACH ROW EXECUTE FUNCTION public.gvn_protect_staging_actor();

CREATE VIEW public.gvn_approved_policy_snapshot WITH (security_barrier = true) AS
SELECT version.route_id, version.policy_key, version.stage, version.version,
       version.snapshot_sha256, version.rule_snapshot
FROM public.policy_version AS version
WHERE version.review_status = 'approved' AND version.rule_snapshot IS NOT NULL
  AND version.staged_by IS NOT NULL AND version.staged_role_oid IS NOT NULL
  AND EXISTS (
    SELECT FROM public.policy_publication_event AS event
    WHERE event.policy_version_id = version.id AND event.to_status = 'approved'
      AND event.actor_role::text = version.reviewed_by
      AND event.actor_role_oid <> version.staged_role_oid
  );

CREATE VIEW public.gvn_policy_review_queue WITH (security_barrier = true) AS
SELECT id, route_id, policy_key, version, stage, review_status, git_revision,
       snapshot_sha256, staged_by, created_at, rule_snapshot
FROM public.policy_version
WHERE rule_snapshot IS NOT NULL;

CREATE FUNCTION public.gvn_stage_policy(
  country jsonb, route jsonb, policy jsonb, revision text, digest text, reference text
) RETURNS public.policy_version
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $body$
DECLARE
  snapshot public.policy_version;
  item record;
  source_url text;
  result_source_id text;
  verified_at text;
  scope jsonb;
  actor_id oid := (SELECT oid FROM pg_roles WHERE rolname = SESSION_USER);
BEGIN
  IF NOT pg_has_role(SESSION_USER, 'gvn_policy_stager', 'MEMBER') THEN
    RAISE EXCEPTION 'The staging role is required.' USING ERRCODE = '42501';
  END IF;
  IF btrim(COALESCE(reference, '')) = '' THEN
    RAISE EXCEPTION 'A policy evidence reference is required.';
  END IF;
  IF country ->> 'id' IS DISTINCT FROM route ->> 'countryId'
      OR jsonb_typeof(policy -> 'conditions') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'The route country and policy conditions are required.';
  END IF;
  IF jsonb_array_length(policy -> 'conditions') = 0 THEN
    RAISE EXCEPTION 'The staged snapshot has no conditions.';
  END IF;

  INSERT INTO public.country (id, name_en, name_zh, official_url)
  VALUES (country ->> 'id', country #>> '{name,en}', country #>> '{name,zh}', country ->> 'officialUrl')
  ON CONFLICT (id) DO UPDATE SET name_en = EXCLUDED.name_en, name_zh = EXCLUDED.name_zh, official_url = EXCLUDED.official_url;

  -- The upsert locks the route for the duration of staging, just as review does.
  INSERT INTO public.visa_route (id, country_id, category, name_en, name_zh, description_en, description_zh, official_url)
  VALUES (route ->> 'id', route ->> 'countryId', route ->> 'category', route #>> '{name,en}', route #>> '{name,zh}',
          route #>> '{description,en}', route #>> '{description,zh}', route ->> 'officialUrl')
  ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, category = EXCLUDED.category,
    name_en = EXCLUDED.name_en, name_zh = EXCLUDED.name_zh, description_en = EXCLUDED.description_en,
    description_zh = EXCLUDED.description_zh, official_url = EXCLUDED.official_url;

  scope := COALESCE(policy -> 'scope', route -> 'scope', route -> 'description');
  INSERT INTO public.policy_version
    (route_id, policy_key, version, stage, scope_en, scope_zh, git_revision, snapshot_sha256, rule_snapshot, staged_by, staged_role_oid)
  VALUES (route ->> 'id', policy ->> 'id', policy ->> 'version', policy ->> 'stage', scope ->> 'en', scope ->> 'zh',
          revision, digest, policy, SESSION_USER, actor_id)
  ON CONFLICT (route_id, policy_key, stage, version) DO NOTHING
  RETURNING * INTO snapshot;

  IF NOT FOUND THEN
    SELECT * INTO STRICT snapshot FROM public.policy_version AS existing
    WHERE existing.route_id = route ->> 'id' AND existing.policy_key = policy ->> 'id'
      AND existing.version = policy ->> 'version' AND existing.stage = policy ->> 'stage';
    IF snapshot.staged_role_oid IS NULL OR snapshot.snapshot_sha256 IS DISTINCT FROM digest
        OR snapshot.rule_snapshot IS DISTINCT FROM policy THEN
      RAISE EXCEPTION 'This version already exists with a legacy identity or different snapshot. Assign a new version.';
    END IF;
    RETURN snapshot;
  END IF;

  FOR item IN SELECT value, ordinality FROM jsonb_array_elements(policy -> 'conditions') WITH ORDINALITY LOOP
    source_url := item.value #>> '{source,url}';
    INSERT INTO public.official_source (id, country_id, url, publisher, title)
    VALUES ('url-' || encode(sha256(convert_to(to_jsonb(source_url)::text, 'UTF8')), 'hex'),
            country ->> 'id', source_url, substring(source_url from '^https://([^/?#]+)'), source_url)
    ON CONFLICT (url) DO NOTHING;
    SELECT id INTO STRICT result_source_id FROM public.official_source WHERE url = source_url;

    verified_at := item.value #>> '{source,lastVerifiedAt}';
    INSERT INTO public.policy_condition
      (policy_version_id, condition_key, position, input_key, operator, expected_value,
       label_en, label_zh, next_step_en, next_step_zh, source_id, applicable_when_en,
       applicable_when_zh, effective_from, effective_until, last_verified_at, review_status)
    VALUES (snapshot.id, item.value ->> 'id', item.ordinality, item.value ->> 'input', item.value ->> 'operator',
            item.value -> 'expected', item.value #>> '{label,en}', item.value #>> '{label,zh}',
            item.value #>> '{nextStep,en}', item.value #>> '{nextStep,zh}', result_source_id,
            item.value #>> '{source,applicableWhen,en}', item.value #>> '{source,applicableWhen,zh}',
            (item.value #>> '{source,effectiveFrom}')::date, (item.value #>> '{source,effectiveUntil}')::date,
            CASE WHEN length(verified_at) = 10 THEN verified_at::date::timestamp AT TIME ZONE 'UTC'
                 ELSE verified_at::timestamptz END, item.value #>> '{source,reviewStatus}');
  END LOOP;

  INSERT INTO public.policy_publication_event
    (policy_version_id, from_status, to_status, reviewer, actor_role, actor_role_oid, review_reference)
  VALUES (snapshot.id, NULL, 'pending', SESSION_USER, SESSION_USER, actor_id, reference);
  RETURN snapshot;
END;
$body$;

CREATE FUNCTION public.gvn_review_policy(action text, snapshot_id bigint, digest text, reference text)
RETURNS public.policy_version
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $body$
DECLARE
  snapshot public.policy_version;
  superseded bigint;
  previous_status text;
  actor_id oid := (SELECT oid FROM pg_roles WHERE rolname = SESSION_USER);
BEGIN
  IF NOT pg_has_role(SESSION_USER, 'gvn_policy_reviewer', 'MEMBER') THEN
    RAISE EXCEPTION 'The reviewer role is required.' USING ERRCODE = '42501';
  END IF;
  IF action IS NULL OR action NOT IN ('approve', 'withdraw') OR btrim(COALESCE(reference, '')) = '' THEN
    RAISE EXCEPTION 'A valid review action and evidence reference are required.';
  END IF;

  PERFORM route.id FROM public.visa_route AS route JOIN public.policy_version AS version
    ON version.route_id = route.id WHERE version.id = snapshot_id FOR UPDATE OF route;
  SELECT * INTO STRICT snapshot FROM public.policy_version WHERE id = snapshot_id AND rule_snapshot IS NOT NULL;
  IF snapshot.snapshot_sha256 IS DISTINCT FROM digest THEN
    RAISE EXCEPTION 'The staged digest has changed. Review the current snapshot before retrying.';
  END IF;

  previous_status := snapshot.review_status;
  IF action = 'withdraw' THEN
    IF previous_status = 'withdrawn' THEN RETURN snapshot; END IF;
    IF previous_status NOT IN ('pending', 'approved') THEN
      RAISE EXCEPTION 'Only a pending or approved snapshot can be withdrawn.';
    END IF;
    UPDATE public.policy_version SET review_status = 'withdrawn'
    WHERE id = snapshot.id RETURNING * INTO snapshot;
  ELSE
    IF snapshot.staged_role_oid IS NULL THEN
      RAISE EXCEPTION 'Legacy snapshots require a new version and review.';
    END IF;
    IF snapshot.staged_role_oid = actor_id THEN
      RAISE EXCEPTION 'A stager cannot approve their own snapshot.' USING ERRCODE = '42501';
    END IF;
    IF previous_status = 'approved' THEN RETURN snapshot; END IF;
    IF previous_status <> 'pending' THEN RAISE EXCEPTION 'Only a pending snapshot can be approved.'; END IF;

    FOR superseded IN
      UPDATE public.policy_version SET review_status = 'withdrawn'
      WHERE route_id = snapshot.route_id AND policy_key = snapshot.policy_key
        AND stage = snapshot.stage AND review_status = 'approved' RETURNING id
    LOOP
      INSERT INTO public.policy_publication_event
        (policy_version_id, from_status, to_status, reviewer, actor_role, actor_role_oid, review_reference)
      VALUES (superseded, 'approved', 'withdrawn', SESSION_USER, SESSION_USER, actor_id, reference);
    END LOOP;

    UPDATE public.policy_version SET review_status = 'approved', reviewed_at = CURRENT_TIMESTAMP,
      reviewed_by = SESSION_USER, review_reference = reference
    WHERE id = snapshot.id RETURNING * INTO snapshot;
  END IF;

  INSERT INTO public.policy_publication_event
    (policy_version_id, from_status, to_status, reviewer, actor_role, actor_role_oid, review_reference)
  VALUES (snapshot.id, previous_status, snapshot.review_status, SESSION_USER, SESSION_USER, actor_id, reference);
  RETURN snapshot;
END;
$body$;

REVOKE ALL ON TABLE public.country, public.visa_route, public.official_source, public.policy_version,
  public.policy_condition, public.policy_publication_event, public.source_observation, public.source_review
  FROM PUBLIC, gvn_policy_reader, gvn_policy_stager, gvn_policy_reviewer;
REVOKE ALL ON public.gvn_approved_policy_snapshot, public.gvn_policy_review_queue FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gvn_protect_staging_actor(), public.gvn_stage_policy(jsonb, jsonb, jsonb, text, text, text),
  public.gvn_review_policy(text, bigint, text, text) FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO gvn_policy_reader, gvn_policy_stager, gvn_policy_reviewer;
GRANT SELECT ON public.gvn_approved_policy_snapshot TO gvn_policy_reader;
GRANT SELECT ON public.gvn_policy_review_queue TO gvn_policy_stager, gvn_policy_reviewer;
GRANT EXECUTE ON FUNCTION public.gvn_stage_policy(jsonb, jsonb, jsonb, text, text, text) TO gvn_policy_stager;
GRANT EXECUTE ON FUNCTION public.gvn_review_policy(text, bigint, text, text) TO gvn_policy_reviewer;

COMMIT;
