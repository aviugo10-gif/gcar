import { TopBar } from "@/components/admin/Shell";
import { DealWizard } from "@/components/admin/DealWizard";
import * as A from "@/lib/data/admin";

export const metadata = { title: "עסקה חדשה" };

export default async function Page({ searchParams }: { searchParams: Promise<{ vehicle?: string; customer?: string }> }) {
  const [vehicles, customers, sp] = await Promise.all([A.listVehicles(), A.listCustomers(), searchParams]);
  return (
    <>
      <TopBar title="עסקה חדשה" back={sp.vehicle ? `/admin/inventory/${sp.vehicle}` : "/admin/deals"} />
      <main className="app-main narrow">
        <DealWizard
          vehicles={vehicles.filter((v) => v.status !== "sold").map((v) => ({ id: v.id, title: `${v.make} ${v.model} ${v.year ?? ""}`.trim(), plate: v.plate, price: v.listing?.sale_price ?? v.listed_price, min_enc: v.min_price_enc ?? null, reserved_for: v.status === "reserved" ? v.reserved_for ?? null : null }))}
          customers={customers.map((c) => ({ id: c.id, name: c.full_name, phone: c.phone }))}
          initialVehicle={sp.vehicle} initialCustomer={sp.customer}
        />
      </main>
    </>
  );
}
