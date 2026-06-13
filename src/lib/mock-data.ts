// Mock data for the Farm Sales & Receivables Management System.
// TODO: Replace with API calls to Django REST Framework backend.

export type CustomerType = "Individual" | "Corporate";

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  company?: string;
  contactPerson: string;
  phone: string;
  email: string;
  creditLimit: number;
  outstandingBalance: number;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  availableQuantity: number;
  unit: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type PaymentType = "Cash" | "Credit";
export type InvoiceStatus = "Paid" | "Partially Paid" | "Unpaid" | "Overdue";

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  items: SaleItem[];
  amount: number;
  paymentType: PaymentType;
  status: InvoiceStatus;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  items: SaleItem[];
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  status: InvoiceStatus;
}

export type PaymentMethod = "Cash" | "Bank Transfer" | "Mobile Money" | "Cheque";

export interface Payment {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  method: PaymentMethod;
  notes?: string;
}

export const customers: Customer[] = [
  { id: "C-001", name: "Green Valley Restaurant", type: "Corporate", company: "Green Valley Ltd", contactPerson: "Sarah Mwangi", phone: "+254 712 345 678", email: "sarah@greenvalley.co.ke", creditLimit: 500000, outstandingBalance: 145000, createdAt: "2025-01-15" },
  { id: "C-002", name: "John Kamau", type: "Individual", contactPerson: "John Kamau", phone: "+254 722 111 222", email: "jkamau@gmail.com", creditLimit: 50000, outstandingBalance: 12500, createdAt: "2025-02-20" },
  { id: "C-003", name: "FreshMart Supermarket", type: "Corporate", company: "FreshMart Holdings", contactPerson: "Peter Otieno", phone: "+254 733 444 555", email: "procurement@freshmart.co.ke", creditLimit: 1000000, outstandingBalance: 320000, createdAt: "2024-11-05" },
  { id: "C-004", name: "Mary Wanjiku", type: "Individual", contactPerson: "Mary Wanjiku", phone: "+254 700 998 877", email: "mary.w@yahoo.com", creditLimit: 30000, outstandingBalance: 0, createdAt: "2025-03-12" },
  { id: "C-005", name: "Sunrise Hotel", type: "Corporate", company: "Sunrise Hospitality", contactPerson: "David Njoroge", phone: "+254 711 223 344", email: "f&b@sunrisehotel.co.ke", creditLimit: 750000, outstandingBalance: 215000, createdAt: "2024-09-18" },
  { id: "C-006", name: "Grace Achieng", type: "Individual", contactPerson: "Grace Achieng", phone: "+254 720 556 778", email: "grace.a@gmail.com", creditLimit: 25000, outstandingBalance: 4500, createdAt: "2025-04-02" },
  { id: "C-007", name: "Highland Schools", type: "Corporate", company: "Highland Education Trust", contactPerson: "James Kiprotich", phone: "+254 734 889 001", email: "supplies@highland.ac.ke", creditLimit: 600000, outstandingBalance: 88000, createdAt: "2024-12-01" },
];

export const products: Product[] = [
  { id: "P-001", name: "Tomatoes", category: "Vegetables", unitPrice: 120, availableQuantity: 450, unit: "kg" },
  { id: "P-002", name: "Sukuma Wiki (Kale)", category: "Vegetables", unitPrice: 40, availableQuantity: 280, unit: "bunch" },
  { id: "P-003", name: "Maize", category: "Grains", unitPrice: 65, availableQuantity: 1200, unit: "kg" },
  { id: "P-004", name: "Fresh Milk", category: "Dairy", unitPrice: 70, availableQuantity: 320, unit: "litre" },
  { id: "P-005", name: "Eggs (Tray)", category: "Poultry", unitPrice: 480, availableQuantity: 95, unit: "tray" },
  { id: "P-006", name: "Avocados", category: "Fruits", unitPrice: 25, availableQuantity: 800, unit: "piece" },
  { id: "P-007", name: "Potatoes", category: "Vegetables", unitPrice: 80, availableQuantity: 650, unit: "kg" },
  { id: "P-008", name: "Onions", category: "Vegetables", unitPrice: 110, availableQuantity: 380, unit: "kg" },
  { id: "P-009", name: "Bananas", category: "Fruits", unitPrice: 200, availableQuantity: 140, unit: "bunch" },
  { id: "P-010", name: "Carrots", category: "Vegetables", unitPrice: 90, availableQuantity: 220, unit: "kg" },
];

export const invoices: Invoice[] = [
  { id: "INV-001", invoiceNumber: "INV-2026-001", customerId: "C-001", customerName: "Green Valley Restaurant", invoiceDate: "2026-05-20", dueDate: "2026-06-19", items: [
    { productId: "P-001", productName: "Tomatoes", quantity: 50, unitPrice: 120, total: 6000 },
    { productId: "P-007", productName: "Potatoes", quantity: 80, unitPrice: 80, total: 6400 },
  ], totalAmount: 145000, amountPaid: 0, outstandingBalance: 145000, status: "Overdue" },
  { id: "INV-002", invoiceNumber: "INV-2026-002", customerId: "C-003", customerName: "FreshMart Supermarket", invoiceDate: "2026-06-01", dueDate: "2026-07-01", items: [
    { productId: "P-003", productName: "Maize", quantity: 500, unitPrice: 65, total: 32500 },
    { productId: "P-004", productName: "Fresh Milk", quantity: 200, unitPrice: 70, total: 14000 },
  ], totalAmount: 320000, amountPaid: 0, outstandingBalance: 320000, status: "Unpaid" },
  { id: "INV-003", invoiceNumber: "INV-2026-003", customerId: "C-005", customerName: "Sunrise Hotel", invoiceDate: "2026-06-05", dueDate: "2026-07-05", items: [
    { productId: "P-005", productName: "Eggs (Tray)", quantity: 30, unitPrice: 480, total: 14400 },
  ], totalAmount: 215000, amountPaid: 50000, outstandingBalance: 165000, status: "Partially Paid" },
  { id: "INV-004", invoiceNumber: "INV-2026-004", customerId: "C-002", customerName: "John Kamau", invoiceDate: "2026-06-08", dueDate: "2026-06-22", items: [
    { productId: "P-002", productName: "Sukuma Wiki (Kale)", quantity: 25, unitPrice: 40, total: 1000 },
  ], totalAmount: 12500, amountPaid: 0, outstandingBalance: 12500, status: "Unpaid" },
  { id: "INV-005", invoiceNumber: "INV-2026-005", customerId: "C-004", customerName: "Mary Wanjiku", invoiceDate: "2026-06-10", dueDate: "2026-06-24", items: [
    { productId: "P-006", productName: "Avocados", quantity: 40, unitPrice: 25, total: 1000 },
  ], totalAmount: 8500, amountPaid: 8500, outstandingBalance: 0, status: "Paid" },
  { id: "INV-006", invoiceNumber: "INV-2026-006", customerId: "C-007", customerName: "Highland Schools", invoiceDate: "2026-06-02", dueDate: "2026-07-02", items: [
    { productId: "P-003", productName: "Maize", quantity: 300, unitPrice: 65, total: 19500 },
  ], totalAmount: 88000, amountPaid: 0, outstandingBalance: 88000, status: "Unpaid" },
  { id: "INV-007", invoiceNumber: "INV-2026-007", customerId: "C-006", customerName: "Grace Achieng", invoiceDate: "2026-06-11", dueDate: "2026-06-25", items: [
    { productId: "P-010", productName: "Carrots", quantity: 10, unitPrice: 90, total: 900 },
  ], totalAmount: 4500, amountPaid: 0, outstandingBalance: 4500, status: "Unpaid" },
];

export const sales: Sale[] = invoices.map((inv) => ({
  id: inv.id,
  invoiceNumber: inv.invoiceNumber,
  customerId: inv.customerId,
  customerName: inv.customerName,
  date: inv.invoiceDate,
  items: inv.items,
  amount: inv.totalAmount,
  paymentType: inv.status === "Paid" ? "Cash" : "Credit",
  status: inv.status,
}));

export const payments: Payment[] = [
  { id: "PMT-001", date: "2026-06-10", customerId: "C-005", customerName: "Sunrise Hotel", invoiceId: "INV-003", invoiceNumber: "INV-2026-003", amount: 50000, method: "Bank Transfer", notes: "Partial payment" },
  { id: "PMT-002", date: "2026-06-10", customerId: "C-004", customerName: "Mary Wanjiku", invoiceId: "INV-005", invoiceNumber: "INV-2026-005", amount: 8500, method: "Mobile Money" },
  { id: "PMT-003", date: "2026-06-05", customerId: "C-001", customerName: "Green Valley Restaurant", invoiceId: "INV-001", invoiceNumber: "INV-2026-001", amount: 25000, method: "Cheque", notes: "Cheque #4451" },
  { id: "PMT-004", date: "2026-06-12", customerId: "C-002", customerName: "John Kamau", invoiceId: "INV-004", invoiceNumber: "INV-2026-004", amount: 5000, method: "Cash" },
];

export const monthlySales = [
  { month: "Jan", sales: 420000, receivables: 180000 },
  { month: "Feb", sales: 510000, receivables: 220000 },
  { month: "Mar", sales: 480000, receivables: 195000 },
  { month: "Apr", sales: 620000, receivables: 270000 },
  { month: "May", sales: 710000, receivables: 310000 },
  { month: "Jun", sales: 685000, receivables: 685000 },
];

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);

export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export const daysOverdue = (dueDate: string): number => {
  const due = new Date(dueDate).getTime();
  const now = new Date("2026-06-13").getTime();
  const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};
