// Shared domain types for Peaceful Acres Farm ERP.
// Formerly lived alongside mock data in `mock-data.ts`.

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
  description?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type PaymentType = "Cash" | "Credit";
export type InvoiceStatus = "Paid" | "Partially Paid" | "Unpaid" | "Overdue" | "Credit";

export interface InvoiceAdjustment {
  id: string;
  kind: "Debit" | "Credit";
  previousTotal: number;
  newTotal: number;
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface CreditUse {
  id: string;
  amount: number;
  targetInvoiceId: string;
  targetInvoiceNumber: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  invoiceId?: string;
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
  saleId?: string;
  paymentType?: PaymentType;
  adjustments: InvoiceAdjustment[];
  creditApplied: number;
  availableCredit: number;
  creditUses: CreditUse[];
  etimsNumber: string;
  isVoided: boolean;
  voidedAt?: string;
  voidedByName?: string;
  voidReason?: string;
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
  isVoided: boolean;
  voidedAt?: string;
  voidedByName?: string;
  voidReason?: string;
}
