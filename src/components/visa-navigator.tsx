"use client";

import { useState, type FormEvent } from "react";
import { categoryLabels, countries, routes, type Category, type Country, type Route } from "../data/catalog";
import {
  evaluatePolicy,
  type Condition,
  type Evaluation,
  type Localized,
  type Policy,
  type Profile,
} from "../domain/policy";
import { copy, educationOptions, specificQuestions } from "./navigator-copy";
import type { NationalityOptionsByLanguage } from "./nationality-options";

type Language = keyof Localized;
type MatchRun = { profile: Profile; asOf: string };

const evaluationLabels: Record<Evaluation["status"], Localized> = {
  "conditions-met": { en: "All checked conditions met", zh: "符合本次核对的所有条件" },
  "conditions-not-met": { en: "A checked condition is unmet", zh: "至少一项已核对条件未满足" },
  "profile-incomplete": { en: "More answers needed", zh: "需要补充答案" },
  "rules-not-covered": { en: "Rule checks unavailable", zh: "暂无规则核对结果" },
};

const checkLabels: Record<Evaluation["checks"][number]["status"], Localized> = {
  pass: { en: "Met", zh: "已满足" },
  fail: { en: "Unmet", zh: "未满足" },
  unknown: { en: "Unanswered", zh: "待确认" },
};

const stageLabels: Record<Policy["stage"], Localized> = {
  application: { en: "Application conditions", zh: "申请条件" },
  invitation: { en: "Invitation conditions", zh: "获邀条件" },
  approval: { en: "Final approval conditions", zh: "最终审批条件" },
};

const priority: Record<Evaluation["status"], number> = {
  "conditions-met": 0,
  "profile-incomplete": 1,
  "conditions-not-met": 2,
  "rules-not-covered": 3,
};

const categories = Object.entries(categoryLabels) as [Category, Localized][];
const ruleRoutes = routes.filter((route) => route.policy !== undefined);
const countriesById = new Map<string, Country>(countries.map((country) => [country.id, country]));
const routesById = new Map<string, Route>(routes.map((route) => [route.id, route]));
function readField(form: HTMLFormElement, id: string) {
  // Use IDs so a native form submission cannot send personal values.
  const field = form.elements.namedItem(id);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    return field.value.trim() || undefined;
  }
  return undefined;
}

function readNumber(form: HTMLFormElement, id: string) {
  const value = readField(form, id);
  return value === undefined ? undefined : Number(value);
}

function readBoolean(value: string | undefined) {
  return value === undefined ? undefined : value === "yes";
}

function getAnswerName(condition: Condition) {
  return condition.input.startsWith("answer:") ? condition.input.slice(7) : undefined;
}

function readProfile(form: HTMLFormElement): Profile {
  const answers: Record<string, boolean | number | string | undefined> = {};
  for (const route of ruleRoutes) {
    for (const condition of route.policy?.conditions ?? []) {
      const name = getAnswerName(condition);
      if (!name) continue;
      const id = `question-${route.id}-${name}`;
      const value = readField(form, id);
      if (value === undefined) continue;
      if (typeof condition.expected === "boolean") {
        answers[name] = readBoolean(value);
      } else if (typeof condition.expected === "number") {
        answers[name] = Number(value);
      } else {
        answers[name] = value;
      }
    }
  }
  return {
    nationality: readField(form, "profile-nationality"),
    age: readNumber(form, "profile-age"),
    education: readField(form, "profile-education"),
    occupation: readField(form, "profile-occupation"),
    experienceYears: readNumber(form, "profile-experience"),
    language: readField(form, "profile-language"),
    budgetUsd: readNumber(form, "profile-budget"),
    jobOffer: readBoolean(readField(form, "profile-offer")),
    goal: readField(form, "profile-goal"),
    answers,
  };
}

function OfficialLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {label} <span aria-hidden="true">↗</span>
    </a>
  );
}

function Status({ route, evaluation, language }: { route: Route; evaluation?: Evaluation; language: Language }) {
  const kind = evaluation?.status ?? (route.policy ? "sample" : "rules-not-covered");
  const label = evaluation
    ? evaluationLabels[evaluation.status][language]
    : route.policy
      ? copy.ruleSample[language]
      : copy.browseOnly[language];
  return <span className={`status status--${kind}`}>{label}</span>;
}

function RuleDetails({ route, evaluation, language }: {
  route: Route;
  evaluation?: Evaluation;
  language: Language;
}) {
  const policy = route.policy;
  if (!policy || evaluation?.status === "rules-not-covered") {
    return (
      <p className="route-scope">
        {(policy ? copy.policyUnavailable : copy.browseOnlyText)[language]}
      </p>
    );
  }
  const checkStatus = new Map(evaluation?.checks.map(({ condition, status }) => [condition.id, status]));
  return (
    <>
      {route.scope && (
        <p className="route-scope"><strong>{copy.scope[language]}</strong> {route.scope[language]}</p>
      )}
      <details className="rules" open={evaluation !== undefined}>
        <summary>{copy.checks[language]}</summary>
        <p className="policy-meta">
          {stageLabels[policy.stage][language]} <span aria-hidden="true">·</span>{" "}
          {copy.version[language]} {policy.version}
        </p>
        <ul className="conditions">
          {policy.conditions.map((condition) => {
            const status = checkStatus.get(condition.id);
            const source = condition.source;
            return (
              <li key={condition.id} className="condition">
                <div className="condition-heading">
                  <strong>{condition.label[language]}</strong>
                  {status && (
                    <span className={`check check--${status}`}>{checkLabels[status][language]}</span>
                  )}
                </div>
                {status && status !== "pass" && (
                  <p><strong>{copy.nextStep[language]}</strong> {condition.nextStep[language]}</p>
                )}
                <details className="condition-source">
                  <summary>{copy.sourceDetails[language]}</summary>
                  <dl>
                    <dt>{copy.applicability[language]}</dt><dd>{source.applicableWhen[language]}</dd>
                    <dt>{copy.effective[language]}</dt>
                    <dd>{source.effectiveFrom ?? copy.effectiveUnknown[language]}</dd>
                    {source.effectiveUntil && (
                      <><dt>{copy.effectiveUntil[language]}</dt><dd>{source.effectiveUntil}</dd></>
                    )}
                    <dt>{copy.verifiedAt[language]}</dt><dd>{source.lastVerifiedAt ?? copy.unavailable[language]}</dd>
                    <dt>{copy.reviewState[language]}</dt><dd>{copy[source.reviewStatus][language]}</dd>
                  </dl>
                  <OfficialLink className="text-link" href={source.url} label={copy.openOfficialSource[language]} />
                </details>
              </li>
            );
          })}
        </ul>
      </details>
    </>
  );
}

function BooleanInput({ id, language }: { id: string; language: Language }) {
  return (
    <select id={id}>
      <option value="">{copy.unfinished[language]}</option>
      <option value="yes">{copy.yes[language]}</option>
      <option value="no">{copy.no[language]}</option>
    </select>
  );
}

function RuleQuestions({ language }: { language: Language }) {
  return (
    <details className="rule-questions" open>
      <summary>{copy.pathwayQuestions[language]}</summary>
      <p>{copy.pathwayQuestionsIntro[language]}</p>
      <div className="rule-question-groups">
        {ruleRoutes.map((route) => (
          <fieldset key={route.id}>
            <legend>{route.name[language]}</legend>
            {route.policy?.conditions.map((condition) => {
              const name = getAnswerName(condition);
              if (!name) return null;
              const id = `question-${route.id}-${name}`;
              return (
                <label key={condition.id} htmlFor={id} className="field">
                  <span>{(specificQuestions[name] ?? condition.label)[language]}</span>
                  {typeof condition.expected === "boolean" ? (
                    <BooleanInput id={id} language={language} />
                  ) : (
                    <input id={id} type={typeof condition.expected === "number" ? "number" : "text"} maxLength={80} />
                  )}
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
    </details>
  );
}

export function VisaNavigator({ nationalityOptionsByLanguage }: { nationalityOptionsByLanguage: NationalityOptionsByLanguage }) {
  const [language, setLanguage] = useState<Language>("zh");
  const [countryFilter, setCountryFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [matchRun, setMatchRun] = useState<MatchRun | null>(null);
  const [formMessage, setFormMessage] = useState<"checked" | "cleared" | null>(null);
  const [comparison, setComparison] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const evaluations = new Map<string, Evaluation>();
  if (matchRun) {
    for (const route of routes) {
      evaluations.set(route.id, evaluatePolicy(route.policy, matchRun.profile, matchRun.asOf));
    }
  }
  const visibleRoutes = routes.filter((route) =>
    (countryFilter === "all" || route.countryId === countryFilter) &&
    (categoryFilter === "all" || route.category === categoryFilter),
  );
  if (matchRun) {
    visibleRoutes.sort((first, second) => {
      const firstStatus = evaluations.get(first.id)?.status ?? "rules-not-covered";
      const secondStatus = evaluations.get(second.id)?.status ?? "rules-not-covered";
      return priority[firstStatus] - priority[secondStatus];
    });
  }

  const t = (key: keyof typeof copy) => copy[key][language];

  function updateLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage === "zh" ? "zh-Hans" : "en";
  }

  function checkProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = readProfile(event.currentTarget);
    const asOf = new Date().toISOString().slice(0, 10);
    setMatchRun({ profile, asOf });
    if (profile.goal) setCategoryFilter(profile.goal as Category);
    setFormMessage("checked");
    window.location.hash = "pathways";
    document.getElementById("pathways-title")?.focus({ preventScroll: true });
  }

  function clearProfile() {
    setMatchRun(null);
    setFormMessage("cleared");
  }

  function selectCountry(countryId: string) {
    setCountryFilter(countryId);
    setCategoryFilter("all");
  }

  function toggleComparison(routeId: string) {
    setComparison((selected) => (
      selected.includes(routeId)
        ? selected.filter((id) => id !== routeId)
        : selected.length < 3 ? [...selected, routeId] : selected
    ));
  }

  function resetFilters() {
    setCountryFilter("all");
    setCategoryFilter("all");
  }

  return (
    <>
      <a className="skip-link" href="#main">{t("skip")}</a>
      <header className="site-header" id="top">
        <div className="container header-inner">
          <a className="brand" href="#top">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            {t("brand")}
          </a>
          <nav className="primary-nav" aria-label={language === "zh" ? "主要导航" : "Main navigation"}>
            <a href="#destinations">{t("destinations")}</a>
            <a href="#pathways">{t("routes")}</a>
            <a href="#match">{t("match")}</a>
          </nav>
          <div className="language-control" role="group" aria-label={t("languageControl")}>
            <button type="button" lang="zh-Hans" aria-label="简体中文" aria-pressed={language === "zh"} onClick={() => updateLanguage("zh")}>中文</button>
            <button type="button" lang="en" aria-label="English" aria-pressed={language === "en"} onClick={() => updateLanguage("en")}>EN</button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero-content">
            <h1 id="hero-title">{t("heroLead")}<br /><span>{t("heroAccent")}</span></h1>
            <p>{t("heroText")}</p>
            <div className="hero-actions">
              <a className="button button--primary" href="#match">{t("match")} <span aria-hidden="true">→</span></a>
              <a className="button button--glass" href="#destinations">{t("browse")}</a>
            </div>
          </div>
        </section>

        <section id="destinations" className="section destinations" aria-labelledby="destinations-title">
          <div className="container">
            <div className="section-heading">
              <h2 id="destinations-title">{t("directoryTitle")}</h2>
              <p>{t("directoryIntro")}</p>
            </div>
            <ul className="country-grid">
              {countries.map((country) => {
                const count = routes.filter((route) => route.countryId === country.id).length;
                const countLabel = language === "en" ? `${count} ${t(count === 1 ? "pathway" : "pathways")}` : `${count} ${t("pathways")}`;
                return (
                  <li className="country-card" key={country.id}>
                    <a className="country-entry" href="#pathways" onClick={() => selectCountry(country.id)}>
                      <span className="country-flag" aria-hidden="true">{country.flag}</span>
                      <span className="country-info">
                        <strong>{country.name[language]}</strong>
                        <span>{country.region[language]} <span aria-hidden="true">·</span> {countLabel}</span>
                      </span>
                      <span className="country-arrow" aria-hidden="true">→</span>
                    </a>
                    <OfficialLink className="country-official" href={country.officialUrl} label={t("officialSite")} />
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="match" className="section match" aria-labelledby="match-title">
          <div className="container">
            <div className="section-heading">
              <h2 id="match-title">{t("matchTitle")}</h2>
              <p>{t("matchIntro")}</p>
            </div>
            <form className="profile-form" onSubmit={checkProfile} onReset={clearProfile} autoComplete="off" aria-describedby="privacy-note">
              <p id="privacy-note" className="privacy-note">{t("privacy")}</p>
              <div className="profile-grid">
                <label className="field" htmlFor="profile-nationality">
                  <span>{t("nationality")}</span>
                  <select id="profile-nationality">
                    <option value="">{t("select")}</option>
                    {nationalityOptionsByLanguage[language].map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </label>
                <label className="field" htmlFor="profile-age">
                  <span>{t("age")}</span>
                  <input id="profile-age" type="number" min="0" max="120" step="1" autoComplete="off" />
                </label>
                <label className="field" htmlFor="profile-education">
                  <span>{t("education")}</span>
                  <select id="profile-education">
                    <option value="">{t("select")}</option>
                    {Object.entries(educationOptions).map(([value, label]) => <option key={value} value={value}>{label[language]}</option>)}
                  </select>
                </label>
                <label className="field" htmlFor="profile-occupation">
                  <span>{t("occupation")}</span>
                  <input id="profile-occupation" placeholder={t("occupationExample")} maxLength={80} autoComplete="off" />
                </label>
                <label className="field" htmlFor="profile-experience">
                  <span>{t("experience")}</span>
                  <input id="profile-experience" type="number" min="0" max="100" step="any" autoComplete="off" />
                </label>
                <label className="field" htmlFor="profile-language">
                  <span>{t("language")}</span>
                  <input id="profile-language" placeholder={t("languageExample")} maxLength={80} autoComplete="off" />
                </label>
                <label className="field" htmlFor="profile-budget">
                  <span>{t("budget")}</span>
                  <input id="profile-budget" type="number" min="0" step="0.01" autoComplete="off" />
                </label>
                <label className="field" htmlFor="profile-offer">
                  <span>{t("jobOffer")}</span>
                  <BooleanInput id="profile-offer" language={language} />
                </label>
                <label className="field" htmlFor="profile-goal">
                  <span>{t("goal")}</span>
                  <select id="profile-goal">
                    <option value="">{t("select")}</option>
                    {categories.map(([category, label]) => <option key={category} value={category}>{label[language]}</option>)}
                  </select>
                </label>
              </div>
              <RuleQuestions language={language} />
              <div className="form-actions">
                <button className="button button--primary" type="submit">{t("check")} <span aria-hidden="true">→</span></button>
                <button className="button button--outline" type="reset">{t("clear")}</button>
                <span className="form-message" role="status">{formMessage && t(formMessage)}</span>
              </div>
            </form>
          </div>
        </section>

        <section id="pathways" className="section catalog" aria-labelledby="pathways-title">
          <div className="container">
            <div className="section-heading">
              <h2 id="pathways-title" tabIndex={-1}>{t("routesTitle")}</h2>
              <p>{t("routesIntro")}</p>
            </div>
            <p className="stage-note">{t("stageNote")}</p>
            <div className="filters">
              <label className="field" htmlFor="filter-country">
                <span>{t("destinationFilter")}</span>
                <select id="filter-country" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
                  <option value="all">{t("allDestinations")}</option>
                  {countries.map((country) => <option key={country.id} value={country.id}>{country.name[language]}</option>)}
                </select>
              </label>
              <label className="field" htmlFor="filter-category">
                <span>{t("categoryFilter")}</span>
                <select id="filter-category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as Category | "all")}>
                  <option value="all">{t("allCategories")}</option>
                  {categories.map(([category, label]) => <option key={category} value={category}>{label[language]}</option>)}
                </select>
              </label>
              {(countryFilter !== "all" || categoryFilter !== "all") && (
                <button className="text-button reset-filters" type="button" onClick={resetFilters}>{t("resetFilters")}</button>
              )}
            </div>
            <div className="catalog-summary">
              <p aria-live="polite">
                {visibleRoutes.length} {t(visibleRoutes.length === 1 ? "pathway" : "pathways")}
                {matchRun && <span> <span aria-hidden="true">·</span> {t("assessmentDate")} {matchRun.asOf}</span>}
              </p>
              {comparison.length > 0 && (
                <button type="button" className="button button--outline comparison-toggle" aria-expanded={showComparison} aria-controls="route-comparison" onClick={() => setShowComparison(!showComparison)}>
                  {t(showComparison ? "hideCompare" : "showCompare")} ({comparison.length}/3)
                </button>
              )}
            </div>
            <section id="route-comparison" className="comparison" hidden={!showComparison || comparison.length === 0} aria-labelledby="comparison-title">
              <div className="comparison-heading">
                <h3 id="comparison-title">{t("comparison")}</h3>
                <button className="text-button" type="button" onClick={() => { setComparison([]); setShowComparison(false); }}>{t("clearCompare")}</button>
              </div>
              <ul className="comparison-grid">
                {comparison.map((id) => {
                  const route = routesById.get(id);
                  if (!route) return null;
                  const evaluation = evaluations.get(id);
                  return (
                    <li key={id} className="comparison-card">
                      <div className="route-context">
                        {countriesById.get(route.countryId)?.name[language]} <span aria-hidden="true">·</span> {categoryLabels[route.category][language]}
                      </div>
                      <h4>{route.name[language]}</h4>
                      <Status route={route} evaluation={evaluation} language={language} />
                      <p>{route.scope?.[language] ?? route.description[language]}</p>
                      <div className="comparison-actions">
                        <OfficialLink className="text-link" href={route.officialUrl} label={t("officialDetails")} />
                        <button type="button" className="text-button" onClick={() => toggleComparison(id)} aria-label={`${t("remove")} · ${route.name[language]}`}>{t("remove")}</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
            {comparison.length === 3 && <p className="compare-limit" role="status">{t("compareLimit")}</p>}
            {visibleRoutes.length === 0 && <p className="empty-state">{t("noRoutes")}</p>}
            <ul className="route-grid">
              {visibleRoutes.map((route) => {
                const country = countriesById.get(route.countryId);
                const evaluation = evaluations.get(route.id);
                const selected = comparison.includes(route.id);
                return (
                  <li className="route-card" key={route.id}>
                    <p className="route-context"><span aria-hidden="true">{country?.flag}</span> {country?.name[language]} <span aria-hidden="true">·</span> {categoryLabels[route.category][language]}</p>
                    <h3>{route.name[language]}</h3>
                    <p className="route-description">{route.description[language]}</p>
                    <Status route={route} evaluation={evaluation} language={language} />
                    <RuleDetails route={route} evaluation={evaluation} language={language} />
                    <div className="route-actions">
                      <OfficialLink className="text-link" href={route.officialUrl} label={t("officialDetails")} />
                      <button className="button button--outline button--compact" type="button" aria-pressed={selected} aria-label={`${t("compare")} · ${route.name[language]}`} disabled={!selected && comparison.length === 3} onClick={() => toggleComparison(route.id)}>
                        <span aria-hidden="true">{selected ? "✓" : "+"}</span> {t(selected ? "selected" : "compare")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <a className="brand" href="#top"><span className="brand-mark" aria-hidden="true"><span /></span>{t("brand")}</a>
          <a className="back-to-top" href="#top">{t("backToTop")} <span aria-hidden="true">↑</span></a>
        </div>
      </footer>
    </>
  );
}
