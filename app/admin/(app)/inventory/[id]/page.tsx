import { notFound } from "next/navigation";
import { TopBar } from "@/components/admin/Shell";
import { VehicleDetail } from "@/components/admin/VehicleDetail";
import * as A from "@/lib/data/admin";
import { getSettings } from "@/lib/data/public";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const v = await A.getVehicle(id);
  if (!v) notFound();
  const [expenses, categories, suppliers, equipment, customers, deals, settings] = await Promise.all([
    A.listExpenses(id), A.listCategories(), A.suppliers(), A.listEquipment(), A.listCustomers(), A.listDeals(), getSettings(),
  ]);
  const deal = deals.find((d) => d.vehicle_id === id && d.status !== "cancelled") ?? null;
  return (
    <>
      <TopBar title={`${v.make} ${v.model} ${v.year ?? ""}`} back="/admin/inventory" />
      <main className="app-main">
        <VehicleDetail
          v={v} tab={sp.tab ?? "overview"} expenses={expenses} categories={categories} suppliers={suppliers} equipment={equipment}
          customers={customers.map((c) => ({ id: c.id, name: c.full_name }))} deal={deal} vatRate={settings.business.vat_rate}
        />
      </main>
    </>
  );
}
