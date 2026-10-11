import { computed, onUnmounted, ref } from 'vue'
import { roomNow } from '@/domain/time'

export function useRoomClock() {
  const now = ref(new Date())
  const timer = window.setInterval(() => {
    now.value = new Date()
  }, 15_000)
  onUnmounted(() => window.clearInterval(timer))
  const current = computed(() => roomNow(now.value))
  return { now, current }
}
