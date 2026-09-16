import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { CONSENT_CONTROLLER, CONSENT_PRIVACY_URL, CONSENT_TEXT } from "@/consent";
import type { DownloadKind } from "@/consent";

/** What the form collected, kept for the session so the second download needn't ask again. */
export type SignupDetails = {
  firstName: string;
  lastName: string;
  email: string;
  postcode: string;
  country: string;
  favouriteMusical: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
};

const EMPTY: SignupDetails = {
  firstName: "", lastName: "", email: "", postcode: "", country: "",
  favouriteMusical: "", birthDay: "", birthMonth: "", birthYear: "",
};

const FIELD =
  "mt-1.5 block w-full rounded-[5.6px] border border-[#3b4154] bg-[#00060f]/60 px-3 py-2.5 text-[14px] text-white " +
  "outline-none placeholder:text-[#6a99ab] focus-visible:border-[#a5bed3] focus-visible:ring-1 focus-visible:ring-[#a5bed3]";
const LABEL = "block text-[12px] uppercase tracking-[0.1em] text-[#a5bed3]";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Posts the details and comes back with an authorisation for the download asked
 * for. Exported because a visitor who takes the second download is not asked
 * again: the page sends what they already gave, which records that they took it.
 */
export async function submitSignup(details: SignupDetails, download: DownloadKind): Promise<{ token: string } | { error: string }> {
  const response = await fetch("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: details.firstName.trim(),
      lastName: details.lastName.trim(),
      email: details.email.trim(),
      postcode: details.postcode.trim() || undefined,
      country: details.country.trim() || undefined,
      favouriteMusical: details.favouriteMusical.trim() || undefined,
      birthDay: details.birthDay === "" ? undefined : Number(details.birthDay),
      birthMonth: details.birthMonth === "" ? undefined : Number(details.birthMonth),
      birthYear: details.birthYear === "" ? undefined : Number(details.birthYear),
      marketingConsent: true,
      download,
    }),
  }).catch(() => null);

  if (!response) return { error: "We couldn't reach the server. Please check your connection and try again." };
  if (!response.ok) {
    const said = (await response.json().catch(() => null)) as { error?: string } | null;
    return { error: said?.error ?? "We couldn't save your details just now. Please try again." };
  }
  return { token: ((await response.json()) as { token: string }).token };
}

/** Only a complete, real date counts; the server refuses a partial one too. */
function birthdayProblem({ birthDay, birthMonth, birthYear }: SignupDetails) {
  const parts = [birthDay, birthMonth, birthYear];
  if (parts.every((part) => part === "")) return null;
  if (parts.some((part) => part === "")) return "Please give all three parts of your birthday, or leave them all blank.";
  const [day, month, year] = parts.map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) {
    return "That birthday isn't a real date.";
  }
  if (year < 1900 || year > new Date().getUTCFullYear()) return "Please check the year of your birthday.";
  return null;
}

export default function SignupModal({
  download,
  anchorTop,
  pageHeight,
  onClose,
  onComplete,
}: {
  download: DownloadKind;
  anchorTop: number;
  pageHeight: number;
  onClose: () => void;
  onComplete: (details: SignupDetails, token: string) => void;
}) {
  const [details, setDetails] = useState<SignupDetails>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [top, setTop] = useState(anchorTop);
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  /** Where focus came from, so closing puts it back on the control that opened this. */
  const openedFrom = useRef<HTMLElement | null>(null);

  // Kept inside the height the page had before this opened: anchored where the
  // visitor pressed, but pushed up rather than off the end of the document, so the
  // height reported to the host frame does not move.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    setTop(Math.max(8, Math.min(anchorTop, pageHeight - panel.offsetHeight - 8)));
  }, [anchorTop, pageHeight, problem]);

  useEffect(() => {
    openedFrom.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => openedFrom.current?.focus();
  }, []);

  // Escape closes, and Tab is kept inside: a dialog the keyboard can walk out of
  // leaves a visitor tabbing through a page they cannot see.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function set(field: keyof SignupDetails, value: string) {
    setDetails((previous) => ({ ...previous, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const trimmed = { ...details, firstName: details.firstName.trim(), lastName: details.lastName.trim(), email: details.email.trim() };
    if (!trimmed.firstName || !trimmed.lastName || !trimmed.email) {
      setProblem("Please give your first name, last name and email address.");
      return;
    }
    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(trimmed.email)) {
      setProblem("That email address doesn't look right.");
      return;
    }
    const birthday = birthdayProblem(trimmed);
    if (birthday) {
      setProblem(birthday);
      return;
    }

    setProblem(null);
    setSubmitting(true);
    const result = await submitSignup(trimmed, download);
    if ("error" in result) {
      setProblem(result.error);
      setSubmitting(false);
      return;
    }
    onComplete(trimmed, result.token);
  }

  const offer = download === "stem-pack" ? "the stem pack" : "your mix";

  return (
    // Absolute rather than fixed, and anchored where the visitor pressed. Framed in
    // an auto-height iframe the page never scrolls, so the frame's viewport is the
    // whole document and a fixed dialog would sit in the middle of a page the host
    // has scrolled away from. Absolute within the existing content also leaves
    // scrollHeight alone, so the height posted to the parent does not move.
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-[#00060f]/85" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-title"
        // Capped as well as clamped. The clamp alone trusts one measurement, and a
        // late reflow — a web font swapping in and rewrapping the consent wording —
        // grew the panel afterwards and pushed the page out by a few pixels, which
        // the host frame saw as a height change. Capped, it scrolls inside itself
        // instead, so top + height can never exceed the page it opened over.
        style={{ top, maxHeight: pageHeight - 16 }}
        className="absolute left-1/2 w-[min(100%-2rem,480px)] -translate-x-1/2 overflow-y-auto border border-[#3b4154] bg-[#020a15] p-5 shadow-[0_24px_60px_rgba(0,0,0,.6)] sm:p-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close and go back"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center text-[#a5bed3] hover:text-white">
          <X className="h-4 w-4" />
        </button>

        <h2 id="signup-title" className="section-heading pr-8">Before you download</h2>
        <p className="mt-3 text-[14px] leading-[1.7]">
          Tell us where to find you and {offer} is yours. Fields marked with an asterisk are required; the rest are up to you.
        </p>

        <form onSubmit={submit} noValidate className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={LABEL}>First name *</span>
              <input ref={firstFieldRef} required value={details.firstName} onChange={(event) => set("firstName", event.target.value)} autoComplete="given-name" className={FIELD} />
            </label>
            <label>
              <span className={LABEL}>Last name *</span>
              <input required value={details.lastName} onChange={(event) => set("lastName", event.target.value)} autoComplete="family-name" className={FIELD} />
            </label>
          </div>

          <label className="mt-4 block">
            <span className={LABEL}>Email address *</span>
            <input required type="email" value={details.email} onChange={(event) => set("email", event.target.value)} autoComplete="email" className={FIELD} />
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className={LABEL}>Postcode <span className="text-[#6a99ab]">(optional)</span></span>
              <input value={details.postcode} onChange={(event) => set("postcode", event.target.value)} autoComplete="postal-code" className={FIELD} />
            </label>
            <label>
              <span className={LABEL}>Country or region <span className="text-[#6a99ab]">(optional)</span></span>
              <input value={details.country} onChange={(event) => set("country", event.target.value)} autoComplete="country-name" className={FIELD} />
            </label>
          </div>

          <label className="mt-4 block">
            <span className={LABEL}>Favourite musical <span className="text-[#6a99ab]">(optional)</span></span>
            <input value={details.favouriteMusical} onChange={(event) => set("favouriteMusical", event.target.value)} className={FIELD} />
          </label>

          <fieldset className="mt-4">
            <legend className={LABEL}>Birthday <span className="text-[#6a99ab]">(optional)</span></legend>
            <div className="grid grid-cols-3 gap-3">
              <label>
                <span className="sr-only">Day of birth</span>
                <input inputMode="numeric" placeholder="DD" value={details.birthDay} onChange={(event) => set("birthDay", event.target.value)} className={FIELD} />
              </label>
              <label>
                <span className="sr-only">Month of birth</span>
                <input inputMode="numeric" placeholder="MM" value={details.birthMonth} onChange={(event) => set("birthMonth", event.target.value)} className={FIELD} />
              </label>
              <label>
                <span className="sr-only">Year of birth</span>
                <input inputMode="numeric" placeholder="YYYY" value={details.birthYear} onChange={(event) => set("birthYear", event.target.value)} className={FIELD} />
              </label>
            </div>
          </fieldset>

          {/* Unticked, and the submit stays disabled until it is: a box already ticked is not consent. */}
          <label className="mt-6 flex items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#a5bed3]"
            />
            <span className="text-[12px] leading-[1.6] text-[#a5bed3]">{CONSENT_TEXT}</span>
          </label>

          {(CONSENT_CONTROLLER.startsWith("[[") || CONSENT_PRIVACY_URL.startsWith("[[")) && (
            <p className="mt-3 border border-dashed border-[#c08a4a] bg-[#c08a4a]/10 p-2.5 text-[11px] uppercase tracking-[0.08em] text-[#e0b070]">
              Not for public release: the data controller and privacy policy link above are placeholders awaiting final wording.
            </p>
          )}

          <p role="alert" className="mt-4 min-h-[1.2em] text-[12px] text-[#e0908a]">{problem}</p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
            <button
              type="submit"
              disabled={!consent || submitting}
              aria-busy={submitting}
              className="flex items-center justify-center gap-2 rounded-[5.6px] border border-[#a5bed3] bg-[linear-gradient(72deg,#6a99ab,#a5bed3)] px-[22px] py-[11px] text-[13.44px] uppercase tracking-[0.1em] text-[#00060f] transition-opacity hover:opacity-90 disabled:cursor-default disabled:border-[#3b4154] disabled:bg-none disabled:bg-[rgba(42,75,90,.38)] disabled:text-[#6a99ab]">
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {submitting ? "Sending" : "Send and download"}
            </button>
            <button type="button" onClick={onClose} className="text-[13.44px] uppercase tracking-[0.1em] text-[#a5bed3] hover:text-white">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
