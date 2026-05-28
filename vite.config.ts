import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueRouter from 'vue-router/vite'
import vueLayouts from 'vite-plugin-vue-layouts'
import ui from '@nuxt/ui/vite'
import Inspector from 'vite-plugin-vue-inspector'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vueRouter({
      dts: 'src/route-map.d.ts'
    }),
    vueLayouts(),
    vue(),
    Inspector(),
    ui({
      ui: {
        colors: {
          primary: 'rose',
          neutral: 'zinc'
        }
      }
    })
  ]
})
