import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { ReportingDashboard } from "@/components/reporting-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAdminAuthenticated())) redirect("/login");
  return <ReportingDashboard />;
}
