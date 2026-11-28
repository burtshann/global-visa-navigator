import type { Condition, Localized, Policy, RuleExpression, RuleSource, ScoreCategory } from "../domain/policy";

const t = (en: string, zh: string): Localized => ({ en, zh });
const expressEntry = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry";
export const caFswUrl = `${expressEntry}/who-can-apply/federal-skilled-workers.html`;
const fundsUrl = `${expressEntry}/documents/proof-funds.html`;
const languageUrl = `${expressEntry}/documents/language-test.html`;
const justice = "https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227";
const originalRegulations = "https://gazette.gc.ca/rp-pr/p2/2002/2002-06-14-x/pdf/g2-136x9.pdf";
const gridAmendment = "https://gazette.gc.ca/rp-pr/p2/2012/2012-12-19/html/sor-dors274-eng.html";
const nocAmendment = "https://gazette.gc.ca/rp-pr/p2/2022/2022-11-09/html/sor-dors220-eng.html";
const workHoursAmendment = "https://gazette.gc.ca/rp-pr/p2/2023/2023-12-06/html/sor-dors249-eng.html";

function irpr(section: number) {
  return `${justice}/page-${section === 75 ? 11 : 12}.html#s-${section}`;
}

function source(
  url: string,
  applicableWhen: Localized,
  evidence: Localized,
  effectiveFrom: string | null,
  effectiveDateUrl?: string,
): RuleSource {
  return { url, applicableWhen, evidence, effectiveFrom, effectiveDateUrl, lastVerifiedAt: "2026-11-28T00:10:45Z", reviewStatus: "verified" };
}

function grid(section: number, applicableWhen: Localized, evidence: Localized): RuleSource {
  return source(irpr(section), applicableWhen, evidence, "2013-05-04", gridAmendment);
}

export const caFswEducation = [
  { value: "secondary", points: 5, label: t("Secondary credential", "中学学历") },
  { value: "one-year", points: 15, label: t("One-year post-secondary credential", "一年制高等教育学历") },
  { value: "two-year", points: 19, label: t("Two-year post-secondary credential", "两年制高等教育学历") },
  { value: "three-plus", points: 21, label: t("Post-secondary credential from a program of three years or more", "三年或以上高等教育学历") },
  { value: "multiple", points: 22, label: t("At least two post-secondary credentials, one from a program of three years or more", "至少两项高等教育学历，其中一项为三年或以上") },
  { value: "masters-professional", points: 23, label: t("Master’s or qualifying entry-to-practice professional degree", "硕士或符合要求的执业专业学位") },
  { value: "doctoral", points: 25, label: t("Doctorate", "博士学位") },
] as const;

export const caFswSkills = [
  { id: "Reading", label: t("Reading", "阅读") },
  { id: "Writing", label: t("Writing", "写作") },
  { id: "Listening", label: t("Listening", "听力") },
  { id: "Speaking", label: t("Speaking", "口语") },
] as const;

const reviewedAt = "2026-11-28T06:01:43Z";
const partnerScope = t(
  "These points require an accompanying spouse or common-law partner who is neither a Canadian citizen nor a permanent resident residing in Canada.",
  "此类积分须有随行配偶或同居伴侣，且对方须既非加拿大公民，也非居住在加拿大的永久居民。",
);

export const caFswPartnerOptions = [
  { value: "no-partner", label: t("I have no spouse or common-law partner", "我没有配偶或同居伴侣") },
  { value: "eligible-accompanying", label: t("I have an accompanying partner who meets the status requirements below", "我有符合下方身份要求的随行伴侣") },
  { value: "other-partner", label: t("My partner is not accompanying me or is excluded by the status requirements below", "我的伴侣不随行，或其身份不符合下方要求") },
] as const;

export const caFswPartnerAdaptability = [
  { id: "caFswPartnerLanguage", points: 5, label: t("My accompanying partner has CLB or NCLC 4 or higher in all four skills", "我的随行伴侣听说读写均达到 CLB 或 NCLC 4 级或以上"),
    evidence: t(`${partnerScope.en} Use approved English or French test results less than two years old.`, `${partnerScope.zh}须提供未满两年的认可英语或法语考试成绩。`) },
  { id: "caFswPartnerStudy", points: 5, label: t("My accompanying partner completed at least two qualifying academic years in Canada", "我的随行伴侣在加拿大完成至少两个符合条件的学年"),
    evidence: t(`${partnerScope.en} Apply the same authorised study requirements as for the applicant.`, `${partnerScope.zh}适用与主申请人相同的合法就读要求。`) },
  { id: "caFswPartnerWork", points: 5, label: t("My accompanying partner completed at least one year of qualifying work in Canada", "我的随行伴侣在加拿大完成至少一年符合条件的工作"),
    evidence: t(`${partnerScope.en} Count full-time work in Canada under a work permit or authorised under IRPR 186.`, `${partnerScope.zh}仅计持工签或依《条例》第 186 条获准在加拿大从事的全职工作。`) },
] as const;

export const caFswAdaptability = [
  { id: "caFswCanadianWork", points: 10, label: t("I completed at least one year of qualifying work in Canada", "我在加拿大完成至少一年符合条件的工作"),
    evidence: t("Full-time authorised work in Canada in TEER 0–3. Check employer letters and work authorisation.", "在加拿大获准从事 TEER 0–3 的全职工作。核对雇主证明与工作授权。") },
  { id: "caFswCanadianStudy", points: 5, label: t("I completed at least two qualifying academic years in Canada", "我在加拿大完成至少两个符合条件的学年"),
    evidence: t("Authorised study in a recognised program of at least two years, at least 15 hours of instruction a week, and good academic standing.", "在获认可的至少两年制课程中合法就读，每周至少 15 小时授课，并保持良好学业状态。") },
  ...caFswPartnerAdaptability,
  { id: "caFswCanadianRelative", points: 5, label: t("I or my accompanying partner have a qualifying relative in Canada", "我或随行伴侣在加拿大有符合条件的亲属"),
    evidence: t("A parent, grandparent, child, grandchild, sibling, aunt, uncle, niece or nephew aged 18 or older, residing in Canada as a citizen or permanent resident.", "年满 18 岁、居住在加拿大的公民或永久居民，且是父母、祖父母或外祖父母、子女、孙辈、兄弟姐妹、叔伯姑舅姨或侄甥。") },
] as const;

export const caFswOfferOptions = [
  { value: "ordinary-exempt", label: t("Qualifying section 82 offer and currently authorised to work in Canada", "具有第 82 条规定的合格录用邀请，且目前获准在加拿大工作") },
  { value: "ordinary-points", label: t("Qualifying section 82 offer, without the proof-of-funds exemption", "具有第 82 条规定的合格录用邀请，但不享有资金证明豁免") },
  { value: "none", label: t("No qualifying offer after checking the official routes", "查阅官方规则后，确认没有合格录用邀请") },
  { value: "policy-pending", label: t("Unconfirmed offer or relying on the November 2026 public policy", "录用邀请待核实，或拟依赖 2026 年 11 月的公共政策") },
] as const;

function fact(
  id: string, label: Localized, nextStep: Localized, origin: RuleSource,
): Condition {
  return { id, input: `answer:${id}`, operator: "eq", expected: true, label, nextStep, source: origin };
}

const outsideQuebec = fact("caFswOutsideQuebec",
  t("Intend to reside outside Quebec", "打算在魁北克省以外居住"),
  t("Check provincial guidance if you plan to settle in Quebec.", "如计划在魁北克定居，请查阅该省的移民指引。"),
  source(irpr(75), t("Federal Skilled Worker class, IRPR 75(1).", "联邦技术移民类别，《条例》第 75(1) 条。"),
    t("Your intended province or territory of residence.", "你计划居住的省份或地区。"), "2002-06-28", originalRegulations));

const primaryWork = fact("caFswPrimaryWork",
  t("At least one continuous year of qualifying primary occupation work", "主要职业有至少一年连续的合格工作经验"),
  t("Check your NOC and review employment dates, hours, pay and duties against IRCC’s requirements.", "对照 IRCC 要求核对 NOC、工作日期、工时、薪酬和职责。"),
  source(caFswUrl, t("Minimum work experience under IRPR 75(2)(a)–(c) and current NOC TEER guidance.", "《条例》第 75(2)(a)–(c) 条最低工作经验及当前 NOC TEER 指引。"),
    t("At least 1,560 hours in one continuous year or equivalent qualifying part-time work in the previous 10 years, counting at most 30 hours per week. Confirm the primary NOC is an unrestricted TEER 0–3 occupation and that work matches its lead statement, all essential duties and most main duties. Check paid status and any special Canadian research compensation with IRCC.",
      "过去十年内至少一年连续合格工作，共 1,560 小时或等量合规兼职；每周最多计 30 小时。主要职业的 NOC 须属 TEER 0–3 且不受限制，工作须符合职业概述、所有必要职责及大部分主要职责。向 IRCC 核对带薪要求及加拿大研究岗位特殊报酬。"),
    "2022-11-16", nocAmendment));

const firstTest = fact("caFswFirstTest",
  t("First official language test is approved and current", "第一官方语言考试获认可且成绩有效"),
  t("Check approved English or French tests and your report date with IRCC.", "向 IRCC 核对认可的英语或法语考试及成绩日期。"),
  source(languageUrl, t("IRCC approved language evidence for Express Entry and IRPR 75(2)(d).", "IRCC 快速通道认可的语言证明及《条例》第 75(2)(d) 条。"),
    t("Use an approved result less than two years old when completing the profile and submitting a permanent residence application.", "填写档案及提交永久居民申请时，认可成绩均须未满两年。"), null));

const firstLevels = caFswSkills.map(({ id, label }): Condition[] => [7, 8, 9].map((level) => ({
  id: `caFsw${id}-${level}`, input: `answer:caFsw${id}`, operator: "gte", expected: level,
  label: t(`${label.en} CLB or NCLC ${level} or above`, `${label.zh}达到 CLB 或 NCLC ${level} 级或以上`),
  nextStep: t("Convert the individual skill result using IRCC’s equivalency tables.", "使用 IRCC 对照表换算该项成绩。"),
  source: grid(79, t("First official language minimum and points under IRPR 75(2)(d) and 79(3)(a).", "《条例》第 75(2)(d) 及 79(3)(a) 条规定的第一官方语言最低要求和积分。"),
    t("Approved English CLB or French NCLC per individual skill. Level 7 awards four points, 8 awards five, and 9 or higher awards six.", "按认可成绩逐项核对英语 CLB 或法语 NCLC。7 级计 4 分，8 级计 5 分，9 级或以上计 6 分。")),
})));

const secondLanguage = fact("caFswSecondLanguage",
  t("Approved second official language result at level 5 or higher in all four skills", "第二官方语言的认可成绩听说读写均达 5 级或以上"),
  t("Check approved results for the other official language and verify all four skills.", "核对另一种官方语言的认可成绩及四项等级。"),
  grid(79, t("Second official language under IRPR 79(3)(b).", "《条例》第 79(3)(b) 条第二官方语言。"),
    t("A current approved test in the other official language with CLB or NCLC 5 or above in each skill earns four points.", "另一官方语言的有效认可成绩每项达到 CLB 或 NCLC 5 级或以上，计 4 分。")));

const educationEvidence = source(irpr(78), t("IRPR 75(2)(e), 75(2.1) and 78, education requirement and points.", "《条例》第 75(2)(e)、75(2.1) 及 78 条规定的学历门槛及积分。"),
  t("Document the highest-scoring completed Canadian credential or a foreign credential with a valid immigration ECA less than five years old. The ECA must establish Canadian equivalency. If a professional body is designated for the primary occupation, check that its ECA confirms the Canadian credential needed to practise in a province that recognises the assessment.", "提供已完成的加拿大教育证书，或国外证书及未满五年的有效移民用途 ECA。若主要职业设有指定专业机构，核对该机构的 ECA 是否确认等同于在认可评估的省份执业所需的加拿大学历。"), "2022-11-16", nocAmendment);
const educationMinimum: Condition = {
  id: "caFswEducationMinimum", input: "answer:caFswEducation", operator: "in",
  expected: ["secondary", "one-year", "two-year", "three-plus", "multiple", "masters-professional", "doctoral"],
  label: t("Documented Canadian secondary credential or higher, or recognised foreign equivalent", "可证明的加拿大中学或以上学历，或认可的国外同等学历"),
  nextStep: t("Check your Canadian credential or obtain the required immigration ECA.", "核对加拿大教育证书，或办理所需的移民用途 ECA。"),
  source: educationEvidence,
};
const educationConditions: Condition[] = caFswEducation.map(({ value, label }) => ({
  ...educationMinimum, id: `caFswEducation-${value}`, operator: "eq", expected: value, label,
}));

const workBands = [{ years: 1, points: 9 }, { years: 2, points: 11 }, { years: 4, points: 13 }, { years: 6, points: 15 }];
const workSource = {
  ...source(irpr(80), t("Skilled work experience selection points under IRPR 80.", "《条例》第 80 条技术工作经验积分。"),
    t("Check NOC TEER 0–3, duties, paid status, dates and full-time equivalent hours against IRCC evidence rules. Qualifying work in the primary occupation under section 75 counts toward these same bands.", "按 IRCC 证据要求核对 NOC TEER 0–3、职责、带薪状态、日期及全职等效工时。符合第 75 条的主要职业经验计入相同档次。"),
    "2023-11-24", workHoursAmendment),
  lastVerifiedAt: reviewedAt,
};
const workConditions: Condition[] = workBands.map(({ years }) => ({
  id: `caFswWork-${years}`, input: "answer:caFswWorkYears", operator: "gte", expected: years,
  label: t(`At least ${years} full years of qualifying skilled work`, `至少 ${years} 整年合格技术工作经验`),
  nextStep: t("Count documented qualifying work in the 10-year window, including the qualifying primary occupation year. Exclude overlap.", "计算十年期内有证明的合格工作，包括主要职业的合格年限。重叠时段不得重复计入。"),
  source: workSource,
}));

const ageSource = grid(81, t("Age at the date the application is made, IRPR 81.", "《条例》第 81 条，以提交申请日年龄计算。"),
  t("Confirm date of birth from identity evidence. Age 18–35 earns 12 points, 36–46 earns one fewer point per year, and other ages earn zero.", "按身份证明核对出生日期。18–35 岁计 12 分，36–46 岁每年递减 1 分，其他年龄计 0 分。"));
const ageConditions: Condition[] = Array.from({ length: 12 }, (_, index) => {
  const age = 35 + index;
  return {
    id: `caFswAge-${age}`, input: "answer:caFswAge", operator: "in",
    expected: index === 0 ? [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35] : [age],
    label: index === 0 ? t("Age 18–35", "18–35 岁") : t(`Age ${age}`, `${age} 岁`),
    nextStep: t("Confirm your age at the relevant application date.", "核对提交相关申请时的实足年龄。"),
    source: ageSource,
  };
});

const ordinaryOffer: Condition = {
  id: "caFswOrdinaryOffer", input: "answer:caFswOffer", operator: "in", expected: ["ordinary-exempt", "ordinary-points"],
  label: t("Arranged employment qualifies under the ordinary requirements of section 82", "录用邀请符合第 82 条的一般安排就业要求"),
  nextStep: t("Review IRCC’s job-offer guidance and current public policy. Leave unconfirmed offers unresolved.", "查阅 IRCC 录用邀请指引及当前公共政策；待核实的邀请保持未确认。"),
  source: source(irpr(82), t("Ordinary arranged employment points, IRPR 82 and 83(1)(e). The November 2026 discretionary public policy is outside this check.", "《条例》第 82 条与第 83(1)(e) 条的一般安排就业积分。此项核对不涵盖 2026 年 11 月的酌情公共政策。"),
    t("Check the employer’s qualifying offer, terms and occupation, and the applicable work permit, LMIA or ordinary exemption.", "核对雇主的合规录用邀请、条款、职业及适用工签、LMIA 或一般豁免。"), "2022-11-16", nocAmendment),
};
const exemptOffer: Condition = {
  ...ordinaryOffer, id: "caFswExemptOffer", operator: "eq", expected: "ordinary-exempt",
  label: t("Work authorisation and a qualifying offer establish the ordinary funds exemption", "工作授权及合规录用邀请符合一般资金豁免规定"),
  source: source(irpr(76), t("IRCC proof-of-funds guidance and IRPR 76(1)(b)(ii), with arranged employment under 82(2)(a), (b) or (d).", "IRCC 资金证明指引及《条例》第 76(1)(b)(ii) 条，安排就业适用第 82(2)(a)、(b) 或 (d) 条。"),
    t("Confirm current Canadian work authorisation and which ordinary arranged employment paragraph awards points.", "核实当前加拿大工作授权及适用的一般安排就业积分条款。"), "2013-05-04", gridAmendment),
};
const partnerEligibility: Condition = {
  id: "caFswPartnerEligibility", input: "answer:caFswPartnerStatus", operator: "eq", expected: "eligible-accompanying",
  label: t("Partner meets the accompanying and status requirements for these adaptability points", "伴侣符合此类适应能力积分的随行和身份要求"),
  nextStep: t("Confirm whether your spouse or common-law partner is accompanying you and meets the status requirements.", "核对配偶或同居伴侣是否随行并符合身份要求。"),
  source: {
    ...source(irpr(83), t("Partner language, study and work under IRPR 83(1)(a), (b.1) and (c.1).", "《条例》第 83(1)(a)、(b.1) 及 (c.1) 条规定的伴侣语言、学习及工作积分。"),
      partnerScope, "2013-05-04", gridAmendment),
    lastVerifiedAt: reviewedAt,
  },
};
const adaptability = caFswAdaptability.map(({ id, label, evidence }) => fact(id, label,
  t("Check the corresponding evidence and definitions under IRPR 83.", "按《条例》第 83 条核对相应证明及定义。"),
  caFswPartnerAdaptability.some((partner) => partner.id === id)
    ? { ...partnerEligibility.source, evidence }
    : source(irpr(83), t("Federal Skilled Worker adaptability, IRPR 83.", "《条例》第 83 条联邦技术移民适应能力。"), evidence, "2022-11-16", nocAmendment)));

const fundsSource = {
  ...source(fundsUrl, t("Published Express Entry funds table for Federal Skilled Workers and IRPR 76(1)(b).", "适用于联邦技术移民的快速通道资金表及《条例》第 76(1)(b) 条。"),
    t("Use available, transferable funds free of debts or other obligations. Official financial institution letters are required. Count the applicant, spouse or common-law partner and dependent children even if they will stay behind or are citizens or permanent residents.", "仅计可用、可转移且不受债务或其他义务限制的资金，须提供金融机构正式证明。家庭人数包括本人、配偶或同居伴侣和受抚养子女，即使他们不随行或已是加拿大公民或永久居民。"),
    "2025-07-07", fundsUrl),
  lastVerifiedAt: reviewedAt,
};
const fundsAvailable = fact("caFswFundsDocumentable",
  t("Funds are available, unencumbered and documentable", "资金可用、无负担且能够提供证明"),
  t("Review IRCC’s accepted proof and ask your financial institutions for the required documentation.", "查看 IRCC 接受的证据，并向金融机构索取所需证明。"), fundsSource);

const ref = ({ id }: Condition): RuleExpression => ({ kind: "condition", conditionId: id });
const any = (children: readonly RuleExpression[]): RuleExpression => ({ kind: "any", children });
const all = (children: readonly RuleExpression[]): RuleExpression => ({ kind: "all", children });

const fivePointFacts = [...adaptability.slice(1), ordinaryOffer].map((condition) =>
  caFswPartnerAdaptability.some(({ id }) => id === condition.id)
    ? all([ref(partnerEligibility), ref(condition)])
    : ref(condition));
const combinations = fivePointFacts.flatMap((left, index) =>
  fivePointFacts.slice(index + 1).map((right) => all([left, right])));

const categories: ScoreCategory[] = [
  { id: "age", alternatives: ageConditions.map((condition, index) => ({ points: 12 - index, when: ref(condition) })) },
  { id: "education", alternatives: educationConditions.map((condition, index) => ({ points: caFswEducation[index].points, when: ref(condition) })) },
  ...firstLevels.map((levels, index) => ({
    id: `first-language-${caFswSkills[index].id.toLowerCase()}`,
    alternatives: levels.map((condition, levelIndex) => ({ points: 4 + levelIndex, when: all([ref(firstTest), ref(condition)]) })),
  })),
  { id: "second-language", alternatives: [{ points: 4, when: ref(secondLanguage) }] },
  { id: "experience", alternatives: workConditions.map((condition, index) => ({
    points: workBands[index].points,
    when: index === 0 ? any([ref(primaryWork), ref(condition)]) : ref(condition),
  })) },
  { id: "arranged-employment", alternatives: [{ points: 10, when: ref(ordinaryOffer) }] },
  { id: "adaptability", alternatives: [
    { points: 5, when: any(fivePointFacts) },
    { points: 10, when: any([ref(adaptability[0]), ...combinations]) },
  ] },
];

export const caFederalSkilledWorkerPolicy = {
  id: "ca-federal-skilled-worker", version: "2026-11-28.2", stage: "application",
  name: t("Federal Skilled Worker Program", "联邦技术移民项目"),
  assessmentLabel: t("Federal Skilled Worker pre-pool checks", "联邦技术移民入池前核对"),
  scope: t("Checks the ordinary minimum requirements and 67-of-100 selection grid using your answers. IRCC still has to verify evidence, admissibility, any discretionary assessments and actual entry to the pool.",
    "根据你的回答核对一般最低要求和 100 分中须达 67 分的筛选标准。证据、准入要求、酌情审查及是否实际进入候选池仍由 IRCC 核验。"),
  conditions: [
    outsideQuebec, primaryWork, firstTest, ...firstLevels.flat(), secondLanguage, educationMinimum,
    ...educationConditions, ...workConditions, ...ageConditions, ordinaryOffer, exemptOffer,
    partnerEligibility, ...adaptability, fundsAvailable,
  ],
  expression: all([
    ref(outsideQuebec), ref(primaryWork), ref(firstTest), ...firstLevels.map(([minimum]) => ref(minimum)),
    ref(educationMinimum),
    any([ref(exemptOffer), all([ref(fundsAvailable), {
      kind: "threshold-table", id: "caFswFundThreshold", input: "answer:caFswFundsCad",
      bandInput: "answer:caFswConfirmedFamilySize", categoryInput: "answer:caFswFundsDocumentable",
      bandStarts: [1, 2, 3, 4, 5, 6, 7], maximumBandInput: 100_000, incrementAboveLastBand: 4112,
      categories: [{ value: true, minimums: [15263, 19001, 23360, 28362, 32168, 36280, 40392] }],
      unit: t("CAD", "加元"), label: t("Documentable settlement funds meet the family-size minimum", "可证明的安家资金达到相应家庭人数的最低金额"),
      nextStep: t("Confirm your family size. Count yourself and your spouse or common-law partner, even if they are not accompanying you, plus dependent children. Then check the IRCC funds table.", "核对家庭人数。计入本人、配偶或同居伴侣（即使不随行）及受抚养子女，再查阅 IRCC 资金表。"),
      source: fundsSource,
    }])]),
    {
      kind: "points", id: "caFswSelectionGrid", minimum: 67, categories,
      label: t("Federal Skilled Worker selection factors reach 67 out of 100", "联邦技术移民筛选因素达到 100 分中的 67 分"),
      nextStep: t("Confirm the evidence for each scoring factor and recheck missing details.", "核对每项积分因素的证明，并补充缺失信息。"),
      source: source(caFswUrl, t("IRPR 76(1)(a), 76(2) and current IRCC minimum for program eligibility.", "《条例》第 76(1)(a)、76(2) 条及 IRCC 现行项目筛选门槛。"),
        t("Use documented education, first and second official languages, skilled experience, age, arranged employment and adaptability. IRCC may make a substituted evaluation under 76(3)–(4).", "根据可证明的学历、第一及第二官方语言、技术工作、年龄、安排就业及适应能力计分。IRCC 可按第 76(3)–(4) 条作替代评估。"), null),
    },
  ]),
} satisfies Policy;

export const caFswLaterStages = [
  {
    id: "ranking", title: t("CRS ranking", "CRS 排名"), status: t("CRS score not calculated", "未计算 CRS 分数"),
    url: `${expressEntry}/check-score/crs-criteria.html`,
  },
  {
    id: "invitation", title: t("Invitation round", "邀请轮次"), status: t("Invitation not verified", "未核实是否收到邀请"),
    url: `${expressEntry}/rounds-invitations.html`,
  },
  {
    id: "permanent-residence", title: t("Permanent residence application", "永久居民申请"), status: t("Application eligibility not assessed", "未评估获邀后的申请资格"),
    url: `${expressEntry}/apply-permanent-residence.html`,
  },
] as const;
