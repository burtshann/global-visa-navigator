import { caFswAdaptability, caFswEducation, caFswOfferOptions, caFswPartnerOptions, caFswSkills } from "../data/ca-federal-skilled-worker";
import type { Question } from "./profile-questions";

const levels: Record<string, Question> = Object.fromEntries(caFswSkills.map(({ id, label }) => [
  `answer:caFsw${id}`,
  {
    type: "number", section: "education", min: 0, max: 12, step: 1,
    label: { en: `${label.en} level in your first official language (CLB or NCLC)`, zh: `第一官方语言的${label.zh}等级（CLB 或 NCLC）` },
  },
]));
const adaptability: Record<string, Question> = Object.fromEntries(caFswAdaptability.map(({ id, label, evidence }) => [
  `answer:${id}`, { type: "yes-no", section: "experience", label, help: evidence },
]));

export const caFswQuestions = {
  "answer:caFswOutsideQuebec": {
    type: "yes-no", section: "application",
    label: { en: "Do you plan to live outside Quebec?", zh: "你打算在魁北克省以外居住吗？" },
  },
  "answer:caFswAge": {
    type: "number", section: "application", min: 0, max: 120, step: 1,
    label: { en: "Age at the time of your federal skilled worker estimate", zh: "核对联邦技术移民条件时的实足年龄" },
    help: { en: "Use completed years. IRCC applies its age rules at the relevant stages.", zh: "填写实足年龄。IRCC 会按相关阶段的年龄规则认定积分。" },
  },
  "answer:caFswEducation": {
    type: "choice", section: "education",
    label: { en: "Highest education you can document for federal skilled worker points", zh: "可用于联邦技术移民积分的最高可证明学历" },
    help: {
      en: "Use a completed Canadian credential or an accepted immigration ECA showing the Canadian equivalent and less than five years old. Use the designated professional body if IRCC requires it for your primary occupation. A qualifying professional degree must be for a provincially regulated TEER 1 occupation. Leave blank if your evidence is uncertain.",
      zh: "按已完成的加拿大学历，或未满五年且显示加拿大同等学历的认可移民用途 ECA 填写。若 IRCC 要求主要职业由指定专业机构评估，请使用该机构的 ECA。符合要求的执业专业学位须对应由省级机构监管的 TEER 1 职业。证明不确定时请留空。",
    },
    options: [...caFswEducation, { value: "none", label: { en: "Confirmed no qualifying credential or evidence", zh: "确认没有合格的学历或证明" } }],
  },
  "answer:caFswFirstTest": {
    type: "yes-no", section: "education",
    label: { en: "Do you have an IRCC-approved English or French test result less than two years old?", zh: "你是否持有未满两年且 IRCC 认可的英语或法语考试成绩？" },
    help: { en: "Choose the language you are counting as your first official language. Enter the accredited result’s equivalent levels below.", zh: "选择计为第一官方语言的语种，并在下方填写认可成绩换算后的等级。" },
  },
  ...levels,
  "answer:caFswSecondLanguage": {
    type: "yes-no", section: "education",
    label: { en: "Do all four skills in your other official language reach CLB or NCLC 5 on a current approved test?", zh: "另一官方语言的有效认可成绩，听说读写是否均达 CLB 或 NCLC 5 级？" },
  },
  "answer:caFswPrimaryWork": {
    type: "yes-no", section: "experience",
    label: { en: "Do you have one continuous year of qualifying work in your primary NOC?", zh: "你在主要 NOC 职业中有一年连续的合格工作经验吗？" },
    help: {
      en: "Use the last 10 years and check TEER 0–3, pay, duties and 1,560 hours with at most 30 hours per week. Follow IRCC’s guidance for student work and special compensation. Leave blank if eligibility for any period is unclear.",
      zh: "核对过去十年的 TEER 0–3 类别、薪酬、职责和 1,560 小时工时，每周最多计 30 小时。学生工作及特殊报酬按照 IRCC 指引核实。相关时段是否合格不确定时请留空。",
    },
  },
  "answer:caFswWorkYears": {
    type: "number", section: "experience", min: 0, max: 10, step: 1,
    label: { en: "Full years of qualifying skilled work in the last ten years", zh: "过去十年内合格技术工作的整年数" },
    help: { en: "Count full-time equivalent qualifying work. Include qualifying work from other NOCs and exclude overlapping hours.", zh: "按全职等效合格工作累计，可包括其他合格 NOC 职业，重叠工时不得重复计入。" },
  },
  "answer:caFswOffer": {
    type: "choice", section: "finance", options: caFswOfferOptions,
    label: { en: "Which federal skilled worker job-offer evidence can you confirm?", zh: "你能确认哪种联邦技术移民录用邀请证明？" },
    help: { en: "For a funds exemption check section 82(2)(a), (b) or (d). Check IRCC’s November 2026 public policy separately if it may apply.", zh: "资金豁免须核对第 82(2)(a)、(b) 或 (d) 条。如可能适用 2026 年 11 月公共政策，请另行查阅 IRCC 指引。" },
  },
  "answer:caFswPartnerStatus": {
    type: "choice", section: "experience", options: caFswPartnerOptions,
    label: { en: "Which spouse or common-law partner situation applies to you?", zh: "以下哪项符合你的配偶或同居伴侣情况？" },
    help: {
      en: "Partner language, study and work points require an accompanying partner who is neither a Canadian citizen nor a permanent resident residing in Canada. If unsure, leave the status blank. If you have no eligible accompanying partner, answer No to the three partner points questions. Include your spouse or common-law partner in your family count either way.",
      zh: "伴侣语言、学习和工作积分仅适用于随行且既非加拿大公民、也非居住在加拿大的永久居民的伴侣。如不确定，请将身份选项留空。如没有符合条件的随行伴侣，请对下方三项伴侣积分问题选择「否」。核算家庭人数时仍须计入配偶或同居伴侣。",
    },
  },
  ...adaptability,
  "answer:caFswFamilySize": {
    type: "number", section: "finance", min: 1, step: 1,
    label: { en: "Family size for Canadian settlement funds", zh: "核算加拿大安家资金所用家庭人数" },
    help: { en: "Count yourself, your spouse or partner and both of your dependent children. Include family members staying behind and Canadian citizens or permanent residents.", zh: "包括本人、配偶或伴侣及双方各自的受抚养子女，也包括不随行的人和加拿大公民或永久居民。" },
  },
  "answer:caFswFundsDocumentable": {
    type: "yes-no", section: "finance",
    label: { en: "Are the funds available, transferable, unencumbered and documentable?", zh: "这笔资金可用、可转移、无负担且可提供证明吗？" },
    help: { en: "Exclude borrowed funds and real estate equity. Check IRCC’s rules for official financial institution letters.", zh: "不计借款及房地产净值。按 IRCC 规定核对金融机构正式证明。" },
  },
  "answer:caFswFundsCad": {
    type: "number", section: "finance", min: 0, step: 0.01,
    label: { en: "Available settlement funds (CAD)", zh: "可用安家资金（加元）" },
  },
} satisfies Record<string, Question>;
