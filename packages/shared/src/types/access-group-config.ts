export interface AccessGroupConfig {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    emails: { email: string; access_groups: string[] }[];
    /**
     * Optional: assign affiliation groups by GitHub organisation membership
     * (requires the read:org OAuth scope, requested automatically when set).
     * Membership is re-evaluated on every login; users are moved between the
     * member and non-member groups when their org status changes.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    github_orgs?: {
        org: string;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        member_access_groups: string[];
        // eslint-disable-next-line @typescript-eslint/naming-convention
        non_member_access_groups: string[];
    }[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    access_groups: {
        name: string;
        uuid: string;
        rights: number;
        /** Default true. False = membership does not grant project creation. */
        // eslint-disable-next-line @typescript-eslint/naming-convention
        can_create_projects?: boolean;
        /**
         * Default false. True = this group is added (with `rights`) to every
         * new project, not only to projects created by its own members.
         */
        // eslint-disable-next-line @typescript-eslint/naming-convention
        default_for_all_projects?: boolean;
    }[];
}
