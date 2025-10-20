import React, { useState, useEffect, useMemo, type ReactNode, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, AlertTriangle, Info, ArrowLeft, Pencil, Check, ChevronDown, Bot, Mic, Square, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Client, Product, Order, OrderItem, Expense, LogEntry, ProductTier, PaymentMethods, OrderAdjustment } from '../types';
import { printOrderPdf } from '../lib/pdf';
import { groupOrderItems, formatEntityDisplayId, calculateTieredPrice } from '../lib/utils';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Helper types
export type MetricChartData = {
  title: string;
  data: { label: string; value: number }[];
};

type RevenuePeriod = {
    revenue: number;
    orders: Order[];
};

export type RevenueBreakdownData = {
    type: 'revenue_breakdown';
    title: string;
    data: {
        today: RevenuePeriod;
        week: RevenuePeriod;
        month: RevenuePeriod;
    };
};

export type MetricModalData = MetricChartData | RevenueBreakdownData | null;


// --- Reusable Modal & Form Components ---

const ModalWrapper: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  actions?: ReactNode;
  hideTitle?: boolean;
}> = ({ isOpen, onClose, title, children, size = 'md', actions, hideTitle = false }) => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
    '2xl': 'max-w-7xl',
  };

  const [isMouseDownOnBackdrop, setIsMouseDownOnBackdrop] = useState(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsMouseDownOnBackdrop(true);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMouseDownOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
    setIsMouseDownOnBackdrop(false);
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`glass-wrap w-full ${sizeClasses[size]}`}
          >
            <div className="glass max-h-[90vh] flex flex-col">
              <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4 border-b border-white/10 flex-shrink-0">
                <button
                  onClick={onClose}
                  className="p-2 rounded-full text-muted hover:text-primary hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center justify-center">
                  {!hideTitle && title ? (
                    <h2 className="text-lg font-bold text-primary text-center">{title}</h2>
                  ) : null}
                </div>
                <div className="flex items-center justify-end gap-2">
                  {actions}
                </div>
              </header>
              <div className="p-6 overflow-y-auto">
                {children}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const modalConfirmButtonClass = 'group flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500 text-white shadow-[0_16px_32px_-18px_rgba(37,99,235,0.85)] ring-1 ring-inset ring-white/15 transition-all duration-200 hover:shadow-[0_22px_42px_-16px_rgba(37,99,235,0.9)] hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/90';
const modalConfirmIconClass = 'drop-shadow-[0_6px_12px_rgba(15,23,42,0.35)] transition-transform duration-200 ease-out group-hover:scale-110';

const FormRow = ({ children, className }: { children: ReactNode, className?: string }) => <div className={`flex flex-col gap-2 ${className || ''}`}>{children}</div>;
const Label = ({ children, htmlFor }: { children: ReactNode, htmlFor?: string }) => <label htmlFor={htmlFor} className="text-sm font-medium text-muted cursor-pointer">{children}</label>;

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { startAdornment?: ReactNode; endAdornment?: ReactNode }
>(({ startAdornment, endAdornment, className, ...props }, ref) => {
  const hasStartAdornment = Boolean(startAdornment);
  const hasEndAdornment = Boolean(endAdornment);
  
  return (
    <div className={`relative flex items-center w-full ${className || ''}`}>
      {hasStartAdornment && <span className="absolute left-3 text-muted pointer-events-none z-10">{startAdornment}</span>}
      <input
        ref={ref}
        {...props}
        className={`w-full bg-white/5 border border-white/10 rounded-lg py-3 text-base text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${hasStartAdornment ? 'pl-7' : 'pl-4'} ${hasEndAdornment ? 'pr-8' : 'pr-4'}`}
      />
      {hasEndAdornment && <span className="absolute right-3 text-muted pointer-events-none z-10">{endAdornment}</span>}
    </div>
  );
});

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, value, defaultValue, children, ...props }, ref) => {
    const resolvedValue = value ?? defaultValue ?? '';
    const isPlaceholderSelected = resolvedValue === '' || resolvedValue === null;

    return (
      <div className={`relative w-full`}>
        <select
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          {...props}
          className={`appearance-none w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isPlaceholderSelected ? 'text-muted' : 'text-primary'} ${className || ''}`}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
    );
  }
);
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
    <textarea ref={ref} {...props} className={`w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-base text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${className || ''}`} />
));
const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      {...props}
      className={`custom-checkbox disabled:cursor-not-allowed disabled:opacity-60 ${className || ''}`}
    />
));
const FormActions = ({ children }: { children: ReactNode }) => {
  const items = React.Children.toArray(children);
  const hasSplit = items.length > 1;
  const leftItem = hasSplit ? items[0] : null;
  const rightItems = hasSplit ? items.slice(1) : items;

  return (
    <div
      className={`flex flex-wrap items-center gap-4 mt-8 pt-6 border-t border-white/10 ${
        leftItem ? 'justify-between' : 'justify-end'
      }`}
    >
      {leftItem && <div className="flex items-center gap-3">{leftItem}</div>}
      <div className="flex items-center gap-3">
        {rightItems.map((item, index) => (
          <React.Fragment key={index}>{item}</React.Fragment>
        ))}
      </div>
    </div>
  );
};
const CancelButton = ({ onClick }: { onClick: () => void }) => <button type="button" onClick={onClick} className="px-4 py-2 text-sm font-medium text-muted hover:text-primary">Cancel</button>;
const DeleteButton = ({ onClick }: { onClick: () => void }) => <button type="button" onClick={onClick} className="gloss-btn !bg-purple-600/80 hover:!bg-purple-600 !border-purple-600/20 hover:!shadow-purple-600/25"><Trash2 size={16} /> Delete</button>;


// --- App Modals ---

interface OrderFormState {
  clientId: string;
  items: OrderItem[];
  notes: string;
  date: string;
  paymentDueDate: string;
  amountPaid: string;
  paymentMethods: PaymentMethods;
  fees: { amount: string; description: string };
  discount: { amount: string; description: string };
}


const ClientSelector: React.FC<{
  clients: Client[];
  value: string;
  onSelect: (clientId: string) => void;
  isHighlighted: boolean;
}> = ({ clients, value, onSelect, isHighlighted }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const availableClients = useMemo(() => {
    const active = clients.filter(client => !client.inactive);
    if (value && !active.some(client => client.id === value)) {
      const current = clients.find(client => client.id === value);
      if (current) {
        return [current, ...active];
      }
    }
    return active;
  }, [clients, value]);

  const selectedClient = useMemo(() => clients.find(client => client.id === value) || null, [clients, value]);

  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return availableClients;
    return availableClients.filter(client => {
      const haystack = [
        client.name,
        client.displayId ? String(client.displayId) : '',
      ];
      return haystack.some(field => field && field.toLowerCase().includes(term));
    });
  }, [availableClients, searchTerm]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchTerm('');
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, closeDropdown]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDropdown();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, closeDropdown]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (isOpen) {
      closeDropdown();
    } else {
      setIsOpen(true);
    }
  };

  const handleSelect = (clientId: string) => {
    onSelect(clientId);
    closeDropdown();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && filteredClients.length > 0) {
      event.preventDefault();
      handleSelect(filteredClients[0].id);
    }
  };

  const selectedLabel = selectedClient ? (
    <span className="flex items-center gap-2">
      <span>{selectedClient.name}</span>
      {selectedClient.displayId ? (
        <span className="text-xs font-medium text-muted/70">#{selectedClient.displayId}</span>
      ) : null}
    </span>
  ) : (
    <span className="text-muted">Select a client</span>
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id="client"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-base text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isHighlighted ? 'highlight-step' : ''}`}
      >
        <span className={selectedClient ? 'flex-1 truncate' : ''}>{selectedLabel}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-lg border border-white/10 bg-slate-950/95 p-2 shadow-xl shadow-black/30 backdrop-blur">
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="mb-2"
          />
          <div className="max-h-60 overflow-y-auto rounded-md border border-white/5">
            {filteredClients.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted">No clients found.</div>
            ) : (
              <ul role="listbox">
                {filteredClients.map(client => {
                  const isSelected = client.id === value;
                  return (
                    <li key={client.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(client.id)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                          isSelected ? 'bg-indigo-500/20 text-primary' : 'text-muted hover:bg-white/10 hover:text-primary'
                        }`}
                      >
                        <span className="font-medium text-primary">{client.name}</span>
                        {client.displayId ? (
                          <span className="text-xs font-semibold text-muted/70">#{client.displayId}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
             </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


const OrderForm: React.FC<{
  value: OrderFormState;
  clients: Client[];
  products: Product[];
  onChange: (newState: OrderFormState) => void;
  onAlert: (title: string, message: string) => void;
  showDateField?: boolean;
  isCreateForm?: boolean;
}> = ({ value, clients, products, onChange, onAlert, showDateField = true, isCreateForm = false }) => {
  const [newItem, setNewItem] = useState<{ productId: string; selectedTierLabel: string; quantity: string; price: string }>({
    productId: '',
    selectedTierLabel: '',
    quantity: '',
    price: '',
  });
  const [paymentInputs, setPaymentInputs] = useState<{ cash: string; etransfer: string }>({ cash: '', etransfer: '' });
  const [hasManualPaymentEdit, setHasManualPaymentEdit] = useState(false);

  const availableProducts = useMemo(() => products.filter(product => !product.inactive && product.stock > 0), [products]);

  const clientOptions = useMemo(() => {
    const active = clients.filter(client => !client.inactive);
    if (value.clientId && !active.some(client => client.id === value.clientId)) {
      const current = clients.find(client => client.id === value.clientId);
      if (current) {
        return [current, ...active.filter(client => client.id !== current.id)];
      }
    }
    return active;
  }, [clients, value.clientId]);

  const selectedProduct = useMemo(() => {
    if (!newItem.productId) return null;
    return products.find(product => product.id === newItem.productId) || null;
  }, [products, newItem.productId]);

  const sortedProductTiers = useMemo(() => {
    if (!selectedProduct) return [] as ProductTier[];
    return [...(selectedProduct.tiers || [])]
      .filter(tier => tier.quantity > 0)
      .sort((a, b) => a.quantity - b.quantity);
  }, [selectedProduct]);

  const isCustomSelected = useMemo(() => {
    if (!selectedProduct) return false;
    if (sortedProductTiers.length === 0) return true;
    return newItem.selectedTierLabel === 'custom';
  }, [newItem.selectedTierLabel, selectedProduct, sortedProductTiers]);

  const computeCustomPrice = useCallback((quantity: number) => {
    if (!selectedProduct || !Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    const computed = calculateTieredPrice(selectedProduct.tiers, quantity, selectedProduct.costPerUnit);
    if (!Number.isFinite(computed) || computed <= 0) {
      return null;
    }

    return computed;
  }, [selectedProduct]);

  const groupedItems = useMemo(() => groupOrderItems(value.items, products), [value.items, products]);
  const selectedProductCounts = useMemo(() => {
    if (!selectedProduct) return {} as Record<string, number>;

    const counts: Record<string, number> = {};
    for (const item of value.items) {
      if (item.productId !== selectedProduct.id) continue;
      const product = products.find(p => p.id === item.productId);
      const unit = product?.type ?? '';
      const hasTierLabel = item.sizeLabel && item.sizeLabel.toLowerCase() !== 'custom';
      const normalizedQty = unit === 'g' ? item.quantity.toFixed(2) : String(Math.round(item.quantity));
      const sizeKey = hasTierLabel ? (item.sizeLabel as string) : `${normalizedQty}${unit}`;
      counts[sizeKey] = (counts[sizeKey] || 0) + 1;
    }
    return counts;
  }, [products, selectedProduct, value.items]);
  const customItemsCount = useMemo(() => {
    if (!selectedProduct) return 0;
    const tierLabels = new Set(sortedProductTiers.map(tier => tier.sizeLabel));
    let total = 0;
    for (const item of value.items) {
      if (item.productId !== selectedProduct.id) continue;
      const product = products.find(p => p.id === item.productId);
      const unit = product?.type ?? '';
      const hasTierLabel = item.sizeLabel && item.sizeLabel.toLowerCase() !== 'custom';
      const normalizedQty = unit === 'g' ? item.quantity.toFixed(2) : String(Math.round(item.quantity));
      const sizeKey = hasTierLabel ? (item.sizeLabel as string) : `${normalizedQty}${unit}`;
      if (!tierLabels.has(sizeKey)) {
        total += 1;
      }
    }
    return total;
  }, [products, selectedProduct, sortedProductTiers, value.items]);
  const itemsTotal = useMemo(() => value.items.reduce((sum, item) => sum + item.price, 0), [value.items]);
  const discountAmount = Number(value.discount.amount) || 0;
  const feesAmount = Number(value.fees.amount) || 0;
  const finalTotal = itemsTotal + feesAmount - discountAmount;

  const cashPaid = Number(value.paymentMethods.cash) || 0;
  const etransferPaid = Number(value.paymentMethods.etransfer) || 0;
  const amountPaid = cashPaid + etransferPaid;
  const balance = finalTotal - amountPaid;
  const amountDue = balance > 0 ? balance : 0;
  const changeDue = balance < 0 ? Math.abs(balance) : 0;
  const isBalanceDue = amountDue > 0;
  const displayedBalance = isBalanceDue ? amountDue : changeDue;
  const balanceColorClass = isBalanceDue ? 'text-red-400' : 'text-emerald-400';

  const moneyFormatter = useMemo(() => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }), []);
  const formatMoney = useCallback((value: number) => `$${moneyFormatter.format(Math.max(value, 0))}`, [moneyFormatter]);

  const formatQuantityNumber = useCallback((value: number) => {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    const fixed = Number.parseFloat(value.toFixed(2));
    return Number.isNaN(fixed) ? '' : fixed.toString();
  }, []);

  const formatQuantity = useCallback((quantity: number, type: Product['type']) => {
    const normalized = formatQuantityNumber(quantity);
    if (type === 'unit') {
      return normalized;
    }
    const suffix = type === 'g' ? 'g' : 'ml';
    return `${normalized}${suffix}`;
  }, [formatQuantityNumber]);

  const formatStock = useCallback((product: Product) => {
    if (product.type === 'g') {
      return `${product.stock.toFixed(2)} g`;
    }
    if (product.type === 'ml') {
      return `${Math.round(product.stock)} ml`;
    }
    return `${Math.round(product.stock)} units`;
  }, []);

  const customQuantityPreview = useMemo(() => {
    if (!selectedProduct) return null;
    const quantityValue = Number(newItem.quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) return null;
    return formatQuantity(quantityValue, selectedProduct.type);
  }, [formatQuantity, newItem.quantity, selectedProduct]);

  const customPricePreview = useMemo(() => {
    const parsed = Number(newItem.price);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return formatMoney(parsed);
  }, [formatMoney, newItem.price]);

  const applyProductDefaults = useCallback((product: Product) => {
    const sortedTiers = [...(product.tiers || [])]
      .filter(tier => tier.quantity > 0)
      .sort((a, b) => a.quantity - b.quantity);
    const firstTier = sortedTiers[0];

    if (firstTier) {
      setNewItem({
        productId: product.id,
        selectedTierLabel: firstTier.sizeLabel,
        quantity: '',
        price: '',
      });
    } else {
      setNewItem({
        productId: product.id,
        selectedTierLabel: 'custom',
        quantity: '',
        price: '',
      });
    }
  }, []);

  useEffect(() => {
    setPaymentInputs({
      cash: value.paymentMethods.cash ? String(value.paymentMethods.cash) : '',
      etransfer: value.paymentMethods.etransfer ? String(value.paymentMethods.etransfer) : '',
    });
  }, [value.paymentMethods.cash, value.paymentMethods.etransfer]);

  useEffect(() => {
    if (!isCreateForm || !hasManualPaymentEdit) return;

    const currentCash = Number(value.paymentMethods.cash) || 0;
    const currentEtransfer = Number(value.paymentMethods.etransfer) || 0;
    const hasNoPayments = currentCash === 0 && currentEtransfer === 0 && value.amountPaid === '';
    if (value.items.length === 0 && hasNoPayments) {
      setHasManualPaymentEdit(false);
    }
  }, [
    hasManualPaymentEdit,
    isCreateForm,
    value.amountPaid,
    value.items.length,
    value.paymentMethods.cash,
    value.paymentMethods.etransfer,
  ]);

  const addItemToOrder = useCallback((product: Product, quantity: number, price: number, sizeLabel?: string) => {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      onAlert('Invalid Quantity', 'Enter a quantity greater than zero.');
      return false;
    }

    if (!Number.isFinite(price) || price <= 0) {
      onAlert('Invalid Price', 'Enter a price greater than zero.');
      return false;
    }

    const currentQty = value.items
      .filter(item => item.productId === product.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    const nextTotal = currentQty + quantity;
    if (nextTotal > product.stock + 1e-6) {
      const suffix = product.type === 'unit' ? '' : ` ${product.type}`;
      onAlert('Insufficient Stock', `Cannot add that quantity. Only ${formatQuantityNumber(product.stock)}${suffix} available.`);
      return false;
    }

    const normalizedPrice = Math.round(price * 100) / 100;
    const nextItems = [
      ...value.items,
      {
        productId: product.id,
        quantity,
        price: normalizedPrice,
        sizeLabel: sizeLabel && sizeLabel.trim().length > 0 ? sizeLabel : undefined,
      },
    ];

    onChange({
      ...value,
      items: nextItems,
    });
    return true;
  }, [formatQuantityNumber, onAlert, onChange, value]);

  const handleProductChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const productId = event.target.value;
    const product = products.find(p => p.id === productId);
    if (!product) {
      setNewItem({ productId: '', selectedTierLabel: '', quantity: '', price: '' });
      return;
    }
    applyProductDefaults(product);
  };

  const handleTierClick = (tier: ProductTier) => {
    if (!selectedProduct) return;
    setNewItem(prev => ({
      ...prev,
      productId: selectedProduct.id,
      selectedTierLabel: tier.sizeLabel,
      quantity: '',
      price: '',
    }));
    addItemToOrder(selectedProduct, tier.quantity, tier.price, tier.sizeLabel);
  };

  const handleSelectCustomSize = () => {
    if (!selectedProduct) return;
    setNewItem(prev => ({
      productId: selectedProduct.id,
      selectedTierLabel: 'custom',
      quantity: prev.productId === selectedProduct.id ? prev.quantity : '',
      price: prev.productId === selectedProduct.id ? prev.price : '',
    }));
  };

  const handleNewItemManualChange = (field: 'quantity' | 'price', rawValue: string) => {
    if (rawValue !== '' && Number(rawValue) < 0) {
      return;
    }

    if (field === 'quantity') {
      const quantity = Number(rawValue);
      const shouldCompute = rawValue !== '' && Number.isFinite(quantity) && quantity > 0;
      const computed = shouldCompute ? computeCustomPrice(quantity) : null;

      setNewItem(prev => ({
        ...prev,
        productId: selectedProduct ? selectedProduct.id : prev.productId,
        quantity: rawValue,
        price: rawValue === ''
          ? ''
          : computed !== null
            ? String(computed)
            : prev.price,
        selectedTierLabel: 'custom',
      }));
      return;
    }

    setNewItem(prev => ({
      ...prev,
      [field]: rawValue,
      selectedTierLabel: 'custom',
    }));
  };

  const handleAddCustomItem = () => {
    if (!selectedProduct) {
      onAlert('Select Product', 'Choose a product before adding items.');
      return;
    }

    if (!newItem.quantity) {
      onAlert('Missing Quantity', 'Enter the quantity you want to add.');
      return;
    }

    if (!newItem.price) {
      onAlert('Missing Price', 'Enter the price for this quantity.');
      return;
    }

    const quantity = Number(newItem.quantity);
    const price = Number(newItem.price);

    const sizeLabel = formatQuantity(quantity, selectedProduct.type);
    const success = addItemToOrder(selectedProduct, quantity, price, sizeLabel);
    if (success) {
      setNewItem(prev => ({
        ...prev,
        quantity: '',
        price: '',
        selectedTierLabel: 'custom',
      }));
    }
  };

  const handleRemoveFromGroup = (productId: string, sizeKey: string) => {
    let removed = false;
    const nextItems = value.items.filter(item => {
      if (removed) return true;
      if (item.productId !== productId) return true;
      const product = products.find(p => p.id === productId);
      const unit = product?.type ?? '';
      const hasTierLabel = item.sizeLabel && item.sizeLabel.toLowerCase() !== 'custom';
      const normalizedQty = unit === 'g' ? item.quantity.toFixed(2) : String(Math.round(item.quantity));
      const identity = hasTierLabel ? (item.sizeLabel as string) : `${normalizedQty}${unit}`;
      if (identity === sizeKey) {
        removed = true;
        return false;
      }
      return true;
    });
    onChange({ ...value, items: nextItems });
  };

  const handlePaymentAmountChange = (method: 'cash' | 'etransfer', rawValue: string) => {
    const sanitized = rawValue.replace(/[^0-9.]/g, '');
    const numeric = sanitized === '' ? 0 : Math.max(0, Number(sanitized) || 0);

    const paymentMethods: PaymentMethods = {
      cash: method === 'cash' ? numeric : Number(value.paymentMethods.cash) || 0,
      etransfer: method === 'etransfer' ? numeric : Number(value.paymentMethods.etransfer) || 0,
    };
    const existingDueDate = value.paymentDueDate?.trim() || (value.paymentMethods.dueDate ?? '');
    if (existingDueDate) {
      paymentMethods.dueDate = existingDueDate;
    }
    const totalPaid = (paymentMethods.cash || 0) + (paymentMethods.etransfer || 0);

    setPaymentInputs(prev => ({ ...prev, [method]: sanitized }));
    if (!hasManualPaymentEdit) {
      setHasManualPaymentEdit(true);
    }
    onChange({
      ...value,
      paymentMethods,
      amountPaid: totalPaid ? String(totalPaid) : '',
    });
  };

  const handlePaymentDueDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    const trimmed = nextValue.trim();
    const nextPaymentMethods: PaymentMethods = {
      cash: Number(value.paymentMethods.cash) || 0,
      etransfer: Number(value.paymentMethods.etransfer) || 0,
    };
    if (trimmed) {
      nextPaymentMethods.dueDate = trimmed;
    }
    onChange({
      ...value,
      paymentDueDate: trimmed,
      paymentMethods: nextPaymentMethods,
    });
  };

  const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...value, notes: event.target.value });
  };

  const canAddCustomItem = Boolean(
    selectedProduct &&
    newItem.quantity &&
    newItem.price &&
    !Number.isNaN(Number(newItem.quantity)) &&
    Number(newItem.quantity) > 0 &&
    !Number.isNaN(Number(newItem.price)) &&
    Number(newItem.price) > 0,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormRow>
              <Select
                id="client"
                value={value.clientId}
                onChange={event => onChange({ ...value, clientId: event.target.value })}
                aria-label="Client"
              >
                <option value="" disabled>
                  Client
                </option>
                {clientOptions.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow>
              <Select id="product" value={newItem.productId} onChange={handleProductChange} aria-label="Product">
                <option value="" disabled>
                  Product
                </option>
                {availableProducts.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
              {selectedProduct && (
                <p className="text-xs text-muted">In stock: {formatStock(selectedProduct)}</p>
              )}
            </FormRow>
            {showDateField && (
              <FormRow className="sm:col-span-2">
                <Label htmlFor="date">Order Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={value.date}
                  onChange={event => onChange({ ...value, date: event.target.value })}
                />
              </FormRow>
            )}
          </div>

          {availableProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center text-sm text-muted">
              No items added yet.
            </div>
          ) : selectedProduct ? (
            <div className="space-y-4">
              {sortedProductTiers.length ? (
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
                  {sortedProductTiers.map(tier => {
                    const normalizedSize = formatQuantity(tier.quantity, selectedProduct.type);
                    const isSelected = newItem.selectedTierLabel === tier.sizeLabel;
                    const tierCount = selectedProductCounts[tier.sizeLabel] ?? selectedProductCounts[normalizedSize] ?? 0;
                    return (
                      <button
                        key={tier.sizeLabel}
                        type="button"
                        onClick={() => handleTierClick(tier)}
                        className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-center transition ${
                          isSelected
                            ? 'border-emerald-400/60 bg-emerald-500/15 text-primary shadow-[0_8px_20px_-14px_rgba(16,185,129,0.8)]'
                            : 'border-white/10 bg-black/20 text-muted hover:border-emerald-400/50 hover:text-primary hover:shadow-[0_10px_28px_-18px_rgba(16,185,129,0.6)]'
                        }`}
                      >
                        {tierCount > 0 && (
                          <span className="absolute -top-2 -right-2 inline-flex min-w-[28px] items-center justify-center rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white shadow-lg">
                            +{tierCount}
                          </span>
                        )}
                        <span className="text-base font-semibold text-primary leading-tight">{normalizedSize}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleSelectCustomSize}
                    className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-center transition ${
                      isCustomSelected
                        ? 'border-emerald-400/60 bg-emerald-500/15 text-primary shadow-[0_8px_20px_-14px_rgba(16,185,129,0.8)]'
                        : 'border-white/10 bg-black/20 text-muted hover:border-emerald-400/50 hover:text-primary hover:shadow-[0_10px_28px_-18px_rgba(16,185,129,0.6)]'
                    }`}
                  >
                    {customItemsCount > 0 && (
                      <span className="absolute -top-2 -right-2 inline-flex min-w-[28px] items-center justify-center rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white shadow-lg">
                        +{customItemsCount}
                      </span>
                    )}
                    <span className="text-base font-semibold text-primary leading-tight">Custom</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/20 bg-black/20 px-4 py-6 text-center text-sm text-muted">
                  This product has no preset sizes. Use the custom option below.
                </div>
              )}
            </div>
          ) : null}

          {selectedProduct && isCustomSelected && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-end gap-4">
                <FormRow className="flex-1 min-w-[160px]">
                  <Label htmlFor="custom-quantity">Quantity</Label>
                  <Input
                    id="custom-quantity"
                    type="number"
                    step="any"
                    min="0"
                    value={newItem.quantity}
                    onChange={event => handleNewItemManualChange('quantity', event.target.value)}
                  />
                </FormRow>
                <FormRow className="flex-1 min-w-[160px]">
                  <Label htmlFor="custom-price">Price</Label>
                  <Input
                    id="custom-price"
                    type="number"
                    step="any"
                    min="0"
                    startAdornment="$"
                    value={newItem.price}
                    onChange={event => handleNewItemManualChange('price', event.target.value)}
                  />
                </FormRow>
                <div className="flex h-full items-end">
                  <button
                    type="button"
                    onClick={handleAddCustomItem}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-400/60 bg-indigo-500/80 text-white shadow-[0_14px_30px_-18px_rgba(99,102,241,0.75)] transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10"
                    disabled={!canAddCustomItem}
                    aria-label="Add custom item"
                  >
                    <Check size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
            {groupedItems.length > 0 ? (
              <>
                <span className="text-xs uppercase tracking-wide text-muted">{value.items.length} {value.items.length === 1 ? 'item' : 'items'}</span>
                <div className="space-y-3">
                  {groupedItems.map(group => {
                    const product = products.find(p => p.id === group.productId);
                    const itemLabel = product?.name || 'Unknown product';
                    const quantityLabel = group.displayQty || '—';
                    const countLabel = `${group.count}`;
                    return (
                      <div
                        key={`${group.productId}|${group.sizeKey}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-primary"
                      >
                        <span className="truncate font-semibold" title={itemLabel}>
                          {itemLabel}
                        </span>
                        <span className="text-xs font-medium text-muted text-center" aria-label={`Quantity ${quantityLabel}`}>
                          {quantityLabel}
                        </span>
                        <span className="text-xs font-medium text-muted text-center" aria-label={`${countLabel} ${countLabel === '1' ? 'product' : 'products'}`}>
                          {countLabel}
                        </span>
                        <span className="font-semibold text-right">
                          {formatMoney(group.totalPrice)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromGroup(group.productId, group.sizeKey)}
                          className="ml-auto rounded-full border border-transparent p-2 text-muted transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">No items added yet.</p>
            )}
          </div>
        </div>

        {!isCreateForm && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
            <FormRow>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                value={value.notes}
                onChange={handleNotesChange}
                placeholder="Special instructions, delivery notes, etc."
              />
            </FormRow>
          </div>
        )}
      </section>

      <aside className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 self-start lg:sticky lg:top-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="cash"
            type="text"
            inputMode="decimal"
            startAdornment="$"
            placeholder="Cash"
            aria-label="Cash"
            value={paymentInputs.cash}
            onChange={event => handlePaymentAmountChange('cash', event.target.value)}
          />
          <Input
            id="etransfer"
            type="text"
            inputMode="decimal"
            startAdornment="$"
            placeholder="E-Transfer"
            aria-label="E-Transfer"
            value={paymentInputs.etransfer}
            onChange={event => handlePaymentAmountChange('etransfer', event.target.value)}
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-primary">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between font-semibold">
              <span>Order</span>
              <span>{formatMoney(finalTotal)}</span>
            </div>
            {amountPaid > 0 ? (
              <div className="flex items-center justify-between text-muted">
                <span>Payment</span>
                <span>{formatMoney(amountPaid)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between font-semibold">
              <span>Balance</span>
              <span className={balanceColorClass}>
                {formatMoney(displayedBalance)}
              </span>
            </div>
          </div>
        </div>
        {isBalanceDue && (
          <div className="space-y-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-amber-100">
              <AlertTriangle size={16} />
              <span>Payment due</span>
            </div>
            <FormRow>
              <Label htmlFor="payment-due-date">Due date</Label>
              <Input
                id="payment-due-date"
                type="date"
                value={value.paymentDueDate}
                onChange={handlePaymentDueDateChange}
                min={value.date || undefined}
              />
            </FormRow>
            {!value.paymentDueDate && (
              <p className="text-xs text-amber-100/80">
                Set a due date to get reminders until this balance is cleared.
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};

export const CreateOrderModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  products: Product[];
  onCreate: (order: Omit<Order, 'id' | 'total' | 'status'>) => void;
  onAlert: (title: string, message: string) => void;
}> = ({ isOpen, onClose, clients, products, onCreate, onAlert }) => {
  const getInitialState = (): OrderFormState => ({
    clientId: '',
    items: [],
    notes: '',
    date: new Date().toISOString().split('T')[0],
    paymentDueDate: '',
    amountPaid: '',
    paymentMethods: { cash: 0, etransfer: 0 },
    fees: { amount: '', description: ''},
    discount: { amount: '', description: ''},
  });

  const [savedDraft, setSavedDraft] = useLocalStorage<OrderFormState | null>('createOrderDraft', null);
  const [orderState, setOrderState] = useState<OrderFormState>(() => savedDraft ? { ...getInitialState(), ...savedDraft } : getInitialState());

  useEffect(() => {
    if (isOpen) {
      const nextState = savedDraft ? { ...getInitialState(), ...savedDraft } : getInitialState();
      setOrderState(nextState);
    }
  }, [isOpen, savedDraft]);

  const handleFormChange = useCallback((newState: OrderFormState) => {
    setOrderState(newState);
    setSavedDraft(newState);
  }, [setSavedDraft]);

  const handleCancel = () => {
    const initial = getInitialState();
    setOrderState(initial);
    setSavedDraft(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderState.clientId || orderState.items.length === 0) {
      onAlert("Invalid Order", "Please select a client and add at least one item.");
      return;
    }
    const trimmedDueDate = orderState.paymentDueDate?.trim();
    const paymentDueDate = trimmedDueDate ? trimmedDueDate : undefined;
    const paymentMethods: PaymentMethods = {
      cash: Number(orderState.paymentMethods.cash) || 0,
      etransfer: Number(orderState.paymentMethods.etransfer) || 0,
    };
    if (paymentDueDate) {
      paymentMethods.dueDate = paymentDueDate;
    }
    onCreate({
        clientId: orderState.clientId,
        items: orderState.items,
        notes: orderState.notes,
        date: orderState.date,
        paymentDueDate,
        amountPaid: Number(orderState.amountPaid) || 0,
        paymentMethods,
        fees: { amount: Number(orderState.fees.amount) || 0, description: orderState.fees.description },
        discount: { amount: Number(orderState.discount.amount) || 0, description: orderState.discount.description },
    });
    setSavedDraft(null);
    setOrderState(getInitialState());
  };
  
  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Order"
      size="lg"
      hideTitle
      actions={
        <button
          type="submit"
          form="create-order-form"
          className={modalConfirmButtonClass}
          aria-label="Create order"
        >
          <Check size={18} className={modalConfirmIconClass} />
        </button>
      }
    >
      <form id="create-order-form" onSubmit={handleSubmit}>
        <OrderForm 
          value={orderState}
          clients={clients}
          products={products}
          onChange={handleFormChange}
          onAlert={onAlert}
          isCreateForm
        />
      </form>
    </ModalWrapper>
  );
};

export const EditOrderModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  clients: Client[];
  products: Product[];
  onSave: (originalOrder: Order, updatedOrder: Omit<Order, 'id'>) => void;
  onDelete: () => void;
  onAlert: (title: string, message: string) => void;
}> = ({ isOpen, onClose, order, clients, products, onSave, onDelete, onAlert }) => {
  const getInitialState = (initialOrder: Order | null): OrderFormState => {
    const emptyState: OrderFormState = {
      clientId: '',
      items: [],
      notes: '',
      date: new Date().toISOString().split('T')[0],
      paymentDueDate: '',
      amountPaid: '',
      paymentMethods: { cash: 0, etransfer: 0 },
      fees: { amount: '', description: ''},
      discount: { amount: '', description: ''},
    };

    if (!initialOrder) {
      return emptyState;
    }

    const paid = Number(initialOrder.amountPaid) || 0;
    const src: any = initialOrder.paymentMethods || {};
    let pm: PaymentMethods = {
      cash: typeof src.cash === 'number' ? src.cash : 0,
      etransfer: typeof src.etransfer === 'number' ? src.etransfer : 0,
    };
    if ((pm.cash || 0) + (pm.etransfer || 0) === 0) {
      if (src.cash === true) pm.cash = paid;
      else if (src.etransfer === true) pm.etransfer = paid;
    }
    const dueDateFromMethods = typeof src.dueDate === 'string' ? src.dueDate : undefined;
    if (dueDateFromMethods) {
      pm = { ...pm, dueDate: dueDateFromMethods };
    }
    const sum = (pm.cash || 0) + (pm.etransfer || 0);
    return {
      clientId: initialOrder.clientId,
      items: initialOrder.items,
      notes: initialOrder.notes || '',
      date: initialOrder.date,
      paymentDueDate: initialOrder.paymentDueDate || dueDateFromMethods || '',
      amountPaid: sum ? String(sum) : String(initialOrder.amountPaid || ''),
      paymentMethods: pm,
      fees: { amount: String(initialOrder.fees?.amount || ''), description: initialOrder.fees?.description || '' },
      discount: { amount: String(initialOrder.discount?.amount || ''), description: initialOrder.discount?.description || '' },
    };
  };

  const [orderState, setOrderState] = useState<OrderFormState>(getInitialState(order));
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  useEffect(() => {
    if (order) {
      setOrderState(getInitialState(order));
    }
  }, [order]);

  useEffect(() => {
    if (!isOpen && isPrintPreviewOpen) {
      setIsPrintPreviewOpen(false);
    }
  }, [isOpen, isPrintPreviewOpen]);

  const itemsTotal = useMemo(() => orderState.items.reduce((sum: number, item: OrderItem) => sum + item.price, 0), [orderState.items]);
  const feesAmount = Number(orderState.fees.amount) || 0;
  const discountAmount = Number(orderState.discount.amount) || 0;
  const total = itemsTotal + feesAmount - discountAmount;
  const parsedAmountPaid = Number(orderState.amountPaid) || 0;
  const computedStatus: 'Draft' | 'Unpaid' | 'Completed' = parsedAmountPaid >= total ? 'Completed' : 'Unpaid';

  const buildStagedOrder = useCallback(() => {
    if (!order) return null;

    const trimmedDue = orderState.paymentDueDate?.trim() || '';
    const fallbackDue = typeof orderState.paymentMethods?.dueDate === 'string' ? orderState.paymentMethods.dueDate.trim() : '';
    const resolvedDue = computedStatus === 'Completed' ? '' : (trimmedDue || fallbackDue);
    const paymentMethods: PaymentMethods = {
      cash: Number(orderState.paymentMethods.cash) || 0,
      etransfer: Number(orderState.paymentMethods.etransfer) || 0,
    };
    if (resolvedDue) {
      paymentMethods.dueDate = resolvedDue;
    }

    return {
      ...order,
      clientId: orderState.clientId,
      items: orderState.items,
      notes: orderState.notes,
      date: orderState.date,
      paymentMethods,
      paymentDueDate: resolvedDue || undefined,
      total,
      status: computedStatus,
      amountPaid: parsedAmountPaid,
      fees: { amount: feesAmount, description: orderState.fees.description },
      discount: { amount: discountAmount, description: orderState.discount.description },
    };
  }, [order, orderState, total, computedStatus, parsedAmountPaid, feesAmount, discountAmount]);

  const stagedOrder = buildStagedOrder();

  const previewClient = useMemo(() => clients.find(client => client.id === orderState.clientId) || null, [clients, orderState.clientId]);
  const previewItems = useMemo(() => groupOrderItems(orderState.items, products), [orderState.items, products]);

  const handleOpenPreview = () => {
    if (!orderState.clientId) {
      onAlert('Missing Client', 'Select a client before printing the bill.');
      return;
    }
    if (orderState.items.length === 0) {
      onAlert('No Items', 'Add at least one item before printing the bill.');
      return;
    }
    setIsPrintPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPrintPreviewOpen(false);
  };

  const handleConfirmPrint = async () => {
    const snapshot = buildStagedOrder();
    if (!snapshot) return;
    try {
      await printOrderPdf(snapshot, clients, products, 'bill');
      setIsPrintPreviewOpen(false);
    } catch (_error) {
      onAlert('Print Failed', 'Unable to generate the PDF right now. Please try again.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const status: 'Draft' | 'Unpaid' | 'Completed' = computedStatus;
    const trimmedDue = orderState.paymentDueDate?.trim() || '';
    const fallbackDue = typeof orderState.paymentMethods?.dueDate === 'string' ? orderState.paymentMethods.dueDate.trim() : '';
    const resolvedDue = status === 'Completed' ? '' : (trimmedDue || fallbackDue);
    const paymentMethods: PaymentMethods = {
      cash: Number(orderState.paymentMethods.cash) || 0,
      etransfer: Number(orderState.paymentMethods.etransfer) || 0,
    };
    if (resolvedDue) {
      paymentMethods.dueDate = resolvedDue;
    }
    const updatedOrder = {
      clientId: orderState.clientId,
      items: orderState.items,
      notes: orderState.notes,
      date: orderState.date,
      paymentMethods,
      paymentDueDate: resolvedDue || undefined,
      total,
      status,
      amountPaid: parsedAmountPaid,
      fees: { amount: feesAmount, description: orderState.fees.description },
      discount: { amount: discountAmount, description: orderState.discount.description },
    };
    onSave(order, updatedOrder);
  };

  if (!order || !stagedOrder) return null;

  return (
    <>
      <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title={(() => {
          const orderLabel = formatEntityDisplayId('order', order.displayId);
          return orderLabel ? `Edit ${orderLabel}` : 'Edit Order';
        })()}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <OrderForm 
            value={orderState}
            clients={clients}
            products={products}
            onChange={setOrderState}
            onAlert={onAlert}
          />
          <FormActions>
            <DeleteButton onClick={onDelete} />
            <CancelButton onClick={onClose} />
            <button
              type="button"
              className="glass px-4 py-2 rounded-lg text-sm text-muted hover:text-primary hover:bg-white/10"
              onClick={handleOpenPreview}
            >
              Print Bill (PDF)
            </button>
            <button type="submit" className="gloss-btn">Save Changes</button>
          </FormActions>
        </form>
      </ModalWrapper>

      <ModalWrapper
        isOpen={isPrintPreviewOpen}
        onClose={handleClosePreview}
        title="Preview Bill"
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Client</p>
              <p className="mt-1 font-semibold text-primary">{previewClient?.name || 'Unknown Client'}</p>
              {previewClient?.displayId && (
                <p className="text-xs text-muted">{formatEntityDisplayId('client', previewClient.displayId, previewClient.id)}</p>
              )}
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Order</p>
              <p className="mt-1 font-semibold text-primary">{formatEntityDisplayId('order', stagedOrder.displayId, stagedOrder.id)}</p>
              <p className="text-xs text-muted">Date: {stagedOrder.date}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Status</p>
              <p className="mt-1 font-semibold text-primary">{stagedOrder.status}</p>
              <p className="text-xs text-muted">Total: ${Math.round(total).toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-primary">Items</h3>
            <div className="mt-3 space-y-2">
              {previewItems.length === 0 && (
                <p className="text-sm text-muted">No items added.</p>
              )}
              {previewItems.map(group => {
                const product = products.find(p => p.id === group.productId);
                const showSize = product?.type !== 'unit' || group.displayQty.toLowerCase() !== '1 unit';
                return (
                  <div key={`${group.productId}|${group.sizeKey}`} className="flex items-center justify-between gap-2 rounded-md bg-white/5 p-3">
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {group.count}x {product?.name || 'Unknown Product'}
                      </p>
                      {showSize && <p className="text-xs text-muted">{group.displayQty}</p>}
                    </div>
                    <p className="text-sm font-medium text-primary">${Math.round(group.totalPrice).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between text-muted">
              <span>Subtotal</span>
              <span>${Math.round(itemsTotal).toLocaleString()}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-muted">
                <span>Discount{stagedOrder.discount.description ? ` (${stagedOrder.discount.description})` : ''}</span>
                <span className="text-orange-400">-${Math.round(discountAmount).toLocaleString()}</span>
              </div>
            )}
            {feesAmount > 0 && (
              <div className="flex items-center justify-between text-muted">
                <span>Fees{stagedOrder.fees.description ? ` (${stagedOrder.fees.description})` : ''}</span>
                <span>+${Math.round(feesAmount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-2 text-base font-semibold text-primary">
              <span>Total</span>
              <span>${Math.round(total).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>Amount Paid</span>
              <span>${Math.round(parsedAmountPaid).toLocaleString()}</span>
            </div>
            {(orderState.paymentMethods.cash || 0) + (orderState.paymentMethods.etransfer || 0) > 0 && (
              <div className="text-xs text-muted">
                Payment Breakdown: 
                {orderState.paymentMethods.cash ? ` $${Math.round(orderState.paymentMethods.cash).toLocaleString()} cash` : ''}
                {orderState.paymentMethods.cash && orderState.paymentMethods.etransfer ? ' ·' : ''}
                {orderState.paymentMethods.etransfer ? ` $${Math.round(orderState.paymentMethods.etransfer).toLocaleString()} e-transfer` : ''}
              </div>
            )}
            {stagedOrder.notes && (
              <div className="border-t border-white/10 pt-2 text-xs text-muted">
                Notes: {stagedOrder.notes}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4">
            <button type="button" onClick={handleClosePreview} className="px-4 py-2 text-sm font-medium text-muted hover:text-primary">Cancel</button>
            <button type="button" onClick={handleConfirmPrint} className="gloss-btn">
              Confirm &amp; Print
            </button>
          </div>
        </div>
      </ModalWrapper>
    </>
  );
};

export const CreateClientModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (client: Omit<Client, 'id' | 'orders' | 'totalSpent' | 'displayId'>) => void;
}> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [etransfer, setEtransfer] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ name, email, phone, address, etransfer, notes });
    // Reset form
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setEtransfer('');
    setNotes('');
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Client"
      size="lg"
      hideTitle
      actions={
        <button
          type="submit"
          form="create-client-form"
          className={modalConfirmButtonClass}
          aria-label="Add client"
        >
          <Check size={18} className={modalConfirmIconClass} />
        </button>
      }
    >
      <form
        id="create-client-form"
        onSubmit={handleSubmit}
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]"
      >
        <section className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <FormRow className="sm:col-span-2">
                <Label htmlFor="client-name">Name</Label>
                <Input id="client-name" type="text" value={name} onChange={e => setName(e.target.value)} required />
              </FormRow>
              <FormRow>
                <Label htmlFor="client-phone">Phone</Label>
                <Input id="client-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
              </FormRow>
              <FormRow>
                <Label htmlFor="client-email">Email</Label>
                <Input id="client-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </FormRow>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <FormRow>
              <Label htmlFor="client-address">Address</Label>
              <Input id="client-address" type="text" value={address} onChange={e => setAddress(e.target.value)} />
            </FormRow>
          </div>
        </section>
        <aside className="space-y-6 self-start lg:sticky lg:top-0">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-6">
            <FormRow>
              <Label htmlFor="client-etransfer">E-Transfer Details</Label>
              <Input id="client-etransfer" type="text" value={etransfer} onChange={e => setEtransfer(e.target.value)} />
            </FormRow>
            <FormRow>
              <Label htmlFor="client-notes">Notes</Label>
              <Textarea id="client-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            </FormRow>
          </div>
        </aside>
      </form>
    </ModalWrapper>
  );
};

export const EditClientModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSave: (client: Client) => void;
  onDelete: () => void;
  isPrivateMode: boolean;
}> = ({ isOpen, onClose, client, onSave, onDelete, isPrivateMode }) => {
  const [clientData, setClientData] = useState<Partial<Client>>({});
  
  useEffect(() => {
    if (client) {
      setClientData(client);
    }
  }, [client]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setClientData({ ...clientData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(client) {
        onSave({ ...client, ...clientData });
    }
  };
  
  if (!client) return null;

  const clientLabel = formatEntityDisplayId('client', client.displayId, client.id);

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={isPrivateMode ? `Edit ${clientLabel}` : `Edit ${client.name}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormRow>
          <Label htmlFor="edit-client-name">Name</Label>
          <Input id="edit-client-name" name="name" type="text" value={clientData.name || ''} onChange={handleChange} required />
        </FormRow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormRow>
                <Label htmlFor="edit-client-phone">Phone</Label>
                <Input id="edit-client-phone" name="phone" type="tel" value={clientData.phone || ''} onChange={handleChange} />
            </FormRow>
            <FormRow>
                <Label htmlFor="edit-client-email">Email</Label>
                <Input id="edit-client-email" name="email" type="email" value={clientData.email || ''} onChange={handleChange} />
            </FormRow>
        </div>
        <FormRow>
            <Label htmlFor="edit-client-etransfer">E-Transfer Details</Label>
            <Input id="edit-client-etransfer" name="etransfer" type="text" value={clientData.etransfer || ''} onChange={handleChange} />
        </FormRow>
        <FormRow>
            <Label htmlFor="edit-client-address">Address</Label>
            <Input id="edit-client-address" name="address" type="text" value={clientData.address || ''} onChange={handleChange} />
        </FormRow>
        <FormRow>
            <Label htmlFor="edit-client-notes">Notes</Label>
            <Textarea id="edit-client-notes" name="notes" rows={3} value={clientData.notes || ''} onChange={handleChange} />
        </FormRow>
        <FormRow>
            <div className="flex items-center gap-2">
                <Checkbox id="edit-client-inactive" name="inactive" checked={clientData.inactive || false} onChange={e => setClientData({...clientData, inactive: e.target.checked })} />
                <Label htmlFor="edit-client-inactive">Mark as Inactive</Label>
            </div>
        </FormRow>
        <FormActions>
          <DeleteButton onClick={onDelete} />
          <CancelButton onClick={onClose} />
          <button type="submit" className="gloss-btn">Save Changes</button>
        </FormActions>
      </form>
    </ModalWrapper>
  );
};

export const ClientOrdersModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  client: (Client & { orders: number; totalSpent: number; balance: number; }) | null;
  orders: Order[];
  products: Product[];
  isPrivateMode: boolean;
  onEditClient: (client: Client) => void;
}> = ({ isOpen, onClose, client, orders, products, isPrivateMode, onEditClient }) => {
  if (!client) return null;

  return (
     <ModalWrapper
       isOpen={isOpen}
       onClose={onClose}
       title={isPrivateMode ? formatEntityDisplayId('client', client.displayId, client.id) : `${client.name} - ${formatEntityDisplayId('client', client.displayId, client.id)}`}
       size="lg"
       actions={
         <button
           onClick={() => onEditClient(client)}
           className="p-2 rounded-full text-muted hover:text-primary hover:bg-white/10 transition-colors"
           aria-label="Edit client"
         >
           <Pencil size={18} />
         </button>
       }
     >
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="glass p-3"><p className="text-xs text-muted">Total Orders</p><p className="font-bold text-lg text-primary">{client.orders}</p></div>
            <div className="glass p-3"><p className="text-xs text-muted">Total Spent</p><p className="font-bold text-lg text-primary">${Math.round(client.totalSpent).toLocaleString()}</p></div>
            <div className="glass p-3"><p className="text-xs text-muted">Balance</p><p className={`font-bold text-lg ${client.balance > 0 ? 'text-orange-400' : 'text-primary'}`}>${Math.round(client.balance).toLocaleString()}</p></div>
            <div className="glass p-3"><p className="text-xs text-muted">Avg. Order</p><p className="font-bold text-lg text-primary">${client.orders > 0 ? Math.round(client.totalSpent / client.orders).toLocaleString() : 0}</p></div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-2 -mr-2">
          {orders.map(order => {
            const amountPaid = order.amountPaid || 0;
            const balance = order.total - amountPaid;
            const outstanding = Math.max(0, Math.round(balance));
            const statusClass = balance <= 0
              ? 'status-paid'
              : (amountPaid > 0 ? 'status-unpaid-partial' : 'status-unpaid-none');
            const statusLabel = balance <= 0 ? 'Paid' : 'Unpaid';
            const statusTitle = balance <= 0
              ? 'Order is fully paid'
              : (amountPaid > 0
                ? (outstanding > 0 ? `$${outstanding.toLocaleString()} remaining` : 'Balance outstanding')
                : 'No payment received yet');

            return (
              <div key={order.id} className="glass p-4 text-sm">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="font-bold text-primary">{formatEntityDisplayId('order', order.displayId, 'Order')}</p>
                          <p className="text-xs text-muted mt-1">{order.date}</p>
                          <p className={`status-badge text-xs mt-2 ${statusClass}`} title={statusTitle}>{statusLabel}</p>
                      </div>
                      <p className="font-semibold text-lg text-primary">${Math.round(order.total).toLocaleString()}</p>
                  </div>
                <div className="mt-2 text-xs text-muted">
                    {groupOrderItems(order.items, products).map(group => {
                        const product = products.find(p => p.id === group.productId);
                        const name = isPrivateMode
                          ? (product ? formatEntityDisplayId('product', product.displayId, product.id) : 'Unknown')
                          : (product?.name ?? 'Unknown');
                        const multiplier = group.count > 1 ? ` x${group.count}` : '';
                        return (
                          <div key={`${group.productId}|${group.sizeKey}`}>
                            {name} - {group.displayQty}{multiplier} - ${Math.round(group.totalPrice).toLocaleString()}
                          </div>
                        );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ModalWrapper>
  );
};

export const OrderDetailsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  client: Client | null;
  products: Product[];
  isPrivateMode: boolean;
  onEditOrder: (order: Order) => void;
}> = ({ isOpen, onClose, order, client, products, isPrivateMode, onEditOrder }) => {
  const groupedItems = useMemo(() => order ? groupOrderItems(order.items, products) : [], [order, products]);

  if (!order) return null;

  const orderIdLabel = formatEntityDisplayId('order', order.displayId, order.id);
  const clientLabel = client
    ? (isPrivateMode ? formatEntityDisplayId('client', client.displayId, client.id) : client.name)
    : 'Unknown Client';

  const balance = order.total - (order.amountPaid || 0);
  const balanceClass = balance > 0 ? 'text-orange-400' : balance < 0 ? 'text-cyan-400' : 'text-primary';
  const amountPaid = order.amountPaid || 0;

  const paymentMethods = order.paymentMethods || {};
  const cashAmount = typeof paymentMethods.cash === 'number'
    ? paymentMethods.cash
    : paymentMethods.cash
      ? amountPaid
      : 0;
  const etransferAmount = typeof paymentMethods.etransfer === 'number'
    ? paymentMethods.etransfer
    : paymentMethods.etransfer
      ? amountPaid
      : 0;

  const paymentBreakdown: string[] = [];
  if (cashAmount > 0) paymentBreakdown.push(`$${Math.round(cashAmount).toLocaleString()} cash`);
  if (etransferAmount > 0) paymentBreakdown.push(`$${Math.round(etransferAmount).toLocaleString()} e-transfer`);

  const discountAmount = order.discount?.amount || 0;
  const feesAmount = order.fees?.amount || 0;
  const notes = order.notes?.trim();
  const dueDateStr = order.paymentDueDate || (typeof paymentMethods.dueDate === 'string' ? paymentMethods.dueDate : '');
  const outstandingAmount = Math.max(0, Math.round(balance));
  const dueDetails = (() => {
    if (outstandingAmount <= 0) return null;
    if (!dueDateStr) {
      return {
        label: 'Due date not set',
        description: `${outstandingAmount ? `$${outstandingAmount.toLocaleString()} outstanding • ` : ''}Add a due date to track this balance.`
          .trim(),
        className: 'text-amber-300',
      } as const;
    }
    const dueDate = new Date(`${dueDateStr}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) {
      return {
        label: 'Due date unavailable',
        description: `${outstandingAmount ? `$${outstandingAmount.toLocaleString()} outstanding` : ''}`.trim(),
        className: 'text-muted',
      } as const;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const formattedDate = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (diff < 0) {
      const daysLate = Math.abs(diff);
      return {
        label: 'Overdue',
        description: `$${outstandingAmount.toLocaleString()} outstanding • ${daysLate} day${daysLate === 1 ? '' : 's'} late (was due ${formattedDate})`,
        className: 'text-red-300',
      } as const;
    }
    if (diff === 0) {
      return {
        label: 'Due today',
        description: `$${outstandingAmount.toLocaleString()} outstanding • Due ${formattedDate}`,
        className: 'text-amber-300',
      } as const;
    }
    const label = diff === 1 ? 'Due in 1 day' : `Due in ${diff} days`;
    const className = diff <= 3 ? 'text-amber-300' : 'text-emerald-300';
    return {
      label,
      description: `$${outstandingAmount.toLocaleString()} outstanding • Due ${formattedDate}`,
      className,
    } as const;
  })();

  const statusPresentation = (() => {
    const outstanding = Math.max(0, Math.round(balance));

    if (balance <= 0) {
      return {
        className: 'status-paid',
        label: 'Paid',
        tooltip: 'Order is fully paid',
      } as const;
    }

    if (amountPaid > 0) {
      return {
        className: 'status-unpaid-partial',
        label: 'Unpaid',
        tooltip: outstanding > 0 ? `$${outstanding.toLocaleString()} remaining` : 'Balance outstanding',
      } as const;
    }

    return {
      className: 'status-unpaid-none',
      label: 'Unpaid',
      tooltip: 'No payment received yet',
    } as const;
  })();

  const formatCurrency = (value: number) => {
    const rounded = Math.round(value);
    const formatted = Math.abs(rounded).toLocaleString();
    return value < 0 ? `($${formatted})` : `$${formatted}`;
  };

  const summaryRows: Array<{ key: string; label: string; value: number; note?: string | null; emphasis?: boolean }> = [
    { key: 'total', label: 'Total', value: order.total }
  ];

  if (amountPaid > 0) {
    summaryRows.push({
      key: 'payments',
      label: 'Payments Received',
      value: -amountPaid,
      note: paymentBreakdown.length > 0 ? paymentBreakdown.join(' · ') : null,
    });
  }

  if (discountAmount > 0) {
    summaryRows.push({
      key: 'discount',
      label: 'Discounts',
      value: -discountAmount,
      note: order.discount?.description || null,
    });
  }

  if (feesAmount > 0) {
    summaryRows.push({
      key: 'fees',
      label: 'Fees',
      value: feesAmount,
      note: order.fees?.description || null,
    });
  }

  summaryRows.push({ key: 'balance', label: 'Balance Due', value: balance, emphasis: true });

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={orderIdLabel}
      size="lg"
      actions={
        <button
          onClick={() => onEditOrder(order)}
          className="p-2 rounded-full text-muted hover:text-primary hover:bg-white/10 transition-colors"
          aria-label="Edit order"
        >
          <Pencil size={18} />
        </button>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Date</p>
            <p className="mt-1 text-lg font-semibold text-primary">{order.date}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Client</p>
            <p className="mt-1 text-lg font-semibold text-primary">{clientLabel}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Status</p>
            <span className={`status-badge mt-2 inline-flex ${statusPresentation.className}`} title={statusPresentation.tooltip}>{statusPresentation.label}</span>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Payment Due</p>
            {dueDetails ? (
              <>
                <p className={`mt-1 text-lg font-semibold ${dueDetails.className}`}>{dueDetails.label}</p>
                <p className="mt-1 text-xs text-muted">{dueDetails.description}</p>
              </>
            ) : (
              <p className="mt-1 text-lg font-semibold text-emerald-300">Paid in full</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-primary">Items</h3>
          <div className="mt-3 space-y-2">
            {groupedItems.length === 0 && (
              <p className="text-sm text-muted">No items recorded for this order.</p>
            )}
            {groupedItems.map(group => {
              const product = products.find(p => p.id === group.productId);
              const name = isPrivateMode
                ? (product ? formatEntityDisplayId('product', product.displayId, product.id) : 'Unknown Product')
                : product?.name || 'Unknown Product';
              const multiplier = group.count > 1 ? ` x${group.count}` : '';
              return (
                <div key={`${group.productId}|${group.sizeKey}`} className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-primary">{name}{multiplier}</p>
                    <p className="text-xs text-muted">{group.displayQty}</p>
                  </div>
                  <p className="text-sm font-medium text-primary">${Math.round(group.totalPrice).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-primary">Account Summary</h3>
          <div className="mt-3 rounded-lg border border-white/10 overflow-hidden text-sm">
            <div className="grid grid-cols-2 bg-white/10 px-3 py-2 text-xs uppercase tracking-wide text-muted">
              <span>Entry</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-white/10">
              {summaryRows.map(row => {
                const amountClass = row.emphasis
                  ? balanceClass
                  : row.value < 0
                    ? 'text-emerald-400'
                    : 'text-primary';
                return (
                  <div key={row.key} className={`flex flex-col gap-1 px-3 py-2 ${row.emphasis ? 'bg-white/5' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted">{row.label}</span>
                      <span className={`font-mono font-semibold ${amountClass}`}>{formatCurrency(row.value)}</span>
                    </div>
                    {row.note && (
                      <p className="text-xs text-muted text-right">{row.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {notes && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-primary">Notes</h3>
            <p className="mt-2 text-sm text-muted whitespace-pre-wrap">{notes}</p>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

type TierFormState = { quantity: string; price: string; };

const formatTierLabel = (quantity: number, type: Product['type']) => {
  if (!Number.isFinite(quantity) || quantity <= 0) return '';
  const rounded = Number.isInteger(quantity) ? quantity : Number.parseFloat(quantity.toFixed(2));
  if (!Number.isFinite(rounded)) return '';
  const normalized = rounded.toString();
  if (type === 'unit') {
    return normalized;
  }
  const suffix = type === 'g' ? 'g' : 'ml';
  return `${normalized}${suffix}`;
};

export const CreateProductModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: Omit<Product, 'id'>) => void;
}> = ({ isOpen, onClose, onAdd }) => {
    const getInitialState = () => ({
        name: '', 
        type: 'g' as 'g' | 'ml' | 'unit', 
        stock: '', 
        costPerUnit: '', 
        tiers: [] as TierFormState[]
    });

  const [productData, setProductData] = useState(getInitialState());

  useEffect(() => {
    if(isOpen) {
        setProductData(getInitialState());
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProductData(prev => ({ ...prev, [name]: value }));
  };

  const handleTierChange = (index: number, field: keyof TierFormState, value: string) => {
    const newTiers = [...productData.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setProductData(prev => ({ ...prev, tiers: newTiers }));
  };

  const addTier = () => {
    setProductData(prev => ({ ...prev, tiers: [...prev.tiers, { quantity: '', price: '' }] }));
  };
  
  const removeTier = (index: number) => {
    setProductData(prev => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== index) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mappedTiers = productData.tiers
      .map(tier => {
        const quantityValue = Number.parseFloat(tier.quantity);
        const priceValue = Number.parseFloat(tier.price);
        const normalizedQuantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 0;
        const normalizedPrice = Number.isFinite(priceValue) ? priceValue : 0;
        const sizeLabel = formatTierLabel(normalizedQuantity, productData.type);
        return {
          sizeLabel,
          quantity: normalizedQuantity,
          price: normalizedPrice,
        };
      })
      .filter(tier => tier.quantity > 0);
    onAdd({
      name: productData.name,
      type: productData.type,
      stock: Number.parseFloat(productData.stock) || 0,
      increment: 1,
      costPerUnit: Math.round((Number.parseFloat(productData.costPerUnit) || 0) * 100) / 100,
      tiers: mappedTiers,
    });
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Product"
      size="lg"
      hideTitle
      actions={
        <button
          type="submit"
          form="create-product-form"
          className={modalConfirmButtonClass}
          aria-label="Add product"
        >
          <Check size={18} className={modalConfirmIconClass} />
        </button>
      }
    >
      <form id="create-product-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormRow>
                <Label htmlFor="product-name">Product Name</Label>
                <Input id="product-name" name="name" type="text" value={productData.name} onChange={handleChange} required />
            </FormRow>
             <FormRow>
                <Label htmlFor="product-type">Unit Type</Label>
                <Select id="product-type" name="type" value={productData.type} onChange={handleChange}>
                    <option value="g">Grams (g)</option>
                    <option value="ml">Milliliters (mL)</option>
                    <option value="unit">Units</option>
                </Select>
            </FormRow>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormRow>
                <Label htmlFor="product-stock">Initial Stock</Label>
                <Input id="product-stock" name="stock" type="text" inputMode="decimal" value={productData.stock} onChange={handleChange} />
            </FormRow>
            <FormRow>
                <Label htmlFor="product-costPerUnit">Cost Per Unit</Label>
                <Input id="product-costPerUnit" name="costPerUnit" type="text" inputMode="decimal" value={productData.costPerUnit} onChange={handleChange} startAdornment="$" />
            </FormRow>
        </div>
        <div>
            <h3 className="text-primary font-semibold mb-2">Pricing Tiers</h3>
            <div className="space-y-2">
                {productData.tiers.map((tier, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <Input type="text" inputMode="decimal" placeholder="Qty" value={tier.quantity} onChange={e => handleTierChange(index, 'quantity', e.target.value)} className="col-span-5" />
                        <Input type="text" inputMode="decimal" placeholder="Price" value={tier.price} onChange={e => handleTierChange(index, 'price', e.target.value)} className="col-span-6" startAdornment="$" />
                        <button type="button" onClick={() => removeTier(index)} className="col-span-1 text-muted hover:text-purple-400 p-2"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={addTier} className="mt-4 text-indigo-400 font-semibold text-sm hover:text-indigo-300 flex items-center gap-1"><Plus size={14} /> Add Tier</button>
        </div>
      </form>
    </ModalWrapper>
  );
};

interface ProductFormState {
    id: string;
    name: string;
    type: 'g' | 'ml' | 'unit';
    stock: string;
    costPerUnit: string;
    tiers: { quantity: string; price: string; }[];
    inactive?: boolean;
    lastOrdered?: string;
}

export const EditProductModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSave: (product: Product) => void;
  onDelete: () => void;
  isDeletable: boolean;
  isPrivateMode: boolean;
}> = ({ isOpen, onClose, product, onSave, onDelete, isDeletable, isPrivateMode }) => {
  const [productData, setProductData] = useState<ProductFormState | null>(null);

  useEffect(() => {
    if (product) {
        setProductData({
            id: product.id,
            name: product.name,
            type: product.type,
            stock: String(product.stock),
            costPerUnit: String(product.costPerUnit),
            tiers: product.tiers.map(t => ({
                quantity: String(t.quantity),
                price: String(t.price)
            })),
            inactive: product.inactive,
            lastOrdered: product.lastOrdered
        });
    }
  }, [product]);

  if (!productData) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProductData(prev => prev ? ({ ...prev, [name]: value }) : null);
  };

  const handleTierChange = (index: number, field: keyof TierFormState, value: string) => {
    if (!productData) return;
    const newTiers = [...productData.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setProductData({ ...productData, tiers: newTiers });
  };

  const addTier = () => {
    if (!productData) return;
    setProductData({ ...productData, tiers: [...productData.tiers, { quantity: '', price: '' }] });
  };
  
  const removeTier = (index: number) => {
     if (!productData) return;
    setProductData({ ...productData, tiers: productData.tiers.filter((_, i) => i !== index) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productData && product) {
      const numericStock = Number.parseFloat(productData.stock) || 0;
      const computedTiers = productData.tiers
        .map(t => {
          const quantityValue = Number.parseFloat(t.quantity);
          const priceValue = Number.parseFloat(t.price);
          const normalizedQuantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 0;
          const normalizedPrice = Number.isFinite(priceValue) ? priceValue : 0;
          const sizeLabel = formatTierLabel(normalizedQuantity, productData.type);
          return {
            sizeLabel,
            quantity: normalizedQuantity,
            price: normalizedPrice,
          };
        })
        .filter(tier => tier.quantity > 0);
      onSave({
        ...product,
        name: productData.name,
        type: productData.type,
        stock: numericStock,
        increment: product.increment ?? 1,
        costPerUnit: Math.round((Number.parseFloat(productData.costPerUnit) || 0) * 100) / 100,
        tiers: computedTiers,
        inactive: numericStock <= 0,
      });
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={isPrivateMode ? `Edit Product ${product?.id}` : `Edit ${product?.name}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormRow>
                <Label htmlFor="edit-product-name">Product Name</Label>
                <Input id="edit-product-name" name="name" type="text" value={productData.name} onChange={handleChange} required />
            </FormRow>
             <FormRow>
                <Label htmlFor="edit-product-type">Unit Type</Label>
                <Select id="edit-product-type" name="type" value={productData.type} onChange={handleChange}>
                    <option value="g">Grams (g)</option>
                    <option value="ml">Milliliters (mL)</option>
                    <option value="unit">Units</option>
                </Select>
            </FormRow>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormRow>
                <Label htmlFor="edit-product-stock">Current Stock</Label>
                <Input id="edit-product-stock" name="stock" type="text" inputMode="decimal" value={productData.stock} onChange={handleChange} />
            </FormRow>
            <FormRow>
                <Label htmlFor="edit-product-costPerUnit">Cost Per Unit</Label>
                <Input id="edit-product-costPerUnit" name="costPerUnit" type="text" inputMode="decimal" value={productData.costPerUnit} onChange={handleChange} startAdornment="$" />
            </FormRow>
        </div>
        <div>
            <h3 className="text-primary font-semibold mb-2">Pricing Tiers</h3>
            <div className="space-y-2">
                {productData.tiers.map((tier, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <Input type="text" inputMode="decimal" placeholder="Qty" value={tier.quantity} onChange={e => handleTierChange(index, 'quantity', e.target.value)} className="col-span-5" />
                        <Input type="text" inputMode="decimal" placeholder="Price" value={tier.price} onChange={e => handleTierChange(index, 'price', e.target.value)} className="col-span-6" startAdornment="$" />
                        <button type="button" onClick={() => removeTier(index)} className="col-span-1 text-muted hover:text-purple-400 p-2"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={addTier} className="mt-4 text-indigo-400 font-semibold text-sm hover:text-indigo-300 flex items-center gap-1"><Plus size={14} /> Add Tier</button>
        </div>
        <p className="text-xs text-muted">Status updates automatically when stock hits zero.</p>
        <FormActions>
          {isDeletable ? <DeleteButton onClick={onDelete} /> : <div title="Cannot delete product with past orders"><DeleteButton onClick={() => {}} /></div>}
          <CancelButton onClick={onClose} />
          <button type="submit" className="gloss-btn">Save Changes</button>
        </FormActions>
      </form>
    </ModalWrapper>
  );
};

export const AddStockModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onUpdateStock: (productId: string, amount: number, purchaseCost: number) => void;
  isPrivateMode: boolean;
}> = ({ isOpen, onClose, product, onUpdateStock, isPrivateMode }) => {
  const [amount, setAmount] = useState<string>('');
  const [purchaseCost, setPurchaseCost] = useState<string>('');
  
  useEffect(() => {
    if (isOpen) {
        setAmount('');
        setPurchaseCost('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (product) {
      onUpdateStock(product.id, parseFloat(amount) || 0, parseFloat(purchaseCost) || 0);
    }
  };
  
  if (!product) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={isPrivateMode ? `Update Stock for ${product.id}` : `Update Stock for ${product.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-muted">Current Stock: {product.stock.toFixed(2)}{product.type}</p>
        <FormRow>
          <Label htmlFor="stock-amount">Amount to Add/Remove</Label>
          <Input id="stock-amount" type="number" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Use negative to remove" required />
        </FormRow>
        <FormRow>
          <Label htmlFor="purchase-cost">Total Purchase Cost (Optional)</Label>
          <Input id="purchase-cost" type="number" step="0.01" value={purchaseCost} onChange={e => setPurchaseCost(e.target.value)} startAdornment="$" />
           <p className="text-xs text-muted">If adding stock, entering a cost will auto-create an expense and update the product's average cost.</p>
        </FormRow>
        <FormActions>
          <CancelButton onClick={onClose} />
          <button type="submit" className="gloss-btn">Update Stock</button>
        </FormActions>
      </form>
    </ModalWrapper>
  );
};

export const CreateExpenseModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (expense: Omit<Expense, 'id'>) => void;
  expenseCategories: string[];
}> = ({ isOpen, onClose, onAdd, expenseCategories }) => {
    const getInitialState = () => ({ date: new Date().toISOString().split('T')[0], description: '', amount: '', category: '', notes: '' });
    const [expenseData, setExpenseData] = useState(getInitialState());

    useEffect(() => {
        if (isOpen) {
            setExpenseData(getInitialState());
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd({ ...expenseData, amount: parseFloat(expenseData.amount) || 0 });
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title="Add New Expense"
            size="md"
            hideTitle
            actions={
              <button
                type="submit"
                form="create-expense-form"
                className={modalConfirmButtonClass}
                aria-label="Add expense"
              >
                <Check size={18} className={modalConfirmIconClass} />
              </button>
            }
        >
            <form id="create-expense-form" onSubmit={handleSubmit} className="space-y-6">
                <FormRow>
                    <Label htmlFor="expense-description">Description</Label>
                    <Input id="expense-description" type="text" value={expenseData.description} onChange={e => setExpenseData(prev => ({...prev, description: e.target.value}))} required />
                </FormRow>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormRow>
                        <Label htmlFor="expense-amount">Amount</Label>
                        <Input id="expense-amount" type="number" step="0.01" value={expenseData.amount} onChange={e => setExpenseData(prev => ({...prev, amount: e.target.value}))} startAdornment="$" required />
                    </FormRow>
                    <FormRow>
                        <Label htmlFor="expense-date">Date</Label>
                        <Input id="expense-date" type="date" value={expenseData.date} onChange={e => setExpenseData(prev => ({...prev, date: e.target.value}))} required />
                    </FormRow>
                </div>
                <FormRow>
                    <Label htmlFor="expense-category">Category</Label>
                    <Input id="expense-category" type="text" value={expenseData.category} onChange={e => setExpenseData(prev => ({...prev, category: e.target.value}))} list="expense-categories" />
                    <datalist id="expense-categories">
                        {expenseCategories.map(cat => <option key={cat} value={cat} />)}
                    </datalist>
                </FormRow>
                <FormRow>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="expense-notes">Notes</Label>
                      <span className="text-[11px] text-muted">{expenseData.date}</span>
                    </div>
                    <Textarea id="expense-notes" rows={3} value={expenseData.notes} onChange={e => setExpenseData(prev => ({...prev, notes: e.target.value}))} />
                </FormRow>
            </form>
        </ModalWrapper>
    );
};

export const EditExpenseModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  onSave: (expense: Expense) => void;
  onDelete: () => void;
  expenseCategories: string[];
}> = ({ isOpen, onClose, expense, onSave, onDelete, expenseCategories }) => {
  const [expenseData, setExpenseData] = useState<Partial<Expense>>({});

  useEffect(() => {
    if (expense) {
      setExpenseData(expense);
    }
  }, [expense]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setExpenseData({ ...expenseData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(expense) {
        const dataToSave = {
            ...expense, 
            ...expenseData,
            amount: parseFloat(String(expenseData.amount)) || 0
        };
        onSave(dataToSave);
    }
  };
  
  if (!expense) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Edit Expense" size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormRow>
            <Label htmlFor="edit-expense-description">Description</Label>
            <Input id="edit-expense-description" name="description" type="text" value={expenseData.description || ''} onChange={handleChange} required />
        </FormRow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormRow>
                <Label htmlFor="edit-expense-amount">Amount</Label>
                <Input id="edit-expense-amount" name="amount" type="number" step="0.01" value={expenseData.amount || ''} onChange={handleChange} startAdornment="$" required />
            </FormRow>
            <FormRow>
                <Label htmlFor="edit-expense-date">Date</Label>
                <Input id="edit-expense-date" name="date" type="date" value={expenseData.date || ''} onChange={handleChange} required />
            </FormRow>
        </div>
        <FormRow>
            <Label htmlFor="edit-expense-category">Category</Label>
            <Input id="edit-expense-category" name="category" type="text" value={expenseData.category || ''} onChange={handleChange} list="edit-expense-categories" />
            <datalist id="edit-expense-categories">
                {expenseCategories.map(cat => <option key={cat} value={cat} />)}
            </datalist>
        </FormRow>
        <FormRow>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-expense-notes">Notes</Label>
              <span className="text-[11px] text-muted">{expenseData.date || ''}</span>
            </div>
            <Textarea id="edit-expense-notes" name="notes" rows={3} value={expenseData.notes || ''} onChange={handleChange} />
        </FormRow>
        <FormActions>
          <DeleteButton onClick={onDelete} />
          <CancelButton onClick={onClose} />
          <button type="submit" className="gloss-btn">Save Changes</button>
        </FormActions>
      </form>
    </ModalWrapper>
  );
};

export const LogDetailsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  logEntry: LogEntry | null;
}> = ({ isOpen, onClose, logEntry }) => {
  if (!logEntry) return null;
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Log Details" size="md">
      <div className="space-y-4 text-sm">
        <div><span className="font-semibold text-muted">Timestamp:</span> <span className="text-primary">{new Date(logEntry.timestamp).toLocaleString()}</span></div>
        <div><span className="font-semibold text-muted">User:</span> <span className="text-primary">{logEntry.user}</span></div>
        <div><span className="font-semibold text-muted">Action:</span> <span className="text-primary">{logEntry.action}</span></div>
        <div><span className="font-semibold text-muted">Details:</span></div>
        <pre className="bg-white/5 p-4 rounded-lg text-xs text-primary overflow-x-auto">
          <code>{JSON.stringify(logEntry.details, null, 2)}</code>
        </pre>
      </div>
    </ModalWrapper>
  );
};

export const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
          <AlertTriangle className="h-6 w-6 text-purple-400" aria-hidden="true" />
        </div>
        <p className="mt-4 text-primary">{message}</p>
      </div>
      <div className="mt-6 flex justify-center gap-4">
        <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-semibold text-muted hover:text-primary">Cancel</button>
        <button type="button" onClick={onConfirm} className="gloss-btn gloss-btn-danger">Confirm</button>
      </div>
    </ModalWrapper>
  );
};

export const AlertModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}> = ({ isOpen, onClose, title, message }) => {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
          <Info className="h-6 w-6 text-indigo-400" aria-hidden="true" />
        </div>
        <p className="mt-4 text-primary">{message}</p>
      </div>
      <div className="mt-6 flex justify-center">
        <button type="button" onClick={onClose} className="gloss-btn">OK</button>
      </div>
    </ModalWrapper>
  );
};

export const CalculatorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [input, setInput] = useState('');

  const handlePercent = () => {
    if (input === '' || input === 'Error') return;
    try {
        const parts = input.split(/([+\-*/])/);
        if (parts[parts.length - 1] === '') return; // trailing operator

        const lastNumberStr = parts.pop() || '';
        const lastNumber = parseFloat(lastNumberStr);

        if (isNaN(lastNumber)) return;

        let percentPart;
        if (parts.length > 0) {
            const operator = parts[parts.length-1];
            if (operator === '+' || operator === '-') {
                const baseExpression = parts.slice(0,-1).join('');
                const baseValue = Function('"use strict";return (' + (baseExpression || '0') + ')')();
                percentPart = baseValue * (lastNumber / 100);
            } else {
                percentPart = lastNumber / 100;
            }
        } else {
            percentPart = lastNumber / 100;
        }
        setInput(parts.join('') + String(percentPart));
    } catch (error) {
        setInput('Error');
    }
  };

  const handleButtonClick = (value: string) => {
    if (value === 'C') {
      setInput('');
    } else if (value === '=') {
      try {
        if (input === '' || input === 'Error') return;
        const result = Function('"use strict";return (' + input + ')')();
        setInput(String(result));
      } catch (error) {
        setInput('Error');
      }
    } else if (value === '←') {
      setInput(prev => prev.slice(0, -1));
    } else if (value === '%') {
      handlePercent();
    }
    else {
      if (input === 'Error') {
          setInput(value);
      } else {
          setInput(prev => prev + value);
      }
    }
  };

  const getButtonClass = (btn: string) => {
    const baseClass = `p-4 text-xl font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50`;
    if (btn === 'C' || btn === '←' || btn === '%') {
      return `${baseClass} bg-white/10 text-muted hover:bg-white/20`;
    }
    return `${baseClass} bg-white/5 text-primary hover:bg-white/10`;
  };
  
  const Button = ({ value, label = value, className = '' }: { value: string; label?: string; className?: string }) => (
    <button onClick={() => handleButtonClick(value)} className={`${getButtonClass(value)} ${className}`}>
        {label}
    </button>
  );

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Calculator" size="sm">
      <div className="space-y-4">
        <div className="bg-white/5 p-4 rounded-lg text-right text-3xl font-mono text-primary break-all h-20 flex items-center justify-end">{input || '0'}</div>
        <div className="grid grid-cols-4 gap-2">
            <Button value="C" />
            <Button value="←" />
            <Button value="%" />
            <Button value="/" />
            
            <Button value="7" />
            <Button value="8" />
            <Button value="9" />
            <Button value="*" label="X" />

            <Button value="4" />
            <Button value="5" />
            <Button value="6" />
            <Button value="-" />

            <Button value="1" />
            <Button value="2" />
            <Button value="3" />
            <Button value="+" />
            
            <Button value="0" className="col-span-2" />
            <Button value="." />
            <Button value="=" />
        </div>
      </div>
    </ModalWrapper>
  );
};

// New: Modal to select payment method when marking an order as paid
export const MarkPaidModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: 'cash' | 'etransfer', amount: number) => void;
  remaining?: number; // remaining balance to suggest as default
}> = ({ isOpen, onClose, onConfirm, remaining = 0 }) => {
  const [method, setMethod] = useState<null | 'cash' | 'etransfer'>(null);
  const [amount, setAmount] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setMethod(null);
      // default to remaining (rounded) if positive
      const def = Math.max(0, Math.round(remaining || 0));
      setAmount(def > 0 ? String(def) : '');
    }
  }, [isOpen, remaining]);

  const parsedAmount = (() => {
    const n = Number(amount);
    if (!isFinite(n)) return 0;
    return Math.max(0, n);
  })();

  const maxAllowed = Math.max(0, Math.round(remaining || 0));
  const isAmountValid = method !== null && parsedAmount > 0;

  const handleConfirm = () => {
    if (!method) return;
    const amt = Math.min(parsedAmount, maxAllowed || parsedAmount);
    if (amt <= 0) return;
    onConfirm(method, Math.round(amt));
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Record Payment" size="sm">
      <div className="space-y-4">
        <div className="text-sm text-muted">
          {maxAllowed > 0 ? (
            <span>Remaining balance: ${maxAllowed.toLocaleString()}</span>
          ) : (
            <span>Enter an amount to record a payment.</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setMethod('cash')}
            className={`flex-1 py-2 rounded-lg border ${method==='cash' ? 'border-indigo-500 bg-indigo-500/10 text-primary' : 'border-white/10 bg-white/5 text-muted'}`}
          >
            Cash
          </button>
          <button
            type="button"
            onClick={() => setMethod('etransfer')}
            className={`flex-1 py-2 rounded-lg border ${method==='etransfer' ? 'border-indigo-500 bg-indigo-500/10 text-primary' : 'border-white/10 bg-white/5 text-muted'}`}
          >
            E-transfer
          </button>
        </div>

        <div>
          <Label htmlFor="payment-amount">Amount</Label>
          <Input
            id="payment-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => {
              const v = e.target.value;
              // allow only digits and optional decimal point
              if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
            }}
            startAdornment="$"
          />
          {maxAllowed > 0 && (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="text-xs text-indigo-400 hover:text-indigo-300"
                onClick={() => setAmount(String(maxAllowed))}
              >
                Use remaining
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-primary">Cancel</button>
          <button type="button" onClick={handleConfirm} disabled={!isAmountValid} className={`gloss-btn ${!isAmountValid ? 'opacity-50 cursor-not-allowed' : ''}`}>Confirm</button>
        </div>
      </div>
    </ModalWrapper>
  );
};

type AssistantPreview = {
  clientName: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  amountPaid: number;
  notes?: string;
  paymentDueDate?: string;
};

export const AssistantModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
  onPromptChange: React.Dispatch<React.SetStateAction<string>>;
  isProcessing: boolean;
  errorMessage: string | null;
  preview: AssistantPreview | null;
  onGenerate: () => void;
  onCreate: () => void;
  onReset: () => void;
}> = ({
  isOpen,
  onClose,
  prompt,
  onPromptChange,
  isProcessing,
  errorMessage,
  preview,
  onGenerate,
  onCreate,
  onReset,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const speechCtor = typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;
  const supportsSpeech = Boolean(speechCtor);

  const stopListening = useCallback((silent = false) => {
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      } catch {
        // ignore termination errors
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    if (!silent) {
      setInterimTranscript('');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopListening(true);
      setSpeechError(null);
      setInterimTranscript('');
    }
    return () => {
      stopListening(true);
    };
  }, [isOpen, stopListening]);

  const startListening = () => {
    if (!speechCtor) {
      setSpeechError('Voice capture is not supported in this browser.');
      return;
    }
    try {
      const recognition = new speechCtor();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            finalText += transcript;
          } else {
            interim += transcript;
          }
        }
        if (interim) {
          setInterimTranscript(interim.trim());
        }
        if (finalText) {
          const cleaned = finalText.trim();
          if (cleaned) {
            onPromptChange(prev => (prev ? `${prev.trim()} ${cleaned}`.trim() : cleaned));
          }
          setInterimTranscript('');
        }
      };
      recognition.onerror = (event: any) => {
        if (event?.error !== 'no-speech') {
          setSpeechError('The microphone stopped unexpectedly. You can try again or type your request.');
        }
        stopListening();
      };
      recognition.onend = () => {
        stopListening(true);
      };
      recognition.start();
      recognitionRef.current = recognition;
      setSpeechError(null);
      setInterimTranscript('');
      setIsListening(true);
    } catch (error) {
      console.error('Speech recognition error', error);
      setSpeechError('Unable to access the microphone. Check browser permissions or type your request instead.');
      stopListening();
    }
  };

  const tipExamples = [
    'client: Glass Co, product: Frosted Panel, quantity 12, price $120 each, shipping $45',
    'client: Taylor Smith, product: Blue vase, qty 3, price $85 total, shipping 0, notes rush order',
  ];

  const disableGenerate = isProcessing || !prompt.trim();
  const disableCreate = isProcessing || !preview;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Order Assistant" size="lg">
      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          <Label htmlFor="assistant-prompt">Describe the order</Label>
          <Textarea
            id="assistant-prompt"
            rows={4}
            value={prompt}
            onChange={e => onPromptChange(e.target.value)}
            placeholder="Example: client: Glass Co, product: Frosted Panel, quantity 12, price $120 each, shipping $45"
          />
          {supportsSpeech && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={isListening ? () => stopListening() : startListening}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                  isListening
                    ? 'bg-rose-500/80 text-white hover:bg-rose-500'
                    : 'bg-white/10 text-muted hover:bg-white/15 hover:text-primary'
                }`}
              >
                {isListening ? <Square size={16} /> : <Mic size={16} />}
                <span>{isListening ? 'Stop listening' : 'Speak order'}</span>
              </button>
              {interimTranscript && (
                <span className="text-sm text-primary/80">“{interimTranscript}”</span>
              )}
              {speechError && (
                <span className="text-xs text-rose-200/80">{speechError}</span>
              )}
            </div>
          )}
          {!supportsSpeech && (
            <div className="text-xs text-muted">
              Voice capture is not available in this browser. Type your request instead.
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
          <p className="font-medium text-primary">Tip:</p>
          <ul className="list-disc space-y-1 pl-5">
            {tipExamples.map(example => (
              <li key={example} className="text-muted">{example}</li>
            ))}
          </ul>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}

        {preview && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-4">
              <div className="glass-icon h-12 w-12 flex items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-200">
                <Bot size={24} />
              </div>
              <div>
                <p className="text-sm text-muted">Preview</p>
                <p className="text-lg font-semibold text-primary">Assistant summary</p>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Client</dt>
                <dd className="text-sm text-primary">{preview.clientName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Product</dt>
                <dd className="text-sm text-primary">{preview.productName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Quantity</dt>
                <dd className="text-sm text-primary">{preview.quantity}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Unit price</dt>
                <dd className="text-sm text-primary">${preview.unitPrice.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Subtotal</dt>
                <dd className="text-sm text-primary">${preview.subtotal.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Shipping</dt>
                <dd className="text-sm text-primary">${preview.shipping.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Discount</dt>
                <dd className="text-sm text-primary">${preview.discount.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Amount paid</dt>
                <dd className="text-sm text-primary">${preview.amountPaid.toFixed(2)}</dd>
              </div>
              {preview.paymentDueDate && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Payment due</dt>
                  <dd className="text-sm text-primary">{preview.paymentDueDate}</dd>
                </div>
              )}
              {preview.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted">Notes</dt>
                  <dd className="text-sm text-primary">{preview.notes}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-primary">
                Total: ${preview.total.toFixed(2)}
              </div>
              <button
                type="button"
                onClick={onCreate}
                disabled={disableCreate}
                className={`gloss-btn ${disableCreate ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                Create order
              </button>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" />
            <span>Working on it…</span>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                onReset();
                setSpeechError(null);
                setInterimTranscript('');
                stopListening(true);
              }}
              className="rounded-full px-4 py-2 text-sm text-muted hover:text-primary hover:bg-white/10 transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm text-muted hover:text-primary hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onGenerate}
              disabled={disableGenerate}
              className={`gloss-btn ${disableGenerate ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              Generate summary
            </button>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};

export const SessionTimeoutModal: React.FC<{
  isOpen: boolean;
  onContinue: () => void;
  onLogout: () => void;
  countdown: number;
}> = ({ isOpen, onContinue, onLogout, countdown }) => (
    <ModalWrapper isOpen={isOpen} onClose={onContinue} title="Session Timeout">
        <div className="text-center">
            <p className="text-primary mb-2">You've been inactive for a while.</p>
            <p className="text-muted">You will be logged out in <span className="font-bold text-primary">{countdown}</span> seconds for security.</p>
        </div>
        <div className="mt-6 flex justify-center gap-4">
            <button onClick={onLogout} className="px-6 py-2 text-sm font-semibold text-muted hover:text-primary">Log Out</button>
            <button onClick={onContinue} className="gloss-btn">Continue Session</button>
        </div>
    </ModalWrapper>
);
