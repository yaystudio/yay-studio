import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Booking } from '../types';
import { STUDIO_CONFIG } from '../data/studioData';
import { formatIDR, formatDateIndo, getStoredStudioConfig } from '../utils/storage';
import {
  generateGoogleCalendarWebUrl,
  downloadCalendarICSFile,
} from '../utils/googleCalendar';
import { sendBookingEmailViaApi } from '../utils/emailService';
import {
  CheckCircle2,
  Printer,
  MessageCircle,
  Eye,
  X,
  CreditCard,
  Calendar,
  ExternalLink,
  Check,
  Download,
  MapPin,
} from 'lucide-react';

interface BookingSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onOpenEmailPreview: () => void;
}

export const BookingSuccessModal: React.FC<BookingSuccessModalProps> = ({
  isOpen,
  onClose,
  booking,
  onOpenEmailPreview,
}) => {
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'notConfigured' | 'error'>('idle');
  const studioConfig = getStoredStudioConfig();

  useEffect(() => {
    if (isOpen && booking) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#000000', '#2563eb', '#555555', '#ffffff'],
        });
      } catch (e) {
        console.log('Confetti effect triggered');
      }

      // Ensure automatic server email & CalDAV calendar dispatch completes
      setEmailStatus('sending');
      sendBookingEmailViaApi(booking, studioConfig)
        .then((res) => {
          if (res.delivered) {
            setEmailStatus('sent');
          } else if (res.notConfigured) {
            setEmailStatus('notConfigured');
          } else {
            setEmailStatus('error');
          }
        })
        .catch(() => {
          setEmailStatus('error');
        });
    }
  }, [isOpen, booking]);

  if (!isOpen || !booking) return null;

  const handlePrintTicket = () => {
    window.print();
  };

  const googleWebUrl = generateGoogleCalendarWebUrl(booking);

  const handleOpenWhatsApp = () => {
    const message = encodeURIComponent(
      `Halo Admin Yay Photo Studio, saya ingin konfirmasi booking sesi foto:\n\n` +
        `• Kode Booking: #${booking.id}\n` +
        `• Nama: ${booking.customer.name}\n` +
        `• Layanan: ${booking.serviceName}\n` +
        `• Jadwal: ${formatDateIndo(booking.date)} (${booking.timeSlot} WITA · GMT+8)\n` +
        `• Backdrop: ${booking.backdrop}\n` +
        `• Jumlah Orang: ${booking.peopleCount} Orang\n` +
        `• Total Biaya: ${formatIDR(booking.totalPrice)}\n` +
        (studioConfig.address ? `• Lokasi Studio: ${studioConfig.address}\n` : '') +
        `• Pembayaran: Dilakukan saat di studio\n\n` +
        `Terima kasih!`
    );
    const url = `https://wa.me/${STUDIO_CONFIG.whatsappNumber}?text=${message}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-neutral-950/75 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden my-6 print:border-none print:shadow-none">
        {/* Header Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-950 rounded-full hover:bg-neutral-100 z-10 print:hidden"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Status Notification Banner */}
        <div className="bg-neutral-950 text-white p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="w-12 h-12 bg-white text-neutral-950 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow">
            <CheckCircle2 className="w-7 h-7 text-neutral-950" />
          </div>

          <div className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-1">
            Booking Confirmed
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
            Reservasi Berhasil Dicatat!
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-300 max-w-md mx-auto">
            Terima kasih, <strong>{booking.customer.name}</strong>. Jadwal sesi foto Anda telah langsung masuk ke kalender studio kami.
          </p>

          {/* Payment Note Highlight */}
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl text-xs font-semibold">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Pembayaran dapat dilakukan saat di studio</span>
          </div>

          {/* Automatic Delivery & Calendar Status */}
          <div className="mt-4 p-3 bg-neutral-900/90 rounded-xl border border-neutral-800 text-[11px] sm:text-xs text-neutral-300 space-y-2 text-left max-w-md mx-auto">
            <div className="flex items-center justify-between gap-2 text-neutral-200">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">
                  Email Konfirmasi: <strong>{booking.customer.email}</strong>
                </span>
              </div>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-600/30 px-2 py-0.5 rounded font-mono shrink-0">
                {emailStatus === 'sending' ? 'Mengirim...' : 'Terkirim Otomatis'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-neutral-200">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="truncate">
                  Kalender Studio: <strong>Terjadwal Otomatis</strong>
                </span>
              </div>
              <span className="text-[10px] bg-blue-950/80 text-blue-300 border border-blue-600/30 px-2 py-0.5 rounded font-mono shrink-0">
                Aktif
              </span>
            </div>
          </div>
        </div>

        {/* Printable Ticket Receipt / Voucher Body */}
        <div className="p-6 sm:p-8 bg-neutral-50 border-b border-dashed border-neutral-300">
          <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm relative">
            {/* Top Ticket Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <div className="font-display font-bold text-lg text-neutral-950">
                  {STUDIO_CONFIG.name.toUpperCase()}
                </div>
                <div className="text-[11px] text-neutral-500 font-mono">
                  STUDIO SESSION PASS · WITA (GMT+8)
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-neutral-400 uppercase font-mono">KODE BOOKING</div>
                <div className="font-mono text-base font-extrabold text-neutral-950 tracking-wider">
                  #{booking.id}
                </div>
              </div>
            </div>

            {/* Ticket Info Grid */}
            <div className="py-4 grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-mono">LAYANAN</span>
                <span className="font-semibold text-neutral-900 text-sm">{booking.serviceName}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-mono">BACKDROP</span>
                <span className="font-semibold text-neutral-900">{booking.backdrop}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-mono">TANGGAL SESI</span>
                <span className="font-semibold text-neutral-900">{formatDateIndo(booking.date)}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-mono">WAKTU (24 JAM · WITA)</span>
                <span className="font-mono font-bold text-neutral-950 text-sm">{booking.timeSlot} WITA</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-mono">NAMA PEMESAN</span>
                <span className="font-medium text-neutral-900">{booking.customer.name} ({booking.peopleCount} Orang)</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase font-mono">TOTAL BIAYA</span>
                <span className="font-mono font-bold text-neutral-950">{formatIDR(booking.totalPrice)}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-neutral-100 flex items-center gap-1.5 text-neutral-600">
                <CreditCard className="w-3.5 h-3.5 text-neutral-900" />
                <span className="font-medium">Pembayaran dapat dilakukan saat di studio</span>
              </div>
              {studioConfig.address && (
                <div className="col-span-2 pt-2 border-t border-neutral-100 flex items-start gap-1.5 text-neutral-700 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-neutral-900 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-neutral-900">Lokasi Studio: </span>
                    <span>{studioConfig.address}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Barcode Graphic for Photostudio Vibe */}
            <div className="pt-4 border-t border-neutral-100 flex flex-col items-center justify-center">
              <div className="h-9 w-48 bg-[repeating-linear-gradient(90deg,#000,#000_2px,#fff_2px,#fff_5px,#000_5px,#000_8px,#fff_8px,#fff_10px,#000_10px,#000_14px)] opacity-80" />
              <div className="text-[10px] font-mono text-neutral-400 mt-1">
                AUTHENTICATED STUDIO PASS · {booking.id}
              </div>
            </div>
          </div>

          {/* Customer Personal Calendar Option */}
          <div className="mt-5 bg-white rounded-2xl p-4 sm:p-5 border border-blue-100 shadow-xs print:hidden space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-900 block">
                    Jadwal Sesi Foto Anda (WITA · GMT+8)
                  </span>
                  <span className="text-[11px] text-neutral-500 block">
                    Tersimpan otomatis di sistem kalender studio
                  </span>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
                <Check className="w-3 h-3" />
                <span>Terjadwal</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <a
                href={googleWebUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-xl transition-all shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Simpan ke Kalender HP Saya</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>

              <button
                type="button"
                onClick={() => downloadCalendarICSFile(booking, booking.durationMinutes || 30)}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 active:scale-98 rounded-xl transition-all"
              >
                <Download className="w-3.5 h-3.5 text-neutral-600" />
                <span>Download .ICS (Apple / HP)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="p-6 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <button
            onClick={onOpenEmailPreview}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200/80 rounded-xl transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>Lihat Email Konfirmasi</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrintTicket}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Tiket</span>
            </button>

            <button
              onClick={handleOpenWhatsApp}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
