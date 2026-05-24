import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Store, Pencil, IndianRupee } from "lucide-react";
import { Button, Field, Input, Textarea, PageHeader, StatCard, Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { useDataStore } from "@/store/dataStore";
import { saveDoc, logActivity } from "@/services/data";
import { inr, num, uid } from "@/lib/utils";
import type { Salon } from "@/types";

const schema = z.object({
  name: z.string().min(2, "Required"),
  ownerName: z.string().min(2, "Required"),
  phone: z.string().min(8, "Enter a valid phone"),
  gstin: z.string().optional(),
  address: z.string().optional(),
  region: z.string().optional(),
  branchNo: z.string().optional(),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function SalonForm({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Salon | null }) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: editing ? { name: editing.name, ownerName: editing.ownerName, phone: editing.phone, gstin: editing.gstin, address: editing.address, region: editing.region, branchNo: editing.branchNo, description: editing.description } : { name: "", ownerName: "", phone: "", gstin: "", address: "", region: "", branchNo: "", description: "" },
  });
  const onSubmit = async (v: FormValues) => {
    const salon: Salon = {
      id: editing?.id ?? uid(),
      outstanding: editing?.outstanding ?? 0,
      totalPurchases: editing?.totalPurchases ?? 0,
      createdAt: editing?.createdAt ?? Date.now(),
      ...v,
    };
    await saveDoc("salons", salon);
    logActivity(editing ? "Edited salon" : "Added salon", "salon", salon.name);
    toast.success(editing ? "Salon updated" : "Salon added");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Salon" : "Add Salon"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit(onSubmit)}>{editing ? "Save" : "Add"}</Button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Salon name" error={errors.name?.message}><Input {...register("name")} /></Field>
        <Field label="Owner name" error={errors.ownerName?.message}><Input {...register("ownerName")} /></Field>
        <Field label="Phone" error={errors.phone?.message}><Input {...register("phone")} /></Field>
        <Field label="GSTIN"><Input {...register("gstin")} /></Field>
        <Field label="Region / City"><Input {...register("region")} placeholder="Mumbai, Thane, Pune…" /></Field>
        <Field label="Branch No"><Input {...register("branchNo")} placeholder="e.g. B-2 (optional)" /></Field>
        <div className="sm:col-span-2"><Field label="Address"><Input {...register("address")} /></Field></div>
        <div className="sm:col-span-2"><Field label="Description / notes"><Textarea rows={3} {...register("description")} placeholder="Preferred brands, delivery notes, payment terms…" /></Field></div>
      </div>
    </Modal>
  );
}

export default function Salons() {
  const { salons, salesOrders } = useDataStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Salon | null>(null);

  const enriched = useMemo(() => salons.map((s) => {
    const orders = salesOrders.filter((o) => o.salonId === s.id && o.status !== "Cancelled");
    return { salon: s, revenue: orders.reduce((a, o) => a + o.total, 0), profit: orders.reduce((a, o) => a + o.profit, 0), orders: orders.length };
  }), [salons, salesOrders]);

  const totals = {
    count: salons.length,
    revenue: enriched.reduce((s, e) => s + e.revenue, 0),
    outstanding: salons.reduce((s, x) => s + x.outstanding, 0),
  };

  const columns: ColumnDef<(typeof enriched)[number], unknown>[] = [
    { header: "Salon", accessorFn: (e) => e.salon.name, cell: ({ row }) => (<div><div className="font-medium text-slate-900 dark:text-white">{row.original.salon.name}{row.original.salon.branchNo ? <span className="ml-1.5 text-xs text-slate-400">· Branch {row.original.salon.branchNo}</span> : null}</div><div className="text-xs text-slate-400">{row.original.salon.ownerName} · {row.original.salon.phone}</div></div>) },
    { header: "GSTIN", accessorFn: (e) => e.salon.gstin || "—", cell: ({ getValue }) => <span className="text-slate-500">{getValue() as string}</span> },
    { header: "Orders", accessorKey: "orders", cell: ({ getValue }) => <span className="tabular-nums">{num(getValue() as number)}</span> },
    { header: "Revenue", accessorKey: "revenue", cell: ({ getValue }) => <span className="font-semibold tabular-nums">{inr(getValue() as number)}</span> },
    { header: "Profit", accessorKey: "profit", cell: ({ getValue }) => <span className="font-semibold tabular-nums text-emerald-600">{inr(getValue() as number)}</span> },
    { header: "Outstanding", accessorFn: (e) => e.salon.outstanding, cell: ({ getValue }) => { const v = getValue() as number; return v > 0 ? <Badge color="rose">{inr(v)}</Badge> : <Badge color="emerald">Clear</Badge>; } },
    { header: "", id: "actions", cell: ({ row }) => <button onClick={() => { setEditing(row.original.salon); setOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></button> },
  ];

  return (
    <div>
      <PageHeader title="Salon Customers" subtitle="B2B customers, revenue and outstanding balances."
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add Salon</Button>} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Store} label="Total Salons" value={num(totals.count)} />
        <StatCard icon={IndianRupee} label="Total Revenue" value={inr(totals.revenue)} accent="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" />
        <StatCard icon={IndianRupee} label="Outstanding" value={inr(totals.outstanding)} accent="bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" />
      </div>

      <div className="mt-6">
        <DataTable data={enriched} columns={columns} searchPlaceholder="Search salons…" />
      </div>

      <SalonForm open={open} onClose={() => setOpen(false)} editing={editing} />
    </div>
  );
}
