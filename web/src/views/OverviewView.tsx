import type { Project } from "../../../shared/types";
import { NotBuiltYet, NoProject } from "./shared";

export function OverviewView({ project }: { project: Project | null }) {
  if (!project) return <NoProject view="Overview" />;
  return <NotBuiltYet title="Overview" slice={2} note="Counts from real stored records appear after discovery lands." />;
}
