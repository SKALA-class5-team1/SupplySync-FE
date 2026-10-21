<script setup lang="ts">
// 아티팩트의 진행 트랙. index 이전은 완료, index는 현재 단계다.
defineProps<{ items: string[]; index: number }>()
</script>

<template>
  <div class="track wide" aria-label="진행 단계">
    <div v-for="(t, i) in items" :key="t" :class="i < index ? 'done' : i === index ? 'cur' : ''">
      <b>{{ t }}</b>
      {{ i < index ? '완료' : i === index ? '진행 중' : '대기' }}
    </div>
  </div>
</template>
