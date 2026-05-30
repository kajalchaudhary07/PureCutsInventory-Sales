import type { AppSettings, OrderLine, SalesOrder, Salon } from "@/types";
import { lineGst, lineNet } from "./calc";
import { LOGO_BASE64 } from "./logoBase64";

const lineSaving = (l: OrderLine) => {
  const mrp = l.originalPrice ?? 0;
  return mrp > l.price ? (mrp - l.price) * l.qty : 0;
};

// ---- Indian rupee → words (for "Total amount in words") ------------------
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? "-" + ONES[n % 10] : ""}`;
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return `${h ? ONES[h] + " Hundred" + (r ? " And " : "") : ""}${r ? twoDigits(r) : ""}`;
}
export function rupeesInWords(amount: number): string {
  const rupees = Math.floor(amount);
  if (rupees === 0) return "Zero Rupees";
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  let words = "";
  if (crore) words += threeDigits(crore) + " Crore ";
  if (lakh) words += threeDigits(lakh) + " Lakh ";
  if (thousand) words += threeDigits(thousand) + " Thousand ";
  if (rest) words += threeDigits(rest);
  return words.trim().replace(/\s+/g, " ") + " Rupees";
}

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number) =>
  "₹ " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- Standalone invoice HTML (matches the PureCuts layout) ---------------
export function buildInvoiceHtml(order: SalesOrder, s: AppSettings, salon?: Salon): string {
  const inv = `${s.invoicePrefix}${order.orderNo}`;
  const date = new Date(order.createdAt).toLocaleDateString("en-GB");
  const dueDate = new Date(order.expectedDelivery ?? order.createdAt + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB");
  const hasGst = order.gstTotal > 0;
  const totalSaving = order.lines.reduce((sum, line) => sum + Math.max(0, lineSaving(line)), 0);

  const rows = order.lines
    .map(
      (l) => {
        const saving = Math.max(0, lineSaving(l));
        return `
      <tr>
        <td class="desc">${esc(l.name)}${l.description ? `<div style="color:#9ca3af;font-size:11px">${esc(l.description)}</div>` : ""}</td>
        <td class="hsn"></td>
        <td class="num">${l.qty.toFixed(2)}</td>
        <td class="num">${l.price.toFixed(2)}</td>
        <td class="num">${l.originalPrice ? money(l.originalPrice) : "-"}</td>
        <td class="num">${l.originalPrice ? money(saving) : "-"}</td>
        <td class="num amt">${money(lineNet(l))}</td>
      </tr>`;
      }
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(inv)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Trebuchet MS, Helvetica, Arial, sans-serif; color: #1f2937; padding: 40px; font-size: 13px; line-height: 1.5; }
  
  /* Header with logo and company info */
  .header { display: flex; gap: 20px; margin-bottom: 30px; align-items: center; border-bottom: 2px solid #5b4b8a; padding-bottom: 20px; }
  .logo { display: flex; align-items: center; }
  .logo img { height: 70px; width: auto; }
  .company-info { flex: 1; }
  .company-info .name { font-size: 24px; font-weight: 700; color: #5b4b8a; margin-bottom: 5px; }
  .company-info .details { font-size: 12px; color: #6b7280; line-height: 1.6; }
  .company-info .details div { margin-bottom: 3px; }
  .invoice-number { text-align: right; min-width: 180px; }
  .invoice-number .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
  .invoice-number .value { font-size: 28px; font-weight: 700; color: #5b4b8a; }
  
  /* Bill To section */
  .billing-section { display: flex; gap: 40px; margin-bottom: 30px; }
  .bill-to, .bill-from { flex: 1; }
  .bill-to h3, .bill-from h3 { font-size: 11px; font-weight: 700; color: #5b4b8a; text-transform: uppercase; margin-bottom: 8px; }
  .bill-to .details, .bill-from .details { font-size: 12px; color: #374151; line-height: 1.8; }
  
  /* Meta info */
  .meta-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; padding: 15px; background: #f3f4f6; border-radius: 6px; }
  .meta-item { }
  .meta-label { font-size: 11px; font-weight: 600; color: #5b6b8a; text-transform: uppercase; margin-bottom: 4px; }
  .meta-value { font-size: 13px; font-weight: 600; color: #1f2937; }
  
  /* Items table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead { background: #5b4b8a; color: white; }
  thead th { text-align: left; padding: 12px 8px; font-size: 12px; font-weight: 600; border: none; }
  tbody td { padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody tr:hover { background: #f3f4f6; }
  .num { text-align: right; font-family: 'Courier New', monospace; }
  .desc { color: #1f2937; }
  .desc .sub { color: #9ca3af; font-size: 11px; }
  
  /* Totals section */
  .totals-section { display: flex; justify-content: flex-end; gap: 40px; margin-top: 30px; }
  .totals-summary { width: 350px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
  .total-row.grand { border-top: 2px solid #5b4b8a; border-bottom: 2px solid #5b4b8a; padding: 12px 0; font-weight: 700; font-size: 14px; color: #5b4b8a; margin: 10px 0; }
  .total-label { color: #4b5563; }
  .total-value { text-align: right; font-weight: 600; font-family: 'Courier New', monospace; }
  .savings-banner { margin-bottom: 14px; padding: 12px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #166534; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-block; }
  
  /* Amount in words */
  .words { margin-top: 15px; padding: 10px; background: #f9fafb; border-left: 3px solid #5b4b8a; font-size: 12px; color: #374151; }
  .words strong { color: #1f2937; }
  
  /* Notes and footer */
  .notes { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
  .notes strong { color: #374151; }
  
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; color: #6b7280; font-size: 11px; }
  
  /* Print styles */
  @media print { 
    body { padding: 0; margin: 0; }
    button { display: none; }
  }
</style></head>
<body>
  <!-- Header with Logo -->
  <div class="header">
    <div class="logo">
      <img src="${LOGO_BASE64}" alt="PureCuts Logo">
    </div>
    <div class="company-info">
      <div class="name">${esc(s.companyName)}</div>
      <div class="details">
        <div>${esc(s.companyAddress)}</div>
        <div>${esc(s.companyCity)}, ${esc(s.companyState)}</div>
        <div>${esc(s.companyPhone)} | ${esc(s.companyEmail)}</div>
        <div>${esc(s.companyWebsite)}</div>
      </div>
    </div>
    <div class="invoice-number">
      <div class="label">Invoice Number</div>
      <div class="value">${esc(inv)}</div>
    </div>
  </div>

  <!-- Billing Section -->
  <div class="billing-section">
    <div class="bill-to">
      <h3>Bill To</h3>
      <div class="details">
        <strong>${esc(order.salonName)}</strong>
        ${salon?.phone ? `<div>${esc(salon.phone)}</div>` : ""}
        ${salon?.address ? `<div>${esc(salon.address)}</div>` : ""}
      </div>
    </div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>HSN/SAC</th>
        <th class="num">Quantity</th>
        <th class="num">Unit Price</th>
        <th class="num">MRP</th>
        <th class="num">Saving</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="savings-banner">You saved ${money(totalSaving)} on this purchase.</div>

  <!-- Totals Section -->
  <div class="totals-section">
    <div class="totals-summary">
      <div class="total-row">
        <span class="total-label">Untaxed Amount</span>
        <span class="total-value">${money(order.subtotal - order.discountTotal)}</span>
      </div>
      ${order.discountTotal ? `<div class="total-row">
        <span class="total-label">Discount</span>
        <span class="total-value">- ${money(order.discountTotal)}</span>
      </div>` : ""}
      <div class="total-row">
        <span class="total-label">Total Saving</span>
        <span class="total-value">${money(totalSaving)}</span>
      </div>
      ${hasGst ? `<div class="total-row">
        <span class="total-label">GST</span>
        <span class="total-value">${money(order.gstTotal)}</span>
      </div>` : ""}
      ${(order.extraCharges ?? []).map((c) => `<div class="total-row">
        <span class="total-label">${esc(c.label || "Charge")}</span>
        <span class="total-value">${money(c.amount)}</span>
      </div>`).join("")}
      <div class="total-row grand">
        <span class="total-label">Total Amount</span>
        <span class="total-value">${money(order.total)}</span>
      </div>
      <div class="words">
        <strong>Amount in Words:</strong><br>
        ${esc(rupeesInWords(order.total))}
      </div>
    </div>
  </div>

  <!-- Notes -->
  ${order.invoiceNote ? `<div class="notes"><strong>Note:</strong> ${esc(order.invoiceNote)}</div>` : ""}

  <!-- Footer -->
  <div class="footer">
    <div>Page 1 / 1</div>
  </div>
</body></html>`;
}

// ---- Print / save-as-PDF in a clean popup window -------------------------
export function printInvoice(order: SalesOrder, s: AppSettings, salon?: Salon) {
  const html = buildInvoiceHtml(order, s, salon);
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) {
    // Popup blocked — fall back to a downloadable HTML file.
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Invoice-${s.invoicePrefix}${order.orderNo}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the browser a tick to lay out before invoking print.
  w.onload = () => setTimeout(() => w.print(), 300);
}

// ---- WhatsApp share ------------------------------------------------------
// Builds a plain-text invoice summary and opens WhatsApp with it prefilled.
export function invoiceWhatsappText(order: SalesOrder, s: AppSettings): string {
  const inv = `${s.invoicePrefix}${order.orderNo}`;
  const lines = order.lines
    .map((l) => `• ${l.name} ×${l.qty} — ${money(lineNet(l))}`)
    .join("\n");
  return [
    `*${s.companyName}*`,
    `Invoice ${inv}`,
    `Customer: ${order.salonName}`,
    "",
    lines,
    "",
    `Subtotal: ${money(order.subtotal - order.discountTotal)}`,
    order.gstTotal ? `GST: ${money(order.gstTotal)}` : "",
    `*Total: ${money(order.total)}*`,
    `Payment: ${order.paymentStatus}`,
    "",
    `${s.companyPhone} · ${s.companyWebsite}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function shareInvoiceWhatsapp(order: SalesOrder, s: AppSettings, phone?: string, salon?: Salon) {
  const text = encodeURIComponent(invoiceWhatsappText(order, s));
  // Normalize an Indian number to wa.me format (digits only, default +91).
  let num = (phone || "").replace(/\D/g, "");
  if (num && num.length === 10) num = "91" + num;
  const base = num ? `https://wa.me/${num}` : `https://wa.me/`;
  window.open(`${base}?text=${text}`, "_blank");
}
