import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Avelero",
};

export default function DashboardPage() {
  // No additional prefetching needed - user data is primed in the layout.
  return (
    <div className="flex justify-center items-center relative">
      <div className="text-2xl font-bold">Dashboard</div>
    </div>
  );
}
