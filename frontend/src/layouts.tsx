import { useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import type { Role } from "./api";
import { homePath, useAuth } from "./auth";
import { Alert, Avatar, Logo, Preferences, Spinner } from "./components";
import { useI18n, type MessageKey } from "./i18n";
import { Icon, type IconName } from "./icons";

/** Gate for a group of routes: signed in, and (when `role` is given) with that role. */
export function RequireAuth({ role }: { role?: Role }) {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (!ready) return <Spinner label={t("common.checkingSession")} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={homePath(user)} replace />;
  return <Outlet />;
}

interface NavItem {
  to: string;
  label: MessageKey;
  icon: IconName;
  /** Match the path exactly, so "/admin" is not highlighted on "/admin/users". */
  end?: boolean;
}

function AppShell({ items, admin = false }: { items: NavItem[]; admin?: boolean }) {
  const { user, signOut } = useAuth();
  const { t, err } = useI18n();
  const location = useLocation();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  if (!user) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (failure) {
      // Never let someone walk away from a shared computer believing they signed out.
      setSignOutError(`${t("error.stillSignedIn")} ${err(failure)}`);
    }
  };

  return (
    <div className={admin ? "shell shell-admin" : "shell"}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to={admin ? "/admin" : "/home"}>
            <Logo />
            {admin && <span className="brand-tag">{t("role.admin")}</span>}
          </Link>
          <nav className="nav" aria-label={t("nav.main")}>
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                <Icon name={item.icon} />
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-user">
            <Preferences />
            <Avatar name={user.full_name} />
            <span className="user-id">
              <span className="user-name" title={user.email}>
                {user.full_name}
              </span>
              <span className="user-role">
                {t(user.role === "admin" ? "role.administrator" : "role.member")}
              </span>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              <Icon name="logout" size={16} />
              {t("common.signOut")}
            </button>
          </div>
        </div>
      </header>
      <main className="page">
        {signOutError && <Alert>{signOutError}</Alert>}
        {/* Keyed by address, so every page plays its entrance when you navigate to it. */}
        <div className="page-enter" key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function UserLayout() {
  const { user } = useAuth();
  const items: NavItem[] = [
    { to: "/home", label: "nav.home", icon: "home" },
    { to: "/drugs", label: "nav.drugs", icon: "pill" },
    { to: "/cell-lines", label: "nav.cellLines", icon: "cells" },
    { to: "/profile", label: "nav.profile", icon: "user" },
  ];
  if (user?.role === "admin") items.push({ to: "/admin", label: "nav.admin", icon: "shield" });
  return <AppShell items={items} />;
}

export function AdminLayout() {
  return (
    <AppShell
      admin
      items={[
        { to: "/admin", label: "nav.dashboard", icon: "grid", end: true },
        { to: "/admin/users", label: "nav.users", icon: "users" },
        { to: "/admin/account", label: "nav.myAccount", icon: "user" },
        { to: "/home", label: "nav.viewApp", icon: "eye" },
      ]}
    />
  );
}
