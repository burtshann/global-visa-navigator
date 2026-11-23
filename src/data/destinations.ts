import type { Localized } from "@/domain/policy";

export const categoryLabels = {
  "skilled-work": { en: "Skilled work", zh: "技术工作" },
  "job-search": { en: "Job search", zh: "求职" },
  "skilled-migration": { en: "Skilled migration", zh: "技术移民" },
  study: { en: "Study", zh: "留学" },
  "post-study": { en: "Post-study work", zh: "留学后工作" },
} satisfies Record<string, Localized>;

export type Category = keyof typeof categoryLabels;
export type CountryId = "US" | "CA" | "GB" | "DE" | "AU" | "NZ" | "JP" | "KR" | "SG";

export type Country = Readonly<{
  id: CountryId;
  name: Localized;
  region: Localized;
  flag: string;
  officialUrl: string;
}>;

const northAmerica = { en: "North America", zh: "北美洲" };
const europe = { en: "Europe", zh: "欧洲" };
const oceania = { en: "Oceania", zh: "大洋洲" };
const asia = { en: "Asia", zh: "亚洲" };

export const countries: readonly Country[] = [
  {
    id: "US", name: { en: "United States", zh: "美国" }, region: northAmerica, flag: "🇺🇸",
    officialUrl: "https://travel.state.gov/content/travel/en/us-visas.html",
  },
  {
    id: "CA", name: { en: "Canada", zh: "加拿大" }, region: northAmerica, flag: "🇨🇦",
    officialUrl: "https://www.canada.ca/en/services/immigration-citizenship.html",
  },
  {
    id: "GB", name: { en: "United Kingdom", zh: "英国" }, region: europe, flag: "🇬🇧",
    officialUrl: "https://www.gov.uk/browse/visas-immigration",
  },
  {
    id: "DE", name: { en: "Germany", zh: "德国" }, region: europe, flag: "🇩🇪",
    officialUrl: "https://www.make-it-in-germany.com/en/visa-recognition",
  },
  {
    id: "AU", name: { en: "Australia", zh: "澳大利亚" }, region: oceania, flag: "🇦🇺",
    officialUrl: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing",
  },
  {
    id: "NZ", name: { en: "New Zealand", zh: "新西兰" }, region: oceania, flag: "🇳🇿",
    officialUrl: "https://www.immigration.govt.nz/visas/",
  },
  {
    id: "JP", name: { en: "Japan", zh: "日本" }, region: asia, flag: "🇯🇵",
    officialUrl: "https://www.mofa.go.jp/j_info/visit/visa/index.html",
  },
  {
    id: "KR", name: { en: "South Korea", zh: "韩国" }, region: asia, flag: "🇰🇷",
    officialUrl: "https://www.visa.go.kr/openPage.do?MENU_ID=10101",
  },
  {
    id: "SG", name: { en: "Singapore", zh: "新加坡" }, region: asia, flag: "🇸🇬",
    officialUrl: "https://www.mom.gov.sg/passes-and-permits",
  },
];
