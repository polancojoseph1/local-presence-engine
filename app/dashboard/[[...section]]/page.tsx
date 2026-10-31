import { dashboardData } from "@/lib/dashboard";
import Dashboard from "@/app/dashboard";
import Onboard from "@/app/onboard";
import { notFound } from "next/navigation";
const tabs: Record<string, string> = {
  "": "Overview",
  send: "Send request",
  customers: "Customers",
  templates: "Templates",
  qr: "QR & assets",
  reviews: "Reviews",
  widget: "Website widget",
  reports: "Reports",
  settings: "Settings",
  requests: "Review requests",
  operator: "Operator",
};
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const tab = tabs[(section || []).join("/")];
  if (!tab) notFound();
  const data = await dashboardData();
  return data ? <Dashboard data={data} initialTab={tab} /> : <Onboard />;
}
