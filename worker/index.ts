/**
 * The site's Worker: the signup behind both downloads, and gated delivery of the
 * stem archive.
 *
 * Everything else the site serves is a static asset and never reaches this script.
 * Only `/api/*` is routed here ahead of the assets — see `run_worker_first` in
 * wrangler.jsonc — because the SPA fallback answers anything that misses an asset
 * with index.html and a 200, which would hand the signup POST a page of HTML.
 *
 * The browser holds no Supabase key, no Supabase URL and no project ref, and never
 * speaks to Supabase. It posts here; this inserts with the service key over the
 * REST API, never a Postgres connection, since a Micro instance's connection limit
 * is exhaustible by a traffic spike and HTTP has nothing to exhaust.
 */
import { CONSENT_TEXT } from "../src/consent";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  DOWNLOAD_TOKEN_SECRET: string;
  DOWNLOADS: R2Bucket;
  SIGNUP_LIMITER: RateLimit;
}

type DownloadKind = "stem-pack" | "mix";

/** Where the archive sits in the bucket, and what a visitor's browser calls it. */
const STEM_PACK_KEY = "GroupedStems-ForWebsite.zip";
const STEM_PACK_FILENAME = "phantom-of-the-opera-40th-stems.zip";

/** Long enough to start a 220MB download, short enough that a shared link is stale. */
const TOKEN_TTL_SECONDS = 15 * 60;

const LIMITS = {
  firstName: 100,
  lastName: 100,
  email: 254,
  postcode: 32,
  country: 100,
  favouriteMusical: 200,
} as const;

const ALLOWED_FIELDS = new Set([
  "firstName", "lastName", "email", "postcode", "country", "favouriteMusical",
  "birthDay", "birthMonth", "birthYear", "marketingConsent", "download",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

async function sign(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))));
}

/** Compared without an early exit, so a wrong signature takes the same time as a right one. */
function sameSignature(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/**
 * The network a request came from rather than the exact address it came from: the
 * first three octets of an IPv4 address, the first three hextets of an IPv6 one —
 * a /24 and a /48.
 *
 * Binding to the whole address refused ordinary behaviour. Measured: IPv6 privacy
 * extensions rotate the interface identifier, and NAT pools vary the host within a
 * subnet, either of which could leave a visitor holding an authorisation their own
 * next request is refused — including the shape where the availability check
 * passes and the download that follows it does not. A prefix still refuses a link
 * opened on a different network, which is the thing worth refusing.
 *
 * IPv6 is expanded before it is cut, because `2001:db8::1` and `2001:db8:0:1::1`
 * share a /48 but not a prefix of their written form.
 */
function network(address: string) {
  if (!address.includes(":")) return address.split(".").slice(0, 3).join(".");
  const [head, tail = ""] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = [...left, ...new Array(8 - left.length - right.length).fill("0"), ...right];
  return groups.slice(0, 3).map((group) => group.padStart(4, "0")).join(":");
}

/**
 * The authorisation the signup hands back. It carries its own expiry and the
 * download it is for, and it is signed over the caller's network as well, so it
 * verifies without a database lookup and is not simply pasteable to somebody who
 * never filled the form in. The network is hashed into the signature and never
 * stored — the table has no column for it.
 */
async function issueToken(env: Env, download: DownloadKind, address: string) {
  const claims = { d: download, e: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const payload = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  return { token: `${payload}.${await sign(env.DOWNLOAD_TOKEN_SECRET, `${payload}.${network(address)}`)}`, expiresAt: claims.e };
}

async function readToken(env: Env, token: string, address: string): Promise<DownloadKind | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  // Checked before the payload is read, so only something this Worker signed is parsed.
  if (!sameSignature(signature, await sign(env.DOWNLOAD_TOKEN_SECRET, `${payload}.${network(address)}`))) return null;
  const claims = JSON.parse(fromBase64url(payload)) as { d: unknown; e: unknown };
  if (typeof claims.e !== "number" || claims.e * 1000 < Date.now()) return null;
  return claims.d === "stem-pack" || claims.d === "mix" ? claims.d : null;
}

type Row = {
  first_name: string;
  last_name: string;
  email: string;
  postcode: string | null;
  country: string | null;
  favourite_musical: string | null;
  date_of_birth: string | null;
  marketing_consent: true;
  consent_text: string;
  download: DownloadKind;
};

/** Trims, bounds and returns a value, or undefined when it is absent or blank. */
function optional(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return trimmed.length > max ? null : trimmed;
}

function required(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" || trimmed.length > max ? null : trimmed;
}

/** Only a complete, real date counts. A day and a month with no year is not one. */
function birthday(day: unknown, month: unknown, year: unknown) {
  const parts = [day, month, year];
  if (parts.every((part) => part === undefined || part === null || part === "")) return { date: null as string | null };
  if (!parts.every((part) => typeof part === "number" && Number.isInteger(part))) return { invalid: true };
  const [d, m, y] = parts as number[];
  const thisYear = new Date().getUTCFullYear();
  if (y < 1900 || y > thisYear || m < 1 || m > 12 || d < 1 || d > 31) return { invalid: true };
  // Round-trip so that a 31st of February is refused rather than rolled forward.
  const built = new Date(Date.UTC(y, m - 1, d));
  if (built.getUTCFullYear() !== y || built.getUTCMonth() !== m - 1 || built.getUTCDate() !== d) return { invalid: true };
  return { date: built.toISOString().slice(0, 10) };
}

function validate(body: Record<string, unknown>): { row: Row } | { error: string } {
  for (const field of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(field)) return { error: "Unexpected field in submission." };
  }

  const firstName = required(body.firstName, LIMITS.firstName);
  const lastName = required(body.lastName, LIMITS.lastName);
  const email = required(body.email, LIMITS.email);
  if (!firstName || !lastName || !email) return { error: "Please give your first name, last name and email address." };
  if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email)) return { error: "That email address doesn't look right." };

  if (body.marketingConsent !== true) return { error: "Please tick the box to say we can contact you." };

  const download = body.download;
  if (download !== "stem-pack" && download !== "mix") return { error: "Unknown download requested." };

  const postcode = optional(body.postcode, LIMITS.postcode);
  const country = optional(body.country, LIMITS.country);
  const favouriteMusical = optional(body.favouriteMusical, LIMITS.favouriteMusical);
  if (postcode === null || country === null || favouriteMusical === null) return { error: "One of the optional fields is too long." };

  const born = birthday(body.birthDay, body.birthMonth, body.birthYear);
  if ("invalid" in born) return { error: "Please give a complete birthday, or leave all three parts blank." };

  return {
    row: {
      first_name: firstName,
      last_name: lastName,
      // Stored lowercased so the email index is useful when the list is merged.
      email: email.toLowerCase(),
      postcode: postcode ?? null,
      country: country ?? null,
      favourite_musical: favouriteMusical ?? null,
      date_of_birth: born.date,
      marketing_consent: true,
      // Taken from the shared module rather than the request, so the row records
      // the wording this build actually showed and a caller cannot claim otherwise.
      consent_text: CONSENT_TEXT,
      download,
    },
  };
}

async function signup(request: Request, env: Env, address: string) {
  if (Number(request.headers.get("content-length")) > 4096) return json({ error: "That submission is too large." }, 413);

  const { success } = await env.SIGNUP_LIMITER.limit({ key: address });
  if (!success) return json({ error: "Too many attempts just now. Please wait a moment and try again." }, 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "That submission couldn't be read." }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return json({ error: "That submission couldn't be read." }, 400);

  const checked = validate(body as Record<string, unknown>);
  if ("error" in checked) return json({ error: checked.error }, 400);

  const inserted = await fetch(`${env.SUPABASE_URL}/rest/v1/signups`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(checked.row),
  });

  if (!inserted.ok) {
    // To the logs, not to the visitor: the reason may name the table or the key.
    console.error("signup insert failed", inserted.status, await inserted.text());
    return json({ error: "We couldn't save your details just now. Please try again." }, 502);
  }

  return json({ download: checked.row.download, ...(await issueToken(env, checked.row.download, address)) });
}

/**
 * HEAD answers the same checks without the body, so the page can find out whether
 * the archive is there before it starts a 220MB transfer. Without it a refusal
 * would arrive as a link click and be saved as a file full of JSON.
 */
async function download(url: URL, env: Env, address: string, bodyWanted: boolean) {
  const kind = await readToken(env, url.searchParams.get("token") ?? "", address);
  if (kind !== "stem-pack") return json({ error: "That download link has expired. Please request it again." }, 403);

  const object = bodyWanted ? await env.DOWNLOADS.get(STEM_PACK_KEY) : await env.DOWNLOADS.head(STEM_PACK_KEY);
  if (!object) return json({ error: "The stem pack isn't available yet." }, 404);

  // The body is a stream: the Worker passes bytes through rather than holding the
  // archive, so its size is not a memory question.
  return new Response(bodyWanted ? (object as R2ObjectBody).body : null, {
    headers: {
      "content-type": "application/zip",
      "content-length": String(object.size),
      "content-disposition": `attachment; filename="${STEM_PACK_FILENAME}"`,
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const address = request.headers.get("cf-connecting-ip") ?? "unknown";

    if (url.pathname === "/api/signup") {
      return request.method === "POST" ? signup(request, env, address) : json({ error: "Method not allowed." }, 405);
    }
    if (url.pathname === "/api/download") {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed." }, 405);
      return download(url, env, address, request.method === "GET");
    }
    return json({ error: "Not found." }, 404);
  },
};
