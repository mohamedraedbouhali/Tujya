import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api, type AdminStats } from "../../api";
import { useAuth } from "../../auth";
import { APP_NAME } from "../../brand";
import {
  Alert,
  Avatar,
  Badge,
  roleKey,
  StatTile,
  staggerIndex,
  TableSkeleton,
} from "../../components";
import { useQuery } from "../../hooks";
import { greetingKey, useI18n, type MessageKey } from "../../i18n";
import { Icon, type IconName } from "../../icons";

const TILES: { key: keyof AdminStats; label: MessageKey; note: MessageKey; icon: IconName }[] = [
  { key: "users_total", label: "dash.accounts", note: "dash.accounts.note", icon: "users" },
  { key: "users_active", label: "dash.active", note: "dash.active.note", icon: "check" },
  { key: "users_inactive", label: "dash.inactive", note: "dash.inactive.note", icon: "ban" },
  { key: "admins", label: "dash.admins", note: "dash.admins.note", icon: "shield" },
  {
    key: "signups_last_7_days",
    label: "dash.newThisWeek",
    note: "dash.newThisWeek.note",
    icon: "spark",
  },
  { key: "active_sessions", label: "dash.sessions", note: "dash.sessions.note", icon: "clock" },
];

/** Share of accounts that can sign in, as a bar that fills when the numbers arrive. */
function AccessMeter({ stats }: { stats: AdminStats }) {
  const { t, n } = useI18n();
  const share = stats.users_total ? Math.round((stats.users_active / stats.users_total) * 100) : 0;
  return (
    <div className="card meter-card">
      <div className="meter-head">
        <h2>{t("dash.access.title")}</h2>
        <strong>{t("dash.access.share", { percent: n(share) })}</strong>
      </div>
      <div
        className="meter"
        role="img"
        aria-label={t("dash.access.aria", {
          active: n(stats.users_active),
          total: n(stats.users_total),
        })}
      >
        <span style={{ "--w": `${share}%` } as CSSProperties} />
      </div>
      <p className="meter-legend muted">
        <span>
          <i className="dot dot-active" />
          {t("dash.access.active", { n: n(stats.users_active) })}
        </span>
        <span>
          <i className="dot dot-inactive" />
          {t("dash.access.inactive", { n: n(stats.users_inactive) })}
        </span>
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t, d, err } = useI18n();
  const stats = useQuery((signal) => api.admin.stats(signal), []);
  const recent = useQuery((signal) => api.admin.users({ page_size: 5 }, signal), []);
  const firstName = user?.full_name.split(/\s+/)[0] ?? "";

  return (
    <>
      <section className="banner banner-admin">
        <div className="orbs" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="banner-copy">
          <p className="eyebrow">{t("dash.eyebrow")}</p>
          <h1>{t("dash.title")}</h1>
          <p>{t("dash.lead", { greeting: t(greetingKey()), name: firstName, app: APP_NAME })}</p>
          <div className="banner-actions">
            <Link className="btn btn-light" to="/admin/users">
              <Icon name="users" />
              {t("dash.manage")}
            </Link>
            <Link className="btn btn-on-dark" to="/home">
              <Icon name="eye" />
              {t("dash.viewApp")}
            </Link>
          </div>
        </div>
      </section>

      {stats.error != null && <Alert>{err(stats.error)}</Alert>}
      <section aria-label={t("dash.numbers")} className="stat-grid stat-grid-3">
        {TILES.map((tile) => (
          <StatTile
            key={tile.key}
            icon={tile.icon}
            label={t(tile.label)}
            note={t(tile.note)}
            value={stats.data?.[tile.key]}
            loading={!stats.data && stats.loading}
          />
        ))}
      </section>

      {stats.data && <AccessMeter stats={stats.data} />}

      <h2 className="section-title">{t("dash.newest")}</h2>
      {recent.error != null && <Alert>{err(recent.error)}</Alert>}
      {!recent.data && recent.loading && <TableSkeleton rows={5} />}
      {recent.data && (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("col.user")}</th>
                  <th>{t("col.role")}</th>
                  <th>{t("col.status")}</th>
                  <th>{t("col.created")}</th>
                  <th>{t("col.lastSignIn")}</th>
                </tr>
              </thead>
              <tbody>
                {recent.data.items.map((account, index) => (
                  <tr key={account.id} className="row-enter" style={staggerIndex(index)}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={account.full_name} size="sm" />
                        <div>
                          <span className="cell-title">{account.full_name}</span>
                          <span className="cell-sub">{account.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge tone={account.role}>{t(roleKey(account.role))}</Badge>
                    </td>
                    <td>
                      <Badge tone={account.is_active ? "active" : "inactive"}>
                        {t(account.is_active ? "status.active" : "status.inactive")}
                      </Badge>
                    </td>
                    <td>{d(account.created_at)}</td>
                    <td>{d(account.last_login_at, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
