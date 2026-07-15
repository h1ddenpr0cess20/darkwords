# Deployment

Darkwords is a static single-page app. Any static host works, but read
[Security](security.md) first — **API keys live in the browser**, so a shared
deployment shares whatever keys users enter with that origin's code.

## CI

GitHub Actions (`.github/workflows/ci.yml`) typechecks, tests, and builds on
every push to `main`/`master` and every pull request (Node 24):

```
npm run lint    # tsc --noEmit + biome check
npm test        # vitest run
npm run build   # tsc -b + vite build
```

## Docker

The `Dockerfile` is a two-stage build: Node builds the static site, then nginx
serves it (`nginx.conf` carries the SPA fallback).

```sh
docker build -t darkwords .
docker run -p 8080:80 darkwords
```

Pushing a `v*` tag runs `.github/workflows/docker-publish.yml`, which publishes a
multi-arch image to Docker Hub as `<DOCKERHUB_USERNAME>/darkwords` (tags:
`{version}`, `{major}.{minor}`, `latest`). It needs the `DOCKERHUB_USERNAME` and
`DOCKERHUB_TOKEN` repository secrets.

## Vercel

Import the repo and deploy. `vercel.json` provides:

- An **SPA rewrite** — everything except `/assets/` falls back to `index.html`.
- An **Anthropic proxy** — `/anthropic/:path*` is rewritten to
  `https://api.anthropic.com/:path*`, so requests can go same-origin and dodge
  browser CORS restrictions rather than hitting the Anthropic API cross-origin.

## The keys-in-browser caveat

For local, single-user use, client-side keys are fine. Before deploying anywhere
shared:

- Put the provider calls behind a **backend proxy** that holds the keys, or
- Restrict the deployment to trusted users only.

See [Security](security.md) for the full trust model.
