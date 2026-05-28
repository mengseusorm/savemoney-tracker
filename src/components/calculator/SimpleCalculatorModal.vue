<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCurrency } from '../../utils/money'

const props = withDefaults(defineProps<{
  initialValue?: number
  currencyCode?: string
  exchangeRate?: number
  title?: string
  description?: string
}>(), {
  initialValue: 0,
  currencyCode: 'USD',
  exchangeRate: 1,
  title: 'Calculator',
  description: 'Calculate the amount before applying it.'
})

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  apply: [value: number]
}>()

const expression = ref('0')
const error = ref('')
const buttons = [
  '7', '8', '9', '/',
  '4', '5', '6', '*',
  '1', '2', '3', '-',
  '0', '.', '=', '+'
]
const result = computed(() => calculateExpression(expression.value))
const convertedAmount = computed(() => props.exchangeRate > 0 ? (result.value ?? 0) / props.exchangeRate : 0)

watch(open, (isOpen) => {
  if (isOpen) {
    expression.value = props.initialValue ? String(props.initialValue) : '0'
    error.value = ''
  }
})

function calculateExpression(value: string) {
  const tokens = value.match(/\d+(?:\.\d+)?|[+\-*/]/g)

  if (!tokens?.length) return null

  const values: number[] = []
  const operators: string[] = []
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

  function applyOperator() {
    const operator = operators.pop()
    const right = values.pop()
    const left = values.pop()

    if (!operator || left === undefined || right === undefined) return false
    if (operator === '/' && right === 0) return false

    if (operator === '+') values.push(left + right)
    if (operator === '-') values.push(left - right)
    if (operator === '*') values.push(left * right)
    if (operator === '/') values.push(left / right)

    return true
  }

  for (const token of tokens) {
    if (['+', '-', '*', '/'].includes(token)) {
      while (operators.length && precedence[operators[operators.length - 1]] >= precedence[token]) {
        if (!applyOperator()) return null
      }

      operators.push(token)
    } else {
      values.push(Number(token))
    }
  }

  while (operators.length) {
    if (!applyOperator()) return null
  }

  return values.length === 1 && Number.isFinite(values[0]) ? values[0] : null
}

function append(value: string) {
  error.value = ''

  if (value === '=') {
    calculate()
    return
  }

  if (expression.value === '0' && /\d/.test(value)) {
    expression.value = value
    return
  }

  expression.value += value
}

function calculate() {
  if (result.value === null) {
    error.value = 'Invalid calculation'
    return
  }

  expression.value = Number(result.value.toFixed(2)).toString()
}

function clear() {
  expression.value = '0'
  error.value = ''
}

function backspace() {
  expression.value = expression.value.length > 1 ? expression.value.slice(0, -1) : '0'
  error.value = ''
}

function apply() {
  if (result.value === null) {
    error.value = 'Invalid calculation'
    return
  }

  emit('apply', Number(result.value.toFixed(2)))
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="description"
  >
    <template #body>
      <div class="space-y-4">
        <div class="rounded-md border border-default bg-muted/40 p-3">
          <div class="min-h-8 break-all text-right text-xl font-semibold tabular-nums text-highlighted">
            {{ expression }}
          </div>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>{{ currencyCode }} rate: {{ exchangeRate.toFixed(6) }}</span>
            <span>Base: {{ formatCurrency(convertedAmount) }}</span>
          </div>
          <p
            v-if="error"
            class="mt-2 text-sm text-error"
          >
            {{ error }}
          </p>
        </div>

        <div class="grid grid-cols-4 gap-2">
          <UButton
            v-for="button in buttons"
            :key="button"
            :label="button"
            :color="button === '=' ? 'primary' : 'neutral'"
            :variant="button === '=' ? 'solid' : ['/', '*', '-', '+'].includes(button) ? 'subtle' : 'outline'"
            class="justify-center"
            @click="append(button)"
          />
        </div>

        <div class="grid grid-cols-3 gap-2">
          <UButton
            label="Clear"
            color="neutral"
            variant="subtle"
            @click="clear"
          />
          <UButton
            label="Back"
            color="neutral"
            variant="subtle"
            @click="backspace"
          />
          <UButton
            label="Apply"
            icon="i-lucide-check"
            @click="apply"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
