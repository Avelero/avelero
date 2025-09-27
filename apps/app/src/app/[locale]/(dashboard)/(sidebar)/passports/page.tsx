import { DataSection } from "@/components/passports/data-section";
import { TableSection } from "@/components/passports/table-section";

export default function PassportsPage() {
  return (
    <div className="w-full">
      <div className="flex flex-col gap-12">
        <DataSection />
        <TableSection />
      </div>
    </div>
  );
}
