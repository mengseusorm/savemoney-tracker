import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createSharedComposable } from '@vueuse/core'

const _useDashboard = () => {
  const route = useRoute()
  const router = useRouter()
  const isNotificationsSlideoverOpen = ref(false)

  defineShortcuts({
    'g-h': () => router.push('/'),
    'g-u': () => router.push('/currencies'),
    'g-o': () => router.push('/income-sources'),
    'g-n': () => router.push('/incomes'),
    'g-e': () => router.push('/expenses'),
    'g-g': () => router.push('/saving-goals'),
    'g-r': () => router.push('/reports/incomes'),
    'g-c': () => router.push('/reports/compare')
  })

  watch(() => route.fullPath, () => {
    isNotificationsSlideoverOpen.value = false
  })

  return {
    isNotificationsSlideoverOpen
  }
}

export const useDashboard = createSharedComposable(_useDashboard)
