BEGIN;

CREATE TABLE country (
  id text PRIMARY KEY CHECK (id ~ '^[A-Z]{2}$'),
  name_en text NOT NULL,
  name_zh text NOT NULL,
  official_url text NOT NULL CHECK (official_url ~ '^https://')
);

CREATE TABLE visa_route (
  id text PRIMARY KEY,
  country_id text NOT NULL REFERENCES country (id),
  category text NOT NULL CHECK (category IN (
    'skilled-work', 'job-search', 'skilled-migration', 'study', 'post-study'
  )),
  name_en text NOT NULL,
  name_zh text NOT NULL,
  description_en text NOT NULL,
  description_zh text NOT NULL,
  official_url text NOT NULL CHECK (official_url ~ '^https://')
);

CREATE TABLE official_source (
  id text PRIMARY KEY,
  country_id text NOT NULL REFERENCES country (id),
  url text NOT NULL UNIQUE CHECK (url ~ '^https://'),
  publisher text NOT NULL,
  title text NOT NULL
);

CREATE TABLE policy_version (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  route_id text NOT NULL REFERENCES visa_route (id),
  policy_key text NOT NULL,
  version text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('application', 'invitation', 'approval')),
  scope_en text NOT NULL,
  scope_zh text NOT NULL,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'retired')),
  reviewed_at timestamptz,
  reviewed_by text,
  review_reference text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (route_id, policy_key, stage, version),
  CHECK (review_status <> 'approved' OR (
    reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND review_reference IS NOT NULL
  ))
);

-- Retire the earlier version and approve its successor in the same transaction.
CREATE UNIQUE INDEX policy_one_approved_version
  ON policy_version (route_id, policy_key, stage) WHERE review_status = 'approved';

CREATE TABLE policy_condition (
  policy_version_id bigint NOT NULL REFERENCES policy_version (id),
  condition_key text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  input_key text NOT NULL,
  operator text NOT NULL CHECK (operator IN ('eq', 'in', 'gte', 'lte')),
  expected_value jsonb NOT NULL,
  label_en text NOT NULL,
  label_zh text NOT NULL,
  next_step_en text NOT NULL,
  next_step_zh text NOT NULL,
  source_id text NOT NULL REFERENCES official_source (id),
  source_locator text,
  applicable_when_en text NOT NULL,
  applicable_when_zh text NOT NULL,
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'verified', 'retired')),
  PRIMARY KEY (policy_version_id, condition_key),
  UNIQUE (policy_version_id, position),
  CHECK (effective_until > effective_from),
  CHECK (review_status <> 'verified' OR last_verified_at IS NOT NULL),
  CHECK (CASE operator
    WHEN 'eq' THEN jsonb_typeof(expected_value) IN ('boolean', 'number', 'string')
    WHEN 'in' THEN CASE WHEN jsonb_typeof(expected_value) = 'array'
      THEN jsonb_array_length(expected_value) > 0 ELSE false END
    ELSE jsonb_typeof(expected_value) = 'number'
  END)
);

-- A captured digest records evidence of what was retrieved. It grants no approval.
CREATE TABLE source_observation (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id text NOT NULL REFERENCES official_source (id),
  observed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  normalizer_version text NOT NULL,
  baseline_sha256 text NOT NULL CHECK (baseline_sha256 ~ '^[0-9a-f]{64}$'),
  observed_sha256 text CHECK (observed_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('unchanged', 'changed', 'error')),
  error_message text,
  CHECK (CASE status
    WHEN 'unchanged' THEN observed_sha256 IS NOT NULL AND observed_sha256 = baseline_sha256 AND error_message IS NULL
    WHEN 'changed' THEN observed_sha256 IS NOT NULL AND observed_sha256 <> baseline_sha256 AND error_message IS NULL
    WHEN 'error' THEN observed_sha256 IS NULL AND error_message IS NOT NULL
  END)
);

CREATE INDEX source_observation_history ON source_observation (source_id, observed_at DESC);

CREATE TABLE source_review (
  observation_id bigint PRIMARY KEY REFERENCES source_observation (id),
  disposition text NOT NULL CHECK (disposition IN ('no_rule_change', 'updated_policy', 'recheck')),
  reviewed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by text NOT NULL,
  review_reference text NOT NULL,
  notes text NOT NULL
);

COMMIT;
