import PartyDirectoryPage from "@/components/PartyDirectoryPage";

export default function SuppliersPage() {
  return (
    <PartyDirectoryPage
      endpoint="suppliers"
      title="Suppliers"
      singular="Supplier"
      currentPath="/suppliers"
      description="Keep vendor contact and GST records attached to your purchases."
      allowedRoles={["owner", "manager"]}
    />
  );
}
