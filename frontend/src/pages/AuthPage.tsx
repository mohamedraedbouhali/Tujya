import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { User } from "../api";
import { homePath, useAuth } from "../auth";
import { APP_NAME } from "../brand";
import {
  Alert,
  Logo,
  PasswordStrength,
  Preferences,
  Spinner,
  SubmitButton,
  TextField,
} from "../components";
import { useI18n } from "../i18n";

const MIN_PASSWORD_LENGTH = 8;

/** Go back to the page that asked for a sign-in, but only inside the user's own area. */
function destination(user: User, from: unknown): string {
  const home = homePath(user);
  if (typeof from !== "string") return home;
  const adminArea = from.startsWith("/admin");
  return adminArea === (user.role === "admin") ? from : home;
}

export default function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const { user, ready, signIn, signUp } = useAuth();
  const { t, err } = useI18n();
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signingUp = mode === "signup";

  useEffect(() => {
    setError(null);
    setPassword("");
    setConfirm("");
  }, [mode]);

  if (!ready) return <Spinner label={t("common.checkingSession")} />;
  // Also what moves the user on after a successful sign-in or sign-up.
  if (user) return <Navigate to={destination(user, from)} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (signingUp && password !== confirm) {
      setError(t("auth.mismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (signingUp) {
        await signUp({ email, full_name: fullName, password });
      } else {
        await signIn(email, password);
      }
    } catch (failure) {
      setError(err(failure));
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      {/* The brand side: the logo, one sentence, one quotation. Nothing to read twice. */}
      <aside className="auth-aside">
        <div className="orbs" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="auth-aside-body">
          <div className="auth-aside-logo">
            <Logo tone="dark" height={230} className="emblem-float" />
          </div>
          <h1>{t("tagline")}</h1>
          <figure className="quote">
            <blockquote>{t("quote.text")}</blockquote>
            <figcaption>{t("quote.by")}</figcaption>
          </figure>
        </div>
      </aside>

      <main className="auth-main">
        <div className="corner-prefs">
          <Preferences />
        </div>
        <div className="auth-column">
          {/* Only shown on narrow screens, where the brand side is hidden. */}
          <div className="auth-logo">
            <Logo height={104} />
          </div>

          <div className="auth-card">
            <h2>{t(signingUp ? "auth.createYourAccount" : "auth.welcomeBack")}</h2>
            <p className="muted">
              {t(signingUp ? "auth.lessThanAMinute" : "auth.signInToContinue")}
            </p>

            <nav className="tabs" data-mode={mode} aria-label={t("auth.tabs")}>
              <Link
                to="/login"
                state={location.state}
                aria-current={signingUp ? undefined : "page"}
                className={signingUp ? "tab" : "tab tab-active"}
              >
                {t("auth.tabSignIn")}
              </Link>
              <Link
                to="/signup"
                state={location.state}
                aria-current={signingUp ? "page" : undefined}
                className={signingUp ? "tab tab-active" : "tab"}
              >
                {t("auth.tabSignUp")}
              </Link>
            </nav>

            <form onSubmit={submit} className="form">
              {error && <Alert>{error}</Alert>}
              {signingUp && (
                <div className="field-enter">
                  <TextField
                    label={t("field.fullName")}
                    value={fullName}
                    onChange={setFullName}
                    autoComplete="name"
                    maxLength={120}
                    required
                    autoFocus
                  />
                </div>
              )}
              <TextField
                label={t("field.email")}
                type="email"
                dir="ltr"
                value={email}
                onChange={setEmail}
                autoComplete={signingUp ? "email" : "username"}
                placeholder="you@example.com"
                required
                autoFocus={!signingUp}
              />
              <TextField
                label={t("field.password")}
                type={showPassword ? "text" : "password"}
                dir="ltr"
                value={password}
                onChange={setPassword}
                autoComplete={signingUp ? "new-password" : "current-password"}
                minLength={signingUp ? MIN_PASSWORD_LENGTH : undefined}
                maxLength={128}
                hint={signingUp ? t("field.passwordHint", { n: MIN_PASSWORD_LENGTH }) : undefined}
                required
              />
              {signingUp && (
                <>
                  <PasswordStrength password={password} minLength={MIN_PASSWORD_LENGTH} />
                  <div className="field-enter">
                    <TextField
                      label={t("field.confirmPassword")}
                      type={showPassword ? "text" : "password"}
                      dir="ltr"
                      value={confirm}
                      onChange={setConfirm}
                      autoComplete="new-password"
                      maxLength={128}
                      required
                    />
                  </div>
                </>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                />
                {t("field.showPassword")}
              </label>
              <SubmitButton busy={busy} className="btn btn-primary btn-lg btn-block">
                {t(signingUp ? "common.createAccount" : "common.signIn")}
              </SubmitButton>
            </form>

            <p className="auth-switch muted">
              {t(signingUp ? "auth.haveAccount" : "auth.newHere")}{" "}
              <Link to={signingUp ? "/login" : "/signup"} state={location.state}>
                {t(signingUp ? "common.signIn" : "common.createAnAccount")}
              </Link>
            </p>
          </div>

          <p className="auth-foot muted">
            <Link to="/">{t("common.about", { name: APP_NAME })}</Link>
            <span>{t("common.disclaimer")}</span>
          </p>
        </div>
      </main>
    </div>
  );
}
