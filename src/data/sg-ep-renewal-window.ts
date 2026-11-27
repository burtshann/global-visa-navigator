import type { Condition, RuleSource } from "../domain/policy";

export const sgEpRenewalUrl = "https://www.mom.gov.sg/passes-and-permits/employment-pass/renew-a-pass";

const timingSource: RuleSource = {
  url: sgEpRenewalUrl,
  applicableWhen: {
    en: "The deadline applies to existing Employment Pass renewals. The opening date check covers ordinary EP renewals.",
    zh: "截止日期适用于现有就业准证续签。开放日期核对适用于普通就业准证续签。",
  },
  evidence: {
    en: "MOM requires renewal before the expiry date and directs employers to apply for a new pass after the deadline. MOM's renewal calculator uses 180 days before expiry for ordinary EPs. EP (Sponsorship) has a separate three-month opening window.",
    zh: "新加坡人力部规定须在到期日前递交续签，错过截止日期须重新申请准证。人力部的续签日期计算器按普通就业准证到期前 180 天开放。担保类就业准证另有三个月的开放窗口。",
  },
  effectiveFrom: null,
  lastVerifiedAt: "2026-11-26T23:59:03Z",
  reviewStatus: "verified",
};

export const renewalDeadline = {
  id: "sg-ep-renewal-before-deadline",
  input: "answer:sgEpDaysUntilExpiry",
  operator: "gte",
  expected: 1,
  label: { en: "Today is before the pass expiry date in Singapore", zh: "按新加坡当地日期，今天早于准证到期日" },
  nextStep: {
    en: "Enter the expiry date from the existing pass. If it is today or earlier, ask your employer to apply for a new pass.",
    zh: "请填写现有准证上的到期日。如果今天已到期或超过到期日，请雇主重新申请准证。",
  },
  source: timingSource,
} satisfies Condition;

export const renewalWindowOpened = {
  id: "sg-ep-renewal-window-opened",
  input: "answer:sgEpDaysUntilExpiry",
  operator: "lte",
  expected: 180,
  label: {
    en: "The ordinary EP renewal window has opened (180 days before expiry)",
    zh: "普通就业准证续签窗口已开放（到期前 180 天）",
  },
  nextStep: {
    en: "Use MOM’s renewal calculator to check when you can file. For an EP (Sponsorship), confirm the separate three-month window.",
    zh: "请使用新加坡人力部的续签日期计算器查询何时可以递交。持担保类就业准证时，请核实另行适用的三个月窗口。",
  },
  source: timingSource,
} satisfies Condition;
