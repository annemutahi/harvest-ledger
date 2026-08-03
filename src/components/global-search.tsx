import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Link } from "@tanstack/react-router";

type Result = {
  customers: any[];
  orders: any[];
  invoices: any[];
};

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!q) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = window.setTimeout(async () => {
      try {
        const r = await api.searchGlobal(q, 6);
        setResults(r as Result);
      } catch (e) {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ((e.target as HTMLInputElement).value)}
        placeholder="Search customers, orders, invoices…"
        className="pl-9"
        aria-label="Global search"
      />

      {q && (results?.customers.length || results?.orders.length || results?.invoices.length || loading) && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full max-w-xl rounded-md border bg-card p-2 shadow-md">
          {loading && <div className="p-2 text-sm text-muted-foreground">Searching…</div>}

          {results && (
            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Customers</h4>
                {results.customers.length ? (
                  results.customers.map((c) => (
                    <div key={c.id} className="py-1">
                      <Link to="/customers/$id" params={{ id: c.id }} className="text-sm hover:underline">{c.name}</Link>
                      <div className="text-xs text-muted-foreground">{c.company || c.phone}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No customers</div>
                )}
              </div>

              <div>
                <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Orders</h4>
                {results.orders.length ? (
                  results.orders.map((o) => (
                    <div key={o.id} className="py-1">
                      <Link to="/orders/$id" params={{ id: o.id }} className="text-sm hover:underline">{o.reference}</Link>
                      <div className="text-xs text-muted-foreground">{o.customerName}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No orders</div>
                )}
              </div>

              <div>
                <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Invoices</h4>
                {results.invoices.length ? (
                  results.invoices.map((i) => (
                    <div key={i.id} className="py-1">
                      <Link to="/invoices/$id" params={{ id: i.id }} className="text-sm hover:underline">{i.invoiceNumber}</Link>
                      <div className="text-xs text-muted-foreground">{i.customerName}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No invoices</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
