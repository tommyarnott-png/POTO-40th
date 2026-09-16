import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, LoaderCircle, X } from "lucide-react";
import { BRAND } from "@/assets";
import { CONSENT_PRIVACY_LABEL, CONSENT_PRIVACY_URL, CONSENT_TEXT } from "@/consent";
import type { DownloadKind } from "@/consent";
import options from "@/data/boxFiveOptions.json";

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

type Field = keyof SignupDetails;
type Problems = Partial<Record<Field | "consent", string>>;

/**
 * What was typed before the dialog was closed, kept outside the component so it
 * survives unmounting. Someone who shuts the dialog half way and opens it again
 * comes back to where they were rather than to an empty form; the one place a
 * visitor gives anything back is not the place to make them do it twice. Cleared
 * once a signup goes through.
 */
let draft: { details: SignupDetails; step: 0 | 1; consent: boolean } | null = null;

/**
 * Measured from the Box Five signup on phantomoftheopera.com: a gold-tinted fill, one
 * gold hairline under it, square, 49px tall on a 10px rhythm.
 *
 * The club's two golds. #aa9574 is the dark stop and the resting hairline; #eee0ca is
 * the light stop, the button and rule colour, and — at a tenth — the fill on every
 * surface. They are not this page's #6a99ab/#a5bed3: the form carries the club's
 * identity, and only the gradient angles are shared with the site.
 */
const FIELD =
  "block w-full appearance-none rounded-none border-0 border-b border-[#aa9574] bg-[rgba(238,224,202,0.1)] " +
  "px-3 py-2 h-[49px] text-[14px] text-white outline-none placeholder:text-white/50 " +
  // The reference leaves the hairline unchanged on focus, which gives a keyboard user
  // nothing to follow. Brightening it to the light gold is the smallest departure that
  // stays inside the club's own palette.
  "focus:border-[#eee0ca]";
const LABEL = "flex text-[12px] uppercase leading-[12px] tracking-[0.1em] text-white";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])';

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The reference offers nothing under eighteen and stops a century back; computed so it does not go stale. */
const YEARS = Array.from({ length: 101 }, (_, i) => String(new Date().getUTCFullYear() - 18 - i));

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
  const [details, setDetails] = useState<SignupDetails>(draft?.details ?? EMPTY);
  const [step, setStep] = useState<0 | 1>(draft?.step ?? 0);
  const [consent, setConsent] = useState(draft?.consent ?? false);
  const [problems, setProblems] = useState<Problems>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [top, setTop] = useState(anchorTop);
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  /** Where focus came from, so closing puts it back on the control that opened this. */
  const openedFrom = useRef<HTMLElement | null>(null);

  draft = { details, step, consent };

  /**
   * Kept inside the height the page had before this opened, and re-measured
   * whenever the panel changes size. A wizard is a different height on each step,
   * and a web font swapping in rewraps the consent wording after first paint, so
   * one measurement on open is not enough: either would push the document out and
   * move the height posted to the host frame.
   */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const clamp = () => setTop(Math.max(8, Math.min(anchorTop, pageHeight - panel.offsetHeight - 8)));
    clamp();
    const observer = new ResizeObserver(clamp);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [anchorTop, pageHeight]);

  useEffect(() => {
    openedFrom.current = document.activeElement as HTMLElement | null;
    return () => openedFrom.current?.focus();
  }, []);

  /** Each step opens on its own first field, so the keyboard lands where the typing starts. */
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [step]);

  // Escape closes from either step, and Tab is kept inside: a dialog the keyboard
  // can walk out of leaves a visitor tabbing through a page they cannot see. The
  // panel is queried afresh each time, so the trap follows the step that is showing.
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

  function set(field: Field, value: string) {
    setDetails((previous) => ({ ...previous, [field]: value }));
    setProblems((previous) => ({ ...previous, [field]: undefined }));
  }

  function advance() {
    const found: Problems = {};
    if (!details.firstName.trim()) found.firstName = "Please give your first name.";
    if (!details.lastName.trim()) found.lastName = "Please give your last name.";
    if (!details.email.trim()) found.email = "Please give your email address.";
    else if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(details.email.trim())) found.email = "That email address doesn't look right.";
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    setStep(1);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const found: Problems = {};
    const birthday = birthdayProblem(details);
    if (birthday) found.birthDay = birthday;
    if (!consent) found.consent = "Please tick the box to say we can contact you.";
    setProblems(found);
    if (Object.keys(found).length > 0) return;

    setFailure(null);
    setSubmitting(true);
    const trimmed = { ...details, firstName: details.firstName.trim(), lastName: details.lastName.trim(), email: details.email.trim() };
    const result = await submitSignup(trimmed, download);
    if ("error" in result) {
      setFailure(result.error);
      setSubmitting(false);
      return;
    }
    draft = null;
    onComplete(trimmed, result.token);
  }

  const [before, after] = CONSENT_TEXT.split(CONSENT_PRIVACY_LABEL);

  const problem = (field: Field | "consent") =>
    problems[field] ? <span id={`${field}-problem`} className="mt-1 block text-[11px] text-[#e0908a]">{problems[field]}</span> : null;
  const flag = (field: Field) => ({
    "aria-invalid": problems[field] ? true : undefined,
    "aria-describedby": problems[field] ? `${field}-problem` : undefined,
  });

  return (
    // Absolute rather than fixed, and anchored where the visitor pressed. Framed in
    // an auto-height iframe the page never scrolls, so the frame's viewport is the
    // whole document and a fixed dialog would sit in the middle of a page the host
    // has scrolled away from.
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-[#00060f]/85" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-title"
        style={{ top, maxHeight: pageHeight - 16 }}
        // The reference sheet is not a solid panel: 70% black with a tenth of the light
        // gold laid over it and the page blurred behind, inside a 1px gold rule at a
        // 30px radius. Over our own smoke that reads the same way it does over theirs.
        className="absolute left-1/2 w-[min(100%-1.5rem,860px)] -translate-x-1/2 overflow-y-auto rounded-[30px] border border-[#eee0ca] bg-[rgba(0,0,0,0.7)] bg-[linear-gradient(rgba(238,224,202,0.1),rgba(238,224,202,0.1))] p-6 shadow-[0_24px_60px_rgba(0,0,0,.6)] backdrop-blur-[10px] sm:p-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-[#eee0ca]/40 text-[#eee0ca] hover:border-[#eee0ca] hover:text-white">
          <X className="h-4 w-4" />
        </button>

        <p role="status" className="sr-only">Step {step + 1} of 2</p>

        <form onSubmit={submit} noValidate>
          {step === 0 ? (
            <div className="grid gap-6 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:gap-8">
              <div className="flex flex-col items-center text-center sm:border-r sm:border-[#3a342b] sm:pr-10">
                <img src={BRAND.boxFiveLogo} alt="The Box Five Club" width={1258} height={419} className="h-auto w-[240px]" />
                <h2 id="signup-title" className="boxfive-heading mt-5">Never miss a moment</h2>
                {/* Held back on a phone: the visitor pressed a download to get here, so they
                    already know why they are being asked. The mark and the heading carry the
                    identity, and the fields are what needs to reach the fold. */}
                <p className="mt-4 hidden text-[14px] leading-[1.8] sm:block">
                  Join The Box Five Club for exclusive content, behind-the-scenes access, and the very latest from Phantom of the Opera and the world of Andrew Lloyd Webber Musicals
                </p>
                <a
                  href="https://www.theboxfiveclub.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-[#eee0ca]/50 hover:text-[#eee0ca]">
                  What is The Box Five Club? <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div>
                <label className="block">
                  <span className={LABEL}>First name</span>
                  <input ref={firstFieldRef} value={details.firstName} onChange={(event) => set("firstName", event.target.value)}
                    placeholder="Christine" autoComplete="given-name" className={`${FIELD} mt-2.5`} {...flag("firstName")} />
                </label>
                {problem("firstName")}
                <label className="mt-2.5 block">
                  <span className={LABEL}>Last name</span>
                  <input value={details.lastName} onChange={(event) => set("lastName", event.target.value)}
                    placeholder="Daaé" autoComplete="family-name" className={`${FIELD} mt-2.5`} {...flag("lastName")} />
                </label>
                {problem("lastName")}
                <label className="mt-2.5 block">
                  <span className={LABEL}>Email address</span>
                  <input type="email" value={details.email} onChange={(event) => set("email", event.target.value)}
                    autoComplete="email" className={`${FIELD} mt-2.5`} {...flag("email")} />
                </label>
                {problem("email")}
              </div>
            </div>
          ) : (
            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              <div>
                <label className="block">
                  <span className={LABEL}>Postcode<em className="italic opacity-30">(optional)</em></span>
                  <input ref={firstFieldRef} value={details.postcode} onChange={(event) => set("postcode", event.target.value)}
                    placeholder="eg SW1Y 4QL" autoComplete="postal-code" className={`${FIELD} mt-2.5`} />
                </label>
                <label className="mt-2.5 block">
                  <span className={LABEL}>Country/region<em className="italic opacity-30">(optional)</em></span>
                  <span className="relative mt-2.5 block">
                    <select value={details.country} onChange={(event) => set("country", event.target.value)} className={`${FIELD} pr-9 ${details.country ? "" : "text-white/50"}`}>
                      <option value="">Select a region</option>
                      {options.regions.map((region, index) => <option key={`${region}-${index}`} value={region === "-" ? "" : region} disabled={region === "-"}>{region}</option>)}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#aa9574]" />
                  </span>
                </label>
              </div>

              <div>
                <label className="block">
                  <span className={LABEL}>Favourite musical<em className="italic opacity-30">(optional)</em></span>
                  <span className="relative mt-2.5 block">
                    <select value={details.favouriteMusical} onChange={(event) => set("favouriteMusical", event.target.value)} className={`${FIELD} pr-9 ${details.favouriteMusical ? "" : "text-white/50"}`}>
                      <option value="">Select a show</option>
                      {options.shows.map((show, index) => <option key={`${show}-${index}`} value={show === "-" ? "" : show} disabled={show === "-"}>{show}</option>)}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#aa9574]" />
                  </span>
                </label>

                <fieldset className="mt-2.5">
                  <legend className={LABEL}>Birthday<em className="italic opacity-30">(optional)</em></legend>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    <span className="relative block">
                      <select aria-label="Day of birth" {...flag("birthDay")} value={details.birthDay} onChange={(event) => set("birthDay", event.target.value)} className={`${FIELD} pr-7 ${details.birthDay ? "" : "text-white/50"}`}>
                        <option value="">DD</option>
                        {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                      </select>
                    </span>
                    <span className="relative block">
                      <select aria-label="Month of birth" {...flag("birthDay")} value={details.birthMonth} onChange={(event) => set("birthMonth", event.target.value)} className={`${FIELD} pr-7 ${details.birthMonth ? "" : "text-white/50"}`}>
                        <option value="">Month</option>
                        {MONTHS.map((month, index) => <option key={month} value={String(index + 1).padStart(2, "0")}>{month}</option>)}
                      </select>
                    </span>
                    <span className="relative block">
                      <select aria-label="Year of birth" {...flag("birthDay")} value={details.birthYear} onChange={(event) => set("birthYear", event.target.value)} className={`${FIELD} pr-7 ${details.birthYear ? "" : "text-white/50"}`}>
                        <option value="">YYYY</option>
                        {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
                      </select>
                    </span>
                  </div>
                  {problem("birthDay")}
                </fieldset>

                {/* Unticked, and JOIN NOW refuses without it: a box already ticked is not consent. */}
                <label className="mt-5 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => { setConsent(event.target.checked); setProblems((previous) => ({ ...previous, consent: undefined })); }}
                    aria-describedby={problems.consent ? "consent-problem" : undefined}
                    className="mt-1 h-5 w-5 shrink-0 appearance-none rounded-[2px] border border-[#aa9574] bg-transparent checked:border-[#eee0ca] checked:bg-[#eee0ca] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#eee0ca]"
                  />
                  <span className="text-[14px] leading-[1.8] text-white">
                    {before}
                    <a href={CONSENT_PRIVACY_URL} target="_blank" rel="noreferrer" className="text-[#eee0ca] underline-offset-2 hover:underline">{CONSENT_PRIVACY_LABEL}</a>
                    {after}
                  </span>
                </label>
                {problem("consent")}
              </div>
            </div>
          )}

          {failure && <p role="alert" className="mt-4 text-[12px] text-[#e0908a]">{failure}</p>}

          <div className="mt-7 flex items-center justify-end gap-4">
            {step === 1 && (
              <button type="button" onClick={() => setStep(0)} aria-label="Back to your name and email"
                className="grid h-11 w-11 place-items-center text-[28px] leading-none text-[#eee0ca] hover:text-white">
                ←
              </button>
            )}
            {step === 0 ? (
              // Keyed apart from the submit below. Without that React keeps the one
              // button element and only swaps its type, so the click that advanced
              // the step was still pending on the same node when it became a submit
              // button, and the browser submitted the form the press had just built.
              <button key="next" type="button" onClick={advance}
                className="border border-[#eee0ca] bg-[rgba(238,224,202,0.1)] px-[42px] py-[11.2px] text-[14px] uppercase tracking-[0.2em] text-[#eee0ca] transition-colors hover:bg-[#eee0ca] hover:text-[#00060f]">
                Next →
              </button>
            ) : (
              <button key="join" type="submit" disabled={submitting} aria-busy={submitting}
                className="flex items-center justify-center gap-2 rounded-[5.6px] border border-[#eee0ca] bg-[linear-gradient(72deg,#aa9574,#eee0ca)] px-[42px] py-[11.2px] text-[14px] uppercase tracking-[0.2em] text-[#00060f] transition-opacity hover:opacity-90 disabled:opacity-60">
                {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {submitting ? "Sending" : "Join now"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
