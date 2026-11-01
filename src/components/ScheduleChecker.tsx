import React, { useState } from 'react';
import { TIME_SLOTS_MASTER } from '../data/studioData';
import { isSlotAvailable, formatDateIndo } from '../utils/storage';
import { Calendar as CalendarIcon, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface ScheduleCheckerProps {
  onSelectSlotToBook: (date: string, timeSlot: string) => void;
}

export const ScheduleChecker: React.FC<ScheduleCheckerProps> = ({ onSelectSlotToBook }) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const availableDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d);
    const dayNum = d.getDate();
    const monthName = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(d);
    return { dateStr, dayName, dayNum, monthName };
  });

  return (
    <section id="jadwal" className="py-16 sm:py-24 bg-neutral-50 border-b border-neutral-200 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase mb-2">
            <span>Ketersediaan Jadwal Real-Time</span>
            <span aria-hidden="true">·</span>
            <span>Live Calendar</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-neutral-950 tracking-tight">
            Cek Slot Jadwal & Ketersediaan Studio
          </h2>
          <p className="mt-3 text-base text-neutral-600 leading-relaxed">
            Pilih tanggal di bawah ini untuk melihat ketersediaan slot waktu sesi foto. Klik slot yang tersedia untuk langsung memesan.
          </p>
        </div>

        {/* Date Selector Row */}
        <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-thin mb-8">
          {availableDates.map((item) => {
            const isSelected = selectedDate === item.dateStr;
            return (
              <button
                key={item.dateStr}
                onClick={() => setSelectedDate(item.dateStr)}
                className={`flex flex-col items-center min-w-[90px] p-3 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-neutral-950 text-white border-neutral-950 shadow-md ring-1 ring-neutral-950'
                    : 'bg-white text-neutral-800 border-neutral-200 hover:border-neutral-400'
                }`}
              >
                <span className="text-xs uppercase font-mono opacity-70">
                  {item.dayName}
                </span>
                <span className="text-2xl font-bold font-display my-1 tabular-nums">
                  {item.dayNum}
                </span>
                <span className="text-xs opacity-80">{item.monthName}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Date Status & Legend */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
            <div>
              <div className="text-xs text-neutral-400 font-mono">TANGGAL DIPILIH · WITA (GMT+8)</div>
              <div className="text-lg font-bold text-neutral-950">
                {formatDateIndo(selectedDate)}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Slot Tersedia</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-300" />
                <span>Sudah Dipesan / Tutup</span>
              </div>
            </div>
          </div>

          {/* Slot Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {TIME_SLOTS_MASTER.map((slot) => {
              const status = isSlotAvailable(selectedDate, slot.time);
              const isAvailable = status.available;

              return (
                <button
                  key={slot.time}
                  disabled={!isAvailable}
                  onClick={() => onSelectSlotToBook(selectedDate, slot.time)}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    isAvailable
                      ? 'bg-white border-neutral-200 hover:border-neutral-900 hover:shadow hover:scale-101 active:scale-98 group cursor-pointer'
                      : 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                    <span className="uppercase">{slot.period}</span>
                    {isAvailable ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <span>Pesan</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    ) : (
                      <span className="text-neutral-500 font-semibold">
                        {status.reason === 'booked' ? 'Penuh' : 'Tutup'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold font-mono text-neutral-950 tabular-nums">
                    {slot.time} <span className="text-[10px] font-normal text-neutral-500">WITA</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
