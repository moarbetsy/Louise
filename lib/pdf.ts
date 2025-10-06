import type { Order, Client, Product } from '../types';
import { formatEntityDisplayId } from './utils';

// Lazy import to keep initial bundle light
async function getJsPDF() {
  const { jsPDF } = await import('jspdf');
  // @ts-ignore: types for autotable are not included by default path
  await import('jspdf-autotable');
  return jsPDF;
}

function findClient(clients: Client[], id: string): Client | undefined {
  return clients.find(c => c.id === id);
}

function findProduct(products: Product[], id: string): Product | undefined {
  return products.find(p => p.id === id);
}

export async function printOrderPdf(order: Order, clients: Client[], products: Product[], type: 'bill' | 'final') {
  const jsPDF = await getJsPDF();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const line = (y: number) => doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);

  const client = findClient(clients, order.clientId);
  const clientDisplay = client ? formatEntityDisplayId('client', client.displayId, client.id) : 'Unknown';
  const orderLabel = formatEntityDisplayId('order', order.displayId);
  const orderDisplay = orderLabel || `Order ${order.id}`;
  const orderFileToken = (orderLabel || order.id).replace(/\s+/g, '_');

  // Header
  doc.setFontSize(18);
  doc.text(type === 'final' ? 'Final Bill' : 'Bill', margin, 60);
  doc.setFontSize(10);
  doc.text(`Date: ${order.date}`, margin, 80);
  doc.text(`Order: ${orderDisplay}`, margin, 95);
  doc.text(`Client: ${clientDisplay}`, margin, 110);
  line(125);

  // Items table (IDs only, no names)
  const rows = order.items.map(item => {
    const prod = findProduct(products, item.productId);
    const productIdDisplay = formatEntityDisplayId('product', prod?.displayId, prod?.id || 'Unknown');
    const qty = item.sizeLabel ?? `${item.quantity}`;
    const price = Math.round(item.price);
    return [productIdDisplay, qty, `$${price.toLocaleString()}`];
  });

  // @ts-ignore: autotable is added via side-effect import
  (doc as any).autoTable({
    startY: 150,
    head: [['Product ID', 'Qty', 'Price']],
    body: rows,
    styles: { fontSize: 10 },
    theme: 'grid',
    headStyles: { fillColor: [88,114,255] },
    margin: { left: margin, right: margin },
  });

  let y = (doc as any).lastAutoTable.finalY + 20;
  line(y);
  y += 20;
  doc.setFontSize(12);
  doc.text(`Subtotal: $${Math.round(order.items.reduce((s, i) => s + i.price, 0)).toLocaleString()}`, margin, y);
  y += 16;
  if (order.discount?.amount) {
    doc.text(`Discount: -$${Math.round(order.discount.amount).toLocaleString()}`, margin, y);
    y += 16;
  }
  if (order.fees?.amount) {
    doc.text(`Fees: +$${Math.round(order.fees.amount).toLocaleString()}`, margin, y);
    y += 16;
  }
  doc.setFont(undefined, 'bold');
  doc.text(`Total: $${Math.round(order.total).toLocaleString()}`, margin, y);
  doc.setFont(undefined, 'normal');
  y += 24;

  if (order.amountPaid) {
    const pm: any = order.paymentMethods || {};
    const cash = typeof pm.cash === 'number' ? pm.cash : (pm.cash ? (order.amountPaid || 0) : 0);
    const et = typeof pm.etransfer === 'number' ? pm.etransfer : (pm.etransfer ? (order.amountPaid || 0) : 0);
    const parts: string[] = [];
    if (cash && cash > 0) parts.push(`$${Math.round(cash).toLocaleString()} Cash`);
    if (et && et > 0) parts.push(`$${Math.round(et).toLocaleString()} E-transfer`);
    doc.text(`Paid: $${Math.round(order.amountPaid).toLocaleString()}`, margin, y);
    y += 16;
    if (parts.length > 0) {
      doc.text(`Payment Breakdown: ${parts.join(', ')}`, margin, y);
      y += 16;
    }
  }

  const fileName = `${type === 'final' ? 'final' : 'bill'}_${orderFileToken}_${order.date}.pdf`;
  doc.save(fileName);
}
