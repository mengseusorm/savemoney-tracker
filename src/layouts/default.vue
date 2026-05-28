<script setup lang="ts">
import { ref } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)

const links = [{
  label: 'Dashboard',
  icon: 'i-lucide-house',
  to: '/',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Money',
  icon: 'i-lucide-wallet-cards',
  defaultOpen: true,
  type: 'trigger',
  children: [{
    label: 'Currencies',
    to: '/currencies',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Income Sources',
    to: '/income-sources',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Incomes',
    to: '/incomes',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Expense Categories',
    to: '/expense-categories',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Expenses',
    to: '/expenses',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Saving Goals',
    to: '/saving-goals',
    onSelect: () => {
      open.value = false
    }
  }]
}, {
  label: 'Reports',
  icon: 'i-lucide-chart-column',
  defaultOpen: true,
  type: 'trigger',
  children: [{
    label: 'Compare',
    to: '/reports/compare',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Income Reports',
    to: '/reports/incomes',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Expense Reports',
    to: '/reports/expenses',
    onSelect: () => {
      open.value = false
    }
  }]
}] satisfies NavigationMenuItem[]

const groups = [{
  id: 'links',
  label: 'Go to',
  items: links
}]
</script>

<template>
  <UDashboardGroup unit="rem" storage="local">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <RouterView />

    <NotificationsSlideover />
  </UDashboardGroup>
</template>
