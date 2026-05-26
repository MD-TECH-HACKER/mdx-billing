import PartyDirectoryPage from "@/components/PartyDirectoryPage";

export default function CustomersPage() {
  return (
    <PartyDirectoryPage
      endpoint="customers"
      title="Customers"
      singular="Customer"
      currentPath="/customers"
      description="Maintain contact, GST and balance details for repeat buyers."
    />
  );
}
