import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTableQrUrl,
  buildUpiUri,
  calculateCartSummary,
  calculateRevenueSummary,
  computeRemainingSeconds,
  DEFAULT_MENU_ITEMS,
  DEFAULT_SETTINGS,
  filterCompletedOrders,
  formatCountdown,
  getDefaultLiveBaseUrl,
  getLocalDateKey,
  getRoutePath,
  getTableOccupancy,
  getTablePaidOrderHistory,
  isCustomerOnlyUrl,
  parseIfStorageChanged,
  parseRoute,
} from './restaurantLogic';
import type { Order } from '../types/restaurant';

test('parseRoute detects table numbers and staff views accurately', () => {
  assert.deepEqual(parseRoute('/table/1'), { view: 'customer', tableNumber: 1 });
  assert.deepEqual(parseRoute('/table/4'), { view: 'customer', tableNumber: 4 });
  assert.deepEqual(parseRoute('/table/6/'), { view: 'customer', tableNumber: 6 });
  assert.deepEqual(parseRoute('/table/99', 6), { view: 'customer', tableNumber: 6 });
  assert.deepEqual(parseRoute('/kitchen'), { view: 'kitchen', tableNumber: 1 });
  assert.deepEqual(parseRoute('/reception'), { view: 'reception', tableNumber: 1 });
  assert.deepEqual(parseRoute('/table-qrs'), { view: 'table-qrs', tableNumber: 1 });
  assert.deepEqual(parseRoute('/admin'), { view: 'admin', tableNumber: 1 });
  assert.deepEqual(parseRoute('/'), { view: 'customer', tableNumber: 1 });
  assert.deepEqual(parseRoute('/', 6, '?table=5'), { view: 'customer', tableNumber: 5 });
  assert.deepEqual(parseRoute('/index.html', 6, '?table=3'), { view: 'customer', tableNumber: 3 });
  assert.deepEqual(parseRoute('/', 6, '', '#/table/4'), { view: 'customer', tableNumber: 4 });
  assert.deepEqual(parseRoute('/', 6, '', '#table=6'), { view: 'customer', tableNumber: 6 });
});

test('getDefaultLiveBaseUrl and buildTableQrUrl build clean non-404 query-param table links', () => {
  assert.equal(
    getDefaultLiveBaseUrl('https://lazira.run.app', '/table-qrs'),
    'https://lazira.run.app/'
  );
  assert.equal(
    getDefaultLiveBaseUrl('https://lazira.run.app', '/app/admin'),
    'https://lazira.run.app/app'
  );
  assert.equal(
    buildTableQrUrl('https://lazira.run.app/', 2),
    'https://lazira.run.app/?table=2'
  );
  assert.equal(
    buildTableQrUrl('https://lazira.run.app/?table=1', 4),
    'https://lazira.run.app/?table=4'
  );
  assert.equal(
    buildTableQrUrl('lazira.example.com', 6),
    'https://lazira.example.com/?table=6'
  );
});

test('isCustomerOnlyUrl hides staff navigation on table QR links and keeps it on home/staff URLs', () => {
  assert.equal(isCustomerOnlyUrl('/', '?table=1'), true);
  assert.equal(isCustomerOnlyUrl('/index.html', '?table=5'), true);
  assert.equal(isCustomerOnlyUrl('/table/2'), true);
  assert.equal(isCustomerOnlyUrl('/table/6/'), true);
  assert.equal(isCustomerOnlyUrl('/', '', '#table=3'), true);
  assert.equal(isCustomerOnlyUrl('/', '', '#/table/4'), true);

  assert.equal(isCustomerOnlyUrl('/'), false);
  assert.equal(isCustomerOnlyUrl('/kitchen'), false);
  assert.equal(isCustomerOnlyUrl('/reception'), false);
  assert.equal(isCustomerOnlyUrl('/table-qrs'), false);
  assert.equal(isCustomerOnlyUrl('/admin'), false);
});

test('getRoutePath produces canonical URLs', () => {
  assert.equal(getRoutePath('customer', 3), '/table/3');
  assert.equal(getRoutePath('kitchen'), '/kitchen');
  assert.equal(getRoutePath('reception'), '/reception');
  assert.equal(getRoutePath('table-qrs'), '/table-qrs');
  assert.equal(getRoutePath('admin'), '/admin');
});

test('calculateCartSummary computes items, bill total, and max parallel prep time', () => {
  const cart = {
    'item-masala-tea': 2, // 2 * 50 = 100, 5 mins
    'item-pizza': 1, // 1 * 100 = 100, 15 mins
    'item-chocolate': 0,
  };
  const summary = calculateCartSummary(cart, DEFAULT_MENU_ITEMS);
  assert.equal(summary.totalItems, 3);
  assert.equal(summary.totalAmount, 200);
  assert.equal(summary.estimatedPrepMins, 15);
  assert.equal(summary.lineItems.length, 2);
});

test('buildUpiUri constructs exact scannable UPI deep link with default gadhavidiven34@oksbi', () => {
  assert.equal(DEFAULT_SETTINGS.upiId, 'gadhavidiven34@oksbi');
  assert.equal(
    buildUpiUri(DEFAULT_SETTINGS.upiId, DEFAULT_SETTINGS.restaurantName, 150),
    'upi://pay?pa=gadhavidiven34@oksbi&pn=Lazira%20Restaurant&am=150&cu=INR'
  );
});

test('computeRemainingSeconds and formatCountdown calculate remaining kitchen time', () => {
  const now = 1_700_000_000_000;
  const order: Order = {
    id: 'o1',
    orderNumber: 'ORD-101',
    tableNumber: 2,
    items: [],
    totalAmount: 150,
    estimatedPrepMins: 15,
    status: 'preparing',
    paymentMethod: null,
    paymentStatus: 'unpaid',
    createdAt: now - 30_000, // 30 seconds elapsed
    prepStartedAt: now - 10_000,
    readyAt: null,
    paidAt: null,
    reviewId: null,
  };
  assert.equal(computeRemainingSeconds(order, now), 14 * 60 + 30);
  assert.equal(formatCountdown(14 * 60 + 30), '14:30');

  const readyOrder: Order = { ...order, status: 'ready' };
  assert.equal(computeRemainingSeconds(readyOrder, now), 0);
  assert.equal(formatCountdown(0), '00:00');
});

test('getTableOccupancy marks tables occupied while active or unpaid and available when completed & paid', () => {
  const baseOrder: Order = {
    id: 'o1',
    orderNumber: 'ORD-101',
    tableNumber: 3,
    items: [],
    totalAmount: 200,
    estimatedPrepMins: 10,
    status: 'received',
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    createdAt: 1000,
    prepStartedAt: null,
    readyAt: null,
    paidAt: null,
    reviewId: null,
  };

  const occupancy1 = getTableOccupancy([baseOrder], 6);
  assert.equal(occupancy1[2].tableNumber, 3);
  assert.equal(occupancy1[2].isOccupied, true);
  assert.equal(occupancy1[2].unpaidOrdersCount, 1);
  assert.equal(occupancy1[0].isOccupied, false);

  const waitingOrder: Order = {
    ...baseOrder,
    paymentMethod: 'upi',
    paymentStatus: 'waiting_confirmation',
  };
  const occupancyWaiting = getTableOccupancy([waitingOrder], 6);
  assert.equal(occupancyWaiting[2].isOccupied, true);
  assert.equal(occupancyWaiting[2].unpaidOrdersCount, 1);

  const clearedOrder: Order = {
    ...baseOrder,
    status: 'completed',
    paymentStatus: 'paid',
    paidAt: 2000,
  };
  const occupancy2 = getTableOccupancy([clearedOrder], 6);
  assert.equal(occupancy2[2].isOccupied, false);
});

test('filterCompletedOrders and calculateRevenueSummary sum completed orders by date and table', () => {
  const day1 = new Date(2026, 10, 18, 12, 30, 0).getTime();
  const day2 = new Date(2026, 10, 19, 14, 0, 0).getTime();
  const day1Key = getLocalDateKey(day1);

  const sampleOrders: Order[] = [
    {
      id: 'o1',
      orderNumber: 'ORD-101',
      tableNumber: 1,
      items: [],
      totalAmount: 150,
      estimatedPrepMins: 10,
      status: 'completed',
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      createdAt: day1,
      prepStartedAt: day1,
      readyAt: day1,
      paidAt: day1,
      reviewId: null,
    },
    {
      id: 'o2',
      orderNumber: 'ORD-102',
      tableNumber: 2,
      items: [],
      totalAmount: 200,
      estimatedPrepMins: 10,
      status: 'completed',
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      createdAt: day2,
      prepStartedAt: day2,
      readyAt: day2,
      paidAt: day2,
      reviewId: null,
    },
    {
      id: 'o3',
      orderNumber: 'ORD-103',
      tableNumber: 1,
      items: [],
      totalAmount: 500,
      estimatedPrepMins: 10,
      status: 'preparing', // not completed -> excluded
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      createdAt: day1,
      prepStartedAt: day1,
      readyAt: null,
      paidAt: day1,
      reviewId: null,
    },
  ];

  const allCompleted = filterCompletedOrders(sampleOrders);
  assert.equal(allCompleted.length, 2);
  const allSummary = calculateRevenueSummary(allCompleted);
  assert.equal(allSummary.totalSales, 350);
  assert.equal(allSummary.orderCount, 2);
  assert.equal(allSummary.averageOrderValue, 175);
  assert.equal(allSummary.upiSales, 150);
  assert.equal(allSummary.cashSales, 200);

  const table1Only = filterCompletedOrders(sampleOrders, { tableNumber: 1 });
  assert.equal(calculateRevenueSummary(table1Only).totalSales, 150);

  const day1Only = filterCompletedOrders(sampleOrders, { date: day1Key });
  assert.equal(calculateRevenueSummary(day1Only).totalSales, 150);
});

test('getTablePaidOrderHistory returns only paid orders for the requested table sorted newest first', () => {
  const sampleOrders: Order[] = [
    {
      id: 'o1',
      orderNumber: 'ORD-101',
      tableNumber: 2,
      items: [],
      totalAmount: 100,
      estimatedPrepMins: 5,
      status: 'preparing',
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      createdAt: 1000,
      prepStartedAt: 1100,
      readyAt: null,
      paidAt: 1200,
      reviewId: null,
    },
    {
      id: 'o2',
      orderNumber: 'ORD-102',
      tableNumber: 2,
      items: [],
      totalAmount: 200,
      estimatedPrepMins: 10,
      status: 'received',
      paymentMethod: 'cash',
      paymentStatus: 'unpaid',
      createdAt: 2000,
      prepStartedAt: null,
      readyAt: null,
      paidAt: null,
      reviewId: null,
    },
    {
      id: 'o3',
      orderNumber: 'ORD-103',
      tableNumber: 2,
      items: [],
      totalAmount: 70,
      estimatedPrepMins: 5,
      status: 'completed',
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      createdAt: 3000,
      prepStartedAt: 3100,
      readyAt: 3200,
      paidAt: 3500,
      reviewId: null,
    },
    {
      id: 'o4',
      orderNumber: 'ORD-104',
      tableNumber: 4,
      items: [],
      totalAmount: 50,
      estimatedPrepMins: 5,
      status: 'completed',
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      createdAt: 4000,
      prepStartedAt: null,
      readyAt: null,
      paidAt: 4100,
      reviewId: null,
    },
  ];

  const t2History = getTablePaidOrderHistory(sampleOrders, 2);
  assert.deepEqual(
    t2History.map((o) => o.id),
    ['o3', 'o1']
  );
  assert.equal(getTablePaidOrderHistory(sampleOrders, 1).length, 0);
});

test('parseIfStorageChanged skips unchanged or malformed payloads and parses real updates', () => {
  const raw1 = JSON.stringify([{ id: 'o1', paymentStatus: 'unpaid' }]);
  const raw2 = JSON.stringify([{ id: 'o1', paymentStatus: 'paid' }]);

  assert.deepEqual(parseIfStorageChanged(raw1, raw1), {
    changed: false,
    value: null,
  });
  assert.deepEqual(parseIfStorageChanged(raw1, null), {
    changed: false,
    value: null,
  });
  assert.deepEqual(parseIfStorageChanged(raw1, '{bad json'), {
    changed: false,
    value: null,
  });
  assert.deepEqual(parseIfStorageChanged<Array<{ id: string; paymentStatus: string }>>(raw1, raw2), {
    changed: true,
    value: [{ id: 'o1', paymentStatus: 'paid' }],
  });
});

