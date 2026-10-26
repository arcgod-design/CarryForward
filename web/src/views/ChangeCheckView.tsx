import type { Project } from "../../../shared/types";
import { NotBuiltYet, NoProject } from "./shared";

export function ChangeCheckView({ project }: { project: Project | null }) {
  if (!project) return <NoProject view="Change Check" />;
  return <NotBuiltYet title="Change Check" slice={6} />;
}
