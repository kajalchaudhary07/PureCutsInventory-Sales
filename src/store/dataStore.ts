import { create } from "zustand";
import type {
  ActivityLog,
  ItemGroup,
  Product,
  PurchaseOrder,
  Salon,
  SalesOrder,
  StockMovement,
  Vendor,
} from "@/types";
import {
  seedActivityLogs,
  seedItemGroups,
  seedProducts,
  seedPurchaseOrders,
  seedSalesOrders,
  seedSalons,
  seedStockMovements,
  seedVendors,
} from "@/lib/seed";

interface DataState {
  products: Product[];
  itemGroups: ItemGroup[];
  salons: Salon[];
  vendors: Vendor[];
  stockMovements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  activityLogs: ActivityLog[];
  loaded: boolean;
  setCollection: <K extends keyof DataState>(key: K, value: DataState[K]) => void;
  loadSeed: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  products: [],
  itemGroups: [],
  salons: [],
  vendors: [],
  stockMovements: [],
  purchaseOrders: [],
  salesOrders: [],
  activityLogs: [],
  loaded: false,
  setCollection: (key, value) => set({ [key]: value } as Partial<DataState>),
  loadSeed: () =>
    set({
      products: seedProducts,
      itemGroups: seedItemGroups,
      salons: seedSalons,
      vendors: seedVendors,
      stockMovements: seedStockMovements,
      purchaseOrders: seedPurchaseOrders,
      salesOrders: seedSalesOrders,
      activityLogs: seedActivityLogs,
      loaded: true,
    }),
}));
