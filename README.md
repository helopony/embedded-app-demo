# SIDES partner app prototype

A small, independent demonstration of a Shopify-style partner app inside a restaurant admin. The admin and the partner load on different browser origins. Both use React and shadcn/ui. The data and staff identity are synthetic.

[Open the demo](https://sides-app.helopony.com) · [Inspect a live authentication request](https://sides-app.helopony.com/apps/demand-forecast/authentication)

## Try it

1. Open **Authentication** in the SIDES sidebar. Inspect the staff, store, installation and app IDs that reached the iframe. Compare the assertion's audience and expiry with the scope and lifetime granted by the token endpoint. Refresh to run the exchange again and compare the new assertion ID (`jti`).
2. Select **Open partner app directly** above the iframe. The new tab loads the same partner page on its own origin. It has no host window to issue the assertion. Its call to the partner forecast endpoint returns HTTP 401 and `launch_assertion_required`.
3. Back in SIDES, switch off **Show Forecast in SIDES menu** inside the iframe. The outer menu changes immediately. Restore the link, navigate between forecast and overview, then use Back or reload the deep link.
4. In the **Bridge inspector**, choose **Events** to see the browser message sequence or **Manifest** to inspect the installed app definition.

## Source layout

| Part | Location | Responsibility |
|---|---|---|
| Host UI | `apps/admin` | Owns the outer sidebar and URL, creates the iframe, obtains launch assertions, displays the inspector. |
| Partner test app | `apps/test-app` | Declares navigation with `<sides-app-nav>`, displays the forecast, requests identity via the bridge. |
| Bridge library | `packages/bridge` | Implements the typed, versioned handshake, origin/window checks, navigation updates, request timeouts and cleanup. |
| Mock backend | `app/api`, `lib/mock-auth` | Supplies a signed demo session, token exchange and the protected sales endpoint. |
| Manifest v1 | [sides.app.json](apps/test-app/sides.app.json) | Registers the app ID, name, partner origin, logical home path, bridge version and granted scope. |

The example has one preinstalled app. Its ID doubles as its OAuth client ID. The manifest identifies the origin SIDES may frame, its home route, bridge version and requested permissions. On the partner side a `MutationObserver` watches a hidden `<sides-app-nav>` element. After the handshake and whenever that element changes, the bridge reads its direct links and sends an `app.navigation` message containing labels and app-relative paths. SIDES renders those links in its own document. Selecting one updates the outer URL and sends `host.navigate` to the existing iframe. A route change initiated by the app travels back as `app.route`.

## Authentication

1. **Connect the two browser windows.** The iframe and its parent exchange versioned `postMessage` messages. They check the exact origin and source window, then use a bridge session ID to route messages for this connection.
2. **Identify the current staff session.** The frame calls `getAssertion()`. The host sends a first-party `POST /api/host/launch`. The endpoint creates or reads its HttpOnly demo-session cookie and signs an HS256 launch JWT with a 60-second lifetime. The host sends that JWT to the requesting iframe over the bridge. Its claims identify the issuer (`iss`), staff (`sub`), receiving app (`aud`), store, installation, session, issue and expiry times, and unique assertion ID. The iframe can decode claims for display. The authorization server verifies the signature and claims before issuing access.
3. **Authenticate the partner server.** The iframe sends the launch assertion to its own `GET /api/partner/forecast` as a bearer credential. The partner backend submits it as the OAuth `subject_token` in a form-encoded token exchange at `POST /api/oauth/token`. The backend supplies its registered client ID and secret with HTTP Basic authentication and requests `sales.summary.read`. SIDES checks the client credentials, assertion audience, expiry and demo grant. The secret lives in server configuration.
4. **Authorize the data read.** The exchange returns a 120-second access token with the granted scope. The partner backend presents it to `GET /api/sales`. The sales API verifies the token's API audience, client and scope before releasing the staff and restaurant display names and forecast rows. The partner returns those fields and selected metadata from the two HTTP responses. The **Authentication** page displays the exchange status, granted scope, lifetime and sales response status from that read. The complete access token stays on the server.

The grant always represents Alex Morgan at Berlin Mitte. Every visitor receives this synthetic identity. Client registration, installation and consent are preconfigured. The backend makes real HTTP requests and validates signed tokens against that fixed grant. A stateless launch assertion can be exchanged again until expiry. The inspector displays selected fields and omits usable credentials.

## Run locally

Use Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. The embedded app runs at **http://127.0.0.1:3000**. A single Next.js process serves both origins. Open the localhost address as the admin so message checks and the first-party cookie match. The partner page opened directly displays the required host context. Development uses local-only placeholder credentials.

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

For an installed desktop Chrome, use `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. Set `DEMO_BASE_URL` to run the same browser checks against a deployed host.

## Vercel

One Vercel project serves one committed build across two independent HTTPS origins. Host pages and host-only API routes enforce the host origin allowlist. The partner UI and its backend require the partner origin.

| Server setting | Value or purpose |
|---|---|
| `SIDES_HOST_ORIGIN` | Canonical public host origin used for server-to-server OAuth and data requests. |
| `SIDES_EXTRA_HOST_ORIGINS` | Comma-separated exact admin aliases, including an approved custom hostname. |
| `SIDES_PARTNER_ORIGIN` | Exact partner origin. It must differ from every allowed host origin. |
| `DEMO_SIGNING_SECRET`, `DEMO_CLIENT_SECRET` | Two independently generated server-only secrets of at least 32 bytes each. |

The public admin runs at `sides-app.helopony.com`. The partner iframe runs at `sides-partner-helopony.vercel.app`. Server-to-server requests reach the host API at `sides-app-chi.vercel.app`. These hostnames point to the same Vercel deployment. Their separate browser origins exercise the iframe boundary, while the mock backend handlers share one server environment. DNS for the public admin is managed in helopony-platform.
