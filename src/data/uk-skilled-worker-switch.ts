import type { Condition, Localized, RuleExpression } from "../domain/policy";

const appendix = "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-skilled-worker";
const validity = appendix + "#validity-requirements-for-a-skilled-worker";
const checkedAt = "2026-11-27T18:01:44Z";
const t = (en: string, zh: string): Localized => ({ en, zh });
const inside = t("First principal Skilled Worker applications submitted from within the UK.", "适用于从英国境内首次递交 Skilled Worker 申请的主申请人。");

const permission = {
  id: "uk-sw-switch-permission",
  input: "answer:ukSkilledCurrentPermission",
  operator: "in",
  expected: ["graduate", "student", "other-confirmed"],
  label: t("Current or most recent UK permission permits an in-country switch under SW 1.5ZA", "当前或最近一次英国许可符合 SW 1.5ZA 的境内转换条件"),
  nextStep: t("Check your current or most recent permission. If SW 1.5ZA bars switching, you need to leave the UK and apply from abroad, subject to entry clearance rules.", "请核实当前或最近一次英国许可。如 SW 1.5ZA 禁止境内转换，须离境并按境外入境许可要求申请。"),
  source: {
    url: validity,
    effectiveDateUrl: "https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-334-26-november-2024/statement-of-changes-to-the-immigration-rules-hc-334-26-november-2024-accessible",
    effectiveFrom: "2024-12-18",
    lastVerifiedAt: checkedAt,
    reviewStatus: "verified",
    applicableWhen: inside,
    evidence: t("SW 1.5ZA excludes current or most recent permission as a Visitor, Short-term student, Parent of a Child Student, Seasonal Worker, Domestic Worker in a Private Household, or outside the Immigration Rules.", "SW 1.5ZA 排除当前或最近一次持访客、短期学生、儿童学生家长、季节性工人、私人家庭家政工人许可或在移民规则之外获准居留的情况。"),
  },
} satisfies Condition;

const student = {
  id: "uk-sw-switch-student",
  input: permission.input,
  operator: "eq",
  expected: "student",
  label: t("Current or most recent permission was as a Student", "当前或最近一次许可为 Student"),
  nextStep: t("Check whether the current or most recent permission was on the Student route.", "请核实当前或最近一次许可是否为 Student 类别。"),
  source: permission.source,
} satisfies Condition;

const studentBasis = {
  id: "uk-sw-switch-student-basis",
  input: "answer:ukSkilledStudentSwitchBasis",
  operator: "in",
  expected: ["completed", "degree-start", "phd-start"],
  label: t("Student switch meets one of the course or sponsored start-date conditions", "从 Student 转换符合课程或担保入职日期条件之一"),
  nextStep: t("Confirm the qualifying course and dates with your education provider and sponsor before applying.", "递交前，请向学校和担保雇主核实适用的课程及日期。"),
  source: {
    url: validity,
    effectiveDateUrl: "https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-1496-17-july-2023/statement-of-changes-to-the-immigration-rules-hc-1496-17-july-2023-accessible",
    effectiveFrom: "2023-07-17",
    lastVerifiedAt: checkedAt,
    reviewStatus: "verified",
    applicableWhen: t("In-country applicants with current or most recent Student permission under SW 1.5A.", "适用于根据 SW 1.5A 境内申请且当前或最近一次持 Student 许可的人员。"),
    evidence: t("SW 1.5A covers completion of the CAS course or a permitted change under ST 27.3. Its other routes require full-time degree-level study with a compliant higher education provider and a CoS start no earlier than completion, or full-time PhD study at such a provider with a CoS start at least 24 months after the course began.", "SW 1.5A 适用于已完成 CAS 指定课程或 ST 27.3 允许的转修课程，或在有合规记录的高等教育机构全日制修读学位或以上课程且入职不早于课程完成日，或在该类机构全日制修读博士且入职距课程开始至少 24 个月。"),
  },
} satisfies Condition;

const switchingStatus = {
  id: "uk-sw-switch-immigration-status",
  input: "answer:ukSkilledSwitchStatus",
  operator: "in",
  expected: ["clear", "confirmed-exception"],
  label: t("Meets the SW 2.2 immigration status requirement", "符合 SW 2.2 的移民身份要求"),
  nextStep: t("Check SW 2.2 and Part Suitability if you are unsure about your immigration status or an exception.", "如不确定自身移民状态或例外是否适用，请核实 SW 2.2 和《适格性条款》。"),
  source: {
    url: appendix + "#suitability-requirements-for-a-skilled-worker",
    effectiveDateUrl: "https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-259-9-july-2026/statement-of-changes-to-the-immigration-rules-hc-259-9-july-2026-accessible",
    effectiveFrom: "2026-08-03",
    lastVerifiedAt: checkedAt,
    reviewStatus: "verified",
    applicableWhen: inside,
    evidence: t("SW 2.2 bars applicants in breach of immigration laws or on immigration bail, subject to the relevant exceptions in Part Suitability.", "SW 2.2 对违反移民法或处于移民保释状态的申请人设有限制，适用《适格性条款》的相关例外时除外。"),
  },
} satisfies Condition;

export const ukSwitchConditions = [permission, student, studentBasis, switchingStatus];

export const ukSwitchChecks: RuleExpression = {
  kind: "unless",
  test: { kind: "condition", conditionId: "uk-sw-entry-clearance" },
  requirement: {
    kind: "all",
    children: [
      { kind: "condition", conditionId: permission.id },
      { kind: "condition", conditionId: switchingStatus.id },
      {
        kind: "when",
        test: { kind: "condition", conditionId: student.id },
        requirement: { kind: "condition", conditionId: studentBasis.id },
      },
    ],
  },
};
