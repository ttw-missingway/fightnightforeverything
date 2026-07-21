import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { StoreProvider } from './state/store.jsx'

// No StrictMode: the simulation intentionally mutates cloned state before
// setState, and double-invocation would double-simulate days in dev.
createRoot(document.getElementById('root')).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
)
