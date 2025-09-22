import { DataCard } from "../data-card";

export function DataSection() {
  return (
    <div className="flex flex-row gap-6">
      <DataCard title="Total passports" value={22855} />
      <DataCard title="Published" value={19655} />
      <DataCard title="Unpublished" value={3200} />
    </div>
  );
}
