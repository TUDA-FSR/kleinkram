import { AuthService } from '@/services/auth.service';
import { AuthFlowException } from '@/types/auth-flow-exception';
import env from '@kleinkram/backend-common/environment';
import accessConfig from '@/access_config.json';
import { Providers } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import axios from 'axios';
import e from 'express';
import { Strategy } from 'passport-github2';
import logger from '../../logger';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(private authService: AuthService) {
        super({
            clientID: env.GITHUB_CLIENT_ID ?? 'dummy',
            clientSecret: env.GITHUB_CLIENT_SECRET ?? 'dummy',
            callbackURL: `${env.BACKEND_URL}/auth/github/callback`,
            // read:org is needed to list the user's organisations, which we
            // use for GITHUB_ALLOWED_ORGS (login allowlist) and for the
            // github_orgs rules in access_config.json (member/guest groups).
            scope: GitHubStrategy.needsOrgScope()
                ? ['user:email', 'user:profile', 'read:org']
                : ['user:email', 'user:profile'],
        });
    }

    private static needsOrgScope(): boolean {
        return (
            env.GITHUB_ALLOWED_ORGS.length > 0 ||
            (accessConfig.github_orgs?.length ?? 0) > 0
        );
    }

    /**
     * Lower-cased logins of the organisations the user belongs to. Uses the
     * user's own token, so private memberships count as long as the org has
     * approved this OAuth App (org settings -> Third-party access). Returns []
     * when the read:org scope was not requested.
     */
    private async fetchUserOrgs(accessToken: string): Promise<string[]> {
        if (!GitHubStrategy.needsOrgScope()) return [];
        const logins: string[] = [];
        for (let page = 1; page <= 10; page++) {
            const response = await axios.get<{ login: string }[]>(
                'https://api.github.com/user/orgs',
                {
                    params: { per_page: 100, page },
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                    timeout: 10_000,
                },
            );
            logins.push(...response.data.map((org) => org.login.toLowerCase()));
            if (response.data.length < 100) break;
        }
        return logins;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authenticate(request: e.Request, options?: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        options.state = request.query.state;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        super.authenticate(request, options);
    }

    async validate(
        accessToken: string,
        _refreshToken: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        profile: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { provider } = profile;

        // currently only github is supported
        if (provider !== Providers.GITHUB) {
            logger.error('Invalid provider, expected github but got', provider);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            callback(new AuthFlowException('Invalid provider!'));
            return;
        }

        // Enforce org membership BEFORE any user/account row is created, so
        // rejected logins leave nothing behind.
        let orgs: string[] = [];
        try {
            orgs = await this.fetchUserOrgs(accessToken);
        } catch (error) {
            logger.error('GitHub organisation lookup failed', error);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            callback(
                new AuthFlowException(
                    'Could not verify GitHub organisation membership, please try again',
                ),
            );
            return;
        }
        const allowed = env.GITHUB_ALLOWED_ORGS;
        const isMember =
            allowed.length === 0 || orgs.some((o) => allowed.includes(o));
        if (!isMember) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            logger.warn(`Login denied for GitHub user ${String(profile.username)}: not a member of ${env.GITHUB_ALLOWED_ORGS.join(', ')}`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            callback(
                new AuthFlowException(
                    'Access is limited to members of the FSR GitHub organisation',
                ),
            );
            return;
        }

        const user = await this.authService.validateAndCreateUserByGitHub(
            profile,
            orgs,
        );

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (user) {
            logger.debug(`Login successful for ${user.uuid}`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            callback(null, user);
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        callback(null);
        return;
    }
}
