import type { Currency } from '../types/money'

export function formatCurrency(value: number | string | null | undefined, currency = 'USD') { 
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency
  }).format(Number(value ?? 0))
}

export function formatOriginalCurrency(
  baseAmount: number | string | null | undefined,
  currencyAmount?: number | string | null,
  currency?: Currency | null
) {
  if (!currency) return formatCurrency(baseAmount)

  return formatCurrency(currencyAmount ?? baseAmount, currency.code)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(value))
}

export function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}
