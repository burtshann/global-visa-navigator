import type { Condition, RuleExpression, RuleSource } from "../domain/policy";
import { ukSkilledTable1Rates } from "./uk-skilled-table-1";

const appendix = "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-skilled-worker";
const table1 = "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-skilled-occupations#table-1-eligible-soc-2020-occupation-codes-and-related-going-rates-based-on-median-annual-survey-of-hours-and-earnings-ashe-data";
const sponsorGuidance = "https://www.gov.uk/government/publications/sponsor-a-skilled-worker/workers-and-temporary-workers-sponsor-a-skilled-worker-accessible";
const effectiveDateUrl = "https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-997-1-july-2025/statement-of-changes-to-the-immigration-rules-hc-997-1-july-2025-accessible-version";
const table1Codes = ukSkilledTable1Rates.map(([code]) => code);
const checked = {
  effectiveFrom: "2025-07-22",
  effectiveDateUrl,
  lastVerifiedAt: "2026-11-27T12:04:43Z",
  reviewStatus: "verified",
  applicableWhen: {
    en: "First principal application relying on Option A for a job in Appendix Skilled Occupations Table 1 with a Certificate of Sponsorship issued from 22 July 2025.",
    zh: "适用于凭 2025 年 7 月 22 日起签发的担保证明首次申请的主申请人，岗位列在《技术职业附录》表 1，且按标准薪资选项 A 申请。",
  },
} satisfies Omit<RuleSource, "url">;

export const optionA = {
  id: "uk-sw-option-a",
  input: "answer:ukSkilledStandardOption",
  operator: "eq",
  expected: true,
  label: { en: "Applying under standard salary Option A", zh: "适用标准薪资选项 A" },
  nextStep: {
    en: "Ask the sponsor to confirm the salary option. Check the official guidance separately for other options and transitional cases.",
    zh: "请雇主确认本次适用的薪资选项。其他选项或过渡安排请另行查阅官方规则。",
  },
  source: {
    ...checked,
    url: appendix + "#points-requirement-for-a-skilled-worker",
    evidence: {
      en: "Option A requires annual pay of at least £41,700 and 100% of the going rate. Other salary options apply separately.",
      zh: "选项 A 要求年薪至少达到 £41,700，且达到职业工资标准的 100%。其他薪资选项另有要求。",
    },
  },
} satisfies Condition;

export const table1Occupation = {
  id: "uk-sw-soc-table-1",
  input: "answer:ukSkilledSocCode",
  operator: "in",
  expected: [table1Codes[0], ...table1Codes.slice(1)],
  label: { en: "The SOC 2020 code on the CoS is in Table 1", zh: "担保证明上的 SOC 2020 职业代码列在表 1" },
  nextStep: {
    en: "Confirm the four-digit code and that it matches the job duties with the sponsor. If the code is in a different table or shortage list, check the rules for that list.",
    zh: "请雇主核实四位职业代码，确认与岗位职责相符。代码若列于其他表格或短缺职业名单，请查阅其适用规则。",
  },
  source: {
    ...checked,
    url: table1,
    evidence: {
      en: "SW 6.1 and SW 8.1 recognise Table 1 codes. Employer duties, additional restrictions and other eligible lists need separate verification.",
      zh: "SW 6.1 和 SW 8.1 认可表 1 职业代码。岗位职责、附加限制及其他符合条件的名单须另行核实。",
    },
  },
} satisfies Condition;

export const generalSalary = {
  id: "uk-sw-standard-general-salary",
  input: "answer:ukSkilledCappedAnnualPayGbp",
  operator: "gte",
  expected: 41_700,
  label: { en: "At least £41,700 eligible annual pay, counting up to 48 weekly hours", zh: "符合计算口径的年薪至少 £41,700，按每周最多 48 小时计" },
  nextStep: {
    en: "Confirm the eligible annual gross pay and fixed weekly hours with the sponsor. Only the first 48 weekly hours count towards this threshold.",
    zh: "请雇主核实符合官方口径的税前年薪及固定每周工时。此门槛最多计入每周前 48 小时对应的薪资。",
  },
  source: {
    ...checked,
    url: appendix + "#consideration-of-salary-all-tradeable-points-options",
    evidence: {
      en: "The Option A threshold in SW 4.4 is £41,700. SW 14.1 to SW 14.3 specify eligible pay, exclusions, deductions and the 48-hour cap for a fixed work pattern. Variable cycles have separate rules.",
      zh: "SW 4.4 的选项 A 门槛为 £41,700。SW 14.1 至 14.3 规定计入的工资、排除和扣减项目，以及固定工时每周 48 小时上限。轮班工时不固定时另有规则。",
    },
  },
} satisfies Condition;

export const hourlySalary = {
  id: "uk-sw-standard-hourly-floor",
  input: "answer:ukSkilledHourlyPayPence",
  operator: "gte",
  expected: 1_713,
  label: { en: "At least £17.13 for each hour worked", zh: "每个工作小时至少 £17.13" },
  nextStep: {
    en: "Ask the sponsor to confirm the eligible hourly rate across all weekly hours.",
    zh: "请雇主按完整每周工时核实符合规则的时薪。",
  },
  source: {
    ...checked,
    url: sponsorGuidance,
    evidence: {
      en: "Sponsor guidance SK6.12 applies the £17.13 hourly floor where the calculated going rate would be lower.",
      zh: "担保方指引 SK6.12 规定，职业工资折算时薪低于 £17.13 时，须按 £17.13 计算。",
    },
  },
} satisfies Condition;

export const goingRate: RuleExpression = {
  kind: "threshold-table",
  id: "uk-sw-standard-going-rate",
  input: "answer:ukSkilledPayAtStandardHoursGbp",
  bandInput: "answer:ukSkilledWeeklyHours",
  categoryInput: "answer:ukSkilledSocCode",
  bandStarts: [1],
  maximumBandInput: 16_800,
  categories: ukSkilledTable1Rates.map(([value, annualRate]) => ({ value, minimums: [annualRate] })),
  unit: { en: "GBP per year at 37.5 hours/week", zh: "英镑/年（每周 37.5 小时）" },
  label: { en: "Pay meets the occupational going rate after adjusting for weekly hours", zh: "薪资达到按每周工时折算的职业工资标准" },
  nextStep: {
    en: "Check the Table 1 rate for the CoS code with the sponsor. Multiply that rate by your weekly hours divided by 37.5. Count all weekly hours for this check.",
    zh: "请雇主查阅担保证明职业代码对应的表 1 工资。以实际每周工时除以 37.5，再将所得比值乘以表中标准。此项核对计入全部每周工时。",
  },
  source: {
    ...checked,
    url: table1,
    evidence: {
      en: "SW 8.1 uses the Option A full going rate. Under SW 14.4, all sponsored weekly hours count, including hours beyond 48. The tables are published for a 37.5-hour week.",
      zh: "SW 8.1 要求达到选项 A 完整职业工资标准。SW 14.4 规定计入担保岗位的全部每周工时，包括超过 48 小时的部分。表格以每周 37.5 小时为基准。",
    },
  },
};
