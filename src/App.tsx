/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ServiceCardsView } from './components/ServiceCardsView';
import { BookingStepModal } from './components/BookingStepModal';
import { BookingSuccessModal } from './components/BookingSuccessModal';
import { EmailPreviewModal } from './components/EmailPreviewModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { Service, Booking, StudioConfig } from './types';
import { getStoredServices, getStoredStudioConfig } from './utils/storage';
import { subscribeToServices, subscribeToStudioConfig } from './utils/firestoreService';
import { testFirestoreConnection } from './utils/firebase';

export default function App() {
  // Services & Studio Config with full admin control & cloud sync
  const [services, setServices] = useState<Service[]>(getStoredServices());
  const [studioConfig, setStudioConfig] = useState<StudioConfig>(getStoredStudioConfig());
  const [dataVersion, setDataVersion] = useState(0);

  // 2-Step Booking Pop-up Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Success Modal & Email Preview State
  const [lastBooking, setLastBooking] = useState<Booking | null>(null);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);

  // Admin Panel Modal State
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Test Firestore connection on boot as mandated by Firestore guidelines
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Real-time Cloud Firestore synchronization across all browsers and devices
  useEffect(() => {
    // Initial local read for instant render
    setServices(getStoredServices());
    setStudioConfig(getStoredStudioConfig());

    // Subscribe to cloud Firestore changes
    const unsubServices = subscribeToServices((cloudServices) => {
      if (cloudServices && cloudServices.length > 0) {
        setServices(cloudServices);
      }
    });

    const unsubConfig = subscribeToStudioConfig((cloudConfig) => {
      if (cloudConfig) {
        setStudioConfig(cloudConfig);
      }
    });

    return () => {
      unsubServices();
      unsubConfig();
    };
  }, [dataVersion]);

  // When user clicks any service card on the homepage
  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setIsBookingModalOpen(true);
  };

  // When booking is successfully confirmed in the 2-step pop-up
  const handleBookingSuccess = (booking: Booking) => {
    setLastBooking(booking);
    setIsBookingModalOpen(false);
    setIsSuccessOpen(true);
    setDataVersion((v) => v + 1);
  };

  const handleDataChanged = () => {
    setDataVersion((v) => v + 1);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans selection:bg-neutral-900 selection:text-white">
      {/* Sleek Top Bar with Studio Config */}
      <Navbar config={studioConfig} onOpenAdmin={() => setIsAdminOpen(true)} />

      {/* Main Screen: Available Services (Self Photo & Profile side-by-side, Photographer centered below) */}
      <main className="flex-1">
        <ServiceCardsView
          services={services}
          config={studioConfig}
          onSelectService={handleSelectService}
          onOpenAdmin={() => setIsAdminOpen(true)}
        />
      </main>

      {/* 2-Step Booking Pop-up Modal (Step 1: Tanggal & Waktu, Step 2: Data Pemesan & Background) */}
      <BookingStepModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        service={selectedService}
        onBookingSuccess={handleBookingSuccess}
      />

      {/* Booking Success Ticket Modal with Dual Email Confirmation & WhatsApp */}
      <BookingSuccessModal
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        booking={lastBooking}
        onOpenEmailPreview={() => setIsEmailPreviewOpen(true)}
      />

      {/* Dual Email Confirmation Previewer Modal */}
      <EmailPreviewModal
        isOpen={isEmailPreviewOpen}
        onClose={() => setIsEmailPreviewOpen(false)}
        booking={lastBooking}
      />

      {/* Admin Panel Modal (PIN: 1234) with Full Control over Descriptions, Open/Close Hours, Durations, and Content */}
      <AdminPanelModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onDataChanged={handleDataChanged}
      />
    </div>
  );
}
