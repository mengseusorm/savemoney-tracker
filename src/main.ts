import './assets/css/main.css'

import { createApp } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'
import { setupLayouts } from 'virtual:generated-layouts'
import { createHead } from '@unhead/vue/client'
import ui from '@nuxt/ui/vue-plugin'

import App from './App.vue'
import { useAuth } from './composables/useAuth'

const app = createApp(App)

const head = createHead()
const router = createRouter({
  routes: setupLayouts(routes as RouteRecordRaw[]),
  history: createWebHistory()
})

router.beforeEach(async (to) => {
  const { isAuthenticated, user, fetchUser } = useAuth()
  const isLoginRoute = to.path === '/login'

  if (isLoginRoute && isAuthenticated.value) {
    return '/'
  }

  if (!isLoginRoute && !isAuthenticated.value) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }
    }
  }

  if (!isLoginRoute && !user.value) {
    try {
      await fetchUser()
    } catch {
      return {
        path: '/login',
        query: { redirect: to.fullPath }
      }
    }
  }
})

app.use(head)
app.use(router)
app.use(ui)

app.mount('#app')

// This will update routes at runtime without reloading the page
if (import.meta.hot) {
  handleHotUpdate(router)
}
