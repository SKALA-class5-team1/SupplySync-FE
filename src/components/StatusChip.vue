<script setup lang="ts">
defineProps<{ label: string; cls: string }>()
</script>

<template>
  <span class="chip" :class="cls">{{ label }}</span>
</template>
