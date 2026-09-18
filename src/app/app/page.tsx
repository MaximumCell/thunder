import { Topbar } from "@/components/dashboard/topbar";
import { ShowcaseStrip } from "@/components/dashboard/showcase-strip";
import { NewProject } from "@/components/dashboard/new-project";

export default function Dashboard() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Topbar />
      <div className="flex-1 overflow-y-auto">
        <ShowcaseStrip />
        <NewProject />
      </div>
    </div>
  );
}
