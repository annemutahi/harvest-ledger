// Placeholder API service. Swap fetch URLs to your Django REST endpoints.
// Example: GET /api/customers/, POST /api/sales/, etc.

import { customers, products, invoices, sales, payments } from "../mock-data";

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

export const api = {
  // TODO: GET /api/customers/
  listCustomers: async () => { await delay(); return customers; },
  // TODO: GET /api/customers/:id/
  getCustomer: async (id: string) => { await delay(); return customers.find((c) => c.id === id); },
  // TODO: GET /api/products/
  listProducts: async () => { await delay(); return products; },
  // TODO: GET /api/invoices/
  listInvoices: async () => { await delay(); return invoices; },
  // TODO: GET /api/invoices/:id/
  getInvoice: async (id: string) => { await delay(); return invoices.find((i) => i.id === id); },
  // TODO: GET /api/sales/
  listSales: async () => { await delay(); return sales; },
  // TODO: GET /api/payments/
  listPayments: async () => { await delay(); return payments; },
};
