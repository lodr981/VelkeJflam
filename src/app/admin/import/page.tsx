import Link from "next/link";
import BreakdownImport from "@/app/BreakdownImport";

export const dynamic = "force-dynamic";

export default function AdminImportPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm text-brand hover:underline">
        ← Administrace
      </Link>
      <h1 className="text-xl font-bold">Import reportů poruch</h1>
      <p className="text-sm text-slate-500">
        Nahraj exportní Excel/CSV (např. měsíční report). Appka vytvoří stroje a rozhází
        k nim poruchy. Stejný soubor můžeš nahrávat opakovaně — přidají se jen nové
        záznamy.
      </p>
      <BreakdownImport />
    </div>
  );
}
