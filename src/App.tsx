import { useCallback, useEffect, useState } from 'react';
import { AdminView } from './components/AdminView';
import { CustomerView } from './components/CustomerView';
import { KitchenView } from './components/KitchenView';
import { ReceptionView } from './components/ReceptionView';
import { TableQrGrid } from './components/TableQrGrid';
import { TopNav } from './components/TopNav';
import type { AppView } from './types/restaurant';
import {
  getRoutePath,
  isCustomerOnlyUrl,
  parseRoute,
} from './utils/restaurantLogic';
import { useServeSmartStore } from './utils/storage';

export default function App() {
  const {
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
    syncFromStorage,
  } = useServeSmartStore();

  const [route, setRoute] = useState(() =>
    parseRoute(
      window.location.pathname,
      settings.totalTables,
      window.location.search,
      window.location.hash
    )
  );
  const [customerOnlyMode, setCustomerOnlyMode] = useState(() =>
    isCustomerOnlyUrl(
      window.location.pathname,
      window.location.search,
      window.location.hash
    )
  );
  const [splitDemoMode, setSplitDemoMode] = useState(false);

  // Sync URL on browser back/forward or hash changes
  useEffect(() => {
    const handleRouteSync = () => {
      const nextCustomerOnly = isCustomerOnlyUrl(
        window.location.pathname,
        window.location.search,
        window.location.hash
      );
      setCustomerOnlyMode(nextCustomerOnly);
      if (nextCustomerOnly) {
        setSplitDemoMode(false);
      }
      setRoute(
        parseRoute(
          window.location.pathname,
          settings.totalTables,
          window.location.search,
          window.location.hash
        )
      );
    };
    window.addEventListener('popstate', handleRouteSync);
    window.addEventListener('hashchange', handleRouteSync);
    return () => {
      window.removeEventListener('popstate', handleRouteSync);
      window.removeEventListener('hashchange', handleRouteSync);
    };
  }, [settings.totalTables]);

  // Staff / Demo navigation from TopNav (keeps home URL "/" without ?table= so TopNav stays visible)
  const navigate = useCallback(
    (view: AppView, tableNumber?: number) => {
      const targetTable = tableNumber ?? route.tableNumber;
      setSplitDemoMode(false);
      setCustomerOnlyMode(false);

      const nextUrl =
        view === 'customer' ? '/' : getRoutePath(view, targetTable);

      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl !== nextUrl) {
        window.history.pushState(null, '', nextUrl);
      }
      setRoute({ view, tableNumber: targetTable });
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [route.tableNumber]
  );

  // Open a real Customer QR URL (/?table=X) from Table QRs / Admin -> enters Customer Mode without TopNav
  const openCustomerTableLink = useCallback((tableNumber: number) => {
    setSplitDemoMode(false);
    setCustomerOnlyMode(true);
    const nextUrl = `/?table=${tableNumber}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.pushState(null, '', nextUrl);
    }
    setRoute({ view: 'customer', tableNumber });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // In-place table switcher used in Home/Demo mode & Split View (keeps URL without ?table= so TopNav stays visible)
  const handleChangeTableInPlace = useCallback((tableNumber: number) => {
    setRoute((prev) => ({ ...prev, tableNumber }));
  }, []);

  // Customer QR / Table Link Mode: Hide staff TopNav completely and lock to this table
  if (customerOnlyMode) {
    return (
      <div className="min-h-screen flex flex-col">
        <CustomerView
          tableNumber={route.tableNumber}
          settings={settings}
          menu={menu}
          orders={orders}
          onChangeTable={handleChangeTableInPlace}
          onPlaceOrder={placeOrder}
          onSelectPayment={selectOrderPayment}
          onConfirmPayment={markCashPaid}
          onSubmitReview={submitReview}
          onSyncFromStorage={syncFromStorage}
          customerOnlyMode
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav
        activeView={route.view}
        activeTable={route.tableNumber}
        restaurantName={settings.restaurantName}
        splitDemoMode={splitDemoMode}
        onToggleSplitDemo={() => setSplitDemoMode((prev) => !prev)}
        onNavigate={navigate}
      />

      {splitDemoMode ? (
        <div
          data-testid="live-demo-split-view"
          className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E4E7EC] bg-[#F8F9FA]"
        >
          {/* Left Pane: Customer Screen */}
          <div
            data-testid="split-customer-pane"
            className="min-w-0 flex flex-col lg:h-[calc(100vh-3.5rem)] bg-[#F8F9FA]"
          >
            <div className="shrink-0 px-4 py-2 bg-emerald-950 text-emerald-50 text-xs font-semibold flex items-center justify-between">
              <span>Customer Screen — Table {route.tableNumber}</span>
              <span className="font-mono text-emerald-300">
                ?table={route.tableNumber}
              </span>
            </div>
            <div className="flex-1 min-h-0 lg:overflow-y-auto">
              <CustomerView
                tableNumber={route.tableNumber}
                settings={settings}
                menu={menu}
                orders={orders}
                onChangeTable={handleChangeTableInPlace}
                onPlaceOrder={placeOrder}
                onSelectPayment={selectOrderPayment}
                onConfirmPayment={markCashPaid}
                onSubmitReview={submitReview}
                onSyncFromStorage={syncFromStorage}
                embedded
              />
            </div>
          </div>

          {/* Right Pane: Reception Dashboard */}
          <div
            data-testid="split-reception-pane"
            className="min-w-0 flex flex-col lg:h-[calc(100vh-3.5rem)] bg-[#F8F9FA]"
          >
            <div className="shrink-0 px-4 py-2 bg-[#101828] text-slate-100 text-xs font-semibold flex items-center justify-between">
              <span>Reception Dashboard — Live Billing</span>
              <span className="font-mono text-slate-300">/reception</span>
            </div>
            <div className="flex-1 min-h-0 lg:overflow-y-auto">
              <ReceptionView
                settings={settings}
                orders={orders}
                reviews={reviews}
                onMarkCashPaid={markCashPaid}
                onClearTable={clearTableOrders}
                compact
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {route.view === 'customer' && (
            <CustomerView
              tableNumber={route.tableNumber}
              settings={settings}
              menu={menu}
              orders={orders}
              onChangeTable={handleChangeTableInPlace}
              onPlaceOrder={placeOrder}
              onSelectPayment={selectOrderPayment}
              onConfirmPayment={markCashPaid}
              onSubmitReview={submitReview}
              onSyncFromStorage={syncFromStorage}
            />
          )}

          {route.view === 'kitchen' && (
            <KitchenView
              orders={orders}
              restaurantName={settings.restaurantName}
              onUpdateStatus={updateOrderStatus}
            />
          )}

          {route.view === 'reception' && (
            <ReceptionView
              settings={settings}
              orders={orders}
              reviews={reviews}
              onMarkCashPaid={markCashPaid}
              onClearTable={clearTableOrders}
            />
          )}

          {route.view === 'table-qrs' && (
            <main className="min-h-[calc(100vh-3.5rem)] py-6 px-4 sm:px-6">
              <div className="max-w-[1200px] mx-auto space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-[#101828]">
                    {settings.restaurantName} — Table QR Standees
                  </h1>
                  <p className="text-sm text-[#475467] mt-0.5">
                    Print or download high-resolution PNG QR codes for Tables 1–
                    {settings.totalTables}.
                  </p>
                </div>
                <TableQrGrid
                  settings={settings}
                  menu={menu}
                  onOpenTable={openCustomerTableLink}
                />
              </div>
            </main>
          )}

          {route.view === 'admin' && (
            <AdminView
              settings={settings}
              menu={menu}
              orders={orders}
              reviews={reviews}
              onUpdateSettings={updateSettings}
              onAddMenuItem={addMenuItem}
              onUpdateMenuItem={updateMenuItem}
              onDeleteMenuItem={deleteMenuItem}
              onOpenTable={openCustomerTableLink}
            />
          )}
        </>
      )}
    </div>
  );
}
