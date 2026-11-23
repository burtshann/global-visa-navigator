import type { Route } from "../data/catalog";
import type { Localized, Profile } from "../domain/policy";
import { copy, specificQuestions } from "./navigator-copy";
import { routePolicies, type Language } from "./policy-result";

const sectionLabels = {
  application: { en: "Application circumstances", zh: "申请情况" },
  education: { en: "Education and language", zh: "学历与语言" },
  experience: { en: "Experience and other points factors", zh: "职业经验及其他积分因素" },
  finance: { en: "Proof of funds", zh: "资金证明" },
} satisfies Record<string, Localized>;

type Section = keyof typeof sectionLabels;
type Question = {
  label: Localized;
  section: Section;
  help?: Localized;
} & (
  | { type: "yes-no" }
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

const orderedInputs = Object.keys(questions);

export function getRuleQuestionGroups(routes: readonly Route[]): QuestionGroup[] {
  const seen = new Set<string>();
  return routes.flatMap((route) => {
    const inputs = new Set<string>(routePolicies(route).flatMap(({ conditions }) => conditions.map(({ input }) => input)));
    if (inputs.has("answer:deCombinedMonthlyEur")) {
      inputs.add("answer:deContractNetEurMonthly");
      inputs.add("answer:deBlockedEurMonthly");
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

export function readProfile(form: HTMLFormElement, groups: readonly QuestionGroup[]): Profile {
  // Form controls have IDs only, so a native submission sends no personal values.
  let age: number | undefined;
  let jobOffer: boolean | undefined;
  const answers: Record<string, string | number | boolean> = {};
  for (const { fields } of groups) {
    for (const { input, id, question } of fields) {
      const field = form.elements.namedItem(id);
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement) || field.value === "") continue;

      if (input === "age") age = Number(field.value);
      else if (input === "jobOffer") jobOffer = field.value === "yes";
      else if (input.startsWith("answer:")) {
        answers[input.slice("answer:".length)] = question.type === "yes-no"
          ? field.value === "yes"
          : question.type === "number" ? Number(field.value) : field.value;
      }
    }
  }

  const goal = form.elements.namedItem("profile-goal");
  return { age, jobOffer, goal: goal instanceof HTMLSelectElement ? goal.value || undefined : undefined, answers };
}

function QuestionControl({ id, question, language }: { id: string; question: Question; language: Language }) {
  const helpId = question.help ? `${id}-help` : undefined;
  const options = question.type === "choice" ? question.options : [
    { value: "yes", label: copy.yes }, { value: "no", label: copy.no },
  ];

  return (
    <div className="field">
      <label htmlFor={id}>{question.label[language]}</label>
      {question.type === "number" ? (
        <input id={id} type="number" min={question.min} max={question.max} step={question.step}
          inputMode={question.step === 1 ? "numeric" : "decimal"} aria-describedby={helpId} />
      ) : (
        <select id={id} aria-describedby={helpId}>
          <option value="">{copy.unfinished[language]}</option>
          {options.map(({ value, label }) => <option key={value} value={value}>{label[language]}</option>)}
        </select>
      )}
      {question.help && <p id={helpId} className="field-help">{question.help[language]}</p>}
    </div>
  );
}

export function RuleQuestions({ groups, language }: { groups: readonly QuestionGroup[]; language: Language }) {
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
                    {fieldsInSection.map(({ id, question }) => (
                      <QuestionControl id={id} question={question} language={language} key={id} />
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
