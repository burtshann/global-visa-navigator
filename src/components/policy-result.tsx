import type { Evaluation, Localized, Policy, RuleSource } from "../domain/policy";
import type { Route } from "../data/catalog";
import { copy } from "./navigator-copy";

export type Language = keyof Localized;

export function routePolicies(route: Route): readonly Policy[] {
  return [...(route.policy ? [route.policy] : []), ...(route.policies ?? [])];
}

type CheckStatus = "pass" | "fail" | "unknown" | "not-applicable";
type CheckRole = "required" | "alternative" | "applicability" | "exception" | "points";

const evaluationLabels: Record<Evaluation["status"], Localized> = {
  "conditions-met": { en: "All checked conditions met", zh: "符合本次核对的所有条件" },
  "conditions-not-met": { en: "A checked requirement is unmet", zh: "至少一项已核对要求未满足" },
  "profile-incomplete": { en: "More information needed", zh: "仍需补充信息" },
  "conditions-not-applicable": { en: "These checks do not apply", zh: "本组核对条件不适用" },
  "rules-not-covered": { en: "Rule checks unavailable", zh: "暂无规则核对结果" },
};

const checkLabels: Record<CheckStatus, Localized> = {
  pass: { en: "Met", zh: "已满足" },
  fail: { en: "Unmet", zh: "未满足" },
  unknown: { en: "Unknown", zh: "待确认" },
  "not-applicable": { en: "Not applicable", zh: "不适用" },
};

const roleLabels: Record<CheckRole, Localized> = {
  required: copy.roleRequired,
  alternative: copy.roleAlternative,
  applicability: copy.roleApplicability,
  exception: copy.roleException,
  points: copy.rolePoints,
};

const failedCheckLabels: Record<CheckRole, Localized> = {
  required: checkLabels.fail,
  alternative: copy.alternativeUnmet,
  applicability: copy.scopeUnmet,
  exception: copy.exceptionUnavailable,
  points: copy.pointsNotCounted,
};

const stageLabels: Record<Policy["stage"], Localized> = {
  application: { en: "Application conditions", zh: "申请条件" },
  invitation: { en: "Invitation conditions", zh: "获邀条件" },
  approval: { en: "Final approval conditions", zh: "最终审批条件" },
};

export function OfficialLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {label} <span aria-hidden="true">↗</span>
    </a>
  );
}

export function PolicyStatus({ language, evaluation, hasPolicy }: {
  language: Language;
  evaluation?: Evaluation;
  hasPolicy?: boolean;
}) {
  const kind = evaluation?.status ?? (hasPolicy ? "sample" : "rules-not-covered");
  const label = evaluation ? evaluationLabels[evaluation.status] : hasPolicy ? copy.ruleSample : copy.browseOnly;
  return <span className={`status status--${kind}`}>{label[language]}</span>;
}

type CheckRow = {
  id: string;
  label: Localized;
  nextStep: Localized;
  source?: RuleSource;
  status?: CheckStatus;
  role?: CheckRole;
  score?: { earned: number; possible: number; minimum: number };
};

function SourceDetails({ source, language }: { source: RuleSource; language: Language }) {
  return (
    <details className="condition-source">
      <summary>{copy.sourceDetails[language]}</summary>
      <dl>
        <dt>{copy.applicability[language]}</dt><dd>{source.applicableWhen[language]}</dd>
        {source.evidence && <><dt>{copy.sourceEvidence[language]}</dt><dd>{source.evidence[language]}</dd></>}
        <dt>{copy.effective[language]}</dt>
        <dd>{source.effectiveFrom ?? copy.effectiveUnknown[language]}</dd>
        {source.effectiveUntil && (
          <><dt>{copy.effectiveUntil[language]}</dt><dd>{source.effectiveUntil}</dd></>
        )}
        <dt>{copy.verifiedAt[language]}</dt><dd>{source.lastVerifiedAt ?? copy.unavailable[language]}</dd>
        <dt>{copy.reviewState[language]}</dt><dd>{copy[source.reviewStatus][language]}</dd>
      </dl>
      <div className="source-links">
        <OfficialLink className="text-link" href={source.url} label={copy.openOfficialSource[language]} />
        {source.effectiveDateUrl && source.effectiveDateUrl !== source.url && (
          <OfficialLink className="text-link" href={source.effectiveDateUrl} label={copy.dateSource[language]} />
        )}
      </div>
    </details>
  );
}

function ConditionList({ rows, language, showActions = true }: {
  rows: readonly CheckRow[];
  language: Language;
  showActions?: boolean;
}) {
  return (
    <ul className="conditions">
      {rows.map(({ id, label, nextStep, source, status, role, score }) => (
        <li key={id} className="condition">
          <div className="condition-heading">
            <strong>{label[language]}</strong>
            {role && role !== "required" && <span className="condition-role">{roleLabels[role][language]}</span>}
            {status && (
              <span className={`check check--${status}`} data-check-status={status}>{(status === "fail" ? failedCheckLabels[role ?? "required"] : checkLabels[status])[language]}</span>
            )}
          </div>
          {score && (
            <dl className="points-breakdown">
              <div><dt>{copy.earnedPoints[language]}</dt><dd>{score.earned}</dd></div>
              <div><dt>{copy.possiblePoints[language]}</dt><dd>{score.possible}</dd></div>
              <div><dt>{copy.neededPoints[language]}</dt><dd>{score.minimum}</dd></div>
            </dl>
          )}
          {showActions && status && status !== "pass" && status !== "not-applicable" && (
            <p><strong>{copy.nextStep[language]}</strong> {nextStep[language]}</p>
          )}
          {source && <SourceDetails source={source} language={language} />}
        </li>
      ))}
    </ul>
  );
}

function ResultChecks({ evaluation, language }: { evaluation: Evaluation; language: Language }) {
  const rows: CheckRow[] = [
    ...evaluation.checks.map(({ condition, status, role }) => ({ ...condition, status, role: role ?? "required" as const })),
    ...(evaluation.groups ?? []),
    ...(evaluation.scores ?? []).map((score) => ({
      ...score,
      role: score.role,
      score: { earned: score.earned, possible: score.possible, minimum: score.minimum },
    })),
  ];
  const sections = [
    { type: "met", title: copy.checkedMet, rows: [] as CheckRow[] },
    { type: "gaps", title: copy.checkedGaps, rows: [] as CheckRow[] },
    { type: "unknown", title: copy.checkedUnknown, rows: [] as CheckRow[] },
    { type: "other", title: copy.checkedOther, rows: [] as CheckRow[] },
  ] as const;
  const [met, gaps, unknown, other] = sections;
  for (const row of rows) {
    if (row.role === "required" && row.status === "pass") met.rows.push(row);
    else if (row.role === "required" && row.status === "fail") gaps.rows.push(row);
    else if (row.status === "unknown" && (row.role === "required" || row.role === "applicability" || row.role === "exception")) unknown.rows.push(row);
    else other.rows.push(row);
  }

  return sections.map((section) => section.rows.length > 0 && (
    <div className="check-group" key={section.title.en}>
      <p className="check-group-title">{section.title[language]}</p>
      <ConditionList rows={section.rows} language={language} showActions={section.type !== "other" || evaluation.status !== "conditions-met"} />
    </div>
  ));
}

export function PolicyDetails({ policy, language, evaluation }: {
  policy: Policy;
  language: Language;
  evaluation?: Evaluation;
}) {
  return (
    <details className="rules" open={evaluation ? true : undefined}>
      <summary>{copy.checks[language]}</summary>
      <p className="policy-meta">
        {stageLabels[policy.stage][language]} <span aria-hidden="true">·</span>{" "}
        {copy.version[language]} {policy.version}
      </p>
      {evaluation
        ? <ResultChecks evaluation={evaluation} language={language} />
        : <ConditionList rows={policy.conditions} language={language} />}
    </details>
  );
}
