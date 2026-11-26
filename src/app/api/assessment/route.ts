import { loadAssessment } from "../../../server/assessment";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await loadAssessment(), {
    headers: { "Cache-Control": "no-store" },
  });
}
