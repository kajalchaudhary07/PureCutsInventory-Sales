import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Truck, Trash2, PackageCheck, Pencil, Save, X, CreditCard, Wallet } from "lucide-react";
import { Button, Card, Field, Input, Select, PageHeader, StatCard, Badge } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useDataStore } from "@/store/dataStore";
import { saveDoc, updatePurchaseOrder, purchasePaymentStatus, logActivity } from "@/services/data";
import { inr, num, fmtDate, uid } from "@/lib/utils";
import type { PurchaseLine, PurchaseOrder, PurchasePaymentStatus } from "@/types";

function CreatePO({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { vendors, products } = useDataStore();
  const [vendorId, setVendorId] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([]);

  const addLine = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p || lines.some((l) => l.productId === productId)) return;
    setLines([...lines, { productId: p.id, name: p.name, sku: p.sku, qty: 10, received: 0, cost: p.costPrice }]);
  };
  const total = lines.reduce((s, l) => s + l.qty * l.cost, 0);

  const submit = async () => {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (!vendor || !lines.length) { toast.error("Pick a vendor and at least one product"); return; }
    const po: PurchaseOrder = {
      id: uid(),
      poNo: "PO-" + Math.floor(2000 + Math.random() * 8000),
      vendorId: vendor.id,
      vendorName: vendor.name,
      lines,
      total,
      status: "Sent",
      paidAmount: 0,
      paymentStatus: "Unpaid",
      createdAt: Date.now(),
    };
    await saveDoc("purchaseOrders", po);
    logActivity("Created PO", "purchaseOrder", `${po.poNo} · ${vendor.name} · ${inr(total)}`, po.poNo);
    toast.success("Purchase order created");
    setVendorId(""); setLines([]); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Purchase Order" wide
      footer={<><span className="mr-auto text-sm font-semibold">Total: {inr(total)}</span><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Create PO</Button></>}>
      <Field label="Vendor">
        <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
          <option value="">— select vendor —</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
      </Field>
      <div className="mt-4">
        <Field label="Add product">
          <Select value="" onChange={(e) => addLine(e.target.value)}>
            <option value="">— add a product —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-4 space-y-2">
        {lines.map((l, i) => (
          <div key={l.productId} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{l.name}</div>
              <div className="text-xs text-slate-400">{l.sku}</div>
            </div>
            <div className="w-20"><Input type="number" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} /></div>
            <div className="w-24"><Input type="number" value={l.cost} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, cost: Number(e.target.value) } : x))} /></div>
            <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {!lines.length && <p className="py-4 text-center text-sm text-slate-400">No products added.</p>}
      </div>
    </Modal>
  );
}

// Small badge that maps a purchase payment status to a colour.
function PaymentBadge({ status }: { status: PurchasePaymentStatus }) {
  const color = status === "Paid" ? "emerald" : status === "Partial" ? "amber" : "rose";
  return <Badge color={color}>{status}</Badge>;
}

function EditPOModal({ po, onClose }: { po: PurchaseOrder | null; onClose: () => void }) {
  if (!po) return null;
  return <EditPOForm po={po} onClose={onClose} />;
}

function EditPOForm({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  // Absolute received qty per line (defaults to what's already recorded).
  const [received, setReceived] = useState<Record<string, number>>(
    () => Object.fromEntries(po.lines.map((l) => [l.productId, l.received]))
  );
  const [paidAmount, setPaidAmount] = useState(po.paidAmount ?? 0);

  const setLineRecv = (productId: string, qty: number, max: number) =>
    setReceived((r) => ({ ...r, [productId]: Math.max(0, Math.min(max, Math.floor(qty || 0))) }));

  const orderedUnits = po.lines.reduce((s, l) => s + l.qty, 0);
  const recvUnits = po.lines.reduce((s, l) => s + (received[l.productId] ?? l.received), 0);
  const allReceived = po.lines.every((l) => (received[l.productId] ?? l.received) >= l.qty);
  const someReceived = po.lines.some((l) => (received[l.productId] ?? l.received) > 0);
  const previewStatus: PurchaseOrder["status"] = allReceived ? "Received" : someReceived ? "Partial" : po.status;
  const balance = Math.max(0, po.total - paidAmount);
  const payStatus = purchasePaymentStatus(paidAmount, po.total);

  const submit = async () => {
    await updatePurchaseOrder(po, { received, paidAmount });
    toast.success("Purchase order updated");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit — ${po.poNo}`}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}><X className="h-4 w-4" /> Cancel</Button>
          <Button onClick={submit}><Save className="h-4 w-4" /> Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Receiving summary */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <PackageCheck className="h-4 w-4" />
          <span>Received <b className="tabular-nums">{recvUnits}</b> / <b className="tabular-nums">{orderedUnits}</b> units</span>
          <span className="ml-auto flex items-center gap-1.5">Status will be <StatusBadge value={previewStatus} /></span>
        </div>

        {/* Per-line received quantity */}
        <div className="space-y-2">
          {po.lines.map((l) => {
            const val = received[l.productId] ?? l.received;
            return (
              <div key={l.productId} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{l.name}</div>
                  <div className="text-xs text-slate-400">Ordered {l.qty} · @ {inr(l.cost)}</div>
                </div>
                <div className="w-28">
                  <Field label="Received">
                    <Input
                      type="number"
                      min={0}
                      max={l.qty}
                      value={val}
                      onChange={(e) => setLineRecv(l.productId, Number(e.target.value), l.qty)}
                    />
                  </Field>
                </div>
                <div className="w-12 pt-6 text-right text-xs tabular-nums text-slate-400">/ {l.qty}</div>
              </div>
            );
          })}
        </div>

        {/* Payment block */}
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <CreditCard className="h-4 w-4" /> Payment
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Total purchase amount">
              <Input value={inr(po.total)} disabled />
            </Field>
            <Field label="Amount paid">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Math.max(0, Number(e.target.value)))}
              />
            </Field>
            <Field label="Balance">
              <Input value={inr(balance)} disabled />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Wallet className="h-4 w-4" />
            <span className="tabular-nums">{inr(paidAmount)} / {inr(po.total)}</span>
            <span className="ml-auto"><PaymentBadge status={payStatus} /></span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function PurchaseOrders() {
  const { purchaseOrders, vendors } = useDataStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [filter, setFilter] = useState("all");

  const stats = useMemo(() => ({
    pending: purchaseOrders.filter((p) => ["Draft", "Sent", "Partial"].includes(p.status)).length,
    received: purchaseOrders.filter((p) => p.status === "Received").length,
    value: purchaseOrders.reduce((s, p) => s + p.total, 0),
    outstanding: purchaseOrders
      .filter((p) => p.status !== "Cancelled")
      .reduce((s, p) => s + Math.max(0, p.total - (p.paidAmount ?? 0)), 0),
    vendors: vendors.length,
  }), [purchaseOrders, vendors]);

  const rows = purchaseOrders
    .filter((p) => filter === "all" || p.status === filter)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Order stock from vendors and receive inventory."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create PO</Button>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Truck} label="Pending POs" value={num(stats.pending)} accent="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" />
        <StatCard icon={PackageCheck} label="Received POs" value={num(stats.received)} accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
        <StatCard icon={Truck} label="Total Purchase Value" value={inr(stats.value)} accent="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" />
        <StatCard icon={CreditCard} label="Amount Due" value={inr(stats.outstanding)} accent="bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" />
      </div>

      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        {["all", "Draft", "Sent", "Partial", "Received", "Cancelled"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 ring-inset transition ${filter === s ? "bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"}`}>
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((po) => {
          const recvUnits = po.lines.reduce((s, l) => s + l.received, 0);
          const orderedUnits = po.lines.reduce((s, l) => s + l.qty, 0);
          return (
            <Card key={po.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-24">
                  <div className="font-semibold text-slate-900 dark:text-white">{po.poNo}</div>
                  <div className="text-xs text-slate-400">{fmtDate(po.createdAt)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{po.vendorName}</div>
                  <div className="text-xs text-slate-400">{po.lines.length} items · {recvUnits}/{orderedUnits} units received</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums text-slate-900 dark:text-white">{inr(po.total)}</div>
                  {(po.paidAmount ?? 0) > 0 && (po.paidAmount ?? 0) < po.total && (
                    <div className="text-xs text-rose-500 tabular-nums">due {inr(po.total - (po.paidAmount ?? 0))}</div>
                  )}
                </div>
                <StatusBadge value={po.status} />
                <PaymentBadge status={po.paymentStatus ?? purchasePaymentStatus(po.paidAmount ?? 0, po.total)} />
                <Button variant="secondary" onClick={() => setEditing(po)}><Pencil className="h-4 w-4" /> Edit</Button>
              </div>
            </Card>
          );
        })}
        {!rows.length && <p className="py-10 text-center text-sm text-slate-400">No purchase orders.</p>}
      </div>

      <CreatePO open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditPOModal po={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
