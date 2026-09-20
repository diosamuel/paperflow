import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Landing } from './pages/Landing'

const Builder = lazy(() => import('./pages/Builder'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Landing />} path="/" />
        <Route
          element={
            <Suspense
              fallback={
                <div className="flex h-dvh items-center justify-center bg-canvas text-slate">
                  Loading builder…
                </div>
              }
            >
              <Builder />
            </Suspense>
          }
          path="/builder"
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
