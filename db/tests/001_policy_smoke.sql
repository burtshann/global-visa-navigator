BEGIN;

INSERT INTO country (id, name_en, name_zh, official_url)
VALUES ('ZZ', 'Test country', '测试国家', 'https://example.com');

INSERT INTO visa_route (id, country_id, category, name_en, name_zh, description_en, description_zh, official_url)
VALUES ('test-route', 'ZZ', 'job-search', 'Test visa', '测试签证', 'Fixture', '测试数据', 'https://example.com/visa');

INSERT INTO official_source (id, country_id, url, publisher, title)
VALUES ('test-source', 'ZZ', 'https://example.com/visa/policy', 'Fixture publisher', 'Fixture policy');

DO $test$
DECLARE
  pending_version bigint;
  successor_version bigint;
  observation_id bigint;
BEGIN
  INSERT INTO policy_version (route_id, policy_key, version, stage, scope_en, scope_zh)
  VALUES ('test-route', 'test-policy', '1', 'application', 'Fixture only', '仅用于测试')
  RETURNING id INTO pending_version;

  BEGIN
    UPDATE policy_version SET review_status = 'approved' WHERE id = pending_version;
    RAISE EXCEPTION 'An approved version incorrectly accepted empty review metadata';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO policy_condition (
    policy_version_id, condition_key, position, input_key, operator, expected_value,
    label_en, label_zh, next_step_en, next_step_zh, source_id, applicable_when_en, applicable_when_zh
  ) VALUES (
    pending_version, 'test-condition', 1, 'answer:fixture', 'eq', 'true',
    'Fixture', '测试条件', 'Review source', '查看来源', 'test-source', 'Fixture only', '仅用于测试'
  );

  BEGIN
    UPDATE policy_condition SET review_status = 'verified' WHERE policy_version_id = pending_version;
    RAISE EXCEPTION 'A verified condition incorrectly accepted an empty verification timestamp';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  UPDATE policy_condition SET review_status = 'verified', last_verified_at = CURRENT_TIMESTAMP
  WHERE policy_version_id = pending_version;

  UPDATE policy_version SET
    review_status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = 'Test reviewer', review_reference = 'fixture'
  WHERE id = pending_version;

  INSERT INTO policy_version (route_id, policy_key, version, stage, scope_en, scope_zh)
  VALUES ('test-route', 'test-policy', '2', 'application', 'Fixture only', '仅用于测试')
  RETURNING id INTO successor_version;

  BEGIN
    UPDATE policy_version SET
      review_status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = 'Test reviewer', review_reference = 'fixture'
    WHERE id = successor_version;
    RAISE EXCEPTION 'Two approved versions incorrectly overlapped';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO source_observation (source_id, normalizer_version, baseline_sha256, observed_sha256, status)
  VALUES ('test-source', 'fixture-v1', repeat('0', 64), repeat('1', 64), 'changed')
  RETURNING id INTO observation_id;

  INSERT INTO source_review (observation_id, disposition, reviewed_by, review_reference, notes)
  VALUES (observation_id, 'no_rule_change', 'Test reviewer', 'fixture', 'Formatting update');
END;
$test$;

ROLLBACK;
