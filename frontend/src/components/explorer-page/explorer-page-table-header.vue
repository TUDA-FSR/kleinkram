<template>
    <div>
        <template v-if="urlHandler.isListingMissions">
            <h2 class="text-h6 q-mb-xs">Explore all Missions of Project</h2>
            <HelpMessage
                text="You can only see missions on which you have at least view access on project level or mission level."
                :link="docsLink"
            />
        </template>

        <template v-if="urlHandler.isListingFiles">
            <h2 class="text-h6 q-mb-xs">Explore all Files of Mission</h2>
            <HelpMessage
                text="You can only see files of missions you have access to."
                :link="docsLink"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import HelpMessage from 'components/help-message.vue';
import ENV from 'src/environment';
import { QueryHandler } from 'src/services/query-handler';
defineProps({
    urlHandler: {
        type: QueryHandler,
        required: true,
    },
});

// Instance docs (VITE_DOCS_URL) rather than a hard-coded host.
const docsLink = `${ENV.DOCS_URL.replace(/\/$/, '')}/usage/getting-started.html`;
</script>
