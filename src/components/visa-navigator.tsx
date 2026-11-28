"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Route } from "../data/catalog";
import { categoryLabels, countries, type Category, type Country } from "../data/destinations";
import { evaluatePathway, type Evaluation, type Policy, type Profile } from "../domain/policy";
import { prepareMatchingProfile } from "../data/matching-profile";
import type { Assessment } from "../server/assessment";
import { copy } from "./navigator-copy";
import { OfficialLink, PolicyDetails, PolicyStatus, routePolicies, type Language } from "./policy-result";
import { getRuleQuestionGroups, readProfile, RuleQuestions, type ProfileDraft } from "./profile-questions";

type CheckedPolicy = ReturnType<typeof evaluatePathway> & { policy: Policy };

const priority: Record<Evaluation["status"], number> = {
  "conditions-met": 0,
  "profile-incomplete": 1,
  "conditions-not-met": 2,
  "conditions-not-applicable": 3,
  "rules-not-covered": 4,
};

const categories = Object.entries(categoryLabels) as [Category, { en: string; zh: string }][];
const countriesById = new Map<string, Country>(countries.map((country) => [country.id, country]));

function routePriority(policies: readonly CheckedPolicy[]) {
  return Math.min(...policies.map(({ outcome }) => priority[outcome.status]));
}

function assessmentRoutes(directory: readonly Route[], assessment: Assessment) {
  return directory.map((route) => ({ ...route, ...assessment.policies[route.id] }));
}

function LaterStages({ route, language }: { route: Route; language: Language }) {
  if (!route.laterStages?.length) return null;
  return (
    <dl className="match-statuses">
      {route.laterStages.map(({ id, title, status, url }) => (
        <div key={id}>
          <dt><OfficialLink className="text-link" href={url} label={title[language]} /></dt>
          <dd>{status[language]}</dd>
        </div>
      ))}
    </dl>
  );
}

function MatchCard({ route, policies, language, localDate }: {
  route: Route;
  policies: readonly CheckedPolicy[];
  language: Language;
  localDate?: string;
}) {
  const country = countriesById.get(route.countryId);
  const relevance = policies[0]?.relevance;
  const t = (key: keyof typeof copy) => copy[key][language];

  return (
    <li className="route-card match-card" data-route-id={route.id}>
      <p className="route-context"><span aria-hidden="true">{country?.flag}</span> {country?.name[language]} <span aria-hidden="true">·</span> {categoryLabels[route.category][language]}</p>
      <h3>{route.name[language]}</h3>
      {localDate && <p className="policy-meta">{t("localAssessmentDate")} <time dateTime={localDate}>{localDate}</time> ({route.policyTimeZone})</p>}
      <dl className="match-statuses">
        <div>
          <dt>{t("alignment")}</dt>
          <dd>{t(relevance === "aligned" ? "goalAligned" : relevance === "different-goal" ? "differentGoal" : "goalUnknown")}</dd>
        </div>
        <div><dt>{t("fullEligibility")}</dt><dd>{t("fullEligibilityUnverified")}</dd></div>
      </dl>
      {policies.map(({ policy, outcome }) => (
        <div className="match-mechanism" key={policy.id} data-policy-id={policy.id}>
          {policy.name && <h4>{policy.name[language]}</h4>}
          <p className="match-outcome"><strong>{t("checkedOutcome")}</strong> <PolicyStatus language={language} evaluation={outcome} /></p>
          {(policy.scope ?? route.scope) && <p className="route-scope"><strong>{t("scope")}</strong> {(policy.scope ?? route.scope)?.[language]}</p>}
          <PolicyDetails language={language} policy={policy} evaluation={outcome} />
        </div>
      ))}
      <LaterStages route={route} language={language} />
      <OfficialLink className="text-link" href={route.officialUrl} label={t("officialDetails")} />
    </li>
  );
}

export function VisaNavigator({ directory, initialAssessment }: {
  directory: readonly Route[];
  initialAssessment: Assessment;
}) {
  const [language, setLanguage] = useState<Language>("zh");
  const [countryFilter, setCountryFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [assessment, setAssessment] = useState(initialAssessment);
  const [draft, setDraft] = useState<ProfileDraft>({});
  const [checkedProfile, setCheckedProfile] = useState<Profile | null>(null);
  const [formMessage, setFormMessage] = useState<"checking" | "checked" | "cleared" | "checkFailed" | null>(
    initialAssessment.availability === "unavailable" ? "checkFailed" : null,
  );
  const [comparison, setComparison] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const resultsTitle = useRef<HTMLHeadingElement>(null);
  const assessmentRequest = useRef<AbortController | null>(null);
  const { asOf, localDates } = assessment;
  const lastAvailableRoutes = assessmentRoutes(directory, assessment);
  const routes = assessment.availability === "unavailable" ? directory : lastAvailableRoutes;
  const routesById = new Map(routes.map((route) => [route.id, route]));
  const questions = getRuleQuestionGroups(lastAvailableRoutes);
  const matchedRoutes = checkedProfile && assessment.availability === "available" ? routes.flatMap((route) => {
    const policies = routePolicies(route)
      .map((policy) => ({ policy, ...evaluatePathway(policy, checkedProfile, localDates[route.id] ?? asOf, [route.category]) }))
      .filter(({ relevance, coverage }) => relevance !== "different-goal" && coverage === "checked-conditions")
      .sort((first, second) => priority[first.outcome.status] - priority[second.outcome.status]);
    return policies.length > 0 ? [{ route, policies }] : [];
  }).sort((first, second) => routePriority(first.policies) - routePriority(second.policies)) : [];
  const matchesById = new Map(matchedRoutes.map(({ route, policies }) => [route.id, policies]));
  const visibleRoutes = routes.filter((route) =>
    (countryFilter === "all" || route.countryId === countryFilter) &&
    (categoryFilter === "all" || route.category === categoryFilter),
  );

  useEffect(() => {
    if (!checkedProfile) return;
    resultsTitle.current?.focus({ preventScroll: true });
    resultsTitle.current?.scrollIntoView({ block: "start" });
  }, [checkedProfile]);

  const t = (key: keyof typeof copy) => copy[key][language];

  function updateLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage === "zh" ? "zh-Hans" : "en";
  }

  function updateDraft(input: string, value: string) {
    setDraft((previous) => ({ ...previous, [input]: value }));
  }

  async function checkProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    assessmentRequest.current?.abort();
    const request = new AbortController();
    assessmentRequest.current = request;
    setCheckedProfile(null);
    setFormMessage("checking");
    try {
      const response = await fetch("/api/assessment", { cache: "no-store", signal: request.signal });
      if (!response.ok) throw new Error("Policy refresh failed.");
      const current: Assessment = await response.json();
      if (request.signal.aborted) return;
      if (current.availability !== "available") throw new Error("Policy refresh failed.");
      const currentQuestions = getRuleQuestionGroups(assessmentRoutes(directory, current));
      setAssessment(current);
      setCheckedProfile(prepareMatchingProfile(readProfile(draft, currentQuestions)));
      setFormMessage("checked");
    } catch {
      if (!request.signal.aborted) {
        // Keep the question definitions for the draft without showing old rules in the directory.
        setAssessment((previous) => ({ ...previous, availability: "unavailable" }));
        setFormMessage("checkFailed");
      }
    } finally {
      if (assessmentRequest.current === request) assessmentRequest.current = null;
    }
  }

  function clearProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    assessmentRequest.current?.abort();
    setDraft({});
    setCheckedProfile(null);
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
              <label className="field goal-field" htmlFor="profile-goal">
                <span>{t("goal")}</span>
                <select id="profile-goal" value={draft.goal ?? ""} onChange={(event) => updateDraft("goal", event.target.value)}>
                  <option value="">{t("select")}</option>
                  {categories.map(([category, label]) => <option key={category} value={category}>{label[language]}</option>)}
                </select>
              </label>
              <RuleQuestions groups={questions} language={language} draft={draft} onChange={updateDraft} />
              <div className="form-actions">
                <button className="button button--primary" type="submit" disabled={formMessage === "checking"}>{t("check")} <span aria-hidden="true">→</span></button>
                <button className="button button--outline" type="reset">{t("clear")}</button>
                <span className="form-message" role="status">{formMessage && t(formMessage)}</span>
              </div>
            </form>
          </div>
        </section>

        {checkedProfile && (
          <section id="personal-results" className="section personal-results" aria-labelledby="personal-results-title">
            <div className="container">
              <div className="section-heading">
                <h2 id="personal-results-title" ref={resultsTitle} tabIndex={-1}>{t("personalResults")}</h2>
                <p>{t("personalResultsIntro")}</p>
              </div>
              <p className="policy-meta match-date">
                {t("assessmentDate")} <time dateTime={asOf}>{asOf}</time>
              </p>
              {matchedRoutes.length === 0 ? (
                <div className="empty-state">
                  <p>{t(checkedProfile.goal ? "personalEmpty" : "personalEmptyNoGoal")}</p>
                  <a className="text-link" href="#pathways">{t("goToDirectory")}</a>
                </div>
              ) : (
                <ul className="route-grid">
                  {matchedRoutes.map(({ route, policies }) => (
                    <MatchCard key={route.id} route={route} policies={policies} language={language} localDate={localDates[route.id]} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

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
                  const checkedPolicies = matchesById.get(id);
                  return (
                    <li key={id} className="comparison-card">
                      <div className="route-context">
                        {countriesById.get(route.countryId)?.name[language]} <span aria-hidden="true">·</span> {categoryLabels[route.category][language]}
                      </div>
                      <h4>{route.name[language]}</h4>
                      {checkedPolicies ? (
                        <>
                          <p>{t("fullEligibilityUnverified")}</p>
                          <ul className="compared-checks">
                            {checkedPolicies.map(({ policy, outcome }) => (
                              <li key={policy.id}>
                                {policy.name?.[language] ?? t("checkedOutcome")}{" "}
                                <PolicyStatus evaluation={outcome} language={language} />
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : <PolicyStatus hasPolicy={routePolicies(route).length > 0} language={language} />}
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
                const policies = routePolicies(route);
                const selected = comparison.includes(route.id);
                return (
                  <li className="route-card" key={route.id} data-route-id={route.id}>
                    <p className="route-context"><span aria-hidden="true">{country?.flag}</span> {country?.name[language]} <span aria-hidden="true">·</span> {categoryLabels[route.category][language]}</p>
                    <h3>{route.name[language]}</h3>
                    <p className="route-description">{route.description[language]}</p>
                    <PolicyStatus hasPolicy={policies.length > 0} language={language} />
                    {route.scope && <p className="route-scope"><strong>{t("scope")}</strong> {route.scope[language]}</p>}
                    {policies.length === 0 && <p className="route-scope">{t("browseOnlyText")}</p>}
                    {policies.map((policy) => (
                      <div key={policy.id}>
                        {policy.name && <h4 className="catalog-mechanism">{policy.name[language]}</h4>}
                        {policy.scope && <p className="route-scope">{policy.scope[language]}</p>}
                        <PolicyDetails language={language} policy={policy} />
                      </div>
                    ))}
                    <LaterStages route={route} language={language} />
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
