import type { Profile } from "../domain/policy";
import { caFswEducation, caFswOfferOptions, caFswSkills } from "./ca-federal-skilled-worker";

export const de2026MonthlyMeansEur = 1_091;

function currencyCents(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && Math.abs(cents / 100 - value) < 1e-9 ? cents : undefined;
}

function wholeYears(value: unknown, maximum: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum
    ? value
    : undefined;
}

export function prepareMatchingProfile(profile: Profile): Profile {
  const answers = { ...profile.answers };
  const lastFive = wholeYears(answers.deRelevantYearsLast5, 5);
  const lastSeven = wholeYears(answers.deRelevantYearsLast7, 7);
  const inconsistentExperience = lastFive !== undefined && lastSeven !== undefined
    && (lastFive > lastSeven || lastSeven - lastFive > 2);
  answers.deRelevantYearsLast5 = inconsistentExperience ? undefined : lastFive;
  answers.deRelevantYearsLast7 = inconsistentExperience ? undefined : lastSeven;

  const blocked = currencyCents(answers.deBlockedEurMonthly);
  const net = currencyCents(answers.deContractNetEurMonthly);
  answers.deBlockedEurMonthly = blocked === undefined ? undefined : blocked / 100;
  answers.deCombinedMonthlyEur = undefined;
  if (net !== undefined) {
    const knownTotal = net + (blocked ?? 0);
    // An unanswered blocked-account amount cannot establish a shortfall.
    if (Number.isSafeInteger(knownTotal) && (blocked !== undefined || net >= de2026MonthlyMeansEur * 100)) {
      answers.deCombinedMonthlyEur = knownTotal / 100;
    }
  }

  // A signed employment contract establishes that the applicant has employment
  // evidence. Conflicting answers go back to the user for confirmation.
  let jobOffer = profile.jobOffer;
  if (answers.deGermanPartTimeContract === true) {
    if (jobOffer === false) {
      jobOffer = undefined;
      answers.deGermanPartTimeContract = undefined;
    } else {
      jobOffer = true;
    }
  }

  if (Object.keys(answers).some((key) => key.startsWith("caFsw"))) {
    answers.caFswAge = wholeYears(answers.caFswAge, 120);
    const workYears = wholeYears(answers.caFswWorkYears, 10);
    answers.caFswWorkYears = workYears;
    if (workYears === 0 && answers.caFswPrimaryWork === true) {
      answers.caFswPrimaryWork = undefined;
      answers.caFswWorkYears = undefined;
    }
    for (const { id } of caFswSkills) {
      const key = `caFsw${id}`;
      answers[key] = wholeYears(answers[key], 12);
    }
    if (answers.caFswEducation !== "none" && !caFswEducation.some(({ value }) => value === answers.caFswEducation)) {
      answers.caFswEducation = undefined;
    }
    if (answers.caFswOffer === "policy-pending" || !caFswOfferOptions.some(({ value }) => value === answers.caFswOffer)) {
      answers.caFswOffer = undefined;
    }
    const familySize = wholeYears(answers.caFswFamilySize, 100_000);
    answers.caFswFamilySize = familySize === 0 ? undefined : familySize;
    const funds = currencyCents(answers.caFswFundsCad);
    answers.caFswFundsCad = funds === undefined ? undefined : funds / 100;
  }

  return { ...profile, age: wholeYears(profile.age, 120), jobOffer, answers };
}
