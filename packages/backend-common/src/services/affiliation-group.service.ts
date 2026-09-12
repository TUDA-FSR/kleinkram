import { AccessGroupConfig, AccessGroupType } from '@kleinkram/shared';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGroupEntity } from '../entities/auth/access-group.entity';
import { GroupMembershipEntity } from '../entities/auth/group-membership.entity';
import { UserEntity } from '../entities/user/user.entity';

@Injectable()
export class AffiliationGroupService {
    private readonly logger = new Logger(AffiliationGroupService.name);

    constructor(
        @InjectRepository(AccessGroupEntity)
        private accessGroupRepository: Repository<AccessGroupEntity>,
        @InjectRepository(GroupMembershipEntity)
        private groupMembershipRepository: Repository<GroupMembershipEntity>,
    ) {}

    /**
     * Create access groups from the access group config.
     *
     * @param config
     */
    async createAccessGroups(config: AccessGroupConfig): Promise<void> {
        // Read access_config/*.json and create access groups
        await Promise.all(
            config.access_groups.map(async (group) => {
                const databaseGroup = await this.accessGroupRepository.findOne({
                    where: { uuid: group.uuid },
                });
                if (!databaseGroup) {
                    const newGroup = this.accessGroupRepository.create({
                        name: group.name,
                        uuid: group.uuid,
                        type: AccessGroupType.AFFILIATION,
                        creator: {},
                    });
                    return this.accessGroupRepository.save(newGroup);
                }
                return;
            }),
        );
    }

    /**
     * Create a primary access group for the user.
     *
     * @param user
     */
    async createPrimaryGroup(user: UserEntity): Promise<void> {
        let primaryGroupName = user.name;

        const exists = await this.accessGroupRepository.exists({
            where: { name: primaryGroupName },
        });

        if (exists) {
            const randomSuffix = Math.random().toString(36).slice(7);
            primaryGroupName = `${user.name} ${randomSuffix}`;
            this.logger.debug(
                `Primary group name already exists, using ${primaryGroupName}`,
            );
        }

        const primaryGroup = this.accessGroupRepository.create({
            name: primaryGroupName,
            type: AccessGroupType.PRIMARY,
            hidden: false,
            memberships: [
                {
                    canEditGroup: false,
                    user: { uuid: user.uuid },
                },
            ],
        });
        await this.accessGroupRepository.save(primaryGroup);
    }

    /**
     * Sync affiliation groups derived from GitHub organisation membership.
     * For each configured org the user is placed in the member groups and
     * removed from the non-member groups (or vice versa), so a change in org
     * status takes effect on the next login. No-op without github_orgs config.
     */
    async syncGithubOrgGroups(
        config: AccessGroupConfig,
        user: UserEntity,
        userOrgLogins: string[],
    ): Promise<void> {
        const rules = config.github_orgs ?? [];
        if (rules.length === 0) return;
        const orgs = new Set(userOrgLogins.map((o) => o.toLowerCase()));

        for (const rule of rules) {
            const isMember = orgs.has(rule.org.toLowerCase());
            const wanted = isMember
                ? rule.member_access_groups
                : rule.non_member_access_groups;
            const unwanted = isMember
                ? rule.non_member_access_groups
                : rule.member_access_groups;

            for (const uuid of unwanted) {
                await this.groupMembershipRepository.delete({
                    user: { uuid: user.uuid },
                    accessGroup: { uuid },
                });
            }
            for (const uuid of wanted) {
                const exists = await this.groupMembershipRepository.exists({
                    where: {
                        user: { uuid: user.uuid },
                        accessGroup: { uuid },
                    },
                });
                if (!exists) {
                    await this.groupMembershipRepository.save(
                        this.groupMembershipRepository.create({
                            user: { uuid: user.uuid },
                            accessGroup: { uuid },
                        }),
                    );
                }
            }
            this.logger.debug(
                `GitHub org ${rule.org}: user ${user.uuid} is ${isMember ? 'a member' : 'not a member'}`,
            );
        }
    }

    /**
     * Add user to affiliation groups based on their email address.
     *
     * @param config
     * @param user
     * @param overrideEmail Override email if user entity email is unset
     */
    async addToAffiliationGroups(
        config: AccessGroupConfig,
        user: UserEntity,
        overrideEmail?: string,
    ): Promise<void> {
        const resolvingEmail = overrideEmail ?? user.email;

        if (!resolvingEmail) {
            this.logger.warn(
                `Cannot assign affiliation groups for user ${user.uuid}: no email available`,
            );
            return;
        }

        await Promise.all(
            // eslint-disable-next-line @typescript-eslint/await-thenable
            config.emails.map((_config) => {
                if (resolvingEmail.endsWith(_config.email)) {
                    return Promise.all(
                        _config.access_groups.map(async (uuid) => {
                            const group =
                                await this.accessGroupRepository.findOneOrFail({
                                    where: { uuid },
                                });

                            const existingMembership =
                                await this.groupMembershipRepository.findOne({
                                    where: {
                                        user: { uuid: user.uuid },
                                        accessGroup: { uuid: group.uuid },
                                    },
                                    relations: {
                                        accessGroup: true,
                                        user: true,
                                    },
                                });

                            if (!existingMembership) {
                                const affiliationGroup =
                                    this.groupMembershipRepository.create({
                                        user: { uuid: user.uuid },
                                        accessGroup: { uuid: group.uuid },
                                    });
                                return this.groupMembershipRepository.save(
                                    affiliationGroup,
                                );
                            }
                            return;
                        }),
                    );
                }
                return;
            }),
        );
    }
}
