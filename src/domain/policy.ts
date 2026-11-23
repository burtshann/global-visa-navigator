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
  evidence?: Localized;
  effectiveDateUrl?: string;
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
  | { operator: "gte" | "gt" | "lte" | "lt"; expected: number };

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

type RuleSummary = Readonly<{ id: string; label: Localized; nextStep: Localized }>;

type PointRange = number | Readonly<{ minimum: number; maximum: number }>;

export type ScoreCategory = Readonly<{
  id: string;
  alternatives: readonly Readonly<{ points: PointRange; when: RuleExpression }>[];
}>;

export type RuleExpression =
  | Readonly<{ kind: "condition"; conditionId: string }>
  | Readonly<{ kind: "all" | "any"; children: readonly RuleExpression[]; summary?: RuleSummary }>
  | Readonly<{ kind: "when" | "unless"; test: RuleExpression; requirement: RuleExpression }>
  | Readonly<RuleSummary & {
    kind: "points";
    source: RuleSource;
    minimum: number;
    categories: readonly ScoreCategory[];
  }>;

export type Policy = Readonly<{
  id: string;
  version: string;
  stage: PolicyStage;
  name?: Localized;
  scope?: Localized;
  conditions: readonly Condition[];
  expression?: RuleExpression;
}>;

export type EvaluationStatus =
  | "conditions-met"
  | "conditions-not-met"
  | "conditions-not-applicable"
  | "profile-incomplete"
  | "rules-not-covered";

type ConditionStatus = "pass" | "fail" | "unknown";
type ExpressionStatus = ConditionStatus | "not-applicable";
export type ConditionRole = "required" | "alternative" | "applicability" | "exception" | "points";

export type EvaluatedCondition = Readonly<{
  condition: Condition;
  status: ConditionStatus;
  role?: ConditionRole;
}>;

export type EvaluatedRuleGroup = Readonly<RuleSummary & {
  status: ExpressionStatus;
  role: ConditionRole;
}>;

export type EvaluatedScore = Readonly<RuleSummary & {
  status: ConditionStatus;
  role: ConditionRole;
  source: RuleSource;
  minimum: number;
  earned: number;
  possible: number;
}>;

type EvaluatedExpression = Readonly<{
  kind: RuleExpression["kind"];
  status: ExpressionStatus;
  conditionId?: string;
  groupId?: string;
  scoreId?: string;
  children?: readonly EvaluatedExpression[];
}>;

export type Evaluation = Readonly<{
  status: EvaluationStatus;
  stage: PolicyStage | null;
  version: string | null;
  checks: readonly EvaluatedCondition[];
  coverageIssue: "missing-policy" | "unusable-version" | "invalid-as-of" | null;
  expression?: EvaluatedExpression;
  groups?: readonly EvaluatedRuleGroup[];
  scores?: readonly EvaluatedScore[];
}>;

export type PathwayEvaluation = Readonly<{
  outcome: Evaluation;
  relevance: "aligned" | "different-goal" | "goal-unknown";
  coverage: "checked-conditions" | "directory-only";
  fullEligibility: "unverified";
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
  if (source.effectiveDateUrl !== undefined && !isHttpsUrl(source.effectiveDateUrl)) {
    return false;
  }
  const verifiedDate = verificationDate(lastVerifiedAt);
  if (!verifiedDate || verifiedDate > asOf) {
    return false;
  }
  if (effectiveFrom !== null && (!isDate(effectiveFrom) || effectiveFrom > asOf)) {
    return false;
  }

  return effectiveUntil == null || (isDate(effectiveUntil) && asOf < effectiveUntil);
}

function verificationDate(value: string | null): string | undefined {
  if (!value) return undefined;
  if (value.length === 10) return isDate(value) ? value : undefined;
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(value)) {
    return undefined;
  }
  const date = value.slice(0, 10);
  return isDate(date) ? date : undefined;
}

function getAnswer(profile: Profile, input: ConditionInput): Answer | undefined {
  const prefix = "answer:";
  if (input.startsWith(prefix)) {
    const key = input.slice(prefix.length);
    return profile.answers && Object.hasOwn(profile.answers, key) ? profile.answers[key] : undefined;
  }

  return profile[input as keyof ProfileFields];
}

function checkCondition(condition: Condition, profile: Profile): ConditionStatus {
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
    case "gt":
      if (typeof answer !== "number") return "unknown";
      return answer > condition.expected ? "pass" : "fail";
    case "lte":
      if (typeof answer !== "number") return "unknown";
      return answer <= condition.expected ? "pass" : "fail";
    case "lt":
      if (typeof answer !== "number") return "unknown";
      return answer < condition.expected ? "pass" : "fail";
  }
}

function pointBounds(points: PointRange): { minimum: number; maximum: number } {
  return typeof points === "number" ? { minimum: points, maximum: points } : points;
}

function isPointValue(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isUsableExpression(
  expression: RuleExpression,
  conditions: ReadonlyMap<string, Condition>,
  asOf: string,
): boolean {
  switch (expression.kind) {
    case "condition":
      return conditions.has(expression.conditionId);
    case "all":
    case "any":
      return expression.children.length > 0 &&
        expression.children.every((child) => isUsableExpression(child, conditions, asOf));
    case "when":
    case "unless":
      return isUsableExpression(expression.test, conditions, asOf) &&
        isUsableExpression(expression.requirement, conditions, asOf);
    case "points":
      return isPointValue(expression.minimum) && expression.minimum > 0 &&
        isCurrentSource(expression.source, asOf) &&
        expression.categories.length > 0 &&
        new Set(expression.categories.map(({ id }) => id)).size === expression.categories.length &&
        expression.categories.every((category) =>
          category.alternatives.length > 0 &&
          category.alternatives.every(({ points, when }) => {
            const { minimum, maximum } = pointBounds(points);
            return isPointValue(minimum) && isPointValue(maximum) && minimum <= maximum &&
              isUsableExpression(when, conditions, asOf);
          }),
        );
  }
}

type ExpressionContext = {
  conditions: ReadonlyMap<string, Condition>;
  profile: Profile;
  checks: Map<string, EvaluatedCondition>;
  groups: EvaluatedRuleGroup[];
  scores: EvaluatedScore[];
};

const rolePriority: Readonly<Record<ConditionRole, number>> = {
  required: 0,
  alternative: 1,
  applicability: 2,
  exception: 3,
  points: 4,
};

function groupStatus(kind: "all" | "any", children: readonly EvaluatedExpression[]): ExpressionStatus {
  const statuses = children.map(({ status }) => status);
  const decisive = kind === "all" ? "fail" : "pass";
  if (statuses.includes(decisive)) return decisive;
  if (statuses.includes("unknown")) return "unknown";
  if (statuses.every((status) => status === "not-applicable")) return "not-applicable";
  return kind === "all" ? "pass" : "fail";
}

function evaluatePoints(
  expression: Extract<RuleExpression, { kind: "points" }>,
  context: ExpressionContext,
  role: ConditionRole,
): EvaluatedExpression {
  const children: EvaluatedExpression[] = [];
  let earned = 0;
  let possible = 0;

  for (const category of expression.categories) {
    let categoryEarned = 0;
    let categoryPossible = 0;
    // Alternatives in one category never stack, even when multiple tiers match.
    for (const { points, when } of category.alternatives) {
      const check = evaluateExpression(when, context, "points");
      const { minimum, maximum } = pointBounds(points);
      children.push(check);
      if (check.status === "pass") categoryEarned = Math.max(categoryEarned, minimum);
      if (check.status === "pass" || check.status === "unknown") {
        categoryPossible = Math.max(categoryPossible, maximum);
      }
    }
    earned += categoryEarned;
    possible += categoryPossible;
  }

  const { id, label, nextStep, source, minimum } = expression;
  const status = earned >= minimum ? "pass" : possible < minimum ? "fail" : "unknown";
  context.scores.push({ id, label, nextStep, source, status, role, minimum, earned, possible });
  return { kind: "points", scoreId: id, status, children };
}

function evaluateExpression(
  expression: RuleExpression,
  context: ExpressionContext,
  role: ConditionRole,
): EvaluatedExpression {
  const { kind } = expression;

  switch (kind) {
    case "condition": {
      const conditionId = expression.conditionId;
      const condition = context.conditions.get(conditionId)!;
      const status = checkCondition(condition, context.profile);
      const existingRole = context.checks.get(conditionId)?.role;
      if (!existingRole || rolePriority[role] < rolePriority[existingRole]) {
        context.checks.set(conditionId, { condition, status, role });
      }
      return { kind, conditionId, status };
    }
    case "all":
    case "any": {
      const childRole = kind === "any" && role === "required" ? "alternative" : role;
      const children = expression.children.map((child) => evaluateExpression(child, context, childRole));
      const status = groupStatus(kind, children);
      const summary = expression.summary;
      if (!summary) return { kind, status, children };
      context.groups.push({ ...summary, status, role });
      return { kind, status, groupId: summary.id, children };
    }
    case "when":
    case "unless": {
      const test = evaluateExpression(expression.test, context, kind === "when" ? "applicability" : "exception");
      if (test.status === "unknown" || test.status === "not-applicable") {
        return { kind, status: "unknown", children: [test] };
      }
      if ((kind === "when" && test.status === "fail") || (kind === "unless" && test.status === "pass")) {
        return { kind, status: "not-applicable", children: [test] };
      }
      const requirement = evaluateExpression(expression.requirement, context, role);
      return { kind, status: requirement.status, children: [test, requirement] };
    }
    case "points":
      return evaluatePoints(expression, context, role);
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

const expressionOutcomes: Readonly<Record<ExpressionStatus, EvaluationStatus>> = {
  pass: "conditions-met",
  fail: "conditions-not-met",
  unknown: "profile-incomplete",
  "not-applicable": "conditions-not-applicable",
};

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

  if (policy.expression) {
    const conditions = new Map(policy.conditions.map((condition) => [condition.id, condition]));
    if (
      conditions.size !== policy.conditions.length ||
      !isUsableExpression(policy.expression, conditions, asOf)
    ) {
      return uncovered(policy, "unusable-version");
    }

    const context: ExpressionContext = { conditions, profile, checks: new Map(), groups: [], scores: [] };
    const expression = evaluateExpression(policy.expression, context, "required");
    return {
      status: expressionOutcomes[expression.status],
      stage: policy.stage,
      version: policy.version,
      checks: [...context.checks.values()],
      expression,
      groups: context.groups,
      scores: context.scores,
      coverageIssue: null,
    };
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

/** A goal match reports relevance only. The evaluation checks published conditions, and full eligibility remains unverified. */
export function evaluatePathway(
  policy: Policy | undefined,
  profile: Profile,
  asOf: string,
  goals: readonly string[],
): PathwayEvaluation {
  const outcome = evaluatePolicy(policy, profile, asOf);
  const goal = profile.goal?.trim();
  const relevance = !goal ? "goal-unknown" : goals.includes(goal) ? "aligned" : "different-goal";
  const coverage = outcome.status === "rules-not-covered" ? "directory-only" : "checked-conditions";
  return { outcome, relevance, coverage, fullEligibility: "unverified" };
}
