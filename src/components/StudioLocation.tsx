import React from 'react';
import { STUDIO_CONFIG } from '../data/studioData';
import { getStoredStudioConfig } from '../utils/storage';
import { MapPin, Clock, Mail, Phone, Instagram, Navigation, ShieldCheck } from 'lucide-react';

interface StudioLocationProps {
  onOpenBooking: () => void;
  onOpenAdmin: () => void;
}

export const StudioLocation: React.FC<StudioLocationProps> = ({ onOpenBooking, onOpenAdmin }) => {
  const config = getStoredStudioConfig();

  return (
    <section id="lokasi" className="py-16 sm:py-24 bg-white border-b border-neutral-200 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Location & Contact Info */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              <MapPin className="w-4 h-4 text-neutral-900" />
              <span>Lokasi & Kontak Studio</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-display font-bold text-neutral-950 tracking-tight">
              Lokasi Studio Kami
            </h2>

            <p className="text-base text-neutral-600 leading-relaxed">
              Yay Photo Studio menyediakan ruang foto mandiri dan portrait privat dengan fasilitas lengkap, ber-AC, dan peralatan pencahayaan profesional.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                <MapPin className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold uppercase text-neutral-400">Alamat Lengkap</div>
                  <div className="text-sm font-bold text-neutral-900 mt-0.5">
                    {config.address || 'Alamat dapat diatur melalui Admin Panel'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                  <Clock className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold uppercase text-neutral-400">Jam Operasional</div>
                    <div className="text-xs font-bold text-neutral-900 mt-0.5">{STUDIO_CONFIG.operatingHours}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                  <Mail className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold uppercase text-neutral-400">Email Studio</div>
                    <div className="text-xs font-bold text-neutral-900 mt-0.5 font-mono">{STUDIO_CONFIG.adminEmail}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <a
                href={`https://wa.me/${STUDIO_CONFIG.whatsappNumber}?text=${encodeURIComponent(
                  'Halo Admin Yay Photo Studio, saya ingin bertanya seputar jadwal dan layanan studio...'
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl transition-all shadow"
              >
                <Phone className="w-4 h-4" />
                <span>Hubungi Admin WhatsApp</span>
              </a>

              <button
                onClick={onOpenBooking}
                className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
              >
                <span>Reservasi Online</span>
              </button>
            </div>
          </div>

          {/* Right Column: Visual Map Card with Korean Studio Aesthetic */}
          <div className="lg:col-span-6">
            <div className="relative rounded-3xl bg-neutral-900 p-2 border border-neutral-800 shadow-xl overflow-hidden">
              <div className="relative aspect-[4/3] rounded-2xl bg-neutral-950 flex flex-col justify-between p-6 overflow-hidden">
                {/* Stylized Architectural Street Map Background */}
                <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

                {/* Road lines illustration */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                  <div className="w-full h-1 bg-neutral-600 rotate-12" />
                  <div className="w-1 h-full bg-neutral-600 -rotate-12" />
                </div>

                {/* Top Badge */}
                <div className="relative z-10 flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span className="flex items-center gap-1.5 text-white">
                    <Navigation className="w-3.5 h-3.5 text-red-500" />
                    <span>{config.name.toUpperCase()}</span>
                  </span>
                  <span>{config.address ? config.address.slice(0, 30) : 'LOKASI STUDIO'}</span>
                </div>

                {/* Central Studio Pin */}
                <div className="relative z-10 mx-auto text-center space-y-2">
                  <div className="w-12 h-12 bg-white text-neutral-950 rounded-full flex items-center justify-center mx-auto shadow-lg ring-4 ring-white/20">
                    <MapPin className="w-6 h-6 fill-neutral-950 text-neutral-950" />
                  </div>
                  <div className="bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-neutral-800">
                    <div className="text-sm font-bold text-white font-display">
                      {config.name.toUpperCase()}
                    </div>
                    <div className="text-[11px] text-neutral-400 max-w-[220px] truncate">
                      {config.address || 'Atur alamat di Admin Panel'}
                    </div>
                  </div>
                </div>

                {/* Bottom Amenities */}
                <div className="relative z-10 flex items-center justify-between text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-3">
                  <span>Ruang Privat Ber-AC</span>
                  <span>Self Photo & Portrait</span>
                  {config.address ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-white underline hover:text-neutral-300"
                    >
                      Buka Google Maps
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
