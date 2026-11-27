import type { Condition, Localized, Policy } from "../domain/policy";
import { generalSalary, goingRate, hourlySalary, optionA, table1Occupation } from "./uk-skilled-worker-standard";

const t = (en: string, zh: string): Localized => ({ en, zh });

const appendix = "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-skilled-worker";
const sponsorshipRules = `${appendix}#points-for-sponsorship-mandatory`;
const introduction = "https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-813-22-october-2020";
const englishChange = "https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-1333-14-october-2025/statement-of-changes-to-the-immigration-rules-hc-1333-14-october-2025-accessible-version";
const visaBrakeGuidance = "https://www.gov.uk/guidance/visa-brake-changes-to-the-uk-visa-system";
const verified = { lastVerifiedAt: "2026-11-23T14:16:05Z", reviewStatus: "verified" } as const;
const originalSource = { ...verified, effectiveFrom: "2020-12-01", effectiveDateUrl: introduction };
const englishSource = { ...verified, effectiveFrom: "2026-01-08", effectiveDateUrl: englishChange };
const visaBrakeSource = {
  url: appendix + "#eligibility-requirements-for-a-skilled-worker",
  effectiveFrom: "2026-03-26",
  effectiveDateUrl: visaBrakeGuidance,
  lastVerifiedAt: "2026-11-26",
  reviewStatus: "verified",
} as const;

const validityRules = appendix + "#validity-requirements-for-a-skilled-worker";
const verification = { lastVerifiedAt: "2026-11-27T12:04:43Z", reviewStatus: "verified" } as const;
const cosSource = { ...originalSource, ...verification, url: sponsorshipRules };
const certificateChecks = [
  {
    id: "uk-sw-cos-issue-window",
    input: "answer:ukSkilledCosIssueInWindow",
    operator: "eq",
    expected: true,
    label: t("CoS issued within the applicable submission window", "担保证明在适用的递交期限内签发"),
    nextStep: t("Confirm the issue date and the period that applies to this CoS with your sponsor before you submit.", "请在递交前向雇主核实担保证明的签发日和适用期限。"),
    source: {
      ...verification,
      url: validityRules,
      effectiveFrom: "2025-04-09",
      effectiveDateUrl: "https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-733-12-march-2025/statement-of-changes-to-the-immigration-rules-hc-733-12-march-2025-accessible-version",
      applicableWhen: t("CoS issue timing under SW 1.2(d), including the Sponsor a Worker version.", "适用 SW 1.2(d) 的担保证明签发时限，包括 Sponsor a Worker 系统适用的时限。"),
      evidence: t("Normally the CoS must have been issued no more than three months before application. An SRN-linked CoS uses 90 days, excluding days spent reviewing sponsor-requested edits.", "通常须在申请日前三个月内签发。关联担保参考编号（SRN）的证书适用 90 天，扣除雇主请求的修改处于审核中的天数。"),
    },
  },
  {
    id: "uk-sw-cos-start-window",
    input: "answer:ukSkilledCosStartInWindow",
    operator: "eq",
    expected: true,
    label: t("The CoS start date falls no more than three months after applying", "担保证明注明的入职日不晚于申请日后三个月"),
    nextStep: t("Compare your planned submission date with the start date on the CoS and ask your sponsor to confirm.", "请将计划递交日与担保证明上的入职日期比对，并请雇主确认。"),
    source: {
      ...cosSource,
      applicableWhen: t("CoS start date under SW 5.1(c).", "适用 SW 5.1(c) 的担保证明入职日期。"),
      evidence: t("The sponsor must state a start date no more than three months after the date of application.", "雇主必须注明入职日，且该日期不得晚于申请日后三个月。"),
    },
  },
  {
    id: "uk-sw-cos-usable",
    input: "answer:ukSkilledCosUsable",
    operator: "eq",
    expected: true,
    label: t("The CoS remains usable for this application", "担保证明仍可用于本次申请"),
    nextStep: t("Check with your sponsor for withdrawal, cancellation or previous use in a granted or refused application.", "请向雇主核实担保证明是否已撤回、取消，或已用于获批或被拒的申请。"),
    source: {
      ...cosSource,
      applicableWhen: t("Previous use and current status under SW 5.1(d)–(e).", "适用 SW 5.1(d) 至 (e) 的既往使用和当前状态。"),
      evidence: t("A CoS must not be withdrawn or cancelled, or already used for a grant or refusal. Earlier invalid, void or withdrawn applications are exceptions to the reuse restriction.", "证明不得已被撤回或取消，也不得已用于获批或被拒的申请。因无效退回、作废或撤回的既往申请不受该重复使用限制。"),
    },
  },
  {
    id: "uk-sw-atas",
    input: "answer:ukSkilledAtasBasis",
    operator: "in",
    expected: ["not-required", "valid"],
    label: t("CoS confirms the ATAS requirement, with a valid certificate if needed", "担保证明已说明是否需要 ATAS，如需要则持有有效证书"),
    nextStep: t("Ask the sponsor whether ATAS applies and obtain a valid ATAS certificate if required.", "请雇主确认是否适用 ATAS。如适用，请取得有效证书。"),
    source: {
      ...verification,
      url: sponsorshipRules,
      effectiveFrom: "2021-05-21",
      effectiveDateUrl: "https://www.gov.uk/government/publications/skilled-worker-visa-caseworker-guidance/skilled-worker-caseworker-guidance-accessible",
      applicableWhen: t("CoS confirmation under SW 5.1(f) and applicable ATAS evidence under SW 6.3A.", "适用 SW 5.1(f) 的担保确认及 SW 6.3A 的 ATAS 证明。"),
      evidence: t("The sponsor confirms whether ATAS applies. From 21 May 2021 the applicant must provide a valid certificate where the Appendix ATAS criteria apply.", "雇主须确认是否适用 ATAS。自 2021 年 5 月 21 日起，申请人符合《ATAS 附录》所列条件时须提供有效证书。"),
    },
  },
] satisfies readonly Condition[];

export const ukSkilledWorkerPolicy: Policy = {
  id: "uk-skilled-worker-initial",
  version: "2026-11-27.1",
  stage: "application",
  name: t("First Skilled Worker application", "首次申请技术工人签证"),
  scope: t(
    "This check covers first principal applications under standard salary Option A for a Table 1 job. It checks selected CoS, sponsorship, English and salary requirements using sponsor-confirmed evidence. Other salary options, transition rules, variable hours, maintenance, suitability and full eligibility need separate review.",
    "本核查适用于以标准薪资选项 A 首次申请的主申请人，岗位须列于表 1。根据雇主确认的资料核对部分担保证明、担保资质、英语和薪资要求。其他薪资选项、过渡安排、变动工时、生活费、适格性及完整资格须另行核实。",
  ),
  conditions: [
    {
      id: "uk-sw-first-application",
      input: "answer:ukSkilledWorkerInitial",
      operator: "eq",
      expected: true,
      label: t("Seeking your first grant as the principal Skilled Worker", "作为主申请人首次寻求获批技术工人许可"),
      nextStep: t("Use the official guidance for extending or updating existing Skilled Worker permission, or for dependants.", "如要续签或变更现有许可，或以家属身份申请，请查阅相应官方指南。"),
      source: {
        ...englishSource,
        url: appendix,
        applicableWhen: t("This screening scope excludes cases with prior Skilled Worker permission. See SW 4.1 and SW 5.3 for the prior-permission exceptions.", "本核查范围不含曾获技术工人许可的情况。既往许可相关例外见 SW 4.1 和 SW 5.3。"),
        evidence: t("The current rules have separate provisions for people who previously held Skilled Worker permission. This limited check applies the initial-application conditions.", "现行规则对曾获技术工人许可者另有规定。本核查采用首次申请条件。"),
      },
    },
    {
      id: "uk-sw-entry-clearance",
      input: "answer:ukSkilledApplyingFromAbroad",
      operator: "eq",
      expected: true,
      label: t("Applying from outside the UK for entry clearance", "从英国境外提交入境许可申请"),
      nextStep: t("Confirm whether you will apply from outside the UK or apply for permission to stay from within the UK.", "确认你将从英国境外申请入境许可，还是在英国境内申请居留许可。"),
      source: {
        ...visaBrakeSource,
        applicableWhen: t("The restriction in SW 3.3 applies to entry clearance applications.", "SW 3.3 的限制适用于入境许可申请。"),
      },
    },
    {
      id: "uk-sw-entry-nationality",
      input: "answer:ukSkilledUsingAfghanNationality",
      operator: "eq",
      expected: false,
      label: t("The main nationality used for entry clearance is other than Afghan", "入境许可申请所用主要国籍为阿富汗以外的国籍"),
      nextStep: t("Check the Home Office visa brake guidance. Skilled Worker entry clearance applications using Afghan nationality are refused even with a valid CoS.", "查阅英国内政部的签证限制指南。以阿富汗国籍申请 Skilled Worker 入境许可，即使有有效的担保证明也会被拒。"),
      source: {
        ...visaBrakeSource,
        applicableWhen: t("Main applicants who apply for Skilled Worker entry clearance, SW 3.3.", "申请 Skilled Worker 入境许可的主申请人，见 SW 3.3。"),
        evidence: t("The Home Office uses the main nationality in the application. For a dual national applying under a different nationality, this restriction does not apply.", "英国内政部以此次申请所填的主要国籍为准。双重国籍申请人以其他国籍申请时，不受此项限制。"),
      },
    },
    {
      id: "uk-sw-age",
      input: "answer:ukSkilledAge",
      operator: "gte",
      expected: 18,
      label: t("At least 18 years old on the application date", "在申请提交日年满 18 岁"),
      nextStep: t("Check your age on the intended submission date under SW 1.3.", "按 SW 1.3 核对你在计划提交申请当日的年龄。"),
      source: {
        ...originalSource,
        url: `${appendix}#validity-requirements-for-a-skilled-worker`,
        applicableWhen: t("Application validity requirement, SW 1.3.", "申请有效性要求，SW 1.3。"),
        evidence: t("The principal applicant must have reached age 18 by the date of application.", "主申请人须在提交申请当日年满 18 岁。"),
      },
    },
    {
      id: "uk-sw-job-cos",
      input: "answer:ukSkilledJobCos",
      operator: "eq",
      expected: true,
      label: t("Certificate of Sponsorship assigned for your specific offered job", "已获得针对获聘岗位签发的担保证明"),
      nextStep: t("Ask your employer for the Certificate of Sponsorship covering the role. If applying from outside the UK, confirm they assigned a Defined CoS.", "请雇主提供对应岗位的担保证明。如在英国境外申请，请确认雇主已签发指定担保证明（Defined CoS）。"),
      source: {
        ...cosSource,
        applicableWhen: t("Job-specific sponsorship evidence requirements, SW 5.1(a)–(b).", "针对具体岗位的担保证明要求，SW 5.1(a)–(b)。"),
        evidence: t("A CoS identifies the applicant, Skilled Worker sponsorship, the offered job and pay, and PAYE details when required. For entry clearance, the Home Office must allocate the CoS for that specific job and salary.", "担保证明须载明申请人、技术工人担保类别、岗位及薪资，并在适用时包含 PAYE 信息。申请入境许可时，英国内政部须按该岗位和薪资为雇主分配证明。"),
      },
    },
    {
      id: "uk-sw-sponsor",
      input: "answer:ukSkilledSponsorRated",
      operator: "eq",
      expected: true,
      label: t("A-rated Skilled Worker sponsor authorised to sponsor your job", "获准担保该岗位的 A 级技术工人担保方"),
      nextStep: t("Check the official sponsor register for the Skilled Worker route and ask the employer to confirm they are authorised to sponsor this job.", "在官方登记册查验该雇主的技术工人担保评级，并请雇主确认获准担保该岗位。"),
      source: {
        ...originalSource,
        url: "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers",
        applicableWhen: t("First-time sponsorship under SW 5.2–5.3.", "首次申请的担保条件，SW 5.2–5.3。"),
        evidence: t("The Home Office requires the employer to be authorised for the job and listed as A-rated. The same-sponsor continuation exception concerns applicants with prior Skilled Worker permission.", "英国内政部要求担保方获准担保该岗位，并在登记册中列为 A 级。同一雇主续签例外适用于已获技术工人许可的人。"),
      },
    },
    {
      id: "uk-sw-english",
      input: "answer:ukSkilledEnglishBasis",
      operator: "in",
      expected: ["selt-b2", "other-verified-evidence"],
      label: t("Accepted English language evidence", "已具备符合规定的英语证明"),
      nextStep: t("Check the accepted evidence routes on GOV.UK. If using a test, check that the approved result is still valid and proves B2 or higher in reading, writing, speaking and listening.", "请查阅 GOV.UK 上认可的证明方式。如通过考试证明，请确认认可考试结果仍有效，且听、说、读、写均达到 B2 或以上。"),
      source: {
        ...englishSource,
        url: "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-english-language",
        applicableWhen: t("Initial English requirement under SW 4.1 and SW 7.1–7.3, using an applicable Appendix English Language evidence route.", "首次申请的英语要求见 SW 4.1 和 SW 7.1–7.3，证明方式依《英语语言附录》的适用条款。"),
        evidence: t("The required level is B2. A test-based claim under EL 6.1 needs a valid approved test reference covering all four skills within two years before applying. Other evidence can satisfy the requirement under the relevant Appendix English Language provisions.", "要求等级为 B2。按 EL 6.1 以考试证明时，须提供在申请日前两年内获得的认可考试有效参考编号，并符合四项能力要求。其他证明可按《英语语言附录》相应条款认定。"),
      },
    },
    ...certificateChecks,
    optionA,
    table1Occupation,
    generalSalary,
    hourlySalary,
  ],
  expression: {
    kind: "when",
    test: { kind: "condition", conditionId: "uk-sw-first-application" },
    requirement: {
      kind: "when",
      test: {
        kind: "all",
        children: [
          { kind: "condition", conditionId: optionA.id },
          { kind: "condition", conditionId: table1Occupation.id },
        ],
      },
      requirement: {
        kind: "all",
        children: [
          {
            kind: "when",
            test: { kind: "condition", conditionId: "uk-sw-entry-clearance" },
            requirement: { kind: "condition", conditionId: "uk-sw-entry-nationality" },
          },
          { kind: "condition", conditionId: "uk-sw-age" },
          { kind: "condition", conditionId: "uk-sw-job-cos" },
          { kind: "condition", conditionId: "uk-sw-sponsor" },
          { kind: "condition", conditionId: "uk-sw-english" },
          ...certificateChecks.map(({ id }) => ({ kind: "condition" as const, conditionId: id })),
          { kind: "condition", conditionId: generalSalary.id },
          { kind: "condition", conditionId: hourlySalary.id },
          goingRate,
        ],
      },
    },
  },
};
