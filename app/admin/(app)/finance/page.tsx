import { TopBar } from "@/components/admin/Shell";
import { Finance } from "@/components/admin/Finance";
import { getSettings } from "@/lib/data/public";
import { isDemo } from "@/lib/env";

export const metadata = { title: "כספים" };

export default async function Page() {
  const s = await getSettings();
  return (
    <>
      <TopBar title="כספים" back="/admin/more" />
      <main className="app-main"><Finance vatRate={s.business.vat_rate} demo={isDemo} /></main>
    </>
  );
}
