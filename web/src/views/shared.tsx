import type { Project } from "../../../shared/types";

export function NotBuiltYet({ title, slice, note }: { title: string; slice: number; note?: string }) {
  return (
    <section className="view">
      <header className="view-header">
        <h1>{title}</h1>
        <p className="view-lede">Not implemented yet — this view is built in checklist slice {slice}.</p>
        {note && <p className="dim">{note}</p>}
      </header>
    </section>
  );
}

export function NoProject({ view }: { view: string }) {
  return (
    <section className="view">
      <header className="view-header">
        <h1>{view}</h1>
        <p className="view-lede">Open a repository in the Project view first.</p>
      </header>
    </section>
  );
}
