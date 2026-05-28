<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'

interface ReportRange {
  start: string
  end: string
}

const emit = defineEmits<{
  change: [range: ReportRange]
}>()

const now = today(getLocalTimeZone())
const value = shallowRef<{
  start: DateValue | undefined
  end: DateValue | undefined
} | null>({
  start: now.subtract({ days: 6 }),
  end: now
})

const presets = [{
  label: 'This week',
  getRange: () => {
    const end = today(getLocalTimeZone())
    return { start: end.subtract({ days: 6 }), end }
  }
}, {
  label: 'This month',
  getRange: () => {
    const end = today(getLocalTimeZone())
    return { start: new CalendarDate(end.year, end.month, 1), end }
  }
}, {
  label: 'This year',
  getRange: () => {
    const end = today(getLocalTimeZone())
    return { start: new CalendarDate(end.year, 1, 1), end }
  }
}, {
  label: 'Last 30 days',
  getRange: () => {
    const end = today(getLocalTimeZone())
    return { start: end.subtract({ days: 29 }), end }
  }
}]

const rangeLabel = computed(() => {
  if (!value.value?.start) return 'Pick a date range'
  if (!value.value.end) return `${value.value.start.toString()} - ...`

  return `${value.value.start.toString()} - ${value.value.end.toString()}`
})

watch(value, (range) => {
  if (!range?.start || !range.end) return

  emit('change', {
    start: range.start.toString(),
    end: range.end.toString()
  })
}, { immediate: true })

function selectPreset(preset: typeof presets[number]) {
  value.value = preset.getRange()
}
</script>

<template>
  <div class="flex flex-wrap items-start gap-3">
    <UPopover :content="{ align: 'start' }" :modal="true">
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-calendar"
        trailing-icon="i-lucide-chevron-down"
        :label="rangeLabel"
      />

      <template #content>
        <UCalendar
          v-model="value"
          range
          :number-of-months="2"
          class="p-2"
        />
      </template>
    </UPopover>

    <div class="flex flex-wrap gap-1.5">
      <UButton
        v-for="preset in presets"
        :key="preset.label"
        :label="preset.label"
        color="neutral"
        variant="subtle"
        @click="selectPreset(preset)"
      />
    </div>
  </div>
</template>
