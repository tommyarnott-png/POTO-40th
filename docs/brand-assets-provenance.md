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
- **Gold:** only in the Box Five Club logo artwork, never in the page chrome.
- **Imagery behind text:** a fixed full-bleed photograph at 50% opacity (60% at
  390px), a 260° side vignette from black to transparent at 35% and 65%, and
  black gradients at 0.7 over image cards. Copy carries no text shadow.

### Wordmark

The wordmark is an image linking to the site's root: 273 × 83px, centred in a
110px header row, from 992px; 199px wide and left-aligned from 768px; 174px at
767px, 152px at 480px and 116px at 390px. The site serves PNG variants and puts
the 6543px AVIF only at the top of its `srcset`.
