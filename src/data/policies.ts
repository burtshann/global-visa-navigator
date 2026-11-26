import type { Policy, RuleSource } from "@/domain/policy";

const verifiedDate = "2026-11-23";
const ukRules = "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-graduate";

const ukGraduateSource = {
  url: ukRules,
  effectiveFrom: "2021-07-01",
  lastVerifiedAt: verifiedDate,
  reviewStatus: "verified",
} satisfies Omit<RuleSource, "applicableWhen">;

const opportunityCardSource = {
  effectiveFrom: "2024-06-01",
  lastVerifiedAt: verifiedDate,
  reviewStatus: "verified",
} satisfies Omit<RuleSource, "url" | "applicableWhen">;

export const ukGraduatePolicy = {
  id: "uk-graduate",
  version: "2026-11-26.1",
  stage: "application",
  conditions: [
    {
      id: "gb-gr-present",
      input: "answer:inUk",
      operator: "eq",
      expected: true,
      label: {
        en: "You are in the UK when you apply",
        zh: "提交申请时人在英国",
      },
      nextStep: {
        en: "Check the in-country application requirement in section GR 1.2(d) before applying.",
        zh: "提交申请前，查阅 GR 1.2(d) 关于在英国境内申请的要求。",
      },
      source: {
        ...ukGraduateSource,
        applicableWhen: {
          en: "Graduate visa application validity, GR 1.2(d).",
          zh: "Graduate 签证申请有效性条件，GR 1.2(d)。",
        },
      },
    },
    {
      id: "gb-gr-provider-notification",
      input: "answer:ukCompletionReported",
      operator: "eq",
      expected: true,
      label: {
        en: "Your education provider has reported completion to the Home Office",
        zh: "教育机构已向英国内政部报告你成功完成课程",
      },
      nextStep: {
        en: "Ask your provider to check whether and when they notified the Home Office.",
        zh: "向教育机构确认是否已通知英国内政部，以及通知的时间。",
      },
      source: {
        ...ukGraduateSource,
        applicableWhen: {
          en: "Graduate visa successful completion requirement, GR 4.2–4.3.",
          zh: "Graduate 签证课程完成条件，GR 4.2–4.3。",
        },
      },
    },
  ],
} satisfies Policy;

export const deOpportunityCardPolicy = {
  id: "de-opportunity-card-skilled-worker",
  version: "2026-11-26.1",
  stage: "application",
  name: { en: "Skilled worker mechanism", zh: "技术人才路径" },
  scope: {
    en: "Checks three conditions of an initial skilled-worker application. Applicants in Germany must also check residence-permit requirements.",
    zh: "核对技术人才首次申请的三项条件。身在德国的申请人还需核对居留许可要求。",
  },
  conditions: [
    {
      id: "de-oc-nationality-scope",
      input: "answer:outsideEuEfta",
      operator: "eq",
      expected: true,
      label: {
        en: "You hold citizenship outside the EU and EFTA and have no EU or EFTA citizenship",
        zh: "你具有欧盟和欧洲自由贸易联盟以外的国籍，且未持有两者成员国的国籍",
      },
      nextStep: {
        en: "Check Germany’s entry guidance for each citizenship you hold. EU and EFTA nationals can use the free-movement guidance.",
        zh: "按你持有的各国国籍查阅德国入境指引。欧盟和欧洲自由贸易联盟公民可查看自由流动指引。",
      },
      source: {
        ...opportunityCardSource,
        url: "https://www.make-it-in-germany.com/en/visa-recognition/apply-for-visa",
        applicableWhen: {
          en: "Entry requirements by citizenship for the visa route, in conjunction with the Opportunity Card in force since 1 June 2024.",
          zh: "签证路径按国籍适用的入境要求，结合 2024 年 6 月 1 日生效的机会卡规定。",
        },
      },
    },
    {
      id: "de-oc-recognized-qualification",
      input: "answer:deRecognizedQualification",
      operator: "eq",
      expected: true,
      label: {
        en: "You meet Germany’s skilled-worker qualification definition",
        zh: "符合德国对技术人才的资格认定",
      },
      nextStep: {
        en: "Check the skilled-worker definition for your qualification. If it does not apply, review the separate points-based route.",
        zh: "按德国技术人才定义核对你的资格。如不符合，可查看独立的积分路径。",
      },
      source: {
        ...opportunityCardSource,
        url: "https://www.gesetze-im-internet.de/aufenthg_2004/__18.html",
        applicableWhen: {
          en: "Initial Opportunity Card for skilled workers under §20a(3)(1). Section 18(3) defines eligible German qualifications, equivalent foreign vocational qualifications, and foreign degrees that are recognised or comparable.",
          zh: "适用于第 20a(3)(1) 条的技术人才首次申请。第 18(3) 条定义合规德国资格、等同的外国职业资格，以及获认可或具可比性的外国学位。",
        },
      },
    },
    {
      id: "de-oc-secure-livelihood",
      input: "answer:deLivelihoodEvidence",
      operator: "eq",
      expected: true,
      label: {
        en: "You can document sufficient means to support yourself",
        zh: "能够提供维持在德国生活所需的经济证明",
      },
      nextStep: {
        en: "Review current official funding requirements and accepted forms of proof for your intended stay.",
        zh: "根据计划停留时间，查阅当前的官方资金要求和可接受的证明形式。",
      },
      source: {
        ...opportunityCardSource,
        url: "https://www.gesetze-im-internet.de/aufenthg_2004/__20a.html",
        applicableWhen: {
          en: "Means of subsistence requirement for the initial Opportunity Card, §20a(4) of the Residence Act.",
          zh: "机会卡首次申请的生活保障要求，德国《居留法》第 20a(4) 条。",
        },
      },
    },
  ],
} satisfies Policy;
