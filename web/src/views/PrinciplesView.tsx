import type { Project } from "../../../shared/types";
import { NotBuiltYet, NoProject } from "./shared";

export function PrinciplesView({ project }: { project: Project | null }) {
  if (!project) return <NoProject view="Principles" />;
  return <NotBuiltYet title="Principles" slice={2} />;
}
