import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { useDataStore } from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import { uid, inr } from "@/lib/utils";
import { orderTotals } from "@/lib/calc";
import type {
  ActivityLog,
  CollectionName,
  MovementType,
  OrderLine,
  Product,
  PurchaseOrder,
  SalesOrder,
  SalesStatus,
  StockMovement,
} from "@/types";

const COLLECTIONS: CollectionName[] = [
  "products",
  "itemGroups",
  "salons",
  "vendors",
  "stockMovements",
  "purchaseOrders",
  "salesOrders",
  "activityLogs",
];

// Transform ecommerce product to inventory product
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformEcommerceProduct(ecomProduct: any): Product {
  return {
    id: ecomProduct.id || uid(),
    name: ecomProduct.name || "Unknown Product",
    sku: ecomProduct.sku || ecomProduct.id || "",
    brand: ecomProduct.brand || "N/A",
    category: ecomProduct.categoryName || ecomProduct.category || "Uncategorized",
    imageUrl: ecomProduct.image || ecomProduct.thumbnailUrl || ecomProduct.fullImageUrl,
    unit: ecomProduct.unit || "pcs", // Default unit if not specified
    stock: ecomProduct.stock || 0,
    reserved: 0, // Start at 0, will be managed by inventory
    reorderLevel: 10, // Default reorder level
    costPrice: 0, // Leave empty for manual entry - user will add their cost
    sellingPrice: ecomProduct.price || 0, // Current selling price from app
    gstRate: 18, // Default GST rate
    barcode: ecomProduct.barcode,
    vendorId: undefined,
    vendorName: undefined,
    groupId: ecomProduct.id, // For variant grouping if needed
    attributes: ecomProduct.size ? { Size: ecomProduct.size } : undefined,
    expiryTracking: false,
    inventoryOnly: false, // App products are visible by default
    status: "active" as const,
    createdAt: ecomProduct.createdAt || Date.now(),
    updatedAt: ecomProduct.updatedAt || Date.now(),
    // Store MRP for reference (not in original Product type, but we'll use originalPrice field)
    originalPrice: ecomProduct.originalPrice || 0,
  };
}

// Attach live Firestore listeners, or load dummy data in demo mode.
export function initData(): () => void {
  if (!isFirebaseConfigured || !db) {
    useDataStore.getState().loadSeed();
    return () => {};
  }
  const unsubs: (() => void)[] = [];

  // Listen to ecommerce products and transform them
  unsubs.push(
    onSnapshot(collection(db!, "products"), (snap) => {
      const ecommerceProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const transformedProducts = ecommerceProducts.map(transformEcommerceProduct);
      useDataStore.getState().setCollection("products", transformedProducts);
    })
  );

  // Listen to inventory-specific collections
  const inventoryCollections: CollectionName[] = [
    "itemGroups",
    "salons",
    "vendors",
    "stockMovements",
    "purchaseOrders",
    "salesOrders",
    "activityLogs",
  ];

  inventoryCollections.forEach((name) => {
    unsubs.push(
      onSnapshot(collection(db!, name), (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useDataStore.getState().setCollection(name as any, rows as any);
      })
    );
  });

  useDataStore.setState({ loaded: true });
  return () => unsubs.forEach((u) => u());
}

// Generic upsert / delete that target Firestore (live) or the in-memory store (demo).
export async function saveDoc<T extends { id: string }>(name: CollectionName, item: T) {
  if (isFirebaseConfigured && db) {
    // Remove undefined values - Firestore doesn't allow them
    const cleanItem = Object.fromEntries(
      Object.entries(item).filter(([_, value]) => value !== undefined)
    );
    await setDoc(doc(db, name, item.id), cleanItem, { merge: true });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (useDataStore.getState() as any)[name] as T[];
    const next = cur.some((x) => x.id === item.id)
      ? cur.map((x) => (x.id === item.id ? item : x))
      : [item, ...cur];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useDataStore.getState().setCollection(name as any, next as any);
  }
}

export async function removeDoc(name: CollectionName, id: string) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, name, id));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (useDataStore.getState() as any)[name] as { id: string }[];
    useDataStore
      .getState()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .setCollection(name as any, cur.filter((x) => x.id !== id) as any);
  }
}

export function logActivity(action: string, entity: string, detail: string, entityId?: string) {
  const log: ActivityLog = {
    id: uid(),
    action,
    entity,
    detail,
    entityId,
    user: useAuthStore.getState().user?.email ?? "system",
    createdAt: Date.now(),
  };
  void saveDoc("activityLogs", log);
}

// ---- Business operations -------------------------------------------------

export async function createSalesOrder(o: SalesOrder) {
  await saveDoc("salesOrders", o);
  for (const line of o.lines) {
    const p = useDataStore.getState().products.find((x) => x.id === line.productId);
    if (!p) continue;
    const newStock = p.stock - line.qty;
    await saveDoc<Product>("products", { ...p, stock: newStock, updatedAt: Date.now() });
    await saveDoc<StockMovement>("stockMovements", {
      id: uid(),
      productId: p.id,
      productName: p.name,
      type: "out",
      qty: -line.qty,
      reason: "Sale",
      refNo: o.orderNo,
      balanceAfter: newStock,
      createdAt: Date.now(),
    });
  }
  const salon = useDataStore.getState().salons.find((s) => s.id === o.salonId);
  if (salon) {
    await saveDoc("salons", {
      ...salon,
      totalPurchases: salon.totalPurchases + o.total,
      outstanding: salon.outstanding + (o.paymentStatus === "Paid" ? 0 : o.total),
    });
  }
  logActivity("Created order", "salesOrder", `${o.channel} order · ${o.salonName} · ${inr(o.total)}`, o.orderNo);
}

export async function setOrderStatus(order: SalesOrder, status: SalesStatus) {
  const now = Date.now();
  // Stamp the moment this status was first reached (don't overwrite existing).
  const stamp: Partial<SalesOrder> = {};
  if (status === "Packed" && !order.packedAt) stamp.packedAt = now;
  if (status === "Delivered" && !order.deliveredAt) stamp.deliveredAt = now;
  if (status === "Cancelled" && !order.cancelledAt) stamp.cancelledAt = now;
  if (status === "Returned" && !order.returnedAt) stamp.returnedAt = now;
  await saveDoc("salesOrders", { ...order, status, ...stamp });
  // Returned orders restock the goods.
  if (status === "Returned" && order.status !== "Returned") {
    for (const line of order.lines) {
      const p = useDataStore.getState().products.find((x) => x.id === line.productId);
      if (!p) continue;
      const newStock = p.stock + line.qty;
      await saveDoc<Product>("products", { ...p, stock: newStock, updatedAt: Date.now() });
      await saveDoc<StockMovement>("stockMovements", {
        id: uid(),
        productId: p.id,
        productName: p.name,
        type: "return",
        qty: line.qty,
        reason: "Customer return",
        refNo: order.orderNo,
        balanceAfter: newStock,
        createdAt: Date.now(),
      });
    }
  }
  logActivity("Order status", "salesOrder", `${order.orderNo} → ${status}`, order.orderNo);
}

export async function adjustStock(
  product: Product,
  type: MovementType,
  signedQty: number,
  reason: string
) {
  const newStock = product.stock + signedQty;
  await saveDoc<Product>("products", { ...product, stock: newStock, updatedAt: Date.now() });
  await saveDoc<StockMovement>("stockMovements", {
    id: uid(),
    productId: product.id,
    productName: product.name,
    type,
    qty: signedQty,
    reason,
    balanceAfter: newStock,
    createdAt: Date.now(),
  });
  logActivity("Stock adjustment", "product", `${product.sku}: ${signedQty > 0 ? "+" : ""}${signedQty} (${reason})`, product.sku);
}

// Receive (fully or partially) lines of a purchase order; adds stock + movements.
export async function receivePurchase(po: PurchaseOrder, receipts: Record<string, number>) {
  const lines = po.lines.map((l) => ({
    ...l,
    received: Math.min(l.qty, l.received + (receipts[l.productId] || 0)),
  }));
  for (const l of po.lines) {
    const add = receipts[l.productId] || 0;
    if (add <= 0) continue;
    const p = useDataStore.getState().products.find((x) => x.id === l.productId);
    if (!p) continue;
    const newStock = p.stock + add;
    await saveDoc<Product>("products", { ...p, stock: newStock, costPrice: l.cost, updatedAt: Date.now() });
    await saveDoc<StockMovement>("stockMovements", {
      id: uid(),
      productId: p.id,
      productName: p.name,
      type: "in",
      qty: add,
      reason: "PO receipt",
      refNo: po.poNo,
      balanceAfter: newStock,
      createdAt: Date.now(),
    });
  }
  const fully = lines.every((l) => l.received >= l.qty);
  const some = lines.some((l) => l.received > 0);
  const status: PurchaseOrder["status"] = fully ? "Received" : some ? "Partial" : po.status;
  await saveDoc("purchaseOrders", { ...po, lines, status });
  logActivity("Received PO", "purchaseOrder", `${po.poNo} — ${status}`, po.poNo);
}

// Apply edited invoice (lines, extra charges, note) back to a sales order,
// recomputing all totals & profit. Optionally also push the new price/cost onto
// the product master records (the "ask each time" choice from the invoice screen).
export async function updateOrderPricing(
  order: SalesOrder,
  lines: OrderLine[],
  updateMaster: boolean,
  extras?: { extraCharges?: { id: string; label: string; amount: number }[]; invoiceNote?: string }
) {
  const extraCharges = extras?.extraCharges ?? order.extraCharges ?? [];
  const totals = orderTotals(lines, extraCharges);
  await saveDoc("salesOrders", {
    ...order,
    lines,
    ...totals,
    extraCharges,
    invoiceNote: extras?.invoiceNote ?? order.invoiceNote ?? "",
  });

  if (updateMaster) {
    for (const l of lines) {
      const p = useDataStore.getState().products.find((x) => x.id === l.productId);
      if (!p) continue;
      if (p.sellingPrice !== l.price || p.costPrice !== l.cost) {
        await saveDoc<Product>("products", { ...p, sellingPrice: l.price, costPrice: l.cost, updatedAt: Date.now() });
      }
    }
  }
  logActivity(
    "Edited invoice",
    "salesOrder",
    `${order.orderNo} updated${updateMaster ? " + product master updated" : ""}`,
    order.orderNo
  );
}
