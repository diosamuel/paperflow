import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Builder from './pages/Builder'
import Wiring from './pages/Wiring'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Builder />} />
        <Route path="/wiring" element={<Wiring />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
