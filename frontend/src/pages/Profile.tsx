import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Alert,
  Avatar,
  Badge,
  PasswordStrength,
  roleKey,
  SubmitButton,
  TextField,
} from "../components";
import { useI18n } from "../i18n";

const MIN_PASSWORD_LENGTH = 8;

type Notice = { kind: "success" | "error"; text: string } | null;

/** Edit one's own name and email. A new email is confirmed with the current password. */
function DetailsForm() {
  const { user, setUser } = useAuth();
  const { t, err } = useI18n();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const emailChanged = email.trim().toLowerCase() !== user?.email;
  const changed = emailChanged || fullName.trim() !== user?.full_name;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const saved = await api.updateProfile({
        full_name: fullName,
        ...(emailChanged ? { email, current_password: password } : {}),
      });
      setUser(saved);
      setFullName(saved.full_name);
      setEmail(saved.email);
      setPassword("");
      setNotice({ kind: "success", text: t("profile.detailsSaved") });
    } catch (failure) {
      setNotice({ kind: "error", text: err(failure) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{t("profile.details")}</h2>
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      <TextField
        label={t("field.fullName")}
        value={fullName}
        onChange={setFullName}
        autoComplete="name"
        maxLength={120}
        required
      />
      <TextField
        label={t("field.email")}
        type="email"
        dir="ltr"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        hint={t("profile.emailHint")}
        required
      />
      {emailChanged && (
        <div className="field-enter">
          <TextField
            label={t("profile.confirmWithPassword")}
            type="password"
            dir="ltr"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </div>
      )}
      <div className="form-actions">
        <SubmitButton busy={busy} disabled={!changed}>
          {t("common.save")}
        </SubmitButton>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { t, err } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (next !== confirm) {
      setNotice({ kind: "error", text: t("profile.newMismatch") });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice({ kind: "success", text: t("profile.passwordChanged") });
    } catch (failure) {
      setNotice({ kind: "error", text: err(failure) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{t("profile.changePassword")}</h2>
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      <TextField
        label={t("field.currentPassword")}
        type="password"
        dir="ltr"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        maxLength={128}
        required
      />
      <TextField
        label={t("field.newPassword")}
        type="password"
        dir="ltr"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        maxLength={128}
        hint={t("field.passwordHint", { n: MIN_PASSWORD_LENGTH })}
        required
      />
      <PasswordStrength password={next} minLength={MIN_PASSWORD_LENGTH} />
      <TextField
        label={t("field.confirmNewPassword")}
        type="password"
        dir="ltr"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        maxLength={128}
        required
      />
      <div className="form-actions">
        <SubmitButton busy={busy}>{t("profile.changePassword")}</SubmitButton>
      </div>
    </form>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { t, d } = useI18n();
  if (!user) return null;

  return (
    <>
      <header className="profile-header">
        <Avatar name={user.full_name} size="lg" />
        <div>
          <h1>{user.full_name}</h1>
          <p className="muted">
            <bdi>{user.email}</bdi>
          </p>
          <p className="profile-meta">
            <Badge tone={user.role}>{t(roleKey(user.role))}</Badge>
            <span className="muted">
              {t("profile.memberSince", { date: d(user.created_at) })}
            </span>
            <span className="muted">
              {t("profile.lastSignIn", { date: d(user.last_login_at, true) })}
            </span>
          </p>
        </div>
      </header>
      <div className="two-columns">
        <DetailsForm />
        <PasswordForm />
      </div>
    </>
  );
}
