import { TopBar } from "@/components/admin/Shell";
import { InventoryList } from "@/components/admin/InventoryList";
import { listVehicles, listCustomers } from "@/lib/data/admin";

export const metadata = { title: "מלאי" };

export default async function Inventory({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [vehicles, customers, sp] = await Promise.all([listVehicles(), listCustomers(), searchParams]);
  return (
    <>
      <TopBar title="מלאי" />
      <main className="app-main">
        <InventoryList
          initialStatus={sp.status ?? "stock"}
          customers={customers.map((c) => ({ id: c.id, name: c.full_name }))}
          vehicles={vehicles.map((v) => ({
            id: v.id, plate: v.plate, title: `${v.make} ${v.model}${v.trim ? " " + v.trim : ""}`, year: v.year, km: v.km, status: v.status,
            stock_in_date: v.stock_in_date, price: v.listing?.sale_price ?? v.listed_price, published: !!v.listing?.is_published,
            photo: v.photos.find((p) => p.is_main)?.path ?? v.photos[0]?.path ?? null,
          }))}
        />
      </main>
    </>
  );
}
