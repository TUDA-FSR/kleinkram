# FSR Production Deployment

This page describes how the FSR instance of Kleinkram is deployed on `srv-kleinkram`, why it
deviates from the upstream reference setup, and how to operate it. It is written for
developers and admins who maintain the instance. Host-specific operational notes (open tasks,
security assessment) are kept on the server, outside the repository.

::: info Branch
All FSR-specific changes live on the `internal-deployment` branch of the repository checkout at
`/home/fsr/kleinkram`. `git diff main..internal-deployment` shows every deviation from upstream.
:::

## Overview

| Item                  | Value                                                                         |
| :-------------------- | :---------------------------------------------------------------------------- |
| Host                  | `srv-kleinkram` — Ubuntu 24.04, 8 vCPU, 15 GiB RAM, **1 TB single partition** |
| Address               | see the DNS records on `srv-dc1`; reachable via FSR LAN or VPN only          |
| App                   | `https://srv-kleinkram.fsrnet.intranet.local`                                 |
| API                   | `https://srv-kleinkram.fsrnet.intranet.local/api`                             |
| S3 (browser uploads)  | `https://s3-kleinkram.fsrnet.intranet.local`                                  |
| Docs                  | `https://docs-kleinkram.fsrnet.intranet.local`                                |
| Grafana               | `http://127.0.0.1:9050` on the host (SSH tunnel only)                         |
| Login                 | GitHub OAuth App, owned by the `TUDA-FSR` organisation                        |
| Deployed              | 2026-09-12, upstream version 0.60.0                                           |

The three hostnames are A records on the FSR domain controller (`srv-dc1`) pointing at the same
address. They are separate names because the backend and frontend must share one origin (auth
cookies are `SameSite=Strict`), the browser uploads directly to S3 (which therefore needs its own
public name), and the docs image serves from `/` with no base-path support.

## Network topology

```
              LAN / VPN clients
                     │ 443 (80 → redirect)
                     ▼
           ┌──────────────────┐
           │  caddy (proxy)   │  the ONLY container published beyond 127.0.0.1
           └──┬─────┬──────┬──┘
   srv-*/api  │     │ srv-*│ /             s3-*               docs-*
              ▼     ▼                       ▼                  ▼
        api-server  frontend            seaweedfs:9000     documentation
              │
     postgres · redis · queue-consumer · loki · prometheus · tempo · grafana
                         (all bound to 127.0.0.1 or not published at all)
```

Every port in `docker-compose.prod.yml` is bound to `127.0.0.1` except Caddy's 80/443. This
matters more than a host firewall: Docker publishes ports through its own iptables chain, which
**bypasses ufw**. The bind address is the real control.

Caddy strips the `/api` prefix before proxying to the backend (`handle_path /api/*`), because the
NestJS app defines routes at the root (`/auth/github/callback`, not `/api/auth/...`). The GitHub
OAuth App is registered with the *external* callback URL,
`https://srv-kleinkram.fsrnet.intranet.local/api/auth/github/callback`.

## TLS

Certificates are issued by the FSR enterprise CA (`FSRNET-SRV-DC-CA-1`, AD Certificate Services on
`SRV-DC0`). Domain-joined Windows clients trust it automatically; other clients import
`certs/fsrnet-root.crt` (see [connecting the CLI](../../usage/fsr-instance.md#command-line-cli)).

| File                        | Purpose                                                         | Expires    |
| :-------------------------- | :-------------------------------------------------------------- | :--------- |
| `certs/site/kleinkram.crt`  | Server cert, SANs for all three hostnames + IP, `sha256RSA`     | 2028-09-11 |
| `certs/site/kleinkram.key`  | RSA-3072 private key, generated on the host, never left it      | —          |
| `certs/fsrnet-root.crt`     | CA root (renewed 2026-09-12 with `ReuseKeys`)                   | 2036-09-12 |
| `certs/kleinkram.csr`       | Reusable CSR for renewal                                        | —          |

::: warning The CA used to sign with SHA-1
The first certificate came back `sha1WithRSAEncryption` because the CA's `CNGHashAlgorithm` was
still `SHA1`. OpenSSL 3 refuses to even load such a certificate (`ca md too weak`), and Chromium
rejects it. The CA was switched to SHA-256 (`certutil -setreg ca\csp\CNGHashAlgorithm SHA256`),
which affects newly issued certificates only.
:::

Renewal is a single `certreq -submit` on `SRV-DC0` with the existing CSR, then `restart caddy`;
the exact commands are in `certs/README.md`. A weekly cron job (`scripts/check-cert-expiry.sh`)
warns 60 days ahead via syslog and `certs/expiry-check.log`.

Skipping TLS is not an option: the Actions code hard-codes `https://` for the S3 endpoint, and
session credentials must not cross a shared campus network in plaintext.

## Configuration

Secrets and URLs live in `.env.prod` (mode 600, gitignored). Two compose details are easy to get
wrong:

- `docker compose --env-file .env.prod` only affects `${VAR}` interpolation. The containers read
  the file named in the service's `env_file:` key, which upstream hard-codes to `.env`. The FSR
  compose file names `.env.prod` there explicitly.
- Editing a bind-mounted **single file** with `sed -i` (or most editors) replaces the inode, and
  the running container keeps the old one. Restart the container after editing `proxy/Caddyfile`
  or the observability configs.

Variables specific to this deployment (all optional upstream, see
[Environment Variables](../environment-variables.md)):

| Variable               | Value                       | Effect                                                              |
| :--------------------- | :-------------------------- | :------------------------------------------------------------------ |
| `ACTIONS_ADMIN_ONLY`   | `true`                      | Only `ADMIN` users may start Actions                                |
| `GITHUB_ALLOWED_ORGS`  | *(empty)*                   | Hard login allowlist — not used; guests are admitted read-only      |
| `S3_ENDPOINT`          | `https://s3-kleinkram…`     | Full URL, used by browser and backend for presigned URLs            |
| `S3_ENDPOINT_INTERNAL` | `seaweedfs:9000`            | Backend-to-S3 traffic stays on the Docker network                   |
| `DEV`                  | `false`                     | Disables `synchronize`, seeding and the fake OAuth provider         |

## Access model

Users are placed into affiliation groups at every login according to
`backend/src/access_config.json`, using the `github_orgs` rule added for this deployment:

| Group          | Who                                     | Create projects | Default rights on every new project |
| :------------- | :-------------------------------------- | :-------------- | :---------------------------------- |
| **FSR Member** | Members of the `TUDA-FSR` GitHub org    | yes             | Create (10)                         |
| **FSR Guest**  | Every other authenticated GitHub user   | no              | Read (0)                            |

Membership is re-evaluated on each login (the strategy requests the `read:org` scope and lists the
user's organisations), so leaving the org demotes the user to Guest next time they sign in.
Project creators can remove either default group from an individual project.

The first admin was created with `klein claim` (only works while no admin exists). Further admins
via `klein promote <email>`.

::: details The OAuth App must be approved for the organisation
GitHub offers no setting that limits *who* may authorise an OAuth App, so restriction is done in
Kleinkram. For the org lookup to see private memberships the app must be owned by, or approved
in, the organisation (*Organisation settings → Third-party access*). If members land in the Guest
group, this is the first thing to check.
:::

## Deviations from upstream

All in `docker-compose.prod.yml` unless noted.

- **Network:** every port loopback-bound; Caddy added; Tempo's bare port entries (which publish
  to random host ports on all interfaces) changed to `expose`.
- **Actions:** docker socket mounted, `ACTIONS_ADMIN_ONLY=true`. The container hostname is pinned
  to `srv-kleinkram` so restarts do not register a new (then forever-offline) worker.
- **Google Drive import:** the `google-service-account.json` bind mount is removed. The file does
  not exist, and Docker would silently create it as a directory.
- **Loki:** given a persistent volume — upstream writes to `/tmp` *inside the container*, which
  grows the overlay layer on the root partition and loses all logs on recreate.
- **Retention** (single 1 TB partition), see below.
- **Image pinning:** redis 8.10.1, prometheus v3.14.0, loki 3.7.7, grafana 13.2.1, tempo 3.0.0.
  `grafana/tempo:latest` resolved to 3.0, which restructured the configuration and refused to
  start with the upstream config.
- **Docker log caps:** `/etc/docker/daemon.json` limits json-file logs to 3 × 50 MB per container.
  Kleinkram pushes application logs to Loki itself (`winston-loki`); container stdout is a
  second, otherwise unbounded copy, and the only copy for postgres/redis/seaweedfs/nginx.
- **Branding:** the FSR logo replaces the RSL logo in the header, login page, landing page and
  favicon (`frontend/public/fsr-logo.svg`).

### Retention

| Data                  | Where                           | Limit                            | Set in                                   |
| :-------------------- | :------------------------------ | :------------------------------- | :--------------------------------------- |
| Container stdout logs | `/var/lib/docker/containers`    | 3 × 50 MB per container          | `/etc/docker/daemon.json`                |
| Application logs      | Loki volume                     | 14 d (30 d for action logs)      | `observability/loki/loki-config.yml`     |
| Metrics               | Prometheus volume               | 15 d **and** 20 GB               | compose `--storage.tsdb.retention.*`     |
| Traces                | Tempo volume                    | 7 d                              | `observability/tempo/tempo.yml`          |
| Action artifacts      | SeaweedFS `artifacts` bucket    | 90 d TTL                         | `docker/seaweedfs-entrypoint.sh`         |
| Mission data          | SeaweedFS `data` bucket         | **none** — this is the payload   | —                                        |

Two upstream settings were changed because they are unbounded by design: Prometheus had no size
cap, and Tempo's span metrics carried the `http.target` label (the full request path, i.e. one
series per file UUID). The label is removed from both dimension lists.

Rebuild leftovers (dangling images and build cache) are the one thing that grows without limit;
`scripts/docker-housekeeping.sh` prunes them weekly, keeping 4 GB of cache.

### Local source patches

These are behaviour changes to upstream code. The first four fix bugs and are candidates for
upstream pull requests; the rest add configuration knobs that default to upstream behaviour.

| File                                                                  | Change                                                                                               |
| :-------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `backend/src/services/auth.service.ts`                                | Login no longer fails with 500 when the GitHub/Google profile has no display name (falls back to username, then email local-part) |
| `backend/src/serialization/index.ts`                                  | Access-group listing no longer 500s once any project the group had access to is soft-deleted (`null` relation was not guarded)     |
| `frontend/src/pages/access-groups-page.vue`                           | "Creation Date" column showed `NaN` in non-US locales (date was formatted to a locale string and re-parsed)                       |
| `queueConsumer/src/actions/services/container-lifecycle.service.ts`   | Reconciliation loop logs one warning instead of an ERROR stack trace every 30 s when no docker socket is mounted                  |
| `packages/backend-common/src/environment.ts`                          | New `ACTIONS_ADMIN_ONLY`, `GITHUB_ALLOWED_ORGS` getters                                              |
| `packages/backend-common/.../action-dispatcher.service.ts`            | Enforces `ACTIONS_ADMIN_ONLY` at the single chokepoint for UI, CLI, API-key and trigger submissions   |
| `backend/src/endpoints/auth/github.strategy.ts`                       | Fetches the user's organisations (`read:org`) for the allowlist and for `github_orgs` group rules     |
| `packages/shared/src/types/access-group-config.ts` + affiliation service + project guard/service | `github_orgs`, `can_create_projects`, `default_for_all_projects` in `access_config.json` |

## Operations

```bash
cd ~/kleinkram
C="docker compose -f docker-compose.prod.yml --env-file .env.prod"
$C ps                        # status
$C logs -f api-server        # or Grafana → Explore → Loki
$C restart api-server        # after editing .env.prod
```

### Upgrading

```bash
git fetch origin && git merge origin/main   # resolve conflicts in the files listed above
$C build
./scripts/migrate-prod.sh show               # read-only: pending migrations
./scripts/migrate-prod.sh run                # apply BEFORE restarting api-server
$C up -d
./scripts/docker-housekeeping.sh             # reclaim the previous images
```

Upstream does **not** run migrations automatically and the production image has no TypeORM CLI.
`migrate-prod.sh` runs it from the `kleinkram-base` image with the checked-out source, on the
compose network, with credentials passed through the environment. Forgetting it produces
`relation "..." does not exist` at startup. See [Database Migrations](../migrations/migrations.md).

### Scheduled jobs (user `fsr` crontab)

| When            | Script                            | Purpose                                     |
| :-------------- | :-------------------------------- | :------------------------------------------ |
| Mondays 07:17   | `scripts/check-cert-expiry.sh`    | Warn 60 days before leaf or root CA expiry  |
| Mondays 07:23   | `scripts/docker-housekeeping.sh`  | Prune dangling images and build cache       |

