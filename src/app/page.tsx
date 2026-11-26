import { connection } from "next/server";
import { VisaNavigator } from "../components/visa-navigator";
import { routes } from "../data/catalog";
import { loadAssessment } from "../server/assessment";

export default async function Home() {
  await connection();
  const directory = routes.map((route) => ({ ...route, policy: undefined, policies: undefined }));
  return <VisaNavigator directory={directory} initialAssessment={await loadAssessment()} />;
}
