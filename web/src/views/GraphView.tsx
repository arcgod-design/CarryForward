import type { Project } from "../../../shared/types";
import { NotBuiltYet, NoProject } from "./shared";

export function GraphView({ project }: { project: Project | null }) {
  if (!project) return <NoProject view="Graph" />;
  return <NotBuiltYet title="Graph" slice={4} />;
}
