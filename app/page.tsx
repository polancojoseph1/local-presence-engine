import { dashboardData } from "@/lib/dashboard";
import Dashboard from "./dashboard";
import Onboard from "./onboard";
export default async function Home() {
  const data = await dashboardData();
  return data ? <Dashboard data={data} /> : <Onboard />;
}
