BEGIN;

INSERT INTO country (id, name_en, name_zh, official_url)
VALUES ('XZ', 'Fixture', '测试', 'https://example.test');

INSERT INTO visa_route (id, country_id, category, name_en, name_zh, description_en, description_zh, official_url)
VALUES ('fixture-publication', 'XZ', 'job-search', 'Fixture', '测试', 'Fixture', '测试', 'https://example.test');

DO $$
DECLARE
  policy_id bigint;
BEGIN
  INSERT INTO policy_version
    (route_id, policy_key, version, stage, scope_en, scope_zh, git_revision, snapshot_sha256, rule_snapshot)
  VALUES
    ('fixture-publication', 'fixture', '1', 'application', 'Fixture', '测试',
     repeat('a', 40), repeat('b', 64), '{"id":"fixture","version":"1","stage":"application"}')
  RETURNING id INTO policy_id;

  INSERT INTO policy_publication_event
    (policy_version_id, from_status, to_status, reviewer, review_reference)
  VALUES (policy_id, NULL, 'pending', 'fixture-reviewer', 'fixture-reference');

  BEGIN
    UPDATE policy_version SET snapshot_sha256 = repeat('c', 64) WHERE id = policy_id;
    RAISE EXCEPTION 'Expected staged snapshots to be immutable' USING ERRCODE = 'XX001';
  EXCEPTION WHEN raise_exception THEN
    NULL;
  END;

  UPDATE policy_version
  SET review_status = 'approved', reviewed_at = CURRENT_TIMESTAMP,
      reviewed_by = 'fixture-reviewer', review_reference = 'fixture-reference'
  WHERE id = policy_id;

  INSERT INTO policy_publication_event
    (policy_version_id, from_status, to_status, reviewer, review_reference)
  VALUES (policy_id, 'pending', 'approved', 'fixture-reviewer', 'fixture-reference');

  UPDATE policy_version SET review_status = 'withdrawn' WHERE id = policy_id;

  INSERT INTO policy_publication_event
    (policy_version_id, from_status, to_status, reviewer, review_reference)
  VALUES (policy_id, 'approved', 'withdrawn', 'fixture-reviewer', 'fixture-reference');

  BEGIN
    UPDATE policy_version SET review_status = 'approved' WHERE id = policy_id;
    RAISE EXCEPTION 'Expected withdrawn snapshots to stay withdrawn' USING ERRCODE = 'XX001';
  EXCEPTION WHEN raise_exception THEN
    NULL;
  END;

  IF (SELECT array_agg(to_status ORDER BY id)
      FROM policy_publication_event WHERE policy_version_id = policy_id)
    IS DISTINCT FROM ARRAY['pending', 'approved', 'withdrawn'] THEN
    RAISE EXCEPTION 'Unexpected policy audit history';
  END IF;
END;
$$;

ROLLBACK;
