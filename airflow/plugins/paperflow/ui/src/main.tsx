import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Builder from './pages/Builder'
import Wiring from './pages/Wiring'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Builder />} />
        <Route path="/wiring" element={<Wiring />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
