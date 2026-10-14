import { useEffect, useId, useState, type FormEvent } from "react";
import { api, type Role, type User } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Avatar,
  Badge,
  Modal,
  Pagination,
  PasswordStrength,
  roleKey,
  staggerIndex,
  SubmitButton,
  TableSkeleton,
  TextField,
} from "../../components";
import { useDebounced, useQuery } from "../../hooks";
import { Rich, useI18n } from "../../i18n";
import { Icon } from "../../icons";

const PAGE_SIZE = 10;
const MIN_PASSWORD_LENGTH = 8;

type Status = "active" | "inactive";
type Notice = { kind: "success" | "error"; text: string } | null;
type Dialog =
  | { kind: "create" }
  | { kind: "edit"; user: User }
  | { kind: "password"; user: User }
  | { kind: "delete"; user: User };

/** 16 characters from the browser's secure random source, without look-alikes (0/O, 1/l). */
function generatePassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const numbers = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(numbers, (n) => alphabet[n % alphabet.length]).join("");
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** Shown in clear on request: the administrator has to pass the password on. */
function PasswordInput({ label, value, onChange }: PasswordInputProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TextField
        label={label}
        type={visible ? "text" : "password"}
        dir="ltr"
        value={value}
        onChange={onChange}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        maxLength={128}
        hint={t("users.passwordHint", { n: MIN_PASSWORD_LENGTH })}
        required
      />
      <PasswordStrength password={value} minLength={MIN_PASSWORD_LENGTH} />
      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            onChange(generatePassword());
            setVisible(true);
          }}
        >
          {t("users.generate")}
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
          />
          {t("users.show")}
        </label>
      </div>
    </>
  );
}

interface DialogActionsProps {
  onClose: () => void;
  busy: boolean;
  submitLabel: string;
  danger?: boolean;
}

function DialogActions({ onClose, busy, submitLabel, danger = false }: DialogActionsProps) {
  const { t } = useI18n();
  return (
    <div className="form-actions">
      <button type="button" className="btn btn-secondary" onClick={onClose}>
        {t("common.cancel")}
      </button>
      <SubmitButton busy={busy} className={danger ? "btn btn-danger" : "btn btn-primary"}>
        {submitLabel}
      </SubmitButton>
    </div>
  );
}

/** Run one request for a dialog, tracking its busy and error state. */
function useSubmit(action: () => Promise<void>) {
  const { err } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(err(failure));
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

interface UserFormProps {
  /** The account being edited, or null to create one. */
  target: User | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: User) => void;
}

/** Create an account, or edit one: name, email, role and whether it may sign in. */
function UserFormDialog({ target, isSelf, onClose, onSaved }: UserFormProps) {
  const { t } = useI18n();
  const roleId = useId();
  const [fullName, setFullName] = useState(target?.full_name ?? "");
  const [email, setEmail] = useState(target?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(target?.role ?? "user");
  const [active, setActive] = useState(target?.is_active ?? true);

  const { error, busy, submit } = useSubmit(async () => {
    const details = { full_name: fullName, email };
    if (!target) {
      onSaved(await api.admin.createUser({ ...details, password, role, is_active: active }));
    } else if (isSelf) {
      onSaved(await api.admin.updateUser(target.id, details));
    } else {
      onSaved(await api.admin.updateUser(target.id, { ...details, role, is_active: active }));
    }
  });

  return (
    <Modal
      title={target ? t("users.editTitle", { name: target.full_name }) : t("users.new")}
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        {error && <Alert>{error}</Alert>}
        <TextField
          label={t("field.fullName")}
          value={fullName}
          onChange={setFullName}
          maxLength={120}
          autoComplete="off"
          required
        />
        <TextField
          label={t("field.email")}
          type="email"
          dir="ltr"
          value={email}
          onChange={setEmail}
          autoComplete="off"
          required
        />
        {!target && (
          <PasswordInput label={t("field.password")} value={password} onChange={setPassword} />
        )}
        <div className="field">
          <label htmlFor={roleId}>{t("field.role")}</label>
          <select
            id={roleId}
            value={role}
            disabled={isSelf}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            <option value="user">{t("users.roleUser")}</option>
            <option value="admin">{t("users.roleAdmin")}</option>
          </select>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={active}
            disabled={isSelf}
            onChange={(event) => setActive(event.target.checked)}
          />
          {t("users.activeCheck")}
        </label>
        {isSelf && <p className="hint">{t("users.selfHint")}</p>}
        <DialogActions
          onClose={onClose}
          busy={busy}
          submitLabel={t(target ? "users.saveChanges" : "users.createUser")}
        />
      </form>
    </Modal>
  );
}

interface TargetDialogProps {
  target: User;
  isSelf: boolean;
  onClose: () => void;
  onDone: () => void;
}

function PasswordDialog({ target, isSelf, onClose, onDone }: TargetDialogProps) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const { error, busy, submit } = useSubmit(async () => {
    await api.admin.resetPassword(target.id, password);
    onDone();
  });

  return (
    <Modal title={t("users.resetTitle", { name: target.full_name })} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {error && <Alert>{error}</Alert>}
        <p className="muted">
          {isSelf ? t("users.resetSelf") : t("users.resetOther", { email: target.email })}
        </p>
        <PasswordInput label={t("field.newPassword")} value={password} onChange={setPassword} />
        <DialogActions onClose={onClose} busy={busy} submitLabel={t("users.setPassword")} />
      </form>
    </Modal>
  );
}

function DeleteDialog({ target, onClose, onDone }: Omit<TargetDialogProps, "isSelf">) {
  const { t } = useI18n();
  const { error, busy, submit } = useSubmit(async () => {
    await api.admin.deleteUser(target.id);
    onDone();
  });

  return (
    <Modal title={t("users.deleteTitle")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {error && <Alert>{error}</Alert>}
        <p>
          <Rich text={t("users.deleteText", { name: target.full_name, email: target.email })} />
        </p>
        <DialogActions
          onClose={onClose}
          busy={busy}
          submitLabel={t("users.deleteAccount")}
          danger
        />
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me, setUser: setMe } = useAuth();
  const { t, d, err } = useI18n();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const q = useDebounced(search.trim());
  const users = useQuery(
    (signal) => api.admin.users({ q, role, status, page, page_size: PAGE_SIZE }, signal),
    [q, role, status, page],
  );

  // Deleting the last row of the last page would otherwise leave an empty table.
  const pageIsEmpty = users.data?.page === page && users.data.items.length === 0;
  useEffect(() => {
    if (pageIsEmpty && page > 1) setPage(page - 1);
  }, [pageIsEmpty, page]);

  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const finish = (text: string) => {
    setDialog(null);
    setNotice({ kind: "success", text });
    users.reload();
  };

  const toggleActive = async (target: User) => {
    try {
      await api.admin.updateUser(target.id, { is_active: !target.is_active });
      finish(
        t(target.is_active ? "users.deactivated" : "users.reactivated", {
          name: target.full_name,
        }),
      );
    } catch (failure) {
      setNotice({ kind: "error", text: err(failure) });
    }
  };

  const close = () => setDialog(null);
  const isSelf = (target: User) => target.id === me?.id;

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <span className="page-icon">
            <Icon name="users" size={24} />
          </span>
          <div>
            <h1>{t("users.title")}</h1>
            <p className="muted">{t("users.subtitle")}</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: "create" })}>
          <Icon name="plus" />
          {t("users.new")}
        </button>
      </header>

      <div className="toolbar">
        <label className="search-box">
          <Icon name="search" />
          <input
            type="search"
            aria-label={t("users.search")}
            placeholder={t("users.search")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label={t("users.filterRole")}
          value={role}
          onChange={(event) => {
            setRole(event.target.value as Role | "");
            setPage(1);
          }}
        >
          <option value="">{t("users.allRoles")}</option>
          <option value="admin">{t("users.admins")}</option>
          <option value="user">{t("users.users")}</option>
        </select>
        <select
          aria-label={t("users.filterStatus")}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as Status | "");
            setPage(1);
          }}
        >
          <option value="">{t("users.anyStatus")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="inactive">{t("status.inactive")}</option>
        </select>
      </div>

      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      {users.error != null && <Alert>{err(users.error)}</Alert>}
      {!users.data && users.loading && <TableSkeleton rows={6} />}

      {users.data && (
        <div className="card table-card" aria-busy={users.loading}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("col.user")}</th>
                  <th>{t("col.role")}</th>
                  <th>{t("col.status")}</th>
                  <th>{t("col.created")}</th>
                  <th>{t("col.lastSignIn")}</th>
                  <th className="num">{t("col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.data.items.map((user, index) => (
                  <tr key={user.id} className="row-enter" style={staggerIndex(index)}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={user.full_name} size="sm" />
                        <div>
                          <span className="cell-title">
                            {user.full_name}{" "}
                            {isSelf(user) && <Badge tone="neutral">{t("users.you")}</Badge>}
                          </span>
                          <span className="cell-sub">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge tone={user.role}>{t(roleKey(user.role))}</Badge>
                    </td>
                    <td>
                      <Badge tone={user.is_active ? "active" : "inactive"}>
                        {t(user.is_active ? "status.active" : "status.inactive")}
                      </Badge>
                    </td>
                    <td>{d(user.created_at)}</td>
                    <td>{d(user.last_login_at, true)}</td>
                    <td className="num">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDialog({ kind: "edit", user })}
                        >
                          {t("users.edit")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDialog({ kind: "password", user })}
                        >
                          {t("users.password")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={isSelf(user)}
                          title={isSelf(user) ? t("users.cannotDeactivateSelf") : undefined}
                          onClick={() => toggleActive(user)}
                        >
                          {t(user.is_active ? "users.deactivate" : "users.activate")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-ghost-danger"
                          disabled={isSelf(user)}
                          title={isSelf(user) ? t("users.cannotDeleteSelf") : undefined}
                          onClick={() => setDialog({ kind: "delete", user })}
                        >
                          {t("users.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      {t("users.none")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={users.data.total} onPage={setPage} />
        </div>
      )}

      {dialog?.kind === "create" && (
        <UserFormDialog
          target={null}
          isSelf={false}
          onClose={close}
          onSaved={(saved) => finish(t("users.created", { name: saved.full_name }))}
        />
      )}
      {dialog?.kind === "edit" && (
        <UserFormDialog
          target={dialog.user}
          isSelf={isSelf(dialog.user)}
          onClose={close}
          onSaved={(saved) => {
            if (saved.id === me?.id) setMe(saved);
            finish(t("users.updated", { name: saved.full_name }));
          }}
        />
      )}
      {dialog?.kind === "password" && (
        <PasswordDialog
          target={dialog.user}
          isSelf={isSelf(dialog.user)}
          onClose={close}
          onDone={() => finish(t("users.passwordChanged", { name: dialog.user.full_name }))}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteDialog
          target={dialog.user}
          onClose={close}
          onDone={() => finish(t("users.deleted", { name: dialog.user.full_name }))}
        />
      )}
    </>
  );
}
