# Environment Variables

This document lists the environment variables used to configure the Kleinkram application. These variables are typically defined in a `.env` file in the root directory.

::: warning `--env-file` does not change what containers read
`docker compose --env-file X` only affects `${VAR}` interpolation inside the compose file. The
variables a container receives come from the file named in the service's `env_file:` key, which
`docker-compose.prod.yml` upstream hard-codes to `.env`. A production deployment that keeps its
secrets in another file (the FSR instance uses `.env.prod`) must change `env_file:` as well.
:::

## Server Configuration

| Variable      | Description                                   | Default |
| :------------ | :-------------------------------------------- | :------ |
| `SERVER_PORT` | The port on which the backend server listens. | `3000`  |

## Service URLs

These URLs are used for communication between services and for generating links.

| Variable       | Description                                           | Default                 |
| :------------- | :---------------------------------------------------- | :---------------------- |
| `FRONTEND_URL` | The URL where the frontend application is accessible. | `http://localhost:8003` |
| `DOCS_URL`     | The URL where the documentation site is accessible.   | `http://localhost:4000` |
| `BACKEND_URL`  | The URL where the backend API is accessible.          | `http://localhost:3000` |

## S3 Configuration (Object Storage)

Configuration for SeaweedFS (or S3-compatible storage), which is used for object storage.

| Variable                   | Description                                   | Default                                    |
| :------------------------- | :-------------------------------------------- | :----------------------------------------- |
| `S3_USER`                  | The username for S3 access.                   | `seaweed`                                  |
| `S3_PASSWORD`              | The password for S3 access.                   | `seaweed`                                  |
| `S3_ACCESS_KEY`            | The access key for S3 clients.                | `pMEKIOCnYJhmssiKZDGU`                     |
| `S3_SECRET_KEY`            | The secret key for S3 clients.                | `ECnXGyUR5ZrPsxeD5JEWxtI1CMZFMJ8kTJMMAQ5B` |
| `S3_DATA_BUCKET_NAME`      | The bucket name for main data storage.        | `data`                                     |
| `S3_DB_BUCKET_NAME`        | The bucket name for database dumps/backups.   | `dbdumps`                                  |
| `S3_ARTIFACTS_BUCKET_NAME` | The bucket name for build artifacts.          | `artifacts`                                |
| `S3_ENDPOINT`              | The S3 endpoint as reachable **by clients** (browser and CLI upload directly). A bare hostname is prefixed with `https://` in production (`http://` when `DEV=true`); a full URL is used as is. | `localhost` |
| `S3_ENDPOINT_INTERNAL`     | Optional. Endpoint the backend uses for its own S3 traffic, e.g. the compose service name, so server-side requests do not leave the Docker network. | `seaweedfs:9000` |

## Database Configuration

Configuration for the PostgreSQL database.

| Variable           | Description                                                           | Default                                                               |
| :----------------- | :-------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| `DB_HOST`          | The hostname of the database server.                                  | `database`                                                            |
| `DB_PORT`          | The port of the database server.                                      | `5432`                                                                |
| `DB_DATABASE`      | The name of the database.                                             | `dbname`                                                              |
| `DB_USER`          | The database username.                                                | `dbuser`                                                              |
| `DB_PASSWORD`      | The database password.                                                | `dbuserpass`                                                          |
| `DATA_SOURCE_NAME` | The full connection string/DSN for TypeORM/Postgres.                  | `postgresql://dbuser:dbuserpass@database:5432/dbname?sslmode=disable` |
| `DEV`              | Set to `true` to enable development features (verbose logging, etc.). | `true`                                                                |

## TypeORM Configuration

| Variable   | Description                          | Default               |
| :--------- | :----------------------------------- | :-------------------- |
| `ENTITIES` | Glob pattern to locate entity files. | `dist/**/*.entity.js` |

## Seeding Configuration

| Variable | Description                                                               | Default |
| :------- | :------------------------------------------------------------------------ | :------ |
| `SEED`   | Set to `true` to populate the database with initial seed data on startup. | `true`  |

## Authentication Configuration

| Variable                              | Description                                                    | Default                       |
| :------------------------------------ | :------------------------------------------------------------- | :---------------------------- |
| `VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT` | Set to `true` to enable the mock OAuth provider for local dev. | `true`                        |
| `GOOGLE_KEY_FILE`                     | Path to the Google Cloud service account key file.             | `google-service-account.json` |
| `GOOGLE_CLIENT_ID`                    | Google OAuth Client ID.                                        | -                             |
| `GOOGLE_CLIENT_SECRET`                | Google OAuth Client Secret.                                    | -                             |
| `GITHUB_CLIENT_ID`                    | GitHub OAuth Client ID.                                        | -                             |
| `GITHUB_CLIENT_SECRET`                | GitHub OAuth Client Secret.                                    | -                             |
| `JWT_SECRET`                          | Secret key used to sign and verify JWT tokens.                 | `SECRET`                      |
| `GITHUB_ALLOWED_ORGS`                 | Optional, comma-separated GitHub organisation logins. When set, the GitHub strategy requests the `read:org` scope and rejects users who are not a member of at least one listed organisation, before any user record is created. Empty = anyone with a GitHub account may log in (GitHub itself cannot restrict this). | - |

## Docker & Registry Configuration

| Variable                    | Description                                              | Default                                      |
| :-------------------------- | :------------------------------------------------------- | :------------------------------------------- |
| `DOCKER_HUB_USERNAME`       | Username for Docker Hub authentication.                  | -                                            |
| `DOCKER_HUB_PASSWORD`       | Password for Docker Hub authentication.                  | -                                            |
| `VITE_DOCKER_HUB_NAMESPACE` | Restricts allowed Docker images to a specific namespace. | -                                            |
| `ARTIFACTS_UPLOADER_IMAGE`  | Docker image used for uploading artifacts.               | `rslethz/kleinkram:artifact-uploader-latest` |
| `DOCKER_GID`                | The group ID of the docker group on the host system.     | `984`                                        |
| `ACTIONS_ADMIN_ONLY`        | Set to `true` to allow only `ADMIN` users to start Actions. Enforced in `ActionDispatcherService.dispatch()`, the single path used by the web UI, CLI, API keys and cron/webhook/file triggers. Non-admins receive a 403. | `false` |

## Access Group Configuration File

Affiliation-group rules are not environment variables; they live in `backend/src/access_config.json`
and are compiled into the API image. See [Access Control → Implementation](access-control/implementation.md#affiliation-groups)
for the schema, including the GitHub-organisation rules and the per-group flags used by the FSR deployment.
