import { Columns2 } from 'lucide-react';
import type { AppView } from '../types/restaurant';

interface TopNavProps {
  activeView: AppView;
  activeTable: number;
  restaurantName: string;
  splitDemoMode: boolean;
  onToggleSplitDemo: () => void;
  onNavigate: (view: AppView, tableNumber?: number) => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'customer', label: 'Table Order' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'reception', label: 'Reception' },
  { id: 'table-qrs', label: 'Table QRs' },
  { id: 'admin', label: 'Admin' },
];

export function TopNav({
  activeView,
  activeTable,
  splitDemoMode,
  onToggleSplitDemo,
  onNavigate,
}: TopNavProps) {
  const isKitchen = !splitDemoMode && activeView === 'kitchen';

  return (
    <header
      className={`border-b transition-colors duration-150 ${
        isKitchen
          ? 'bg-[#0B1120] border-[#1E293B] text-slate-100'
          : 'bg-white border-[#E4E7EC] text-[#101828]'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-2.5 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-6">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('customer', activeTable)}
          className={`font-display text-sm sm:text-lg font-bold tracking-tight whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded ${
            isKitchen ? 'text-white' : 'text-[#101828]'
          }`}
        >
          ServeSmart
        </button>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav
          aria-label="Primary View Switcher"
          className="flex items-center gap-2.5 sm:gap-6 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = !splitDemoMode && activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onNavigate(
                    item.id,
                    item.id === 'customer' ? activeTable : undefined
                  )
                }
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-4 text-[11px] sm:text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  isActive
                    ? isKitchen
                      ? 'text-white'
                      : 'text-[#101828]'
                    : isKitchen
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-[#475467] hover:text-[#101828]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                      isKitchen ? 'bg-amber-400' : 'bg-emerald-700'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Live Demo Split View toggle */}
        <div className="hidden md:flex items-center shrink-0">
          <button
            type="button"
            onClick={onToggleSplitDemo}
            aria-pressed={splitDemoMode}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
              splitDemoMode
                ? 'bg-[#101828] text-white hover:bg-[#1D2939]'
                : isKitchen
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-emerald-700 text-white hover:bg-emerald-800'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            {splitDemoMode ? 'Exit Split View' : 'Live Demo Split View'}
          </button>
        </div>
      </div>
    </header>
  );
}
