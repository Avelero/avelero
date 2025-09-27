import { DataCard } from "../data-card";

export function DataSection() {
  return (
    <div className="flex flex-row gap-6">
      <DataCard title="Published" value={9553} />
      <DataCard title="Scheduled" value={826} />
      <DataCard title="Unpublished" value={4855} />
      <DataCard title="Archived" value={207} />
      </div>
  );
}
