import { loadAssessment } from "../../../server/assessment";

export const dynamic = "force-dynamic";

export async function GET() {
  const assessment = await loadAssessment();
  return Response.json(assessment, {
    status: assessment.availability === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
