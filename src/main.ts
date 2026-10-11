import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/cyrillic-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/cyrillic-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/cyrillic-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/cyrillic-400.css'
import 'tailwindcss/index.css'
import './styles/main.scss'

async function main() {
  // This is a standalone mock-backed demo, including in the production build.
  // A real backend replaces this startup and src/api/bookings.ts without changing UI.
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  createApp(App).use(createPinia()).mount('#app')
}

main().catch((error) => {
  console.error('Не удалось запустить приложение', error)
  const root = document.querySelector('#app')!
  root.textContent =
    'Не удалось запустить демо. Разрешите Service Worker в браузере и обновите страницу.'
})
