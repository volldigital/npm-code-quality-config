<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ name: string; count?: number }>();
const emit = defineEmits<{ greet: [name: string] }>();

const label = computed(() => `Hello, ${props.name} (${props.count ?? 0})`);
</script>

<template>
  <ion-button @click="emit('greet', props.name)">{{ label }}</ion-button>
</template>
