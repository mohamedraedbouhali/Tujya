// The three languages of the site. English is the reference (en.ts); the choice is kept in
// the browser, and Arabic also switches the whole page to right-to-left.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "../api";
import { ar } from "./ar";
import { en, type MessageKey, type Messages } from "./en";
import { fr } from "./fr";

export type { MessageKey } from "./en";
export type Lang = "en" | "fr" | "ar";

export const LANGUAGES: { code: Lang; name: string; short: string }[] = [
  { code: "en", name: "English", short: "EN" },
  { code: "fr", name: "Français", short: "FR" },
  { code: "ar", name: "العربية", short: "ع" },
];

const DICTIONARIES: Record<Lang, Messages> = { en, fr, ar };
// Arabic text with Western digits, the way figures are written across the Maghreb.
const LOCALES: Record<Lang, string> = { en: "en", fr: "fr", ar: "ar-u-nu-latn" };
const STORAGE_KEY = "tujya.lang";

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "fr" || value === "ar";
}

/** The saved choice, else the browser's language when it is one of ours, else English. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // Storage can be blocked (private mode): fall through to the browser's language.
  }
  const browser = navigator.language.slice(0, 2).toLowerCase();
  return isLang(browser) ? browser : "en";
}

type Vars = Record<string, string | number>;

// What the API answers, word for word, and the message shown instead.
const SERVER_MESSAGES: Record<string, MessageKey> = {
  "Not signed in": "server.notSignedIn",
  "Administrator access required": "server.adminOnly",
  "Incorrect email or password": "server.badCredentials",
  "This account has been deactivated. Contact an administrator.": "server.deactivated",
  "An account with this email already exists": "server.emailTaken",
  "The current password is incorrect": "server.wrongCurrentPassword",
  "User not found": "server.userNotFound",
  "You cannot change your own role": "server.ownRole",
  "You cannot deactivate your own account": "server.ownDeactivate",
  "You cannot delete your own account": "server.ownDelete",
};

const FIELD_LABELS: Record<string, MessageKey> = {
  email: "field.email",
  full_name: "field.fullName",
  password: "field.password",
  new_password: "field.newPassword",
  current_password: "field.currentPassword",
};

interface ValidationIssue {
  loc?: unknown[];
  ctx?: { min_length?: unknown };
}

export interface I18n {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  /** The message for `key`, with every {name} replaced from `vars`. */
  t: (key: MessageKey, vars?: Vars) => string;
  /** A number written the way the current language writes it. */
  n: (value: number) => string;
  /** A date (optionally with the time), or "Never" for null. */
  d: (iso: string | null, withTime?: boolean) => string;
  /** A sentence to show for a failed request, in the current language. */
  err: (error: unknown) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved: the choice still applies until the page is closed.
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const messages = DICTIONARIES[lang];
    const locale = LOCALES[lang];
    const numbers = new Intl.NumberFormat(locale);

    const t = (key: MessageKey, vars?: Vars) =>
      messages[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
        vars && name in vars ? String(vars[name]) : placeholder,
      );

    const err = (error: unknown): string => {
      if (!(error instanceof ApiError)) return t("error.generic");
      if (error.status === 0) return t("error.network");
      const { detail } = error;
      if (typeof detail === "string") {
        const known = SERVER_MESSAGES[detail];
        if (known) return t(known);
        return error.status === 503 ? t("error.tableMissing") : detail;
      }
      if (Array.isArray(detail)) {
        return (detail as ValidationIssue[])
          .map((issue) => {
            const name = String(issue.loc?.at(-1) ?? "");
            const field = name in FIELD_LABELS ? t(FIELD_LABELS[name]) : name;
            const min = issue.ctx?.min_length;
            return typeof min === "number"
              ? t("error.fieldTooShort", { field, n: min })
              : t("error.fieldInvalid", { field });
          })
          .join(" ");
      }
      return error.status >= 500 ? t("error.server") : t("error.generic");
    };

    return {
      lang,
      dir,
      setLang,
      t,
      n: (number) => numbers.format(number),
      d: (iso, withTime = false) =>
        iso
          ? new Date(iso).toLocaleString(locale, {
              dateStyle: "medium",
              timeStyle: withTime ? "short" : undefined,
            })
          : t("common.never"),
      err,
    };
  }, [lang, dir, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}

/** Text from a message, with its **marked** parts in bold. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, index) =>
        index % 2 === 1 ? <strong key={index}>{part}</strong> : part,
      )}
    </>
  );
}

/** Which greeting fits the visitor's own clock. */
export function greetingKey(now = new Date()): MessageKey {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "greeting.morning";
  if (hour >= 12 && hour < 18) return "greeting.afternoon";
  return "greeting.evening";
}
