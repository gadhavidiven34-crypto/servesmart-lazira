import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Order, OrderStatus } from '../types/restaurant';
import { playKitchenBell } from '../utils/sound';

interface KitchenViewProps {
  orders: Order[];
  restaurantName: string;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}

export function KitchenView({
  orders,
  restaurantName,
  onUpdateStatus,
}: KitchenViewProps) {
  const [filter, setFilter] = useState<'active' | 'ready' | 'all'>('active');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderBanner, setNewOrderBanner] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const seenOrderIdsRef = useRef<Set<string>>(
    new Set(orders.map((o) => o.id))
  );

  // Tick elapsed timer every second
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Detect newly arrived orders while on Kitchen screen
  useEffect(() => {
    const newlyArrived = orders.filter(
      (o) => o.status === 'received' && !seenOrderIdsRef.current.has(o.id)
    );
    for (const o of orders) {
      seenOrderIdsRef.current.add(o.id);
    }

    if (newlyArrived.length > 0) {
      const latest = newlyArrived[0];
      setNewOrderBanner(
        `New Order ${latest.orderNumber} received for Table ${latest.tableNumber}`
      );
      if (soundEnabled) {
        playKitchenBell();
      }
      const timeout = window.setTimeout(() => {
        setNewOrderBanner(null);
      }, 6000);
      return () => window.clearTimeout(timeout);
    }
  }, [orders, soundEnabled]);

  const counts = useMemo(() => {
    const received = orders.filter((o) => o.status === 'received').length;
    const preparing = orders.filter((o) => o.status === 'preparing').length;
    const ready = orders.filter((o) => o.status === 'ready').length;
    return { received, preparing, ready, active: received + preparing };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const sorted = [...orders].sort((a, b) => a.createdAt - b.createdAt);
    if (filter === 'active') {
      return sorted.filter(
        (o) => o.status === 'received' || o.status === 'preparing'
      );
    }
    if (filter === 'ready') {
      return sorted.filter((o) => o.status === 'ready');
    }
    return sorted.filter((o) => o.status !== 'completed');
  }, [orders, filter]);

  const formatElapsed = (createdAt: number) => {
    const diffSecs = Math.max(0, Math.floor((nowMs - createdAt) / 1000));
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#0B1120] text-slate-100 py-6 px-4 sm:px-6">
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* KDS Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-[#1E293B]">
          <div>
            <div className="flex items-center gap-3">
              <ChefHat className="w-6 h-6 text-amber-400 shrink-0" />
              <h1 className="font-display text-2xl font-bold tracking-tight text-white">
                Kitchen Display System
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1 tabular-nums">
              {restaurantName} · {counts.received} Received ·{' '}
              {counts.preparing} Preparing · {counts.ready} Ready
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="inline-flex items-center p-1 bg-[#131C31] border border-[#24324E] rounded-lg"
              role="group"
              aria-label="Kitchen Order Filters"
            >
              {(
                [
                  { id: 'active', label: `Active (${counts.active})` },
                  { id: 'ready', label: `Ready (${counts.ready})` },
                  { id: 'all', label: 'All Tickets' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                    filter === tab.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playKitchenBell();
              }}
              className="h-9 px-3 rounded-lg bg-[#131C31] border border-[#24324E] text-xs font-semibold text-slate-200 hover:bg-[#1C2842] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  Chime On
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-500" />
                  Muted
                </>
              )}
            </button>
          </div>
        </div>

        {/* Visual Alert Banner on New Incoming Order */}
        {newOrderBanner && (
          <div
            role="status"
            className="bg-amber-500/15 border border-amber-400/50 text-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              <Bell className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{newOrderBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setNewOrderBanner(null)}
              className="text-xs font-medium text-amber-300 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active Kitchen Order Tickets */}
        {filteredOrders.length === 0 ? (
          <div className="bg-[#131C31] border border-[#24324E] rounded-xl p-12 text-center">
            <ChefHat className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h2 className="font-display text-lg font-semibold text-white">
              {filter === 'active'
                ? 'No Pending Kitchen Tickets'
                : 'No Orders in This View'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              New customer orders placed from any table will appear here
              instantly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOrders.map((order) => {
              const isReceived = order.status === 'received';
              const isPreparing = order.status === 'preparing';
              const isReady = order.status === 'ready';

              return (
                <article
                  key={order.id}
                  data-testid={`kitchen-ticket-${order.orderNumber}`}
                  className={`bg-[#131C31] border rounded-xl flex flex-col justify-between overflow-hidden ${
                    isReceived
                      ? 'border-amber-400/60'
                      : isPreparing
                        ? 'border-sky-400/60'
                        : 'border-emerald-500/50'
                  }`}
                >
                  <div>
                    {/* Ticket Header */}
                    <div
                      className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
                        isReceived
                          ? 'bg-amber-500/10 border-amber-400/30'
                          : isPreparing
                            ? 'bg-sky-500/10 border-sky-400/30'
                            : 'bg-emerald-500/10 border-emerald-500/30'
                      }`}
                    >
                      <div>
                        <span className="font-display text-2xl font-extrabold tracking-normal text-white block">
                          TABLE {order.tableNumber}
                        </span>
                        <span className="font-mono text-xs text-slate-300">
                          {order.orderNumber}
                        </span>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                            isReceived
                              ? 'text-amber-300'
                              : isPreparing
                                ? 'text-sky-300'
                                : 'text-emerald-300'
                          }`}
                        >
                          {isReceived && <Bell className="w-3.5 h-3.5" />}
                          {isPreparing && <Flame className="w-3.5 h-3.5" />}
                          {isReady && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {isReceived
                            ? 'New Order'
                            : isPreparing
                              ? 'Preparing'
                              : 'Ready'}
                        </span>
                        <div className="flex items-center justify-end gap-1.5 text-xs text-slate-300 font-mono tabular-nums mt-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatElapsed(order.createdAt)}</span>
                          <span aria-hidden="true">/</span>
                          <span>{order.estimatedPrepMins}m target</span>
                        </div>
                      </div>
                    </div>

                    {order.paymentStatus === 'paid' && (
                      <div className="px-5 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {order.razorpayPaymentId
                            ? 'Paid · Razorpay'
                            : order.paymentMethod === 'upi'
                              ? 'Paid · UPI'
                              : 'Paid · Cash'}
                        </span>
                        {order.razorpayPaymentId && (
                          <span
                            data-testid="kitchen-razorpay-id"
                            className="font-mono text-[11px] text-emerald-200 truncate"
                          >
                            {order.razorpayPaymentId}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Ticket Line Items */}
                    <ul className="p-5 divide-y divide-[#1E293B]">
                      {order.items.map((item) => (
                        <li
                          key={item.menuItemId}
                          className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-md bg-[#1E293B] border border-[#334155] font-mono text-sm font-bold text-amber-300 flex items-center justify-center tabular-nums shrink-0">
                              {item.quantity}×
                            </span>
                            <span className="text-base font-semibold text-slate-100">
                              {item.name}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                            {item.prepTimeMins}m
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Ticket Actions */}
                  <div className="p-4 bg-[#0F172A] border-t border-[#1E293B]">
                    {isReceived && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.id, 'preparing')}
                        className="w-full h-11 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-sm font-bold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      >
                        Start Preparing
                      </button>
                    )}

                    {isPreparing && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.id, 'ready')}
                        className="w-full h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-sm font-bold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                      >
                        Mark Ready
                      </button>
                    )}

                    {isReady && (
                      <div className="h-11 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Ready to Serve at Table {order.tableNumber}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
