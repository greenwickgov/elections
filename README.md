# Greenwick Votes

A GitHub-ready election portal for the Commonwealth of Greenwick. Emerald, ivory and gold identity; responsive rounded layouts; pill navigation; keyboard-accessible ballot controls. Uses Neon Postgres and a Node.js/Express server. No Supabase dependency.

## Included

- Administrator sign-in with salted scrypt password hashes, hashed expiring sessions, HttpOnly cookies and same-origin mutation checks.
- Create draft elections: single-winner full preferential (instant runoff), first past the post, or Yes/No referendum.
- Configure title, question, candidate list, opening and closing times. Publication freezes the ballot. Drafts cannot currently be edited; create a replacement draft if needed.
- Issue cryptographically random single-use voter codes, download once, distribute privately.
- Ballot selection, accessible preference reordering, review screen and final confirmation.
- Atomic code consumption and encrypted ballot insert in one Postgres transaction. Concurrent submissions using one code can record only one ballot.
- AES-256-GCM ballot encryption with election-bound authenticated data; no voter identity, code or timestamp on ballot rows.
- Random receipts confirm recording without disclosing choices. Downloadable receipt and public receipt verification.
- Explicit, irreversible closure releases public results, round counts and JSON exports. Opening/closing times also gate voting server-side.
- Administrator audit trail for creation, publishing, closure and code issuance. Database-backed login/vote throttles plus API request limiting.
- Generated brand board and editable SVG app mark in `public/`.

## Run locally

Use Node.js 22+ (24 recommended).

1. Create a Neon project/database, then copy its pooled Postgres connection URL. Use TLS with `sslmode=verify-full`; never turn certificate validation off.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `APP_ORIGIN`, `SESSION_SECRET` and `BALLOT_KEY`.
3. Generate `SESSION_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and a separate `BALLOT_KEY` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep them private. Back up the ballot key securely: losing it makes stored ballots unreadable. Changing SESSION_SECRET invalidates previously issued voter codes.
4. Run `npm ci`, then `npm run migrate`.
5. Provision your administrator by piping JSON through stdin to `npm run admin`:

```sh
npm run admin <<'JSON'
{"username":"your-admin-name","password":"REPLACE WITH A UNIQUE PASSWORD OF AT LEAST 14 CHARACTERS"}
JSON
```

Use a secure terminal. Do not commit the password or paste real secrets into README files. Re-running provisioning rotates that user's password and revokes their sessions.

6. Run `npm start`, then open `http://localhost:3000`. Click **Admin console**.

## Repository and Neon setup status

Repository: https://github.com/greenwickgov/elections

The seven application tables have been installed in the `neondb` database of the **Greenwick Elections.** Neon project, production branch. A rollback-only SQL check verified single-use code consumption, rejection of code reuse, and ballot insertion; zero test elections and ballots were retained. This does not constitute an end-to-end application test against Neon.

The application still requires DATABASE_URL, APP_ORIGIN, SESSION_SECRET and BALLOT_KEY in the backend hosting environment, plus administrator provisioning. No database password or application secret is committed to this public repository.

GitHub CI includes an isolated Postgres service and a full API lifecycle test covering all three ballot types, same-code concurrent submission, unpublished results, receipt verification, closure and sign-out. Local runs skip that test unless TEST_DATABASE_URL points to a localhost database named greenwick_test.

## GitHub and deployment

The application is committed at the root of greenwickgov/elections; no upload or folder restructuring is required. The included GitHub Actions workflow installs locked dependencies, checks syntax and runs counting/cryptography tests.

**GitHub Pages is unsuitable:** it cannot run the server, keep database credentials private or atomically protect ballots. Deploy the GitHub repository to Render or another HTTPS Node.js host. A Dockerfile and Render blueprint are included.

For Render:

1. Create a Blueprint from the GitHub repository using `render.yaml`, or create a Node web service with build command `npm ci` and start command `npm start`.
2. Set `DATABASE_URL` to your Neon pooled URL; set `APP_ORIGIN` to the exact public HTTPS origin (no trailing slash), and `BALLOT_KEY` to 64 random hex characters. The blueprint generates SESSION_SECRET automatically. For manual services, set it yourself.
3. Set `NODE_ENV=production`. Set `TRUST_PROXY=1` only when requests pass through exactly one trusted host proxy. Otherwise leave it 0 or configure the deployment's network topology appropriately before use.
4. Run `npm run migrate` and provision the administrator from a trusted environment using the same Neon database. These are explicit operator steps; migrations do not run automatically on every server start.
5. Deploy and verify `/api/health` returns `{ "ok": true }`, then complete the rehearsal below before opening voting.

Do not expose DATABASE_URL, SESSION_SECRET or BALLOT_KEY in frontend code, GitHub commits, build artifacts or client-visible environment variables. Keep the hostname stable and avoid redirects between origins after issuing access codes.

## Operating an election

1. In Admin console, create a draft. Referendums automatically use Yes/No options. Enter the full referendum proposition in the question.
2. Verify title, choices, method and local opening/closing times. Each ballot page displays times in the visitor's timezone; dates are stored as timestamptz.
3. Issue one code per verified eligible voter. Download codes immediately; plaintext codes cannot be recovered. Keep the distribution register private and separate from the application. The system does not verify citizenship or prevent an administrator issuing multiple codes to one person.
4. Publish after checking all details. No post-publication edits or reopening are supported.
5. After polls finish, explicitly close the election to release results. Closing early stops voting immediately. Download the result JSON and retain an election declaration under your rules.
6. Do not issue replacement codes casually: old codes remain usable until consumed or the election closes. This version has no per-code revocation interface. Handle compromised codes under a documented election procedure.

## Counting rules

Preferential voting is **full-ranking single-seat instant runoff**, not multi-seat STV. First continuing preference counts each round. A candidate needs more than half of non-exhausted votes. The uniquely lowest candidate is eliminated and votes transfer. A tie for lowest stops counting and returns `requiresResolution`; it never invents a random tiebreak. A separate externally documented resolution/declaration is required; this version cannot resume a tied count with an administrator override.

FPTP and referendums use the highest count; a shared highest count produces no winner. Empty elections produce no winner. Referendums have a simple majority only, without quorum, supermajority or regional thresholds.

## Security boundaries and verification

This is a deployable application foundation, **not an independently audited public-election system**. Server operators holding the database and ballot key can decrypt votes; it provides no end-to-end verifiability, blind credentials, coercion resistance, cryptographic tally proof, hardware key custody, MFA or tamper-proof external audit ledger. Database administrators can alter records. Access-code possession is the voter credential. Eligibility, code distribution and administrator oversight are operator responsibilities.

For consequential use, arrange independent security review, administrator MFA through an identity-aware reverse proxy, separation of key custody and database administration, backups and recovery drills, external monitoring and an approved tie-resolution policy. Do not log request bodies or access codes at the host/proxy. Database transaction logs/backups and surrounding operational records may reveal timing correlations even though ballot rows have no identity field. Receipts attest recording only, not inclusion in an independently verifiable final tally.

### Verification completed in this build

- Seven automated tests cover validation, majority/transfer counts, ties, empty elections, authenticated encryption/tampering and password hashing.
- JavaScript syntax checked; homepage, administrator sign-in and receipt-page navigation inspected in a browser.
- The live Neon schema and rollback-only SQL check passed. The complete HTTP authentication and ballot lifecycle has not been tested against Neon; GitHub CI runs that lifecycle against an isolated Postgres database.

### Mandatory pre-opening rehearsal

On a separate test Neon database, migrate, provision an admin, create one election of each type, issue test codes, publish, cast ballots, verify receipts, close and compare results to a hand count. Confirm a duplicate or concurrent same-code submission records only one ballot; invalid/expired codes, out-of-window votes and anonymous admin requests fail; results are hidden until closure; XSS text renders inert; sign-out invalidates the session; restart preserves data; backup restoration plus the retained encryption key recovers the count. Rehearse an elimination tie and a network interruption after submission. A lost receipt cannot be recovered in the UI.

Run `npm test` locally or in GitHub Actions.

## Files

`server.js` API/auth and election operations; `schema.sql` Neon schema; `security.js` credentials and encryption; `tally.js` counting; `public/` browser app and branding; `scripts/` migration and administrator provisioning; `test/` automated checks.
