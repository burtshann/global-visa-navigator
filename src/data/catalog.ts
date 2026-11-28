import type { Localized, Policy } from "@/domain/policy";
import { caFederalSkilledWorkerPolicy, caFswLaterStages } from "./ca-federal-skilled-worker";
import { deOpportunityCardPointsPolicy } from "./de-opportunity-card";
import type { Category, CountryId } from "./destinations";
import { deOpportunityCardPolicy, ukGraduatePolicy } from "./policies";
import { sgEmploymentPassPolicies } from "./sg-employment-pass";
import { ukSkilledWorkerPolicy } from "./uk-skilled-worker";

export { categoryLabels, countries } from "./destinations";
export type { Category, Country, CountryId } from "./destinations";

export type Route = Readonly<{
  id: string;
  countryId: CountryId;
  name: Localized;
  description: Localized;
  category: Category;
  officialUrl: string;
  policy?: Policy;
  policies?: readonly Policy[];
  scope?: Localized;
  policyTimeZone?: string;
  laterStages?: readonly Readonly<{ id: string; title: Localized; status: Localized; url: string }>[];
}>;

export const routes: readonly Route[] = [
  {
    id: "uk-graduate", countryId: "GB", category: "post-study",
    name: { en: "Graduate visa", zh: "Graduate 毕业生签证" },
    description: { en: "A route to stay in the UK after completing eligible studies.", zh: "适用于完成合规课程后希望留在英国的人士。" },
    officialUrl: "https://www.gov.uk/graduate-visa",
    scope: {
      en: "Checks two application conditions. Your Student permission, course eligibility and study duration still need review. The Home Office can contact your provider to confirm completion.",
      zh: "核对两项申请条件。仍需核对学生居留许可、课程资格及学习时长。英国内政部可联系教育机构确认课程完成情况。",
    },
    policy: ukGraduatePolicy,
  },
  {
    id: "de-opportunity-card", countryId: "DE", category: "job-search",
    name: { en: "Opportunity Card", zh: "机会卡" },
    description: { en: "A residence route for looking for qualified employment in Germany.", zh: "用于在德国寻找符合要求的工作岗位。" },
    officialUrl: "https://www.make-it-in-germany.com/en/visa-recognition/opportunity-card/job-search",
    scope: {
      en: "The initial card has a skilled-worker mechanism and a points mechanism. Applications within Germany, repeat applications and extensions have additional rules.",
      zh: "首次申请分为技术人才路径与积分路径。德国境内申请、再次申请和续期另有规则。",
    },
    policy: deOpportunityCardPolicy,
    policies: [deOpportunityCardPointsPolicy],
  },
  {
    id: "us-h1b", countryId: "US", category: "skilled-work",
    name: { en: "H-1B specialty occupations", zh: "H-1B 专业职业签证" },
    description: { en: "A temporary worker category for specialty occupations in the United States.", zh: "面向在美国从事专业职业的临时工作签证类别。" },
    officialUrl: "https://travel.state.gov/content/travel/en/us-visas/employment/temporary-worker-visas.html",
  },
  {
    id: "us-f1", countryId: "US", category: "study",
    name: { en: "F-1 Student visa", zh: "F-1 学生签证" },
    description: { en: "A route for academic study in the United States.", zh: "赴美国接受学术教育的签证路径。" },
    officialUrl: "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
  },
  {
    id: "ca-express-entry", countryId: "CA", category: "skilled-migration",
    name: { en: "Express Entry", zh: "快速通道" },
    description: { en: "Canada's application system for several economic immigration programs.", zh: "加拿大多个经济类移民项目的申请系统。" },
    officialUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html",
    policy: caFederalSkilledWorkerPolicy,
    policyTimeZone: "America/Toronto",
    laterStages: caFswLaterStages,
  },
  {
    id: "ca-pgwp", countryId: "CA", category: "post-study",
    name: { en: "Post-graduation work permit", zh: "毕业后工作许可" },
    description: { en: "A work permit route for graduates of eligible programs in Canada.", zh: "供在加拿大完成合规课程的毕业生了解的工作许可路径。" },
    officialUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation.html",
  },
  {
    id: "uk-skilled-worker", countryId: "GB", category: "skilled-work",
    name: { en: "Skilled Worker visa", zh: "Skilled Worker 技术工作签证" },
    description: { en: "A sponsored employment route for an eligible job in the UK.", zh: "面向在英国从事符合要求岗位的雇主担保工作路径。" },
    officialUrl: "https://www.gov.uk/skilled-worker-visa",
    policy: ukSkilledWorkerPolicy,
  },
  {
    id: "uk-student", countryId: "GB", category: "study",
    name: { en: "Student visa", zh: "Student 学生签证" },
    description: { en: "A route for studying with an eligible UK education provider.", zh: "面向赴英国合规教育机构学习的申请人。" },
    officialUrl: "https://www.gov.uk/student-visa",
  },
  {
    id: "de-blue-card", countryId: "DE", category: "skilled-work",
    name: { en: "EU Blue Card", zh: "欧盟蓝卡" },
    description: { en: "A residence route for qualified employment in Germany.", zh: "用于在德国从事符合条件工作的居留路径。" },
    officialUrl: "https://www.make-it-in-germany.com/en/visa-recognition/visa-types/eu-blue-card",
  },
  {
    id: "au-skilled-independent", countryId: "AU", category: "skilled-migration",
    name: { en: "Skilled Independent visa (189)", zh: "独立技术移民签证（189）" },
    description: { en: "A permanent skilled migration pathway in Australia.", zh: "澳大利亚永久技术移民路径之一。" },
    officialUrl: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189",
  },
  {
    id: "au-temporary-graduate", countryId: "AU", category: "post-study",
    name: { en: "Temporary Graduate visa (485)", zh: "临时毕业生签证（485）" },
    description: { en: "Australian temporary stay options for eligible graduates.", zh: "面向符合条件的毕业生的澳大利亚临时居留选项。" },
    officialUrl: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-graduate-485",
  },
  {
    id: "nz-skilled-migrant", countryId: "NZ", category: "skilled-migration",
    name: { en: "Skilled Migrant Category", zh: "技术移民类居民签证" },
    description: { en: "A New Zealand resident visa pathway based on skilled employment.", zh: "与技术就业相关的新西兰居民签证路径。" },
    officialUrl: "https://www.immigration.govt.nz/visas/skilled-migrant-category-resident-visa/",
  },
  {
    id: "nz-post-study", countryId: "NZ", category: "post-study",
    name: { en: "Post Study Work Visa", zh: "毕业后工作签证" },
    description: { en: "A work route after completing eligible study in New Zealand.", zh: "适用于完成新西兰合规学业之后的工作路径。" },
    officialUrl: "https://www.immigration.govt.nz/visas/post-study-work-visa/",
  },
  {
    id: "jp-highly-skilled", countryId: "JP", category: "skilled-work",
    name: { en: "Highly Skilled Professional visa", zh: "高度专门职签证" },
    description: { en: "A Japanese visa category for highly skilled professional activities.", zh: "适用于在日本开展高度专业活动的签证类别。" },
    officialUrl: "https://www.mofa.go.jp/j_info/visit/visa/long/visa16.html",
  },
  {
    id: "jp-student", countryId: "JP", category: "study",
    name: { en: "Student visa", zh: "留学签证" },
    description: { en: "Japan's visa category for enrolled students.", zh: "面向在日本就读学生的签证类别。" },
    officialUrl: "https://www.mofa.go.jp/j_info/visit/visa/long/visa6.html",
  },
  {
    id: "kr-job-seeker", countryId: "KR", category: "job-search",
    name: { en: "D-10-1 Job Seeker visa", zh: "D-10-1 求职签证" },
    description: { en: "A Korean job-seeking visa. Check the consular office for your application location.", zh: "韩国求职签证。请向受理你申请的领事机构核对要求。" },
    officialUrl: "https://overseas.mofa.go.kr/us-chicago-en/brd/m_26753/view.do?seq=26",
  },
  {
    id: "kr-student", countryId: "KR", category: "study",
    name: { en: "D-2 Student visa", zh: "D-2 学生签证" },
    description: { en: "A route for higher education in South Korea. Check your local consular requirements.", zh: "赴韩国接受高等教育的签证路径。请核对适用的领事要求。" },
    officialUrl: "https://www.mofa.go.kr/us-seattle-en/brd/m_23042/view.do?seq=45",
  },
  {
    id: "sg-employment-pass", countryId: "SG", category: "skilled-work",
    policyTimeZone: "Asia/Singapore",
    name: { en: "Employment Pass", zh: "就业准证（EP）" },
    description: { en: "Singapore's work pass for foreign professionals, managers and executives.", zh: "新加坡面向外籍专业人员、管理人员及高管的工作准证。" },
    officialUrl: "https://www.mom.gov.sg/passes-and-permits/employment-pass",
    policies: sgEmploymentPassPolicies,
  },
  {
    id: "sg-student", countryId: "SG", category: "study",
    name: { en: "Student’s Pass", zh: "学生准证" },
    description: { en: "Singapore's pass for eligible full-time study.", zh: "适用于在新加坡全日制就读的合规学生。" },
    officialUrl: "https://www.ica.gov.sg/information-and-e-services/long-term-visit-and-study/student-s-pass/student%27s-pass-application-renewal",
  },
];
