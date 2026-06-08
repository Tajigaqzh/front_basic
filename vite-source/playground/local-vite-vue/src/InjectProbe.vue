<script setup lang="ts">
import { inject } from 'vue'

const injected = inject<string>('local-token', 'missing')
</script>

<template>
  <span data-inject-probe class="mono">{{ injected }}</span>
</template>
