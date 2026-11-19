import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  RestaurantSettings,
  Review,
} from '../types/restaurant';
import {
  DEFAULT_MENU_ITEMS,
  DEFAULT_SETTINGS,
  getNextOrderNumber,
  parseIfStorageChanged,
} from './restaurantLogic';

export const STORAGE_KEYS = {
  settings: 'servesmart_settings_v1',
  menu: 'servesmart_menu_v1',
  orders: 'servesmart_orders_v1',
  reviews: 'servesmart_reviews_v1',
} as const;

const SYNC_EVENT = 'servesmart:local-sync';
export const BROADCAST_CHANNEL_NAME = 'servesmart_sync';

let sharedBroadcastSender: BroadcastChannel | null = null;
function getBroadcastSender(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!sharedBroadcastSender) {
    sharedBroadcastSender = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
  return sharedBroadcastSender;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { key } }));
    const sender = getBroadcastSender();
    if (sender) {
      sender.postMessage({ type: 'SYNC', key, ts: Date.now() });
    }
  } catch {
    // Storage quota or privacy mode fallback
  }
}

function ensureInitialized(): void {
  const storedSettings = readJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  if (
    !storedSettings.upiId?.trim() ||
    storedSettings.upiId === 'lazira@upi' ||
    storedSettings.upiId === 'divengadhavi34@oksbi'
  ) {
    writeJson(STORAGE_KEYS.settings, {
      ...storedSettings,
      upiId: DEFAULT_SETTINGS.upiId,
    });
  }
  readJson(STORAGE_KEYS.menu, DEFAULT_MENU_ITEMS);
  readJson(STORAGE_KEYS.orders, [] as Order[]);
  readJson(STORAGE_KEYS.reviews, [] as Review[]);
}

export function useServeSmartStore() {
  const [settings, setSettingsState] = useState<RestaurantSettings>(() => {
    ensureInitialized();
    return readJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  });

  const [menu, setMenuState] = useState<MenuItem[]>(() =>
    readJson(STORAGE_KEYS.menu, DEFAULT_MENU_ITEMS)
  );

  const [orders, setOrdersState] = useState<Order[]>(() =>
    readJson(STORAGE_KEYS.orders, [])
  );

  const [reviews, setReviewsState] = useState<Review[]>(() =>
    readJson(STORAGE_KEYS.reviews, [])
  );

  const lastRawRef = useRef<Record<string, string | null>>({
    [STORAGE_KEYS.settings]: null,
    [STORAGE_KEYS.menu]: null,
    [STORAGE_KEYS.orders]: null,
    [STORAGE_KEYS.reviews]: null,
  });

  const syncAll = useCallback(() => {
    try {
      const nextSettingsRaw = window.localStorage.getItem(STORAGE_KEYS.settings);
      const settingsRes = parseIfStorageChanged<RestaurantSettings>(
        lastRawRef.current[STORAGE_KEYS.settings],
        nextSettingsRaw
      );
      if (settingsRes.changed && settingsRes.value) {
        lastRawRef.current[STORAGE_KEYS.settings] = nextSettingsRaw;
        setSettingsState(settingsRes.value);
      }

      const nextMenuRaw = window.localStorage.getItem(STORAGE_KEYS.menu);
      const menuRes = parseIfStorageChanged<MenuItem[]>(
        lastRawRef.current[STORAGE_KEYS.menu],
        nextMenuRaw
      );
      if (menuRes.changed && menuRes.value) {
        lastRawRef.current[STORAGE_KEYS.menu] = nextMenuRaw;
        setMenuState(menuRes.value);
      }

      const nextOrdersRaw = window.localStorage.getItem(STORAGE_KEYS.orders);
      const ordersRes = parseIfStorageChanged<Order[]>(
        lastRawRef.current[STORAGE_KEYS.orders],
        nextOrdersRaw
      );
      if (ordersRes.changed && ordersRes.value) {
        lastRawRef.current[STORAGE_KEYS.orders] = nextOrdersRaw;
        setOrdersState(ordersRes.value);
      }

      const nextReviewsRaw = window.localStorage.getItem(STORAGE_KEYS.reviews);
      const reviewsRes = parseIfStorageChanged<Review[]>(
        lastRawRef.current[STORAGE_KEYS.reviews],
        nextReviewsRaw
      );
      if (reviewsRes.changed && reviewsRes.value) {
        lastRawRef.current[STORAGE_KEYS.reviews] = nextReviewsRaw;
        setReviewsState(reviewsRes.value);
      }
    } catch {
      // Ignore storage access errors in restricted environments
    }
  }, []);

  useEffect(() => {
    syncAll();

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || Object.values(STORAGE_KEYS).includes(e.key as never)) {
        syncAll();
      }
    };

    const handleLocalSync = () => {
      syncAll();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncAll();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(SYNC_EVENT, handleLocalSync);
    window.addEventListener('focus', handleLocalSync);
    document.addEventListener('visibilitychange', handleVisibility);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = () => {
        syncAll();
      };
    }

    const pollInterval = window.setInterval(() => {
      syncAll();
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(SYNC_EVENT, handleLocalSync);
      window.removeEventListener('focus', handleLocalSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(pollInterval);
      if (channel) {
        channel.close();
      }
    };
  }, [syncAll]);

  const updateSettings = useCallback((next: Partial<RestaurantSettings>) => {
    const current = readJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    const updated: RestaurantSettings = { ...current, ...next };
    writeJson(STORAGE_KEYS.settings, updated);
    setSettingsState(updated);
  }, []);

  const addMenuItem = useCallback((item: Omit<MenuItem, 'id'>) => {
    const current = readJson(STORAGE_KEYS.menu, DEFAULT_MENU_ITEMS);
    const newItem: MenuItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    const updated = [...current, newItem];
    writeJson(STORAGE_KEYS.menu, updated);
    setMenuState(updated);
    return newItem;
  }, []);

  const updateMenuItem = useCallback(
    (id: string, patch: Partial<Omit<MenuItem, 'id'>>) => {
      const current = readJson(STORAGE_KEYS.menu, DEFAULT_MENU_ITEMS);
      const updated = current.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      );
      writeJson(STORAGE_KEYS.menu, updated);
      setMenuState(updated);
    },
    []
  );

  const deleteMenuItem = useCallback((id: string) => {
    const current = readJson(STORAGE_KEYS.menu, DEFAULT_MENU_ITEMS);
    const updated = current.filter((item) => item.id !== id);
    writeJson(STORAGE_KEYS.menu, updated);
    setMenuState(updated);
  }, []);

  const placeOrder = useCallback(
    (
      tableNumber: number,
      items: OrderItem[],
      totalAmount: number,
      estimatedPrepMins: number
    ): Order => {
      const current = readJson(STORAGE_KEYS.orders, [] as Order[]);
      const now = Date.now();
      const newOrder: Order = {
        id: `ord-${now}-${Math.random().toString(36).slice(2, 6)}`,
        orderNumber: getNextOrderNumber(current),
        tableNumber,
        items,
        totalAmount,
        estimatedPrepMins,
        status: 'received',
        paymentMethod: null,
        paymentStatus: 'unpaid',
        createdAt: now,
        prepStartedAt: null,
        readyAt: null,
        paidAt: null,
        reviewId: null,
      };
      const updated = [newOrder, ...current];
      writeJson(STORAGE_KEYS.orders, updated);
      setOrdersState(updated);
      return newOrder;
    },
    []
  );

  const updateOrderStatus = useCallback(
    (orderId: string, status: OrderStatus) => {
      const current = readJson(STORAGE_KEYS.orders, [] as Order[]);
      const now = Date.now();
      const updated = current.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status,
          prepStartedAt:
            status === 'preparing' && !o.prepStartedAt ? now : o.prepStartedAt,
          readyAt: status === 'ready' && !o.readyAt ? now : o.readyAt,
        };
      });
      writeJson(STORAGE_KEYS.orders, updated);
      setOrdersState(updated);
    },
    []
  );

  const selectOrderPayment = useCallback(
    (orderId: string, method: Exclude<PaymentMethod, null>) => {
      const current = readJson(STORAGE_KEYS.orders, [] as Order[]);
      const updated = current.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          paymentMethod: method,
          paymentStatus:
            method === 'upi'
              ? ('waiting_confirmation' as const)
              : ('unpaid' as const),
        };
      });
      writeJson(STORAGE_KEYS.orders, updated);
      setOrdersState(updated);
    },
    []
  );

  const markCashPaid = useCallback((orderId: string) => {
    const current = readJson(STORAGE_KEYS.orders, [] as Order[]);
    const now = Date.now();
    const updated = current.map((o) => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        paymentMethod: o.paymentMethod ?? 'cash',
        paymentStatus: 'paid' as const,
        paidAt: now,
      };
    });
    writeJson(STORAGE_KEYS.orders, updated);
    setOrdersState(updated);
  }, []);

  const clearTableOrders = useCallback((tableNumber: number) => {
    const current = readJson(STORAGE_KEYS.orders, [] as Order[]);
    const now = Date.now();
    const updated = current.map((o) => {
      if (o.tableNumber !== tableNumber) return o;
      return {
        ...o,
        status: 'completed' as const,
        paymentStatus: 'paid' as const,
        paidAt: o.paidAt ?? now,
      };
    });
    writeJson(STORAGE_KEYS.orders, updated);
    setOrdersState(updated);
  }, []);

  const submitReview = useCallback(
    (orderId: string, tableNumber: number, rating: number, comment: string) => {
      const currentReviews = readJson(STORAGE_KEYS.reviews, [] as Review[]);
      const currentOrders = readJson(STORAGE_KEYS.orders, [] as Order[]);
      const now = Date.now();
      const newReview: Review = {
        id: `rev-${now}-${Math.random().toString(36).slice(2, 6)}`,
        orderId,
        tableNumber,
        rating,
        comment: comment.trim(),
        createdAt: now,
      };
      const updatedReviews = [newReview, ...currentReviews];
      const updatedOrders = currentOrders.map((o) =>
        o.id === orderId ? { ...o, reviewId: newReview.id } : o
      );
      writeJson(STORAGE_KEYS.reviews, updatedReviews);
      writeJson(STORAGE_KEYS.orders, updatedOrders);
      setReviewsState(updatedReviews);
      setOrdersState(updatedOrders);
      return newReview;
    },
    []
  );

  return {
    settings,
    menu,
    orders,
    reviews,
    updateSettings,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    placeOrder,
    updateOrderStatus,
    selectOrderPayment,
    markCashPaid,
    clearTableOrders,
    submitReview,
    syncFromStorage: syncAll,
  };
}
