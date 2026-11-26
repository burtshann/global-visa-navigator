import type { Condition, Localized, Policy, RuleExpression, RuleSource, ScoreCategory } from "../domain/policy";

const momEligibility = "https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility";
const renewalPage = "https://www.mom.gov.sg/passes-and-permits/employment-pass/renew-a-pass";
const sat = "MOM’s Self-Assessment Tool (SAT)";
const verifiedAt = "2026-11-26T18:04:30Z";

type Criterion = {
  id: string;
  label: Localized;
  evidence: Localized;
  awards: readonly number[];
};

export const sgEpCompassCriteria: readonly Criterion[] = [
  {
    id: "sgEpCompassC1",
    label: { en: "C1 · Salary benchmark", zh: "C1 · 薪资基准" },
    evidence: {
      en: "MOM awards 20 points from the 90th percentile, 10 from the 65th to below the 90th, and zero below the 65th. Benchmarks depend on the applicable sector, age and benchmark edition.",
      zh: "按适用行业、年龄及基准版本，薪资达到第 90 百分位得 20 分，第 65 至不足第 90 百分位得 10 分，低于第 65 百分位得 0 分。",
    },
    awards: [0, 10, 20],
  },
  {
    id: "sgEpCompassC2",
    label: { en: "C2 · Qualifications", zh: "C2 · 学历及专业资格" },
    evidence: {
      en: "MOM awards 20 points for degree-equivalent qualifications from listed top-tier institutions, 10 for other accepted degree-equivalent or eligible professional qualifications, and zero without qualifying evidence.",
      zh: "人力部对清单内顶尖院校授予的等同学位资格计 20 分，其他认可的等同学位或合格专业资格计 10 分，无符合要求的证明计 0 分。",
    },
    awards: [0, 10, 20],
  },
  {
    id: "sgEpCompassC3",
    label: { en: "C3 · Employer workforce diversity", zh: "C3 · 雇主员工国籍多样性" },
    evidence: {
      en: "Firms with fewer than 25 PMET employees receive 10 points. At other firms, a candidate's nationality share below 5%, from 5% to below 25%, or 25% and above earns 20, 10, or zero points respectively. Use the employer's current MOM workforce data.",
      zh: "雇主的专业、管理及技术类员工（PMET）少于 25 人时计 10 分。其他雇主按候选人国籍在该群体中的占比计分，低于 5% 得 20 分，5% 至不足 25% 得 10 分，25% 或以上得 0 分。应使用雇主在人力部的最新员工资料。",
    },
    awards: [0, 10, 20],
  },
  {
    id: "sgEpCompassC4",
    label: { en: "C4 · Support for local employment", zh: "C4 · 支持本地就业" },
    evidence: {
      en: "Firms with fewer than 25 PMET employees receive 10 points. Otherwise the employer's sector-relative local share earns 20 points from the 50th percentile, 10 from the 20th to below the 50th, and zero below the 20th. Firms with a local PMET share of at least 70% score at least 10 points.",
      zh: "雇主的专业、管理及技术类员工（PMET）少于 25 人时计 10 分。其他雇主按本地 PMET 占比在同行业中的水平计分，第 50 百分位起得 20 分，第 20 至不足第 50 百分位得 10 分，低于第 20 百分位得 0 分。本地 PMET 占比至少 70% 时至少得 10 分。",
    },
    awards: [0, 10, 20],
  },
  {
    id: "sgEpCompassC5",
    label: { en: "C5 · Shortage Occupation List bonus", zh: "C5 · 短缺职业清单加分" },
    evidence: {
      en: "A verified Shortage Occupation List role can earn 20 points or 10 when the candidate's nationality share among the firm's PMET employees is at least one-third. Where the application relies on this bonus, the employer must also verify the applicable job and candidate requirements.",
      zh: "经核实符合短缺职业清单的岗位可得 20 分。候选人国籍占雇主专业、管理及技术类员工至少三分之一时，降为 10 分。如需依靠此项加分，雇主还须核实适用的岗位和候选人要求。",
    },
    awards: [0, 10, 20],
  },
  {
    id: "sgEpCompassC6",
    label: { en: "C6 · Strategic Economic Priorities bonus", zh: "C6 · 战略经济重点加分" },
    evidence: {
      en: "The relevant agency may award 10 points for an eligible programme. MOM notifies the employer of the award, and the currently valid points appear in SAT.",
      zh: "主管机构可基于符合要求的计划给予 10 分。人力部会通知雇主，当前有效的加分显示在自评工具中。",
    },
    awards: [0, 10],
  },
];

const source: RuleSource = {
  url: momEligibility,
  effectiveDateUrl: renewalPage,
  applicableWhen: {
    en: "COMPASS Stage 2 for new Employment Pass applications and renewals subject to COMPASS. Renewal coverage here begins with passes expiring on 1 September 2024.",
    zh: "适用于须接受 COMPASS 核对的就业准证新申请及续签。续签自准证在 2024 年 9 月 1 日到期时起纳入。",
  },
  evidence: {
    en: "MOM requires at least 40 points from C1 to C6 unless an exemption applies. The Stage 1 qualifying salary is evaluated separately.",
    zh: "除适用豁免外，人力部要求 C1 至 C6 合计至少 40 分。第一阶段的最低薪资另行核对。",
  },
  effectiveFrom: "2024-09-01",
  lastVerifiedAt: verifiedAt,
  reviewStatus: "verified",
};

const compassScope: readonly Condition[] = [
  {
    id: "sg-ep-compass-new",
    input: "answer:sgEpInitialApplication",
    operator: "eq",
    expected: true,
    label: { en: "This is a new Employment Pass application", zh: "这是就业准证新申请" },
    nextStep: { en: "Choose the application type.", zh: "请选择申请类型。" },
    source,
  },
  {
    id: "sg-ep-compass-renewal",
    input: "answer:sgEpInitialApplication",
    operator: "eq",
    expected: false,
    label: { en: "This is a renewal of an existing Employment Pass", zh: "正在续签现有就业准证" },
    nextStep: { en: "Choose the application type.", zh: "请选择申请类型。" },
    source,
  },
  {
    id: "sg-ep-compass-renewal-expiry",
    input: "answer:sgEpRenewalExpiryDate",
    operator: "gte",
    expected: 20240901,
    label: { en: "The current pass expires on or after 1 September 2024", zh: "现有准证到期日为 2024 年 9 月 1 日或以后" },
    nextStep: { en: "Enter the expiry date shown on the current pass.", zh: "填写现有准证上显示的到期日。" },
    source: {
      ...source,
      url: renewalPage,
      evidence: {
        en: "MOM applies COMPASS to renewals of passes expiring from 1 September 2024.",
        zh: "新加坡人力部规定，现有准证在 2024 年 9 月 1 日或以后到期的续签适用 COMPASS。",
      },
    },
  },
];

export const sgEpCompassExemptions: readonly Condition[] = [
  {
    id: "sg-ep-compass-salary-exemption",
    input: "answer:sgEpFixedMonthlySalarySgd",
    operator: "gte",
    expected: 22_500,
    label: { en: "Fixed monthly salary of at least SGD 22,500", zh: "固定月薪至少 22,500 新加坡元" },
    nextStep: { en: "Check the fixed monthly salary with your employer.", zh: "请与雇主核实固定月薪。" },
    source: {
      ...source,
      evidence: { en: "MOM exempts candidates earning at least SGD 22,500 in fixed monthly salary.", zh: "新加坡人力部豁免固定月薪至少 22,500 新加坡元的候选人。" },
    },
  },
  {
    id: "sg-ep-compass-ict-exemption",
    input: "answer:sgEpCompassOverseasIct",
    operator: "eq",
    expected: true,
    label: { en: "Employer-confirmed overseas intra-corporate transfer", zh: "雇主已确认符合海外公司内部调动资格" },
    nextStep: {
      en: "Ask the employer to confirm that this application meets the overseas ICT definition under WTO GATS or a relevant Singapore trade agreement.",
      zh: "请雇主确认此次申请符合 WTO《服务贸易总协定》或新加坡参与的适用贸易协定对海外公司内部调动的定义。",
    },
    source: {
      ...source,
      url: "https://www.mom.gov.sg/faq/fair-consideration-framework/can-a-job-be-exempted-from-the-advertising-requirement-if-it-will-be-filled-by-an-intra-corporate-transferee-ict",
      effectiveDateUrl: momEligibility,
      evidence: {
        en: "MOM's COMPASS exemption directs employers to its ICT definition under WTO GATS or an applicable FTA. A transfer within a company by itself does not establish the treaty basis.",
        zh: "COMPASS 豁免须符合人力部依据 WTO《服务贸易总协定》或适用贸易协定规定的海外公司内部调动定义。仅属于同一公司内部调任不足以证明符合协定。",
      },
    },
  },
  {
    id: "sg-ep-compass-short-role-exemption",
    input: "answer:sgEpCompassShortRole",
    operator: "eq",
    expected: true,
    label: { en: "Employer-confirmed role lasting one month or less", zh: "雇主已确认岗位期限为一个月或更短" },
    nextStep: { en: "Ask the employer to confirm the duration of the role for this application.", zh: "请雇主核实本次申请对应的岗位期限。" },
    source: {
      ...source,
      evidence: { en: "MOM exempts candidates filling a role for one month or less.", zh: "新加坡人力部豁免任职期限为一个月或更短的候选人。" },
    },
  },
];

const tierConditions: Condition[] = [];
const categories: ScoreCategory[] = sgEpCompassCriteria.map(({ id, label, evidence, awards }) => ({
  id,
  alternatives: awards.filter((award) => award > 0).map((award) => {
    const conditionId = `${id}-${award}`;
    tierConditions.push({
      id: conditionId,
      input: `answer:${id}`,
      operator: "eq",
      expected: String(award),
      label: { en: `${label.en} · ${award} points confirmed`, zh: `${label.zh} · 已确认 ${award} 分` },
      nextStep: {
        en: `Ask the employer for the points from ${sat} for this application, including any evidence the tool requires.`,
        zh: "请雇主用人力部自评工具核对此次申请的积分，并确认相关证明。",
      },
      source: { ...source, evidence },
    });
    return { points: award, when: { kind: "condition", conditionId } };
  }),
}));

const condition = (conditionId: string): RuleExpression => ({ kind: "condition", conditionId });

export const sgEpCompassPolicy: Policy = {
  id: "sg-ep-stage-2-compass",
  version: "2026-11-26.1",
  stage: "application",
  name: { en: "COMPASS points or exemption check", zh: "COMPASS 积分或豁免核对" },
  scope: {
    en: "Checks documented COMPASS exemptions and the 40-point requirement from employer-confirmed scores for this application. The qualifying salary, evidence, employer obligations and full Employment Pass eligibility are separate checks.",
    zh: "根据本次申请中雇主已核实的积分及豁免依据，核对是否适用豁免或达到 40 分。第一阶段薪资、证明材料、雇主义务及就业准证完整资格须另行核对。",
  },
  conditions: [...compassScope, ...sgEpCompassExemptions, ...tierConditions],
  expression: {
    kind: "when",
    test: {
      kind: "any",
      children: [
        condition("sg-ep-compass-new"),
        {
          kind: "when",
          test: condition("sg-ep-compass-renewal"),
          requirement: condition("sg-ep-compass-renewal-expiry"),
        },
      ],
    },
    requirement: {
      kind: "any",
      summary: {
        id: "sg-ep-compass-requirement",
        label: { en: "COMPASS exemption or at least 40 points", zh: "符合 COMPASS 豁免或达到至少 40 分" },
        nextStep: {
          en: "Ask the employer to confirm exemption evidence or the individual SAT scores. Leave unverified items blank.",
          zh: "请雇主核对豁免证明或自评工具的分项积分。未确认的项目请留空。",
        },
      },
      children: [
        {
          kind: "any",
          summary: {
            id: "sg-ep-compass-exemption",
            label: { en: "One of the COMPASS exemptions applies", zh: "适用至少一项 COMPASS 豁免" },
            nextStep: { en: "Confirm with the employer whether any exemption applies.", zh: "与雇主核实是否适用任何豁免。" },
          },
          children: sgEpCompassExemptions.map(({ id }) => condition(id)),
        },
        {
          kind: "points",
          id: "sg-ep-compass-score",
          label: { en: "COMPASS points (when no exemption applies)", zh: "COMPASS 积分（无适用豁免时）" },
          nextStep: {
            en: `Verify the C1 to C6 points with the employer using ${sat}. Zero points must also be confirmed.`,
            zh: "请雇主用人力部自评工具核实 C1 至 C6 的积分。0 分也须确认。",
          },
          source,
          minimum: 40,
          categories,
        },
      ],
    },
  },
};
