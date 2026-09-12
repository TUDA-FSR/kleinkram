# Implementation

Three methods of authentication are supported: Google OAuth, GitHub OAuth, and Api Keys.
Regular users authenticate with one of the OAuth providers (an instance may offer only one — the
FSR instance offers GitHub only). Api keys are only used for actions.

## OAuth Authentication (Google / GitHub)

We use the standard JWT auth flow.
The user logs in at the provider, which validates the login, upon which the backend issues a JWT.

The passport strategies live in `backend/src/endpoints/auth/*.strategy.ts`. Callback routes are
`${BACKEND_URL}/auth/<provider>/callback` — the API has no global route prefix, so a reverse proxy
that mounts the API under `/api` must strip that prefix.

On every successful login the backend:

1. finds or creates the `account` + `user` rows (display name falls back to the provider username,
   then to the email local-part, because GitHub's *Name* field is optional);
2. creates the user's **primary group** on first login;
3. synchronises the user's **affiliation groups** — see below.

::: details GitHub organisation membership
When `GITHUB_ALLOWED_ORGS` is set or `access_config.json` contains `github_orgs` rules, the GitHub
strategy requests the additional `read:org` scope and lists the user's organisations with the
user's own token (`GET /user/orgs`). The list is used to enforce the allowlist (before any rows are
created) and is then passed to the affiliation sync. Private memberships are visible only if the
OAuth App is owned by or approved in the organisation.
:::

Within the JWT is only the user UUID.
Upon each request, the backend checks the JWT and retrieves the user from the database.
Using this User, using guards, each endpoint validates whether the user has the required rights to access the endpoint.

Common guards are:

- @LoggedIn() - Checks if the user is logged in
- @AdminOnly() - Checks if the user is an admin
- @UserOnly() - Checks if the user is a regular user and not an Api key
- @CanReadProject() - Checks if the user has read rights to the project
- ...

Endpoints that list data, like /oldProject/filtered are often guarded by @UserOnly() and
handle the filtering of the data based on the user rights internally. They will only return the data the user has access to.
For this, the helper function [`addAccessConstraints`](/development/access-control/addAccessConstraints) is used.

## Affiliation Groups

`backend/src/access_config.json` declares the affiliation groups and the rules that place users
into them. The groups are created at API start-up if missing (they are never renamed or deleted
by the application). Rules are evaluated on every login.

```json
{
    "emails": [
        { "email": "roboticscorp.com", "access_groups": ["<group-uuid>"] }
    ],
    "github_orgs": [
        {
            "org": "TUDA-FSR",
            "member_access_groups": ["<member-uuid>"],
            "non_member_access_groups": ["<guest-uuid>"]
        }
    ],
    "access_groups": [
        { "name": "FSR Member", "uuid": "<member-uuid>", "rights": 10,
          "can_create_projects": true,  "default_for_all_projects": true },
        { "name": "FSR Guest",  "uuid": "<guest-uuid>",  "rights": 0,
          "can_create_projects": false, "default_for_all_projects": true }
    ]
}
```

| Key                                       | Meaning                                                                                                          |
| :---------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| `emails[].email`                          | Suffix match on the login email (`""` matches every user). Adds to the listed groups; never removes.             |
| `github_orgs[]`                           | Members of `org` are put into `member_access_groups` and removed from `non_member_access_groups`; non-members the reverse. Requires the GitHub provider. |
| `access_groups[].rights`                  | Access level this group receives on a new project when it is a default group for that project.                   |
| `access_groups[].can_create_projects`     | Default `true`. `false` means membership does not satisfy `ProjectGuardService.canCreate()` — a read-only tier.  |
| `access_groups[].default_for_all_projects`| Default `false`. `true` attaches the group (with `rights`) to **every** new project. Otherwise, as upstream, a new project only gets the *creator's* affiliation groups. |

Upstream logic, unchanged: any affiliation membership grants project creation, and a new project's
default access groups are the creator's non-custom groups (primary group with <Delete/>, affiliation
groups with their configured `rights`). The two flags above were added so a deployment can have a
guest tier that can read everything but create nothing.

## Api Key Authentication

Api keys are currently only used for actions. An Api key grants access in the name of the user that created the key / action.
An Api key has a:

- User - Whom it represents
- Mission - For which it grants access
- Action - In which it is used
- Rights - The rights it grants

As an Api key inherits its rights from the user, on key creation, the rights it has are at maximum the rights of the user on the mission.
Api keys have no rights on projects, only on missions. Thus many listing operations like listing projects and missions are not allowed for Api keys (@UserOnly() guard).

In the middleware (backend/src/UserResolverMiddleware.ts), before the JWT is checked & resolved, the Api key is checked. If an Api key is present,
the user is resolved to the user the key represents. Written into the request object is `req.user = {user: User, apiKey: ApiKey}`.

Each guard is responsible for detecting whether an Api key is present and if so, whether the key grants the required rights.

Files or other entities that are created with an Api key have as the creator the user the key represents.
