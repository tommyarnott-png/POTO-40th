/**
 * The three physical releases the page offers at its foot, and the live read of
 * what the shop says each one costs and whether it can be bought.
 *
 * Nothing about a price is written into the page. A price in the production's own
 * name that disagrees with the shop would be worse than no price at all, so the
 * page asks the shop at every visit and shows nothing when the answer does not
 * arrive or does not make sense (see loadProductDetails).
 */

import { PRODUCT_SHOTS } from "@/assets";

/* ------------------------------------------------------------------------- *
 * Store configuration — the only place a store is named.
 *
 * To sell from a different store, change STORE_ORIGIN and the three handles in
 * STORE_HANDLES; a handle is the last part of a product's own URL. Nothing else
 * in the page names a store, and both the links and the live read follow from
 * these. Check three things against the new store when you do:
 *
 * - **It answers cross-origin.** Shopify's Storefront API does, on any store,
 *   without a token; other shop software may not, and then the cards keep their
 *   images, names and links and simply show no prices.
 * - **STORE_COUNTRY is a market it sells in**, since that is the market every
 *   price is read in. An unknown country falls back to the store's own currency,
 *   which STORE_CURRENCY would then no longer match, and the prices would be
 *   dropped rather than shown wrongly.
 * - **PREORDER_TAG still marks what the store badges as a pre-order.** On
 *   uk.andrewlloydwebber.shop the badge follows this tag exactly, across all 53
 *   products; another store tags differently, and its sibling US and EU stores
 *   already do.
 * ------------------------------------------------------------------------- */

const STORE_ORIGIN = "https://uk.andrewlloydwebber.shop";

const STORE_HANDLES = {
  boxset: "phantom-of-the-opera-a-collector-s-piece-indeed",
  vinyl: "the-phantom-of-the-opera-the-andrew-lloyd-webber-2026-mix-3lp",
  cd: "the-phantom-of-the-opera-the-andrew-lloyd-webber-2026-mix-2cd",
} as const;

/**
 * The market prices are read in, and the currency that market must answer in.
 *
 * The store sells to 237 countries in 107 currencies, and Shopify picks one from
 * the visitor's own location. Our fetch carries no session, so an unpinned read
 * would hand a visitor in Tokyo a price in yen that this page has no way to
 * recognise as such. Pinning the market to the United Kingdom makes every visitor
 * see the same pounds, and makes a price in any other currency a fault to be
 * dropped rather than a number to be mislabelled.
 */
const STORE_COUNTRY = "GB";
const STORE_CURRENCY = "GBP";

/** What the store tags a product with while it is on pre-order. */
const PREORDER_TAG = "preorder";

/**
 * The Storefront API version. Shopify supports each for a year — 2026-07 until
 * 16 July 2027 — and answers an out-of-support version with the oldest one it
 * still serves, so a stale version here is not an outage, but move it on when
 * convenient. Shopify documents this API as the supported way to read a store
 * from another site; the Ajax endpoints a theme uses are not.
 */
const STORE_API_VERSION = "2026-07";

export type Product = {
  id: keyof typeof STORE_HANDLES;
  /** The line above the name: what you actually receive. */
  format: string;
  name: string;
  url: string;
  art: (typeof PRODUCT_SHOTS)[keyof typeof PRODUCT_SHOTS];
};

/**
 * Card order, dearest first. The names are the page's own: the store's titles run
 * to "THE PHANTOM OF THE OPERA (THE ANDREW LLOYD WEBBER 2026 MIX) (3LP)", which
 * wraps to four or five lines in a card and repeats what the page around it has
 * said three times over. The format line carries the part that tells the three
 * apart, so the two 2026 Mix cards are not two identical headings.
 */
export const PRODUCTS: Product[] = [
  { id: "boxset", format: "6LP box set", name: "A Collector’s Piece Indeed", url: `${STORE_ORIGIN}/products/${STORE_HANDLES.boxset}`, art: PRODUCT_SHOTS.boxset },
  { id: "vinyl", format: "3LP vinyl", name: "The Andrew Lloyd Webber 2026 Mix", url: `${STORE_ORIGIN}/products/${STORE_HANDLES.vinyl}`, art: PRODUCT_SHOTS.vinyl },
  { id: "cd", format: "2CD", name: "The Andrew Lloyd Webber 2026 Mix", url: `${STORE_ORIGIN}/products/${STORE_HANDLES.cd}`, art: PRODUCT_SHOTS.cd },
];

export type ProductDetail = {
  /** Already formatted, because only this module knows which currency it is in. */
  price: string;
  preorder: boolean;
  soldOut: boolean;
};

type ProductNode = {
  availableForSale?: boolean;
  tags?: string[] | null;
  priceRange?: {
    minVariantPrice?: { amount?: string; currencyCode?: string };
    maxVariantPrice?: { amount?: string };
  };
};

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: STORE_CURRENCY });

/**
 * Reads one product's answer, or nothing at all.
 *
 * Every way this can go wrong ends the same way — no price on that card — because
 * the alternatives are worse: a product that has been renamed comes back as null,
 * a field the store stops sharing comes back as null beside the rest, and a price
 * in another currency would be a right number under the wrong sign.
 */
function readDetail(node: ProductNode | null): ProductDetail | null {
  const price = node?.priceRange?.minVariantPrice;
  const amount = Number(price?.amount);
  if (!node || price?.currencyCode !== STORE_CURRENCY || !Number.isFinite(amount) || amount <= 0) return null;

  // Variants at different prices are worth saying out loud rather than quoting the
  // cheapest as the price.
  const highest = Number(node.priceRange?.maxVariantPrice?.amount);
  const formatted = money.format(amount);

  return {
    price: Number.isFinite(highest) && highest > amount ? `From ${formatted}` : formatted,
    preorder: Array.isArray(node.tags) && node.tags.includes(PREORDER_TAG),
    // Sold out is the safer of the two labels and takes precedence in the card.
    soldOut: node.availableForSale === false,
  };
}

/**
 * Asks the store about all three releases in one request.
 *
 * It resolves with whatever it could read: a product it could not read is left
 * out, and a request that fails rejects, which the page treats the same way — the
 * card keeps its image, its name and its link, and says nothing about price.
 */
export async function loadProductDetails(): Promise<Record<string, ProductDetail>> {
  const fields = "availableForSale tags priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount } }";
  const query = `query @inContext(country: ${STORE_COUNTRY}) { ${PRODUCTS.map((product) => `${product.id}: product(handle: "${STORE_HANDLES[product.id]}") { ${fields} }`).join(" ")} }`;

  const response = await fetch(`${STORE_ORIGIN}/api/${STORE_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = (await response.json()) as { data?: Record<string, ProductNode | null> };

  const details: Record<string, ProductDetail> = {};
  PRODUCTS.forEach((product) => {
    const detail = readDetail(body.data?.[product.id] ?? null);
    if (detail) details[product.id] = detail;
  });
  return details;
}
