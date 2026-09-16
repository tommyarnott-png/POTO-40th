/**
 * The marketing consent wording, shared by the form that shows it and the Worker
 * that stores it, so the text written to a row is the text the visitor read.
 *
 * Taken verbatim from the Box Five Club signup on the official London page, which
 * is where this capture is merged, so the two records say the same thing. The
 * label is separated out only so the form can hang the link on it; the sentence
 * reads the same either way and is stored whole.
 */
export const CONSENT_CONTROLLER = "LW Entertainment Ltd";
/** Where the official site's own footer points. Checked: resolves 200, no redirect. */
export const CONSENT_PRIVACY_URL = "https://www.andrewlloydwebber.com/privacy";
export const CONSENT_PRIVACY_LABEL = "Privacy Policy";

/** Kept as one string: it is stored verbatim per signup, so it has to be quotable. */
export const CONSENT_TEXT =
  `Please contact me with information about Andrew Lloyd Webber, his shows, ` +
  `theatres and related goods and services. You can unsubscribe at any time. ` +
  `All data supplied is processed by ${CONSENT_CONTROLLER} in accordance with ` +
  `its ${CONSENT_PRIVACY_LABEL}.`;

/** Which offer a signup came for. The column keeps the two apart. */
export type DownloadKind = "stem-pack" | "mix";
