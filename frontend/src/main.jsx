import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress third-party Chrome Extension background script noise in console
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('A listener indicated an asynchronous response') ||
    event.reason?.message?.includes('message channel closed')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
