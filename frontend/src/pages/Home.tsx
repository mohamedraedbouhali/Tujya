import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type CatalogSummary } from "../api";
import { useAuth } from "../auth";
import { APP_NAME } from "../brand";
import { Alert, LogoMark, StatTile, staggerIndex } from "../components";
import { useQuery } from "../hooks";
import { greetingKey, useI18n, type MessageKey } from "../i18n";
import { Icon, type IconName } from "../icons";

const TILES: { key: keyof CatalogSummary; label: MessageKey; note: MessageKey; icon: IconName }[] = [
  { key: "drugs", label: "tile.drugs", note: "tile.drugs.note", icon: "pill" },
  { key: "cell_lines", label: "tile.cellLines", note: "tile.cellLines.note", icon: "cells" },
  {
    key: "synergy_measurements",
    label: "tile.measurements",
    note: "tile.measurements.note",
    icon: "flask",
  },
  { key: "abstracts", label: "tile.abstracts", note: "tile.abstracts.note", icon: "book" },
];

const SHORTCUTS: { to: string; title: MessageKey; text: MessageKey; icon: IconName }[] = [
  { to: "/drugs", icon: "pill", title: "shortcut.drugs.title", text: "shortcut.drugs.text" },
  { to: "/cell-lines", icon: "cells", title: "shortcut.lines.title", text: "shortcut.lines.text" },
  { to: "/profile", icon: "user", title: "shortcut.profile.title", text: "shortcut.profile.text" },
];

export default function Home() {
  const { user } = useAuth();
  const { t, err } = useI18n();
  const navigate = useNavigate();
  const summary = useQuery((signal) => api.catalogSummary(signal), []);
  const [search, setSearch] = useState("");
  const firstName = user?.full_name.split(/\s+/)[0] ?? "";

  const openDrugs = (event: FormEvent) => {
    event.preventDefault();
    const q = search.trim();
    navigate(q ? `/drugs?q=${encodeURIComponent(q)}` : "/drugs");
  };

  return (
    <>
      <section className="banner">
        <div className="orbs" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="banner-copy">
          <p className="eyebrow">{t("nav.home")}</p>
          <h1>{t("home.hello", { greeting: t(greetingKey()), name: firstName })}</h1>
          <p>{t("home.lead", { name: APP_NAME })}</p>
          <form className="banner-search" role="search" onSubmit={openDrugs}>
            <Icon name="search" size={20} />
            <input
              type="search"
              aria-label={t("home.searchLabel")}
              placeholder={t("home.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit" className="btn btn-light">
              {t("common.search")}
            </button>
          </form>
        </div>
        <LogoMark size={170} className="banner-emblem emblem-float" />
      </section>

      {summary.error != null && <Alert>{err(summary.error)}</Alert>}

      <section aria-label={t("home.datasetSize")} className="stat-grid">
        {TILES.map((tile) => (
          <StatTile
            key={tile.key}
            icon={tile.icon}
            label={t(tile.label)}
            note={t(summary.data && summary.data[tile.key] == null ? "tile.notBuilt" : tile.note)}
            value={summary.data?.[tile.key]}
            loading={summary.loading && !summary.data}
          />
        ))}
      </section>

      <h2 className="section-title">{t("home.whereToGo")}</h2>
      <section className="link-grid">
        {SHORTCUTS.map((shortcut, index) => (
          <Link
            className="card link-card lift"
            to={shortcut.to}
            key={shortcut.to}
            style={staggerIndex(index)}
          >
            <span className="link-card-icon">
              <Icon name={shortcut.icon} size={22} />
            </span>
            <h3>{t(shortcut.title)}</h3>
            <p>{t(shortcut.text)}</p>
            <span className="link-card-arrow" aria-hidden="true">
              <Icon name="arrow" />
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}
