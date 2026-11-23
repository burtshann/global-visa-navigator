export type Localized = Readonly<{ en: string; zh: string }>;

type Answer = boolean | number | string;

type ProfileFields = {
  nationality?: string;
  age?: number;
  education?: string;
  occupation?: string;
  experienceYears?: number;
  language?: string;
  budgetUsd?: number;
  jobOffer?: boolean;
  goal?: string;
};

export type Profile = Readonly<
  ProfileFields & { answers?: Readonly<Record<string, Answer | undefined>> }
>;

type ConditionInput = keyof ProfileFields | `answer:${string}`;

export type RuleSource = Readonly<{
  url: string;
  applicableWhen: Localized;
  // Null records that the official evidence did not establish an effective date.
  effectiveFrom: string | null;
  // Exclusive end date.
  effectiveUntil?: string | null;
  lastVerifiedAt: string | null;
  reviewStatus: "verified" | "pending" | "retired";
}>;

type Comparison =
  | { operator: "eq"; expected: Answer }
  | { operator: "in"; expected: readonly [Answer, ...Answer[]] }
  | { operator: "gte" | "lte"; expected: number };

export type Condition = Readonly<
  Comparison & {
    id: string;
    input: ConditionInput;
    label: Localized;
    nextStep: Localized;
    source: RuleSource;
  }
>;

export type PolicyStage = "application" | "invitation" | "approval";

export type Policy = Readonly<{
  id: string;
  version: string;
  stage: PolicyStage;
  conditions: readonly Condition[];
}>;

export type EvaluationStatus =
  | "conditions-met"
  | "conditions-not-met"
  | "profile-incomplete"
  | "rules-not-covered";

export type EvaluatedCondition = Readonly<{
  condition: Condition;
  status: "pass" | "fail" | "unknown";
}>;

export type Evaluation = Readonly<{
  status: EvaluationStatus;
  stage: PolicyStage | null;
  version: string | null;
  checks: readonly EvaluatedCondition[];
  coverageIssue: "missing-policy" | "unusable-version" | "invalid-as-of" | null;
}>;

function isDate(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(value);
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return value.startsWith("https://") && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isCurrentSource(source: RuleSource, asOf: string): boolean {
  const { lastVerifiedAt, effectiveFrom, effectiveUntil } = source;

  if (source.reviewStatus !== "verified" || !isHttpsUrl(source.url)) {
    return false;
  }
  if (!isDate(lastVerifiedAt) || lastVerifiedAt > asOf) {
    return false;
  }
  if (effectiveFrom !== null && (!isDate(effectiveFrom) || effectiveFrom > asOf)) {
    return false;
  }

  return effectiveUntil == null || (isDate(effectiveUntil) && asOf < effectiveUntil);
}

function getAnswer(profile: Profile, input: ConditionInput): Answer | undefined {
  const prefix = "answer:";
  if (input.startsWith(prefix)) {
    const key = input.slice(prefix.length);
    return profile.answers?.[key];
  }

  return profile[input as keyof ProfileFields];
}

function checkCondition(condition: Condition, profile: Profile): EvaluatedCondition["status"] {
  const answer = getAnswer(profile, condition.input);

  if (
    answer === undefined ||
    (typeof answer === "string" && answer.trim() === "") ||
    (typeof answer === "number" && !Number.isFinite(answer))
  ) {
    return "unknown";
  }

  switch (condition.operator) {
    case "eq":
      if (typeof answer !== typeof condition.expected) return "unknown";
      return answer === condition.expected ? "pass" : "fail";
    case "in":
      if (!condition.expected.some((option) => typeof option === typeof answer)) return "unknown";
      return condition.expected.includes(answer) ? "pass" : "fail";
    case "gte":
      if (typeof answer !== "number") return "unknown";
      return answer >= condition.expected ? "pass" : "fail";
    case "lte":
      if (typeof answer !== "number") return "unknown";
      return answer <= condition.expected ? "pass" : "fail";
  }
}

function uncovered(
  policy: Policy | undefined,
  coverageIssue: NonNullable<Evaluation["coverageIssue"]>,
): Evaluation {
  return {
    status: "rules-not-covered",
    stage: policy?.stage ?? null,
    version: policy?.version ?? null,
    checks: [],
    coverageIssue,
  };
}

/** Evaluate one reviewed version as of the supplied UTC calendar date. */
export function evaluatePolicy(policy: Policy | undefined, profile: Profile, asOf: string): Evaluation {
  if (!isDate(asOf)) return uncovered(policy, "invalid-as-of");
  if (!policy) return uncovered(undefined, "missing-policy");
  if (
    policy.conditions.length === 0 ||
    policy.conditions.some(({ source }) => !isCurrentSource(source, asOf))
  ) {
    return uncovered(policy, "unusable-version");
  }

  const checks = policy.conditions.map((condition) => ({
    condition,
    status: checkCondition(condition, profile),
  }));
  const hasFailure = checks.some(({ status }) => status === "fail");
  const hasUnknown = checks.some(({ status }) => status === "unknown");

  let status: EvaluationStatus = "conditions-met";
  if (hasFailure) status = "conditions-not-met";
  else if (hasUnknown) status = "profile-incomplete";

  return { status, stage: policy.stage, version: policy.version, checks, coverageIssue: null };
}
