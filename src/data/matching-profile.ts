import { isDate, type Profile } from "../domain/policy";
import { sgEpCompassCriteria } from "./sg-ep-compass";

export const de2026MonthlyMeansEur = 1_091;

function monthlyCents(value: unknown): number | undefined {
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

  const blocked = monthlyCents(answers.deBlockedEurMonthly);
  const net = monthlyCents(answers.deContractNetEurMonthly);
  answers.deBlockedEurMonthly = blocked === undefined ? undefined : blocked / 100;
  answers.deCombinedMonthlyEur = undefined;
  if (net !== undefined) {
    const knownTotal = net + (blocked ?? 0);
    // An unanswered blocked-account amount cannot establish a shortfall.
    if (Number.isSafeInteger(knownTotal) && (blocked !== undefined || net >= de2026MonthlyMeansEur * 100)) {
      answers.deCombinedMonthlyEur = knownTotal / 100;
    }
  }

  const expiry = answers.sgEpRenewalExpiryDate;
  answers.sgEpRenewalExpiryDate = typeof expiry === "string" && isDate(expiry)
    ? Number(expiry.replaceAll("-", ""))
    : undefined;
  const fixedSalary = monthlyCents(answers.sgEpFixedMonthlySalarySgd);
  answers.sgEpFixedMonthlySalarySgd = fixedSalary === undefined ? undefined : fixedSalary / 100;
  for (const { id, awards } of sgEpCompassCriteria) {
    if (!awards.some((award) => String(award) === answers[id])) answers[id] = undefined;
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

  return { ...profile, age: wholeYears(profile.age, 120), jobOffer, answers };
}
