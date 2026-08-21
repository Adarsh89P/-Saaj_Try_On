# Saaj Try-On

In-shop virtual try-on kiosk, built from the **Virtual Try-On** screen of the
*Saaj Fashion House Mobile App* Claude Design project. Installable PWA — runs
full-screen on an Android tablet or an iPad, works offline, stores everything
on the device.

Two surfaces on one install:

| Surface | Where | Who |
| --- | --- | --- |
| Customer kiosk | `/` | The person in the shop |
| Staff area | `/#/admin` (PIN, default `2468`) | Shop staff |

## The customer flow

Home → take photo → preview → collection → product → try-on → result →
my selection → pickup code → finish and clear.

Everything the design specified is here: the photo guide with its three tips,
the before/after compare tabs, "try the next one on", the saved selection with
live stock labels, and the pickup code the staff desk looks up.

**Privacy is enforced, not just promised.** The customer photo and every
generated try-on live in the device's IndexedDB and are deleted when the
customer taps *Finish and clear* — only the shop's own product photos survive.

## The staff area

- **Catalogue** — add, edit, remove pieces; name, category, colour, price,
  stock, sizes and a garment photo. Replaces the design's placeholder catalogue.
- **Pickups** — every code a customer generated, with its items and total.
  Search a code, mark it collected.
- **Settings** — shop name, staff PIN, privacy note, and the try-on engine.

## Try-on engines

Set in **Staff → Settings**.

**Demo (on device)** — the default. No key, no internet, no cost. It composites
the garment photo over the customer photo and stamps the result
"Demo preview — not a real fit", so the flow, the timing and the whole shop
routine can be tested and staff trained before spending anything. It is *not* a
real fit and the UI says so on the result screen.

**Google Gemini** — real garment transfer. Paste a Gemini API key and the tablet
sends the two photos straight to Google and gets the edited photo back. Each
try-on is billed by Google.

> The key is stored on the tablet and readable by anyone who can open the Staff
> area. Use a key restricted to this shop's billing, and rotate it if the tablet
> is ever lost. With this engine the customer photo does leave the device — the
> photo screen says so when it is switched on.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

```bash
npm run build && npm run preview
```

## Getting it onto the tablet

The camera and PWA install both need a **secure context**. `http://192.168.x.x`
from your laptop will show the app but the camera and the install prompt will be
blocked — so publish it over HTTPS first.

1. Push this folder to a Git repo.
2. Deploy it — on Vercel, import the repo and accept the detected Vite settings
   (`vercel.json` here already handles the SPA rewrite). Netlify works the same
   way; `public/_redirects` covers it.
3. On the tablet, open the HTTPS URL in Chrome (Android) or Safari (iPad).
4. Chrome: menu → **Add to Home screen** / **Install app**.
   Safari: share → **Add to Home Screen**.
5. Launch it from the home screen. It opens full-screen with no browser chrome
   and keeps working if the shop wifi drops.
6. First run: open **Staff → Catalogue**, add photos to the pieces, and set the
   shop name and PIN in **Settings**.

Want a real `.apk` for the Play Store instead? Point
[PWABuilder](https://www.pwabuilder.com) at the deployed URL — it wraps this
same manifest and service worker into a signed Android package.

## Kiosk tips

- Android: Settings → Security → **App pinning**, then pin the installed app so
  customers cannot leave it.
- Turn the screen timeout up, and keep the tablet on the charger.
- Every customer should end with *Finish and clear* — that is what wipes their
  photo.

## Layout

The design system tokens live in `src/styles/tokens.css`, carried over verbatim
from the project's `_ds/organic-…/styles.css`.

```
src/
  App.tsx            screen router + bottom nav
  store.tsx          session state, catalogue persistence, try-on pipeline
  lib/
    db.ts            IndexedDB: products, orders, settings, image blobs
    tryon.ts         the two try-on engines
    image.ts         capture, downscale, encode helpers
    types.ts         data model, defaults, categories
    seed.ts          starting catalogue + pickup-code generator
  components/        Img/Media, Camera
  screens/           the customer flow
  admin/             staff area
scripts/make-icons.mjs   generates the PWA icons as real PNGs
```

The Claude Design source used `<image-slot>`, `ios-frame.jsx` and `support.js`
for its preview — a device bezel and drag-drop placeholders. Those are
preview-only scaffolding and are deliberately not part of this app; real camera
capture and a real catalogue took their place.
