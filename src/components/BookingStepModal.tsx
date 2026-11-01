import React, { useState, useMemo } from 'react';
import { Service, Booking } from '../types';
import { STUDIO_CONFIG } from '../data/studioData';
import { generateBookingId, saveBooking, getMakassarDateTime, getStoredStudioConfig } from '../utils/storage';
import { CalendlyDateTimeSelector } from './CalendlyDateTimeSelector';
import { EnterDetailsForm } from './EnterDetailsForm';
import { X } from 'lucide-react';
import { getAccessToken } from '../utils/googleAuth';
import { createGoogleCalendarEvent } from '../utils/googleCalendar';
import { saveBookingToCloud } from '../utils/firestoreService';
import { dispatchBookingNotifications } from '../utils/emailService';


interface BookingStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service | null;
  onBookingSuccess: (booking: Booking) => void;
}

export const BookingStepModal: React.FC<BookingStepModalProps> = ({
  isOpen,
  onClose,
  service,
  onBookingSuccess,
}) => {
  // 2 Steps: 1 = Calendly Date & Time, 2 = Enter Details
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Date and Time Slot based on Makassar (WITA)
  const todayMakassar = useMemo(() => getMakassarDateTime().todayDate, []);
  const [selectedDate, setSelectedDate] = useState<string>(todayMakassar);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

  // Reset on open or service change
  React.useEffect(() => {
    if (isOpen && service) {
      setCurrentStep(1);
      setSelectedTimeSlot('');
      setSelectedDate(getMakassarDateTime().todayDate);
    }
  }, [isOpen, service]);

  if (!isOpen || !service) return null;

  // Handle final confirmation from EnterDetailsForm
  const handleFinalConfirmBooking = async (finalData: {
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
  }) => {
    const bookingId = generateBookingId();

    const newBooking: Booking = {
      id: bookingId,
      serviceId: service.id,
      serviceName: service.name,
      durationMinutes: service.durationMinutes || 30,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      backdrop: finalData.backdrop,
      peopleCount: finalData.peopleCount,
      customer: finalData.customer,
      totalPrice: finalData.totalPrice,
      paymentNote: finalData.paymentNote,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    saveBooking(newBooking);

    // Persist to Cloud Firestore across all devices
    saveBookingToCloud(newBooking).catch((err) => {
      console.warn('Cloud booking save note:', err);
    });

    // Prepare and dispatch email notifications (customer confirmation & admin notification)
    try {
      const currentConfig = getStoredStudioConfig();
      dispatchBookingNotifications(newBooking, currentConfig);
    } catch (emailErr) {
      console.warn('Email dispatch note:', emailErr);
    }

    // Auto-sync to Google Calendar if access token is active
    try {
      const token = await getAccessToken();
      if (token) {
        createGoogleCalendarEvent(newBooking, token, service.durationMinutes || 30).catch((err) => {
          console.warn('Auto-sync calendar background note:', err);
        });
      }
    } catch (e) {
      console.warn('Auto-sync check error:', e);
    }

    onBookingSuccess(newBooking);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-neutral-950/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl bg-neutral-50 rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden max-h-[96vh] flex flex-col my-3">
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-white border-b border-neutral-200 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 uppercase">
              <span>{STUDIO_CONFIG.name}</span>
              <span>·</span>
              <span className="text-neutral-900 font-semibold">{service.name}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-display font-extrabold text-neutral-950">
              {currentStep === 1 ? 'Pilih Tanggal & Waktu Sesi' : 'Enter Details'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-950 rounded-full hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="px-6 py-2 bg-neutral-100 border-b border-neutral-200 flex items-center justify-between text-xs font-semibold shrink-0">
          <div
            className={`flex items-center gap-1.5 ${
              currentStep === 1 ? 'text-blue-600 font-bold' : 'text-neutral-500'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-neutral-300 text-neutral-600'
              }`}
            >
              1
            </span>
            <span>1. Tanggal & Jam Sesi</span>
          </div>

          <span className="text-neutral-300">──</span>

          <div
            className={`flex items-center gap-1.5 ${
              currentStep === 2 ? 'text-blue-600 font-bold' : 'text-neutral-500'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-neutral-300 text-neutral-600'
              }`}
            >
              2
            </span>
            <span>2. Enter Details & Background</span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-8 overflow-y-auto flex-1">
          {/* STEP 1: CALENDLY-STYLE DATE & TIME SELECTOR (2 SISI & ONLY READY SLOTS) */}
          {currentStep === 1 && (
            <CalendlyDateTimeSelector
              service={service}
              selectedDate={selectedDate}
              selectedTimeSlot={selectedTimeSlot}
              onSelectDate={(date) => setSelectedDate(date)}
              onSelectTimeSlot={(slot) => setSelectedTimeSlot(slot)}
              onProceed={() => setCurrentStep(2)}
            />
          )}

          {/* STEP 2: ENTER DETAILS FORM */}
          {currentStep === 2 && (
            <EnterDetailsForm
              service={service}
              selectedDate={selectedDate}
              selectedTimeSlot={selectedTimeSlot}
              onBack={() => setCurrentStep(1)}
              onConfirmBooking={handleFinalConfirmBooking}
            />
          )}
        </div>
      </div>
    </div>
  );
};
