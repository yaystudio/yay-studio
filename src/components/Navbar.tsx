import React from 'react';
import { Camera, ShieldCheck, MessageCircle } from 'lucide-react';
import { StudioConfig } from '../types';
import { STUDIO_CONFIG } from '../data/studioData';

interface NavbarProps {
  config?: StudioConfig;
  onOpenAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ config, onOpenAdmin }) => {
  const currentConfig = config || STUDIO_CONFIG;

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-4xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-neutral-950 text-white rounded-lg flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display tracking-tight text-base sm:text-lg font-extrabold uppercase text-neutral-950 block leading-none">
              {currentConfig.name}
            </span>
            <span className="text-[10px] text-neutral-500 font-mono tracking-wider uppercase block">
              {currentConfig.tagline || 'Self-Photo & Portrait'}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/${currentConfig.whatsappNumber}?text=${encodeURIComponent(
              `Halo Admin ${currentConfig.name}, saya ingin bertanya tentang booking sesi foto...`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors min-h-[36px]"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Tanya</span>
            <span>WhatsApp</span>
          </a>

          <button
            onClick={onOpenAdmin}
            className="p-2 text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Akses Admin Studio"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
