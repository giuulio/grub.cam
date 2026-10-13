# Operations

[AGENTS.md](../AGENTS.md) lists commands and data rules. [README](../README.md#switching-on-sending-in) is the canonical setup guide for Google sign-in, model secrets and publishing. Google sign-in has been on since 12 Oct 2026.

## Ingest and reference data

`scripts/ingest/sources.ts` records one source per venue: channel, URL, cadence, notes and adapter when scripted. Channels are html/json/pdf/sway/canva/app/email/intranet/none. Ingest copies channel, URL and scripted status to `venues.menu_channel/menu_url/menu_scripted` for Coverage; edit these in the source registry, not the dashboard.

Save every available published menu, no matter how far into the future. The scripted sources cover 11 colleges, a separate Magdalene Formal Hall adapter using the same viewthe.menu page as Ramsay Hall, and three University Catering weekly pages through `ucs.ts`. Ingest starts at this week's Monday, or the week containing `--from`, and discovers weeks until the first empty future week, with no fixed lookahead cap. Every published date returned by an adapter is saved, including dates beyond an empty discovery week; repeated whole-source responses replace rather than duplicate dishes. Past empty weeks do not stop backfilling. Jesus, Corpus, Selwyn and Robinson retain historical days. Already saved days remain; a day still listed is replaced with the latest source version. A source returning nothing when it previously had future menus makes the run fail for investigation. The browser's seven-day initial load is only a loading window; later menus are stored and available through the calendar.

`.github/workflows/ingest.yml` runs at 04:37, 06:37, …, 18:37 UTC. Off-peak minutes and repeated runs tolerate GitHub scheduling delays. It also approves trusted contributor submissions and invokes `CF_DEPLOY_HOOK` even if an individual source fails, so successful updates reach prerendered pages. Required repository secrets are `VITE_SUPABASE_URL` and `SUPABASE_SECRET_KEY`; the deploy hook is optional.

Hand-transcribed sources use the same validated formats as submissions. Save text outside the repo, conventionally under `~/grub-data/menus/`, and run `ingest:manual`, `ingest:prices` or `ingest:hours`. Format documentation lives at the top of each script. `--dry` validates without writes. Reference data is edited in Supabase until an editor UI exists; schema changes are migrations.

An explicitly cancelled meal is a dated menu note with no dishes: `2026-10-13 dinner | No dinner – UG freshers formal hall`. `ingest:manual` also recognises that notice on its own line. It preserves the cancellation and rejects contradictory dishes; a blank meal without a cancellation is omitted. Cancellations remove that date's service from opening status without changing the usual weekly hours. A disruption that day is an alert: start the note with `!` (`2026-10-13 lunch | ! Served at the top table after a leak; dishes may change`) and it shows in red instead of as a quiet note (`menu_days.alert`, migration `0035`). Give times in it only if they change that meal's hours. Trinity's public weekly PDFs can retain removed text behind blank meals and cancellation notices: transcribe the rendered page, not the extracted text alone.

Member text and confirmed transcriptions accept up to 20,000 characters. Longer input is rejected with an error rather than silently cut; this also prevents a pasted weekly menu from losing its final day.

Fixed menu items can include a description or choices in the price format's optional fifth field: `Shakshuka | £7.15 | | | Tomato sauce, poached eggs and feta`. This is stored in `venue_prices.description` and displayed beneath the item name. Keep ingredients out of the name when they are printed as a separate description; preserve the source's choices and infer no dietary tags.

Source quirks worth preserving:

- PDFs: `curl -A "Mozilla/5.0" … | pdftotext -layout - -` extracts layout. Sway/Canva can be inspected with headless Chrome's `--dump-dom`.
- Canva's rendered DOM shows only the first page; later text is in JSON `"A":["…"]` runs, with supper blocks before their day labels.
- Lucy Cavendish uses V = vegan and Vn = vegetarian; transcribe explicit `(vegan)` / `(vegetarian)`. Clare Hall's PB means plant-based. Never assume a diet code's meaning.
- St Catharine's PDFs contain the whole four-week cycle and each week's dates. Fitzwilliam and Lucy Cavendish also publish formal menus; save them at service `formal` on the room that holds them.
- Queens' page has a BotDetect CAPTCHA, including in headless Chrome. Members-only sources need a collaborator.
- Magdalene can fail locally because of keychain cross-signed certificates; retry with `NODE_USE_SYSTEM_CA=0`.
- Jesus and Corpus run the same menu app, whose College pages offer dates up to eight weeks ahead. Since 12 Oct 2026 Jesus's endpoint answers any date with a menu (checked into 2035), so both adapters stop at today + 56 days; otherwise discovery never finds an empty week.
- Pembroke's servery page dates every week of its three-week cycle and links each week's PDF once posted: save each PDF for every week it lists.

## Submissions

There are several publication routes: scripted public sources; hand-entered data; trusted contributors' scripts; sender-confirmed menus, price lists and hours; vetted venue photos; and checked reviews. Corrections and anything held back wait for a person. `AUTO_KINDS` (function secret, default `menu,prices,hours`) says which confirmed kinds go up without one; `menu` alone makes prices and hours wait again.

`/send?venue=<id>&kind=menu|prices|hours|photo|other[&topic=…]` links from venue gaps, Coverage and the footer. A correction (`other`, “Report a change”) picks a `topic` (hours, prices, menu, formal, diet, location, closed, other; `0031`), which gap links fill in and the queue shows. Each account may send 12 an hour; the hashed IP is kept but not limited, since a college's Wi-Fi can be one address. `src/lib/submit.ts` shrinks uploaded images to 1600px. The submit function validates a member's bearer token through Auth and requires `@cam.ac.uk`, stores evidence in the private `submissions` bucket and creates a row (`0024`, member identity in `0026`). Contributor-token posts have their own validation. Uploaded board/list photos are private evidence, not public photos.

For menus, price lists and hours, the Responses API produces the ingest text body, whether anything was readable and any uncertainty. The sender can fix and confirm the text, or mark it wrong. A confirmation is queued when its kind publishes automatically (below), otherwise `needs_review`; wrong text waits for a person with that reason. Without a usable model transcription it stays `received`. A reading still unconfirmed after a day (when the sender can no longer confirm it) moves to `needs_review` by pg_cron's hourly `hand_over_unconfirmed()`.

### Member menus

`menuCanGoUp()` queues a confirmed menu when no script fetches the venue's menu and the member has fewer than six queued/approved menu submissions in the preceding 24 hours. `.github/workflows/photos.yml` runs `submissions -- publish`; `menuHold()` checks that it parses, contains dishes, belongs to that venue, is dated yesterday or later in London dates (no future cutoff), and is still not scripted. Failures move to `needs_review` with a reason; passing menus are saved through the manual-menu parser. Historical submissions can still be checked and approved manually.

Rejecting a published member menu removes its days where they still belong to the member-ingest method; a script's or hand-copied menu for those days stays. The same rejection path can remove a contributor's published menu.

### Member price lists and hours

The model reading a price list or hours is given the venue's current list (`currentText()`), so a photo of part of a board or a typed change (“Monday closes at 2”) comes back as the whole list, with the change made. On confirmation, `holdOf()` queues it when the member has sent fewer than six of that kind in 24 hours and, if they changed the reading of a photo, `checkReading()` (the check model, purpose `check_reading`) finds every line on the photo or in the earlier list. `submissions -- publish` (the photos Action) then checks it parses, is for its venue and has no price over £100, keeps the rows it replaces in `submissions.replaced` (`0032`), and saves it. `reject <id>` on a published one puts those rows back, unless the venue's list has been replaced again since.

### Venue photos

A member grants CC BY 4.0 and is credited using their Google account's name (`memberName()`). `vet()` checks that the image is a real photo of the venue, has no recognisable face or unsuitable content, and supplies alt text. Automatic queuing allows fewer than three queued/approved member photos in the preceding 24 hours and no member photo row created for that venue in that window. Failed checks or unavailable models send the photo to `needs_review`.

The submit function starts the publishing workflow for a queued menu or photo through `dispatch_workflow()` (migration 0031, the GitHub token in Vault as `github_dispatch_token`); pg_cron's hourly 23-past start catches missed dispatches. `submissions -- photos` writes image variants to `public/photos` and adds an unapproved row ahead of the venue's older photos. The Action commits the files to main, which starts a deploy. `submissions -- live --wait 720` approves rows only when the site serves their files; otherwise the next run checks again. This preserves the old photo during deployment. Manual approval follows the same path; when approving locally, commit the generated files and run `live` after deployment. Rejecting a photo unapproves it so the previous one can show.

### Review queue and manual approval

`submissions -- list` lists waiting rows; `show <id>` downloads evidence under `~/grub-data/submissions/` and prints the transcription/prompt. When APIs are unavailable, use the prompt from `_shared/formats.ts` with the photo, save the checked text, then `transcribe <id> file.txt` and `approve <id>`.

Approval validates through `parseManual`, `parsePrices` or `parseHours`, using the same database calls as hand ingest (`method: user`, or `contributor`). Menus upsert days; prices replace the list; hours replace slots unless `--keep-hours` is passed; either keeps what it replaced for `reject`. Slot provenance records the submission. Notes (`kind: other`) require acting on the note rather than publishing it with `approve`.

The queue Action (`.github/workflows/queue.yml`) keeps one open “Review queue” issue. Every newly inserted submission starts it through the database (`0033`), including contributor submissions and anything published automatically. `submissions -- notify <issue>` adds one receipt comment per submission, with only its kind, correction topic, venue link and private CLI command. It never copies submitted words, photos, model output or sender details. Subscribe to the issue for GitHub notifications; email delivery follows your GitHub notification settings.

`submissions.notified_at` records successful delivery independently of publication status. A bot comment's submission marker prevents a duplicate if GitHub accepted it but the database acknowledgement failed. Runs are serialised; pg_cron retries outstanding receipts every ten minutes. Existing submissions were marked as the baseline when `0033` was applied, so enabling this does not announce old submissions.

pg_cron also starts the Action at 07:00 and 18:00 UTC. `submissions -- digest` includes kind, venue, age, reason, action commands, held-back review counts and model spend. It excludes personal details, evidence and review words because the repo is public. Review-queue changes trigger a summary comment; spend-only changes do not.

### Contributors and limits

Contributors post their own complete ingest-format transcription with `X-Contributor-Token`. `contributors` stores a SHA-256 token hash, active status and optional allowed sites. Generate 32 random bytes as hex, save `encode(sha256(token), 'hex')`, and give the contributor the raw token. Rows wait as `needs_review`; the ingest Action runs `approve --trusted` and publishes them as method `contributor`. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the HTTP format.

Each member submission accepts one image, at most 5 MB, and each account may make 12 submissions per rolling hour. There is no separate daily upload cap. Automatic publication allows three venue photos, or six each of menus, price lists and hours, per rolling 24 hours; further submissions wait for review. Venue photos also wait if another member photo has been added for that venue in the preceding 24 hours. The function has a honeypot and keeps a salted IP hash for investigation, without limiting a college's shared IP. Review writes have a separate limit. `IP_SALT` is an optional secret used for the hash.

## Models and spending

Secrets are set with `supabase secrets set`; deploy the function with `supabase functions deploy submit`. The implementation and price table live in `_shared/openai.ts`:

| Secret | Purpose/default |
|---|---|
| `OPENAI_API_KEY` | Required for transcription and photo/review checks |
| `OPENAI_MODEL` | Boards, price lists, hours; `gpt-6.1-sol` |
| `OPENAI_CHECK_MODEL` | Venue photo/review checks; `gpt-6-luna` |
| `OPENAI_PRICE`, `OPENAI_CHECK_PRICE` | Override dollars per million input/output tokens, e.g. `2/10`; required for cost accounting when the model is absent from `priceOf()` |
| `OPENAI_REASONING` | Optional reasoning effort for both models |
| `LLM_DAILY_USD` | Optional application daily spend check; unset means unlimited |

Model defaults are implementation choices, not a measured board-accuracy result. Compare on real board photos beside hand-checked `.txt` transcriptions with `npm run models:compare -- <dir> --model gpt-6.1-sol --model gpt-6-luna`. It scores lines and reports cost and time. Per-board cost depends on the image and output; do not treat it as a fixed price.

Successful model responses are logged in `model_calls` (`0029`) with purpose, model, token usage, cost and whether the answer was useful. The application has no monthly cap. To stop calls at a monthly amount, configure the OpenAI project's spend limit and enable **Enforce a hard limit**; an alert threshold alone allows traffic to continue. Enforcement can lag slightly. See [OpenAI's spend-limit guide](https://developers.openai.com/api/docs/guides/spend-limits).

`LLM_DAILY_USD` checks logged spend before a call; it is not a reservation and concurrent/in-flight calls can exceed it. When a key is absent, a spending check stops a call or the API fails, transcriptions and checks fall back to the human queue. Rating-only reviews need no model. Review words also use `omni-moderation-latest`, so allow that model if the OpenAI project restricts model usage.

## Reviews

Migration `0030` provides one review per member/venue, with a 1–5 rating and optional text up to 1,000 characters. Writes go through `submit` (`action: review`); members can edit or withdraw their own review. A rating alone is published directly. Words must pass moderation and the check model's test that they concern the venue and name or attack no one; otherwise they wait as `needs_review`. A hidden review stays hidden after author edits. The function limits members to 20 review writes in the preceding 24 hours.

The public `venue_ratings` and `venue_reviews` views show a venue only after five published reviews and expose no author; the threshold cannot be bypassed through the public views. Members read their own reviews through RLS. Ratings load with the initial data (optionally, so missing review tables do not break the site); written reviews load on demand via `useReviews()`.

Use `npm run reviews -- list [--all]`, `approve <id>` or `hide <id> "why"`. The private command prints words and author; the public queue issue does not.

## Photos

`VenueImage` uses the first approved venue photo by position, or the type tile when none exists or loading fails. Site images use their photo or a mortarboard/building tile. Venue photos appear in banners, finder/site rows, credits and `og:image`; site photos appear in their banner, credits and `og:image`. Credits include author, licence deed and source; member banner credit overlays the photo.

Files live at `public/photos/<site>/<venue>/<id>-<width>.webp`; site photos use `<site>/<id>`. Variants are 240/480/960/1600px, never upscaled, upright and stripped of metadata. Paths are never reused and are cached immutably (`public/_headers`). `photos` (`0018`, expanded for sites in `0025`) stores subject, path, widths, size, average colour, alt text, credit, licence and source. Only approved rows are readable. `VITE_PHOTOS_URL` can move serving to a separate host; files otherwise use the site's own `/photos`, preserving Supabase's shared free egress.

`ingest:photo` accepts a venue id or site slug and a local file, Commons page URL or `File:Name.jpg`. For Commons it reads author, licence and source, refusing anything outside CC0, public domain, CC BY and CC BY-SA. `--list file` ingests a batch and skips saved entries; `photos-commons.txt` and `photos-sites-commons.txt` record sources. Manual ingest approves the row immediately, so commit/deploy files promptly. Member photos use the staged approval workflow above. Menu-board photos (`kind: menu`) are evidence and are not shown.

## Accounts

For current status and all setup steps, see [README](../README.md#switching-on-sending-in). Reading needs no account. Members sign in with Google: every member has a CRSid@cam.ac.uk Google Workspace account, and UIS documents this as "Raven OAuth2" for sites outside UIS, registered with an ordinary Google account and no approval. `signIn()` passes `hd: cam.ac.uk` so Google offers that account; `hd` is only a hint, so the database's check is what enforces it. Microsoft (Entra) was dropped on 12 Oct 2026: UIS registers apps for Cambridge's tenant through its Application Factory and an allowlist, so an outside app likely needs their approval, and the maintainer's account could not register apps.

`npm run auth:google` uses the Management API to configure the provider and redirect URLs. `-- --check` reads config only; it does not prove end-to-end sign-in works. `useSignInEnabled()` reads `/auth/v1/settings` and hides sign-in offers until enabled. The account button returns to the page it started from; `SignInError` displays `error_description` under the header.

`submit` has `verify_jwt = false` in `supabase/config.toml` because it validates user bearer tokens through Auth itself and separately supports contributor tokens. Migration `0026` rejects new auth users outside `@cam.ac.uk`; `isCamEmail()` checks on the client too. Regular member sign-in uses Google, not email magic links. The email provider stays on (signups need confirmation, so it gives no way in) because the smoke test signs in through it.

`submissions -- smoke [--venue v] [--photo f.jpg] [--review]` checks the deployed function without Google using an admin-created throwaway account (no email sent). It sends a typed menu and marks it wrong, optionally vets a venue photo then rejects it, and saves/removes a review. It deletes the account, submissions and evidence afterwards; model-call logs remain. It checks the submission API, not Google's OAuth flow or a full publication/deploy cycle.

## Deployment and indexing

Cloudflare Worker `grub-cam` serves static `dist/` through `wrangler.jsonc`, with no script and no SPA fallback. Each route is a real file (`/jesus/caff` → `jesus/caff.html`); `404.html`, `_headers` and `_redirects` control missing pages and static behaviour. Every main push runs `npm run build` then `npx wrangler deploy` through Workers Builds.

Set build variables under Settings → Build → Variables and secrets, not runtime variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, optional `VITE_MAPKIT_TOKEN`, optional `INDEXNOW_KEY`, optional `GITHUB_TOKEN`. The header's star count is read at build time; unsigned, GitHub allows 60 calls an hour per address, which Cloudflare's shared build machines often use up, so the count drops out. `GITHUB_TOKEN` is a fine-grained token with public-repository read access only; a build that can't read the count logs why. The last is 8–128 hex characters (`openssl rand -hex 16`); builds write `/<key>.txt` and submit page URLs to IndexNow. Without it, no IndexNow request is sent. Google uses the sitemap: verify a Search Console Domain property with Cloudflare DNS and submit `sitemap.xml`; Bing Webmaster Tools can import that property. Since 12 Oct 2026: a Search Console Domain property (its TXT record: `dig +short TXT grub.cam`) with `https://grub.cam/sitemap.xml` submitted (a Domain property needs the full URL), Bing Webmaster Tools imported from it, and `INDEXNOW_KEY` set.

DNS is on Cloudflare, registered through Porkbun; the domain is attached to the Worker and www redirects to it. A Workers Builds deploy hook saved as repository secret `CF_DEPLOY_HOOK` rebuilds after ingest. Publishing member photos commits files, triggering its own build; the menu publishing step updates live data. Prerendered pages remain as fresh as their last build, and newly added venue URLs 404 until built.

`scripts/prerender.ts` also writes `sitemap.xml`, `llms.txt` and `llms-full.txt`; `robots.txt` is served from public assets. Only pages that show a menu carry `<lastmod>` (the build date); the rest have none, since a date that is always today teaches Google to ignore it. `SITE_URL` in `src/lib/site.ts` defines the canonical origin. Page titles and descriptions live in `seo.ts`; keep venue/site context and Cambridge before the site brand. Preserve `splitHoisted()` so React's title and image preload both reach `<head>` regardless of their order.

## Map configuration and new coordinates

MapKit JS tokens are configured in Apple Developer → Services → Maps → Configure → Tokens and set as `VITE_MAPKIT_TOKEN` in build/local environments. Domain-restricted tokens match exactly; list multiple domain tokens comma-separated and `pickToken()` selects one. Local development uses a separate unrestricted token in `.env.development.local`. Missing/refused tokens fall back to OpenFreeMap. Optional `VITE_MAP_LIGHT_STYLE_URL` / `VITE_MAP_DARK_STYLE_URL` override fallback styles; `VITE_MAP_STYLE_URL` supplies an override for either theme without its own override.

For new coordinates, first identify the venue's building from a college/University source. Query the University map's `UoCUniMapBuildingsGroup_View` layer with point-in-polygon (`geometry=lon,lat&spatialRel=esriSpatialRelIntersects`), then store the building's latitude/longitude and its `objectIds=` query URL as the location source. Migrations `0012`, `0013`, `0015`, `0019` record earlier research. An OpenStreetMap building outline can supply the building centroid when absent from the University map, as for Lucy Cavendish's New Building. Do not substitute a site centroid or guess a room location.
