import React, { useMemo, useState } from 'react';
import type { Order, Product, Expense, Client } from '../types';
import { GlassCard } from './common';
import { formatEntityDisplayId } from '../lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';

type Props = {
  orders: Order[];
  products: Product[];
  expenses: Expense[];
  clients: Client[];
  isPrivateMode: boolean;
};

const ReportsPage: React.FC<Props> = ({ orders, products, expenses, clients, isPrivateMode }) => {
  const [profitSortConfig, setProfitSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'netProfit', direction: 'desc' });

  const filteredData = useMemo(() => ({ orders, expenses }), [orders, expenses]);

  const reportStats = useMemo(() => {
    const { orders, expenses } = filteredData;
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalCost = orders.reduce((sum, o) => {
      return sum + o.items.reduce((itemSum, item) => {
        const product = products.find(p => p.id === item.productId);
        return itemSum + (product ? item.quantity * product.costPerUnit : 0);
      }, 0);
    }, 0);
    const totalProfit = totalRevenue - totalCost;
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netIncome = totalProfit - totalExpenses;
    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    return { totalRevenue, totalProfit, totalExpenses, netIncome, orderCount, avgOrderValue };
  }, [filteredData, products]);

  const handleProfitSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (profitSortConfig.key === key && profitSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setProfitSortConfig({ key, direction });
  };

  const productProfitabilityData = useMemo(() => {
    const profitMap = new Map<string, {
      productId: string;
      name: string;
      unitsSold: number;
      totalSales: number;
      totalCost: number;
      netProfit: number;
      margin: number;
    }>();

    filteredData.orders.forEach(order => {
      order.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return;

        const current = profitMap.get(item.productId) || {
          productId: product.id,
          name: product.name,
          unitsSold: 0,
          totalSales: 0,
          totalCost: 0,
          netProfit: 0,
          margin: 0
        };

        current.unitsSold += item.quantity;
        current.totalSales += item.price;
        current.totalCost += item.quantity * product.costPerUnit;
        profitMap.set(item.productId, current);
      });
    });

    let result = Array.from(profitMap.values()).map(p => {
      const netProfit = p.totalSales - p.totalCost;
      const margin = p.totalSales > 0 ? (netProfit / p.totalSales) * 100 : 0;
      return { ...p, netProfit, margin };
    });

    if (profitSortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[profitSortConfig.key as keyof typeof a];
        const bValue = b[profitSortConfig.key as keyof typeof b];
        if (aValue < bValue) return profitSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return profitSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [filteredData, products, profitSortConfig]);

  const salesByProductData = useMemo(() => {
    const salesMap = new Map<string, { name: string; sales: number }>();
    filteredData.orders.forEach(order => {
      order.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return;
        const productName = isPrivateMode ? formatEntityDisplayId('product', product.displayId, product.id) : product.name;
        const current = salesMap.get(productName) || { name: productName, sales: 0 };
        current.sales += item.price;
        salesMap.set(productName, current);
      });
    });
    return Array.from(salesMap.values()).sort((a, b) => b.sales - a.sales).slice(0, 10);
  }, [filteredData, products, isPrivateMode]);

  const topClientsData = useMemo(() => {
    const clientMap = new Map<string, { name: string; sales: number }>();
    filteredData.orders.forEach(order => {
      const client = clients.find(c => c.id === order.clientId);
      if (!client) return;
      const clientName = isPrivateMode ? formatEntityDisplayId('client', client.displayId, client.id) : client.name;
      const current = clientMap.get(clientName) || { name: clientName, sales: 0 };
      current.sales += order.total;
      clientMap.set(clientName, current);
    });
    return Array.from(clientMap.values()).sort((a, b) => b.sales - a.sales).slice(0, 10);
  }, [filteredData, clients, isPrivateMode]);

  const monthlySalesData = useMemo(() => {
    const salesMap = new Map<string, number>();
    filteredData.orders.forEach(order => {
      const month = new Date(order.date).toISOString().slice(0, 7); // YYYY-MM
      const current = salesMap.get(month) || 0;
      salesMap.set(month, current + order.total);
    });
    return Array.from(salesMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredData]);

  const expenseByCategoryData = useMemo(() => {
    const expenseMap = new Map<string, number>();
    filteredData.expenses.forEach(expense => {
      const category = expense.category || 'Uncategorized';
      const current = expenseMap.get(category) || 0;
      expenseMap.set(category, current + expense.amount);
    });
    return Array.from(expenseMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-muted">Total Revenue</div>
              <div className="text-2xl font-bold text-primary">${Math.round(reportStats.totalRevenue).toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted">Orders</div>
              <div className="text-2xl font-bold text-primary">{reportStats.orderCount}</div>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-sm text-muted">Net Income</div>
          <div className="text-2xl font-bold text-primary">${Math.round(reportStats.netIncome).toLocaleString()}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-sm text-muted">Avg Order Value</div>
          <div className="text-2xl font-bold text-primary">${Math.round(reportStats.avgOrderValue).toLocaleString()}</div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard title="Top 10 Clients by Orders">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topClientsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" stroke="var(--text-muted)" />
              <YAxis type="category" dataKey="name" width={80} stroke="var(--text-muted)" />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-muted)' }} contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} />
              <Bar dataKey="sales" fill="rgba(var(--accent), 0.7)" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
        <GlassCard title="Monthly Sales">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlySalesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" stroke="var(--text-muted)" />
              <YAxis stroke="var(--text-muted)" />
              <Tooltip itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-muted)' }} contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} />
              <Legend wrapperStyle={{ color: 'var(--text-muted)' }} />
              <Line type="monotone" dataKey="value" stroke="rgba(var(--accent), 0.9)" />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
        <GlassCard title="Top 10 Products by Sales">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesByProductData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" stroke="var(--text-muted)" />
              <YAxis type="category" dataKey="name" width={80} stroke="var(--text-muted)" />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-muted)' }} contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} />
              <Bar dataKey="sales" fill="rgba(var(--accent), 0.7)" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
        <GlassCard title="Expenses by Category">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={expenseByCategoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" stroke="var(--text-muted)" />
              <YAxis stroke="var(--text-muted)" />
              <Tooltip itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-muted)' }} contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} />
              <Legend wrapperStyle={{ color: 'var(--text-muted)' }} />
              <Bar dataKey="value" name="Expenses" fill="rgba(192, 132, 252, 0.7)" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>
    </div>
  );
};

export default ReportsPage;
