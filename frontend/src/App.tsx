import { Link, Navigate, Route, Routes } from "react-router-dom";
import { homePath, useAuth } from "./auth";
import { Backdrop, Logo, Preferences, Spinner } from "./components";
import { useI18n } from "./i18n";
import { AdminLayout, RequireAuth, UserLayout } from "./layouts";
import Dashboard from "./pages/admin/Dashboard";
import Users from "./pages/admin/Users";
import AuthPage from "./pages/AuthPage";
import { CellLinesPage, DrugsPage } from "./pages/CatalogPage";
import Home from "./pages/Home";
import Intro from "./pages/Intro";
import Profile from "./pages/Profile";

/** "/" shows the introduction to visitors and sends signed-in accounts to their own area. */
function Landing() {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  if (!ready) return <Spinner label={t("common.checkingSession")} />;
  return user ? <Navigate to={homePath(user)} replace /> : <Intro />;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="not-found">
      <div className="corner-prefs">
        <Preferences />
      </div>
      <Logo height={110} />
      <h1>{t("notFound.title")}</h1>
      <p className="muted">{t("notFound.text")}</p>
      <Link className="btn btn-primary" to="/">
        {t("notFound.back")}
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Backdrop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="signin" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />

        {/* Any signed-in account */}
        <Route element={<RequireAuth />}>
          <Route element={<UserLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/drugs" element={<DrugsPage />} />
            <Route path="/cell-lines" element={<CellLinesPage />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Administrators only. The API checks the role again on every request. */}
        <Route element={<RequireAuth role="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/account" element={<Profile />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
