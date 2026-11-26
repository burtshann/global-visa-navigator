import type { Policy, RuleSource } from "@/domain/policy";

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
          {
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
            source: salarySource,
          },
        ],
      },
    },
  };
}

export const sgEmploymentPassPolicies: readonly Policy[] = schedules.map(salaryPolicy);
