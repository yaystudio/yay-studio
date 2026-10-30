import React, { useState, useMemo } from 'react';
import { TIME_SLOTS_MASTER } from '../data/studioData';
import { Service } from '../types';
import { isSlotAvailable, formatDateIndo } from '../utils/storage';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

interface CalendlyDateTimeSelectorProps {
  service?: Service | null;
  selectedDate: string; // YYYY-MM-DD
  selectedTimeSlot: string;
  onSelectDate: (dateStr: string) => void;
  onSelectTimeSlot: (timeSlot: string) => void;
  onProceed: () => void;
}

export const CalendlyDateTimeSelector: React.FC<CalendlyDateTimeSelectorProps> = ({
  service,
  selectedDate,
  selectedTimeSlot,
  onSelectDate,
  onSelectTimeSlot,
  onProceed,
}) => {
  // Parse current selected or initial date
  const initialDate = useMemo(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [selectedDate]);

  // Calendar month/year navigation state
  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // Month names in Indonesian / English
  const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(currentYear, currentMonth, 1)
  );

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sun, 1 is Mon
    // Monday as first day of week: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const startOffset = (firstDayIndex + 6) % 7;

    const days: ({ dayNumber: number; dateStr: string; isPast: boolean } | null)[] = [];

    // Empty cells before start of month
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonth, d);
      dateObj.setHours(0, 0, 0, 0);
      const isPast = dateObj < today;

      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
        d
      ).padStart(2, '0')}`;

      days.push({
        dayNumber: d,
        dateStr,
        isPast,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Filter ONLY ready slots within service open and close time
  const readySlots = useMemo(() => {
    const open = service?.openTime || '09:00';
    const close = service?.closeTime || '22:00';

    return TIME_SLOTS_MASTER.filter((slot) => {
      // Check service operating hours
      if (slot.time < open || slot.time > close) {
        return false;
      }
      // Check availability (not booked or blocked)
      const status = isSlotAvailable(selectedDate, slot.time);
      return status.available;
    });
  }, [selectedDate, service?.openTime, service?.closeTime]);

  // Formatted date title for right column
  const formattedSelectedDateHeader = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dateObj);
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="w-full">
      {/* Title */}
      <div className="mb-6">
        <h3 className="text-xl sm:text-2xl font-display font-extrabold text-neutral-900 tracking-tight">
          Select a Date & Time
        </h3>
        <p className="text-xs text-neutral-500 mt-1">
          {service ? `Layanan: ${service.name} (${service.durationMinutes} menit)` : 'Pilih jadwal sesi foto'}
        </p>
      </div>

      {/* Calendly Split Grid: Left Calendar, Right Time Slots in Two Columns */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: Monthly Calendar View */}
        <div className="md:col-span-6 bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-xs">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-5 px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-600 hover:text-neutral-950 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>

            <span className="font-display font-bold text-base sm:text-lg text-neutral-900 capitalize">
              {monthName}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-600 hover:text-neutral-950 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Weekday Labels (Mon, Tue, Wed, Thu, Fri, Sat, Sun) */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-neutral-500 mb-3">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {calendarDays.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} className="h-10 w-full" />;
              }

              const isSelected = selectedDate === cell.dateStr;

              return (
                <div key={cell.dateStr} className="flex flex-col items-center justify-center">
                  <button
                    type="button"
                    disabled={cell.isPast}
                    onClick={() => {
                      onSelectDate(cell.dateStr);
                      onSelectTimeSlot('');
                    }}
                    className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full flex flex-col items-center justify-center text-xs sm:text-sm font-semibold transition-all relative ${
                      cell.isPast
                        ? 'text-neutral-300 cursor-not-allowed'
                        : isSelected
                        ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-600/30'
                        : 'text-neutral-800 hover:bg-blue-50 hover:text-blue-600 active:scale-95'
                    }`}
                  >
                    <span>{cell.dayNumber}</span>
                    {/* Selected Dot indicator like in Calendly image */}
                    {isSelected && (
                      <span className="w-1 h-1 rounded-full bg-white mt-0.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Timezone Indicator matching Calendly UI */}
          <div className="mt-5 pt-3.5 border-t border-neutral-100 flex items-center gap-2 text-xs text-neutral-600">
            <span className="text-base" role="img" aria-label="Globe">🌐</span>
            <div className="leading-tight">
              <span className="font-semibold text-neutral-900 block">Zona Waktu: WITA (GMT+8)</span>
              <span className="text-[11px] text-neutral-500">Waktu Indonesia Tengah · Makassar</span>
            </div>
          </div>
        </div>

        {/* Right Column: Time Slots (DUA SISI / TWO COLUMNS & ONLY READY SLOTS) */}
        <div className="md:col-span-6 bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div>
            {/* Header: Selected Date Title */}
            <div className="pb-3 mb-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                  TANGGAL SESI · WITA (GMT+8)
                </span>
                <span className="font-display font-bold text-base sm:text-lg text-neutral-900 capitalize">
                  {formattedSelectedDateHeader}
                </span>
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {readySlots.length} Jam Ready
              </span>
            </div>

            {/* DUA SISI (2 COLUMNS) OF SINGLE TIME OUTLINE BUTTONS */}
            {readySlots.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-50 rounded-xl border border-neutral-200">
                Tidak ada slot jam ready pada tanggal ini. Silakan pilih tanggal lain.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                {readySlots.map((slot) => {
                  const isSelected = selectedTimeSlot === slot.time;

                  return (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => onSelectTimeSlot(slot.time)}
                      className={`w-full py-3 px-3 rounded-xl border-2 text-center transition-all active:scale-[0.98] flex items-center justify-center min-h-[48px] ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white font-bold shadow-md'
                          : 'border-blue-500 hover:border-blue-700 bg-white text-blue-600 hover:bg-blue-50/50'
                      }`}
                    >
                      <span className="text-base font-bold font-mono tracking-wide tabular-nums">
                        {slot.time}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action to Next Step: Enter Details */}
          <div className="pt-4 mt-4 border-t border-neutral-100 flex items-center justify-between gap-3">
            <div className="text-xs text-neutral-500 font-mono">
              {selectedTimeSlot ? (
                <span className="text-neutral-900 font-bold">
                  Jam Dipilih: {selectedTimeSlot} WITA
                </span>
              ) : (
                <span className="text-amber-600 font-medium">Pilih salah satu jam ready</span>
              )}
            </div>

            <button
              type="button"
              disabled={!selectedTimeSlot}
              onClick={onProceed}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all shadow min-h-[44px] ${
                selectedTimeSlot
                  ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 cursor-pointer'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <span>Lanjut Isi Rincian</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
