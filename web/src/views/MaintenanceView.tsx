import type { Project } from "../../../shared/types";
import { NotBuiltYet, NoProject } from "./shared";

export function MaintenanceView({ project }: { project: Project | null }) {
  if (!project) return <NoProject view="Maintenance" />;
  return <NotBuiltYet title="Maintenance" slice={8} note="Built only after the P0 core loop passes its acceptance gate." />;
}
