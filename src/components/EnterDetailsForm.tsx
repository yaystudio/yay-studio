import React, { useState } from 'react';
import { Service } from '../types';
import { BACKDROP_OPTIONS } from '../data/studioData';
import { formatIDR, formatDateIndo, calculateServicePrice } from '../utils/storage';
import { ArrowLeft, Calendar, Clock, CreditCard } from 'lucide-react';

interface EnterDetailsFormProps {
  service: Service;
  selectedDate: string;
  selectedTimeSlot: string;
  onBack: () => void;
  onConfirmBooking: (data: {
    backdrop: string;
    peopleCount: number;
    totalPrice: number;
    paymentNote: string;
    customer: {
      name: string;
      email: string;
      whatsapp: string;
      notes?: string;
    };
  }) => void;
}

export const EnterDetailsForm: React.FC<EnterDetailsFormProps> = ({
  service,
  selectedDate,
  selectedTimeSlot,
  onBack,
  onConfirmBooking,
}) => {
  // Available backdrops for this specific service
  const availableBackdrops =
    service.backdrops && service.backdrops.length > 0
      ? service.backdrops
      : BACKDROP_OPTIONS;

  // Form fields matching user reference image
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState<string>('');
  const [peopleCount, setPeopleCount] = useState<number>(service.maxPeople || 2);
  const [selectedBackdrop, setSelectedBackdrop] = useState<string>(
    availableBackdrops[0]?.name || ''
  );

  // Errors
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Dynamic price calculation based on admin personPricing configuration
  const totalPrice = calculateServicePrice(service, peopleCount);
  const hasExactTier = service.personPricing && service.personPricing[peopleCount] !== undefined;
  const extraPersonRate = service.extraPersonPrice || 30000;
  const extraPeopleCount = Math.max(0, peopleCount - service.maxPeople);
  const extraPeoplePrice = extraPeopleCount * extraPersonRate;
  const basePrice = service.price;
  const paymentNote = "Pembayaran dapat dilakukan saat di studio";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim()) {
      setErrorMsg('Name is required.');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setErrorMsg('Valid email is required for booking confirmation.');
      return;
    }
    if (!customerWhatsapp.trim() || customerWhatsapp.length < 8) {
      setErrorMsg('Nomor WhatsApp aktif wajib diisi.');
      return;
    }
    if (peopleCount < 1) {
      setErrorMsg('Jumlah orang minimal 1.');
      return;
    }
    if (!selectedBackdrop) {
      setErrorMsg('Silakan pilih warna background.');
      return;
    }

    // Clean phone number format
    const cleanPhone = customerWhatsapp.startsWith('0')
      ? customerWhatsapp
      : `0${customerWhatsapp.replace(/^\+?62/, '')}`;

    onConfirmBooking({
      backdrop: selectedBackdrop,
      peopleCount,
      totalPrice,
      paymentNote,
      customer: {
        name: customerName.trim(),
        email: customerEmail.trim(),
        whatsapp: cleanPhone,
      },
    });
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Top Session Summary Badge */}
      <div className="p-3.5 bg-neutral-100 rounded-2xl flex items-center justify-between text-xs text-neutral-700">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-900" />
          <span className="font-semibold text-neutral-900">{formatDateIndo(selectedDate)}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono font-bold text-neutral-900">
          <Clock className="w-4 h-4 text-neutral-900" />
          <span>{selectedTimeSlot} WITA</span>
        </div>
      </div>

      {/* Main Title matching user reference image */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-neutral-950 tracking-tight">
          Enter Details
        </h2>
        <p className="text-xs text-neutral-500 mt-1">
          Lengkapi data pemesanan dan pilih warna background studio di bawah ini.
        </p>
      </div>

      {/* Form matching the exact input order in the user's screenshot */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Name * */}
        <div>
          <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
            Name *
          </label>
          <input
            type="text"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nama Lengkap"
            className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all min-h-[48px]"
          />
        </div>

        {/* 2. Email * */}
        <div>
          <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
            Email *
          </label>
          <input
            type="email"
            required
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="nama@email.com"
            className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all min-h-[48px]"
          />
        </div>

        {/* 3. Nomor Whatsapp * (with Indonesian flag +62 prefix) */}
        <div>
          <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
            Nomor Whatsapp *
          </label>
          <div className="flex items-center rounded-xl border border-neutral-300 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent overflow-hidden min-h-[48px]">
            <div className="flex items-center gap-1.5 px-3.5 py-3 bg-neutral-50 border-r border-neutral-200 text-sm font-medium text-neutral-700 select-none shrink-0">
              <span className="text-base" role="img" aria-label="Indonesia flag">🇮🇩</span>
              <span className="font-mono font-semibold">+62</span>
            </div>
            <input
              type="tel"
              required
              value={customerWhatsapp}
              onChange={(e) => setCustomerWhatsapp(e.target.value)}
              placeholder="81234567890"
              className="flex-1 px-3.5 py-3 text-sm focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* 4. Jumlah Orang * */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-semibold text-neutral-800">
              Jumlah Orang *
            </label>
            <span className="text-[11px] text-neutral-500 font-mono">
              Standar paket: {service.maxPeople} orang
            </span>
          </div>
          <input
            type="number"
            min={1}
            max={20}
            required
            value={peopleCount}
            onChange={(e) => setPeopleCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-bold tabular-nums min-h-[48px]"
          />
          {extraPeopleCount > 0 && (
            <p className="text-xs text-blue-600 font-medium mt-1">
              +{extraPeopleCount} orang tambahan (+{formatIDR(extraPeoplePrice)}, termasuk bonus cetak foto)
            </p>
          )}
        </div>

        {/* 5. Warna Bakground * (Dropdown with Select... placeholder) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-semibold text-neutral-800">
              Warna Bakground *
            </label>
            {availableBackdrops.find((b) => b.name === selectedBackdrop) && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                <span
                  className="w-3.5 h-3.5 rounded-full border shadow-inner inline-block"
                  style={{
                    backgroundColor: availableBackdrops.find((b) => b.name === selectedBackdrop)?.colorHex,
                    borderColor: availableBackdrops.find((b) => b.name === selectedBackdrop)?.borderHex || '#cbd5e1',
                  }}
                />
                <span className="font-medium text-neutral-900">
                  {availableBackdrops.find((b) => b.name === selectedBackdrop)?.name}
                </span>
              </div>
            )}
          </div>
          <div className="relative">
            <select
              value={selectedBackdrop}
              onChange={(e) => setSelectedBackdrop(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white appearance-none cursor-pointer min-h-[48px]"
            >
              <option value="" disabled>Select...</option>
              {availableBackdrops.map((bg) => (
                <option key={bg.id} value={bg.name}>
                  {bg.name} {bg.desc ? `- ${bg.desc}` : ''}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500 text-xs">
              ▼
            </div>
          </div>
        </div>

        {/* Dynamic Cost Breakdown & Payment Note (NO ADDONS, CLEAR PAYMENT NOTE) */}
        <div className="bg-neutral-950 text-white p-4 sm:p-5 rounded-2xl border border-neutral-800 space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-2 flex justify-between">
            <span>Rincian Biaya Sesi</span>
            <span>{service.name}</span>
          </div>

          <div className="space-y-1.5 text-xs text-neutral-300">
            {hasExactTier ? (
              <div className="flex justify-between">
                <span>Tarif Paket ({peopleCount} Orang)</span>
                <span className="font-mono text-white tabular-nums">{formatIDR(totalPrice)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span>Paket Dasar ({service.maxPeople} Orang)</span>
                  <span className="font-mono text-white tabular-nums">{formatIDR(basePrice)}</span>
                </div>

                {extraPeoplePrice > 0 && (
                  <div className="flex justify-between text-blue-300">
                    <span>Tambahan {extraPeopleCount} Orang</span>
                    <span className="font-mono tabular-nums">+{formatIDR(extraPeoplePrice)}</span>
                  </div>
                )}
              </>
            )}

            <div className="pt-2 border-t border-neutral-800 flex justify-between items-baseline text-sm font-bold text-white">
              <span className="text-base font-display">Total Biaya ({peopleCount} Orang):</span>
              <span className="text-xl font-display font-extrabold text-white tabular-nums">
                {formatIDR(totalPrice)}
              </span>
            </div>

            {/* User Requested: pembayaran dapat ditulis : pembayaran dapat dilakukan saat distudio */}
            <div className="pt-2 border-t border-neutral-800 flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>Pembayaran dapat dilakukan saat di studio</span>
            </div>
          </div>
        </div>

        {/* Agreement Text */}
        <div className="text-xs text-neutral-500 pt-1 leading-relaxed">
          By proceeding, you confirm that you have read and agree to{' '}
          <span className="text-blue-600 font-semibold underline cursor-pointer">
            Yay Photo Studio's Terms
          </span>{' '}
          and{' '}
          <span className="text-blue-600 font-semibold underline cursor-pointer">
            Privacy Notice
          </span>
          .
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-medium border border-red-200">
            {errorMsg}
          </div>
        )}

        {/* Bottom Buttons: Schedule Event */}
        <div className="pt-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-950 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ganti Jadwal</span>
          </button>

          <button
            type="submit"
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm sm:text-base rounded-full shadow-lg transition-all min-h-[48px] cursor-pointer"
          >
            Schedule Event
          </button>
        </div>
      </form>
    </div>
  );
};
