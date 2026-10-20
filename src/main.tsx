import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { BootGate } from './components/BootGate'
import { SearchProvider } from './context/SearchContext'
import { ThemeProvider } from './context/ThemeContext'
import { startBoot } from './lib/boot'
import { startShield } from './lib/shield'
import './index.css'

startShield()
startBoot() // fonts, this page's code and artwork load while React starts up

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <SearchProvider>
          <BootGate>
            <App />
          </BootGate>
        </SearchProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
