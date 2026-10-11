<script setup lang="ts">
import { ref } from 'vue'
import { demoApi, type DemoScenario } from '@/api/bookings'
import { useBookingsStore } from '@/stores/bookings'

const store = useBookingsStore()
const busy = ref(false)
const message = ref('')

async function run(scenario?: DemoScenario) {
  busy.value = true
  try {
    if (scenario) await demoApi.scenario(scenario)
    else await demoApi.reset()

    if (!scenario || scenario === 'list-error') await store.load()
    message.value = !scenario
      ? 'Данные сброшены'
      : scenario === 'list-error'
        ? 'Ошибка загрузки включена'
        : scenario === 'normal'
          ? 'Обычный режим'
          : `Следующая операция: ${scenario === 'conflict' ? '409' : '503'}`
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Ошибка'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <details class="demo-panel">
    <summary>Демо</summary>
    <div class="demo-buttons">
      <button type="button" :disabled="busy" @click="run('conflict')">
        Конфликт при сохранении (409)
      </button>
      <button type="button" :disabled="busy" @click="run('mutation-error')">
        Ошибка сохранения (503)
      </button>
      <button type="button" :disabled="busy" @click="run('list-error')">
        Ошибка загрузки
      </button>
      <button type="button" :disabled="busy" @click="run('normal')">
        Обычный режим
      </button>
      <button type="button" :disabled="busy" @click="run()">
        Сбросить демо-данные
      </button>
      <span v-if="message" role="status">{{ message }}</span>
    </div>
  </details>
</template>

<style lang="scss" scoped src="./DemoPanel.scss"></style>
