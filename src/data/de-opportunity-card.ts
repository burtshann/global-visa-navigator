import type { Condition, Localized, Policy, RuleExpression, RuleSource, ScoreCategory } from "../domain/policy";
import { de2026MonthlyMeansEur } from "./matching-profile";

const t = (en: string, zh: string): Localized => ({ en, zh });

const residenceAct = "https://www.gesetze-im-internet.de/aufenthg_2004/__20a.html";
const pointsAct = "https://www.gesetze-im-internet.de/aufenthg_2004/__20b.html";
const annex = "https://www.gesetze-im-internet.de/aufenthg_2004/anlage.html";
const federalFaq = "https://www.make-it-in-germany.com/en/visa-recognition/opportunity-card/questions-answers";
const federalHandbook = "https://www.auswaertiges-amt.de/resource/blob/207816/448ee20550723a28bf51724b8bebb5c1/visumhandbuch-data.pdf";
const commencement = "https://www.recht.bund.de/bgbl/1/2023/217/regelungstext.pdf?__blob=publicationFile&v=2";

function officialSource(url: string, applicableWhen: Localized, evidence: Localized): RuleSource {
  return {
    url,
    applicableWhen,
    evidence,
    effectiveDateUrl: commencement,
    effectiveFrom: "2024-06-01",
    lastVerifiedAt: "2026-11-23T10:08:30Z",
    reviewStatus: "verified",
  };
}

const scope = t(
  "First job-search Opportunity Card under the points mechanism, applying from outside Germany. Checks the qualification, language, standard 2026 funding evidence, and statutory scoring factors. The German mission still assesses your evidence, general residence requirements, and any case-specific exceptions.",
  "适用于在德国境外首次申请求职机会卡积分路径。核对学历或职业资格、语言、2026 年标准资金证明及法定计分项目。证据、一般居留条件及个案例外仍由德国使领馆审核。",
);

const nonEftaSource = officialSource(
  "https://www.make-it-in-germany.com/en/visa-recognition/apply-for-visa",
  t("Citizenship scope of the job-search residence title.", "求职居留许可的国籍适用范围。"),
  t("EU and EFTA nationals have free movement. This assessment is for applicants who have neither citizenship status.", "欧盟及欧洲自由贸易联盟公民享有自由流动权。本次核对面向不持有上述国籍的申请人。"),
);

const abroadSource = officialSource(
  residenceAct,
  t("Section 20a(4)–(5), initial applications from abroad.", "德国《居留法》第 20a(4)–(5) 条，境外首次申请。"),
  t("In-country applications and repeat cards have additional provisions, so the screen is scoped to first applications from outside Germany.", "境内及再次申请另有规定，本次核对限于从德国境外首次申请。"),
);

const qualificationSource = officialSource(
  residenceAct,
  t("Section 20a(4), sentence 3, no. 1, points mechanism.", "德国《居留法》第 20a(4) 条第 3 句第 1 项，积分路径。"),
  t("The foreign degree or at-least-two-year vocational qualification must be recognised in the country of acquisition and confirmed by the relevant German body. A qualifying German chamber abroad (AHK) credential is also permitted.", "外国学位或至少两年的职业资格须获取得国承认，并由德国有资质机构确认。合规的德国海外商会（AHK）资格也可适用。"),
);

const partialRecognitionSource = officialSource(
  pointsAct,
  t("Section 20b(1) no. 1 and final sentence, qualification exception and four-point factor. Points values are fixed in the annex.", "德国《居留法》第 20b(1) 条第 1 项及末句，资格例外及四分项。分值载于附件。"),
  t("A German competent authority has determined that adaptation or compensatory measures are needed for equivalence or for permission to practise a regulated occupation. This gives four points and waives the separate section 20a(4) qualification gate.", "德国主管机构已认定，为取得资格等同性或受监管职业执业许可，需要适应或补偿措施。该情形计四分，且免于第 20a(4) 条的单独资格门槛。"),
);

const languageSource = officialSource(
  residenceAct,
  t("Section 20a(4), sentence 3, no. 2; simple German corresponds to CEFR A1 under §2(9).", "德国《居留法》第 20a(4) 条第 3 句第 2 项。按第 2(9) 条，基础德语对应 CEFR A1。"),
  t("Documented German A1 or above or English B2 or above is the entry language requirement for this mechanism.", "该路径要求有证明的德语 A1 或以上，或英语 B2 或以上。"),
);

const fundsSource: RuleSource = {
  ...officialSource(
    federalFaq,
    t("Standard monthly financing evidence for initial visa applications assessed under the published 2026 amount.", "2026 年公布金额适用的首次签证申请标准月度资金证明。"),
    t("The standard net monthly amount is EUR 1,091. The published methods include a blocked account, a formal declaration of commitment, or a documented German part-time employment contract, with a blocked-account top-up if needed.", "标准为每月净额 1,091 欧元。公布的证明方式包括冻结账户、正式经济担保声明或有证明的德国兼职合同，必要时可用冻结账户补足差额。"),
  ),
  effectiveDateUrl: federalFaq,
  effectiveFrom: "2026-01-01",
  effectiveUntil: "2027-01-01",
};

const contractSource = officialSource(
  federalFaq,
  t("Employment income as a financing method, with the permitted-hours limit in §20a(2).", "以工作收入证明资金，第 20a(2) 条规定工作时数限制。"),
  t("The federal FAQ permits a concluded German part-time employment contract as evidence. The initial card permits employment averaging at most 20 hours per week in total. A general offer does not document contract income.", "联邦政府常见问题指引接受已签订的德国兼职合同作为证明。首次机会卡准许每周平均总工时最多 20 小时。一般工作邀请无法证明合同收入。"),
);

const germanPointsSource = officialSource(
  pointsAct,
  t("Section 20b(1) nos. 2–4, with CEFR levels defined in §2(10)–(12) and points in the annex.", "德国《居留法》第 20b(1) 条第 2–4 项。CEFR 等级由第 2(10)–(12) 条界定，分值载于附件。"),
  t("German A2 is worth one point, B1 is worth two, and B2 or above is worth three. Only the highest German language tier applies.", "德语 A2、B1、B2 或以上分别计 1、2、3 分，只计最高一档。"),
);

const englishPointsSource = officialSource(
  "https://www.make-it-in-germany.com/en/visa-recognition/opportunity-card/job-search",
  t("Section 20b(1) no. 5, the statutory annex and federal guidance on language evidence.", "德国《居留法》第 20b(1) 条第 5 项、法定附件及联邦语言证明指引。"),
  t("English CEFR C1 or higher earns one point. Federal guidance also credits native proficiency where the mission accepts the evidence.", "英语 CEFR C1 或以上计 1 分。联邦指引也认可使领馆接受其证明的英语母语水平。"),
);

const experienceSource = officialSource(
  pointsAct,
  t("Section 20b(1) nos. 6–7, with points assigned in the annex.", "德国《居留法》第 20b(1) 条第 6–7 项，分值载于附件。"),
  t("Related experience gained after the qualifying credential earns three points for five years in the last seven or two points for two years in the last five. Use only the higher tier.", "取得合规资格后的相关经验，过去七年满五年计 3 分，过去五年满两年计 2 分，只计较高一档。"),
);

const shortageSource = officialSource(
  "https://www.gesetze-im-internet.de/aufenthg_2004/__18g.html",
  t("Section 20b(1) no. 8 refers to §18g(1), sentence 2, no. 1; the annex sets one point.", "德国《居留法》第 20b(1) 条第 8 项引用第 18g(1) 条第 2 句第 1 项；附件规定计 1 分。"),
  t("The qualifying credential itself must relate to an occupation in the listed ISCO groups. A job title alone is insufficient evidence.", "合规资格本身须对应所列 ISCO 职业组。单凭职位名称无法确认。"),
);

const ageSource = officialSource(
  federalHandbook,
  t("Section 20b(1) nos. 9–10 and the annex, age when applying.", "德国《居留法》第 20b(1) 条第 9–10 项及附件，以申请时年龄为准。"),
  t("Federal visa handbook guidance (pages 8–9) and German mission instructions differ on inclusion of the 35th and 40th birthdays. Entering whole years at either boundary leaves the potentially affected point unconfirmed.", "德国联邦签证手册第 8–9 页与部分德国使领馆指引对是否包含 35 岁及 40 岁生日的表述不同。只填写年龄整数时，这两个边界可能涉及的分数保留待核实。"),
);

const priorStaySource = officialSource(
  federalHandbook,
  t("Visa Handbook, Chancenkarte, prior residence factor under §20b(1) no. 11.", "德国签证手册机会卡章节，《居留法》第 20b(1) 条第 11 项，既往居留计分。"),
  t("At least six continuous lawful months in Germany in the preceding five years earn one point. Tourism does not count. Minor breaks may count if Germany remained the main place of residence.", "过去五年在德国合法连续居留至少六个月计 1 分。旅游不计入。德国仍为主要居住地时，短暂中断可能不影响认定。"),
);

const partnerSource = officialSource(
  pointsAct,
  t("Section 20b(1) no. 12, joint entry with a spouse or registered civil partner.", "德国《居留法》第 20b(1) 条第 12 项，与配偶或注册伴侣共同入境。"),
  t("One point for an independently eligible spouse or registered civil partner who applies or has already applied to the same authority, plans to enter Germany together, and whose application is referenced. Neither can rely on the other’s point to qualify independently.", "配偶或注册伴侣须独立满足条件，向同一机构申请或已申请、拟共同入境，并在本人的申请中明确引用伴侣的申请，可计 1 分。双方均不能依赖对方这一分来满足独立资格。"),
);

const all = (...children: RuleExpression[]): RuleExpression => ({ kind: "all", children });
const check = (conditionId: string): RuleExpression => ({ kind: "condition", conditionId });

type Key = Condition["input"];
type Expected = string | number | boolean;

function equals(id: string, input: Key, expected: Expected, label: Localized, nextStep: Localized, source: RuleSource): Condition {
  return { id, input, operator: "eq", expected, label, nextStep, source };
}

function minimum(id: string, input: Key, expected: number, label: Localized, nextStep: Localized, source: RuleSource): Condition {
  return { id, input, operator: "gte", expected, label, nextStep, source };
}

function levels(id: string, input: Key, expected: readonly [string, ...string[]], label: Localized, nextStep: Localized, source: RuleSource): Condition {
  return { id, input, operator: "in", expected, label, nextStep, source };
}

const qualificationNext = t("Check the recognised qualification evidence in the official guide or with the German mission.", "查阅官方指引或向德国使领馆确认资格认定证明。");
const languageNext = t("Identify accepted CEFR evidence and confirm submission requirements with your mission.", "查询认可的 CEFR 等级证明，并向受理使领馆确认提交要求。");
const fundsNext = t("Check the accepted blocked-account balance, formal commitment or contract evidence for your intended stay.", "按拟停留时间核对可接受的冻结账户余额、正式担保或合同证明。");
const experienceNext = t("Use employer records to confirm years worked in the relevant field after the credential was obtained.", "用雇主记录确认取得资格后的相关工作年限。");
const ageNext = t("Confirm which date and age band the responsible German mission will use at filing.", "向受理的德国使领馆确认申请日期及适用年龄档。");
const contractNext = t("Verify the signed contract with the German employer, including average weekly hours and net monthly pay.", "核实与德国雇主签订的合同，包括平均每周工时和月净收入。");

const conditions: readonly Condition[] = [
  equals("outside-eu-efta", "answer:outsideEuEfta", true, t("No EU or EFTA citizenship", "未持有欧盟或欧洲自由贸易联盟成员国国籍"), t("Review German entry guidance for each citizenship held.", "按持有的每项国籍核对德国入境指引。"), nonEftaSource),
  equals("first-application-abroad", "answer:deApplyingFromAbroad", true, t("Applying for the first card from outside Germany", "从德国境外首次申请"), t("Review the separate German rules for applications inside Germany, extensions or repeat cards.", "核对德国境内申请、续期或再次申请的独立规定。"), abroadSource),
  levels("qualifying-foreign-credential", "answer:deQualificationBasis", ["academic", "vocational", "ahk"], t("Confirmed foreign degree, vocational qualification or qualifying AHK credential", "已确认的外国学位、职业资格或合规 AHK 证书"), qualificationNext, qualificationSource),
  equals("partial-recognition", "answer:dePartialRecognition", true, t("Official adaptation or compensatory-measures determination", "适应或补偿措施的官方认定"), t("Check the German competent authority’s recognition decision.", "核对德国主管机构的资格认定决定。"), partialRecognitionSource),
  levels("german-a1", "answer:deGermanLevel", ["A1", "A2", "B1", "B2", "C1", "C2"], t("Documented German A1 or above", "有德语 A1 或以上证明"), languageNext, languageSource),
  levels("english-b2", "answer:deEnglishLevel", ["B2", "C1", "C2", "native-accepted"], t("Accepted evidence of English B2 or above", "有认可的英语 B2 或以上证明"), languageNext, languageSource),
  equals("declaration", "answer:deFormalCommitment", true, t("Formal declaration of commitment", "正式经济担保声明"), fundsNext, fundsSource),
  minimum("blocked-funds", "answer:deBlockedEurMonthly", de2026MonthlyMeansEur, t("Blocked-account allowance of at least EUR 1,091 per month (2026)", "每月冻结账户额度至少 1,091 欧元（2026 年）"), fundsNext, fundsSource),
  equals("job-offer", "jobOffer", true, t("Job offer or employment contract reported", "已填写工作邀请或劳动合同"), contractNext, contractSource),
  equals("signed-de-contract", "answer:deGermanPartTimeContract", true, t("Signed part-time employment contract with a German employer", "已与德国雇主签订兼职合同"), contractNext, contractSource),
  { id: "positive-contract-hours", input: "answer:deContractHoursWeekly", operator: "gt", expected: 0, label: t("Documented weekly contract hours above zero", "有证明的合同每周工时高于零"), nextStep: contractNext, source: contractSource },
  { id: "within-contract-hours", input: "answer:deContractHoursWeekly", operator: "lte", expected: 20, label: t("Average working hours within the 20-hour weekly limit", "平均每周工作不超过 20 小时"), nextStep: contractNext, source: contractSource },
  minimum("contract-monthly-funds", "answer:deCombinedMonthlyEur", de2026MonthlyMeansEur, t("Net contractual income and any blocked-account funds total EUR 1,091 monthly (2026)", "合同月净收入及冻结账户资金合计达 1,091 欧元（2026 年）"), fundsNext, fundsSource),
  levels("german-a2", "answer:deGermanLevel", ["A2", "B1", "B2", "C1", "C2"], t("Documented German A2 or above", "有德语 A2 或以上证明"), languageNext, germanPointsSource),
  levels("german-b1", "answer:deGermanLevel", ["B1", "B2", "C1", "C2"], t("Documented German B1 or above", "有德语 B1 或以上证明"), languageNext, germanPointsSource),
  levels("german-b2", "answer:deGermanLevel", ["B2", "C1", "C2"], t("Documented German B2 or above", "有德语 B2 或以上证明"), languageNext, germanPointsSource),
  levels("english-c1", "answer:deEnglishLevel", ["C1", "C2", "native-accepted"], t("Accepted evidence of English C1 or above, or native English", "有认可的英语 C1 或以上证明，或获认可的英语母语证明"), languageNext, englishPointsSource),
  minimum("experience-5-in-7", "answer:deRelevantYearsLast7", 5, t("Five years of related experience in the last seven", "过去七年有五年相关经验"), experienceNext, experienceSource),
  minimum("experience-2-in-5", "answer:deRelevantYearsLast5", 2, t("Two years of related experience in the last five", "过去五年有两年相关经验"), experienceNext, experienceSource),
  equals("shortage-occupation", "answer:deShortageQualification", true, t("Qualifying credential belongs to a shortage-occupation group", "合规资格对应紧缺职业组"), t("Check the qualifying credential’s ISCO group in the statutory list.", "在法定清单中核对合规资格对应的 ISCO 职业组。"), shortageSource),
  { id: "age-under-35", input: "age", operator: "lt", expected: 35, label: t("Under 35 at filing", "递交时未满 35 岁"), nextStep: ageNext, source: ageSource },
  equals("age-35", "age", 35, t("Age 35 boundary at filing", "递交时处于 35 岁边界"), ageNext, ageSource),
  { id: "age-over-35", input: "age", operator: "gt", expected: 35, label: t("Over 35 at filing", "递交时高于 35 岁"), nextStep: ageNext, source: ageSource },
  { id: "age-under-40", input: "age", operator: "lt", expected: 40, label: t("Under 40 at filing", "递交时未满 40 岁"), nextStep: ageNext, source: ageSource },
  equals("age-40", "age", 40, t("Age 40 boundary at filing", "递交时处于 40 岁边界"), ageNext, ageSource),
  equals("prior-stay", "answer:dePriorStay", true, t("Qualifying prior lawful residence in Germany", "在德国有符合要求的既往合法居留"), t("Confirm dates and gather residence permits or other evidence of your lawful stay.", "核对日期并整理居留许可或其他合法居留证明。"), priorStaySource),
  equals("partner", "answer:deJointPartner", true, t("Qualifying joint entry with spouse or registered partner", "与符合条件的配偶或注册伴侣共同入境"), t("Ask the mission to verify independent eligibility and how to link the two applications.", "请使领馆核对独立资格及两份申请的关联方式。"), partnerSource),
];

const score: RuleExpression = {
  kind: "points",
  id: "opportunity-card-points",
  minimum: 6,
  label: t("Six statutory points", "六分法定门槛"),
  nextStep: t("Review unconfirmed scoring factors, check the official points table, and confirm any age boundary with the German mission.", "核对尚未确认的计分项、官方积分表以及德国使领馆对年龄边界的口径。"),
  source: officialSource(annex, t("Statutory annex to §20a(3) no. 2 and §20b.", "德国《居留法》第 20a(3) 条第 2 项及第 20b 条附件。"), t("The annex sets a minimum of six points and the weight for each statutory factor.", "附件规定六分门槛及各法定因素的分值。")),
  categories: [
    { id: "recognition", alternatives: [{ points: 4, when: check("partial-recognition") }] },
    { id: "german", alternatives: [
      { points: 3, when: check("german-b2") },
      { points: 2, when: check("german-b1") },
      { points: 1, when: check("german-a2") },
    ] },
    { id: "english", alternatives: [{ points: 1, when: check("english-c1") }] },
    { id: "experience", alternatives: [
      { points: 3, when: check("experience-5-in-7") },
      { points: 2, when: check("experience-2-in-5") },
    ] },
    { id: "shortage", alternatives: [{ points: 1, when: check("shortage-occupation") }] },
    { id: "age", alternatives: [
      { points: 2, when: check("age-under-35") },
      { points: { minimum: 1, maximum: 2 }, when: check("age-35") },
      { points: 1, when: all(check("age-over-35"), check("age-under-40")) },
      { points: { minimum: 0, maximum: 1 }, when: check("age-40") },
    ] },
    { id: "residence", alternatives: [{ points: 1, when: check("prior-stay") }] },
    { id: "partner", alternatives: [{ points: 1, when: check("partner") }] },
  ] satisfies readonly ScoreCategory[],
};

export const deOpportunityCardPointsPolicy: Policy = {
  id: "de-opportunity-card-points",
  version: "2026-11-23.2",
  name: t("Points mechanism", "积分路径"),
  scope,
  stage: "application",
  conditions,
  expression: {
    kind: "when",
    test: all(check("outside-eu-efta"), check("first-application-abroad")),
    requirement: all(
      {
        kind: "any",
        children: [check("qualifying-foreign-credential"), check("partial-recognition")],
        summary: {
          id: "qualification", label: t("Qualification evidence or statutory exception", "资格证明或法定例外"), nextStep: qualificationNext,
        },
      },
      {
        kind: "any",
        children: [check("german-a1"), check("english-b2")],
        summary: {
          id: "entry-language", label: t("Minimum language evidence", "最低语言证明要求"), nextStep: languageNext,
        },
      },
      {
        kind: "any",
        children: [
          check("declaration"),
          check("blocked-funds"),
          all(
            check("job-offer"), check("signed-de-contract"), check("positive-contract-hours"),
            check("within-contract-hours"), check("contract-monthly-funds"),
          ),
        ],
        summary: {
          id: "funding", label: t("Standard monthly funding evidence", "标准月度资金证明"), nextStep: fundsNext,
        },
      },
      score,
    ),
  },
};
