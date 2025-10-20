import type { Order, Client, Product, Expense, LogEntry } from '../types';

// Empty defaults keep the UI ready for real data without shipping sample content.

export const demoClients: Client[] = [];

export const demoProducts: Product[] = [
  {
    id: 'product-t-g',
    displayId: 1,
    name: 'T',
    type: 'g',
    stock: 457,
    costPerUnit: 6,
    increment: 1,
    tiers: [
      { sizeLabel: '1g', quantity: 1, price: 40 },
      { sizeLabel: '2g', quantity: 2, price: 60 },
      { sizeLabel: '3.5g', quantity: 3.5, price: 130 },
      { sizeLabel: '7g', quantity: 7, price: 200 },
      { sizeLabel: '14g', quantity: 14, price: 300 },
      { sizeLabel: '28g', quantity: 28, price: 450 },
      { sizeLabel: '100g', quantity: 100, price: 1400 },
      { sizeLabel: '500g', quantity: 500, price: 5000 },
      { sizeLabel: '1kg', quantity: 1000, price: 8000 },
    ],
  },
  {
    id: 'product-t-p-g',
    displayId: 2,
    name: 'T-P',
    type: 'g',
    stock: 0,
    costPerUnit: 6,
    increment: 1,
    tiers: [
      { sizeLabel: '1g', quantity: 1, price: 40 },
      { sizeLabel: '2g', quantity: 2, price: 70 },
      { sizeLabel: '3.5g', quantity: 3.5, price: 150 },
      { sizeLabel: '7g', quantity: 7, price: 250 },
      { sizeLabel: '14g', quantity: 14, price: 400 },
      { sizeLabel: '28g', quantity: 28, price: 600 },
      { sizeLabel: '100g', quantity: 100, price: 1100 },
      { sizeLabel: '500g', quantity: 500, price: 7000 },
      { sizeLabel: '1kg', quantity: 1000, price: 12000 },
    ],
  },
  {
    id: 'product-g-h-ml',
    displayId: 3,
    name: 'G-H',
    type: 'ml',
    stock: 1014,
    costPerUnit: 0.4,
    increment: 5,
    tiers: [
      { sizeLabel: '5ml', quantity: 5, price: 10 },
      { sizeLabel: '10ml', quantity: 10, price: 20 },
      { sizeLabel: '60ml', quantity: 60, price: 100 },
      { sizeLabel: '100ml', quantity: 100, price: 180 },
      { sizeLabel: '1000ml', quantity: 1000, price: 1200 },
    ],
  },
  {
    id: 'product-v-unit',
    displayId: 4,
    name: 'V',
    type: 'unit',
    stock: 130,
    costPerUnit: 2,
    increment: 1,
    tiers: [
      { sizeLabel: 'Blue 100mg', quantity: 1, price: 6 },
      { sizeLabel: 'Purple 100mg', quantity: 1, price: 8 },
      { sizeLabel: 'Red 150mg', quantity: 1, price: 10 },
      { sizeLabel: 'Black 200mg', quantity: 1, price: 10 },
      { sizeLabel: 'Kama Jelly 100mg', quantity: 1, price: 10 },
      { sizeLabel: 'Levitra 60mg', quantity: 1, price: 12 },
    ],
  },
  {
    id: 'product-c-unit',
    displayId: 5,
    name: 'C (UNIT)',
    type: 'unit',
    stock: 0,
    costPerUnit: 3,
    increment: 1,
    tiers: [
      { sizeLabel: '20mg', quantity: 1, price: 8 },
      { sizeLabel: '60mg', quantity: 1, price: 10 },
      { sizeLabel: '80mg', quantity: 1, price: 12 },
    ],
  },
  {
    id: 'product-s-unit',
    displayId: 6,
    name: 'S (UNIT)',
    type: 'unit',
    stock: 120,
    costPerUnit: 1,
    increment: 1,
    tiers: [
      { sizeLabel: '1 unit', quantity: 1, price: 3 },
      { sizeLabel: '2 unit', quantity: 2, price: 5 },
      { sizeLabel: '10 unit', quantity: 10, price: 30 },
      { sizeLabel: '100 unit', quantity: 100, price: 200 },
    ],
  },
  {
    id: 'product-e-unit',
    displayId: 7,
    name: 'E',
    type: 'unit',
    stock: 730,
    costPerUnit: 2,
    increment: 1,
    tiers: [
      { sizeLabel: '1 unit', quantity: 1, price: 8 },
      { sizeLabel: '2 unit', quantity: 2, price: 15 },
      { sizeLabel: '100 unit', quantity: 100, price: 400 },
    ],
  },
  {
    id: 'product-m-unit',
    displayId: 8,
    name: 'M (UNIT)',
    type: 'unit',
    stock: 700,
    costPerUnit: 4,
    increment: 1,
    tiers: [
      { sizeLabel: '1 unit', quantity: 1, price: 8 },
    ],
  },
  {
    id: 'product-m-g',
    displayId: 9,
    name: 'M (G)',
    type: 'g',
    stock: 21.5,
    costPerUnit: 50,
    increment: 1,
    tiers: [
      { sizeLabel: '1g', quantity: 1, price: 70 },
    ],
  },
  {
    id: 'product-w-g',
    displayId: 10,
    name: 'W',
    type: 'g',
    stock: 322,
    costPerUnit: 6,
    increment: 0.5,
    tiers: [
      { sizeLabel: '0.5g', quantity: 0.5, price: 5 },
      { sizeLabel: '3.5g', quantity: 3.5, price: 20 },
      { sizeLabel: '28g', quantity: 28, price: 90 },
    ],
  },
  {
    id: 'product-h-g',
    displayId: 11,
    name: 'H',
    type: 'g',
    stock: 17,
    costPerUnit: 3,
    increment: 1,
    tiers: [
      { sizeLabel: '1g', quantity: 1, price: 10 },
    ],
  },
  {
    id: 'product-k-g',
    displayId: 12,
    name: 'K',
    type: 'g',
    stock: 296,
    costPerUnit: 60.6061,
    increment: 0.33,
    tiers: [
      { sizeLabel: '0.33g', quantity: 0.33, price: 40 },
      { sizeLabel: '1g', quantity: 1, price: 90 },
      { sizeLabel: '28g', quantity: 28, price: 750 },
    ],
  },
  {
    id: 'product-c-g',
    displayId: 13,
    name: 'C (G)',
    type: 'g',
    stock: 112,
    costPerUnit: 200,
    increment: 0.25,
    tiers: [
      { sizeLabel: '0.25g', quantity: 0.25, price: 25 },
      { sizeLabel: '0.5g', quantity: 0.5, price: 50 },
      { sizeLabel: '1g', quantity: 1, price: 100 },
      { sizeLabel: '2g', quantity: 2, price: 180 },
      { sizeLabel: '3.5g', quantity: 3.5, price: 280 },
      { sizeLabel: '7g', quantity: 7, price: 560 },
      { sizeLabel: '14g', quantity: 14, price: 800 },
      { sizeLabel: '28g', quantity: 28, price: 1100 },
    ],
  },
  {
    id: 'product-s-g',
    displayId: 14,
    name: 'S (G)',
    type: 'g',
    stock: 2,
    costPerUnit: 5,
    increment: 1,
    tiers: [
      { sizeLabel: '1g', quantity: 1, price: 10 },
      { sizeLabel: '3.5g', quantity: 3.5, price: 25 },
      { sizeLabel: '28g', quantity: 28, price: 150 },
    ],
  },
  {
    id: 'product-p-unit',
    displayId: 15,
    name: 'P',
    type: 'unit',
    stock: 9,
    costPerUnit: 25,
    increment: 1,
    tiers: [
      { sizeLabel: '30ml', quantity: 1, price: 55 },
      { sizeLabel: '60ml', quantity: 1, price: 75 },
    ],
  },
  {
    id: 'product-g-unit',
    displayId: 16,
    name: 'G',
    type: 'unit',
    stock: 2,
    costPerUnit: 2,
    increment: 1,
    tiers: [
      { sizeLabel: '1 unit', quantity: 1, price: 5 },
    ],
  },
  {
    id: 'product-t-l-unit',
    displayId: 17,
    name: 'T-L',
    type: 'unit',
    stock: 7,
    costPerUnit: 4,
    increment: 1,
    tiers: [
      { sizeLabel: '1 unit', quantity: 1, price: 10 },
    ],
  },
  {
    id: 'product-b-unit',
    displayId: 18,
    name: 'B',
    type: 'unit',
    stock: 3,
    costPerUnit: 20,
    increment: 1,
    tiers: [
      { sizeLabel: '1 unit', quantity: 1, price: 30 },
    ],
  },
];

export const demoOrders: Order[] = [];

export const demoExpenses: Expense[] = [];

export const demoLogs: LogEntry[] = [];

export const initialClients = demoClients;
export const initialProducts = demoProducts;
export const initialOrders = demoOrders;
export const initialExpenses = demoExpenses;
export const initialLogs = demoLogs;

export const demoData = {
  clients: demoClients,
  products: demoProducts,
  orders: demoOrders,
  expenses: demoExpenses,
  logs: demoLogs,
};

export default demoData;
