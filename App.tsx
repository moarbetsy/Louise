



import React, { useEffect, useState, useMemo, useRef, useCallback, Suspense } from 'react';
// FIX: The `Mask` icon does not exist in `lucide-react`. Replaced with `EyeOff` for the private mode toggle.
import {
  ShoppingCart, Users, Box, Plus, Home, Search,
  Package, ReceiptText, History, LogOut, Settings, DollarSign, Trash2, TrendingUp, Calendar, AreaChart, Calculator, Save, X, Download, ArrowUpDown, ArrowUp, ArrowDown, Upload, EyeOff, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// Recharts is only used in the reports view; it's loaded lazily with that page

import { useLocalStorage } from './hooks/useLocalStorage';
import type { Page, Order, Client, Product, OrderItem, Expense, LogEntry, Metric, DashboardStat } from './types';
import { initialClients, initialProducts, initialOrders, initialExpenses, initialLogs } from './lib/data';
import { calculateCost, exportToCsv, groupOrderItems, buildClientShortNameMap, formatEntityDisplayId } from './lib/utils';
import { initCountersFromData, getNextDisplayId } from './lib/id';
// Lazily load heavy modal bundle to speed up initial load
const CreateOrderModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.CreateOrderModal })));
const CreateClientModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.CreateClientModal })));
const CreateProductModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.CreateProductModal })));
const AddStockModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.AddStockModal })));
const EditClientModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.EditClientModal })));
const EditOrderModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.EditOrderModal })));
const EditProductModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.EditProductModal })));
const ClientOrdersModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.ClientOrdersModal })));
const OrderDetailsModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.OrderDetailsModal })));
const EditExpenseModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.EditExpenseModal })));
const LogDetailsModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.LogDetailsModal })));
const SessionTimeoutModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.SessionTimeoutModal })));
const ConfirmationModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.ConfirmationModal })));
const CreateExpenseModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.CreateExpenseModal })));
const CalculatorModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.CalculatorModal })));
const AlertModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.AlertModal })));
const MarkPaidModal = React.lazy(() => import('./components/modals').then(m => ({ default: m.MarkPaidModal })));
import { NavItem, MobileNavItem, GlassCard, ActionCard } from './components/common';
import LoginPage from './components/LoginPage';
import { isSupabaseEnabled } from './lib/supabase';
import { upsertRow, deleteById, syncLocalToSupabase, createClientNormalized, createProductNormalized, createOrderNormalized, createExpenseNormalized, createLogNormalized } from './lib/db';
import { loadInitialData } from './lib/data-source';

// FIX: Alias motion.div to a constant to help TypeScript correctly resolve the component's type.
const MotionDiv = motion.div;

const SortableHeader: React.FC<{
  title: string;
  columnKey: string;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  onSort: (key: string) => void;
  className?: string;
  hideActiveIcon?: boolean;
}> = ({ title, columnKey, sortConfig, onSort, className, hideActiveIcon }) => {
  const isSorted = sortConfig.key === columnKey;
  const showActiveIcon = isSorted && !hideActiveIcon;
  const directionIcon = showActiveIcon
    ? (sortConfig.direction === 'asc'
        ? <ArrowUp size={14} className="ml-1 flex-shrink-0" />
        : <ArrowDown size={14} className="ml-1 flex-shrink-0" />)
    : <ArrowUpDown size={14} className="ml-1 text-transparent group-hover:text-muted flex-shrink-0" />;

  return (
    <button onClick={() => onSort(columnKey)} className={`flex items-center group w-full text-left ${className || ''}`}>
      <span>{title}</span> {directionIcon}
    </button>
  );
};


const DashboardPage: React.FC<{
  onNewOrder: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onViewClientOrders: (client: Client) => void;
  onEditOrder: (order: Order) => void;
  onEditProduct: (product: Product) => void;
  clients: Client[];
  orders: Order[];
  products: Product[];
  isPrivateMode: boolean;
  currentUser: string;
  dashboardStats: DashboardStat[];
  onQuickAddExpense: (e: Omit<Expense, 'id' | 'displayId' | 'sortIndex'>) => void;
}> = ({ onNewOrder, searchQuery, setSearchQuery, onViewClientOrders, onEditOrder, onEditProduct, clients, orders, products, isPrivateMode, currentUser, dashboardStats, onQuickAddExpense }) => {
    
    const [currentStatIndex, setCurrentStatIndex] = useState(0);

    useEffect(() => {
        if (!dashboardStats || dashboardStats.length === 0) return;

        const timer = setTimeout(() => {
            setCurrentStatIndex((prevIndex) => (prevIndex + 1) % dashboardStats.length);
        }, 5000); // Change stat every 5 seconds

        return () => clearTimeout(timer);
    }, [currentStatIndex, dashboardStats]);

    const currentStat = dashboardStats[currentStatIndex] || { label: 'Loading...', value: '' };
    const clientShortNames = useMemo(() => buildClientShortNameMap(clients), [clients]);

    const trimmedQuery = searchQuery.trim();

    const searchResults = useMemo(() => {
        if (!trimmedQuery) return null;

        const lowerQuery = trimmedQuery.toLowerCase();
        const compactQuery = lowerQuery.replace(/\s+/g, '');
        const digitQuery = lowerQuery.replace(/[^0-9]/g, '');

        const sortInactiveLast = <T extends Record<string, any>>(items: T[], isInactive: (item: T) => boolean) => {
            const sorted = [...items];
            sorted.sort((a, b) => {
                const aInactive = isInactive(a);
                const bInactive = isInactive(b);
                if (aInactive === bInactive) return 0;
                return aInactive ? 1 : -1;
            });
            return sorted;
        };

        const foundClients = sortInactiveLast(
            clients.filter(c => {
                const shortName = clientShortNames[c.id];
                const displayLabel = formatEntityDisplayId('client', c.displayId);
                const displayLower = displayLabel.toLowerCase();
                const displayCompact = displayLower.replace(/\s+/g, '');
                const displayDigits = c.displayId != null ? String(c.displayId).padStart(3, '0') : '';
                return c.name.toLowerCase().includes(lowerQuery)
                    || (shortName ? shortName.toLowerCase().includes(lowerQuery) : false)
                    || (displayLabel ? (displayLower.includes(lowerQuery) || displayCompact.includes(compactQuery)) : false)
                    || (digitQuery ? displayDigits.includes(digitQuery) : false);
            }),
            c => Boolean(c.inactive)
        );
        const foundOrders = orders.filter(o => {
            const client = clients.find(c => c.id === o.clientId);
            const clientName = (client?.name || '').toLowerCase();
            const shortName = client ? clientShortNames[client.id] : undefined;
            return o.id.toLowerCase().includes(lowerQuery)
                || clientName.includes(lowerQuery)
                || (shortName ? shortName.toLowerCase().includes(lowerQuery) : false)
                || (() => {
                    const displayLabel = formatEntityDisplayId('order', o.displayId);
                    if (!displayLabel) return false;
                    const displayLower = displayLabel.toLowerCase();
                    const displayCompact = displayLower.replace(/\s+/g, '');
                    if (displayLower.includes(lowerQuery) || displayCompact.includes(compactQuery)) {
                        return true;
                    }
                    const displayDigits = o.displayId != null ? String(o.displayId).padStart(4, '0') : '';
                    return digitQuery ? displayDigits.includes(digitQuery) : false;
                })();
        });
        const foundProducts = sortInactiveLast(
            products.filter(p => {
                const displayLabel = formatEntityDisplayId('product', p.displayId);
                const displayLower = displayLabel.toLowerCase();
                const displayCompact = displayLower.replace(/\s+/g, '');
                const displayDigits = p.displayId != null ? String(p.displayId).padStart(2, '0') : '';
                return p.name.toLowerCase().includes(lowerQuery)
                    || p.type.toLowerCase().includes(lowerQuery)
                    || (displayLabel ? (displayLower.includes(lowerQuery) || displayCompact.includes(compactQuery)) : false)
                    || (digitQuery ? displayDigits.includes(digitQuery) : false);
            }),
            p => Boolean(p.inactive) || p.stock <= 0
        );

        return { clients: foundClients, orders: foundOrders, products: foundProducts };
    }, [trimmedQuery, clients, orders, products, clientShortNames]);

    const isSearching = Boolean(searchResults);
    const formatMatchCount = (count: number) => (count === 1 ? '1 match' : `${count} matches`);

    const todayStr = new Date().toISOString().split('T')[0];
    const todaysOrders = useMemo(() => orders.filter(o => o.date === todayStr), [orders, todayStr]);
    const paidToday = useMemo(() => todaysOrders.reduce((s, o) => s + (o.amountPaid || 0), 0), [todaysOrders]);
    const paidCash = useMemo(() => todaysOrders.reduce((s, o) => {
        const pm: any = o.paymentMethods || {};
        const cash = typeof pm.cash === 'number' ? pm.cash : (pm.cash ? (o.amountPaid || 0) : 0);
        return s + (cash || 0);
    }, 0), [todaysOrders]);
    const paidEtransfer = useMemo(() => todaysOrders.reduce((s, o) => {
        const pm: any = o.paymentMethods || {};
        const et = typeof pm.etransfer === 'number' ? pm.etransfer : (pm.etransfer ? (o.amountPaid || 0) : 0);
        return s + (et || 0);
    }, 0), [todaysOrders]);

    // Quick expense form moved to header on homepage

    return (
      <div className="space-y-8">
        <AnimatePresence mode="wait" initial={false}>
            {!isSearching && (
                <MotionDiv
                    key="welcome"
                    className="space-y-8"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.25 }}
                >
                    <div className="text-center max-w-2xl mx-auto pt-2 md:pt-4">
                        <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">Welcome, {currentUser}</h1>
                        <div className="h-36 flex flex-col justify-center">
                            <AnimatePresence mode="wait">
                                <MotionDiv
                                    key={currentStatIndex}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.5 }}
                                    className="flex flex-col items-center justify-center"
                                >
                                    <p className="text-muted text-lg">{currentStat.label}</p>
                                    <h2 className="text-4xl md:text-5xl font-bold text-primary tracking-tight mt-1">
                                        {currentStat.value}
                                    </h2>
                                    {currentStat.subtext && <p className="text-muted text-sm mt-2">{currentStat.subtext}</p>}
                                </MotionDiv>
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
                        <GlassCard>
                            <div>
                                <div className="text-sm text-muted">Total Earned (Today)</div>
                                <div className="text-3xl font-bold text-primary mt-1">${Math.round(paidToday).toLocaleString()}</div>
                            </div>
                        </GlassCard>
                        <GlassCard>
                            <div>
                                <div className="text-sm text-muted">Paid in Cash</div>
                                <div className="text-3xl font-bold text-primary mt-1">${Math.round(paidCash).toLocaleString()}</div>
                            </div>
                        </GlassCard>
                        <GlassCard>
                            <div>
                                <div className="text-sm text-muted">Paid in E-transfer</div>
                                <div className="text-3xl font-bold text-primary mt-1">${Math.round(paidEtransfer).toLocaleString()}</div>
                            </div>
                        </GlassCard>
                    </div>
                </MotionDiv>
            )}
            {isSearching && searchResults && (
                <MotionDiv
                    key="search"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.25 }}
                >
                    <GlassCard>
                        <div className="space-y-5">
                                {searchResults.clients.length > 0 && (
                                    <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                                        <header className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <Users size={16} className="text-indigo-300" />
                                                <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Clients</h3>
                                            </div>
                                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-200">
                                                {formatMatchCount(searchResults.clients.length)}
                                            </span>
                                        </header>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {searchResults.clients.map(c => {
                                                const inactive = Boolean(c.inactive);
                                                const displayIdLabel = formatEntityDisplayId('client', c.displayId, c.id);
                                                const primaryLabel = isPrivateMode ? displayIdLabel : (clientShortNames[c.id] ?? c.name);
                                                const secondaryLabel = isPrivateMode ? c.name : displayIdLabel || c.id;
                                                return (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => onViewClientOrders(c)}
                                                        className={`group flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/5 p-3 text-left transition-colors hover:border-indigo-400/40 hover:bg-indigo-500/10 ${inactive ? 'opacity-60' : ''}`}
                                                    >
                                                        <div className="space-y-1">
                                                            <div className={`text-sm font-semibold ${inactive ? 'text-muted' : 'text-primary'}`}>{primaryLabel}</div>
                                                            <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1">
                                                                <span>{secondaryLabel}</span>
                                                                <span>{c.orders} orders</span>
                                                                <span>${Math.round(c.totalSpent).toLocaleString()} spent</span>
                                                            </div>
                                                        </div>
                                                        <ArrowUpRight size={14} className="mt-1 flex-shrink-0 text-muted group-hover:text-indigo-200" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {searchResults.orders.length > 0 && (
                                    <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                                        <header className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <ReceiptText size={16} className="text-emerald-300" />
                                                <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Orders</h3>
                                            </div>
                                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-200">
                                                {formatMatchCount(searchResults.orders.length)}
                                            </span>
                                        </header>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {searchResults.orders.map(o => {
                                                const client = clients.find(c => c.id === o.clientId);
                                                const orderLabel = formatEntityDisplayId('order', o.displayId, o.id);
                                                const clientLabel = isPrivateMode
                                                    ? formatEntityDisplayId('client', client?.displayId, client?.id || 'Unknown Client')
                                                    : (client ? (clientShortNames[client.id] ?? client.name) : 'Unknown Client');
                                                const total = Math.round(o.total).toLocaleString();
                                                const paid = Math.round(o.amountPaid || 0);
                                                const balance = Math.max(0, Math.round(o.total - (o.amountPaid || 0)));
                                                return (
                                                    <button
                                                        key={o.id}
                                                        onClick={() => onEditOrder(o)}
                                                        className="group flex flex-col gap-2 rounded-lg border border-white/5 bg-white/5 p-3 text-left transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10"
                                                    >
                                                        <div className="flex items-center justify-between text-sm font-semibold text-primary">
                                                            <span>{orderLabel}</span>
                                                            <span>${total}</span>
                                                        </div>
                                                        <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1">
                                                            <span>{clientLabel}</span>
                                                            <span>{o.date}</span>
                                                            {paid > 0 && <span>${paid.toLocaleString()} paid</span>}
                                                            {balance > 0 && <span className="text-amber-300">${balance.toLocaleString()} due</span>}
                                                        </div>
                                                        <span className="text-[11px] uppercase tracking-wide text-muted group-hover:text-emerald-200">Tap to open</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {searchResults.products.length > 0 && (
                                    <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                                        <header className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <Package size={16} className="text-purple-300" />
                                                <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Products</h3>
                                            </div>
                                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-500/10 text-purple-200">
                                                {formatMatchCount(searchResults.products.length)}
                                            </span>
                                        </header>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {searchResults.products.map(p => {
                                                const inactive = Boolean(p.inactive) || p.stock <= 0;
                                                const stockLabel = `${Math.floor(p.stock)}${p.type !== 'unit' ? ` ${p.type}` : ''}`;
                                                const productLabel = formatEntityDisplayId('product', p.displayId, p.id);
                                                return (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => onEditProduct(p)}
                                                        className={`group flex flex-col gap-2 rounded-lg border border-white/5 bg-white/5 p-3 text-left transition-colors hover:border-purple-400/40 hover:bg-purple-500/10 ${inactive ? 'opacity-60' : ''}`}
                                                    >
                                                        <div className={`text-sm font-semibold ${inactive ? 'text-muted' : 'text-primary'}`}>
                                                            {isPrivateMode ? productLabel : p.name}
                                                        </div>
                                                        <div className="text-xs text-muted flex items-center gap-2">
                                                            <span>{stockLabel} in stock</span>
                                                            {p.inactive && <span>• Inactive</span>}
                                                        </div>
                                                        <span className="text-[11px] uppercase tracking-wide text-muted group-hover:text-purple-200">Tap to edit</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {searchResults.clients.length === 0 && searchResults.orders.length === 0 && searchResults.products.length === 0 && (
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-muted">
                                        No results found.
                                    </div>
                                )}
                            </div>
                    </GlassCard>
                </MotionDiv>
            )}
        </AnimatePresence>
      </div>
    );
};


const OrdersPage: React.FC<{ orders: Order[]; clients: Client[]; products: Product[]; searchQuery: string; onOrderClick: (order: Order) => void; onMarkAsPaid: (orderId: string) => void; isPrivateMode: boolean; }> = ({ orders, clients, products, searchQuery, onOrderClick, onMarkAsPaid, isPrivateMode }) => {
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [tooltipPlacement, setTooltipPlacement] = useState<Record<string, 'above' | 'below'>>({});
    const [tooltipMaxHeight, setTooltipMaxHeight] = useState<Record<string, number>>({});

    const clientShortNames = useMemo(() => buildClientShortNameMap(clients), [clients]);


    const sortedAndFilteredOrders = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase();
        let sortableItems = orders.filter(order => {
            const client = clients.find(c => c.id === order.clientId);
            const clientName = (client?.name || '').toLowerCase();
            const shortName = client ? clientShortNames[client.id] : undefined;
            const matchesClient = clientName.includes(lowerQuery) || (shortName ? shortName.toLowerCase().includes(lowerQuery) : false);
            return order.id.toLowerCase().includes(lowerQuery) || matchesClient;
        });

        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                const getStatus = (order: Order) => ((order.total - (order.amountPaid || 0)) <= 0) ? 'Completed' : order.status;

                switch (sortConfig.key) {
                    case 'client': {
                        const aClient = clients.find(c => c.id === a.clientId);
                        const bClient = clients.find(c => c.id === b.clientId);
                        const aName = aClient ? (clientShortNames[aClient.id] ?? aClient.name ?? '') : '';
                        const bName = bClient ? (clientShortNames[bClient.id] ?? bClient.name ?? '') : '';
                        aValue = aName.toLowerCase();
                        bValue = bName.toLowerCase();
                        break;
                    }
                    case 'total':
                        aValue = a.total;
                        bValue = b.total;
                        break;
                    case 'status':
                        aValue = getStatus(a);
                        bValue = getStatus(b);
                        break;
                    case 'date':
                        aValue = new Date(a.date).getTime();
                        bValue = new Date(b.date).getTime();
                        break;
                    default:
                        aValue = a[sortConfig.key as keyof Order];
                        bValue = b[sortConfig.key as keyof Order];
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return sortableItems;

    }, [orders, clients, searchQuery, sortConfig, clientShortNames]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getOrderStatusPresentation = (order: Order) => {
        const paidAmount = order.amountPaid || 0;
        const balance = order.total - paidAmount;
        const outstanding = Math.max(0, Math.round(balance));

        if (balance <= 0) {
            return {
                className: 'status-paid',
                label: 'Paid',
                isCompleted: true,
                tooltip: 'Order is fully paid',
            } as const;
        }

        if (paidAmount > 0) {
            return {
                className: 'status-unpaid-partial',
                label: 'Unpaid',
                isCompleted: false,
                tooltip: outstanding > 0 ? `$${outstanding.toLocaleString()} remaining` : 'Balance outstanding',
            } as const;
        }

        return {
            className: 'status-unpaid-none',
            label: 'Unpaid',
            isCompleted: false,
            tooltip: 'No payment received yet',
        } as const;
    };

    const handleRowHover = useCallback((orderId: string, e: React.MouseEvent<HTMLTableRowElement>) => {
        const rect = (e.currentTarget as HTMLTableRowElement).getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const preferredHeight = 240; // matches max-h-60
        const margin = 8;
        const placement: 'above' | 'below' = spaceAbove > spaceBelow ? 'above' : 'below';
        const available = placement === 'above' ? spaceAbove - margin : spaceBelow - margin;
        const maxHeight = Math.max(80, Math.min(preferredHeight, available));
        setTooltipPlacement(prev => (prev[orderId] === placement ? prev : { ...prev, [orderId]: placement }));
        setTooltipMaxHeight(prev => (prev[orderId] === maxHeight ? prev : { ...prev, [orderId]: maxHeight }));
    }, []);


    return (
        <GlassCard>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                    <tr className="text-sm text-muted border-b border-white/10">
                        <th className="p-3"><SortableHeader title="Order" columnKey="displayId" sortConfig={sortConfig} onSort={handleSort} /></th>
                        <th className="p-3"><SortableHeader title="Client" columnKey="client" sortConfig={sortConfig} onSort={handleSort} /></th>
                        <th className="p-3"></th>
                        <th className="p-3"><SortableHeader title="Amount" columnKey="total" sortConfig={sortConfig} onSort={handleSort} /></th>
                        <th className="p-3"><SortableHeader title="Status" columnKey="status" sortConfig={sortConfig} onSort={handleSort} /></th>
                    </tr>
                    </thead>
                    <tbody>
                    {sortedAndFilteredOrders.map(o => {
                        const statusPresentation = getOrderStatusPresentation(o);
                        const isCompleted = statusPresentation.isCompleted;
                        const client = clients.find(c => c.id === o.clientId);
                        const clientLabel = client
                            ? (isPrivateMode
                                ? formatEntityDisplayId('client', client.displayId, client.id)
                                : (clientShortNames[client.id] ?? client.name))
                            : 'Unknown Client';
                        const orderLabel = formatEntityDisplayId('order', o.displayId, o.id);
                        return (
                            <tr key={o.id} onClick={() => onOrderClick(o)} onMouseEnter={(e) => handleRowHover(o.id, e)} className="group border-b border-white/5 text-base hover:bg-white/5 cursor-pointer transition-colors">
                                <td className="p-3 font-mono text-primary">{orderLabel}</td>
                                <td className="p-3 text-primary">{clientLabel}</td>
                                <td className="p-3 text-muted relative">
                                    <div className={`absolute z-20 left-0 ${tooltipPlacement[o.id] === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'} w-64 overflow-auto rounded-md border border-white/10 bg-[rgba(22,22,29,0.85)] backdrop-blur px-3 py-2 text-xs text-primary opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 shadow-xl`} style={{ maxHeight: `${tooltipMaxHeight[o.id] ?? 240}px` }}>
                                        {groupOrderItems(o.items, products).map(group => {
                                            const product = products.find(p => p.id === group.productId);
                                            const label = (isPrivateMode ? formatEntityDisplayId('product', product?.displayId, product?.id || 'Unknown') : product?.name) || 'Unknown';
                                            const multiplier = group.count > 1 ? ` x${group.count}` : '';
                                            return <div key={`${group.productId}|${group.sizeKey}`} className="py-0.5">{label} - {group.displayQty}{multiplier}</div>;
                                        })}
                                    </div>
                                </td>
                                <td className="p-3 font-semibold text-primary">
                                    ${Math.round(o.total).toLocaleString()}
                                </td>
                                <td className="p-3">
                                    <button
                                        type="button"
                                        className={`status-badge ${statusPresentation.className} ${isCompleted ? 'cursor-default opacity-80' : 'cursor-pointer transition-colors hover:ring-2 hover:ring-cyan-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80'} disabled:pointer-events-none`}
                                        onClick={(e) => {
                                            if (isCompleted) return;
                                            e.stopPropagation();
                                            onMarkAsPaid(o.id);
                                        }}
                                        disabled={isCompleted}
                                        aria-label={isCompleted ? 'Order is paid' : 'Mark as paid'}
                                        title={statusPresentation.tooltip}
                                    >
                                        {statusPresentation.label}
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
};

const ClientsPage: React.FC<{ 
    clients: (Client & { orders: number; totalSpent: number; balance: number; totalDiscounts: number; })[];
    searchQuery: string; 
    onViewOrders: (client: Client) => void;
    isPrivateMode: boolean;
}> = ({ clients, searchQuery, onViewOrders, isPrivateMode }) => {
    
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'balance', direction: 'desc' });
    const [hasSortInteraction, setHasSortInteraction] = useState(false);
    const clientShortNames = useMemo(() => buildClientShortNameMap(clients), [clients]);
    
    const sortedAndFilteredClients = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase();
        const compactQuery = lowerQuery.replace(/\s+/g, '');
        const digitQuery = lowerQuery.replace(/[^0-9]/g, '');
        let sortableItems = clients.filter(client => {
            const shortName = clientShortNames[client.id];
            const nameMatch = client.name.toLowerCase().includes(lowerQuery) ||
                (shortName ? shortName.toLowerCase().includes(lowerQuery) : false);
            const emailMatch = (client.email || '').toLowerCase().includes(lowerQuery);
            const displayLabel = formatEntityDisplayId('client', client.displayId, client.id);
            const labelMatch = displayLabel
                ? (displayLabel.toLowerCase().includes(lowerQuery)
                    || displayLabel.toLowerCase().replace(/\s+/g, '').includes(compactQuery))
                : false;
            const digits = client.displayId != null ? String(client.displayId).padStart(3, '0') : '';
            const digitsMatch = digitQuery ? digits.includes(digitQuery) : false;
            return nameMatch || emailMatch || labelMatch || digitsMatch;
        });

        sortableItems.sort((a, b) => {
            const aInactive = Boolean(a.inactive);
            const bInactive = Boolean(b.inactive);
            if (aInactive !== bInactive) {
                return aInactive ? 1 : -1;
            }

            if (sortConfig.key === 'name') {
                const aLabel = isPrivateMode ? formatEntityDisplayId('client', a.displayId, a.id) : (clientShortNames[a.id] ?? a.name);
                const bLabel = isPrivateMode ? formatEntityDisplayId('client', b.displayId, b.id) : (clientShortNames[b.id] ?? b.name);
                const comparison = aLabel.localeCompare(bLabel);
                return sortConfig.direction === 'desc' ? -comparison : comparison;
            }

            const aValue = a[sortConfig.key as keyof typeof a];
            const bValue = b[sortConfig.key as keyof typeof b];
            
            let comparison = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            }

            if (sortConfig.direction === 'desc') {
                comparison *= -1;
            }

            // If primary sort is equal, apply secondary sort
            if (comparison === 0 && sortConfig.key !== 'orders') {
                return b.orders - a.orders;
            }

            return comparison;
        });

        return sortableItems;
    }, [clients, searchQuery, sortConfig, clientShortNames, isPrivateMode]);

    const handleSort = (key: string) => {
        setHasSortInteraction(true);
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };


    const getBalanceClass = (balance: number) => {
        if (balance > 1000) return 'text-red-400 font-semibold';
        if (balance > 200) return 'text-orange-400 font-semibold';
        if (balance > 0) return 'text-yellow-400 font-semibold';
        return 'text-emerald-400';
    };

    const totals = useMemo(() => {
        return sortedAndFilteredClients.reduce((acc, client) => {
            acc.orders += client.orders;
            acc.spent += client.totalSpent;
            acc.discounts += client.totalDiscounts;
            acc.balance += client.balance;
            return acc;
        }, { orders: 0, spent: 0, discounts: 0, balance: 0 });
    }, [sortedAndFilteredClients]);
    
    return (
        <GlassCard>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-sm text-muted border-b border-white/10">
                            <th className="p-3"><SortableHeader title="Client" columnKey="name" sortConfig={sortConfig} onSort={handleSort} /></th>
                            <th className="p-3"><SortableHeader title="Orders" columnKey="orders" sortConfig={sortConfig} onSort={handleSort} /></th>
                            <th className="p-3"><SortableHeader title="Spent" columnKey="totalSpent" sortConfig={sortConfig} onSort={handleSort} /></th>
                            <th className="p-3"><SortableHeader title="Balance" columnKey="balance" sortConfig={sortConfig} onSort={handleSort} hideActiveIcon={!hasSortInteraction} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAndFilteredClients.map(c => {
                            const inactive = Boolean(c.inactive);
                            const rowClasses = `border-b border-white/5 text-base hover:bg-white/5 cursor-pointer transition-colors ${inactive ? 'opacity-60' : ''}`;
                            const displayName = isPrivateMode ? formatEntityDisplayId('client', c.displayId, c.id) : (clientShortNames[c.id] ?? c.name);
                            const balanceClass = inactive ? 'text-muted' : getBalanceClass(c.balance);
                            const roundedBalance = Math.round(c.balance);
                            const formattedBalance = roundedBalance < 0
                                ? `-$${Math.abs(roundedBalance).toLocaleString()}`
                                : `$${roundedBalance.toLocaleString()}`;
                            const amountTextClass = inactive ? 'text-muted' : 'text-primary';

                            return (
                                <tr key={c.id} onClick={() => onViewOrders(c)} className={rowClasses}>
                                    <td className="p-3">
                                        <div className={`font-semibold ${inactive ? 'text-muted' : 'text-primary'}`}>{displayName}</div>
                                    </td>
                                    <td className={`p-3 ${inactive ? 'text-muted' : 'text-primary'}`}>{c.orders}</td>
                                    <td className={`p-3 font-medium ${inactive ? 'text-muted' : 'text-primary'}`}>${Math.round(c.totalSpent).toLocaleString()}</td>
                                    <td className="p-3">
                                        {roundedBalance === 0 ? null : (
                                            <span className={`font-medium ${balanceClass}`}>
                                                {formattedBalance}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-white/10 font-bold text-base bg-white/5 text-primary">
                            <td className="p-3">Totals ({sortedAndFilteredClients.length} clients)</td>
                            <td className="p-3">{totals.orders}</td>
                            <td className="p-3">${Math.round(totals.spent).toLocaleString()}</td>
                            <td className="p-3">${Math.round(totals.balance).toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </GlassCard>
    );
};

const ProductsPage: React.FC<{ 
    products: Product[]; 
    searchQuery: string; 
    onProductClick: (product: Product) => void; 
    onUpdateStock: (product: Product) => void;
    isPrivateMode: boolean;
}> = ({ products, searchQuery, onProductClick, onUpdateStock, isPrivateMode }) => {
    const [productSort, setProductSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const getSizeDisplay = (product: Product) => {
        switch (product.type) {
            case 'g':
                return 'Gram (g)';
            case 'ml':
                return 'Milliliter (mL)';
            case 'unit':
                return 'Unit';
            default:
                return (product.type as string).toUpperCase();
        }
    };
    const sortedAndFilteredProducts = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase();
        const base = products.filter(product =>
            product.name.toLowerCase().includes(lowerQuery) ||
            product.type.toLowerCase().includes(lowerQuery)
        );
        const isInactive = (product: Product) => Boolean(product.inactive) || product.stock <= 0;
        const list = base.slice();
        list.sort((a, b) => {
            const aInactive = isInactive(a);
            const bInactive = isInactive(b);
            if (aInactive !== bInactive) {
                return aInactive ? 1 : -1;
            }

            let aValue: any; let bValue: any;
            switch (productSort.key) {
                case 'stock':
                    aValue = a.stock; bValue = b.stock; break;
                case 'displayId':
                    aValue = a.displayId ?? 0; bValue = b.displayId ?? 0; break;
                case 'size':
                    aValue = getSizeDisplay(a).toLowerCase();
                    bValue = getSizeDisplay(b).toLowerCase();
                    break;
                case 'name':
                default:
                    aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase();
            }
            if (aValue < bValue) return productSort.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return productSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [products, searchQuery, productSort]);

    const handleProductSort = (key: string) => {
        setProductSort(prev => prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
    };

    return (
        <GlassCard>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                    <tr className="text-sm text-muted border-b border-white/10">
                        <th className="p-3"><SortableHeader title="Product" columnKey="name" sortConfig={productSort} onSort={handleProductSort} /></th>
                        <th className="p-3"><SortableHeader title="Size" columnKey="size" sortConfig={productSort} onSort={handleProductSort} /></th>
                        <th className="p-3"><SortableHeader title="Stock" columnKey="stock" sortConfig={productSort} onSort={handleProductSort} /></th>
                    </tr>
                    </thead>
                    <tbody>
                    {sortedAndFilteredProducts.map(p => {
                        const inactive = Boolean(p.inactive) || p.stock <= 0;
                        const rowClasses = `border-b border-white/5 text-base hover:bg-white/5 cursor-pointer transition-colors ${inactive ? 'opacity-60' : ''}`;
                        const productLabel = formatEntityDisplayId('product', p.displayId, p.id);
                        const nameDisplay = isPrivateMode ? productLabel : p.name;
                        const sizeDisplay = getSizeDisplay(p);

                        return (
                            <tr key={p.id} onClick={() => onProductClick(p)} className={rowClasses}>
                                <td className={`p-3 font-semibold ${inactive ? 'text-muted' : 'text-primary'}`}>{nameDisplay}</td>
                                <td className="p-3 text-muted">{sizeDisplay}</td>
                                <td className="p-3">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onUpdateStock(p); }}
                                    title="Click to edit stock"
                                    className={`inline-block rounded px-2 py-1 font-medium ${inactive ? 'text-muted' : 'text-primary'} hover:bg-white/10 hover:text-primary transition-colors cursor-pointer`}
                                    aria-label={`Edit stock for ${nameDisplay}`}
                                  >
                                    {Math.floor(p.stock)}{p.type !== 'unit' ? ` ${p.type}` : ''}
                                  </button>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
};

const TransactionsPage: React.FC<{
    orders: Order[];
    expenses: Expense[];
    clients: Client[];
    searchQuery: string;
    isPrivateMode: boolean;
    onEditExpense: (expense: Expense) => void;
    onEditOrder: (order: Order) => void;
}> = ({ orders, expenses, clients, searchQuery, isPrivateMode, onEditExpense, onEditOrder }) => {
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const clientShortNames = useMemo(() => buildClientShortNameMap(clients), [clients]);

    const transactions = useMemo(() => {
        const incomeTransactions = orders.map(order => {
            const client = clients.find(c => c.id === order.clientId);
            const orderLabel = formatEntityDisplayId('order', order.displayId);
            const clientDisplay = isPrivateMode 
                ? (client ? formatEntityDisplayId('client', client.displayId, client.id) : 'Unknown Client') 
                : (client ? (clientShortNames[client.id] ?? client.name) : 'Unknown Client');
            const orderDisplay = orderLabel || `Order ${order.id}`;
            return {
                id: `order-${order.id}`,
                date: order.date,
                type: 'Income',
                description: `${orderDisplay} for ${clientDisplay}`,
                amount: order.total,
                original: order,
            };
        });

        const expenseTransactions = expenses.map(expense => ({
            id: `expense-${expense.id}`,
            date: expense.date,
            type: 'Expense',
            description: expense.description,
            amount: -expense.amount,
            original: expense,
        }));
        
        return [...incomeTransactions, ...expenseTransactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders, expenses, clients, isPrivateMode, clientShortNames]);
    
    const filteredTransactions = useMemo(() => {
        const isExpense = (x: Order | Expense): x is Expense => 'category' in x;
        return transactions.filter(t => {
            const lowerQuery = searchQuery.toLowerCase();
            const searchMatch = t.description.toLowerCase().includes(lowerQuery) || (
                isExpense(t.original) &&
                (t.original.category?.toLowerCase().includes(lowerQuery) ?? false)
            );

            if (!searchMatch) return false;

            const transactionDate = new Date(t.date);
            if (dateFrom && transactionDate < new Date(dateFrom)) return false;
            if (dateTo && transactionDate > new Date(dateTo)) return false;
            
            return true;
        });
    }, [transactions, searchQuery, dateFrom, dateTo]);

    const sortedTransactions = useMemo(() => {
        const list = filteredTransactions.slice();
        list.sort((a, b) => {
            let aValue: any; let bValue: any;
            switch (sortConfig.key) {
                case 'id': aValue = a.id; bValue = b.id; break;
                case 'description': aValue = a.description.toLowerCase(); bValue = b.description.toLowerCase(); break;
                case 'type': aValue = a.type; bValue = b.type; break;
                case 'amount': aValue = a.amount; bValue = b.amount; break;
                case 'date': default:
                    aValue = new Date(a.date).getTime(); bValue = new Date(b.date).getTime();
            }
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [filteredTransactions, sortConfig]);

    const totalIncome = useMemo(() => sortedTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0), [sortedTransactions]);
    const totalExpenses = useMemo(() => sortedTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0), [sortedTransactions]);
    const netTotal = totalIncome + totalExpenses;
    const handleSort = (key: string) => {
        setSortConfig(prev => prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
    };
    
    return (
        <GlassCard>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                 <div className="flex flex-wrap items-center gap-2">
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-primary" />
                    <span className="text-muted text-xs">to</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-primary" />
                    <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-muted hover:text-primary">Clear</button>
                </div>
            </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-xs text-muted border-b border-white/10">
                            <th className="p-3"><SortableHeader title="Date" columnKey="date" sortConfig={sortConfig} onSort={handleSort} /></th>
                            <th className="p-3"><SortableHeader title="ID" columnKey="id" sortConfig={sortConfig} onSort={handleSort} /></th>
                            <th className="p-3"><SortableHeader title="Name" columnKey="description" sortConfig={sortConfig} onSort={handleSort} /></th>
                            <th className="p-3"><SortableHeader title="Type" columnKey="type" sortConfig={sortConfig} onSort={handleSort} /></th>
                            <th className="p-3 text-right"><SortableHeader title="Amount" columnKey="amount" sortConfig={sortConfig} onSort={handleSort} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTransactions.map(t => {
                            const isExpenseRow = (t.original as any) && 'category' in (t.original as any);
                            let idLabel = '';
                            let nameLabel = '';
                            if (isExpenseRow) {
                                const exp = t.original as Expense;
                                const expenseLabel = formatEntityDisplayId('expense', exp.displayId);
                                idLabel = expenseLabel || `Expense ${exp.id}`;
                                nameLabel = exp.description;
                            } else {
                                const ord = t.original as Order;
                                const orderLabel = formatEntityDisplayId('order', ord.displayId);
                                idLabel = orderLabel || `Order ${ord.id}`;
                                const client = clients.find(c => c.id === ord.clientId);
                                nameLabel = isPrivateMode
                                    ? (client ? formatEntityDisplayId('client', client.displayId, client.id) : 'Unknown Client')
                                    : (client ? (clientShortNames[client.id] ?? client.name) : 'Unknown Client');
                            }
                            return (
                                <tr
                                  key={t.id}
                                  className="border-b border-white/5 text-sm hover:bg-white/5 cursor-pointer transition-colors"
                                  onClick={() => {
                                      if (t.type === 'Expense') {
                                          onEditExpense(t.original as Expense);
                                      } else if (t.type === 'Income') {
                                          onEditOrder(t.original as Order);
                                      }
                                  }}
                                >
                                    <td className="p-3 text-muted">{t.date}</td>
                                    <td className="p-3 text-muted">{idLabel}</td>
                                    <td className="p-3 text-primary">{nameLabel}</td>
                                    <td className="p-3">
                                        <span className={`status-badge ${t.type === 'Income' ? 'status-completed' : 'status-unpaid-zero'}`}>{t.type}</span>
                                    </td>
                                    <td className={`p-3 text-right font-medium ${t.amount > 0 ? 'text-cyan-400' : 'text-purple-400'}`}>
                                        {t.amount > 0 ? `+$${Math.round(t.amount).toLocaleString()}` : `-$${Math.abs(Math.round(t.amount)).toLocaleString()}`}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold border-t-2 border-white/10">
                            <td className="p-3 text-primary" colSpan={4}>Total Income</td>
                            <td className="p-3 text-right text-cyan-400">${Math.round(totalIncome).toLocaleString()}</td>
                        </tr>
                        <tr className="font-bold">
                            <td className="p-3 text-primary" colSpan={4}>Total Expenses</td>
                            <td className="p-3 text-right text-purple-400">-${Math.abs(Math.round(totalExpenses)).toLocaleString()}</td>
                        </tr>
                         <tr className="font-bold text-lg border-t border-white/10 bg-white/5">
                            <td className="p-3 text-primary" colSpan={4}>Net Total</td>
                            <td className={`p-3 text-right ${netTotal >= 0 ? 'text-primary' : 'text-purple-400'}`}>
                                {netTotal < 0 ? `-$${Math.abs(Math.round(netTotal)).toLocaleString()}` : `$${Math.round(netTotal).toLocaleString()}`}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </GlassCard>
    );
};

const LogPage: React.FC<{ logs: LogEntry[]; onLogClick: (log: LogEntry) => void; }> = ({ logs, onLogClick }) => (
    <GlassCard title="Activity Log">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-xs text-muted border-b border-white/10">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">User</th>
                        <th className="p-3">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map(log => (
                        <tr key={log.id} onClick={() => onLogClick(log)} className="border-b border-white/5 text-sm hover:bg-white/5 cursor-pointer transition-colors">
                            <td className="p-3 text-muted">{new Date(log.timestamp).toLocaleString()}</td>
                            <td className="p-3 text-primary">{log.user}</td>
                            <td className="p-3 text-primary">{log.action}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </GlassCard>
);

const SettingsPage: React.FC<{
    setPage: (page: Page) => void;
    onExport: (type: 'all') => void;
    onImport: (file: File) => void;
    onSyncSupabase: () => void;
    onLogout: () => void;
    onDeleteAllData: () => void;
    dataSource: 'local' | 'demo' | 'supabase' | 'empty';
    supabaseEnabled: boolean;
}> = ({ setPage, onExport, onImport, onSyncSupabase, onLogout, onDeleteAllData, dataSource, supabaseEnabled }) => {
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onImport(file);
            event.target.value = ''; // Reset input to allow re-uploading the same file
        }
    };

    const readableSource = {
        supabase: 'Supabase (live database)',
        demo: 'Bundled demo dataset',
        local: 'Browser storage',
        empty: 'Empty dataset',
    }[dataSource];

    return (
        <div className="space-y-8 mt-6">
            <GlassCard title="Data Source & Sync">
                <div className="space-y-2 text-sm text-muted">
                    <p>
                        Currently reading data from
                        <span className="text-primary font-medium"> {readableSource}</span>.
                    </p>
                    <p>
                        Supabase integration is
                        <span className={`font-medium ${supabaseEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {supabaseEnabled ? ' active' : ' disabled'}
                        </span>
                        .
                    </p>
                    {supabaseEnabled ? (
                        <p>
                            Use "Sync to Supabase" to push any local-only changes or migrate from the demo dataset.
                        </p>
                    ) : (
                        <p>
                            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local` to enable syncing with Supabase.
                        </p>
                    )}
                </div>
            </GlassCard>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ActionCard
                    icon={<ReceiptText size={24} />}
                    title="Transactions"
                    description="View a complete history of all income and expenses."
                    onClick={() => setPage('transactions')}
                />
                <ActionCard
                    icon={<History size={24} />}
                    title="Activity Log"
                    description="Track all actions performed within the dashboard."
                    onClick={() => setPage('log')}
                />
                <ActionCard
                    icon={<AreaChart size={24} />}
                    title="Reports"
                    description="Visual breakdown of sales and expense data."
                    onClick={() => setPage('reports')}
                />
                <ActionCard
                    icon={<Download size={24} />}
                    title="Export Data"
                    description="Download all your data as a single JSON file."
                    onClick={() => onExport('all')}
                />
                <ActionCard
                    icon={<Upload size={24} />}
                    title="Import Data"
                    description="Upload a previously exported JSON file to restore data."
                    onClick={handleImportClick}
                />
                <input type="file" ref={importInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                <ActionCard
                    icon={<Save size={24} />}
                    title="Sync to Supabase"
                    description="Push all current local data to your Supabase tables."
                    onClick={onSyncSupabase}
                />
                <ActionCard
                    icon={<LogOut size={24} />}
                    title="Log Out"
                    description="Sign out of your current session."
                    onClick={onLogout}
                    variant="danger"
                />
            </div>
            
            <div className="mt-12">
                <h2 className="text-lg font-bold text-red-500 mb-2">Danger Zone</h2>
                <div className="glass p-6 border-red-500/30 border">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="font-bold text-primary">Delete All Data</h3>
                            <p className="text-sm text-muted mt-1 max-w-xl">Permanently delete all clients, products, orders, expenses, and activity logs. This action is irreversible and cannot be undone.</p>
                        </div>
                        <button onClick={onDeleteAllData} className="gloss-btn gloss-btn-danger flex-shrink-0">
                            <Trash2 size={16} /> Delete All Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* Moved to components/ReportsPage.tsx and lazy-loaded */
const ReportsPage = React.lazy(() => import('./components/ReportsPage'));
/*
const ReportsPage: React.FC<{
    orders: Order[];
    products: Product[];
    expenses: Expense[];
    clients: Client[];
    isPrivateMode: boolean;
}> = ({ orders, products, expenses, clients, isPrivateMode }) => {
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [profitSortConfig, setProfitSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'netProfit', direction: 'desc' });

    const filteredData = useMemo(() => {
        const filteredOrders = orders.filter(o => {
            if (dateFrom && o.date < dateFrom) return false;
            if (dateTo && o.date > dateTo) return false;
            return true;
        });
        const filteredExpenses = expenses.filter(e => {
            if (dateFrom && e.date < dateFrom) return false;
            if (dateTo && e.date > dateTo) return false;
            return true;
        });
        return { orders: filteredOrders, expenses: filteredExpenses };
    }, [orders, expenses, dateFrom, dateTo]);

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

    const StatCard: React.FC<{ label: string; value: string; colorClass?: string }> = ({ label, value, colorClass = 'text-primary' }) => (
        <div className="glass p-4 rounded-lg">
            <p className="text-sm text-muted">{label}</p>
            <p className={`text-2xl font-bold tracking-tight ${colorClass}`}>{value}</p>
        </div>
    );

    return (
        <div className="space-y-8">
            <GlassCard>
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <h2 className="text-xl font-bold text-primary">Reports</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-primary" />
                        <span className="text-muted text-xs">to</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-primary" />
                        <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-muted hover:text-primary">Clear</button>
                    </div>
                </div>
            </GlassCard>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                <StatCard label="Total Revenue" value={`$${Math.round(reportStats.totalRevenue).toLocaleString()}`} colorClass="text-cyan-400" />
                <StatCard label="Total Profit" value={`$${Math.round(reportStats.totalProfit).toLocaleString()}`} colorClass="text-green-400" />
                <StatCard label="Total Orders" value={reportStats.orderCount.toLocaleString()} />
                <StatCard label="Avg. Order Value" value={`$${Math.round(reportStats.avgOrderValue).toLocaleString()}`} />
                <StatCard label="Total Expenses" value={`$${Math.round(reportStats.totalExpenses).toLocaleString()}`} colorClass="text-orange-400" />
                <StatCard label="Net Income" value={`${reportStats.netIncome < 0 ? '-' : ''}$${Math.round(Math.abs(reportStats.netIncome)).toLocaleString()}`} colorClass={reportStats.netIncome >= 0 ? 'text-green-400' : 'text-purple-400'}/>
            </div>

            <GlassCard title="Product Profitability">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-xs text-muted border-b border-white/10">
                                <th className="p-3"><SortableHeader title="Product" columnKey="name" sortConfig={profitSortConfig} onSort={handleProfitSort} /></th>
                                <th className="p-3"><SortableHeader title="Units Sold" columnKey="unitsSold" sortConfig={profitSortConfig} onSort={handleProfitSort} /></th>
                                <th className="p-3"><SortableHeader title="Total Sales" columnKey="totalSales" sortConfig={profitSortConfig} onSort={handleProfitSort} /></th>
                                <th className="p-3"><SortableHeader title="Total COGS" columnKey="totalCost" sortConfig={profitSortConfig} onSort={handleProfitSort} /></th>
                                <th className="p-3"><SortableHeader title="Net Profit" columnKey="netProfit" sortConfig={profitSortConfig} onSort={handleProfitSort} /></th>
                                <th className="p-3"><SortableHeader title="Margin" columnKey="margin" sortConfig={profitSortConfig} onSort={handleProfitSort} /></th>
                            </tr>
                        </thead>
                        <tbody>
                            {productProfitabilityData.map(p => (
                                <tr key={p.productId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="p-3 font-semibold text-primary">{isPrivateMode ? p.productId : p.name}</td>
                                    <td className="p-3 text-muted">{p.unitsSold % 1 !== 0 ? p.unitsSold.toFixed(2) : p.unitsSold}</td>
                                    <td className="p-3 text-cyan-400">${Math.round(p.totalSales).toLocaleString()}</td>
                                    <td className="p-3 text-orange-400">${Math.round(p.totalCost).toLocaleString()}</td>
                                    <td className={`p-3 font-semibold ${p.netProfit >= 0 ? 'text-green-400' : 'text-purple-400'}`}>${Math.round(p.netProfit).toLocaleString()}</td>
                                    <td className="p-3 text-muted">{p.margin.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <GlassCard title="Top 10 Clients by Sales">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topClientsData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis type="number" stroke="var(--text-muted)" />
                            <YAxis type="category" dataKey="name" width={80} stroke="var(--text-muted)" />
                            <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-muted)' }} contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} />
                            <Bar dataKey="sales" fill="rgba(34, 211, 238, 0.7)" />
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
                            <Line type="monotone" dataKey="value" name="Sales" stroke="rgb(var(--accent))" strokeWidth={2} />
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
    )
}
*/

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useLocalStorage<boolean>('isAuthenticated', false);
  const [currentUser, setCurrentUser] = useLocalStorage<string>('currentUser', '');
  
  const [page, setPage] = useState<Page>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrivateMode, setIsPrivateMode] = useLocalStorage('isPrivateMode', true);
  const [dataSource, setDataSource] = useState<'local' | 'demo' | 'supabase' | 'empty'>(() => (
    localStorage.getItem('clients') ? 'local' : 'demo'
  ));

  // Data state
  const [clients, setClients] = useLocalStorage<Client[]>('clients', initialClients);
  const [products, setProducts] = useLocalStorage<Product[]>('products', initialProducts);
  const [orders, setOrders] = useLocalStorage<Order[]>('orders', initialOrders);
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses', initialExpenses);
  const [logs, setLogs] = useLocalStorage<LogEntry[]>('logs', initialLogs);

  // Load data from Supabase on startup when configured
  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseEnabled) {
      setDataSource(localStorage.getItem('clients') ? 'local' : 'demo');
      return () => { cancelled = true; };
    }

    (async () => {
      const result = await loadInitialData();
      if (cancelled) return;

      if (result.source === 'supabase') {
        const { clients: remoteClients, products: remoteProducts, orders: remoteOrders, expenses: remoteExpenses, logs: remoteLogs } = result.data;
        if (remoteClients.length) setClients(remoteClients);
        if (remoteProducts.length) setProducts(remoteProducts);
        if (remoteOrders.length) setOrders(remoteOrders);
        if (remoteExpenses.length) setExpenses(remoteExpenses);
        if (remoteLogs.length) setLogs(remoteLogs);
        setDataSource('supabase');
      } else if (result.source === 'demo') {
        setDataSource('demo');
      } else {
        setDataSource('empty');
      }
    })();

    return () => { cancelled = true; };
  }, [isSupabaseEnabled]);

  // Backfill missing display IDs for entities that predate the counter system
  const didBackfillRef = useRef({ products: false, orders: false, expenses: false, clients: false });
  useEffect(() => {
    // Ensure we run after data (local or Supabase) is present and only once per type
    if (!didBackfillRef.current.products && products.length) {
      const toPatch = products.filter(p => p.displayId == null);
      if (toPatch.length) {
        const patched = products.map(p => p.displayId == null ? { ...p, displayId: getNextDisplayId('product') } : p);
        setProducts(patched);
        // Mirror to Supabase when configured
        products.forEach((orig, i) => {
          const next = patched[i];
          if (orig.displayId == null && next.displayId != null) void upsertRow('products', next);
        });
      }
      didBackfillRef.current.products = true;
    }
    if (!didBackfillRef.current.orders && orders.length) {
      const toPatch = orders.filter(o => o.displayId == null);
      if (toPatch.length) {
        const patched = orders.map(o => o.displayId == null ? { ...o, displayId: getNextDisplayId('order') } : o);
        setOrders(patched);
        orders.forEach((orig, i) => {
          const next = patched[i];
          if (orig.displayId == null && next.displayId != null) void upsertRow('orders', next);
        });
      }
      didBackfillRef.current.orders = true;
    }
    if (!didBackfillRef.current.expenses && expenses.length) {
      const toPatch = expenses.filter(e => e.displayId == null);
      if (toPatch.length) {
        const patched = expenses.map(e => e.displayId == null ? { ...e, displayId: getNextDisplayId('expense') } : e);
        setExpenses(patched);
        expenses.forEach((orig, i) => {
          const next = patched[i];
          if (orig.displayId == null && next.displayId != null) void upsertRow('expenses', next);
        });
      }
      didBackfillRef.current.expenses = true;
    }
    if (!didBackfillRef.current.clients && clients.length) {
      const toPatch = clients.filter(c => c.displayId == null);
      if (toPatch.length) {
        const patched = clients.map(c => c.displayId == null ? { ...c, displayId: getNextDisplayId('client') } : c);
        setClients(patched);
        clients.forEach((orig, i) => {
          const next = patched[i];
          if (orig.displayId == null && next.displayId != null) void upsertRow('clients', next);
        });
      }
      didBackfillRef.current.clients = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, orders, expenses, clients]);

  // Initialize ID counters once based on current data to avoid reuse
  useEffect(() => {
    const maxClient = clients.length ? Math.max(...clients.map(c => c.displayId || 0)) : 0;
    const maxProduct = products.length ? Math.max(...products.map(p => p.displayId || 0)) : 0;
    const maxOrder = orders.length ? Math.max(...orders.map(o => o.displayId || 0)) : 0;
    const maxExpense = expenses.length ? Math.max(...expenses.map(e => e.displayId || 0)) : 0;
    initCountersFromData({
      maxClientDisplayId: maxClient,
      maxProductDisplayId: maxProduct,
      maxOrderDisplayId: maxOrder,
      maxExpenseDisplayId: maxExpense,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal state
  const [isCreateOrderModalOpen, setCreateOrderModalOpen] = useState(false);
  const [isCreateClientModalOpen, setCreateClientModalOpen] = useState(false);
  const [isCreateProductModalOpen, setCreateProductModalOpen] = useState(false);
  const [isAddStockModalOpen, setAddStockModalOpen] = useState(false);
  const [isCreateExpenseModalOpen, setCreateExpenseModalOpen] = useState(false);
  const [isEditClientModalOpen, setEditClientModalOpen] = useState(false);
  const [isEditOrderModalOpen, setEditOrderModalOpen] = useState(false);
  const [isOrderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);
  const [isEditProductModalOpen, setEditProductModalOpen] = useState(false);
  const [isEditExpenseModalOpen, setEditExpenseModalOpen] = useState(false);
  const [isClientOrdersModalOpen, setClientOrdersModalOpen] = useState(false);
  const [isLogDetailsModalOpen, setLogDetailsModalOpen] = useState(false);
  const [isCalculatorModalOpen, setCalculatorModalOpen] = useState(false);

  const [isSessionTimeoutModalOpen, setSessionTimeoutModalOpen] = useState(false);
  const [isConfirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [isAlertModalOpen, setAlertModalOpen] = useState(false);
  const [alertModalContent, setAlertModalContent] = useState<{ title: string; message: string }>({ title: '', message: '' });

  // Data for modals
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<{ onConfirm: () => void, title: string, message: string } | null>(null);

  const addLog = useCallback(async (action: string, details: Record<string, any>) => {
    const base = { timestamp: new Date().toISOString(), user: currentUser, action, details } as Omit<LogEntry, 'id'>;
    if (isSupabaseEnabled) {
      const inserted = await createLogNormalized(base);
      if (inserted) {
        setLogs(prev => [inserted, ...prev]);
        return;
      }
    }
    // Fallback to local-only log (or Option A)
    const localLog: LogEntry = { id: `l${logs.length + 1}`, ...base };
    setLogs(prev => [localLog, ...prev]);
    void upsertRow('logs', localLog);
  }, [logs.length, setLogs, currentUser]);

  const showAlert = (title: string, message: string) => {
    setAlertModalContent({ title, message });
    setAlertModalOpen(true);
  };

  // Client and Order data aggregation
  const clientDataWithStats = useMemo(() => {
    return clients.map(client => {
      const clientOrders = orders.filter(o => o.clientId === client.id);
      const totalSpent = clientOrders.reduce((sum, o) => sum + o.total, 0);
      const totalPaid = clientOrders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
      const totalDiscounts = clientOrders.reduce((sum, o) => sum + (o.discount?.amount || 0), 0);

      return {
        ...client,
        orders: clientOrders.length,
        totalSpent,
        balance: totalSpent - totalPaid,
        totalDiscounts,
      };
    });
  }, [clients, orders]);

  const inventoryValue = useMemo(() => {
    return products.reduce((total, p) => {
      if (p.stock <= 0 || !p.tiers || p.tiers.length === 0) {
        return total;
      }

      // Find the tier with the smallest positive quantity to use as a base for retail price.
      const sortedTiers = [...p.tiers]
        .filter(t => t.quantity > 0)
        .sort((a, b) => a.quantity - b.quantity);

      if (sortedTiers.length === 0) {
        return total;
      }

      const smallestTier = sortedTiers[0];
      const pricePerUnit = smallestTier.price / smallestTier.quantity;
      
      return total + (p.stock * pricePerUnit);
    }, 0);
  }, [products]);

  const inventoryCost = useMemo(() => {
    return products.reduce((total, p) => total + (p.stock * p.costPerUnit), 0);
  }, [products]);

  const dashboardStats = useMemo((): DashboardStat[] => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const weekStartDt = new Date(today);
    weekStartDt.setDate(today.getDate() - today.getDay());
    weekStartDt.setHours(0, 0, 0, 0);

    const monthStartDt = new Date(today.getFullYear(), today.getMonth(), 1);

    const ordersToday = orders.filter(o => o.date === todayStr);
    const salesToday = ordersToday.reduce((sum, o) => sum + o.total, 0);

    const salesThisWeek = orders
        .filter(o => new Date(o.date) >= weekStartDt)
        .reduce((sum, o) => sum + o.total, 0);

    const salesThisMonth = orders
        .filter(o => new Date(o.date) >= monthStartDt)
        .reduce((sum, o) => sum + o.total, 0);

    const unpaidOrders = orders.filter(o => (o.total - (o.amountPaid || 0)) > 0);
    const totalDebt = unpaidOrders.reduce((sum, o) => sum + (o.total - (o.amountPaid || 0)), 0);

    return [
        { label: 'Total Inventory Retail Value', value: `$${Math.round(inventoryValue).toLocaleString()}` },
        { label: 'Total Inventory Cost', value: `$${Math.round(inventoryCost).toLocaleString()}` },
        { label: 'Sales Today', value: `$${Math.round(salesToday).toLocaleString()}`, subtext: `${ordersToday.length} ${ordersToday.length === 1 ? 'order' : 'orders'}` },
        { label: 'Outstanding Debt', value: `$${Math.round(totalDebt).toLocaleString()}`, subtext: `From ${unpaidOrders.length} unpaid orders` },
        { label: 'Sales This Week', value: `$${Math.round(salesThisWeek).toLocaleString()}`, subtext: 'Since Sunday' },
        { label: 'Sales This Month', value: `$${Math.round(salesThisMonth).toLocaleString()}`, subtext: `In ${new Date().toLocaleString('default', { month: 'long' })}` },
    ];
  }, [products, orders, inventoryValue, inventoryCost]);

  // Event handlers
  const handleLogin = (username: string) => {
    setCurrentUser(username);
    setIsAuthenticated(true);
    addLog('User Logged In', { username });
  };
  
  const handleLogout = () => {
    setConfirmationModalOpen(false);
    setIsAuthenticated(false);
    setCurrentUser('');
  };

  // Homepage uses the regular search bar in header

  const handleCreateOrder = async (orderData: Omit<Order, 'id' | 'total' | 'status' | 'displayId'>) => {
    const itemsTotal = orderData.items.reduce((sum, item) => sum + item.price, 0);
    const total = itemsTotal + (orderData.fees.amount || 0) - (orderData.discount.amount || 0);
    const status: 'Unpaid' | 'Completed' = orderData.amountPaid >= total ? 'Completed' : 'Unpaid';
    
    if (isSupabaseEnabled) {
      const inserted = await createOrderNormalized({ ...orderData, total, status });
      if (inserted) {
        setOrders(prev => [inserted, ...prev]);
        // Update product stock (front-end managed as before)
        const timestamp = new Date().toISOString();
        const updatedProducts = products.map(p => {
          const itemInOrder = inserted.items.find(item => item.productId === p.id);
          if (itemInOrder) {
            const newStock = p.stock - itemInOrder.quantity;
            return { ...p, stock: newStock, lastOrdered: timestamp, inactive: newStock <= 0 };
          }
          return p;
        });
        setProducts(updatedProducts);
        inserted.items.forEach(item => {
          const updated = updatedProducts.find(p => p.id === item.productId);
          if (updated) void upsertRow('products', updated);
        });
        void addLog('Order Created', { orderId: inserted.id, orderDisplayId: inserted.displayId, client: inserted.clientId, total: inserted.total });
        setCreateOrderModalOpen(false);
        return;
      }
    }

    // Fallback (local/Option A)
    const newOrder: Order = {
      ...orderData,
      id: `ord-${(orders.length + 1).toString().padStart(4, '0')}`,
      displayId: getNextDisplayId('order'),
      total,
      status,
    };

    setOrders(prev => [newOrder, ...prev]);
    void upsertRow('orders', newOrder);

    // Update product stock
    const timestamp = new Date().toISOString();
    // Compute updated products locally and sync to Supabase
    const updatedProducts = products.map(p => {
      const itemInOrder = newOrder.items.find(item => item.productId === p.id);
      if (itemInOrder) {
        const newStock = p.stock - itemInOrder.quantity;
        return { ...p, stock: newStock, lastOrdered: timestamp, inactive: newStock <= 0 };
      }
      return p;
    });
    setProducts(updatedProducts);
    // Best-effort upsert only changed products
    newOrder.items.forEach(item => {
      const updated = updatedProducts.find(p => p.id === item.productId);
      if (updated) void upsertRow('products', updated);
    });

    void addLog('Order Created', { orderId: newOrder.id, orderDisplayId: newOrder.displayId, client: newOrder.clientId, total: newOrder.total });
    setCreateOrderModalOpen(false);
  };
  
  const handleEditOrder = (originalOrder: Order, updatedData: Omit<Order, 'id'>) => {
    const stockChanges = new Map<string, number>();

    // Calculate stock to return to inventory
    originalOrder.items.forEach(item => {
        stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + item.quantity);
    });

    // Calculate new stock to be removed
    updatedData.items.forEach(item => {
        stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) - item.quantity);
    });

    const timestamp = new Date().toISOString();
    const updatedProductIds = new Set(updatedData.items.map(item => item.productId));

    const newProducts = products.map(p => {
      const stockChange = stockChanges.get(p.id);
      const shouldUpdateTimestamp = updatedProductIds.has(p.id);
      if (stockChange !== undefined || shouldUpdateTimestamp) {
        const newStock = p.stock + (stockChange || 0);
        const newLastOrdered = shouldUpdateTimestamp ? timestamp : p.lastOrdered;
        return { ...p, stock: newStock, lastOrdered: newLastOrdered, inactive: newStock <= 0 };
      }
      return p;
    });
    setProducts(newProducts);
    // Upsert only changed products
    newProducts.forEach((p, idx) => {
      const prev = products[idx];
      if (!prev || prev.stock !== p.stock || prev.lastOrdered !== p.lastOrdered) {
        void upsertRow('products', p);
      }
    });

    const updatedOrder: Order = { ...updatedData, id: originalOrder.id };
    setOrders(prev => prev.map(o => o.id === originalOrder.id ? updatedOrder : o));
    void upsertRow('orders', updatedOrder);
    addLog('Order Updated', { orderId: originalOrder.id });
    setEditOrderModalOpen(false);
  };

  const handleDeleteOrder = () => {
    if (!selectedOrder) return;

    // Return stock to inventory
    const returnedProducts = products.map(p => {
      const itemInOrder = selectedOrder.items.find(item => item.productId === p.id);
      if (itemInOrder) {
        const newStock = p.stock + itemInOrder.quantity;
        return { ...p, stock: newStock, inactive: newStock <= 0 };
      }
      return p;
    });
    setProducts(returnedProducts);
    // Upsert changed products
    selectedOrder.items.forEach(item => {
      const updated = returnedProducts.find(p => p.id === item.productId);
      if (updated) void upsertRow('products', updated);
    });

    setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
    void deleteById('orders', selectedOrder.id);
    addLog('Order Deleted', { orderId: selectedOrder.id });
    setEditOrderModalOpen(false);
    setConfirmationModalOpen(false);
  };

  // Mark-as-paid modal state and handlers
  const [isMarkPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [markPaidOrderId, setMarkPaidOrderId] = useState<string | null>(null);
  const handleMarkAsPaid = (orderId: string) => {
    setMarkPaidOrderId(orderId);
    setMarkPaidModalOpen(true);
  };
  const confirmMarkAsPaid = (method: 'cash' | 'etransfer', amount: number) => {
    if (!markPaidOrderId) return;
    setOrders(prev => prev.map(o => {
      if (o.id === markPaidOrderId) {
        const remaining = Math.max(0, o.total - (o.amountPaid || 0));
        const src: any = o.paymentMethods || {};
        const pm = {
          cash: typeof src.cash === 'number' ? src.cash : (src.cash ? (o.amountPaid || 0) : 0),
          etransfer: typeof src.etransfer === 'number' ? src.etransfer : (src.etransfer ? (o.amountPaid || 0) : 0),
        } as any;
        const delta = Math.round(Math.min(Math.max(0, amount || 0), remaining || (amount || 0)));
        if (method === 'cash') pm.cash = (pm.cash || 0) + delta;
        if (method === 'etransfer') pm.etransfer = (pm.etransfer || 0) + delta;
        const newAmountPaid = Math.round((pm.cash || 0) + (pm.etransfer || 0));
        const newStatus: 'Unpaid' | 'Completed' = newAmountPaid >= o.total ? 'Completed' : 'Unpaid';
        const updated: Order = { ...o, amountPaid: newAmountPaid, status: newStatus, paymentMethods: pm };
        addLog('Order Payment Recorded', { orderId: updated.id, method, amount: delta });
        void upsertRow('orders', updated);
        return updated;
      }
      return o;
    }));
    setMarkPaidModalOpen(false);
    setMarkPaidOrderId(null);
  };

  const handleCreateClient = async (clientData: Omit<Client, 'id' | 'orders' | 'totalSpent' | 'displayId'>) => {
    if (isSupabaseEnabled) {
      const inserted = await createClientNormalized(clientData);
      if (inserted) {
        setClients(prev => [...prev, inserted]);
        void addLog('Client Created', { clientId: inserted.id, name: inserted.name });
        setCreateClientModalOpen(false);
        return;
      }
    }
    // Fallback (local/Option A)
    const nextDisplayId = getNextDisplayId('client');
    const newClient: Client = {
      ...clientData,
      id: `c-${Date.now()}`,
      displayId: nextDisplayId,
      orders: 0,
      totalSpent: 0
    };
    setClients(prev => [...prev, newClient]);
    void upsertRow('clients', newClient);
    void addLog('Client Created', { clientId: newClient.id, name: newClient.name });
    setCreateClientModalOpen(false);
  };

  const handleEditClient = (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    void upsertRow('clients', updatedClient);
    addLog('Client Updated', { clientId: updatedClient.id });
    setEditClientModalOpen(false);
  };

  const handleDeleteClient = () => {
    if (!selectedClient) return;
    const clientOrders = orders.filter(o => o.clientId === selectedClient.id);
    if (clientOrders.length > 0) {
      showAlert("Cannot Delete Client", "Cannot delete client with existing orders. Please reassign or delete their orders first.");
      return;
    }
    setClients(prev => prev.filter(c => c.id !== selectedClient.id));
    void deleteById('clients', selectedClient.id);
    addLog('Client Deleted', { clientId: selectedClient.id });
    setEditClientModalOpen(false);
    setConfirmationModalOpen(false);
  };

  const handleCreateProduct = async (productData: Omit<Product, 'id' | 'displayId' | 'sortIndex'>) => {
    const productWithStatus = { ...productData, inactive: productData.stock <= 0 };
    if (isSupabaseEnabled) {
      const inserted = await createProductNormalized(productWithStatus);
      if (inserted) {
        setProducts(prev => [...prev, inserted]);
        void addLog('Product Created', { productId: inserted.id, name: inserted.name });
        setCreateProductModalOpen(false);
        return;
      }
    }
    // Fallback (local/Option A)
    const newProduct: Product = { ...productWithStatus, id: `p-${Date.now()}`, displayId: getNextDisplayId('product'), sortIndex: products.length };
    setProducts(prev => [...prev, newProduct]);
    void upsertRow('products', newProduct);
    void addLog('Product Created', { productId: newProduct.id, name: newProduct.name });
    setCreateProductModalOpen(false);
  };

  const handleEditProduct = (updatedProduct: Product) => {
    const coercedProduct: Product = { ...updatedProduct, inactive: updatedProduct.stock <= 0 };
    setProducts(prev => prev.map(p => p.id === coercedProduct.id ? coercedProduct : p));
    void upsertRow('products', coercedProduct);
    addLog('Product Updated', { productId: coercedProduct.id });
    setEditProductModalOpen(false);
  };
  
  const handleDeleteProduct = () => {
    if (!selectedProduct) return;
    setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
    void deleteById('products', selectedProduct.id);
    addLog('Product Deleted', { productId: selectedProduct.id });
    setEditProductModalOpen(false);
    setConfirmationModalOpen(false);
  };
  
  const handleUpdateStock = (productId: string, amount: number, purchaseCost: number) => {
    const productBeforeUpdate = products.find(p => p.id === productId);
    if (!productBeforeUpdate) return;

    let updatedProductLocal: Product | undefined;
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const newStock = p.stock + amount;
        let newCostPerUnit = p.costPerUnit;
        if (amount > 0 && purchaseCost > 0 && newStock > 0) {
          const oldInventoryValue = p.stock * p.costPerUnit;
          const newInventoryValue = oldInventoryValue + purchaseCost;
          const calculatedCost = newInventoryValue / newStock;
          newCostPerUnit = Math.round(calculatedCost * 100) / 100;
        }
        updatedProductLocal = { ...p, stock: newStock, costPerUnit: newCostPerUnit, inactive: newStock <= 0 };
        return updatedProductLocal;
      }
      return p;
    }));
    if (updatedProductLocal) void upsertRow('products', updatedProductLocal);

    if (purchaseCost > 0 && amount > 0) {
      const newExpense: Omit<Expense, 'id'> = {
        date: new Date().toISOString().split('T')[0],
        description: `Stock purchase for ${productBeforeUpdate.name}`,
        amount: purchaseCost,
        category: 'Inventory',
      };
      handleCreateExpense(newExpense);
    }
    
    addLog('Stock Updated', { 
        productId, 
        name: productBeforeUpdate.name, 
        change: amount, 
        newStock: productBeforeUpdate.stock + amount 
    });

    setAddStockModalOpen(false);
  };

  const handleCreateExpense = async (expenseData: Omit<Expense, 'id' | 'displayId' | 'sortIndex'>) => {
    if (isSupabaseEnabled) {
      const inserted = await createExpenseNormalized(expenseData);
      if (inserted) {
        setExpenses(prev => [inserted, ...prev]);
        void addLog('Expense Created', { description: inserted.description, amount: inserted.amount });
        setCreateExpenseModalOpen(false);
        return;
      }
    }
    // Fallback (local/Option A)
    const newExpense: Expense = { ...expenseData, id: `exp-${Date.now()}`, displayId: getNextDisplayId('expense'), sortIndex: expenses.length };
    setExpenses(prev => [newExpense, ...prev]);
    void upsertRow('expenses', newExpense);
    void addLog('Expense Created', { description: newExpense.description, amount: newExpense.amount });
    setCreateExpenseModalOpen(false);
  };

  const handleEditExpense = (updatedExpense: Expense) => {
     setExpenses(prev => prev.map(e => e.id === updatedExpense.id ? updatedExpense : e));
     void upsertRow('expenses', updatedExpense);
     addLog('Expense Updated', { expenseId: updatedExpense.id });
     setEditExpenseModalOpen(false);
  };
  
  const handleDeleteExpense = () => {
    if (!selectedExpense) return;
    setExpenses(prev => prev.filter(e => e.id !== selectedExpense.id));
    void deleteById('expenses', selectedExpense.id);
    addLog('Expense Deleted', { expenseId: selectedExpense.id });
    setEditExpenseModalOpen(false);
    setConfirmationModalOpen(false);
  };
  
  const handleDeleteAllData = () => {
    const deletionLog: LogEntry = {
        id: 'l_deleted',
        timestamp: new Date().toISOString(),
        user: currentUser,
        action: 'All Data Deleted',
        details: { message: 'All user-generated data has been wiped.' }
    };

    setClients([]);
    setProducts([]);
    setOrders([]);
    setExpenses([]);
    setLogs([deletionLog]);

    setConfirmationModalOpen(false);
    showAlert("Success", "All application data has been permanently deleted.");
  };

  const handleExport = (type: 'all' | 'orders' | 'clients' | 'products' | 'expenses') => {
    if (type === 'all') {
      const allData = {
        orders,
        clients,
        products,
        expenses,
        logs
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `dashboard_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      addLog('Data Exported', { type: 'all' });
    } else {
      const dataMap = { orders, clients, products, expenses };
      const success = exportToCsv(`${type}_export_${new Date().toISOString().split('T')[0]}.csv`, dataMap[type]);
      if (success) {
          addLog('Data Exported', { type });
      } else {
          showAlert('Export Failed', 'There is no data to export.');
      }
    }
  };
  
  const handleImportData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== 'string') {
            showAlert("Import Error", "File content could not be read as text.");
            return;
        }
        try {
            const data = JSON.parse(text);
            
            // Basic validation to ensure we're importing the right kind of file
            if (data.clients && Array.isArray(data.clients) &&
                data.products && Array.isArray(data.products) &&
                data.orders && Array.isArray(data.orders) &&
                data.expenses && Array.isArray(data.expenses) &&
                data.logs && Array.isArray(data.logs)) {
              // Prepare ID counters from imported data to avoid reusing display IDs
              const maxClient = data.clients.length ? Math.max(...data.clients.map((c: any) => c?.displayId || 0)) : 0;
              const maxProduct = data.products.length ? Math.max(...data.products.map((p: any) => p?.displayId || 0)) : 0;
              const maxOrder = data.orders.length ? Math.max(...data.orders.map((o: any) => o?.displayId || 0)) : 0;
              const maxExpense = data.expenses.length ? Math.max(...data.expenses.map((ex: any) => ex?.displayId || 0)) : 0;
              initCountersFromData({
                maxClientDisplayId: maxClient,
                maxProductDisplayId: maxProduct,
                maxOrderDisplayId: maxOrder,
                maxExpenseDisplayId: maxExpense,
              });

              // Allow backfill effect to run again for imported datasets
              didBackfillRef.current = { products: false, orders: false, expenses: false, clients: false };

              setClients(data.clients);
              setProducts(data.products);
              setOrders(data.orders);
              setExpenses(data.expenses);
              setLogs(data.logs);
              addLog('Data Imported', { fileName: file.name, source: 'user_upload' });
              showAlert("Import Successful", `Successfully imported data from ${file.name}.`);
              setPage('dashboard'); // Navigate to dashboard to see results
            } else {
              throw new Error('Invalid JSON structure. The file does not appear to be a valid export file.');
            }
        } catch (error) {
            console.error("Failed to import data:", error);
            showAlert("Import Failed", `Please ensure you are uploading a valid JSON export file from this application. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };
    reader.onerror = () => {
        showAlert("File Read Error", "An error occurred while reading the file.");
    };
    reader.readAsText(file);
  };

  // Push all current local data to Supabase tables
  const handleSyncSupabase = async () => {
    if (!isSupabaseEnabled) {
      showAlert('Supabase Not Configured', 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to enable syncing.');
      return;
    }
    try {
      const result = await syncLocalToSupabase({ clients, products, orders, expenses, logs });
      if (!result.enabled) {
        showAlert('Supabase Not Configured', 'Supabase client is not initialized.');
        return;
      }
      const { counts } = result;
      addLog('Supabase Sync', { counts });
      showAlert('Sync Complete', `Upserted ${counts.clients} clients, ${counts.products} products, ${counts.orders} orders, ${counts.expenses} expenses, and ${counts.logs} logs.`);
    } catch (e) {
      console.error('Supabase sync error', e);
      showAlert('Sync Failed', 'An error occurred while syncing to Supabase. Please check the console for details.');
    }
  };

  // Modal openers
  const openOrderDetailsModal = (order: Order) => { setSelectedOrder(order); setOrderDetailsModalOpen(true); };
  const openEditOrderModal = (order: Order) => { setSelectedOrder(order); setEditOrderModalOpen(true); };
  const openEditClientModal = (client: Client) => { setSelectedClient(client); setEditClientModalOpen(true); };
  const handleEditClientFromOrdersModal = (client: Client) => {
    const baseClient = clients.find(c => c.id === client.id) || client;
    openEditClientModal(baseClient);
    setClientOrdersModalOpen(false);
  };
  const handleEditOrderFromDetails = (order: Order) => {
    setOrderDetailsModalOpen(false);
    openEditOrderModal(order);
  };
  const openEditProductModal = (product: Product) => { setSelectedProduct(product); setEditProductModalOpen(true); };
  const openEditExpenseModal = (expense: Expense) => { setSelectedExpense(expense); setEditExpenseModalOpen(true); };
  const openAddStockModal = (product: Product) => { setSelectedProduct(product); setAddStockModalOpen(true); };
  const openClientOrdersModal = (client: Client) => { setSelectedClient(client as any); setClientOrdersModalOpen(true); };
  const openLogDetailsModal = (log: LogEntry) => { setSelectedLog(log); setLogDetailsModalOpen(true); };

  // Inline bulk stock edit removed; stock edited via Add Stock modal.

  // Manual ordering removed per user request.

  const openDeleteConfirmation = (type: 'order' | 'client' | 'product' | 'expense' | 'logout') => {
    const actions = {
      order: { onConfirm: handleDeleteOrder, title: 'Delete Order?', message: `Are you sure you want to delete order ${selectedOrder?.id}? This will also return its items to stock. This action cannot be undone.` },
      client: { onConfirm: handleDeleteClient, title: 'Delete Client?', message: `Are you sure you want to delete client ${selectedClient?.name}? This action cannot be undone.` },
      product: { onConfirm: handleDeleteProduct, title: 'Delete Product?', message: `Are you sure you want to delete product ${selectedProduct?.name}? This action cannot be undone.` },
      expense: { onConfirm: handleDeleteExpense, title: 'Delete Expense?', message: `Are you sure you want to delete this expense? This action cannot be undone.` },
      logout: { onConfirm: handleLogout, title: 'Log Out?', message: 'Are you sure you want to log out?' }
    };
    setConfirmationAction(actions[type]);
    setConfirmationModalOpen(true);
  };
  
  const openDeleteAllDataConfirmation = () => {
    setConfirmationAction({
        onConfirm: handleDeleteAllData,
        title: 'Delete All Data?',
        message: 'Are you sure you want to permanently delete all data, including clients, products, orders, expenses, and logs? This action is irreversible.'
    });
    setConfirmationModalOpen(true);
  };
  
  // Render logic
  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage 
                    onNewOrder={() => setCreateOrderModalOpen(true)}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onViewClientOrders={openClientOrdersModal}
                    onEditOrder={openEditOrderModal}
                    onEditProduct={openEditProductModal}
                    clients={clients}
                    orders={orders}
                    products={products}
                    isPrivateMode={isPrivateMode}
                    currentUser={currentUser}
                    dashboardStats={dashboardStats}
                    onQuickAddExpense={handleCreateExpense}
                />;
      case 'orders':
        return <OrdersPage 
                orders={orders} 
                clients={clients} 
                products={products}
                searchQuery={searchQuery} 
                onOrderClick={openOrderDetailsModal}
                onMarkAsPaid={handleMarkAsPaid}
                isPrivateMode={isPrivateMode}
            />;
      case 'clients':
        return <ClientsPage 
                    clients={clientDataWithStats} 
                    searchQuery={searchQuery} 
                    onViewOrders={openClientOrdersModal}
                    isPrivateMode={isPrivateMode}
                />;
      case 'products':
        return <ProductsPage 
                    products={products} 
                    searchQuery={searchQuery} 
                    onProductClick={openEditProductModal}
                    onUpdateStock={openAddStockModal}
                    isPrivateMode={isPrivateMode}
                />;
      case 'transactions':
        return <TransactionsPage 
                orders={orders} 
                expenses={expenses}
                clients={clients}
                searchQuery={searchQuery}
                isPrivateMode={isPrivateMode}
                onEditExpense={openEditExpenseModal}
                onEditOrder={openEditOrderModal}
            />;
      case 'log':
        return <LogPage logs={logs} onLogClick={openLogDetailsModal} />;
      case 'settings':
         return (
           <SettingsPage
             setPage={setPage}
             onExport={handleExport as any}
             onImport={handleImportData}
             onSyncSupabase={handleSyncSupabase}
             onLogout={() => openDeleteConfirmation('logout')}
             onDeleteAllData={openDeleteAllDataConfirmation}
             dataSource={dataSource}
             supabaseEnabled={isSupabaseEnabled}
           />
         );
      case 'reports':
          return <ReportsPage orders={orders} products={products} expenses={expenses} clients={clients} isPrivateMode={isPrivateMode} />;
      default:
        return <div>Page not found</div>;
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLogin} />;
  }

  const unpaidOrdersCount = orders.filter(o => o.status === 'Unpaid' && (o.total - (o.amountPaid || 0)) > 0).length;
  const isDashboardPage = page === 'dashboard';
  const isSettingsPage = page === 'settings';
  const showSecondarySearch = !isDashboardPage && !isSettingsPage;
  const headerSearchContainerClass = 'relative glass flex items-center h-14 px-4 w-full sm:flex-1 sm:min-w-[280px]';
  const headerSearchIconClass = 'mr-3 text-muted pointer-events-none';
  const headerSearchInputClass = 'flex-1 bg-transparent border-none text-base text-primary placeholder:text-muted focus:outline-none focus:ring-0';
  const headerAction = (() => {
    switch (page) {
      case 'orders':
        return { label: '+ New Order', onClick: () => setCreateOrderModalOpen(true) };
      case 'clients':
        return { label: '+ Add Client', onClick: () => setCreateClientModalOpen(true) };
      case 'products':
        return { label: '+ Add Product', onClick: () => setCreateProductModalOpen(true) };
      case 'transactions':
        return { label: '+ Add Expense', onClick: () => setCreateExpenseModalOpen(true) };
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-screen w-full text-primary p-4 md:p-6 lg:p-8">
      <div className="liquid-bg">
        <div className="blob blob--a"></div>
        <div className="blob blob--b"></div>
        <div className="blob blob--c"></div>
      </div>
      
      <div className="grid grid-cols-12 gap-6 relative z-10">
        <main className="col-span-12 space-y-6 pb-28">
          <div className="max-w-5xl mx-auto w-full space-y-8">
            <header className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-4 flex-grow min-w-0">
                {isDashboardPage ? (
                  <div className="w-full">
                    <div className={`${headerSearchContainerClass} max-w-3xl mx-auto`}>
                      <Search size={20} className={headerSearchIconClass} />
                      <input
                        type="text"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={headerSearchInputClass}
                      />
                    </div>
                  </div>
                ) : isSettingsPage ? (
                  <div className="flex flex-col gap-3">
                    <h1 className="text-4xl font-bold text-primary tracking-tight">Settings</h1>
                    <p className="text-muted mt-1">Manage your dashboard's data, preferences, and user session.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                    {headerAction && (
                      <button
                        onClick={headerAction.onClick}
                        className="gloss-btn self-start sm:self-auto w-full sm:w-auto"
                      >
                        {headerAction.label}
                      </button>
                    )}
                    {showSecondarySearch && (
                      <div className={headerSearchContainerClass}>
                        <Search size={20} className={headerSearchIconClass} />
                        <input
                          type="text"
                          placeholder="Search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className={headerSearchInputClass}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 self-start">
                <button onClick={() => setCalculatorModalOpen(true)} className="glass h-14 w-14 flex items-center justify-center rounded-lg text-muted hover:text-primary transition-colors hover:bg-white/10" aria-label="Calculator"><Calculator size={28} /></button>
                <button onClick={() => setIsPrivateMode(!isPrivateMode)} className={`glass h-14 w-14 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10 ${isPrivateMode ? 'text-indigo-400' : 'text-muted hover:text-primary'}`} aria-label="Toggle Private Mode" title={isPrivateMode ? "Disable Private Mode" : "Enable Private Mode"}><EyeOff size={28} /></button>
                <button onClick={() => setPage('settings')} className="glass h-14 w-14 flex items-center justify-center rounded-lg text-muted hover:text-primary transition-colors hover:bg-white/10 settings-btn" aria-label="Settings"><Settings size={28} /></button>
              </div>
            </header>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<div className="glass p-6">Loading...</div>}>
                {renderPage()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
          </div>
        </main>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 p-3 z-40">
         <div className="glass flex items-center justify-around p-1 rounded-2xl relative max-w-lg mx-auto">
            <MobileNavItem icon={<Home size={24} />} active={page==='dashboard'} onClick={() => setPage('dashboard')} />
            <MobileNavItem icon={<ShoppingCart size={24} />} active={page==='orders'} onClick={() => setPage('orders')} />
            <div className="w-16 shrink-0" aria-hidden="true" />
            <MobileNavItem icon={<Users size={24} />} active={page==='clients'} onClick={() => setPage('clients')} />
            <MobileNavItem icon={<Box size={24} />} active={page==='products'} onClick={() => setPage('products')} />
            <button onClick={() => setCreateOrderModalOpen(true)} className="gloss-btn mobile-fab" aria-label="New Order">
                <Plus size={28} />
            </button>
         </div>
      </footer>
      
      <Suspense fallback={null}>
        <CreateOrderModal isOpen={isCreateOrderModalOpen} onClose={() => setCreateOrderModalOpen(false)} clients={clients} products={products} onCreate={handleCreateOrder} onAlert={showAlert} />
        <OrderDetailsModal
          isOpen={isOrderDetailsModalOpen}
          onClose={() => setOrderDetailsModalOpen(false)}
          order={selectedOrder}
          client={selectedOrder ? clients.find(c => c.id === selectedOrder.clientId) || null : null}
          products={products}
          isPrivateMode={isPrivateMode}
          onEditOrder={handleEditOrderFromDetails}
        />
        <EditOrderModal isOpen={isEditOrderModalOpen} onClose={() => setEditOrderModalOpen(false)} order={selectedOrder} clients={clients} products={products} onSave={handleEditOrder} onDelete={() => openDeleteConfirmation('order')} onAlert={showAlert} />
        <CreateClientModal isOpen={isCreateClientModalOpen} onClose={() => setCreateClientModalOpen(false)} onAdd={handleCreateClient} />
        <EditClientModal isOpen={isEditClientModalOpen} onClose={() => setEditClientModalOpen(false)} client={selectedClient} onSave={handleEditClient} onDelete={() => openDeleteConfirmation('client')} isPrivateMode={isPrivateMode} />
        <ClientOrdersModal
          isOpen={isClientOrdersModalOpen}
          onClose={() => setClientOrdersModalOpen(false)}
          client={selectedClient ? clientDataWithStats.find(c => c.id === selectedClient.id) || null : null}
          orders={orders.filter(o => o.clientId === selectedClient?.id)}
          products={products}
          isPrivateMode={isPrivateMode}
          onEditClient={handleEditClientFromOrdersModal}
        />
        <CreateProductModal isOpen={isCreateProductModalOpen} onClose={() => setCreateProductModalOpen(false)} onAdd={handleCreateProduct} />
        <EditProductModal isOpen={isEditProductModalOpen} onClose={() => setEditProductModalOpen(false)} product={selectedProduct} onSave={handleEditProduct} onDelete={() => openDeleteConfirmation('product')} isDeletable={!!(selectedProduct && !orders.some(o => o.items.some(i => i.productId === selectedProduct.id)))} isPrivateMode={isPrivateMode} />
        <AddStockModal isOpen={isAddStockModalOpen} onClose={() => setAddStockModalOpen(false)} product={selectedProduct} onUpdateStock={handleUpdateStock} isPrivateMode={isPrivateMode} />
        <CreateExpenseModal isOpen={isCreateExpenseModalOpen} onClose={() => setCreateExpenseModalOpen(false)} onAdd={handleCreateExpense} expenseCategories={[...new Set(expenses.map(e => e.category).filter((c): c is string => !!c))].sort()}/>
        <EditExpenseModal isOpen={isEditExpenseModalOpen} onClose={() => setEditExpenseModalOpen(false)} expense={selectedExpense} onSave={handleEditExpense} onDelete={() => openDeleteConfirmation('expense')} expenseCategories={[...new Set(expenses.map(e => e.category).filter((c): c is string => !!c))].sort()} />
        <LogDetailsModal isOpen={isLogDetailsModalOpen} onClose={() => setLogDetailsModalOpen(false)} logEntry={selectedLog} />
        <ConfirmationModal isOpen={isConfirmationModalOpen} onClose={() => setConfirmationModalOpen(false)} onConfirm={() => confirmationAction?.onConfirm()} title={confirmationAction?.title || ''} message={confirmationAction?.message || ''} />
        <AlertModal isOpen={isAlertModalOpen} onClose={() => setAlertModalOpen(false)} title={alertModalContent.title} message={alertModalContent.message} />
        <CalculatorModal isOpen={isCalculatorModalOpen} onClose={() => setCalculatorModalOpen(false)} />
        <SessionTimeoutModal isOpen={isSessionTimeoutModalOpen} onClose={() => setSessionTimeoutModalOpen(false)} onLogout={() => { setSessionTimeoutModalOpen(false); /* add any logout logic if needed */ }} />
        <MarkPaidModal 
          isOpen={isMarkPaidModalOpen} 
          onClose={() => { setMarkPaidModalOpen(false); setMarkPaidOrderId(null); }} 
          onConfirm={confirmMarkAsPaid}
          remaining={(() => {
            const ord = orders.find(o => o.id === markPaidOrderId);
            return ord ? Math.max(0, Math.round(ord.total - (ord.amountPaid || 0))) : 0;
          })()}
        />
      </Suspense>
    </div>
  );
};
