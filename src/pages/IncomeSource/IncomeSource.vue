<script setup lang="ts">
import * as z from 'zod'
import { computed, h, onMounted, reactive, ref, resolveComponent, useTemplateRef } from 'vue'
import type { DropdownMenuItem, FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { getPaginationRowModel, type Row } from '@tanstack/table-core'
import { ApiError, apiFetch } from '../../utils/api'
import { useAuth } from '../../composables/useAuth'
import { formatDate } from '../../utils/money'
import type { DataResponse, IncomeSource, ListResponse } from '../../types/money'

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255, 'Name is too long'),
  description: z.string().trim().max(1000, 'Description is too long').optional().or(z.literal('')),
  is_active: z.boolean()
})

type IncomeSourceForm = z.output<typeof schema>

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()
const table = useTemplateRef('table')
const { token } = useAuth()

const sources = ref<IncomeSource[]>([])
const isFetching = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const modalOpen = ref(false)
const deleteOpen = ref(false)
const selectedSource = ref<IncomeSource | null>(null)
const sourceToDelete = ref<IncomeSource | null>(null)
const search = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

const state = reactive<IncomeSourceForm>({
  name: '',
  description: '',
  is_active: true
})

const modalTitle = computed(() => selectedSource.value ? 'Edit income source' : 'New income source')
const modalDescription = computed(() => selectedSource.value ? 'Update this income source.' : 'Create a source for tracking income.')
const submitLabel = computed(() => selectedSource.value ? 'Save changes' : 'Create source')

const filteredSources = computed(() => {
  const q = search.value.trim().toLowerCase()

  return sources.value.filter((source) => {
    const matchesSearch = !q
      || source.name.toLowerCase().includes(q)
      || (source.description ?? '').toLowerCase().includes(q)
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'active' && source.is_active)
      || (statusFilter.value === 'inactive' && !source.is_active)

    return matchesSearch && matchesStatus
  })
})

function resetForm(source?: IncomeSource) {
  selectedSource.value = source ?? null
  state.name = source?.name ?? ''
  state.description = source?.description ?? ''
  state.is_active = source?.is_active ?? true
}

function openCreateModal() {
  resetForm()
  modalOpen.value = true
}

function openEditModal(source: IncomeSource) {
  resetForm(source)
  modalOpen.value = true
}

function openDeleteModal(source: IncomeSource) {
  sourceToDelete.value = source
  deleteOpen.value = true
}

function showError(error: unknown, fallback: string) {
  const description = error instanceof ApiError
    ? Object.values(error.errors ?? {})[0]?.[0] ?? error.message
    : fallback

  toast.add({
    title: fallback,
    description,
    icon: 'i-lucide-alert-circle',
    color: 'error'
  })
}

async function loadIncomeSources() {
  if (!token.value) return

  isFetching.value = true

  try {
    const response = await apiFetch<ListResponse<IncomeSource>>('/income-sources', {
      token: token.value
    })

    sources.value = response.data
  } catch (error) {
    showError(error, 'Unable to load income sources')
  } finally {
    isFetching.value = false
  }
}

async function onSubmit(event: FormSubmitEvent<Record<string, unknown>>) {
  if (!token.value) return

  isSaving.value = true

  try {
    const data = schema.parse(event.data)
    const payload = {
      name: data.name,
      description: data.description || null,
      is_active: data.is_active
    }
    const source = selectedSource.value
    const response = await apiFetch<DataResponse<IncomeSource>>(
      source ? `/income-sources/${source.id}` : '/income-sources',
      {
        method: source ? 'PUT' : 'POST',
        token: token.value,
        body: payload
      }
    )

    if (source) {
      sources.value = sources.value.map(item => item.id === response.data.id ? response.data : item)
    } else {
      sources.value = [...sources.value, response.data].sort((a, b) => a.name.localeCompare(b.name))
    }

    toast.add({
      title: response.message,
      icon: 'i-lucide-check',
      color: 'success'
    })
    modalOpen.value = false
    resetForm()
  } catch (error) {
    showError(error, selectedSource.value ? 'Unable to update income source' : 'Unable to create income source')
  } finally {
    isSaving.value = false
  }
}

async function confirmDelete() {
  if (!token.value || !sourceToDelete.value) return

  isDeleting.value = true

  try {
    const source = sourceToDelete.value
    const response = await apiFetch<{ message: string }>(`/income-sources/${source.id}`, {
      method: 'DELETE',
      token: token.value
    })

    sources.value = sources.value.filter(item => item.id !== source.id)
    toast.add({
      title: response.message,
      icon: 'i-lucide-check',
      color: 'success'
    })
    deleteOpen.value = false
    sourceToDelete.value = null
  } catch (error) {
    showError(error, 'Unable to delete income source')
  } finally {
    isDeleting.value = false
  }
}

async function toggleSourceStatus(source: IncomeSource) {
  if (!token.value) return

  try {
    const response = await apiFetch<DataResponse<IncomeSource>>(`/income-sources/${source.id}`, {
      method: 'PUT',
      token: token.value,
      body: {
        name: source.name,
        description: source.description,
        is_active: !source.is_active
      }
    })

    sources.value = sources.value.map(item => item.id === response.data.id ? response.data : item)
    toast.add({
      title: response.message,
      icon: 'i-lucide-check',
      color: 'success'
    })
  } catch (error) {
    showError(error, 'Unable to update income source')
  }
}

function getRowItems(row: Row<IncomeSource>): DropdownMenuItem[][] {
  return [[{
    label: 'Edit',
    icon: 'i-lucide-pencil',
    onSelect: () => openEditModal(row.original)
  }, {
    label: row.original.is_active ? 'Mark inactive' : 'Mark active',
    icon: row.original.is_active ? 'i-lucide-eye-off' : 'i-lucide-eye',
    onSelect: () => toggleSourceStatus(row.original)
  }], [{
    label: 'Delete',
    icon: 'i-lucide-trash',
    color: 'error',
    onSelect: () => openDeleteModal(row.original)
  }]]
}

const columns: TableColumn<IncomeSource>[] = [{
  accessorKey: 'name',
  header: 'Source',
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'font-medium text-highlighted truncate' }, row.original.name),
    h('p', { class: 'text-sm text-muted truncate' }, row.original.description || 'No description')
  ])
}, {
  accessorKey: 'is_active',
  header: 'Status',
  cell: ({ row }) => h(UBadge, {
    color: row.original.is_active ? 'success' : 'neutral',
    variant: 'subtle'
  }, () => row.original.is_active ? 'Active' : 'Inactive')
}, {
  accessorKey: 'created_at',
  header: 'Created',
  cell: ({ row }) => formatDate(row.original.created_at)
}, {
  id: 'actions',
  cell: ({ row }) => h('div', { class: 'text-right' }, h(UDropdownMenu, {
    items: getRowItems(row),
    content: { align: 'end' }
  }, () => h(UButton, {
    icon: 'i-lucide-ellipsis-vertical',
    color: 'neutral',
    variant: 'ghost',
    class: 'ml-auto'
  })))
}]

onMounted(loadIncomeSources)
</script>

<template>
  <UDashboardPanel id="income-sources">
    <template #header>
      <UDashboardNavbar title="Income Sources">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="New source"
            icon="i-lucide-plus"
            @click="openCreateModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search income sources"
          class="w-full sm:max-w-sm"
        />

        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' }
          ]"
          class="w-full sm:w-36"
        />
      </div>

      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :data="filteredSources"
        :columns="columns"
        :loading="isFetching"
        class="shrink-0"
      >
        <template #empty>
          <div class="py-10 text-center">
            <UIcon name="i-lucide-wallet-cards" class="mx-auto mb-2 size-8 text-muted" />
            <p class="font-medium text-highlighted">
              No income sources found
            </p>
            <p class="text-sm text-muted">
              Create a source to start organizing income records.
            </p>
          </div>
        </template>
      </UTable>

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          {{ filteredSources.length }} income source{{ filteredSources.length === 1 ? '' : 's' }}
        </div>

        <UPagination
          :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
          :items-per-page="table?.tableApi?.getState().pagination.pageSize"
          :total="table?.tableApi?.getFilteredRowModel().rows.length"
          @update:page="(page: number) => table?.tableApi?.setPageIndex(page - 1)"
        />
      </div>
    </template>
  </UDashboardPanel>

  <ResourceFormModal
    v-model:open="modalOpen"
    :title="modalTitle"
    :description="modalDescription"
    :schema="schema"
    :state="state"
    :submit-label="submitLabel"
    :loading="isSaving"
    @submit="onSubmit"
  >
    <UFormField
      label="Name"
      name="name"
      required
    >
      <UInput
        v-model="state.name"
        placeholder="Salary"
        class="w-full"
        autofocus
      />
    </UFormField>

    <UFormField
      label="Description"
      name="description"
    >
      <UTextarea
        v-model="state.description"
        placeholder="Monthly paycheck, freelance work, rental income..."
        :rows="4"
        class="w-full"
      />
    </UFormField>

    <UFormField
      label="Active"
      name="is_active"
      class="flex items-center justify-between gap-4"
    >
      <USwitch v-model="state.is_active" />
    </UFormField>
  </ResourceFormModal>

  <DeleteConfirmModal
    v-model:open="deleteOpen"
    title="Delete income source"
    :description="`Delete ${sourceToDelete?.name ?? 'this income source'}? This cannot be undone.`"
    :loading="isDeleting"
    @confirm="confirmDelete"
  />
</template>

<route lang="yaml">
path: /income-sources
</route>
