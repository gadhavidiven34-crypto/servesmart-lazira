import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeDisplayProps {
  value: string;
  size?: number;
  alt: string;
  className?: string;
}

export function buildQrServerUrl(value: string, size = 250): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(value)}`;
}

export function QrCodeDisplay({
  value,
  size = 180,
  alt,
  className = '',
}: QrCodeDisplayProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [fallbackDataUrl, setFallbackDataUrl] = useState<string>('');

  const qrServerSrc = buildQrServerUrl(value, 250);

  useEffect(() => {
    setUseFallback(false);
  }, [value]);

  useEffect(() => {
    if (!useFallback) return;
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: Math.max(size * 2, 250),
      margin: 2,
      color: {
        dark: '#101828',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) {
          setFallbackDataUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFallbackDataUrl('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, useFallback]);

  const imgSrc = useFallback ? fallbackDataUrl : qrServerSrc;

  if (!imgSrc) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-500 ${className}`}
      >
        Generating QR...
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!useFallback) {
          setUseFallback(true);
        }
      }}
      className={`rounded-lg bg-white border border-[#E4E7EC] ${className}`}
    />
  );
}

import type { MenuItem } from '../types/restaurant';

export async function downloadTableQrCard(
  tableNumber: number,
  restaurantName: string,
  tableUrl: string,
  menu: MenuItem[] = [],
  upiId = ''
): Promise<void> {
  const canvas = document.createElement('canvas');
  const width = 720;
  const menuRowsHeight = menu.length > 0 ? 70 + menu.length * 36 : 0;
  const height = 760 + menuRowsHeight;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clean white printable card background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Subtle outer hairline border
  ctx.strokeStyle = '#E4E7EC';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Top emerald accent bar
  ctx.fillStyle = '#047857';
  ctx.fillRect(20, 20, width - 40, 14);

  // Restaurant Name + Table Title
  ctx.fillStyle = '#101828';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${restaurantName} - Table ${tableNumber}`, width / 2, 102);

  ctx.fillStyle = '#475467';
  ctx.font = '500 20px sans-serif';
  ctx.fillText('Scan to Order & Pay via UPI', width / 2, 140);

  // Generate QR data URL and draw onto canvas
  const qrDataUrl = await QRCode.toDataURL(tableUrl, {
    width: 380,
    margin: 2,
    color: { dark: '#101828', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  });

  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject(new Error('QR load error'));
    qrImg.src = qrDataUrl;
  });

  ctx.drawImage(qrImg, (width - 380) / 2, 175, 380, 380);

  // URL & UPI summary below QR
  ctx.fillStyle = '#475467';
  ctx.font = '16px monospace';
  ctx.fillText(tableUrl, width / 2, 588);

  if (upiId) {
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`UPI: ${upiId}`, width / 2, 622);
  }

  // Menu & Prices section
  if (menu.length > 0) {
    ctx.strokeStyle = '#E4E7EC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, 652);
    ctx.lineTo(width - 64, 652);
    ctx.stroke();

    ctx.fillStyle = '#101828';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Menu & Prices', 64, 690);

    menu.forEach((item, index) => {
      const y = 732 + index * 36;
      ctx.fillStyle = '#101828';
      ctx.font = '500 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${item.name} (${item.prepTimeMins}m)`,
        64,
        y
      );

      ctx.fillStyle = '#047857';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`₹${item.price}`, width - 64, y);
    });
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#475467';
  ctx.font = '600 16px sans-serif';
  ctx.fillText('Powered by ServeSmart', width / 2, height - 48);

  const pngUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = pngUrl;
  link.download = `${restaurantName.toLowerCase().replace(/\s+/g, '-')}-table-${tableNumber}-qr.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
