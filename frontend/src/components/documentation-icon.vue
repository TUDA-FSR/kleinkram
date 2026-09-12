<template>
    <q-btn
        :href="documentationLink"
        round
        flat
        color="grey-8"
        target="_blank"
        icon="sym_o_help"
    >
        <q-tooltip> Support</q-tooltip>
    </q-btn>
</template>
<script setup lang="ts">
import ENV from 'src/environment';

const { link } = defineProps<{ link?: string }>();

// Use the instance's own docs (VITE_DOCS_URL) instead of a hard-coded host,
// so self-hosted deployments link to their documentation.
const documentationBasePath = ENV.DOCS_URL.replace(/\/$/, '');
const documentationDefaultPath = '/usage/getting-started';

const documentationLink =
    link ?? documentationBasePath + documentationDefaultPath;
</script>
