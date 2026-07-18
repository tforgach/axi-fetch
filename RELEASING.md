# Releasing

`@tforgach/axi-fetch` (the `packages/core` package) is published to npm by the
[`Release` workflow](.github/workflows/release.yml). Pushing a version tag builds,
tests, and publishes automatically — **no manual `npm publish` and no 2FA OTP.**

## One-time setup

The workflow authenticates with a repo secret named `NPM_TOKEN`:

1. On [npmjs.com](https://www.npmjs.com/) → **Access Tokens** → **Generate New
   Token** → **Classic Token** → type **Automation**.
   - An **Automation** token is the one that *bypasses 2FA* in CI. A granular or
     "Publish" token still enforces the interactive OTP and the publish step will
     fail with `npm error code EOTP` ("requires a one-time password").
2. In the GitHub repo → **Settings → Secrets and variables → Actions → New
   repository secret** → name it `NPM_TOKEN`, paste the token.

You only do this once (until the token expires).

## Cutting a release

1. Bump the version in `packages/core/package.json` (follow semver):

   ```sh
   # from packages/core
   npm version patch   # or: minor | major  — bumps package.json and makes a commit
   ```

   Or edit `version` by hand and commit it. The commit should land on `main`.

2. Tag the commit `vX.Y.Z` and push the tag:

   ```sh
   git tag v0.1.1
   git push origin main --tags
   ```

   The tag version **must** match `packages/core/package.json` — the workflow
   fails fast if they disagree, so it can never publish the wrong version.

3. Watch the run under the repo's **Actions** tab. On success the new version is
   live on npm with a signed [provenance
   attestation](https://docs.npmjs.com/generating-provenance-statements) (visible
   as the "Provenance" badge on the npm page).

## What the workflow does

On any pushed tag matching `v*`:

1. Install (pnpm via corepack, frozen lockfile).
2. **Verify** the tag matches `packages/core/package.json` version.
3. `pnpm build` → `pnpm -r typecheck` → `pnpm test` — a full gate before anything
   is published.
4. `npm publish --provenance --access public` from `packages/core`, authed via
   `NPM_TOKEN`. Provenance is signed through GitHub OIDC (`id-token: write`).

## Troubleshooting

- **`Tag vX.Y.Z does not match … version`** — the tag and `package.json` disagree.
  Delete the tag (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`), fix
  the version, and re-tag.
- **`npm error code EOTP` ("requires a one-time password")** — `NPM_TOKEN` is a
  granular or Publish token that still enforces 2FA. Replace it with a **classic
  Automation** token (see setup above) and re-run.
- **`403 Forbidden` on publish** — `NPM_TOKEN` is missing, expired, or lacks
  write scope for `@tforgach/axi-fetch`. Regenerate it (see setup above).
- **`You cannot publish over the previously published versions`** — that version
  is already on npm. Bump to a new version and re-tag.
- **Provenance step fails** — confirm the job still has `permissions: id-token:
  write`; provenance also requires the repo to be public.
