import { Navigate, Route, Routes } from "react-router"

import { AppShell } from "@/components/layout/AppShell"
import ProjectsPage from "@/routes/Projects"
import WorkspacePage from "@/routes/Workspace"
import RunsPage from "@/routes/Runs"
import RunPage from "@/routes/Run"
import ViewPage from "@/routes/View"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/p/:project" element={<AppShell />}>
        <Route index element={<WorkspacePage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="runs/:run" element={<RunPage />} />
        <Route path="views/:viewId" element={<ViewPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
