import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { App } from './App'
import { Dashboard } from './pages/Dashboard'
import { Lagesuppdatering } from './pages/Lagesuppdatering'
import { ArtiklarList, ArtikelEditor } from './pages/Artiklar'
import { Forum } from './pages/Forum'
import { Kartmarkorer } from './pages/Kartmarkorer'
import { Kallor } from './pages/Kallor'
import { Innehall } from './pages/Innehall'
import { Loggbok } from './pages/Loggbok'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/admin">
      <Routes>
        <Route element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="lagesuppdatering" element={<Lagesuppdatering />} />
          <Route path="artiklar" element={<ArtiklarList />} />
          <Route path="artiklar/ny" element={<ArtikelEditor />} />
          <Route path="artiklar/:slug" element={<ArtikelEditor />} />
          <Route path="forum" element={<Forum />} />
          <Route path="kartmarkorer" element={<Kartmarkorer />} />
          <Route path="kallor" element={<Kallor />} />
          <Route path="innehall" element={<Innehall />} />
          <Route path="loggbok" element={<Loggbok />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
