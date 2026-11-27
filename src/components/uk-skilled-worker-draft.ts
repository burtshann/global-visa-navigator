import type { Assessment } from "../server/assessment";
import type { ProfileDraft } from "./profile-questions";

const sponsorConfirmations = [
  "answer:ukSkilledJobCos",
  "answer:ukSkilledSponsorRated",
  "answer:ukSkilledCosIssueInWindow",
  "answer:ukSkilledCosStartInWindow",
  "answer:ukSkilledCosUsable",
  "answer:ukSkilledAtasBasis",
  "answer:ukSkilledStandardOption",
  "answer:ukSkilledPayConfirmed",
];

const applicationInputs = new Set([
  "answer:ukSkilledWorkerInitial",
  "answer:ukSkilledApplyingFromAbroad",
  "answer:ukSkilledCurrentPermission",
  "answer:ukSkilledSocCode",
  "answer:ukSkilledWeeklyHours",
  "answer:ukSkilledAnnualPayGbp",
]);

const replacementInputs = new Set([
  "answer:ukSkilledJobCos",
  "answer:ukSkilledSponsorRated",
  "answer:ukSkilledCosUsable",
]);

const studentBasis = "answer:ukSkilledStudentSwitchBasis";

export function clearUkSponsorConfirmations(draft: ProfileDraft): ProfileDraft {
  const updated = { ...draft };
  for (const input of sponsorConfirmations) delete updated[input];
  // The degree/PhD start-date answers depend on the current CoS.
  if (updated[studentBasis] !== "completed") delete updated[studentBasis];
  return updated;
}

export function updateProfileDraft(draft: ProfileDraft, input: string, value: string): ProfileDraft {
  const previous = draft[input] ?? "";
  if (value === previous) return draft;

  const changedContext = applicationInputs.has(input) || (replacementInputs.has(input) && previous !== "");
  const updated = { ...(changedContext ? clearUkSponsorConfirmations(draft) : draft), [input]: value };
  if (input === "answer:ukSkilledStandardOption") delete updated["answer:ukSkilledPayConfirmed"];
  if (input === "answer:ukSkilledApplyingFromAbroad" || input === "answer:ukSkilledWorkerInitial") {
    delete updated["answer:ukSkilledUsingAfghanNationality"];
    delete updated["answer:ukSkilledCurrentPermission"];
    delete updated["answer:ukSkilledSwitchStatus"];
    delete updated[studentBasis];
  }
  if (input === "answer:ukSkilledCurrentPermission") {
    delete updated["answer:ukSkilledSwitchStatus"];
    delete updated[studentBasis];
  }
  return updated;
}

export function ukAssessmentContext(assessment: Assessment) {
  const route = "uk-skilled-worker";
  return {
    date: assessment.localDates[route] ?? assessment.asOf,
    version: assessment.policies[route]?.policy?.version,
  };
}
