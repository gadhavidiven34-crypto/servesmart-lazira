import { useMemo, useState } from 'react';
import {
  Check,
  IndianRupee,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  QrCode,
  Settings,
  Star,
  Trash2,
  Unlock,
  UtensilsCrossed,
} from 'lucide-react';
import type {
  MenuItem,
  Order,
  RestaurantSettings,
  Review,
} from '../types/restaurant';
import {
  calculateRevenueSummary,
  filterCompletedOrders,
  formatCurrency,
  getLocalDateKey,
} from '../utils/restaurantLogic';
import { TableQrGrid } from './TableQrGrid';

interface AdminViewProps {
  settings: RestaurantSettings;
  menu: MenuItem[];
  orders: Order[];
  reviews: Review[];
  onUpdateSettings: (patch: Partial<RestaurantSettings>) => void;
  onAddMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  onUpdateMenuItem: (id: string, patch: Partial<Omit<MenuItem, 'id'>>) => void;
  onDeleteMenuItem: (id: string) => void;
  onOpenTable: (tableNumber: number) => void;
}

type AdminTab = 'revenue' | 'menu' | 'qrcodes' | 'reviews' | 'settings';

export function AdminView({
  settings,
  menu,
  orders,
  reviews,
  onUpdateSettings,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onOpenTable,
}: AdminViewProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('qrcodes');

  // Revenue Overview filters
  const [revenueDateFilter, setRevenueDateFilter] = useState<string>('');
  const [revenueTableFilter, setRevenueTableFilter] = useState<number | 'all'>(
    'all'
  );

  // Settings form state
  const [restaurantName, setRestaurantName] = useState(settings.restaurantName);
  const [upiId, setUpiId] = useState(settings.upiId);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Add Menu Item form state
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newPrep, setNewPrep] = useState('');
  const [newIsVeg, setNewIsVeg] = useState(true);
  const [menuFormError, setMenuFormError] = useState('');

  // Inline Edit Menu Item state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPrep, setEditPrep] = useState('');
  const [editIsVeg, setEditIsVeg] = useState(true);

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return '—';
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const filteredCompletedOrders = useMemo(
    () =>
      filterCompletedOrders(orders, {
        date: revenueDateFilter || undefined,
        tableNumber: revenueTableFilter,
      }),
    [orders, revenueDateFilter, revenueTableFilter]
  );

  const revenueSummary = useMemo(
    () => calculateRevenueSummary(filteredCompletedOrders),
    [filteredCompletedOrders]
  );

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === settings.adminPin) {
      setUnlocked(true);
      setPinError('');
      setRestaurantName(settings.restaurantName);
      setUpiId(settings.upiId);
    } else {
      setPinError('Incorrect PIN. Default demo PIN is 1234.');
    }
  };

  const handleDemoUnlock = () => {
    setUnlocked(true);
    setPinError('');
    setRestaurantName(settings.restaurantName);
    setUpiId(settings.upiId);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim() || !upiId.trim()) return;
    onUpdateSettings({
      restaurantName: restaurantName.trim(),
      upiId: upiId.trim(),
    });
    setSettingsSaved(true);
    window.setTimeout(() => setSettingsSaved(false), 2500);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(newPrice);
    const parsedPrep = Number(newPrep);
    if (
      !newName.trim() ||
      Number.isNaN(parsedPrice) ||
      parsedPrice <= 0 ||
      Number.isNaN(parsedPrep) ||
      parsedPrep <= 0
    ) {
      setMenuFormError('Enter a valid dish name, price (₹), and prep time.');
      return;
    }
    setMenuFormError('');
    onAddMenuItem({
      name: newName.trim(),
      price: Math.round(parsedPrice),
      prepTimeMins: Math.round(parsedPrep),
      isVeg: newIsVeg,
    });
    setNewName('');
    setNewPrice('');
    setNewPrep('');
    setNewIsVeg(true);
  };

  const startEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditPrep(String(item.prepTimeMins));
    setEditIsVeg(item.isVeg);
  };

  const saveEdit = (id: string) => {
    const parsedPrice = Number(editPrice);
    const parsedPrep = Number(editPrep);
    if (
      !editName.trim() ||
      Number.isNaN(parsedPrice) ||
      parsedPrice <= 0 ||
      Number.isNaN(parsedPrep) ||
      parsedPrep <= 0
    ) {
      return;
    }
    onUpdateMenuItem(id, {
      name: editName.trim(),
      price: Math.round(parsedPrice),
      prepTimeMins: Math.round(parsedPrep),
      isVeg: editIsVeg,
    });
    setEditingId(null);
  };

  if (!unlocked) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8">
          <div className="w-11 h-11 rounded-lg bg-[#F2F4F7] border border-[#E4E7EC] flex items-center justify-center mb-4">
            <Lock className="w-5 h-5 text-[#101828]" />
          </div>

          <h1 className="font-display text-xl font-bold text-[#101828]">
            Owner Admin Panel
          </h1>
          <p className="text-sm text-[#475467] mt-1">
            Enter your 4-digit owner PIN to manage {settings.restaurantName}{' '}
            settings, menu, QR codes, and reviews.
          </p>

          <form onSubmit={handlePinSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="admin-pin-input"
                className="block text-xs font-medium text-[#344054] mb-1.5"
              >
                Admin PIN (Default: 1234)
              </label>
              <input
                id="admin-pin-input"
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter PIN"
                className="w-full h-11 px-3.5 font-mono text-base tracking-widest bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>

            {pinError && (
              <p className="text-xs font-medium text-red-600">{pinError}</p>
            )}

            <div className="space-y-2.5">
              <button
                type="submit"
                className="w-full h-11 rounded-lg bg-[#101828] hover:bg-[#1D2939] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                Unlock Admin Panel
              </button>

              <button
                type="button"
                onClick={handleDemoUnlock}
                className="w-full h-11 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Unlock className="w-4 h-4" />
                Quick Demo Unlock
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  const tableNumbers = Array.from(
    { length: settings.totalTables },
    (_, i) => i + 1
  );

  return (
    <main className="min-h-[calc(100vh-3.5rem)] py-6 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto space-y-6">
        {/* Header & Section Tabs */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#101828]">
              Owner Admin Console
            </h1>
            <p className="text-sm text-[#475467] mt-0.5">
              {settings.restaurantName} · Live settings sync across all tables
              &amp; displays
            </p>
          </div>

          <div
            className="inline-flex items-center p-1 bg-[#F2F4F7] rounded-lg overflow-x-auto max-w-full"
            role="tablist"
            aria-label="Admin Sections"
          >
            {(
              [
                { id: 'qrcodes', label: 'Table QR Codes', icon: QrCode },
                { id: 'revenue', label: 'Revenue Overview', icon: IndianRupee },
                { id: 'menu', label: 'Menu Manager', icon: UtensilsCrossed },
                {
                  id: 'reviews',
                  label: `Reviews (${reviews.length})`,
                  icon: Star,
                },
                { id: 'settings', label: 'Settings & UPI', icon: Settings },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active
                      ? 'bg-white text-[#101828] shadow-xs'
                      : 'text-[#475467] hover:text-[#101828]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 0: REVENUE OVERVIEW */}
        {activeTab === 'revenue' && (
          <div className="space-y-6">
            {/* Filter Controls */}
            <section className="bg-white border border-[#E4E7EC] rounded-xl p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-[#101828]">
                  Revenue Overview
                </h2>
                <p className="text-xs text-[#475467] mt-0.5">
                  Total sales calculated from completed orders, filterable by
                  date and table number.
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label
                    htmlFor="revenue-date-filter"
                    className="block text-xs font-medium text-[#344054] mb-1"
                  >
                    Filter by Date
                  </label>
                  <input
                    id="revenue-date-filter"
                    type="date"
                    value={revenueDateFilter}
                    onChange={(e) => setRevenueDateFilter(e.target.value)}
                    className="h-9 px-3 text-xs font-mono bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="revenue-table-filter"
                    className="block text-xs font-medium text-[#344054] mb-1"
                  >
                    Filter by Table
                  </label>
                  <select
                    id="revenue-table-filter"
                    value={String(revenueTableFilter)}
                    onChange={(e) =>
                      setRevenueTableFilter(
                        e.target.value === 'all'
                          ? 'all'
                          : Number(e.target.value)
                      )
                    }
                    className="h-9 px-3 text-xs font-medium bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="all">All Tables</option>
                    {tableNumbers.map((t) => (
                      <option key={t} value={String(t)}>
                        Table {t}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setRevenueDateFilter(getLocalDateKey(Date.now()))}
                  className="h-9 px-3 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-xs font-semibold text-[#344054] cursor-pointer"
                >
                  Today
                </button>

                {(revenueDateFilter !== '' ||
                  revenueTableFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevenueDateFilter('');
                      setRevenueTableFilter('all');
                    }}
                    className="h-9 px-3 rounded-lg bg-[#F2F4F7] hover:bg-[#E4E7EC] text-xs font-semibold text-[#101828] cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </section>

            {/* KPI Summary Row */}
            <section
              aria-label="Revenue Summary Metrics"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
                <span className="text-xs font-medium text-[#475467] block">
                  Total Sales
                </span>
                <span
                  data-testid="revenue-total-sales"
                  className="font-mono text-2xl font-bold text-emerald-700 tabular-nums mt-1 block"
                >
                  {formatCurrency(revenueSummary.totalSales)}
                </span>
              </div>

              <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
                <span className="text-xs font-medium text-[#475467] block">
                  Completed Orders
                </span>
                <span
                  data-testid="revenue-order-count"
                  className="font-mono text-2xl font-bold text-[#101828] tabular-nums mt-1 block"
                >
                  {revenueSummary.orderCount}
                </span>
              </div>

              <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
                <span className="text-xs font-medium text-[#475467] block">
                  Average Order Value
                </span>
                <span className="font-mono text-2xl font-bold text-[#101828] tabular-nums mt-1 block">
                  {formatCurrency(revenueSummary.averageOrderValue)}
                </span>
              </div>

              <div className="bg-white border border-[#E4E7EC] rounded-xl p-5">
                <span className="text-xs font-medium text-[#475467] block">
                  Payment Breakdown
                </span>
                <div className="mt-1.5 flex items-center gap-3 text-xs font-mono font-semibold text-[#101828] tabular-nums">
                  <span>UPI: {formatCurrency(revenueSummary.upiSales)}</span>
                  <span aria-hidden="true" className="text-[#98A2B3]">
                    ·
                  </span>
                  <span>Cash: {formatCurrency(revenueSummary.cashSales)}</span>
                </div>
              </div>
            </section>

            {/* Completed Orders Ledger */}
            <section className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E4E7EC] flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-[#101828]">
                  Completed Orders Ledger ({filteredCompletedOrders.length})
                </h3>
                <span className="text-xs text-[#475467]">
                  {revenueDateFilter ? `Date: ${revenueDateFilter}` : 'All Dates'}{' '}
                  ·{' '}
                  {revenueTableFilter === 'all'
                    ? 'All Tables'
                    : `Table ${revenueTableFilter}`}
                </span>
              </div>

              {filteredCompletedOrders.length === 0 ? (
                <div className="p-10 text-center">
                  <IndianRupee className="w-8 h-8 text-[#98A2B3] mx-auto mb-2" />
                  <p className="text-sm font-medium text-[#101828]">
                    No completed orders match the selected filters.
                  </p>
                  <p className="text-xs text-[#475467] mt-1">
                    Mark paid orders as Complete in Reception to include them in
                    Revenue Overview.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E4E7EC] bg-[#F8F9FA] text-xs font-semibold text-[#475467]">
                        <th className="py-3 px-4">Order</th>
                        <th className="py-3 px-4">Table</th>
                        <th className="py-3 px-4">Items</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4">Completed At</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2F4F7] text-sm">
                      {filteredCompletedOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-[#F9FAFB]">
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-[#101828] whitespace-nowrap">
                            {order.orderNumber}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-[#101828]">
                            Table {order.tableNumber}
                          </td>
                          <td className="py-3 px-4 text-[#344054]">
                            {order.items
                              .map((i) => `${i.quantity}× ${i.name}`)
                              .join(', ')}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold uppercase text-[#475467]">
                            {order.paymentMethod ?? 'Paid'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-[#475467] tabular-nums">
                            {new Date(
                              order.paidAt ?? order.createdAt
                            ).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-emerald-700 tabular-nums">
                            {formatCurrency(order.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 1: MENU MANAGER */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <section className="bg-white border border-[#E4E7EC] rounded-xl p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold text-[#101828] mb-4">
                Add New Dish
              </h2>
              <form
                onSubmit={handleAddItem}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
              >
                <div className="lg:col-span-2">
                  <label
                    htmlFor="new-dish-name"
                    className="block text-xs font-medium text-[#344054] mb-1"
                  >
                    Dish Name
                  </label>
                  <input
                    id="new-dish-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Paneer Tikka Sandwich"
                    className="w-full h-10 px-3 text-sm bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-dish-price"
                    className="block text-xs font-medium text-[#344054] mb-1"
                  >
                    Price (₹)
                  </label>
                  <input
                    id="new-dish-price"
                    type="number"
                    min={1}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="80"
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-dish-prep"
                    className="block text-xs font-medium text-[#344054] mb-1"
                  >
                    Prep Time (mins)
                  </label>
                  <input
                    id="new-dish-prep"
                    type="number"
                    min={1}
                    value={newPrep}
                    onChange={(e) => setNewPrep(e.target.value)}
                    placeholder="10"
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewIsVeg((v) => !v)}
                    className={`h-10 px-3 rounded-lg border text-xs font-semibold cursor-pointer shrink-0 ${
                      newIsVeg
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {newIsVeg ? 'Veg' : 'Non-Veg'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Add Dish
                  </button>
                </div>
              </form>
              {menuFormError && (
                <p className="text-xs font-medium text-red-600 mt-2">
                  {menuFormError}
                </p>
              )}
            </section>

            <section className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E4E7EC] flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-[#101828]">
                  Active Menu Items ({menu.length})
                </h2>
                <span className="text-xs text-[#475467]">
                  Updates Customer Menu immediately
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E7EC] bg-[#F8F9FA] text-xs font-semibold text-[#475467]">
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Prep Time</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F4F7] text-sm">
                    {menu.map((item) => {
                      const isEditing = editingId === item.id;
                      return (
                        <tr key={item.id} className="hover:bg-[#F9FAFB]">
                          <td className="py-3 px-4 font-medium text-[#101828]">
                            {isEditing ? (
                              <input
                                type="text"
                                aria-label="Edit dish name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-9 px-2.5 w-full max-w-xs border border-[#D0D5DD] rounded-md text-sm"
                              />
                            ) : (
                              item.name
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isEditing ? (
                              <button
                                type="button"
                                onClick={() => setEditIsVeg((v) => !v)}
                                className="px-2.5 py-1 rounded border border-[#D0D5DD] text-xs font-medium cursor-pointer"
                              >
                                {editIsVeg ? 'Veg' : 'Non-Veg'}
                              </button>
                            ) : (
                              <span
                                className={`text-xs font-semibold ${
                                  item.isVeg
                                    ? 'text-emerald-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {item.isVeg ? 'Veg' : 'Non-Veg'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-[#475467]">
                            {isEditing ? (
                              <input
                                type="number"
                                min={1}
                                aria-label="Edit prep time"
                                value={editPrep}
                                onChange={(e) => setEditPrep(e.target.value)}
                                className="h-9 px-2 w-20 border border-[#D0D5DD] rounded-md text-sm"
                              />
                            ) : (
                              `${item.prepTimeMins} mins`
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-[#101828] tabular-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                min={1}
                                aria-label="Edit price"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="h-9 px-2 w-24 border border-[#D0D5DD] rounded-md text-sm"
                              />
                            ) : (
                              formatCurrency(item.price)
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(item.id)}
                                    className="h-8 px-3 rounded-md bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="h-8 px-2.5 rounded-md border border-[#D0D5DD] text-xs font-medium cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(item)}
                                    aria-label={`Edit ${item.name}`}
                                    className="h-8 px-2.5 rounded-md border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-xs font-medium text-[#344054] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteMenuItem(item.id)}
                                    aria-label={`Delete ${item.name}`}
                                    className="h-8 px-2.5 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-medium text-red-700 inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: TABLE QR CODE GENERATOR */}
        {activeTab === 'qrcodes' && (
          <TableQrGrid
            settings={settings}
            menu={menu}
            onOpenTable={onOpenTable}
          />
        )}

        {/* TAB 3: CUSTOMER REVIEWS */}
        {activeTab === 'reviews' && (
          <section className="space-y-4">
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-[#101828]">
                  Customer Reviews &amp; Ratings
                </h2>
                <p className="text-xs text-[#475467] mt-0.5">
                  Submitted immediately by guests after completing payment
                </p>
              </div>
              <div className="text-right">
                <span className="font-mono text-2xl font-bold text-[#101828] tabular-nums">
                  {avgRating}
                </span>
                <span className="text-xs text-[#475467] block">
                  Avg across {reviews.length}{' '}
                  {reviews.length === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            </div>

            {reviews.length === 0 ? (
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-10 text-center">
                <Star className="w-8 h-8 text-[#98A2B3] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#101828]">
                  No reviews submitted yet.
                </p>
                <p className="text-xs text-[#475467] mt-1">
                  Reviews submitted on the post-payment screen will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.map((rev) => (
                  <article
                    key={rev.id}
                    className="bg-white border border-[#E4E7EC] rounded-xl p-5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-bold text-[#101828]">
                        Table {rev.tableNumber}
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= rev.rating
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-[#E4E7EC]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-[#344054]">
                      {rev.comment || 'Customer left a star rating.'}
                    </p>
                    <p className="text-xs text-[#667085] font-mono">
                      {new Date(rev.createdAt).toLocaleString()}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 4: RESTAURANT & UPI SETTINGS */}
        {activeTab === 'settings' && (
          <section className="max-w-xl bg-white border border-[#E4E7EC] rounded-xl p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold text-[#101828]">
              Restaurant &amp; UPI Payment Settings
            </h2>
            <p className="text-xs text-[#475467] mt-1">
              Changes sync immediately to all Customer UPI QR codes and Table QR
              labels.
            </p>

            <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="settings-restaurant-name"
                  className="block text-xs font-medium text-[#344054] mb-1.5"
                >
                  Restaurant Name
                </label>
                <input
                  id="settings-restaurant-name"
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  required
                  className="w-full h-10 px-3 text-sm bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-upi-id"
                  className="block text-xs font-medium text-[#344054] mb-1.5"
                >
                  Merchant UPI ID
                </label>
                <input
                  id="settings-upi-id"
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  required
                  className="w-full h-10 px-3 font-mono text-sm bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="h-10 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer transition-colors"
                >
                  Save Settings
                </button>
                {settingsSaved && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <Check className="w-4 h-4" />
                    Settings saved &amp; synced
                  </span>
                )}
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
