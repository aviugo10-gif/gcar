import { notFound } from "next/navigation";
import { TopBar } from "@/components/admin/Shell";
import { DealView } from "@/components/admin/DealView";
import * as A from "@/lib/data/admin";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await A.getDeal(id);
  if (!d) notFound();
  return (
    <>
      <TopBar title={d.vehicle ? `עסקה: ${d.vehicle.make} ${d.vehicle.model}` : "עסקה"} back="/admin/deals" />
      <main className="app-main narrow"><DealView {...d} /></main>
    </>
  );
}
