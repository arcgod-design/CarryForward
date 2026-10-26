import { useState } from "react";
import type { Project } from "../../shared/types";
import { ProjectView } from "./views/ProjectView";
import { OverviewView } from "./views/OverviewView";
import { PrinciplesView } from "./views/PrinciplesView";
import { GraphView } from "./views/GraphView";
import { PackView } from "./views/PackView";
import { ChangeCheckView } from "./views/ChangeCheckView";
import { MaintenanceView } from "./views/MaintenanceView";

export type ViewId = "project" | "overview" | "principles" | "graph" | "pack" | "change-check" | "maintenance";

const NAV: { id: ViewId; label: string }[] = [
  { id: "project", label: "Project" },
  { id: "overview", label: "Overview" },
  { id: "principles", label: "Principles" },
  { id: "graph", label: "Graph" },
  { id: "pack", label: "Instruction Pack" },
  { id: "change-check", label: "Change Check" },
  { id: "maintenance", label: "Maintenance" },
];

export function App() {
  const [view, setView] = useState<ViewId>("project");
  const [project, setProject] = useState<Project | null>(null);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-name">CarryForward</span>
          <span className="brand-sub">local project maintainer</span>
        </div>
        <nav aria-label="Views">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {project && (
          <div className="sidebar-project">
            <span className="sidebar-project-name">{project.displayName}</span>
            <span className="sidebar-project-path">{project.rootPath}</span>
          </div>
        )}
        <div className="sidebar-foot">Local-only. Nothing leaves this machine.</div>
      </aside>
      <main className="main">
        {view === "project" && (
          <ProjectView project={project} onProject={(p) => setProject(p)} />
        )}
        {view === "overview" && <OverviewView project={project} />}
        {view === "principles" && <PrinciplesView project={project} />}
        {view === "graph" && <GraphView project={project} />}
        {view === "pack" && <PackView project={project} />}
        {view === "change-check" && <ChangeCheckView project={project} />}
        {view === "maintenance" && <MaintenanceView project={project} />}
      </main>
    </div>
  );
}
