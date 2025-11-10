import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Avelero",
};

export default function DashboardPage() {
  // No prefetching needed - user data already prefetched in layout
  // Following Midday's simple page pattern
  return (
    <div className="flex justify-center items-center relative">
      <div className="text-2xl font-bold">Dashboard</div>
    </div>
  );
}
