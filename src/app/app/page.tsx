import { Sidebar } from "@/components/dashboard/sidebar";
import { NewProject } from "@/components/dashboard/new-project";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <NewProject />
      </div>
    </div>
  );
}
