BEGIN;

ALTER TABLE policy_version
  DROP CONSTRAINT policy_version_review_status_check,
  ADD CONSTRAINT policy_version_review_status_check
    CHECK (review_status IN ('pending', 'approved', 'withdrawn', 'retired')),
  ADD COLUMN git_revision text,
  ADD COLUMN snapshot_sha256 text,
  ADD COLUMN rule_snapshot jsonb,
  ADD CONSTRAINT policy_version_snapshot_check CHECK (
    (git_revision IS NULL AND snapshot_sha256 IS NULL AND rule_snapshot IS NULL)
    OR (
      git_revision IS NOT NULL AND git_revision ~ '^[0-9a-f]{40}$'
      AND snapshot_sha256 IS NOT NULL AND snapshot_sha256 ~ '^[0-9a-f]{64}$'
      AND rule_snapshot IS NOT NULL AND jsonb_typeof(rule_snapshot) = 'object'
      AND (rule_snapshot ->> 'id') IS NOT NULL AND rule_snapshot ->> 'id' = policy_key
      AND (rule_snapshot ->> 'version') IS NOT NULL AND rule_snapshot ->> 'version' = version
      AND (rule_snapshot ->> 'stage') IS NOT NULL AND rule_snapshot ->> 'stage' = stage
    )
  );

ALTER TABLE policy_condition
  DROP CONSTRAINT policy_condition_operator_check,
  ADD CONSTRAINT policy_condition_operator_check
    CHECK (operator IN ('eq', 'in', 'gte', 'gt', 'lte', 'lt'));

CREATE TABLE policy_publication_event (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  policy_version_id bigint NOT NULL REFERENCES policy_version (id),
  from_status text CHECK (from_status IN ('pending', 'approved')),
  to_status text NOT NULL CHECK (to_status IN ('pending', 'approved', 'withdrawn')),
  reviewer text NOT NULL CHECK (btrim(reviewer) <> ''),
  review_reference text NOT NULL CHECK (btrim(review_reference) <> ''),
  recorded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (to_status = 'pending' AND from_status IS NULL)
    OR (to_status = 'approved' AND from_status IS NOT NULL AND from_status = 'pending')
    OR (to_status = 'withdrawn' AND from_status IS NOT NULL AND from_status IN ('pending', 'approved'))
  )
);

CREATE INDEX policy_publication_event_history ON policy_publication_event (policy_version_id, id);

CREATE FUNCTION protect_policy_version_snapshot() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.rule_snapshot IS NOT NULL AND (
    NEW.route_id IS DISTINCT FROM OLD.route_id
    OR NEW.policy_key IS DISTINCT FROM OLD.policy_key
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.stage IS DISTINCT FROM OLD.stage
    OR NEW.scope_en IS DISTINCT FROM OLD.scope_en
    OR NEW.scope_zh IS DISTINCT FROM OLD.scope_zh
    OR NEW.git_revision IS DISTINCT FROM OLD.git_revision
    OR NEW.snapshot_sha256 IS DISTINCT FROM OLD.snapshot_sha256
    OR NEW.rule_snapshot IS DISTINCT FROM OLD.rule_snapshot
  ) THEN
    RAISE EXCEPTION 'A staged policy snapshot cannot be modified. Stage a new version.';
  END IF;

  IF OLD.rule_snapshot IS NOT NULL AND NEW.review_status <> OLD.review_status AND NOT (
    (OLD.review_status = 'pending' AND NEW.review_status IN ('approved', 'withdrawn'))
    OR (OLD.review_status = 'approved' AND NEW.review_status = 'withdrawn')
  ) THEN
    RAISE EXCEPTION 'Invalid policy publication state transition from % to %.', OLD.review_status, NEW.review_status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER policy_version_snapshot_immutable
BEFORE UPDATE ON policy_version
FOR EACH ROW EXECUTE FUNCTION protect_policy_version_snapshot();

COMMIT;
