import React from 'react';
import { SERVICES } from '../data/studioData';
import { getStoredStudioConfig } from '../utils/storage';
import { Camera, ShieldCheck, Heart } from 'lucide-react';

interface FooterProps {
  onOpenBooking: () => void;
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenBooking, onOpenAdmin }) => {
  const config = getStoredStudioConfig();

  return (
    <footer className="bg-neutral-950 text-neutral-400 border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-neutral-800/80">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5 text-white">
              <div className="w-8 h-8 bg-white text-neutral-950 rounded-lg flex items-center justify-center font-bold">
                <Camera className="w-4 h-4" />
              </div>
              <span className="font-display font-extrabold text-lg tracking-tight uppercase">
                {config.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-sm leading-relaxed">
              Studio foto mandiri & potret bergaya monokrom minimalis Korea. Abadikan momen terbaik Anda bersama orang tersayang tanpa rasa canggung di ruang studio privat berfasilitas lengkap.
            </p>
            <div className="text-xs text-neutral-500 font-mono">
              {config.address ? `${config.address.toUpperCase()} · ` : ''}EST. 2024
            </div>
          </div>

          {/* Services Links */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-white">
              3 Layanan Studio
            </div>
            <ul className="space-y-2 text-xs">
              {SERVICES.map((s) => (
                <li key={s.id}>
                  <a
                    href="#layanan"
                    className="hover:text-white transition-colors"
                  >
                    {s.name}
                  </a>
                </li>
              ))}
              <li>
                <a href="#jadwal" className="hover:text-white transition-colors">
                  Cek Jadwal & Slot
                </a>
              </li>
            </ul>
          </div>

          {/* Quick Contacts */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-white">
              Kontak & Bantuan
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-neutral-500 block">Email Admin:</span>
                <span className="text-neutral-300 font-mono">{config.adminEmail}</span>
              </li>
              <li>
                <span className="text-neutral-500 block">WhatsApp CS:</span>
                <span className="text-neutral-300 font-mono">+{config.whatsappNumber}</span>
              </li>
              <li className="pt-2">
                <button
                  onClick={onOpenAdmin}
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Portal Admin Studio</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div>
            &copy; {new Date().getFullYear()} {config.name}. Seluruh Hak Cipta Dilindungi.
          </div>
          <div className="flex items-center gap-6">
            <a href="#faq" className="hover:text-neutral-400 transition-colors">
              FAQ
            </a>
            <a href="#lokasi" className="hover:text-neutral-400 transition-colors">
              Lokasi Studio
            </a>
            <button
              onClick={onOpenBooking}
              className="text-white hover:underline font-semibold"
            >
              Book Sesi Foto
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
