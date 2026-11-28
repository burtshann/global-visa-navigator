import type { Condition, Localized, Policy, RuleExpression, RuleSource } from "../domain/policy";

const t = (en: string, zh: string): Localized => ({ en, zh });
const residenceAct = "https://www.gesetze-im-internet.de/aufenthg_2004/__20a.html";
const commencement = "https://www.recht.bund.de/bgbl/1/2023/217/regelungstext.pdf?__blob=publicationFile&v=2";

export const deCardCases = [
  { value: "first-abroad", label: t("First search Opportunity Card from outside Germany", "从德国境外首次申请求职机会卡") },
  { value: "first-in-germany", label: t("First search Opportunity Card while in Germany", "在德国境内首次申请求职机会卡") },
  { value: "repeat", label: t("New search Opportunity Card after a previous search card ended", "上一张求职机会卡到期后再次申请") },
  { value: "follow-up", label: t("Extend an initial search card as a follow-up Opportunity Card", "将首次求职机会卡续为后续机会卡") },
  { value: "further-extension", label: t("Extend a follow-up Opportunity Card again", "再次延长已获批的后续机会卡") },
] as const;

function source(applicableWhen: Localized, evidence: Localized): RuleSource {
  return {
    url: residenceAct, applicableWhen, evidence, effectiveFrom: "2024-06-01",
    effectiveDateUrl: commencement, lastVerifiedAt: "2026-11-28T12:03:38Z", reviewStatus: "verified",
  };
}

const applicationScope = source(
  t("The initial, repeat and follow-up situations in §20a(4) and (5).", "《德国居留法》第 20a(4) 和 (5) 条规定的首次、再次及后续申请。"),
  t("Confirm the filing location and any previous search or follow-up card.", "核对申请地点以及此前持有的求职或后续机会卡。"),
);

const check = (conditionId: string): RuleExpression => ({ kind: "condition", conditionId });
const all = (...children: RuleExpression[]): RuleExpression => ({ kind: "all", children });
const any = (...children: RuleExpression[]): RuleExpression => ({ kind: "any", children });

function applicationCase({ value, label }: (typeof deCardCases)[number]): Condition {
  return {
    id: value, input: "answer:deCardCase", operator: "eq", expected: value, label,
    nextStep: t("Choose the application situation that applies to you.", "选择与你情况相符的申请情形。"),
    source: applicationScope,
  };
}

const [firstAbroad, firstInGermany, repeat, followUp, furtherExtension] = deCardCases.map(applicationCase);
export const deFirstAbroad = firstAbroad;

const nationality: Condition = {
  id: "de-scope-nationality", input: "answer:outsideEuEfta", operator: "eq", expected: true,
  label: t("No EU or EFTA citizenship", "未持有欧盟或欧洲自由贸易联盟成员国国籍"),
  nextStep: t("Check Germany’s entry guidance for every nationality you hold.", "按持有的每项国籍核对德国入境指引。"),
  source: {
    ...source(t("Residence-title scope for third-country nationals.", "第三国国民适用的居留许可范围。"),
      t("Check the federal guidance on Germany’s free-movement and visa rules by citizenship.", "按国籍查阅德国联邦政府的自由流动和签证指引。")),
    url: "https://www.make-it-in-germany.com/en/visa-recognition/apply-for-visa",
    lastVerifiedAt: "2026-11-23T10:08:30Z",
  },
};

export const deSecuredLivelihood: Condition = {
  id: "de-secured-livelihood", input: "answer:deLivelihoodEvidence", operator: "eq", expected: true,
  label: t("The applicable livelihood evidence has been confirmed with the responsible authority", "已向主管机关确认适用于本次申请的生活保障证明"),
  nextStep: t("Ask the responsible German mission or immigration authority which funding evidence applies to the requested stay.", "向主管德国使领馆或外国人管理部门核对本次停留适用的资金证明。"),
  source: source(
    t("Secured livelihood under §20a(4), sentence 1. The applicable evidence depends on the case and filing date.", "《德国居留法》第 20a(4) 条第 1 句的生活保障要求。适用证明由具体情形及申请日期决定。"),
    t("Confirm the accepted evidence for the requested stay with the authority. The generic check has no fixed amount.", "向主管机关核实拟停留期间可接受的证明。此项核对不设统一金额。"),
  ),
};

const residenceTitle: Condition = {
  id: "de-section-3-or-4-title", input: "answer:deSection3Or4Title", operator: "eq", expected: true,
  label: t("Current German residence title falls under chapter 2, section 3 or 4", "当前德国居留许可属于第 2 章第 3 节或第 4 节"),
  nextStep: t("Check the legal basis printed on your current title with the local immigration authority.", "用当前许可所列法律依据向当地外国人管理部门核对。"),
  source: source(
    t("In-country grant under §20a(4), sentence 2.", "德国境内发放适用第 20a(4) 条第 2 句。"),
    t("Confirm a current German residence title for education or employment under the specified sections.", "核实当前德国居留许可是否属于指定章节的教育或就业类别。"),
  ),
};

function repeatLocation(expected: boolean, label: Localized): Condition {
  return {
    ...residenceTitle, id: expected ? "repeat-in-germany" : "repeat-abroad",
    input: "answer:deRepeatInGermany", operator: "eq", expected, label,
    nextStep: t("Confirm where you will be when you apply again.", "核对再次申请时所在地点。"),
  };
}

const repeatInGermany = repeatLocation(true, t("Repeat application from inside Germany", "在德国境内再次申请"));
const repeatAbroad = repeatLocation(false, t("Repeat application from outside Germany", "在德国境外再次申请"));

const repeatWait: Condition = {
  id: "de-repeat-wait", input: "answer:deRepeatWaitConfirmed", operator: "eq", expected: true,
  label: t("The statutory waiting period for another search card has been met", "已满足再次申请求职机会卡的法定等待期"),
  nextStep: t("Compare the period since the last search card expired with the period actually spent in Germany on that card. Confirm the dates and lawful residence with the authority.", "比较前一张求职机会卡到期后的时段与此前持该卡在德国实际停留的时长，并向主管机关确认日期及合法居留情况。"),
  source: source(
    t("Repeat search Opportunity Card under §20a(5), final sentence.", "《德国居留法》第 20a(5) 条末句，再次申请求职机会卡。"),
    t("After expiry, time spent abroad or lawfully in Germany must be at least as long as the prior stay in Germany under a search Opportunity Card.", "上一张求职机会卡到期后，在境外或在德国合法停留的时长，须至少与此前持求职机会卡在德国停留的时间相同。"),
  ),
};

function followUpFact(input: `answer:${string}`, label: Localized, nextStep: Localized, applicable: Localized): Condition {
  return { id: input.slice(7), input, label, nextStep, operator: "eq", expected: true, source: source(applicable, nextStep) };
}

const filedDuringSearchStay = followUpFact("answer:deFollowUpDuringSearch",
  t("Application filed during a stay under the initial search card", "在首次求职机会卡居留期间递交"),
  t("Check the application receipt and the validity of your initial search card with the immigration authority.", "向外国人管理部门核对申请回执和首次求职机会卡的有效期。"),
  t("Timing of the follow-up application under §20a(5), sentence 2.", "后续机会卡申请时间适用第 20a(5) 条第 2 句。"));

const qualifiedEmployment = followUpFact("answer:deFollowUpQualifiedJob",
  t("Contract or binding offer for qualified employment in Germany", "有德国境内合格就业的合同或具约束力的工作邀请"),
  t("Check that the employer’s contract or binding offer is for qualified employment in Germany.", "核对雇主合同或具约束力的邀请是否对应德国境内的合格就业。"),
  t("Employment evidence under §20a(5), sentence 2.", "就业证明适用第 20a(5) 条第 2 句。"));

const employmentAgency = followUpFact("answer:deFollowUpAgencyConsent",
  t("Federal Employment Agency has given consent", "德国联邦就业局已同意"),
  t("Confirm with the immigration authority whether Federal Employment Agency consent was given for this job. Leave the answer blank if it is pending.", "向外国人管理部门确认联邦就业局是否已同意该岗位。仍在办理时请留空。"),
  t("Federal Employment Agency consent under §20a(5), sentence 2.", "联邦就业局同意适用第 20a(5) 条第 2 句。"));

const noOtherResidenceTitle = followUpFact("answer:deFollowUpNoOtherTitle",
  t("No other chapter 2, section 4 residence permit is available on the facts confirmed", "已核实不符合第 2 章第 4 节下的其他居留许可"),
  t("Ask the authority to check other employment residence permits for this job, including permits for skilled workers and the EU Blue Card where relevant.", "请主管机关按该岗位核对其他就业居留许可，包括适用时的技术人才许可和欧盟蓝卡。"),
  t("A follow-up Opportunity Card is subsidiary under §20a(5), sentence 3.", "后续机会卡的适用顺序见第 20a(5) 条第 3 句。"));

const firstExtension: Condition = {
  ...followUp,
  id: "de-first-extension-only",
  label: t("The request is for the first extension as a follow-up card", "本次是首次续为后续机会卡"),
  nextStep: t("A further extension as an Opportunity Card is excluded. Ask about another residence permit.", "法律排除继续延长机会卡。请向主管机关查询其他居留许可。"),
  source: source(
    t("Further extension excluded by §20a(5), sentence 6.", "第 20a(5) 条第 6 句排除继续延长。"),
    t("The requested extension can only be from the initial search card to a follow-up card.", "仅可将首次求职机会卡续为后续机会卡。"),
  ),
};

function scopedPolicy(
  id: string, name: Localized, scope: Localized, cases: readonly Condition[], conditions: readonly Condition[],
  requirement: RuleExpression,
): Policy {
  return {
    id: `de-opportunity-card-${id}`, name, scope, version: "2026-11-28.1", stage: "application",
    conditions: [nationality, ...cases, ...conditions],
    expression: {
      kind: "when",
      test: all(check(nationality.id), any(...cases.map(({ id }) => check(id)))),
      requirement,
    },
  };
}

export const deOpportunityCardScopedPolicies = [
  scopedPolicy("in-germany", t("First application from within Germany", "德国境内首次申请"),
    t("Checks the current residence title and confirmed livelihood evidence. The authority still checks the skilled-worker or points requirements and full eligibility.", "核对现有居留许可及已确认的生活保障证明。技术人才或积分要求及完整资格仍由主管机关核验。"),
    [firstInGermany], [residenceTitle, deSecuredLivelihood], all(check(residenceTitle.id), check(deSecuredLivelihood.id))),
  scopedPolicy("repeat", t("Repeat search Opportunity Card", "再次申请求职机会卡"),
    t("Checks the repeat waiting period, any in-country residence title and confirmed means. The initial-card qualification mechanism and full eligibility still need review.", "核对再次申请等待期、境内申请时的居留许可及已确认的生活保障。首次申请的资格路径及完整资格仍待审核。"),
    [repeat], [repeatWait, repeatInGermany, repeatAbroad, residenceTitle, deSecuredLivelihood],
    all(check(repeatWait.id), any(check(repeatAbroad.id), all(check(repeatInGermany.id), check(residenceTitle.id))), check(deSecuredLivelihood.id))),
  scopedPolicy("follow-up", t("Follow-up Opportunity Card and further extension", "后续机会卡及再次延长"),
    t("Checks §20a(5) including an application during the search-card stay, qualified employment, agency consent, and precedence of other employment permits. A first follow-up can last up to two years. Full eligibility still needs review.", "核对第 20a(5) 条，包括求职卡居留期间递交、合格就业、就业局同意及其他就业许可优先。首次后续机会卡最长两年，完整资格仍待审核。"),
    [followUp, furtherExtension], [firstExtension, filedDuringSearchStay, qualifiedEmployment, employmentAgency, noOtherResidenceTitle, deSecuredLivelihood],
    all(check(firstExtension.id), check(filedDuringSearchStay.id), check(qualifiedEmployment.id),
      check(employmentAgency.id), check(noOtherResidenceTitle.id), check(deSecuredLivelihood.id))),
] as const;
