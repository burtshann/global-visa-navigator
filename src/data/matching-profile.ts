import type { Profile } from "../domain/policy";

export const de2026MonthlyMeansEur = 1_091;

function hundredths(value: unknown): number | undefined {
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

  const blocked = hundredths(answers.deBlockedEurMonthly);
  const net = hundredths(answers.deContractNetEurMonthly);
  answers.deBlockedEurMonthly = blocked === undefined ? undefined : blocked / 100;
  answers.deCombinedMonthlyEur = undefined;
  if (net !== undefined) {
    const knownTotal = net + (blocked ?? 0);
    // An unanswered blocked-account amount cannot establish a shortfall.
    if (Number.isSafeInteger(knownTotal) && (blocked !== undefined || net >= de2026MonthlyMeansEur * 100)) {
      answers.deCombinedMonthlyEur = knownTotal / 100;
    }
  }

  answers.ukSkilledAge = wholeYears(answers.ukSkilledAge, 120);
  const socCode = answers.ukSkilledSocCode;
  answers.ukSkilledSocCode = typeof socCode === "string" && /^[0-9]{4}$/.test(socCode.trim())
    ? socCode.trim()
    : undefined;
  const weeklyHours = hundredths(answers.ukSkilledWeeklyHours);
  answers.ukSkilledWeeklyHours = weeklyHours && weeklyHours <= 16_800 ? weeklyHours : undefined;
  const annualPence = hundredths(answers.ukSkilledAnnualPayGbp);
  answers.ukSkilledCappedAnnualPayGbp = undefined;
  answers.ukSkilledPayAtStandardHoursGbp = undefined;
  answers.ukSkilledHourlyPayPence = undefined;

  if (answers.ukSkilledPayConfirmed === true && annualPence !== undefined && answers.ukSkilledWeeklyHours) {
    const annual = BigInt(annualPence);
    const hours = BigInt(answers.ukSkilledWeeklyHours);
    // Use integer minor units so one penny below a prorated threshold cannot pass.
    const standardPence = Number(annual * BigInt(3_750) / hours);
    const hourlyPence = Number(annual * BigInt(100) / (BigInt(52) * hours));
    answers.ukSkilledCappedAnnualPayGbp = Number(annual * (hours < BigInt(4_800) ? hours : BigInt(4_800)) / hours) / 100;
    if (Number.isSafeInteger(standardPence)) answers.ukSkilledPayAtStandardHoursGbp = standardPence / 100;
    if (Number.isSafeInteger(hourlyPence)) answers.ukSkilledHourlyPayPence = hourlyPence;
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
