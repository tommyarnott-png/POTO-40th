/**
 * The marketing consent wording, shared by the form that shows it and the Worker
 * that stores it, so the text written to a row is the text the visitor read.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ UNFINISHED. Two placeholders below must be replaced before this page is    │
 * │ shown to the public. Who controls this data is unresolved and the operator │
 * │ is supplying the final wording; do not guess a company name and do not     │
 * │ invent a privacy policy URL. They render on screen exactly as written, so  │
 * │ an unfilled placeholder is visible in the modal rather than hidden here.   │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
export const CONSENT_CONTROLLER = "[[DATA CONTROLLER — TO BE SUPPLIED]]";
export const CONSENT_PRIVACY_URL = "[[PRIVACY POLICY URL — TO BE SUPPLIED]]";

/** Kept as one string: it is stored verbatim per signup, so it has to be quotable. */
export const CONSENT_TEXT =
  `I agree to be contacted about Andrew Lloyd Webber, his shows, theatres and ` +
  `related goods and services. I can unsubscribe at any time. My data is ` +
  `processed by ${CONSENT_CONTROLLER} in accordance with its privacy policy ` +
  `(${CONSENT_PRIVACY_URL}).`;

/** Which offer a signup came for. The column keeps the two apart. */
export type DownloadKind = "stem-pack" | "mix";
