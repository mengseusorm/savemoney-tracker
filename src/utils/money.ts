export function formatCurrency(value: number | string | null | undefined, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency
  }).format(Number(value ?? 0))
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
