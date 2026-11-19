import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock,
  Receipt,
  Smartphone,
  Star,
} from 'lucide-react';
import type { Order, RestaurantSettings, Review } from '../types/restaurant';
import { formatCurrency, getTableOccupancy } from '../utils/restaurantLogic';

interface ReceptionViewProps {
  settings: RestaurantSettings;
  orders: Order[];
  reviews: Review[];
  onMarkCashPaid: (orderId: string) => void;
  onClearTable: (tableNumber: number) => void;
  compact?: boolean;
}

export function ReceptionView({
  settings,
  orders,
  reviews,
  onMarkCashPaid,
  onClearTable,
  compact = false,
}: ReceptionViewProps) {
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'paid'>(
    'all'
  );

  const tables = useMemo(
    () => getTableOccupancy(orders, settings.totalTables),
    [orders, settings.totalTables]
  );

  const metrics = useMemo(() => {
    const occupiedCount = tables.filter((t) => t.isOccupied).length;
    const paidTotal = orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const unpaidCount = orders.filter(
      (o) => o.paymentStatus !== 'paid'
    ).length;
    return { occupiedCount, paidTotal, unpaidCount };
  }, [tables, orders]);

  const filteredOrders = useMemo(() => {
    const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt);
    if (paymentFilter === 'unpaid') {
      return sorted.filter((o) => o.paymentStatus !== 'paid');
    }
    if (paymentFilter === 'paid') {
      return sorted.filter((o) => o.paymentStatus === 'paid');
    }
    return sorted;
  }, [orders, paymentFilter]);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] py-6 px-4 sm:px-6">
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Header & Top Metrics */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#101828]">
              Reception Live Billing
            </h1>
            <p className="text-sm text-[#475467] mt-0.5">
              {settings.restaurantName} · Table occupancy, UPI &amp; Cash
              settlement tracking
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white border border-[#E4E7EC] rounded-lg px-3.5 py-2.5">
              <span className="text-xs text-[#475467] block">Tables Busy</span>
              <span className="font-mono text-base font-bold text-[#101828] tabular-nums">
                {metrics.occupiedCount}/{settings.totalTables}
              </span>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-lg px-3.5 py-2.5">
              <span className="text-xs text-[#475467] block">Unpaid Bills</span>
              <span
                className={`font-mono text-base font-bold tabular-nums ${
                  metrics.unpaidCount > 0 ? 'text-red-600' : 'text-[#101828]'
                }`}
              >
                {metrics.unpaidCount}
              </span>
            </div>
            <div className="bg-white border border-[#E4E7EC] rounded-lg px-3.5 py-2.5">
              <span className="text-xs text-[#475467] block">Collected</span>
              <span className="font-mono text-base font-bold text-emerald-700 tabular-nums">
                {formatCurrency(metrics.paidTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Table 1 - Table 6 Occupancy Grid */}
        <section aria-labelledby="tables-heading">
          <div className="flex items-center justify-between mb-3">
            <h2
              id="tables-heading"
              className="font-display text-base font-semibold text-[#101828]"
            >
              Floor Overview (Table 1 – Table {settings.totalTables})
            </h2>
          </div>

          <div
            className={
              compact
                ? 'grid grid-cols-2 sm:grid-cols-3 gap-3'
                : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5'
            }
          >
            {tables.map((t) => (
              <div
                key={t.tableNumber}
                data-testid={`reception-table-${t.tableNumber}`}
                className={`bg-white border rounded-xl p-4 flex flex-col justify-between gap-3 ${
                  t.isOccupied ? 'border-amber-300' : 'border-[#E4E7EC]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-bold text-[#101828]">
                      Table {t.tableNumber}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        t.isOccupied ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {t.isOccupied ? 'Occupied' : 'Available'}
                    </span>
                  </div>

                  {t.isOccupied ? (
                    <div className="mt-2 space-y-0.5 text-xs text-[#475467]">
                      <p className="font-mono font-semibold text-[#101828] tabular-nums">
                        {formatCurrency(t.totalActiveAmount)}
                      </p>
                      <p>
                        {t.unpaidOrdersCount > 0
                          ? `${t.unpaidOrdersCount} unpaid`
                          : 'Paid · Serving'}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[#667085]">
                      Ready for guests
                    </p>
                  )}
                </div>

                {t.isOccupied && t.unpaidOrdersCount === 0 && (
                  <button
                    type="button"
                    onClick={() => onClearTable(t.tableNumber)}
                    className="w-full h-8 text-xs font-semibold text-[#344054] bg-[#F2F4F7] hover:bg-[#E4E7EC] rounded-md cursor-pointer transition-colors"
                  >
                    Clear Table
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Live Billing Feed */}
        <section
          aria-labelledby="billing-feed-heading"
          className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[#E4E7EC] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#475467]" />
              <h2
                id="billing-feed-heading"
                className="font-display text-base font-semibold text-[#101828]"
              >
                Live Billing &amp; Order Feed
              </h2>
            </div>

            <div
              className="inline-flex items-center p-1 bg-[#F2F4F7] rounded-lg self-start sm:self-auto"
              role="group"
              aria-label="Filter Orders by Payment Status"
            >
              {(
                [
                  { id: 'all', label: `All (${orders.length})` },
                  { id: 'unpaid', label: `Unpaid (${metrics.unpaidCount})` },
                  { id: 'paid', label: 'Paid' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPaymentFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                    paymentFilter === tab.id
                      ? 'bg-white text-[#101828] shadow-xs'
                      : 'text-[#475467] hover:text-[#101828]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-[#101828]">
                No orders match this filter yet.
              </p>
              <p className="text-xs text-[#475467] mt-1">
                Orders placed from Table 1–{settings.totalTables} will appear
                here in real time.
              </p>
            </div>
          ) : compact ? (
            <div className="divide-y divide-[#F2F4F7]">
              {filteredOrders.map((order) => {
                const isPaid = order.paymentStatus === 'paid';
                return (
                  <div
                    key={order.id}
                    className="p-4 flex flex-col gap-3 hover:bg-[#F9FAFB] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-[#101828]">
                            Table {order.tableNumber}
                          </span>
                          <span className="font-mono text-xs text-[#475467]">
                            {order.orderNumber}
                          </span>
                          <span className="text-xs text-[#667085]">
                            ·{' '}
                            {order.status === 'received' && 'Order Received'}
                            {order.status === 'preparing' && 'Preparing'}
                            {order.status === 'ready' && 'Ready to Serve'}
                            {order.status === 'completed' && 'Completed'}
                          </span>
                        </div>
                        <p className="text-sm text-[#101828] mt-1">
                          {order.items
                            .map((i) => `${i.quantity}× ${i.name}`)
                            .join(', ')}
                        </p>
                      </div>
                      <span className="font-mono text-base font-bold text-[#101828] tabular-nums shrink-0">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.paymentMethod === 'upi' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#101828]">
                            <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                            UPI
                          </span>
                        ) : order.paymentMethod === 'cash' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#101828]">
                            <Banknote className="w-3.5 h-3.5 text-amber-700" />
                            Cash
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-[#667085]">
                            <Clock className="w-3.5 h-3.5" />
                            Pending
                          </span>
                        )}

                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        ) : order.paymentStatus === 'waiting_confirmation' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-xs font-bold text-amber-800">
                            <Clock className="w-3.5 h-3.5" />
                            Waiting for Confirmation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Unpaid
                          </span>
                        )}
                      </div>

                      {!isPaid ? (
                        <button
                          type="button"
                          onClick={() => onMarkCashPaid(order.id)}
                          className="h-9 px-3.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Confirm Payment Received
                        </button>
                      ) : order.status !== 'completed' ? (
                        <button
                          type="button"
                          onClick={() => onClearTable(order.tableNumber)}
                          className="h-9 px-3 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-[#344054] text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Complete
                        </button>
                      ) : (
                        <span className="text-xs text-[#667085]">Settled</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E7EC] bg-[#F8F9FA] text-xs font-semibold text-[#475467]">
                    <th className="py-3 px-4">Order &amp; Table</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Kitchen</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7] text-sm">
                  {filteredOrders.map((order) => {
                    const isPaid = order.paymentStatus === 'paid';
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-[#F9FAFB] transition-colors"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-display font-bold text-[#101828] block">
                            Table {order.tableNumber}
                          </span>
                          <span className="font-mono text-xs text-[#475467]">
                            {order.orderNumber}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="text-sm text-[#101828]">
                            {order.items
                              .map((i) => `${i.quantity}× ${i.name}`)
                              .join(', ')}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-xs font-medium text-[#475467]">
                          {order.status === 'received' && 'Order Received'}
                          {order.status === 'preparing' && 'Preparing'}
                          {order.status === 'ready' && 'Ready to Serve'}
                          {order.status === 'completed' && 'Completed'}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {order.paymentMethod === 'upi' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#101828]">
                              <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                              UPI
                            </span>
                          ) : order.paymentMethod === 'cash' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#101828]">
                              <Banknote className="w-3.5 h-3.5 text-amber-700" />
                              Cash
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#667085]">
                              <Clock className="w-3.5 h-3.5" />
                              Pending
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Paid
                            </span>
                          ) : order.paymentStatus === 'waiting_confirmation' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-300 text-xs font-bold text-amber-800">
                              <Clock className="w-3.5 h-3.5" />
                              Waiting for Confirmation
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Unpaid
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono font-bold text-[#101828] tabular-nums">
                          {formatCurrency(order.totalAmount)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          {!isPaid ? (
                            <button
                              type="button"
                              onClick={() => onMarkCashPaid(order.id)}
                              className="h-9 px-3.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirm Payment Received
                            </button>
                          ) : order.status !== 'completed' ? (
                            <button
                              type="button"
                              onClick={() => onClearTable(order.tableNumber)}
                              className="h-9 px-3 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-[#344054] text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Complete
                            </button>
                          ) : (
                            <span className="text-xs text-[#667085]">
                              Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent Customer Reviews Synced to Reception */}
        {reviews.length > 0 && (
          <section aria-labelledby="recent-reviews-heading">
            <h2
              id="recent-reviews-heading"
              className="font-display text-base font-semibold text-[#101828] mb-3"
            >
              Recent Guest Reviews ({reviews.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.slice(0, 6).map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-xl bg-white border border-[#E4E7EC]"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-[#101828]">
                      Table {rev.tableNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      {rev.rating}/5
                    </span>
                  </div>
                  <p className="text-sm text-[#344054]">
                    {rev.comment || 'No written comment.'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
