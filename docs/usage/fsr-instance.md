# The FSR Instance

FSR runs its own Kleinkram at **https://srv-kleinkram.fsrnet.intranet.local**. It is only
reachable from the FSR network — plug into the FSR LAN or connect the FSR VPN first.

::: tip TL;DR

**First:** [install the FSR root certificate](#install-the-fsr-root-certificate-first) — without it,
uploads silently fail. Then:

1. Open https://srv-kleinkram.fsrnet.intranet.local and **Sign in with GitHub**.
2. Members of the `TUDA-FSR` GitHub organisation can create projects and upload; everyone else
   can browse and download.
3. For the CLI: `klein endpoint fsr https://srv-kleinkram.fsrnet.intranet.local/api https://s3-kleinkram.fsrnet.intranet.local`
   then `klein login --oauth-provider github`.
   :::

## Install the FSR root certificate first

::: danger Skip this and uploads fail silently
The instance's TLS certificate is issued by FSR's **internal** certificate authority, not a
public one. Until your machine trusts that CA, the browser cannot talk to the upload server
(`s3-kleinkram…`), and the `klein` CLI cannot talk to anything. The symptom is an upload that
creates an empty file entry and then aborts immediately — with no error message that points at
certificates. **This affects Firefox users on FSR Windows PCs too**, see step 3.
:::

1. **Download** the root certificate:

    **https://docs-kleinkram.fsrnet.intranet.local/fsrnet-root.crt**

    Your browser will show a certificate warning on that link — the docs site uses the same CA.
    That is expected the first time; use *Advanced → Accept the Risk and Continue* (or your
    browser's equivalent). You are only downloading a file.

2. **Trust it on your operating system:**

    ```bash
    # Ubuntu / Debian
    sudo cp fsrnet-root.crt /usr/local/share/ca-certificates/fsrnet-root.crt && sudo update-ca-certificates
    # macOS
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain fsrnet-root.crt
    ```

    **Windows, domain-joined** (FSR PCs): already trusted via Group Policy — nothing to do.
    **Windows, personal laptop:** double-click `fsrnet-root.crt` → *Install Certificate…* →
    *Local Machine* → *Place all certificates in the following store* →
    **Trusted Root Certification Authorities**.

3. **Firefox: one more step, on every OS — including FSR Windows PCs.** Firefox keeps its own
   certificate store and ignores step 2 unless an admin has set
   `security.enterprise_roots.enabled` for you.

    `about:preferences#privacy` → *Certificates* → **View Certificates…** → *Authorities* tab →
    **Import…** → choose `fsrnet-root.crt` → tick **"Trust this CA to identify websites"** → OK.

    Chrome, Edge and Safari use the operating-system store and need nothing further.

4. **Check:** open https://s3-kleinkram.fsrnet.intranet.local in the browser you use for
   Kleinkram. A page with an XML error such as `AccessDenied` or `InvalidRequest` **and no
   certificate warning** means you are done. A certificate warning means step 2 or 3 did not take.

5. Using the CLI? It needs two extra variables on top of this — see
   [Certificates for the CLI](#certificates-for-the-cli).

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

### Certificates for the CLI

Python's `requests` ignores the system trust store on most platforms, so trusting the CA for your
browser is not enough for `klein`. First do steps 1–2 of
[Install the FSR root certificate first](#install-the-fsr-root-certificate-first), then also set
both of these — one for the API, one for uploads:

```bash
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt   # Ubuntu path; use the file you trusted on macOS
export AWS_CA_BUNDLE=$REQUESTS_CA_BUNDLE
```

Put those two lines in your shell profile. Without them `klein` fails with
`SSLError: certificate verify failed`.

## Where things are

| What                | URL                                            |
| :------------------ | :--------------------------------------------- |
| Web app             | https://srv-kleinkram.fsrnet.intranet.local    |
| API (for the CLI)   | https://srv-kleinkram.fsrnet.intranet.local/api |
| Uploads/downloads   | https://s3-kleinkram.fsrnet.intranet.local     |
| This documentation  | https://docs-kleinkram.fsrnet.intranet.local   |

Admins: the operational details (certificates, upgrades, retention) are in the
[FSR Production Deployment](../development/deployment/fsr-deployment.md) developer page.
