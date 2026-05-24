import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, TrendingUp, Boxes, ShieldAlert } from "lucide-react";
import { Card, StatCard, Button, PageHeader, Badge } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDataStore } from "@/store/dataStore";
import { inr, num, fmtDateTime } from "@/lib/utils";
import { available, margin, profitPerUnit, invValue } from "@/lib/calc";

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, stockMovements, salesOrders, purchaseOrders } = useDataStore();
  const p = products.find((x) => x.id === id);

  const data = useMemo(() => {
    if (!p) return null;
    const moves = stockMovements.filter((m) => m.productId === p.id).sort((a, b) => b.createdAt - a.createdAt);
    const sales = salesOrders
      .filter((o) => o.status !== "Cancelled" && o.lines.some((l) => l.productId === p.id))
      .map((o) => ({ order: o, line: o.lines.find((l) => l.productId === p.id)! }))
      .sort((a, b) => b.order.createdAt - a.order.createdAt);
    const purchases = purchaseOrders.filter((po) => po.lines.some((l) => l.productId === p.id));
    const totalSold = sales.reduce((s, x) => s + x.line.qty, 0);
    const totalProfit = sales.reduce((s, x) => s + (x.line.price - x.line.cost) * x.line.qty - x.line.discount, 0);
    return { moves, sales, purchases, totalSold, totalProfit };
  }, [p, stockMovements, salesOrders, purchaseOrders]);

  if (!p || !data) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500">Product not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate("/products")}>Back to products</Button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => navigate("/products")} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Products
      </button>
      <PageHeader
        title={p.name}
        subtitle={`SKU ${p.sku} · ${p.brand} · ${p.category}`}
        actions={p.expiryTracking ? <Badge color="amber">Expiry tracked</Badge> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Boxes} label="Current Stock" value={num(p.stock)} sub={`${p.unit}`} />
        <StatCard icon={Package} label="Reserved" value={num(p.reserved)} accent="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" />
        <StatCard icon={Boxes} label="Available" value={num(available(p))} accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
        <StatCard icon={ShieldAlert} label="Reorder Level" value={num(p.reorderLevel)} accent="bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Pricing & Profit</h3>
          <dl className="space-y-2 text-sm">
            <Row k="Cost price" v={inr(p.costPrice)} />
            <Row k="Selling price" v={inr(p.sellingPrice)} />
            <Row k="Profit / unit" v={inr(profitPerUnit(p))} accent="text-emerald-600" />
            <Row k="Margin" v={`${margin(p).toFixed(1)}%`} accent="text-emerald-600" />
            <Row k="GST" v={`${p.gstRate}%`} />
            <Row k="Inventory value" v={inr(invValue(p))} />
            <Row k="Preferred vendor" v={p.vendorName || "—"} />
            <Row k="Total units sold" v={num(data.totalSold)} />
            <Row k="Total profit generated" v={inr(data.totalProfit)} accent="text-emerald-600" />
          </dl>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Inventory Movement Timeline</h3>
          <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-700">
            {data.moves.map((m) => (
              <li key={m.id}>
                <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${m.qty >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge value={m.type} />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{m.reason}</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${m.qty >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{m.qty > 0 ? "+" : ""}{m.qty}</span>
                </div>
                <div className="text-xs text-slate-400">{fmtDateTime(m.createdAt)} · balance {m.balanceAfter}{m.refNo ? ` · ${m.refNo}` : ""}</div>
              </li>
            ))}
            {!data.moves.length && <li className="text-sm text-slate-400">No movements recorded.</li>}
          </ol>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><TrendingUp className="h-4 w-4" /> Sales History</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.sales.map(({ order, line }) => (
              <div key={order.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-20 font-medium text-slate-900 dark:text-white">{order.orderNo}</span>
                <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{order.salonName}</span>
                <span className="tabular-nums text-slate-500">×{line.qty}</span>
                <StatusBadge value={order.status} />
              </div>
            ))}
            {!data.sales.length && <p className="py-3 text-sm text-slate-400">No sales yet.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Purchase History</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.purchases.map((po) => {
              const line = po.lines.find((l) => l.productId === p.id)!;
              return (
                <div key={po.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-20 font-medium text-slate-900 dark:text-white">{po.poNo}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{po.vendorName}</span>
                  <span className="tabular-nums text-slate-500">{line.received}/{line.qty} @ {inr(line.cost)}</span>
                  <StatusBadge value={po.status} />
                </div>
              );
            })}
            {!data.purchases.length && <p className="py-3 text-sm text-slate-400">No purchases yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className={`font-semibold tabular-nums text-slate-900 dark:text-white ${accent ?? ""}`}>{v}</dd>
    </div>
  );
}
