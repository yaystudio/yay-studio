import React, { useState } from 'react';
import { Booking } from '../types';
import { STUDIO_CONFIG } from '../data/studioData';
import { formatIDR, formatDateIndo } from '../utils/storage';
import { X, Mail, CheckCircle2, Copy, Check } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  booking,
}) => {
  const [activeTab, setActiveTab] = useState<'customer' | 'admin'>('customer');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !booking) return null;

  const handleCopyEmailText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const customerEmailSubject = `Konfirmasi Booking Yay Photo Studio - #${booking.id}`;
  const adminEmailSubject = `[Booking Baru Masuk] ${booking.serviceName} - ${booking.customer.name} (#${booking.id})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-mono text-neutral-500 uppercase">
                Email Dispatch System
              </div>
              <h3 className="text-base font-bold text-neutral-900 font-display">
                Preview Notifikasi Email Terkirim
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Email Customer vs Email Admin */}
        <div className="px-6 py-2 bg-neutral-100 border-b border-neutral-200 flex gap-2">
          <button
            onClick={() => setActiveTab('customer')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'customer'
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <span>Email ke Customer</span>
            <span className="text-[10px] text-neutral-400 truncate max-w-[140px]">
              ({booking.customer.email})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <span>Email ke Admin Studio</span>
            <span className="text-[10px] text-neutral-400">
              ({STUDIO_CONFIG.adminEmail})
            </span>
          </button>
        </div>

        {/* Email Viewer Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {activeTab === 'customer' ? (
            /* CUSTOMER EMAIL TEMPLATE */
            <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm bg-neutral-50">
              <div className="bg-white p-4 border-b border-neutral-200 text-xs space-y-1 font-mono">
                <div>
                  <span className="text-neutral-400">Dari: </span>
                  <span className="text-neutral-800 font-semibold">{STUDIO_CONFIG.name} &lt;{STUDIO_CONFIG.adminEmail}&gt;</span>
                </div>
                <div>
                  <span className="text-neutral-400">Kepada: </span>
                  <span className="text-neutral-800 font-semibold">{booking.customer.name} &lt;{booking.customer.email}&gt;</span>
                </div>
                <div>
                  <span className="text-neutral-400">Subjek: </span>
                  <span className="text-neutral-950 font-bold">{customerEmailSubject}</span>
                </div>
              </div>

              <div className="p-6 bg-white space-y-5 text-neutral-800 text-xs sm:text-sm leading-relaxed">
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                  <span className="font-display font-extrabold text-base tracking-tight text-neutral-950">
                    {STUDIO_CONFIG.name.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono text-neutral-500">#{booking.id}</span>
                </div>

                <div>
                  <p className="font-semibold text-neutral-950">
                    Halo {booking.customer.name},
                  </p>
                  <p className="mt-1 text-neutral-600">
                    Terima kasih telah melakukan reservasi di <strong>{STUDIO_CONFIG.name}</strong>. Jadwal sesi foto Anda telah kami catat dalam kalender studio.
                  </p>
                </div>

                {/* Session Box */}
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2 text-xs">
                  <div className="font-bold text-neutral-950 uppercase tracking-wider text-[11px] pb-1 border-b border-neutral-200">
                    Rincian Jadwal Reservasi
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-neutral-500">Paket Layanan:</span>
                      <p className="font-semibold text-neutral-900">{booking.serviceName}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Backdrop:</span>
                      <p className="font-semibold text-neutral-900">{booking.backdrop}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Tanggal Sesi:</span>
                      <p className="font-semibold text-neutral-900">{formatDateIndo(booking.date)}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Waktu / Jam:</span>
                      <p className="font-semibold text-neutral-900 font-mono">{booking.timeSlot} WITA</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Jumlah Orang:</span>
                      <p className="font-semibold text-neutral-900">{booking.peopleCount} Orang</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Total Biaya:</span>
                      <p className="font-semibold text-neutral-900 font-mono">{formatIDR(booking.totalPrice)}</p>
                    </div>
                    <div className="col-span-2 pt-1 text-emerald-700 font-semibold">
                      Metode Pembayaran: Pembayaran dapat dilakukan saat di studio (Cash / QRIS / Transfer)
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-neutral-600">
                  <div className="font-bold text-neutral-900">Petunjuk Sesi:</div>
                  <p>1. Harap hadir di studio 10 menit sebelum jam sesi dimulai.</p>
                  <p>2. Aksesoris bando, topi, kacamata aesthetic tersedia gratis di studio.</p>
                  <p>3. Semua soft files foto akan diunggah ke link Google Drive dan dikirimkan ke email ini.</p>
                </div>

                <div className="pt-3 border-t border-neutral-100 text-xs text-neutral-500">
                  <span className="font-semibold text-neutral-800">Alamat Studio:</span>
                  <p>{STUDIO_CONFIG.address}</p>
                </div>
              </div>
            </div>
          ) : (
            /* ADMIN EMAIL TEMPLATE */
            <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm bg-neutral-50">
              <div className="bg-white p-4 border-b border-neutral-200 text-xs space-y-1 font-mono">
                <div>
                  <span className="text-neutral-400">Dari: </span>
                  <span className="text-neutral-800 font-semibold">Yay Studio System &lt;no-reply@yaystudio.app&gt;</span>
                </div>
                <div>
                  <span className="text-neutral-400">Kepada: </span>
                  <span className="text-neutral-950 font-bold">Admin Studio &lt;{STUDIO_CONFIG.adminEmail}&gt;</span>
                </div>
                <div>
                  <span className="text-neutral-400">Subjek: </span>
                  <span className="text-neutral-950 font-bold">{adminEmailSubject}</span>
                </div>
              </div>

              <div className="p-6 bg-white space-y-4 text-xs sm:text-sm text-neutral-800 leading-relaxed">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-semibold">
                  Pemberitahuan: Booking Baru Masuk ke Kalender Studio
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-neutral-500">Nama Customer:</span>
                      <p className="font-bold text-neutral-950 text-sm">{booking.customer.name}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Kode Booking:</span>
                      <p className="font-bold font-mono text-neutral-950">#{booking.id}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Nomor WhatsApp:</span>
                      <p className="font-mono text-neutral-900">{booking.customer.whatsapp}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Email Customer:</span>
                      <p className="font-mono text-neutral-900 truncate">{booking.customer.email}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Paket Sesi:</span>
                      <p className="font-semibold text-neutral-900">{booking.serviceName}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Jadwal Tanggal & Jam:</span>
                      <p className="font-bold text-neutral-900">{formatDateIndo(booking.date)} ({booking.timeSlot} WITA)</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Backdrop:</span>
                      <p className="font-semibold text-neutral-900">{booking.backdrop}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Total Biaya:</span>
                      <p className="font-bold font-mono text-neutral-950">{formatIDR(booking.totalPrice)}</p>
                    </div>
                    <div className="col-span-2 text-neutral-600 font-medium">
                      Status Bayar: Pembayaran dapat dilakukan saat di studio
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
          <div className="text-xs text-neutral-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Format email siap dikirim</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const textToCopy =
                  activeTab === 'customer'
                    ? `Subjek: ${customerEmailSubject}\n\nHalo ${booking.customer.name},\nTerima kasih atas booking di Yay Photo Studio.\nKode Booking: #${booking.id}\nLayanan: ${booking.serviceName}\nJadwal: ${formatDateIndo(booking.date)} (${booking.timeSlot} WITA)\nTotal: ${formatIDR(booking.totalPrice)}\nPembayaran: Dilakukan saat di studio\nAlamat: ${STUDIO_CONFIG.address}`
                    : `Subjek: ${adminEmailSubject}\n\nBooking Baru Masuk:\nCustomer: ${booking.customer.name}\nWhatsApp: ${booking.customer.whatsapp}\nEmail: ${booking.customer.email}\nPaket: ${booking.serviceName}\nJadwal: ${formatDateIndo(booking.date)} ${booking.timeSlot} WITA\nTotal: ${formatIDR(booking.totalPrice)}\nPembayaran: Di studio`;
                handleCopyEmailText(textToCopy);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-950 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-lg"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
