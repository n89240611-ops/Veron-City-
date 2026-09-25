import AdminDashboard from "@/components/admin/AdminDashboard";
import { requireAdmin } from "@/lib/server/bundle";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();
  return <AdminDashboard adminName={admin.username} />;
}
