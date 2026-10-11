<script setup lang="ts">
import { ref } from 'vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { RiArrowDownSLine } from '@remixicon/vue'
import { DAY_END, DAY_START, toMinutes, toTime } from '@/domain/time'

const props = defineProps<{
  modelValue: string
  id: string
  label: string
  invalid?: boolean
  describedby?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>()
const open = ref(false)
const options = Array.from({ length: 37 }, (_, index) => DAY_START + index * 15)

function input(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
function blur() {
  const raw = props.modelValue.trim()
  if (/^\d{1,2}[:.]\d{2}$/.test(raw)) {
    const [hour, minute] = raw.split(/[:.]/)
    emit('update:modelValue', `${hour!.padStart(2, '0')}:${minute}`)
  }
  emit('blur')
}
function choose(time: number) {
  emit('update:modelValue', toTime(time))
  open.value = false
}
function adjust(event: KeyboardEvent) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  event.preventDefault()
  const minutes = toMinutes(props.modelValue)
  if (!Number.isFinite(minutes)) return
  const next = Math.max(
    DAY_START,
    Math.min(
      DAY_END,
      minutes + (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 15 : 1),
    ),
  )
  emit('update:modelValue', toTime(next))
}
</script>

<template>
  <div class="time-control" :class="{ invalid, disabled }">
    <input
      :id="id"
      :value="modelValue"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      maxlength="5"
      :aria-label="label"
      :aria-invalid="invalid"
      :aria-describedby="describedby"
      :disabled="disabled"
      @input="input"
      @blur="blur"
      @keydown="adjust"
    />
    <PopoverRoot v-model:open="open">
      <PopoverTrigger
        type="button"
        class="time-toggle"
        :disabled="disabled"
        :aria-label="`Выбрать время: ${label.toLowerCase()}`"
        ><RiArrowDownSLine size="19" aria-hidden="true"
      /></PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          as-child
          align="end"
          :side-offset="6"
          :collision-padding="12"
          :aria-label="label"
        >
          <div class="time-popover">
            <div class="time-options">
              <button
                v-for="time in options"
                :key="time"
                type="button"
                :class="{ selected: toTime(time) === modelValue }"
                @click="choose(time)"
              >
                {{ toTime(time) }}
              </button>
            </div>
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>

<style lang="scss" scoped src="./TimeField.scss"></style>
