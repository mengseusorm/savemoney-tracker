<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError, apiFetch } from '../../utils/api'
import { formatCurrency } from '../../utils/money'
import { useAuth } from '../../composables/useAuth'
import type { SingleDataResponse, SummaryReportResponse } from '../../types/money'

interface ReportRange {
  start: string
  end: string
}

const toast = useToast()
const { token } = useAuth()

const report = ref<SummaryReportResponse | null>(null)
const isFetching = ref(false)
const range = ref<ReportRange>({
  start: '',
  end: ''
})

const totalIncome = computed(() => Number(report.value?.total_income ?? 0))
const totalExpense = computed(() => Number(report.value?.total_expense ?? 0))
const balance = computed(() => Number(report.value?.balance ?? 0))
const totalMovement = computed(() => totalIncome.value + totalExpense.value)
const incomeShare = computed(() => totalMovement.value > 0 ? Math.round((totalIncome.value / totalMovement.value) * 100) : 0)
const expenseShare = computed(() => totalMovement.value > 0 ? 100 - incomeShare.value : 0)
const expenseRatio = computed(() => totalIncome.value > 0 ? Math.round((totalExpense.value / totalIncome.value) * 100) : 0)
const statusText = computed(() => {
  if (balance.value > 0) return 'Income is higher than expenses'
  if (balance.value < 0) return 'Expenses are higher than income'

  return 'Income and expenses are balanced'
})
const topSources = computed(() => (report.value?.income_by_source ?? [])
  .filter(source => Number(source.total_amount) > 0)
  .sort((a, b) => Number(b.total_amount) - Number(a.total_amount)))
const topCategories = computed(() => (report.value?.expense_by_category ?? [])
  .filter(category => Number(category.total_amount) > 0)
  .sort((a, b) => Number(b.total_amount) - Number(a.total_amount)))

function showError(error: unknown) {
  toast.add({
    title: 'Unable to load comparison',
    description: error instanceof ApiError ? error.message : 'Request failed',
    icon: 'i-lucide-alert-circle',
    color: 'error'
  })
}

async function loadComparison(nextRange = range.value) {
  if (!token.value || !nextRange.start || !nextRange.end) return

  isFetching.value = true
  range.value = nextRange

  try {
    const params = new URLSearchParams({
      from_date: nextRange.start,
      to_date: nextRange.end
    })
    const response = await apiFetch<SingleDataResponse<SummaryReportResponse>>(`/reports/summary?${params}`, {
      token: token.value
    })

    report.value = response.data
  } catch (error) {
    showError(error)
  } finally {
    isFetching.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="compare-reports">
    <template #header>
      <UDashboardNavbar title="Compare Income & Expenses">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Income report"
            icon="i-lucide-trending-up"
            color="neutral"
            variant="subtle"
            to="/reports/incomes"
          />
          <UButton
            label="Expense report"
            icon="i-lucide-trending-down"
            color="neutral"
            variant="subtle"
            to="/reports/expenses"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <ReportDateRangeFilter @change="loadComparison" />

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UPageCard title="Income" :description="formatCurrency(totalIncome)">
          <template #leading>
            <UIcon name="i-lucide-trending-up" class="size-5 text-success" />
          </template>
        </UPageCard>
        <UPageCard title="Expenses" :description="formatCurrency(totalExpense)">
          <template #leading>
            <UIcon name="i-lucide-trending-down" class="size-5 text-error" />
          </template>
        </UPageCard>
        <UPageCard title="Balance" :description="formatCurrency(balance)">
          <template #leading>
            <UIcon
              name="i-lucide-scale"
              class="size-5"
              :class="balance >= 0 ? 'text-success' : 'text-error'"
            />
          </template>
        </UPageCard>
        <UPageCard title="Expense ratio" :description="`${expenseRatio}%`">
          <template #leading>
            <UIcon name="i-lucide-percent" class="size-5 text-muted" />
          </template>
        </UPageCard>
      </div>

      <UPageCard title="Comparison" :description="statusText">
        <div class="space-y-5">
          <div class="overflow-hidden rounded-sm bg-muted">
            <div class="flex h-5">
              <div class="bg-success" :style="{ width: `${incomeShare}%` }" />
              <div class="bg-error" :style="{ width: `${expenseShare}%` }" />
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <div>
              <div class="text-sm text-muted">
                Income share
              </div>
              <div class="text-xl font-semibold text-success">
                {{ incomeShare }}%
              </div>
            </div>
            <div>
              <div class="text-sm text-muted">
                Expense share
              </div>
              <div class="text-xl font-semibold text-error">
                {{ expenseShare }}%
              </div>
            </div>
            <div>
              <div class="text-sm text-muted">
                Range
              </div>
              <div class="text-base font-semibold text-highlighted">
                {{ range.start || '-' }} - {{ range.end || '-' }}
              </div>
            </div>
          </div>
        </div>
      </UPageCard>

      <div class="grid gap-4 lg:grid-cols-2">
        <UPageCard title="Income sources" variant="subtle">
          <div class="space-y-3">
            <div
              v-for="source in topSources"
              :key="source.id"
              class="flex items-center justify-between gap-3"
            >
              <span class="truncate text-sm text-highlighted">{{ source.name }}</span>
              <span class="shrink-0 text-sm font-medium text-success">{{ formatCurrency(source.total_amount) }}</span>
            </div>
            <p v-if="!topSources.length" class="text-sm text-muted">
              No income in this range.
            </p>
          </div>
        </UPageCard>

        <UPageCard title="Expense categories" variant="subtle">
          <div class="space-y-3">
            <div
              v-for="category in topCategories"
              :key="category.id"
              class="flex items-center justify-between gap-3"
            >
              <span class="truncate text-sm text-highlighted">{{ category.name }}</span>
              <span class="shrink-0 text-sm font-medium text-error">{{ formatCurrency(category.total_amount) }}</span>
            </div>
            <p v-if="!topCategories.length" class="text-sm text-muted">
              No expenses in this range.
            </p>
          </div>
        </UPageCard>
      </div>

      <div v-if="isFetching" class="text-sm text-muted">
        Loading comparison...
      </div>
    </template>
  </UDashboardPanel>
</template>
