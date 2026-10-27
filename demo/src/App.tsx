import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/Shell'
import { ToastViewport } from './components/ui'
import { AssetProvider } from './lib/assets'
import { AssistantProvider } from './lib/assistant'
import { UIProvider } from './lib/ui'
import Copilot from './pages/Copilot'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import SearchPage from './pages/SearchPage'
import Settings from './pages/Settings'
import Tasks from './pages/Tasks'

export default function App() {
  return (
    <AssetProvider>
      <AssistantProvider>
        <UIProvider>
          <HashRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="library" element={<Library />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="copilot" element={<Copilot />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
          <ToastViewport />
        </UIProvider>
      </AssistantProvider>
    </AssetProvider>
  )
}
