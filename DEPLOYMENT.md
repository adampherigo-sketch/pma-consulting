# PMA Consulting Deployment

## Architecture

The repository contains the source site at its root. Netlify runs `npm run build` and publishes the generated `dist/` directory. Netlify Functions remain in `netlify/functions`, outside the static publish directory. The Contact endpoint is `/.netlify/functions/contact`.

## Netlify setup

1. Connect the GitHub repository to Netlify.
2. Use the build command and `dist` publish directory from `netlify.toml`.
3. Use `netlify/functions` as the Functions directory.
4. Configure the environment variables listed in `.env.example` in Netlify only.
5. Verify `/.netlify/functions/contact` is reachable after deployment.

The build copies only the seven public HTML pages, `css/`, `js/`, `images/`, and `_headers` into `dist/`. It does not copy Functions, tests, environment examples, or deployment documentation. `dist/` is generated and ignored by Git.

## Environment variables

Configure these in Netlify with client-approved values:

- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`
- `CONTACT_ALLOWED_ORIGINS`
- `RESEND_API_KEY`

No credentials belong in Git.

## Resend setup

1. Create or confirm the Resend account.
2. Verify a PMA-owned sending domain.
3. Add the SPF and DKIM records Resend provides.
4. Create a sending-only API key.
5. Configure `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, and `CONTACT_TO_EMAIL` in Netlify.
6. Add the confirmed production HTTPS origin to `CONTACT_ALLOWED_ORIGINS`.

A dedicated sending subdomain such as `send.example.com` or `mail.example.com` may isolate transactional reputation from employee mail, but the final value requires client and DNS approval.

## DNS and domain cutover

The domain can remain managed by Squarespace while the site is hosted on Netlify. Before changing DNS, record the existing A, CNAME, MX, TXT, SPF, DKIM, DMARC, and verification records.

Change only the website-routing records needed for Netlify. Preserve existing MX records and unrelated TXT/SPF/DKIM/DMARC records unless the relevant provider explicitly requires a verified change. Configure the Netlify apex and `www` targets according to Netlify's current domain instructions.

Do not transfer the domain or replace mail records as part of the website cutover.

## HTTPS and headers

Netlify should issue HTTPS for the confirmed custom domain. Confirm the certificate is active before enabling HSTS. HSTS is intentionally not configured in the repository yet; after HTTPS is verified, add a conservative policy such as `max-age=31536000` without `preload` during the initial rollout.

`_headers` is copied to the root of `dist/` and configures:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling unused camera, microphone, geolocation, payment, and USB capabilities
- `X-Frame-Options: DENY`
- Fresh validation for HTML while the site is actively maintained

The Contact Function already returns `Cache-Control: no-store`.

## Content Security Policy

An enforced CSP is configured in `_headers` and copied into `dist/_headers` during the build:

```text
default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

The Contact controller now loads from `js/contact.js`, so `script-src 'self'` does not require `unsafe-inline`. Google Fonts are allowed only from their current stylesheet and font hosts. Contact fetches only the same-origin Function endpoint; Resend remains server-side and is not in browser `connect-src`. No `unsafe-eval` or wildcard source is used.

## Rate limiting

The Contact Function currently uses Lambda-compatible `exports.handler`. No in-memory limiter was added because it would not be reliable across serverless instances.

Netlify's modern Function rate-limit configuration should be evaluated after confirming the deployed runtime/API format. Migrating the function solely for rate limiting is deferred to avoid launch risk. Consider Netlify edge controls or a WAF if abuse appears.

## Validation before launch

- HTTPS certificate active
- Apex domain works
- `www` works or intentionally redirects
- All seven HTML pages load
- CSS, JavaScript, and available images load
- Contact Function is reachable
- Contact submission succeeds with a controlled test
- Reply-To reaches the submitted test address
- Failure state is tested
- Origin enforcement is active
- Security headers are present
- No secrets are exposed
- No console errors
- No broken internal links
- Mobile widths are tested
- Favicon and social preview are checked when approved assets exist

## Rollback

Retain the previous successful Netlify deploy. Use Netlify deploy history to restore it if the new deploy fails. Preserve the recorded Squarespace DNS values and avoid destructive DNS changes so routing or mail can be restored deliberately.

Before cutover, run `npm run build` locally and inspect `dist/`. Confirm that `dist/netlify/`, `dist/tests/`, `dist/.env.example`, and `dist/DEPLOYMENT.md` do not exist.

## Client requirements

Before production launch, obtain approval for the public email and phone values, Contact recipient, sending domain, allowed origins, favicon, social-share image, About photographs, missing partner logos, and any future event information.
