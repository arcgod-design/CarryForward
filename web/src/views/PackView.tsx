import type { Project } from "../../../shared/types";
import { NotBuiltYet, NoProject } from "./shared";

export function PackView({ project }: { project: Project | null }) {
  if (!project) return <NoProject view="Instruction Pack" />;
  return <NotBuiltYet title="Instruction Pack" slice={5} />;
}
