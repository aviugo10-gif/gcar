import { TopBar } from "@/components/admin/Shell";
import { CustomersList } from "@/components/admin/Customers";
import { listCustomers } from "@/lib/data/admin";

export const metadata = { title: "לקוחות" };

export default async function Page({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [customers, sp] = await Promise.all([listCustomers(), searchParams]);
  return (
    <>
      <TopBar title="לקוחות" back="/admin/more" />
      <main className="app-main"><CustomersList customers={customers} openNew={sp.new === "1"} /></main>
    </>
  );
}
