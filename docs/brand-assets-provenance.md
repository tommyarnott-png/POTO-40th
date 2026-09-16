# Official Phantom London visual references

- Official page body background asset: `6994a069135c033f702d007a_london-bg-p-1600.jpg` (1600 × 1158), saved locally as `/home/ubuntu/webdev-static-assets/phantom-official/london-background-texture.png` and `.webp`.
- Official primary logo asset is rendered as `6970aded...phantom logo new white - KLYE-p-500.png` (233 × 70).
- Typefaces on the official page: Jost for headings, navigation, buttons and labels; Montserrat for body copy. Minion Pro variants load there but no text on the London page renders in them. This page sets everything in Jost, body copy included, sized up because Jost's x-height is smaller.
- Primary palette observed: `#00060f`, white, and pale blue `#a5bed3`; gradients use `#6a99ab` to `#a5bed3`.
- The Box Five Club logo is separate and must not be used in the mockup.

The official white production logo was saved at 500 × 151 pixels as `/home/ubuntu/webdev-static-assets/phantom-official/phantom-logo-white.png` and `.webp`. This is the production logo only; the separate Box Five Club asset is excluded.

## Measured from the official London page

Computed styles on https://www.phantomoftheopera.com/london, measured in Chrome on
15 September 2026 at 390, 480, 767, 768, 991, 992, 1024 and 1440px wide. The
rendered faces were confirmed per element with Chrome's platform-font report, not
just read from the stylesheets. Re-measure these if the official site changes;
`src/index.css` and `src/pages/Home.tsx` follow them.

### Typography

| Role (example on the page) | Face | Weight | Size | Line height | Tracking | Case | Colour |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Section heading ("The Phantom Awaits") | Jost | 400 | 22px below 480px; 30px to 767px; `18px + 1vw` from 768px (25.68px at 768, 32.4px at 1440) | 1.0; 0.9 from 992px | 0.15em | upper | gradient text, 27°, `#6a99ab` to `#a5bed3` |
| Tagline ("The Iconic London Home") | Jost | 400 | 20px at 390, 40px at 1440 | 1.1 | 0.1em | upper | `#a5bed3` |
| Subheading ("At His Majesty's Theatre, London") | Jost | 300 | `16px + 0.1vw` below 480px; `18px + 0.1vw` to 991px; `20px + 0.1vw` from 992px | 1.2 | 0.1em; 0.2em from 768 to 991px; 0.15em from 992px | upper | `#fff` |
| h3 ("Watch the Trailer") | Jost | 400 | 19px | 1.0 | 0.1em | upper | `#fff` |
| Body copy | Montserrat | 400, names 700 | 12px below 480px; 14px above | 1.8 | normal | none | `#fff`, justified |
| Navigation | Jost | 400 | 13.44px | 1.3 | 0.1em | upper | `#fff` |
| Buttons | Jost | 400 | 14px | 1.5 | 0.2em | upper | `#00060f` on the primary, `#a5bed3` on the secondary |
| News card headline | Jost | 400 | 12.8px | 1.4 | 0.06em | upper | `#fff` |
| Form labels | Jost | 400 | 12px | 1.0 | 0.1em | upper | `#fff` |
| Small print (copyright) | Montserrat | 400 | 11px | 2.0 | normal | none | `#fff` |

This page sets its body copy in Jost at 14px below 480px and 16px above, with a
1.8 line height. Jost's x-height is 0.460em against Montserrat's 0.525em, so Jost
at 16px matches Montserrat at 14px in apparent size.

### Colour and surfaces

- **Page base:** `#00060f`.
- **Header:** `#00040a` with a `#00060f`-to-transparent gradient at 76%, a 1px
  `#3b4154` rule below, and a `rgba(238,224,202,.1)` rule above the navigation.
- **Footer:** `#00040a` with a gradient to `#0b0f23`.
- **Accents:** `#a5bed3` and `#6a99ab`, used as gradients at 27°, 70° and 72°.
- **Rules and card borders:** 1px `#3b4154`. Card fill `rgba(238,224,202,.1)`.
  Panels cast `rgba(0,0,0,.3) 0 18px 18px`.
- **Primary button:** a 72° `#6a99ab`-to-`#a5bed3` gradient, 1px `#a5bed3`
  border, 5.6px radius, 45px tall at 1440px (11.2px by 42px padding), 36px below
  992px.
- **Secondary button:** `rgba(42,75,90,.38)` with a 1px `#a5bed3` border, 5.6px
  radius and a 10px backdrop blur.
- **Corners:** 5.6px on buttons, square on cards and panels, round on icon links.
- **Gold:** never in the *page* chrome — but the Box Five signup that the page
  carries is gold throughout. See "The Box Five signup" below; do not assume the
  site's blue accents apply inside that form.
- **Imagery behind text:** a fixed full-bleed photograph at 50% opacity (60% at
  390px), a 260° side vignette from black to transparent at 35% and 65%, and
  black gradients at 0.7 over image cards. Copy carries no text shadow.

### Wordmark

The wordmark is an image linking to the site's root: 273 × 83px, centred in a
110px header row, from 992px; 199px wide and left-aligned from 768px; 174px at
767px, 152px at 480px and 116px at 390px. The site serves PNG variants and puts
the 6543px AVIF only at the top of its `srcset`.


## The Box Five signup

Measured from the form itself on 16 September 2026, at 1280px, with computed styles
read from the elements inside `form#wf-form-BoxFiveZapier` and confirmed against
screenshots. `src/components/SignupModal.tsx` follows these.

**Which form.** Three surfaces carry a Box Five signup and they are not all the same:

| Surface | Form |
| --- | --- |
| `phantomoftheopera.com` (homepage) | the modal below — two instances, one behind a Turnstile |
| `phantomoftheopera.com/london` | the same modal, byte-identical copy (diffed) |
| `theboxfiveclub.com` → redirects to `andrewlloydwebber.com/box-five` | **a different design**: fully-boxed fields outlined on all four sides, a navy ground, a solid navy NEXT pill, and its own paragraph copy |

The modal is the one this page models. Note the redirect: `theboxfiveclub.com` does
not serve a Box Five form of its own.

**Palette.** Two golds, and they are *not* the site's `#6a99ab`/`#a5bed3`:

- `#aa9574` — the dark gradient stop, and every field's resting hairline.
- `#eee0ca` — the light stop, the button/rule/link colour, and at a tenth
  (`rgba(238,224,202,.1)`) the fill on every surface.

Only the gradient *angles* are shared with the site: 70° on the heading, 72° on the
primary button, the same angles its blue gradients use. Reading the angles and the
`rgba(238,224,202,.1)` fill as confirmation that the rest matches the site's palette
is the trap — it is how an earlier pass recorded this form as blue-grey.

| Element | Measured |
| --- | --- |
| Sheet | `rgba(0,0,0,.7)` under a flat `rgba(238,224,202,.1)` wash, 1px `#eee0ca`, 30px radius, `backdrop-filter: blur(10px)`, 1154px at 1280 |
| Heading | Jost 19px/19px, 1.9px tracking, uppercase, `linear-gradient(70deg,#aa9574,#eee0ca)` clipped to the text |
| Paragraph | Montserrat 14px/25.2px, white |
| "What is The Box Five Club?" | Montserrat 11px, `#eee0ca` at opacity **0.5** |
| Label | Jost 12px/12px, 1.2px tracking, uppercase, white, `display: flex` |
| "(OPTIONAL)" | Jost 12px/12px **italic**, uppercase, white at opacity **0.3**, no preceding space |
| Field | 49px tall, 8px/12px padding, fill `rgba(238,224,202,.1)`, bottom border 1px `#aa9574`, square, 10px below each |
| Placeholder | `rgba(255,255,255,.5)` |
| Consent checkbox | 20 × 20, 2px radius, 1px `#aa9574`, transparent fill |
| Consent copy | Montserrat 14px/25.2px white; its link `#eee0ca`, undecorated — the same size as the paragraph, not smaller |
| NEXT | 11.2px/42px padding, **square**, 1px `#eee0ca`, fill `rgba(238,224,202,.1)`, text `#eee0ca`, Jost 14px, 2.8px tracking |
| JOIN NOW | same padding, **5.6px radius**, 1px `#eee0ca`, `linear-gradient(72deg,#aa9574,#eee0ca)`, text `#00060f` |
| Column rule | 1px `#3a342b` — warm brown, not the site's `#3b4154` |
| Back arrow | `#eee0ca`, 28px |
| Logo | `BoxFive-Logo-GoldGradient.svg`, 240 × 80. `public/images/boxfive-logo.svg` is this file, byte for byte (sha256 `983b82cf…`) |

**Focus.** The reference does not change the hairline on focus and sets no outline,
so a keyboard user gets no indication at all. This page brightens the hairline to
`#eee0ca` instead — a deliberate departure, and the only one in the treatment.

**Typeface.** The reference sets labels and buttons in Jost and everything else in
Montserrat. This page self-hosts Jost only and sets the whole form in it, by
instruction. Jost's smaller x-height means body copy reads a little smaller at the
same pixel size; the sizes above are the reference's and are kept.
