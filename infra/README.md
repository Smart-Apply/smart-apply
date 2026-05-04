# Smart Apply — Infrastructure

This directory holds the container build artifacts for the production
deployment.

## Current topology

| Layer | Hosting                                              |
| ----- | ---------------------------------------------------- |
| API   | **Fly.io** app `smart-apply-api` (region `fra`)      |
| Web   | **Cloudflare Workers** (`@opennextjs/cloudflare`)    |
| DB    | **Neon Postgres** (EU/Frankfurt)                     |
| Files | **Cloudflare R2** (EU jurisdiction)                  |
| Queue | **Upstash QStash** + **Upstash Redis**               |
| LLM   | **Azure OpenAI** + **Azure AI Foundry** (agents)     |

## Files

| File                | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `Dockerfile`        | Multi-stage build for the NestJS API; consumed by `flyctl deploy` |
| `docker-compose.yml`| Local dev (Postgres only, started by `setup.sh`)                 |

The API image is built and pushed by `flyctl deploy` (called from
`.github/workflows/deploy.yml`). The web app is deployed by `wrangler deploy`
after `npm run cf:build` in `apps/web/`.

## Deployment commands

```bash
# API → Fly.io
# Prod
flyctl deploy --config fly.prod.toml --app smart-apply-api
# Staging
flyctl deploy --config fly.staging.toml --app smart-apply-api-staging
flyctl logs -a smart-apply-api
flyctl secrets list -a smart-apply-api

# Web → Cloudflare Workers
cd apps/web
npm run cf:deploy                            # build + wrangler deploy
```

See [docs/guides/DOMAIN_CLOUDFLARE_SETUP.md](../docs/guides/DOMAIN_CLOUDFLARE_SETUP.md)
for the custom-domain setup (apex + www on Workers, `api.smart-apply.io` on
Fly via Cloudflare proxy).

## Historical note

This repo previously deployed via two paths that are no longer used:
- An Azure VM running docker-compose + nginx (decommissioned May 2026)
- Azure Container Apps + ACR (never went to production)

Both have been removed. The `infra/azure/` Bicep modules and the
`scripts/deploy-vm.sh`, `install-domain.sh`, `sync-env-to-vm.sh`,
`build-optimized.sh` etc. are gone too. If you need to revisit them, see
git history.
