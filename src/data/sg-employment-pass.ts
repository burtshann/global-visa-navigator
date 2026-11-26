import type { Condition, Policy, RuleExpression, RuleSource } from "@/domain/policy";
import { sgEpCompassPolicy } from "./sg-ep-compass";

const momEligibility = "https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility";
const momKeyFacts = "https://www.mom.gov.sg/passes-and-permits/employment-pass/key-facts";
const verifiedOn = "2026-11-23T14:15:57Z";

// Each series follows MOM's age table exactly: 23 or younger, each year from
// 24 to 44, then 45 or older. Keep these amounts in the reviewable snapshot.
const bandStarts = [0, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45];

type SalarySchedule = Readonly<{
  from: string;
  until: string | null;
  effectiveDateUrl: string;
  otherSectors: readonly number[];
  financialServices: readonly number[];
}>;

const schedules: readonly SalarySchedule[] = [
  {
    from: "2025-01-01",
    until: "2027-01-01",
    effectiveDateUrl: "https://www.mom.gov.sg/newsroom/press-releases/2024/cos-foreign-workforce-policy-factsheet",
    otherSectors: [
      5600, 5832, 6064, 6295, 6527, 6759, 6991, 7223, 7455, 7686, 7918, 8150,
      8382, 8614, 8845, 9077, 9309, 9541, 9773, 10005, 10236, 10468, 10700,
    ],
    financialServices: [
      6200, 6455, 6709, 6964, 7218, 7473, 7727, 7982, 8236, 8491, 8745, 9000,
      9255, 9509, 9764, 10018, 10273, 10527, 10782, 11036, 11291, 11545, 11800,
    ],
  },
  {
    from: "2027-01-01",
    until: null,
    effectiveDateUrl: "https://www.mom.gov.sg/newsroom/press-releases/2026/0303-partnering-businesses-and-workers-to-thrive-in-a-changed-world",
    otherSectors: [
      6000, 6250, 6500, 6750, 7000, 7250, 7500, 7750, 8000, 8250, 8500, 8750,
      9000, 9250, 9500, 9750, 10000, 10250, 10500, 10750, 11000, 11250, 11500,
    ],
    financialServices: [
      6600, 6877, 7155, 7432, 7709, 7986, 8264, 8541, 8818, 9095, 9373, 9650,
      9927, 10205, 10482, 10759, 11036, 11314, 11591, 11868, 12145, 12423, 12700,
    ],
  },
];

function salaryTable(schedule: SalarySchedule, source: RuleSource): RuleExpression {
  return {
    kind: "threshold-table",
    id: "sg-ep-minimum-fixed-monthly-salary",
    input: "answer:sgEpFixedMonthlySalarySgd",
    bandInput: "answer:sgEpAge",
    categoryInput: "answer:sgEpFinancialSector",
    bandStarts,
    maximumBandInput: 120,
    categories: [
      { value: false, minimums: schedule.otherSectors },
      { value: true, minimums: schedule.financialServices },
    ],
    unit: { en: "SGD/month", zh: "新元/月" },
    label: { en: "Minimum fixed monthly salary for your age and the employer's sector", zh: "按你的年龄和雇主行业适用的最低固定月薪" },
    nextStep: { en: "Confirm the applicable age and sector with the employer, then check the qualifying rows and the offered fixed monthly salary with MOM.", zh: "请与雇主确认适用年龄及行业，再查看人力部的薪资表，核对录用所列的固定月薪。" },
    source,
  };
}

function salaryPolicy(schedule: SalarySchedule): Policy {
  const year = schedule.from.slice(0, 4);
  const salarySource: RuleSource = {
    url: momEligibility,
    effectiveDateUrl: schedule.effectiveDateUrl,
    applicableWhen: {
      en: "MOM Employment Pass qualifying salary, Stage 1, for ordinary first applications. Select the employer's sector and candidate's age for the application.",
      zh: "新加坡人力部就业准证第一阶段薪资要求，适用于普通首次申请，按雇主行业和申请人提交时年龄查表。",
    },
    evidence: {
      en: "MOM publishes fixed monthly qualifying salary amounts by age and by whether the employer is classified in financial services. Fixed monthly salary consists of monthly basic pay and fixed monthly allowances. Variable pay, bonuses, overtime and reimbursements do not count.",
      zh: "新加坡人力部按年龄及雇主是否属于金融服务业公布最低固定月薪。固定月薪包括基本月薪和固定月津贴。浮动工资、奖金、加班费和报销款均不计入。",
    },
    effectiveFrom: schedule.from,
    effectiveUntil: schedule.until,
    lastVerifiedAt: verifiedOn,
    reviewStatus: "verified",
  };

  return {
    id: `sg-ep-stage-1-${year}`,
    version: "2026-11-23.1",
    stage: "application",
    name: {
      en: `First application salary check (${year} schedule)`,
      zh: `首次申请薪资核对（${year} 年标准）`,
    },
    scope: {
      en: "Checks a Singapore job offer and the published Stage 1 fixed monthly salary for ordinary first applications. COMPASS, its exemptions, employer advertising, renewals, special flexibilities and overall eligibility need separate review.",
      zh: "核对普通首次申请的在新加坡工作的录用及第一阶段固定月薪。COMPASS 评估及豁免、雇主招聘广告、续签、特殊安排及完整资格须另行核实。",
    },
    conditions: [
      {
        id: "sg-ep-first-application",
        input: "answer:sgEpInitialApplication",
        operator: "eq",
        expected: true,
        label: { en: "This is an ordinary first Employment Pass application", zh: "这是普通就业准证的首次申请" },
        nextStep: { en: "Confirm that the new application schedule applies to you. Renewals have a separate schedule.", zh: "请确认你适用首次申请标准。续签另有生效安排。" },
        source: salarySource,
      },
      {
        id: "sg-ep-singapore-job-offer",
        input: "answer:sgEpSingaporeJobOffer",
        operator: "eq",
        expected: true,
        label: { en: "You have a job offer to work in Singapore", zh: "你已获得在新加坡工作的录用" },
        nextStep: { en: "Confirm the Singapore job offer with the employer. The employer or its appointed agent normally applies for the pass.", zh: "请与雇主确认你已获得在新加坡工作的录用。准证通常由雇主或指定代理申请。" },
        source: {
          url: momKeyFacts,
          applicableWhen: { en: "Employment Pass candidate and application requirements.", zh: "就业准证适用人群及申请方式。" },
          evidence: { en: "The Employment Pass is for foreign professionals, managers and executives with a job offer in Singapore.", zh: "就业准证面向已获得在新加坡工作的录用的外籍专业人士、管理人员及高管。" },
          effectiveFrom: null,
          lastVerifiedAt: verifiedOn,
          reviewStatus: "verified",
        },
      },
    ],
    expression: {
      kind: "when",
      test: { kind: "condition", conditionId: "sg-ep-first-application" },
      requirement: {
        kind: "all",
        children: [
          { kind: "condition", conditionId: "sg-ep-singapore-job-offer" },
          salaryTable(schedule, salarySource),
        ],
      },
    },
  };
}

const renewalPage = "https://www.mom.gov.sg/passes-and-permits/employment-pass/renew-a-pass";
const renewalSources: readonly [RuleSource, RuleSource] = [
  {
    url: momEligibility,
    effectiveDateUrl: schedules[0].effectiveDateUrl,
    applicableWhen: {
      en: "Ordinary renewals for passes expiring from 1 January 2026 to 31 December 2027.",
      zh: "适用于准证在 2026 年 1 月 1 日至 2027 年 12 月 31 日到期的普通续签。",
    },
    evidence: {
      en: "MOM applies the published age and sector salary table based on the pass expiry date. Use fixed monthly salary in SGD.",
      zh: "新加坡人力部按现有准证到期日选用公布的年龄及行业薪资表。工资按新元固定月薪计算。",
    },
    effectiveFrom: "2026-01-01",
    lastVerifiedAt: "2026-11-26T18:04:30Z",
    reviewStatus: "verified",
  },
  {
    url: momEligibility,
    effectiveDateUrl: schedules[1].effectiveDateUrl,
    effectiveDateNote: {
      en: "Passes expiring from 1 January 2028",
      zh: "2028 年 1 月 1 日起到期的准证",
    },
    applicableWhen: {
      en: "Ordinary renewals for passes expiring on or after 1 January 2028, including renewals filed before that date.",
      zh: "适用于准证在 2028 年 1 月 1 日或以后到期的普通续签，包括在该日期前递交的续签。",
    },
    evidence: {
      en: "MOM's revised age and sector thresholds apply to passes expiring from 1 January 2028. The expiry date selects the table even when the employer files early.",
      zh: "新加坡人力部调整后的年龄及行业薪资门槛适用于 2028 年 1 月 1 日起到期的准证。即使雇主提前递交，仍以准证到期日选用薪资表。",
    },
    // This source also governs advance renewals. The cutover is a pass-expiry
    // condition in the collected profile, not the assessment date.
    effectiveFrom: null,
    lastVerifiedAt: "2026-11-26T18:04:30Z",
    reviewStatus: "verified",
  },
];

const renewalScopeSource: RuleSource = {
  url: renewalPage,
  applicableWhen: { en: "Renewals of an existing Employment Pass.", zh: "适用于现有就业准证的续签。" },
  evidence: {
    en: "An EP renewal requires the candidate to keep working for the same employer in a managerial, executive or specialised job. Ordinary EP renewals may be filed up to six months before expiry.",
    zh: "EP 续签要求申请人在同一雇主处继续从事管理、高管或专业岗位。普通 EP 最早可于到期前六个月提交续签。",
  },
  effectiveFrom: null,
  lastVerifiedAt: "2026-11-26T18:04:30Z",
  reviewStatus: "verified",
};

const renewalDateConditions: readonly Condition[] = [
  {
    id: "sg-ep-renewal-covered-expiry",
    input: "answer:sgEpRenewalExpiryDate",
    operator: "gte",
    expected: 20260101,
    label: { en: "The current pass expires on or after 1 January 2026", zh: "现有准证到期日为 2026 年 1 月 1 日或以后" },
    nextStep: { en: "Enter the expiry date shown on the current pass. Check earlier expiry dates directly with MOM.", zh: "填写现有准证上显示的到期日。若早于该日期，请向新加坡人力部核实。" },
    source: renewalSources[0],
  },
  {
    id: "sg-ep-renewal-before-2028",
    input: "answer:sgEpRenewalExpiryDate",
    operator: "lte",
    expected: 20271231,
    label: { en: "The current pass expires before 1 January 2028", zh: "现有准证在 2028 年 1 月 1 日之前到期" },
    nextStep: { en: "Check the expiry date printed on the current pass.", zh: "核对现有准证上显示的到期日。" },
    source: renewalSources[0],
  },
  {
    id: "sg-ep-renewal-from-2028",
    input: "answer:sgEpRenewalExpiryDate",
    operator: "gte",
    expected: 20280101,
    label: { en: "The current pass expires on or after 1 January 2028", zh: "现有准证到期日为 2028 年 1 月 1 日或以后" },
    nextStep: { en: "Check the expiry date printed on the current pass.", zh: "核对现有准证上显示的到期日。" },
    source: renewalSources[1],
  },
];

const renewalPolicy: Policy = {
  id: "sg-ep-stage-1-renewal",
  version: "2026-11-26.1",
  stage: "application",
  name: { en: "Employment Pass renewal salary check", zh: "就业准证续签薪资核对" },
  scope: {
    en: "Checks ordinary renewals for the same employer and selects the Stage 1 salary table using the current pass expiry date. The employer still needs to confirm when to file, any special provisions and other renewal requirements.",
    zh: "核对同一雇主的普通续签，并按照现有准证到期日选用第一阶段薪资表。递交时限、特殊安排和其他续签要求仍需雇主确认。",
  },
  conditions: [
    {
      id: "sg-ep-is-renewal",
      input: "answer:sgEpInitialApplication",
      operator: "eq",
      expected: false,
      label: { en: "This is a renewal of an existing Employment Pass", zh: "正在续签现有就业准证" },
      nextStep: { en: "Confirm whether you are renewing an existing pass.", zh: "请确认是否为现有准证续签。" },
      source: renewalScopeSource,
    },
    {
      id: "sg-ep-renewal-same-employer",
      input: "answer:sgEpRenewalSameEmployerRole",
      operator: "eq",
      expected: true,
      label: { en: "You will continue in a managerial, executive or specialised job with the same employer", zh: "你将继续在同一雇主处从事管理、高管或专业岗位" },
      nextStep: { en: "Check the employer and role with MOM. For a change of employer, ask about a new pass application.", zh: "请向新加坡人力部核实雇主和岗位。更换雇主时，请核实新申请要求。" },
      source: renewalScopeSource,
    },
    ...renewalDateConditions,
  ],
  expression: {
    kind: "when",
    test: {
      kind: "all",
      children: [
        { kind: "condition", conditionId: "sg-ep-is-renewal" },
        { kind: "condition", conditionId: "sg-ep-renewal-covered-expiry" },
      ],
    },
    requirement: {
      kind: "all",
      children: [
        { kind: "condition", conditionId: "sg-ep-renewal-same-employer" },
        {
          kind: "any",
          children: ["sg-ep-renewal-before-2028", "sg-ep-renewal-from-2028"].map((conditionId, index) => ({
            kind: "when",
            test: { kind: "condition", conditionId },
            requirement: salaryTable(schedules[index], renewalSources[index]),
          })),
        },
      ],
    },
  },
};

export const sgEmploymentPassPolicies: readonly Policy[] = [
  ...schedules.map(salaryPolicy),
  renewalPolicy,
  sgEpCompassPolicy,
];
