import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('./src/renderer/src'),
        '@features': resolve('./src/renderer/src/features'),
        '@widgets': resolve('./src/renderer/src/widgets'),
        '@entities': resolve('./src/renderer/src/entities'),
        '@shared': resolve('./src/renderer/src/shared')
      }
    }
  }
})
