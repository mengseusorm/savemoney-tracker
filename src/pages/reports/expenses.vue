<script setup lang="ts">
import { computed, h, ref, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { ApiError, apiFetch } from '../../utils/api'
import { formatCurrency, formatDate, formatOriginalCurrency } from '../../utils/money'
import { exportTableToExcel, exportTableToPdf, type ExportColumn } from '../../utils/reports'
import { useAuth } from '../../composables/useAuth'
import type { Expense, ExpenseReportResponse, SingleDataResponse } from '../../types/money'

interface ReportRange {
  start: string
  end: string
}

const UBadge = resolveComponent('UBadge')
const toast = useToast()
const { token } = useAuth()

const report = ref<ExpenseReportResponse | null>(null)
const isFetching = ref(false)
const range = ref<ReportRange>({
  start: '',
  end: ''
})

const rows = computed(() => report.value?.rows ?? [])
const topCategories = computed(() => report.value?.by_category ?? [])
const exportColumns: ExportColumn<Expense>[] = [{
  key: 'date',
  label: 'Period',
  value: row => formatExpensePeriod(row)
}, {
  key: 'title',
  label: 'Title',
  value: row => row.title
}, {
  key: 'category',
  label: 'Category',
  value: row => row.category?.name ?? '-'
}, {
  key: 'type',
  label: 'Type',
  value: row => getExpenseType(row)
}, {
  key: 'amount',
  label: 'Amount',
  value: row => formatOriginalCurrency(
    row.report_amount ?? row.amount,
    row.report_currency_amount ?? row.currency_amount,
    row.currency
  )
}, {
  key: 'daily_amount',
  label: 'Daily Amount',
  value: row => row.daily_amount !== null
    ? `${formatOriginalCurrency(row.daily_amount, row.daily_currency_amount, row.currency)} x ${row.report_days ?? row.daily_days ?? 0} days`
    : ''
}, {
  key: 'base',
  label: 'Base Amount',
  value: row => formatCurrency(row.report_amount ?? row.amount)
}, {
  key: 'note',
  label: 'Note',
  value: row => row.note ?? ''
}]

function showError(error: unknown) {
  toast.add({
    title: 'Unable to load expense report',
    description: error instanceof ApiError ? error.message : 'Request failed',
    icon: 'i-lucide-alert-circle',
    color: 'error'
  })
}

function formatExpensePeriod(expense: Expense) {
  const start = formatDate(expense.expense_date)
  const end = expense.expense_end_date ? formatDate(expense.expense_end_date) : start

  return start === end ? start : `${start} - ${end}`
}

function isRangeExpense(expense: Expense) {
  return Boolean(expense.expense_end_date && expense.expense_end_date.slice(0, 10) !== expense.expense_date.slice(0, 10))
}

function getExpenseType(expense: Expense) {
  if (expense.is_daily_expense) return 'Daily'

  return isRangeExpense(expense) ? 'Range' : 'One-time'
}

async function loadReport(nextRange = range.value) {
  if (!token.value || !nextRange.start || !nextRange.end) return

  isFetching.value = true
  range.value = nextRange

  try {
    const params = new URLSearchParams({
      from_date: nextRange.start,
      to_date: nextRange.end
    })
    const response = await apiFetch<SingleDataResponse<ExpenseReportResponse>>(`/reports/expenses?${params}`, {
      token: token.value
    })

    report.value = response.data
  } catch (error) {
    showError(error)
  } finally {
    isFetching.value = false
  }
}

function exportExcel() {
  exportTableToExcel('expense-report', 'Expense Report', rows.value, exportColumns)
}

function exportPdf() {
  exportTableToPdf('Expense Report', rows.value, exportColumns)
}

const columns: TableColumn<Expense>[] = [{
  accessorKey: 'expense_date',
  header: 'Period',
  cell: ({ row }) => formatExpensePeriod(row.original)
}, {
  accessorKey: 'title',
  header: 'Expense',
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'font-medium text-highlighted truncate' }, row.original.title),
    h('p', { class: 'text-sm text-muted truncate' }, row.original.note || 'No note')
  ])
}, {
  accessorKey: 'category.name',
  header: 'Category',
  cell: ({ row }) => h(UBadge, { variant: 'subtle', color: 'neutral' }, () => row.original.category?.name ?? '-')
}, {
  accessorKey: 'is_daily_expense',
  header: 'Type',
  cell: ({ row }) => h(UBadge, {
    variant: 'subtle',
    color: row.original.is_daily_expense ? 'primary' : 'neutral'
  }, () => getExpenseType(row.original))
}, {
  accessorKey: 'amount',
  header: 'Amount',
  cell: ({ row }) => h('div', undefined, [
    h('p', { class: 'font-medium text-error' }, formatOriginalCurrency(
      row.original.report_amount ?? row.original.amount,
      row.original.report_currency_amount ?? row.original.currency_amount,
      row.original.currency
    )),
    h('p', { class: 'text-xs text-muted' }, row.original.daily_amount !== null
      ? `${row.original.is_daily_expense ? 'Daily' : 'Range'}: ${formatOriginalCurrency(row.original.daily_amount, row.original.daily_currency_amount, row.original.currency)} x ${row.original.report_days ?? row.original.daily_days ?? 0} days`
      : `Base: ${formatCurrency(row.original.report_amount ?? row.original.amount)}`)
  ])
}]
</script>

<template>
  <UDashboardPanel id="expense-reports">
    <template #header>
      <UDashboardNavbar title="Expense Reports">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Excel"
            icon="i-lucide-file-spreadsheet"
            color="neutral"
            variant="subtle"
            :disabled="!rows.length"
            @click="exportExcel"
          />
          <UButton
            label="PDF"
            icon="i-lucide-file-text"
            color="neutral"
            variant="subtle"
            :disabled="!rows.length"
            @click="exportPdf"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <ReportDateRangeFilter @change="loadReport" />

      <div class="grid gap-3 sm:grid-cols-3">
        <UPageCard title="Total expenses" :description="formatCurrency(report?.total_amount)">
          <template #leading>
            <UIcon name="i-lucide-trending-down" class="size-5 text-error" />
          </template>
        </UPageCard>
        <UPageCard title="Records" :description="String(report?.count ?? 0)">
          <template #leading>
            <UIcon name="i-lucide-list" class="size-5 text-muted" />
          </template>
        </UPageCard>
        <UPageCard title="Range" :description="`${range.start || '-'} - ${range.end || '-'}`">
          <template #leading>
            <UIcon name="i-lucide-calendar" class="size-5 text-muted" />
          </template>
        </UPageCard>
      </div>

      <UPageCard title="Expenses by category" variant="subtle">
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="category in topCategories"
            :key="category.name"
            class="rounded-md border border-default p-3"
          >
            <div class="font-medium text-highlighted">
              {{ category.name }}
            </div>
            <div class="text-sm text-muted">
              {{ category.count }} records
            </div>
            <div class="mt-2 font-semibold text-error">
              {{ formatCurrency(category.total_amount) }}
            </div>
          </div>
        </div>
      </UPageCard>

      <UTable
        :data="rows"
        :columns="columns"
        :loading="isFetching"
        class="shrink-0"
      />
    </template>
  </UDashboardPanel>
</template>
