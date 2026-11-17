import { TopBar } from "@/components/admin/Shell";
import { NewVehicle } from "@/components/admin/NewVehicle";

export const metadata = { title: "רכב חדש" };

export default function Page() {
  return (
    <>
      <TopBar title="רכב חדש" back="/admin/inventory" />
      <main className="app-main narrow"><NewVehicle /></main>
    </>
  );
}
