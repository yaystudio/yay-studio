import React, { useState } from 'react';
import { Booking, StudioConfig } from '../types';
import { getStoredStudioConfig, formatIDR, formatDateIndo } from '../utils/storage';
import { formatCustomerEmail, formatAdminEmail } from '../utils/emailService';
import { X, Mail, CheckCircle2, Copy, Check, ExternalLink, Send } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  config?: StudioConfig;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  booking,
  config: passedConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'customer' | 'admin'>('customer');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !booking) return null;

  const studioConfig = passedConfig || getStoredStudioConfig();
  const customerEmail = formatCustomerEmail(booking, studioConfig);
  const adminEmail = formatAdminEmail(booking, studioConfig);

  const handleCopyEmailText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                EMAIL DISPATCH SYSTEM
              </div>
              <h3 className="text-base font-bold font-display">
                Preview Notifikasi Email Booking
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Email Customer vs Email Admin */}
        <div className="px-6 py-2.5 bg-neutral-100 border-b border-neutral-200 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('customer')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'customer'
                ? 'bg-white text-neutral-950 shadow-sm border border-neutral-200/80 font-bold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <span>Email Konfirmasi Customer</span>
            <span className="text-[10px] text-neutral-400 truncate max-w-[130px]">
              ({booking.customer.email})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-white text-neutral-950 shadow-sm border border-neutral-200/80 font-bold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <span>Email Masuk ke Admin</span>
            <span className="text-[10px] text-neutral-400">
              ({adminEmail.to})
            </span>
          </button>
        </div>

        {/* Email Viewer Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {activeTab === 'customer' ? (
            /* CUSTOMER EMAIL TEMPLATE */
            <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-sm bg-neutral-50">
              <div className="bg-white p-4 border-b border-neutral-200 text-xs space-y-1.5 font-mono">
                <div>
                  <span className="text-neutral-400">Dari: </span>
                  <span className="text-neutral-800 font-semibold">{studioConfig.name} &lt;{studioConfig.adminEmail}&gt;</span>
                </div>
                <div>
                  <span className="text-neutral-400">Kepada: </span>
                  <span className="text-neutral-800 font-semibold">{booking.customer.name} &lt;{booking.customer.email}&gt;</span>
                </div>
                <div>
                  <span className="text-neutral-400">Subjek: </span>
                  <span className="text-neutral-950 font-bold">{customerEmail.subject}</span>
                </div>
              </div>

              <div className="p-6 bg-white space-y-5 text-neutral-800 text-xs sm:text-sm leading-relaxed">
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                  <span className="font-display font-extrabold text-base tracking-tight text-neutral-950">
                    {studioConfig.name.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono text-neutral-500 font-semibold">#{booking.id}</span>
                </div>

                <div>
                  <p className="font-bold text-neutral-950">
                    {customerEmail.greeting}
                  </p>
                  <p className="mt-1 text-neutral-700 whitespace-pre-line leading-relaxed">
                    {customerEmail.message}
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
                      Metode Pembayaran: {booking.paymentNote || studioConfig.paymentNote || 'Pembayaran dapat dilakukan saat di studio'}
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                {customerEmail.instructions.length > 0 && (
                  <div className="space-y-1.5 text-xs text-neutral-700">
                    <div className="font-bold text-neutral-900">Petunjuk Sesi Foto:</div>
                    <ul className="space-y-1">
                      {customerEmail.instructions.map((line, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-neutral-400 shrink-0">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer Note */}
                {customerEmail.footer && (
                  <div className="text-xs text-neutral-600 italic">
                    {customerEmail.footer}
                  </div>
                )}

                <div className="pt-3 border-t border-neutral-100 text-xs text-neutral-500">
                  <span className="font-semibold text-neutral-800">Alamat Studio:</span>
                  <p>{studioConfig.address}</p>
                </div>
              </div>
            </div>
          ) : (
            /* ADMIN EMAIL TEMPLATE */
            <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-sm bg-neutral-50">
              <div className="bg-white p-4 border-b border-neutral-200 text-xs space-y-1.5 font-mono">
                <div>
                  <span className="text-neutral-400">Dari: </span>
                  <span className="text-neutral-800 font-semibold">Yay Studio System &lt;no-reply@yaystudio.app&gt;</span>
                </div>
                <div>
                  <span className="text-neutral-400">Kepada: </span>
                  <span className="text-neutral-950 font-bold">Pemilik Studio &lt;{adminEmail.to}&gt;</span>
                </div>
                <div>
                  <span className="text-neutral-400">Subjek: </span>
                  <span className="text-neutral-950 font-bold">{adminEmail.subject}</span>
                </div>
              </div>

              <div className="p-6 bg-white space-y-4 text-xs sm:text-sm text-neutral-800 leading-relaxed">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center justify-between">
                  <span>Pemberitahuan: Booking Baru Masuk ke Kalender Studio</span>
                  <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Auto Notification</span>
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
                      <p className="font-mono text-neutral-900 font-semibold">{booking.customer.whatsapp}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Email Customer:</span>
                      <p className="font-mono text-neutral-900 truncate font-semibold">{booking.customer.email}</p>
                    </div>
                    {booking.customer.notes && (
                      <div className="col-span-2 bg-neutral-100/70 p-2 rounded-lg">
                        <span className="text-neutral-500 block text-[10px] font-mono">CATATAN CUSTOMER:</span>
                        <p className="text-neutral-800 italic">{booking.customer.notes}</p>
                      </div>
                    )}
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
                      Status Bayar: {booking.paymentNote || studioConfig.paymentNote || 'Pembayaran dapat dilakukan saat di studio'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-neutral-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Format email siap disalin atau dibuka di Gmail</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={activeTab === 'customer' ? customerEmail.gmailComposeUrl : adminEmail.gmailComposeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Buka di Gmail</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>

            <button
              onClick={() => {
                const textToCopy =
                  activeTab === 'customer'
                    ? customerEmail.fullPlainText
                    : adminEmail.fullPlainText;
                handleCopyEmailText(textToCopy);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-950 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
