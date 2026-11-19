import { useState } from 'react';
import { Download, ExternalLink, Globe, QrCode, RotateCcw } from 'lucide-react';
import type { MenuItem, RestaurantSettings } from '../types/restaurant';
import {
  buildTableQrUrl,
  formatCurrency,
  getDefaultLiveBaseUrl,
} from '../utils/restaurantLogic';
import { downloadTableQrCard, QrCodeDisplay } from './QrCodeDisplay';

interface TableQrGridProps {
  settings: RestaurantSettings;
  menu: MenuItem[];
  onOpenTable: (tableNumber: number) => void;
  showMenuSummary?: boolean;
}

export function TableQrGrid({
  settings,
  menu,
  onOpenTable,
  showMenuSummary = true,
}: TableQrGridProps) {
  const defaultBaseUrl =
    typeof window !== 'undefined'
      ? getDefaultLiveBaseUrl(window.location.origin, window.location.pathname)
      : 'http://localhost:3000/';

  const [liveBaseUrl, setLiveBaseUrl] = useState<string>(defaultBaseUrl);

  const tableNumbers = Array.from(
    { length: settings.totalTables },
    (_, i) => i + 1
  );

  const effectiveBaseUrl = liveBaseUrl.trim() || defaultBaseUrl;

  return (
    <section className="space-y-5" aria-labelledby="table-qrs-heading">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
            <h2
              id="table-qrs-heading"
              className="font-display text-lg font-bold text-[#101828]"
            >
              Table QR Codes (Table 1 – Table {settings.totalTables})
            </h2>
          </div>
          <p className="text-xs text-[#475467] mt-0.5">
            Uses query-parameter links (?table=1–{settings.totalTables}) so
            scanning works on any deployed domain without 404 errors · UPI:{' '}
            <span className="font-mono font-semibold text-[#101828]">
              {settings.upiId}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            for (const t of tableNumbers) {
              await downloadTableQrCard(
                t,
                settings.restaurantName,
                buildTableQrUrl(effectiveBaseUrl, t),
                menu,
                settings.upiId
              );
            }
          }}
          className="h-9 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download All {settings.totalTables} PNGs
        </button>
      </div>

      {/* Custom Live Website URL Configuration Box */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label
            htmlFor="live-website-url-input"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#344054] mb-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-700" />
            Live Website URL
          </label>
          <input
            id="live-website-url-input"
            type="url"
            value={liveBaseUrl}
            onChange={(e) => setLiveBaseUrl(e.target.value)}
            placeholder={defaultBaseUrl}
            className="w-full h-10 px-3 font-mono text-xs sm:text-sm text-[#101828] bg-white border border-[#D0D5DD] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
          />
          <p className="text-[11px] text-[#475467] mt-1">
            All 6 QR codes below update automatically to append{' '}
            <span className="font-mono font-semibold text-[#101828]">
              ?table=1
            </span>{' '}
            …{' '}
            <span className="font-mono font-semibold text-[#101828]">
              ?table={settings.totalTables}
            </span>{' '}
            to this domain.
          </p>
        </div>

        {liveBaseUrl !== defaultBaseUrl && (
          <button
            type="button"
            onClick={() => setLiveBaseUrl(defaultBaseUrl)}
            className="h-10 px-3.5 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-[#344054] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Current URL
          </button>
        )}
      </div>

      {/* Crisp 3x2 grid on desktop (6 tables) */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        data-testid="table-qr-grid"
      >
        {tableNumbers.map((tableNum) => {
          const tableUrl = buildTableQrUrl(effectiveBaseUrl, tableNum);
          return (
            <article
              key={tableNum}
              data-testid={`table-qr-card-${tableNum}`}
              className="bg-white border border-[#E4E7EC] rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex flex-col items-center text-center gap-3.5">
                <div className="p-2.5 bg-white border border-[#E4E7EC] rounded-xl">
                  <QrCodeDisplay
                    value={tableUrl}
                    size={200}
                    alt={`${settings.restaurantName} - Table ${tableNum} QR Code`}
                    className="border-0 rounded-md"
                  />
                </div>

                <div>
                  <h3 className="font-display text-base font-bold text-[#101828]">
                    {settings.restaurantName} - Table {tableNum}
                  </h3>
                  <p className="font-mono text-[11px] text-[#475467] mt-1 break-all">
                    {tableUrl}
                  </p>
                </div>
              </div>

              {showMenuSummary && menu.length > 0 && (
                <div className="border-t border-[#F2F4F7] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#475467] mb-1.5">
                    Menu &amp; Prices
                  </p>
                  <ul className="space-y-1 text-xs">
                    {menu.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 text-[#101828]"
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="font-mono font-semibold text-emerald-800 tabular-nums shrink-0">
                          {formatCurrency(item.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    downloadTableQrCard(
                      tableNum,
                      settings.restaurantName,
                      tableUrl,
                      menu,
                      settings.upiId
                    )
                  }
                  className="h-9 px-3 rounded-lg bg-[#101828] hover:bg-[#1D2939] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTable(tableNum)}
                  className="h-9 px-3 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-[#344054] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Table
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
