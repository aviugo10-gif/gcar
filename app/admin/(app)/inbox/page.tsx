import { TopBar } from "@/components/admin/Shell";
import { Inbox } from "@/components/admin/Inbox";
import * as A from "@/lib/data/admin";

export const metadata = { title: "פניות" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string }> }) {
  const [leads, scrap, vehicles, sp] = await Promise.all([A.listLeads(), A.listScrap(), A.listVehicles(), searchParams]);
  const cars = Object.fromEntries(vehicles.map((v) => [v.id, { title: `${v.make} ${v.model} ${v.year ?? ""}`.trim(), slug: v.listing?.slug ?? null }]));
  return (
    <>
      <TopBar title="פניות" />
      <main className="app-main narrow"><Inbox leads={leads} scrap={scrap} cars={cars} initialTab={sp.tab === "scrap" ? "scrap" : scrap.some((s) => s.status === "new") && !leads.some((l) => l.status === "new") ? "scrap" : "leads"} focus={sp.id} /></main>
    </>
  );
}
