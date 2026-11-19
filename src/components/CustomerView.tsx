import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  History,
  Loader2,
  Minus,
  Plus,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Star,
  Utensils,
  Wallet,
} from 'lucide-react';
import type { MenuItem, Order, RestaurantSettings } from '../types/restaurant';
import {
  calculateCartSummary,
  computeRemainingSeconds,
  formatCountdown,
  formatCurrency,
  getTablePaidOrderHistory,
} from '../utils/restaurantLogic';
import {
  buildRazorpayCheckoutOptions,
  requestRazorpayOrder,
  verifyRazorpayPayment,
} from '../utils/razorpay';
import { playPaymentConfirmationSound } from '../utils/sound';
import { BROADCAST_CHANNEL_NAME, STORAGE_KEYS } from '../utils/storage';

interface CustomerViewProps {
  tableNumber: number;
  settings: RestaurantSettings;
  menu: MenuItem[];
  orders: Order[];
  onChangeTable: (tableNumber: number) => void;
  onPlaceOrder: (
    tableNumber: number,
    items: ReturnType<typeof calculateCartSummary>['lineItems'],
    totalAmount: number,
    estimatedPrepMins: number
  ) => Order;
  onSelectPayment: (orderId: string, method: 'upi' | 'cash') => void;
  onConfirmRazorpayPayment: (
    orderId: string,
    details: { razorpayOrderId: string; razorpayPaymentId: string }
  ) => void;
  onSubmitReview: (
    orderId: string,
    tableNumber: number,
    rating: number,
    comment: string
  ) => void;
  onSyncFromStorage?: () => void;
  embedded?: boolean;
  customerOnlyMode?: boolean;
}

function VegEmblem({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
    >
      <span
        className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 ${
          isVeg ? 'border-emerald-700' : 'border-red-600'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isVeg ? 'bg-emerald-700' : 'bg-red-600'
          }`}
        />
      </span>
      <span className={isVeg ? 'text-emerald-800' : 'text-red-700'}>
        {isVeg ? 'Veg' : 'Non-Veg'}
      </span>
    </span>
  );
}

function MenuCardImage({ item }: { item: MenuItem }) {
  const [failed, setFailed] = useState(false);

  if (!item.image || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center text-slate-500 p-4">
        <Utensils className="w-7 h-7 mb-1.5 text-slate-400" />
        <span className="text-xs font-medium text-center line-clamp-1">
          {item.name}
        </span>
      </div>
    );
  }

  return (
    <img
      src={item.image}
      alt={item.name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
    />
  );
}

export function CustomerView({
  tableNumber,
  settings,
  menu,
  orders,
  onChangeTable,
  onPlaceOrder,
  onSelectPayment,
  onConfirmRazorpayPayment,
  onSubmitReview,
  onSyncFromStorage,
  embedded = false,
  customerOnlyMode = false,
}: CustomerViewProps) {
  const [activeTab, setActiveTab] = useState<'order' | 'history'>('order');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);
  const [startingNewOrder, setStartingNewOrder] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [rating, setRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');

  // Reset new-order override when switching tables
  useEffect(() => {
    setStartingNewOrder(false);
    setTrackedOrderId(null);
    setCart({});
    setReviewComment('');
    setRating(5);
    setReviewError('');
  }, [tableNumber]);

  // Find active order for this table
  const activeTableOrder = useMemo(() => {
    if (startingNewOrder) return null;
    if (trackedOrderId) {
      const found = orders.find(
        (o) => o.id === trackedOrderId && o.tableNumber === tableNumber
      );
      if (found && found.status !== 'completed') return found;
    }
    const tableOrders = orders
      .filter((o) => o.tableNumber === tableNumber && o.status !== 'completed')
      .sort((a, b) => b.createdAt - a.createdAt);
    return tableOrders[0] ?? null;
  }, [orders, tableNumber, trackedOrderId, startingNewOrder]);

  const tablePaidHistory = useMemo(
    () => getTablePaidOrderHistory(orders, tableNumber),
    [orders, tableNumber]
  );

  // Tick countdown every second while tracking an active order
  useEffect(() => {
    if (!activeTableOrder) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTableOrder?.id]);

  // Real-time sync on /table/:id via BroadcastChannel('servesmart_sync') + 500ms localStorage polling + storage event
  useEffect(() => {
    if (!onSyncFromStorage) return;

    const syncOrders = () => {
      onSyncFromStorage();
    };

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEYS.orders || e.key === STORAGE_KEYS.settings) {
        syncOrders();
      }
    };

    window.addEventListener('storage', handleStorage);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = () => {
        syncOrders();
      };
    }

    const pollTimer = window.setInterval(() => {
      try {
        window.localStorage.getItem(STORAGE_KEYS.orders);
      } catch {
        // Ignore storage errors
      }
      syncOrders();
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(pollTimer);
      if (channel) {
        channel.close();
      }
    };
  }, [onSyncFromStorage, tableNumber]);

  const cartSummary = useMemo(
    () => calculateCartSummary(cart, menu),
    [cart, menu]
  );

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const nextQty = Math.max(0, (prev[itemId] ?? 0) + delta);
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: nextQty };
    });
  };

  const handlePlaceOrder = () => {
    if (cartSummary.totalItems === 0) return;
    const created = onPlaceOrder(
      tableNumber,
      cartSummary.lineItems,
      cartSummary.totalAmount,
      cartSummary.estimatedPrepMins
    );
    setTrackedOrderId(created.id);
    setStartingNewOrder(false);
    setActiveTab('order');
    setCart({});
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTableOrder) return;
    if (rating < 1 || rating > 5) {
      setReviewError('Please choose a star rating.');
      return;
    }
    setReviewError('');
    onSubmitReview(activeTableOrder.id, tableNumber, rating, reviewComment);
  };

  const tableOptions = Array.from(
    { length: settings.totalTables },
    (_, i) => i + 1
  );

  return (
    <main
      className={
        customerOnlyMode
          ? 'min-h-screen pb-24'
          : 'min-h-[calc(100vh-3.5rem)] pb-24'
      }
    >
      {/* Sub-bar: Clean Restaurant Header + Table Badge (plus Demo Table Switcher only outside Customer QR Mode) */}
      <section className="bg-white border-b border-[#E4E7EC]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#101828]">
                {settings.restaurantName}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Table {tableNumber}
              </span>
            </div>
            <p className="text-sm text-[#475467] mt-0.5">
              Freshly prepared to order · Scan, order, and pay from your table
            </p>
          </div>

          {/* Quick Table Switcher shown only in Staff/Demo mode (hidden on direct QR/table URLs) */}
          {!customerOnlyMode && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-[#475467] mr-1">
                Switch Table:
              </span>
              <div
                className="inline-flex items-center p-1 bg-[#F2F4F7] rounded-lg"
                role="group"
                aria-label="Quick Table Switcher"
              >
                {tableOptions.map((t) => {
                  const active = t === tableNumber;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onChangeTable(t)}
                      aria-label={`Switch to Table ${t}`}
                      aria-pressed={active}
                      className={`min-w-[36px] h-8 px-2.5 text-xs font-semibold rounded-md cursor-pointer transition-colors duration-150 ${
                        active
                          ? 'bg-white text-[#101828] shadow-xs'
                          : 'text-[#475467] hover:text-[#101828]'
                      }`}
                    >
                      T{t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Customer Mode Tabs: Menu/Live Order vs Order History */}
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 pb-3">
          <div
            className="inline-flex items-center p-1 bg-[#F2F4F7] rounded-lg"
            role="tablist"
            aria-label="Customer Sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'order'}
              onClick={() => setActiveTab('order')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === 'order'
                  ? 'bg-white text-[#101828] shadow-xs'
                  : 'text-[#475467] hover:text-[#101828]'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              {activeTableOrder ? 'Live Order' : 'Menu'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === 'history'
                  ? 'bg-white text-[#101828] shadow-xs'
                  : 'text-[#475467] hover:text-[#101828]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Order History ({tablePaidHistory.length})
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 pt-6">
        {activeTab === 'history' ? (
          /* ORDER HISTORY TAB (Paid orders for this table) */
          <section
            aria-label={`Order History for Table ${tableNumber}`}
            className="max-w-3xl mx-auto space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-[#101828]">
                  Order History — Table {tableNumber}
                </h2>
                <p className="text-xs text-[#475467] mt-0.5">
                  Previous orders for Table {tableNumber} with completed payment
                </p>
              </div>
              {tablePaidHistory.length > 0 && (
                <div className="text-left sm:text-right">
                  <span className="text-xs text-[#475467] block">
                    Total Paid ({tablePaidHistory.length}{' '}
                    {tablePaidHistory.length === 1 ? 'order' : 'orders'})
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-700 tabular-nums">
                    {formatCurrency(
                      tablePaidHistory.reduce(
                        (sum, o) => sum + o.totalAmount,
                        0
                      )
                    )}
                  </span>
                </div>
              )}
            </div>

            {tablePaidHistory.length === 0 ? (
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-10 text-center space-y-3">
                <Receipt className="w-8 h-8 text-[#98A2B3] mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-[#101828]">
                    No paid orders for Table {tableNumber} yet
                  </p>
                  <p className="text-xs text-[#475467] mt-1">
                    Once payment for an order at Table {tableNumber} is
                    confirmed, it will appear here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('order')}
                  className="h-9 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {activeTableOrder ? 'View Live Order' : 'Browse Menu'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {tablePaidHistory.map((order) => (
                  <article
                    key={order.id}
                    data-testid={`history-order-${order.orderNumber}`}
                    className="bg-white border border-[#E4E7EC] rounded-xl p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#F2F4F7]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#101828]">
                            {order.orderNumber}
                          </span>
                          <span aria-hidden="true" className="text-[#98A2B3]">
                            ·
                          </span>
                          <span className="text-xs font-medium text-[#475467]">
                            Table {order.tableNumber}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-[#667085] mt-0.5 tabular-nums">
                          Paid{' '}
                          {new Date(
                            order.paidAt ?? order.createdAt
                          ).toLocaleString()}
                        </p>
                        {order.razorpayPaymentId && (
                          <p className="font-mono text-[11px] text-emerald-700 mt-0.5">
                            Razorpay ID: {order.razorpayPaymentId}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {order.razorpayPaymentId
                            ? 'Paid via Razorpay UPI'
                            : order.paymentMethod === 'upi'
                              ? 'Paid via UPI'
                              : 'Paid via Cash'}
                        </span>
                        <span className="text-xs font-medium text-[#475467]">
                          {order.status === 'completed'
                            ? 'Completed'
                            : order.status === 'ready'
                              ? 'Ready to Serve'
                              : order.status === 'preparing'
                                ? 'Preparing'
                                : 'Order Received'}
                        </span>
                      </div>
                    </div>

                    <ul className="divide-y divide-[#F2F4F7] text-sm">
                      {order.items.map((item) => (
                        <li
                          key={item.menuItemId}
                          className="py-1.5 flex items-center justify-between gap-2"
                        >
                          <span className="text-[#101828]">
                            <span className="font-mono font-semibold text-[#475467] mr-2 tabular-nums">
                              {item.quantity}×
                            </span>
                            {item.name}
                          </span>
                          <span className="font-mono font-medium text-[#101828] tabular-nums">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-3 border-t border-[#E4E7EC] flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#475467]">
                        Total Paid
                      </span>
                      <span className="font-mono text-base font-bold text-emerald-700 tabular-nums">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : activeTableOrder ? (
          /* LIVE ORDER & PAYMENT TRACKER */
          <LiveOrderTracker
            order={activeTableOrder}
            settings={settings}
            nowMs={nowMs}
            rating={rating}
            reviewComment={reviewComment}
            reviewError={reviewError}
            onSelectPayment={(method) =>
              onSelectPayment(activeTableOrder.id, method)
            }
            onConfirmRazorpayPayment={(details) =>
              onConfirmRazorpayPayment(activeTableOrder.id, details)
            }
            onChangeRating={setRating}
            onChangeComment={setReviewComment}
            onSubmitReview={handleReviewSubmit}
            onStartNewOrder={() => {
              setStartingNewOrder(true);
              setTrackedOrderId(null);
            }}
          />
        ) : (
          /* MENU GRID */
          <div>
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#101828]">
                  Today&apos;s Menu
                </h2>
                <p className="text-xs text-[#475467] mt-0.5">
                  {menu.length} items available · Tap Add to build your order
                </p>
              </div>
            </div>

            {menu.length === 0 ? (
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-10 text-center">
                <p className="text-sm font-medium text-[#101828]">
                  No menu items currently listed.
                </p>
                <p className="text-xs text-[#475467] mt-1">
                  Add dishes from the Admin Menu Manager to show them here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {menu.map((item) => {
                  const qty = cart[item.id] ?? 0;
                  return (
                    <article
                      key={item.id}
                      className="group bg-white border border-[#E4E7EC] rounded-xl overflow-hidden flex flex-col transition-transform duration-150 hover:-translate-y-0.5"
                    >
                      <div className="aspect-[4/3] w-full bg-[#F2F4F7] overflow-hidden">
                        <MenuCardImage item={item} />
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-xs text-[#475467] mb-1.5">
                            <VegEmblem isVeg={item.isVeg} />
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Clock className="w-3.5 h-3.5 text-[#667085]" />
                              {item.prepTimeMins} mins
                            </span>
                          </div>

                          <h3 className="font-display text-base font-semibold text-[#101828] leading-snug">
                            {item.name}
                          </h3>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#F2F4F7]">
                          <span className="font-mono text-base font-bold text-[#101828] tabular-nums">
                            {formatCurrency(item.price)}
                          </span>

                          {qty === 0 ? (
                            <button
                              type="button"
                              onClick={() => updateQty(item.id, 1)}
                              aria-label={`Add ${item.name} to cart`}
                              className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add
                            </button>
                          ) : (
                            <div className="inline-flex items-center border border-emerald-700 rounded-lg overflow-hidden bg-emerald-50">
                              <button
                                type="button"
                                onClick={() => updateQty(item.id, -1)}
                                aria-label={`Decrease quantity of ${item.name}`}
                                className="w-10 h-10 flex items-center justify-center text-emerald-800 hover:bg-emerald-100 cursor-pointer transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span
                                className="w-8 text-center font-mono text-sm font-bold text-emerald-900 tabular-nums"
                                aria-label={`${item.name} quantity`}
                              >
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQty(item.id, 1)}
                                aria-label={`Increase quantity of ${item.name}`}
                                className="w-10 h-10 flex items-center justify-center text-emerald-800 hover:bg-emerald-100 cursor-pointer transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Bottom Cart Bar (compact <= 72px so sticky total stays under 15% mobile height) */}
      {activeTab === 'order' &&
        !activeTableOrder &&
        cartSummary.totalItems > 0 && (
        <div
          className={
            embedded
              ? 'sticky bottom-0 z-20 bg-white border-t border-[#E4E7EC] shadow-md mt-6'
              : 'fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E4E7EC] shadow-lg'
          }
          data-testid="sticky-cart-bar"
        >
          <div className="max-w-[1160px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#101828] tabular-nums">
                  <span>
                    {cartSummary.totalItems}{' '}
                    {cartSummary.totalItems === 1 ? 'Item' : 'Items'}
                  </span>
                  <span aria-hidden="true" className="text-[#98A2B3]">
                    ·
                  </span>
                  <span className="font-mono font-bold">
                    {formatCurrency(cartSummary.totalAmount)}
                  </span>
                </div>
                <p className="text-xs text-[#475467] tabular-nums truncate">
                  Est. prep time: {cartSummary.estimatedPrepMins} mins · Table{' '}
                  {tableNumber}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePlaceOrder}
              className="h-11 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Place Order
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

interface LiveOrderTrackerProps {
  order: Order;
  settings: RestaurantSettings;
  nowMs: number;
  rating: number;
  reviewComment: string;
  reviewError: string;
  onSelectPayment: (method: 'upi' | 'cash') => void;
  onConfirmRazorpayPayment: (details: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
  }) => void;
  onChangeRating: (rating: number) => void;
  onChangeComment: (comment: string) => void;
  onSubmitReview: (e: React.FormEvent) => void;
  onStartNewOrder: () => void;
}

function LiveOrderTracker({
  order,
  settings,
  nowMs,
  rating,
  reviewComment,
  reviewError,
  onSelectPayment,
  onConfirmRazorpayPayment,
  onChangeRating,
  onChangeComment,
  onSubmitReview,
  onStartNewOrder,
}: LiveOrderTrackerProps) {
  const [checkoutStage, setCheckoutStage] = useState<
    'idle' | 'creating_order' | 'checkout_open' | 'verifying'
  >('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const remainingSecs = computeRemainingSeconds(order, nowMs);
  const formattedRemaining = formatCountdown(remainingSecs);

  const handlePayOnlineRazorpay = async () => {
    if (checkoutStage !== 'idle') return;
    setPaymentError(null);
    setCheckoutStage('creating_order');

    try {
      const orderData = await requestRazorpayOrder(
        order.totalAmount,
        order.orderNumber
      );

      if (typeof window.Razorpay !== 'function') {
        throw new Error(
          'Razorpay Checkout failed to load. Please refresh the page and try again.'
        );
      }

      const options = buildRazorpayCheckoutOptions({
        keyId: orderData.keyId,
        orderId: orderData.orderId,
        amountPaise: orderData.amount,
        currency: orderData.currency,
        restaurantName: settings.restaurantName,
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        onDismiss: () => {
          setCheckoutStage((prev) => (prev === 'verifying' ? prev : 'idle'));
        },
        onSuccess: async (response) => {
          setCheckoutStage('verifying');
          setPaymentError(null);
          try {
            const verification = await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verification.verified) {
              playPaymentConfirmationSound();
              onConfirmRazorpayPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
              });
              setCheckoutStage('idle');
            }
          } catch (verifyErr) {
            setPaymentError(
              verifyErr instanceof Error
                ? verifyErr.message
                : 'Payment verification failed. Please contact reception.'
            );
            setCheckoutStage('idle');
          }
        },
      });

      const rzp = new window.Razorpay(options);
      rzp.on?.('payment.failed', (failure) => {
        setPaymentError(
          failure?.error?.description ||
            'Payment was not completed. Please try again.'
        );
        setCheckoutStage('idle');
      });

      setCheckoutStage('checkout_open');
      rzp.open();
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : 'Unable to start Razorpay Checkout. Please try again.'
      );
      setCheckoutStage('idle');
    }
  };

  const steps = [
    { key: 'received', label: 'Order Received' },
    { key: 'preparing', label: 'Preparing in Kitchen' },
    { key: 'ready', label: 'Ready to Serve' },
  ] as const;

  const activeStepIndex =
    order.status === 'ready' || order.status === 'completed'
      ? 2
      : order.status === 'preparing'
        ? 1
        : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Live Status & Countdown Card */}
      <section className="bg-white border border-[#E4E7EC] rounded-xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#F2F4F7]">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#475467]">
              <span className="font-mono font-semibold text-[#101828]">
                {order.orderNumber}
              </span>
              <span aria-hidden="true">·</span>
              <span>Table {order.tableNumber}</span>
            </div>
            <h2 className="font-display text-xl font-bold text-[#101828] mt-1">
              {order.status === 'ready'
                ? 'Your Order is Ready to Serve'
                : order.status === 'preparing'
                  ? 'Chef is Preparing Your Order'
                  : 'Order Sent to Kitchen'}
            </h2>
          </div>

          <div className="bg-[#F8F9FA] border border-[#E4E7EC] rounded-lg px-4 py-2.5 text-left sm:text-right shrink-0">
            <p className="text-xs font-medium text-[#475467]">
              Estimated Time Remaining
            </p>
            <p
              className="font-mono text-xl font-bold text-emerald-800 tabular-nums mt-0.5"
              data-testid="countdown-timer"
            >
              {order.status === 'ready' ? 'Ready Now' : `${formattedRemaining} mins`}
            </p>
          </div>
        </div>

        {/* 3-Step Order Progress */}
        <div className="py-5">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {steps.map((step, idx) => {
              const reached = idx <= activeStepIndex;
              const current = idx === activeStepIndex;
              return (
                <div key={step.key} className="flex flex-col gap-2">
                  <div
                    className={`h-1.5 rounded-full transition-colors duration-200 ${
                      reached ? 'bg-emerald-600' : 'bg-[#E4E7EC]'
                    }`}
                  />
                  <div className="flex items-center gap-1.5">
                    {idx === 1 ? (
                      <ChefHat
                        className={`w-3.5 h-3.5 shrink-0 ${
                          reached ? 'text-emerald-700' : 'text-[#98A2B3]'
                        }`}
                      />
                    ) : (
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          reached ? 'text-emerald-700' : 'text-[#98A2B3]'
                        }`}
                      />
                    )}
                    <span
                      className={`text-xs font-medium leading-tight ${
                        current
                          ? 'text-[#101828] font-semibold'
                          : reached
                            ? 'text-emerald-800'
                            : 'text-[#667085]'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Itemized Summary */}
        <div className="pt-4 border-t border-[#F2F4F7]">
          <h3 className="text-xs font-semibold text-[#475467] uppercase tracking-wider mb-3">
            Order Summary
          </h3>
          <ul className="divide-y divide-[#F2F4F7]">
            {order.items.map((item) => (
              <li
                key={item.menuItemId}
                className="py-2 flex items-center justify-between text-sm"
              >
                <span className="text-[#101828]">
                  <span className="font-mono font-semibold text-[#475467] mr-2 tabular-nums">
                    {item.quantity}×
                  </span>
                  {item.name}
                </span>
                <span className="font-mono font-medium text-[#101828] tabular-nums">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-[#E4E7EC] flex items-center justify-between">
            <span className="text-sm font-semibold text-[#101828]">
              Total Bill Amount
            </span>
            <span className="font-mono text-lg font-bold text-[#101828] tabular-nums">
              {formatCurrency(order.totalAmount)}
            </span>
          </div>
        </div>
      </section>

      {/* Payment OR Post-Payment Confirmation & Review */}
      {order.paymentStatus !== 'paid' && order.paymentMethod !== 'cash' ? (
        <section className="bg-white border border-[#E4E7EC] rounded-xl p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="font-display text-lg font-bold text-[#101828]">
              Complete Payment — {formatCurrency(order.totalAmount)}
            </h3>
            <p className="text-sm text-[#475467] mt-1">
              Pay instantly via Google Pay, PhonePe, or Paytm with automatic
              Razorpay verification — no manual confirmation required.
            </p>
          </div>

          {paymentError && (
            <div
              role="alert"
              data-testid="razorpay-error"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{paymentError}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              data-testid="razorpay-pay-button"
              disabled={checkoutStage !== 'idle'}
              onClick={() => void handlePayOnlineRazorpay()}
              className="w-full min-h-[56px] px-4 sm:px-5 py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-800/80 text-white text-[13px] sm:text-base font-bold flex items-center justify-between gap-2.5 cursor-pointer disabled:cursor-wait transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <span className="flex items-center gap-2 text-left leading-snug">
                {checkoutStage === 'idle' ? (
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-200 shrink-0" />
                ) : (
                  <Loader2
                    className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-100 animate-spin shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {checkoutStage === 'creating_order'
                    ? 'Starting Secure Checkout...'
                    : checkoutStage === 'checkout_open'
                      ? 'Complete Payment in Razorpay...'
                      : checkoutStage === 'verifying'
                        ? 'Verifying Payment Signature...'
                        : 'Pay Online (GPay / PhonePe / Paytm)'}
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-emerald-100 tabular-nums shrink-0">
                {formatCurrency(order.totalAmount)}
              </span>
            </button>

            <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-[#475467]">
              <span className="font-semibold text-[#101828]">Google Pay</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#5F259F]">PhonePe</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#002970]">Paytm</span>
              <span aria-hidden="true">·</span>
              <span>Auto-Verified via Razorpay</span>
            </div>

            <div className="pt-2 border-t border-[#F2F4F7]">
              <button
                type="button"
                disabled={checkoutStage !== 'idle'}
                onClick={() => onSelectPayment('cash')}
                className="w-full h-11 px-4 rounded-xl bg-white hover:bg-[#F9FAFB] text-[#344054] border border-[#D0D5DD] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <Wallet className="w-4 h-4" />
                Pay Cash at Counter
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {order.paymentStatus === 'paid' ? (
            /* Green Payment Confirmed Receipt Screen */
            <section
              data-testid="payment-confirmed-receipt"
              className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4"
            >
              <div>
                <div className="w-12 h-12 rounded-full bg-emerald-700 text-white flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                  Payment Confirmed
                </span>
                <h3 className="font-display text-xl font-bold text-emerald-950">
                  Your Payment is Successful! Thank You &amp; Visit Again 🙏
                </h3>
                <p className="text-sm text-emerald-800 mt-1.5">
                  {order.razorpayPaymentId
                    ? `Auto-verified online payment of ${formatCurrency(order.totalAmount)} confirmed for Table ${order.tableNumber}.`
                    : order.paymentMethod === 'upi'
                      ? `UPI payment of ${formatCurrency(order.totalAmount)} confirmed for Table ${order.tableNumber}.`
                      : `Cash payment of ${formatCurrency(order.totalAmount)} confirmed at reception for Table ${order.tableNumber}.`}
                </p>
              </div>

              <div className="max-w-md mx-auto bg-white/90 border border-emerald-200 rounded-lg p-3.5 text-left text-xs space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#475467] whitespace-nowrap shrink-0">
                    Order Receipt
                  </span>
                  <span className="font-mono font-semibold text-[#101828] text-right">
                    {order.orderNumber} · Table {order.tableNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#475467] whitespace-nowrap shrink-0">
                    Amount Paid
                  </span>
                  <span className="font-mono font-bold text-emerald-800 tabular-nums text-right">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#475467] whitespace-nowrap shrink-0">
                    Method
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#101828] text-right">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>
                      {order.razorpayPaymentId
                        ? 'Razorpay UPI (Verified)'
                        : order.paymentMethod === 'upi'
                          ? 'UPI'
                          : 'Cash'}
                    </span>
                  </span>
                </div>
                {order.razorpayPaymentId && (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-emerald-100">
                    <span className="text-[#475467] whitespace-nowrap shrink-0">
                      Payment ID
                    </span>
                    <span
                      data-testid="receipt-payment-id"
                      className="font-mono font-semibold text-emerald-900 select-all text-right break-all"
                    >
                      {order.razorpayPaymentId}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-1 flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={onStartNewOrder}
                  className="text-xs font-semibold text-emerald-900 underline underline-offset-4 hover:text-emerald-700 cursor-pointer"
                >
                  Place Another Order
                </button>
              </div>
            </section>
          ) : (
            /* Pending Cash Payment Banner */
            <section
              data-testid="cash-pending-banner"
              className="bg-amber-50 border border-amber-300 rounded-xl p-6 text-center"
            >
              <div className="w-11 h-11 rounded-full bg-amber-600 text-white flex items-center justify-center mx-auto mb-3">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="font-display text-xl font-bold text-amber-950">
                Please pay {formatCurrency(order.totalAmount)} in cash at the
                Reception Counter
              </h3>
              <p className="text-sm text-amber-900 mt-1.5">
                Payment Status: Pending Counter Settlement · Table{' '}
                {order.tableNumber} ({order.orderNumber})
              </p>
              <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-900">
                  <Clock className="w-3.5 h-3.5" />
                  Method: Cash at Counter
                </span>
                <span aria-hidden="true" className="text-amber-400">
                  ·
                </span>
                <button
                  type="button"
                  onClick={onStartNewOrder}
                  className="text-xs font-semibold text-amber-950 underline underline-offset-4 hover:text-amber-800 cursor-pointer"
                >
                  Place Another Order
                </button>
              </div>
            </section>
          )}

          {/* Post-Payment Review Section */}
          <section className="bg-white border border-[#E4E7EC] rounded-xl p-5 sm:p-6">
            {order.reviewId ? (
              <div className="text-center py-4">
                <p className="font-display text-lg font-bold text-[#101828]">
                  Thank You for Giving a Review! ❤️
                </p>
                <p className="text-sm text-[#475467] mt-1">
                  Your feedback has been shared with {settings.restaurantName}.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmitReview} className="space-y-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#101828]">
                    Review Now
                  </h3>
                  <p className="text-sm text-[#475467] mt-0.5">
                    How was your dining experience at {settings.restaurantName}?
                  </p>
                </div>

                <div>
                  <span className="block text-xs font-medium text-[#344054] mb-2">
                    Your Rating
                  </span>
                  <div
                    className="flex items-center gap-1.5"
                    role="radiogroup"
                    aria-label="Star Rating"
                  >
                    {[1, 2, 3, 4, 5].map((starValue) => {
                      const filled = starValue <= rating;
                      return (
                        <button
                          key={starValue}
                          type="button"
                          onClick={() => onChangeRating(starValue)}
                          aria-label={`Rate ${starValue} out of 5 stars`}
                          aria-checked={rating === starValue}
                          role="radio"
                          className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-amber-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              filled
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-[#D0D5DD]'
                            }`}
                          />
                        </button>
                      );
                    })}
                    <span className="ml-2 text-xs font-medium text-[#475467] tabular-nums">
                      {rating}/5
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="customer-review-comment"
                    className="block text-xs font-medium text-[#344054] mb-1.5"
                  >
                    Feedback (optional)
                  </label>
                  <textarea
                    id="customer-review-comment"
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => onChangeComment(e.target.value)}
                    placeholder="Tell us what you loved about the food or service..."
                    className="w-full px-3 py-2.5 text-sm text-[#101828] bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                  />
                </div>

                {reviewError && (
                  <p className="text-xs font-medium text-red-600">
                    {reviewError}
                  </p>
                )}

                <button
                  type="submit"
                  className="h-11 px-6 rounded-lg bg-[#101828] hover:bg-[#1D2939] text-white text-sm font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  Submit
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
