import { nationalityOptionsByLanguage } from "../components/nationality-options";
import { VisaNavigator } from "../components/visa-navigator";

export default function Home() {
  return <VisaNavigator nationalityOptionsByLanguage={nationalityOptionsByLanguage} />;
}
