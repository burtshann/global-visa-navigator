export function assessmentDate(instant: Date, timeZone = "UTC"): string {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const date = new Map(values.map(({ type, value }) => [type, value]));
  return `${date.get("year")}-${date.get("month")}-${date.get("day")}`;
}
