import React from 'react';
import { Service, StudioConfig } from '../types';
import { STUDIO_CONFIG, SERVICES } from '../data/studioData';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { formatIDR } from '../utils/storage';

interface ServiceCardsViewProps {
  services: Service[];
  config?: StudioConfig;
  onSelectService: (service: Service) => void;
  onOpenAdmin: () => void;
}

export const ServiceCardsView: React.FC<ServiceCardsViewProps> = ({
  services,
  config = STUDIO_CONFIG,
  onSelectService,
}) => {
  const defaultPhotographer = SERVICES.find((s) => s.id === 'photo-by-photographer');
  const selfReguler = services.find((s) => s.id === 'self-photo-reguler') || services[0] || SERVICES[0];
  const profileSelf = services.find((s) => s.id === 'profile-self-photo') || services[1] || SERVICES[1];
  const photographer = services.find((s) => s.id === 'photo-by-photographer') || defaultPhotographer || services[2];

  // Clean WhatsApp number
  const waNumber = (config.whatsappNumber || STUDIO_CONFIG.whatsappNumber).replace(/\D/g, '');
  const cleanWa = waNumber.startsWith('0') ? `62${waNumber.slice(1)}` : waNumber.startsWith('62') ? waNumber : `62${waNumber}`;
  const photographerWaUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(
    `Halo ${config.name || 'Yay Photo Studio'}, saya ingin reservasi/tanya jadwal untuk sesi Photo by Photographer.`
  )}`;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-4 pb-16">
      {/* Studio Header */}
      <div className="text-center py-4 sm:py-6 space-y-1.5 sm:space-y-2">
        <h1 className="text-xl sm:text-3xl font-display font-extrabold text-neutral-950 tracking-tight">
          Pilih Layanan Sesi Foto
        </h1>
        <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto px-2">
          Pilih layanan sesi foto sesuai kebutuhan kamu
        </p>
      </div>

      {/* 2-COLUMN LAYOUT ON SMARTPHONE & WEB:
          Card 1 (Self Photo Reguler) & Card 2 (Profile Self Photo) BERDAMPINGAN
          Card 3 (Photo by Photographer) DI BAWAH TENGAH
      */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 mt-3 sm:mt-5">
        {/* 1. Self Photo Reguler (Left Column) */}
        {selfReguler && (
          <div
            onClick={() => onSelectService(selfReguler)}
            className="group cursor-pointer bg-white rounded-2xl sm:rounded-3xl border border-neutral-200 hover:border-neutral-950 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden active:scale-[0.98]"
          >
            <div>
              {/* Portrait 3:4 Sample Photo */}
              <div className="relative aspect-[3/4] bg-neutral-950 overflow-hidden">
                <img
                  src={selfReguler.image}
                  alt={selfReguler.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-neutral-950/80 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-mono text-white">
                  01 · SELF PHOTO
                </div>
                {selfReguler.badge && (
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-white text-neutral-950 font-bold text-[9px] sm:text-[10px] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow">
                    {selfReguler.badge}
                  </div>
                )}
                {/* Starting price overlay tag */}
                <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 bg-neutral-950/85 backdrop-blur-md p-2 rounded-xl text-white flex items-center justify-between">
                  <div className="text-[10px] sm:text-xs text-neutral-300">Mulai dari</div>
                  <div className="text-xs sm:text-sm font-bold font-mono text-white">
                    {formatIDR(selfReguler.price)}
                  </div>
                </div>
              </div>

              {/* Card Details */}
              <div className="p-3 sm:p-5 space-y-2 sm:space-y-3">
                <div>
                  <h3 className="text-sm sm:text-lg font-display font-bold text-neutral-950 group-hover:text-neutral-800 leading-snug">
                    {selfReguler.name}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-neutral-600 mt-0.5 sm:mt-1 line-clamp-2 leading-relaxed">
                    {selfReguler.subtitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="p-3 sm:p-5 pt-0 mt-auto">
              <button
                type="button"
                className="w-full py-2.5 sm:py-3.5 px-2 sm:px-4 bg-neutral-950 group-hover:bg-neutral-800 text-white font-semibold text-xs sm:text-xs rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all shadow min-h-[40px] sm:min-h-[46px]"
              >
                <span>Pilih & Booking</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Profile Self Photo (Right Column) */}
        {profileSelf && (
          <div
            onClick={() => onSelectService(profileSelf)}
            className="group cursor-pointer bg-white rounded-2xl sm:rounded-3xl border border-neutral-200 hover:border-neutral-950 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden active:scale-[0.98]"
          >
            <div>
              {/* Portrait 3:4 Sample Photo */}
              <div className="relative aspect-[3/4] bg-neutral-950 overflow-hidden">
                <img
                  src={profileSelf.image}
                  alt={profileSelf.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-neutral-950/80 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-mono text-white">
                  02 · PROFILE PORTRAIT
                </div>
                {profileSelf.badge && (
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-white text-neutral-950 font-bold text-[9px] sm:text-[10px] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow">
                    {profileSelf.badge}
                  </div>
                )}
                {/* Starting price overlay tag */}
                <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 bg-neutral-950/85 backdrop-blur-md p-2 rounded-xl text-white flex items-center justify-between">
                  <div className="text-[10px] sm:text-xs text-neutral-300">Mulai dari</div>
                  <div className="text-xs sm:text-sm font-bold font-mono text-white">
                    {formatIDR(profileSelf.price)}
                  </div>
                </div>
              </div>

              {/* Card Details */}
              <div className="p-3 sm:p-5 space-y-2 sm:space-y-3">
                <div>
                  <h3 className="text-sm sm:text-lg font-display font-bold text-neutral-950 group-hover:text-neutral-800 leading-snug">
                    {profileSelf.name}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-neutral-600 mt-0.5 sm:mt-1 line-clamp-2 leading-relaxed">
                    {profileSelf.subtitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="p-3 sm:p-5 pt-0 mt-auto">
              <button
                type="button"
                className="w-full py-2.5 sm:py-3.5 px-2 sm:px-4 bg-neutral-950 group-hover:bg-neutral-800 text-white font-semibold text-xs sm:text-xs rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all shadow min-h-[40px] sm:min-h-[46px]"
              >
                <span>Pilih & Booking</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Photo by Photographer: DI BAWAH TENGAH (Spans across both columns, centered)
            CRITICAL REQUIREMENT: "tidak ada form booking namun diarahkan ke whatsapp langsung untuk bookingnya"
        */}
        {photographer && (
          <div className="col-span-2 flex justify-center mt-2 sm:mt-4">
            <div className="w-full max-w-sm sm:max-w-md bg-white rounded-2xl sm:rounded-3xl border border-neutral-200 hover:border-emerald-600 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden">
              <div>
                {/* Portrait 3:4 Sample Photo */}
                <div className="relative aspect-[3/4] bg-neutral-950 overflow-hidden">
                  <img
                    src={photographer.image}
                    alt={photographer.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-neutral-950/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[9px] sm:text-[10px] font-mono text-white">
                    03 · PRO PHOTOGRAPHER
                  </div>
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-emerald-600 text-white font-bold text-[9px] sm:text-[10px] px-2.5 py-1 rounded-md shadow flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    <span>Booking via WA</span>
                  </div>

                  {/* Starting price overlay */}
                  <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 bg-neutral-950/85 backdrop-blur-md p-2.5 rounded-xl text-white flex items-center justify-between">
                    <div className="text-[10px] sm:text-xs text-neutral-300">Tarif Sesi Mulai</div>
                    <div className="text-xs sm:text-sm font-bold font-mono text-emerald-400">
                      {formatIDR(photographer.price)}
                    </div>
                  </div>
                </div>

                {/* Card Details */}
                <div className="p-4 sm:p-5 space-y-2.5 sm:space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base sm:text-xl font-display font-bold text-neutral-950 leading-snug">
                        {photographer.name}
                      </h3>
                      <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                        {photographer.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Notice: No Booking Form, Direct WA */}
                  <div className="text-[11px] text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-100 leading-relaxed">
                    Khusus layanan fotografer, konsultasi tema dan penjadwalan dilakukan langsung via WhatsApp admin studio.
                  </div>
                </div>
              </div>

              {/* Direct WhatsApp Action Button (NO BOOKING MODAL FORM) */}
              <div className="p-4 sm:p-5 pt-0 mt-auto">
                <a
                  href={photographerWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-md min-h-[46px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Booking via WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Discreet footer information */}
      <div className="mt-12 text-center text-xs text-neutral-500 space-y-1">
        <div>{config.name} · {config.address}</div>
        <div className="font-mono text-[11px]">Buka {config.operatingHours}</div>
      </div>
    </div>
  );
};
