import type { Route } from "../data/catalog";
import { policyInputs, type Localized, type Profile } from "../domain/policy";
import { copy, specificQuestions } from "./navigator-copy";
import { routePolicies, type Language } from "./policy-result";

const sectionLabels = {
  application: { en: "Application circumstances", zh: "申请情况" },
  education: { en: "Education and language", zh: "学历与语言" },
  experience: { en: "Experience and other points factors", zh: "职业经验及其他积分因素" },
  finance: { en: "Proof of funds", zh: "资金证明" },
  ukEmployment: { en: "UK occupation and salary", zh: "英国职业及薪资" },
} satisfies Record<string, Localized>;

type Section = keyof typeof sectionLabels;
type Question = {
  label: Localized;
  section: Section;
  help?: Localized;
} & (
  | { type: "yes-no" }
  | { type: "soc-code" }
  | { type: "number"; min: number; max?: number; step?: number }
  | { type: "choice"; options: readonly { value: string; label: Localized }[] }
);

const languageLevels = [
  { value: "none", label: { en: "No documented level", zh: "无可证明的等级" } },
  ...["A1", "A2", "B1", "B2", "C1", "C2"].map((value) => ({ value, label: { en: value, zh: value } })),
];

const questions: Record<string, Question> = {
  age: {
    type: "number", section: "application", min: 0, max: 120, step: 1,
    label: { en: "Age on your application date", zh: "提交申请当日的年龄" },
    help: { en: "If you are 35 or 40, confirm your age points with the relevant authority.", zh: "如果你在申请日为 35 岁或 40 岁，请向主管机关确认年龄积分。" },
  },
  jobOffer: {
    type: "yes-no", section: "finance",
    label: { en: "Do you have a job offer or employment contract?", zh: "你是否已有工作邀请或雇佣合同？" },
    help: { en: "Funding checks need the contract details below.", zh: "核对资金证明时还需填写下方的合同详情。" },
  },
  "answer:inUk": { type: "yes-no", section: "application", label: specificQuestions.inUk },
  "answer:ukCompletionReported": { type: "yes-no", section: "application", label: specificQuestions.ukCompletionReported },
  "answer:ukSkilledWorkerInitial": {
    type: "yes-no", section: "application",
    label: { en: "Are you applying as the main applicant for your first Skilled Worker grant?", zh: "你是否作为主申请人申请，而且此前从未持有 Skilled Worker 许可？" },
    help: { en: "This check covers your first grant. Extensions and changes after a Skilled Worker grant have separate rules.", zh: "本次核对适用于首次获批。已有 Skilled Worker 许可后的续签或变更另有规则。" },
  },
  "answer:ukSkilledApplyingFromAbroad": {
    type: "yes-no", section: "application",
    label: { en: "Will you submit your Skilled Worker application from outside the UK?", zh: "你会从英国境外提交 Skilled Worker 申请吗？" },
  },
  "answer:ukSkilledUsingAfghanNationality": {
    type: "yes-no", section: "application",
    label: { en: "If applying from outside the UK, will you use Afghan nationality as your main nationality on this application?", zh: "如从英国境外申请，你会将阿富汗国籍填为本次申请的主要国籍吗？" },
    help: { en: "If you have two nationalities, answer for the passport or travel document used on this application. Leave it blank if you are unsure or applying from within the UK.", zh: "如有双重国籍，请按本次申请使用的护照或旅行证件回答。如不确定或从英国境内申请，请留空。" },
  },
  "answer:ukSkilledAge": {
    type: "number", section: "application", min: 0, max: 120, step: 1,
    label: { en: "Age on the Skilled Worker application date", zh: "提交 Skilled Worker 申请当天的年龄" },
  },
  "answer:ukSkilledJobCos": {
    type: "yes-no", section: "application",
    label: { en: "Has the sponsor assigned a Certificate of Sponsorship for this specific UK job?", zh: "担保雇主是否已就这个英国岗位为你分配担保证书（CoS）？" },
    help: { en: "Confirm this CoS states the applicant, this job and salary, the Skilled Worker route and PAYE details where required. For applications abroad, verify that the Home Office allocated the defined CoS for this job.", zh: "请确认该 CoS 载明申请人、岗位、薪资、Skilled Worker 担保类别及适用的 PAYE 信息。从境外申请时，请核实内政部已为该岗位配发 Defined CoS。" },
  },
  "answer:ukSkilledSponsorRated": {
    type: "yes-no", section: "application",
    label: { en: "Have you verified the employer is an A-rated Skilled Worker sponsor authorised for this job?", zh: "你是否已确认该雇主为获准担保这个岗位的 A 级 Skilled Worker 担保机构？" },
    help: { en: "Check the official sponsor register and confirm authorisation for this role with the employer.", zh: "查阅官方担保机构登记册，并向雇主核实该岗位的担保授权。" },
  },
  "answer:ukSkilledCosIssueInWindow": {
    type: "yes-no", section: "application",
    label: { en: "Is the CoS within its issue-to-application time limit?", zh: "担保证明签发后是否仍在适用递交期限内？" },
    help: { en: "Check the planned application date with your sponsor. The usual period is three months. A CoS linked to an SRN uses 90 days, excluding time spent reviewing sponsor-requested changes.", zh: "请与雇主核实计划递交日。通常为三个月。关联担保参考编号（SRN）的证书适用 90 天，扣除雇主请求的修改处于审核中的时间。" },
  },
  "answer:ukSkilledCosStartInWindow": {
    type: "yes-no", section: "application",
    label: { en: "Is the CoS job start date no more than three months after your planned application?", zh: "担保证明注明的入职日是否不晚于计划递交日后三个月？" },
  },
  "answer:ukSkilledCosUsable": {
    type: "yes-no", section: "application",
    label: { en: "Has the sponsor confirmed that this CoS can still be used?", zh: "雇主是否已确认该担保证明仍可使用？" },
    help: { en: "A cancelled or withdrawn CoS, or one used in a granted or refused application, cannot be used. Leave blank if its status is unconfirmed.", zh: "已取消、已撤回或用在获批或被拒申请中的证明不可使用。状态未核实时请留空。" },
  },
  "answer:ukSkilledAtasBasis": {
    type: "choice", section: "application",
    label: { en: "What does your sponsor confirm about ATAS?", zh: "雇主对 ATAS 要求作了什么确认？" },
    options: [
      { value: "not-required", label: { en: "CoS confirms ATAS is unnecessary", zh: "担保证明确认无需 ATAS" } },
      { value: "valid", label: { en: "ATAS applies and I have a valid certificate", zh: "适用 ATAS，且已持有有效证书" } },
      { value: "required-missing", label: { en: "ATAS applies and I lack a valid certificate", zh: "适用 ATAS，但未持有有效证书" } },
    ],
  },
  "answer:ukSkilledStandardOption": {
    type: "yes-no", section: "ukEmployment",
    label: { en: "Has your sponsor confirmed the current standard salary rules under Option A?", zh: "雇主是否已确认适用现行标准薪资选项 A？" },
    help: { en: "Choose Yes only when the sponsor confirms Option A and a CoS issued on or after 22 July 2025. Leave blank if the salary option or applicable rules are unclear.", zh: "仅在雇主确认适用选项 A 且担保证明于 2025 年 7 月 22 日或以后签发时选择「是」。选项或适用规则不明时请留空。" },
  },
  "answer:ukSkilledSocCode": {
    type: "soc-code", section: "ukEmployment",
    label: { en: "SOC 2020 occupation code on the CoS", zh: "担保证明上的 SOC 2020 职业代码" },
    help: { en: "Enter four digits as confirmed by the sponsor for your role. A code outside Table 1 needs a separate check.", zh: "请输入雇主为该岗位确认的四位代码。表 1 之外的代码需另行核实。" },
  },
  "answer:ukSkilledWeeklyHours": {
    type: "number", section: "ukEmployment", min: 0.01, max: 168, step: 0.01,
    label: { en: "Fixed weekly hours on the CoS", zh: "担保证明上的固定每周工时" },
    help: { en: "Provide all weekly hours, including any above 48. Leave blank for variable cycles.", zh: "填写全部每周工时，包括超过 48 小时的部分。工时不固定时请留空。" },
  },
  "answer:ukSkilledAnnualPayGbp": {
    type: "number", section: "ukEmployment", min: 0, step: 0.01,
    label: { en: "Eligible gross annual salary confirmed by your sponsor (GBP)", zh: "雇主确认符合计算口径的税前年薪（英镑）" },
    help: { en: "Use the annual equivalent of the guaranteed eligible pay for all stated hours. Exclude overtime supplements, bonuses and benefits. Ask the sponsor to account for applicable deductions.", zh: "按填报的全部工时填写符合规则的保证薪资年化金额。排除加班补贴、奖金及福利，并请雇主核实适用扣减。" },
  },
  "answer:ukSkilledPayConfirmed": {
    type: "yes-no", section: "ukEmployment",
    label: { en: "Has the sponsor confirmed these salary figures and fixed weekly hours?", zh: "雇主是否已确认上述薪资和固定每周工时？" },
    help: { en: "Choose Yes only for fixed weekly hours with eligible pay evenly spread across those hours. Ask the sponsor to confirm the annual amount after applying Home Office inclusion and deduction rules.", zh: "仅在每周工时固定、符合口径的薪资均匀分摊到工时，且雇主已按内政部的计入与扣减规则核实年薪时选择「是」。" },
  },
  "answer:ukSkilledEnglishBasis": {
    type: "choice", section: "education",
    label: { en: "Which accepted English evidence can you provide for Skilled Worker?", zh: "你能为 Skilled Worker 提供哪种认可的英语证明？" },
    options: [
      { value: "selt-b2", label: { en: "Approved English test within two years, B2 or above in all four skills", zh: "两年内获认可的英语考试，听说读写均达到 B2 或以上" } },
      { value: "other-verified-evidence", label: { en: "Another permitted form confirmed against Appendix English Language", zh: "已按《英语语言附录》核实的其他获准证明方式" } },
      { value: "none", label: { en: "No accepted evidence after checking the official alternatives", zh: "核对官方替代方式后，确认没有合规证明" } },
    ],
    help: { en: "Leave this unanswered if you are unsure which official evidence applies to you.", zh: "若不确定适用哪种官方证明，请留空。" },
  },
  "answer:sgEpInitialApplication": {
    type: "yes-no", section: "application",
    label: { en: "Are you checking a new Singapore Employment Pass application?", zh: "你正在核对新的新加坡 Employment Pass 申请吗？" },
    help: { en: "Use this check for a new application. Renewal dates and requirements differ.", zh: "本次核对适用于新申请。续签的生效日期和要求有所不同。" },
  },
  "answer:sgEpSingaporeJobOffer": {
    type: "yes-no", section: "application",
    label: { en: "Do you have a job offer in Singapore?", zh: "你是否已获得在新加坡工作的录用邀请？" },
  },
  "answer:sgEpAge": {
    type: "number", section: "application", min: 0, max: 120, step: 1,
    label: { en: "Age on the Employment Pass application date", zh: "提交 Employment Pass 申请当天的年龄" },
    help: { en: "Enter completed years. Check with MOM if your application date falls near your birthday.", zh: "填写实足年龄。如申请日接近生日，请向新加坡人力部确认。" },
  },
  "answer:sgEpFinancialSector": {
    type: "yes-no", section: "finance",
    label: { en: "Is the employer classified by MOM as financial services?", zh: "雇主在人力部的行业分类是否属于金融服务业？" },
    help: { en: "Choose No only if the employer confirms another classification. Leave blank if it is unknown.", zh: "仅在雇主确认属于其他行业时选择「否」。分类未知时请留空。" },
  },
  "answer:sgEpFixedMonthlySalarySgd": {
    type: "number", section: "finance", min: 0, step: 0.01,
    label: { en: "Offered fixed monthly salary (SGD)", zh: "录用邀请中的固定月薪（新加坡元）" },
    help: { en: "Enter the basic monthly salary plus fixed monthly allowances. Exclude variable bonuses, commission, overtime and benefits in kind.", zh: "填写基本月薪与每月固定津贴之和。浮动奖金、佣金、加班费及实物福利不计入。" },
  },
  "answer:outsideEuEfta": { type: "yes-no", section: "application", label: specificQuestions.outsideEuEfta },
  "answer:deRecognizedQualification": { type: "yes-no", section: "education", label: specificQuestions.deRecognizedQualification },
  "answer:deLivelihoodEvidence": { type: "yes-no", section: "finance", label: specificQuestions.deLivelihoodEvidence },
  "answer:deApplyingFromAbroad": {
    type: "yes-no", section: "application",
    label: { en: "Will you apply for your first Opportunity Card from outside Germany?", zh: "你是否会在德国境外首次申请机会卡？" },
  },
  "answer:deQualificationBasis": {
    type: "choice", section: "education",
    label: { en: "Which qualifying education evidence do you have?", zh: "你持有哪类符合要求的学历或职业资格证明？" },
    options: [
      { value: "academic", label: { en: "State-recognised degree with German confirmation", zh: "授予国官方认可、且经德国主管机构确认的学位" } },
      { value: "vocational", label: { en: "State-recognised vocational qualification (at least two years) with German confirmation", zh: "授予国官方认可且经德国主管机构确认的职业资格（培训至少两年）" } },
      { value: "ahk", label: { en: "Verified qualifying German Chamber of Commerce Abroad (AHK) certificate", zh: "经核实符合条件的德国海外商会（AHK）证书" } },
      { value: "none", label: { en: "None of these kinds of evidence", zh: "以上证明均无" } },
    ],
    help: {
      en: "State recognition is in the country of award. German evidence may include Anabin or a ZAB evaluation (DAB for vocational qualifications), as applicable. Leave blank if you are unsure.",
      zh: "学位或资格须在授予国获官方认可，且有适用的德国证明，例如 Anabin 记录或 ZAB 评估（职业资格适用 DAB）。如不确定，请留空。",
    },
  },
  "answer:deGermanLevel": {
    type: "choice", section: "education", options: languageLevels,
    label: { en: "Documented German level (CEFR)", zh: "可证明的德语等级（CEFR）" },
  },
  "answer:deEnglishLevel": {
    type: "choice", section: "education", options: [
      ...languageLevels,
      { value: "native-accepted", label: { en: "Native speaker with evidence accepted by the mission", zh: "英语为母语，且使领馆已确认接受相应证明" } },
    ],
    label: { en: "Documented English level (CEFR)", zh: "可证明的英语等级（CEFR）" },
  },
  "answer:dePartialRecognition": {
    type: "yes-no", section: "education",
    label: { en: "Do you have a German decision requiring further measures for qualification equivalence or professional licensing?", zh: "你是否收到德国官方决定，要求完成补偿或适应措施后方可认定资格等同或取得执业许可？" },
  },
  "answer:deShortageQualification": {
    type: "yes-no", section: "experience",
    label: { en: "Is your qualification in an occupation on Germany’s official shortage list for this route?", zh: "你的学历或职业资格是否属于该路径官方短缺职业清单中的职业？" },
  },
  "answer:deRelevantYearsLast5": {
    type: "number", section: "experience", min: 0, max: 5, step: 1,
    label: { en: "Full years of relevant work in the last five years", zh: "申请前五年内的相关工作整年数" },
    help: { en: "Count only lawful paid work related to your qualification and gained after you obtained it.", zh: "只计取得资格后从事的相关合法带薪工作。" },
  },
  "answer:deRelevantYearsLast7": {
    type: "number", section: "experience", min: 0, max: 7, step: 1,
    label: { en: "Full years of relevant work in the last seven years", zh: "申请前七年内的相关工作整年数" },
  },
  "answer:dePriorStay": {
    type: "yes-no", section: "experience",
    label: { en: "In the last five years, did you live lawfully in Germany for at least six continuous months?", zh: "申请前五年内，你是否曾在德国连续合法居住至少六个月？" },
    help: { en: "Exclude tourist stays.", zh: "观光旅游停留不计入。" },
  },
  "answer:deJointPartner": {
    type: "yes-no", section: "experience",
    label: { en: "Will your spouse or registered partner qualify independently and apply with you?", zh: "你的配偶或登记伴侣是否独立符合条件并与你共同申请？" },
    help: {
      en: "Apply at the same mission and plan to enter together. Your partner may already have applied. Reference their application in yours.",
      zh: "双方须在同一德国使领馆申请并计划共同入境。对方可以已递交申请。请在你的申请中引用对方的申请。",
    },
  },
  "answer:deFormalCommitment": {
    type: "yes-no", section: "finance",
    label: { en: "Do you have a valid formal declaration of commitment covering your living costs?", zh: "你是否持有可覆盖生活费的有效正式担保声明？" },
  },
  "answer:deGermanPartTimeContract": {
    type: "yes-no", section: "finance",
    label: { en: "Do you have a signed part-time contract with an employer in Germany?", zh: "你是否与德国境内的雇主签署了兼职雇佣合同？" },
  },
  "answer:deBlockedEurMonthly": {
    type: "number", section: "finance", min: 0, step: 0.01,
    label: { en: "Blocked-account funds per month of your stay (€)", zh: "计划停留期间每月可支取的冻结账户资金（欧元）" },
    help: { en: "Enter 0 if you have no blocked-account funds. Use only funds you can document.", zh: "如无冻结账户资金，请填 0。只填可提供证明的金额。" },
  },
  "answer:deContractHoursWeekly": {
    type: "number", section: "finance", min: 0, max: 168, step: 0.01,
    label: { en: "Average total weekly hours in the signed German contracts", zh: "已签德国合同的每周平均总工时" },
  },
  "answer:deContractNetEurMonthly": {
    type: "number", section: "finance", min: 0, step: 0.01,
    label: { en: "Total monthly net pay in the signed German contracts (€)", zh: "已签德国合同的每月净收入总额（欧元）" },
  },
};

type Field = { input: string; id: string; question: Question };
type QuestionGroup = { route: Route; fields: Field[] };
export type ProfileDraft = Readonly<Partial<Record<string, string>>>;

const orderedInputs = Object.keys(questions);

export function getRuleQuestionGroups(routes: readonly Route[]): QuestionGroup[] {
  const seen = new Set<string>();
  return routes.flatMap((route) => {
    const inputs = new Set<string>(routePolicies(route).flatMap(policyInputs));
    if (inputs.has("answer:deCombinedMonthlyEur")) {
      inputs.add("answer:deContractNetEurMonthly");
      inputs.add("answer:deBlockedEurMonthly");
    }
    if (inputs.has("answer:ukSkilledCappedAnnualPayGbp")) {
      inputs.add("answer:ukSkilledAnnualPayGbp");
      inputs.add("answer:ukSkilledPayConfirmed");
    }
    const fields = orderedInputs.flatMap((input) => {
      if (!inputs.has(input) || seen.has(input)) return [];
      seen.add(input);
      const id = input === "age" ? "profile-age"
        : input === "jobOffer" ? "profile-offer"
        : `question-${route.id}-${input.slice("answer:".length)}`;
      return [{ input, id, question: questions[input] }];
    });
    return fields.length > 0 ? [{ route, fields }] : [];
  });
}

export function readProfile(draft: ProfileDraft, groups: readonly QuestionGroup[]): Profile {
  let age: number | undefined;
  let jobOffer: boolean | undefined;
  const answers: Record<string, string | number | boolean> = {};
  for (const { fields } of groups) {
    for (const { input, question } of fields) {
      const value = draft[input];
      if (!value) continue;

      if (input === "age") age = Number(value);
      else if (input === "jobOffer") jobOffer = value === "yes";
      else if (input.startsWith("answer:")) {
        answers[input.slice("answer:".length)] = question.type === "yes-no"
          ? value === "yes"
          : question.type === "number" ? Number(value) : value;
      }
    }
  }

  return { age, jobOffer, goal: draft.goal || undefined, answers };
}

function QuestionControl({ id, question, language, value, onChange }: {
  id: string;
  question: Question;
  language: Language;
  value: string;
  onChange: (value: string) => void;
}) {
  const helpId = question.help ? `${id}-help` : undefined;
  const options = question.type === "choice" ? question.options : [
    { value: "yes", label: copy.yes }, { value: "no", label: copy.no },
  ];

  return (
    <div className="field">
      <label htmlFor={id}>{question.label[language]}</label>
      {question.type === "number" ? (
        <input id={id} type="number" min={question.min} max={question.max} step={question.step}
          value={value} onChange={(event) => onChange(event.target.value)}
          inputMode={question.step === 1 ? "numeric" : "decimal"} aria-describedby={helpId} />
      ) : question.type === "soc-code" ? (
        <input id={id} type="text" inputMode="numeric" maxLength={4}
          value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={helpId} />
      ) : (
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={helpId}>
          <option value="">{copy.unfinished[language]}</option>
          {options.map(({ value, label }) => <option key={value} value={value}>{label[language]}</option>)}
        </select>
      )}
      {question.help && <p id={helpId} className="field-help">{question.help[language]}</p>}
    </div>
  );
}

const ukSalaryEvidenceInputs = new Set([
  "answer:ukSkilledStandardOption", "answer:ukSkilledJobCos", "answer:ukSkilledSocCode",
  "answer:ukSkilledWeeklyHours", "answer:ukSkilledAnnualPayGbp",
]);

export function RuleQuestions({ groups, language, draft, onChange }: {
  groups: readonly QuestionGroup[];
  language: Language;
  draft: ProfileDraft;
  onChange: (input: string, value: string) => void;
}) {
  if (groups.length === 0) return null;

  const sections = Object.keys(sectionLabels) as Section[];
  return (
    <details className="rule-questions" open>
      <summary>{copy.pathwayQuestions[language]}</summary>
      <p>{copy.pathwayQuestionsIntro[language]}</p>
      <div className="rule-question-groups">
        {groups.map(({ route, fields }) => (
          <fieldset key={route.id}>
            <legend>{route.name[language]}</legend>
            {sections.map((section) => {
              const fieldsInSection = fields.filter(({ question }) => question.section === section);
              if (fieldsInSection.length === 0) return null;
              return (
                <div className="question-section" key={section}>
                  <p className="question-section-title">{sectionLabels[section][language]}</p>
                  <div className="question-grid">
                    {fieldsInSection.map(({ id, input, question }) => (
                      <QuestionControl id={id} question={question} language={language} key={id}
                        value={draft[input] ?? ""} onChange={(value) => {
                          if (ukSalaryEvidenceInputs.has(input) && value !== (draft[input] ?? "")) {
                            onChange("answer:ukSkilledPayConfirmed", "");
                          }
                          onChange(input, value);
                        }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>
    </details>
  );
}
