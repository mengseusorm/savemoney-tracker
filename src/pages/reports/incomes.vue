<script setup lang="ts">
import { computed, h, ref, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { ApiError, apiFetch } from '../../utils/api'
import { formatCurrency, formatDate, formatOriginalCurrency } from '../../utils/money'
import { exportTableToExcel, exportTableToPdf, type ExportColumn } from '../../utils/reports'
import { useAuth } from '../../composables/useAuth'
import type { Income, IncomeReportResponse, SingleDataResponse } from '../../types/money'

interface ReportRange {
  start: string
  end: string
}

const UBadge = resolveComponent('UBadge')
const toast = useToast()
const { token } = useAuth()

const report = ref<IncomeReportResponse | null>(null)
const isFetching = ref(false)
const range = ref<ReportRange>({
  start: '',
  end: ''
})

const rows = computed(() => report.value?.rows ?? [])
const topSources = computed(() => report.value?.by_source ?? [])
const exportColumns: ExportColumn<Income>[] = [{
  key: 'date',
  label: 'Period',
  value: row => formatIncomePeriod(row)
}, {
  key: 'title',
  label: 'Title',
  value: row => row.title
}, {
  key: 'source',
  label: 'Source',
  value: row => row.source?.name ?? '-'
}, {
  key: 'amount',
  label: 'Amount',
  value: row => formatOriginalCurrency(row.amount, row.currency_amount, row.currency)
}, {
  key: 'base',
  label: 'Base Amount',
  value: row => formatCurrency(row.amount)
}, {
  key: 'note',
  label: 'Note',
  value: row => row.note ?? ''
}]

function showError(error: unknown) {
  toast.add({
    title: 'Unable to load income report',
    description: error instanceof ApiError ? error.message : 'Request failed',
    icon: 'i-lucide-alert-circle',
    color: 'error'
  })
}

function formatIncomePeriod(income: Income) {
  const start = formatDate(income.income_date)
  const end = income.income_end_date ? formatDate(income.income_end_date) : start

  return start === end ? start : `${start} - ${end}`
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
    const response = await apiFetch<SingleDataResponse<IncomeReportResponse>>(`/reports/incomes?${params}`, {
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
  exportTableToExcel('income-report', 'Income Report', rows.value, exportColumns)
}

function exportPdf() {
  exportTableToPdf('Income Report', rows.value, exportColumns)
}

const columns: TableColumn<Income>[] = [{
  accessorKey: 'income_date',
  header: 'Period',
  cell: ({ row }) => formatIncomePeriod(row.original)
}, {
  accessorKey: 'title',
  header: 'Income',
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'font-medium text-highlighted truncate' }, row.original.title),
    h('p', { class: 'text-sm text-muted truncate' }, row.original.note || 'No note')
  ])
}, {
  accessorKey: 'source.name',
  header: 'Source',
  cell: ({ row }) => h(UBadge, { variant: 'subtle', color: 'neutral' }, () => row.original.source?.name ?? '-')
}, {
  accessorKey: 'amount',
  header: 'Amount',
  cell: ({ row }) => h('div', undefined, [
    h('p', { class: 'font-medium text-success' }, formatOriginalCurrency(
      row.original.amount,
      row.original.currency_amount,
      row.original.currency
    )),
    h('p', { class: 'text-xs text-muted' }, `Base: ${formatCurrency(row.original.amount)}`)
  ])
}]
</script>

<template>
  <UDashboardPanel id="income-reports">
    <template #header>
      <UDashboardNavbar title="Income Reports">
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
        <UPageCard title="Total income" :description="formatCurrency(report?.total_amount)">
          <template #leading>
            <UIcon name="i-lucide-trending-up" class="size-5 text-success" />
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

      <UPageCard title="Income by source" variant="subtle">
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="source in topSources"
            :key="source.name"
            class="rounded-md border border-default p-3"
          >
            <div class="font-medium text-highlighted">
              {{ source.name }}
            </div>
            <div class="text-sm text-muted">
              {{ source.count }} records
            </div>
            <div class="mt-2 font-semibold text-success">
              {{ formatCurrency(source.total_amount) }}
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
