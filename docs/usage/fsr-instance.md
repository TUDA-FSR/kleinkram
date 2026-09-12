# The FSR Instance

FSR runs its own Kleinkram at **https://srv-kleinkram.fsrnet.intranet.local**. It is only
reachable from the FSR network — plug into the FSR LAN or connect the FSR VPN first.

::: tip TL;DR

1. Open https://srv-kleinkram.fsrnet.intranet.local and **Sign in with GitHub**.
2. Members of the `TUDA-FSR` GitHub organisation can create projects and upload; everyone else
   can browse and download.
3. For the CLI: `klein endpoint fsr https://srv-kleinkram.fsrnet.intranet.local/api https://s3-kleinkram.fsrnet.intranet.local`
   then `klein login --oauth-provider github`.
   :::

## Signing in

Login is via **GitHub only** — there is no Google or local account login on this instance. The
first time you sign in, GitHub asks you to authorise the *Kleinkram FSR* app, including
permission to read your organisation memberships; that is how Kleinkram tells members from
guests.

Your display name is taken from your GitHub profile's *Name* field. If that field is empty, your
GitHub username is used instead.

## Members and guests

Every user is automatically placed into one of two groups, re-checked on each login:

|                     | **FSR Member**                                   | **FSR Guest**                          |
| :------------------ | :----------------------------------------------- | :------------------------------------- |
| Who                 | Members of the `TUDA-FSR` GitHub organisation    | Any other GitHub user                  |
| Create projects     | ✔                                                | ✘                                      |
| On new projects     | <Create/> — add missions and upload files        | <Read/> — browse and download          |
| Custom groups       | ✔ can be granted any level per project           | ✔ can be granted any level per project |

Both groups are attached to every newly created project by default. If a project should be
private, its creator can remove either group in the project's access settings, or grant more
rights to a specific person or a custom [access group](access-control/access-group.md).

::: details Not a member but should be?
Ask an FSR GitHub org owner to add your GitHub account to `TUDA-FSR`, then log out and back in.
If you are a member and still land in *FSR Guest*, your organisation membership may be set to
*private* and the app not yet approved for the organisation — tell an admin.
:::

## Actions

[Kleinkram Actions](actions/use-actions.md) run as Docker containers on the server. On the FSR
instance, **only administrators can start Actions** (including via triggers and the CLI); other
users see the Actions pages and can prepare templates, but a submission is refused with
*"Kleinkram Actions are restricted to administrators on this instance"*. Ask an admin to run an
Action for you, or to promote you if you need to run them regularly.

## Command line (CLI)

Install the CLI as described in [Python Setup](python/setup.md), then point it at the FSR
instance — this replaces the default (public RSL) endpoint:

```bash
klein endpoint fsr https://srv-kleinkram.fsrnet.intranet.local/api https://s3-kleinkram.fsrnet.intranet.local
klein login --oauth-provider github          # add --headless on a machine without a browser
```

### Certificates on non-Windows machines

The instance uses a certificate from the FSR internal CA. Domain-joined Windows PCs trust it
already. On Linux, macOS, or a personal laptop, the browser may need the CA root, and the CLI
**always** does — Python's `requests` ignores the system trust store on most platforms.

1. Get `fsrnet-root.crt` from an admin (it is public; it lives in `certs/` on the server).
2. Trust it system-wide:

    ```bash
    # Ubuntu / Debian
    sudo cp fsrnet-root.crt /usr/local/share/ca-certificates/fsrnet-root.crt && sudo update-ca-certificates
    # macOS
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain fsrnet-root.crt
    ```

3. Tell the CLI about it. Both variables are needed — one for the API, one for uploads:

    ```bash
    export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt   # Ubuntu path; use the file you trusted on macOS
    export AWS_CA_BUNDLE=$REQUESTS_CA_BUNDLE
    ```

    Put those two lines in your shell profile. Without them `klein` fails with
    `SSLError: certificate verify failed`.

Firefox on Windows does not use the Windows store unless `security.enterprise_roots.enabled` is
set to `true` in `about:config`.

## Where things are

| What                | URL                                            |
| :------------------ | :--------------------------------------------- |
| Web app             | https://srv-kleinkram.fsrnet.intranet.local    |
| API (for the CLI)   | https://srv-kleinkram.fsrnet.intranet.local/api |
| Uploads/downloads   | https://s3-kleinkram.fsrnet.intranet.local     |
| This documentation  | https://docs-kleinkram.fsrnet.intranet.local   |

Admins: the operational details (certificates, upgrades, retention) are in the
[FSR Production Deployment](../development/deployment/fsr-deployment.md) developer page.
