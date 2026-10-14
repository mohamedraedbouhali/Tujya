import { useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api, type CatalogSummary } from "../api";
import { APP_NAME } from "../brand";
import { Logo, LogoMark, Preferences } from "../components";
import { useQuery } from "../hooks";
import { Rich, useI18n, type MessageKey } from "../i18n";
import { Icon, type IconName } from "../icons";
import { CountUp, Reveal, useInView } from "../motion";

const STATS: { key: keyof CatalogSummary; label: MessageKey; icon: IconName }[] = [
  { key: "synergy_measurements", label: "stats.measurements", icon: "flask" },
  { key: "drugs", label: "stats.drugs", icon: "pill" },
  { key: "cell_lines", label: "stats.cellLines", icon: "cells" },
  { key: "abstracts", label: "stats.abstracts", icon: "book" },
];

// Each score compares the measured effect of a pair with a different idea of "no interaction".
const SCORES: { name: string; text: MessageKey }[] = [
  { name: "Bliss", text: "score.bliss" },
  { name: "Loewe", text: "score.loewe" },
  { name: "HSA", text: "score.hsa" },
  { name: "ZIP", text: "score.zip" },
];

const FEATURES: { title: MessageKey; text: MessageKey; icon: IconName }[] = [
  { icon: "search", title: "feature.search.title", text: "feature.search.text" },
  { icon: "cells", title: "feature.lines.title", text: "feature.lines.text" },
  { icon: "check", title: "feature.origin.title", text: "feature.origin.text" },
];

// Names of sources are proper nouns: they are the same in every language.
const SOURCES: { name: string; gives: MessageKey }[] = [
  { name: "DrugComb", gives: "source.drugcomb" },
  { name: "Therapeutics Data Commons", gives: "source.tdc" },
  { name: "O'Neil et al.", gives: "source.oneil" },
  { name: "DepMap", gives: "source.depmap" },
  { name: "PubChem · ChEMBL", gives: "source.pubchem" },
  { name: "PubMed", gives: "source.pubmed" },
];

// Growth inhibition in percent. "Expected" follows Bliss independence:
// 35 + 45 - (35 x 45) / 100 = 64. An illustration of the idea, not measured data.
const FIGURE = { a: 35, b: 45, expected: 64, measured: 85 };

/** A bar that grows to `--w` once its card is on screen (see .figure-card in the CSS). */
function barWidth(percent: number, start = 0): CSSProperties {
  return { "--w": `${percent}%`, insetInlineStart: `${start}%` } as CSSProperties;
}

function SynergyFigure() {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref);
  const rows: { label: MessageKey; width: number; kind: string }[] = [
    { label: "figure.a", width: FIGURE.a, kind: "single" },
    { label: "figure.b", width: FIGURE.b, kind: "single" },
    { label: "figure.expected", width: FIGURE.expected, kind: "expected" },
  ];
  return (
    <figure
      ref={ref}
      className={inView ? "figure-card is-visible" : "figure-card"}
      role="img"
      aria-label={t("figure.aria")}
    >
      <p className="figure-title">{t("figure.title")}</p>
      <p className="figure-sub">{t("figure.sub")}</p>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>{t(row.label)}</span>
          <div className="bar-track">
            <span className={`bar-fill bar-${row.kind}`} style={barWidth(row.width)} />
          </div>
        </div>
      ))}
      <div className="bar-row">
        <span>{t("figure.measured")}</span>
        <div className="bar-track">
          <span className="bar-fill bar-expected" style={barWidth(FIGURE.measured)} />
          <span
            className="bar-fill bar-excess"
            style={barWidth(FIGURE.measured - FIGURE.expected, FIGURE.expected)}
          />
        </div>
      </div>
      <figcaption>
        <span>
          <span className="bar-swatch" /> {t("figure.legend")}
        </span>
        <span className="figure-note">{t("figure.note")}</span>
      </figcaption>
    </figure>
  );
}

/** The public start page: what the site is, shown before anyone signs in. */
export default function Intro() {
  const { t } = useI18n();
  const summary = useQuery((signal) => api.catalogSummary(signal), []);
  // Only tables that exist are shown; if the API is down the band is simply left out.
  const stats = STATS.flatMap((stat) => {
    const value = summary.data?.[stat.key];
    return value == null ? [] : [{ ...stat, value }];
  });

  return (
    <div className="intro">
      <header className="intro-bar">
        <div className="intro-inner intro-bar-inner">
          <Logo height={72} />
          <div className="intro-bar-actions">
            <Preferences />
            <nav aria-label={t("nav.account")}>
              <Link className="btn btn-ghost" to="/login">
                {t("common.signIn")}
              </Link>
              <Link className="btn btn-primary" to="/signup">
                {t("common.createAccount")}
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main>
        <section className="intro-hero">
          <div className="orbs" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="intro-inner intro-hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">{t("intro.eyebrow")}</p>
              <h1>{t("tagline")}</h1>
              <p className="intro-lead">{t("intro.lead", { name: APP_NAME })}</p>
              <div className="intro-cta">
                <Link className="btn btn-light btn-lg" to="/signup">
                  {t("common.createAnAccount")}
                  <Icon name="arrow" />
                </Link>
                <Link className="btn btn-on-dark btn-lg" to="/login">
                  {t("intro.haveOne")}
                </Link>
              </div>
            </div>
            <div className="hero-figure">
              <SynergyFigure />
            </div>
          </div>
        </section>

        {stats.length > 0 && (
          <section className="intro-stats" aria-label={t("intro.statsLabel")}>
            <Reveal stagger className="intro-inner intro-stats-grid">
              {stats.map((stat) => (
                <div className="intro-stat" key={stat.key}>
                  <span className="stat-icon">
                    <Icon name={stat.icon} size={20} />
                  </span>
                  <span className="intro-stat-value">
                    <CountUp value={stat.value} duration={1400} />
                  </span>
                  <span className="intro-stat-label">{t(stat.label)}</span>
                </div>
              ))}
            </Reveal>
          </section>
        )}

        <section className="intro-section">
          <div className="intro-inner">
            <Reveal>
              <h2>{t("intro.what.title")}</h2>
              <p className="intro-text">
                <Rich text={t("intro.what.text")} />
              </p>
            </Reveal>
            <Reveal stagger className="intro-grid intro-grid-4">
              {SCORES.map((score) => (
                <div className="card score-card lift" key={score.name}>
                  <h3>{score.name}</h3>
                  <p className="muted">{t(score.text)}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="intro-section intro-section-alt">
          <div className="intro-inner">
            <Reveal>
              <h2>{t("intro.do.title")}</h2>
            </Reveal>
            <Reveal stagger className="intro-grid intro-grid-3">
              {FEATURES.map((feature) => (
                <div className="feature" key={feature.title}>
                  <span className="feature-icon" aria-hidden="true">
                    <Icon name={feature.icon} size={22} />
                  </span>
                  <h3>{t(feature.title)}</h3>
                  <p className="muted">{t(feature.text)}</p>
                </div>
              ))}
            </Reveal>
            <Reveal>
              <p className="intro-next">
                <span className="badge badge-admin badge-neutral">{t("intro.next.badge")}</span>{" "}
                {t("intro.next.text")}
              </p>
            </Reveal>
          </div>
        </section>

        <section className="intro-section">
          <div className="intro-inner">
            <Reveal>
              <h2>{t("intro.sources.title")}</h2>
              <p className="intro-text">{t("intro.sources.text")}</p>
            </Reveal>
            <Reveal stagger className="source-list">
              {SOURCES.map((source) => (
                <div className="source lift" key={source.name}>
                  <strong>{source.name}</strong>
                  <span className="muted">{t(source.gives)}</span>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="intro-closing">
          <Reveal className="intro-inner">
            <div className="closing-card">
              <div className="orbs" aria-hidden="true">
                <span />
                <span />
              </div>
              <LogoMark size={96} className="emblem-float" />
              <h2>{t("intro.ready.title")}</h2>
              <p>{t("intro.ready.text")}</p>
              <div className="intro-cta">
                <Link className="btn btn-light btn-lg" to="/signup">
                  {t("common.createAnAccount")}
                  <Icon name="arrow" />
                </Link>
                <Link className="btn btn-on-dark btn-lg" to="/login">
                  {t("common.signIn")}
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="intro-footer">
        <div className="intro-inner intro-footer-inner">
          <LogoMark size={28} />
          <span>
            {APP_NAME}. {t("common.disclaimer")}
          </span>
        </div>
      </footer>
    </div>
  );
}
