import React from 'react';
import { SERVICES, BACKDROP_OPTIONS } from '../data/studioData';
import { Service } from '../types';
import { formatIDR } from '../utils/storage';
import { Clock, Users, Image as ImageIcon, Sparkles, Check, ArrowRight } from 'lucide-react';

interface ServicesShowcaseProps {
  onSelectService: (service: Service) => void;
}

export const ServicesShowcase: React.FC<ServicesShowcaseProps> = ({ onSelectService }) => {
  return (
    <section id="layanan" className="py-16 sm:py-24 bg-neutral-50 border-b border-neutral-200 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase mb-2">
            <span>Paket & Layanan</span>
            <span aria-hidden="true">·</span>
            <span>Yay Photo Studio</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-neutral-950 tracking-tight">
            Pilihan Layanan Sesi Foto Kami
          </h2>
          <p className="mt-3 text-base text-neutral-600 leading-relaxed">
            Tersedia 3 jenis layanan yang dapat disesuaikan dengan kebutuhan Anda, mulai dari self-photo santai bersama teman, foto profil semi-formal untuk karier, hingga sesi grup bersama fotografer profesional.
          </p>
        </div>

        {/* 3 Services Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {SERVICES.map((service, index) => {
            const isFeatured = service.id === 'self-photo-reguler';

            return (
              <div
                key={service.id}
                className={`flex flex-col justify-between bg-white rounded-2xl border transition-all duration-200 ${
                  isFeatured
                    ? 'border-neutral-900 shadow-xl ring-1 ring-neutral-900'
                    : 'border-neutral-200 shadow-sm hover:shadow-md'
                }`}
              >
                <div>
                  {/* Card Visual Header / Photo Concept Frame */}
                  <div className="p-6 border-b border-neutral-100">
                    <div className="flex items-center justify-between text-xs font-mono text-neutral-500 mb-3">
                      <span>SERVICE 0{index + 1}</span>
                      {service.badge && (
                        <span className="font-semibold text-neutral-950 uppercase tracking-wider">
                          {service.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="text-2xl font-display font-bold text-neutral-950 tracking-tight">
                      {service.name}
                    </h3>

                    <p className="mt-2 text-sm text-neutral-600 min-h-[40px] leading-relaxed">
                      {service.subtitle}
                    </p>

                    {/* Price Block */}
                    <div className="mt-5 pt-4 border-t border-neutral-100 flex items-baseline gap-2">
                      <span className="text-3xl font-display font-extrabold text-neutral-950 tabular-nums">
                        {formatIDR(service.price)}
                      </span>
                      <span className="text-sm line-through text-neutral-400 tabular-nums">
                        {formatIDR(service.originalPrice)}
                      </span>
                      <span className="text-xs text-neutral-500 font-medium">/ sesi</span>
                    </div>

                    {/* Quick Specs */}
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-700 shrink-0" />
                        <span>{service.durationMinutes} Menit Total</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-neutral-700 shrink-0" />
                        <span>Max {service.maxPeople} Orang Awal</span>
                      </div>
                    </div>
                  </div>

                  {/* Highlights & Included Facilities */}
                  <div className="p-6 space-y-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Fasilitas yang Didapat:
                    </div>

                    <ul className="space-y-2.5 text-xs sm:text-sm text-neutral-700">
                      {service.perks.map((perk, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-3 border-t border-neutral-100 text-xs text-neutral-500">
                      <span className="font-semibold text-neutral-800">Direkomendasikan untuk: </span>
                      {service.recommendedFor}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-6 pt-0 mt-auto">
                  {service.id === 'photo-by-photographer' ? (
                    <a
                      href="https://wa.me/6281234567890?text=Halo%20Yay%20Photo%20Studio%2C%20saya%20ingin%20booking%20Photo%20by%20Photographer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-98 bg-emerald-600 hover:bg-emerald-700 text-white shadow"
                    >
                      <span>Booking via WhatsApp</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  ) : (
                    <button
                      onClick={() => onSelectService(service)}
                      className={`w-full py-3.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-98 ${
                        isFeatured
                          ? 'bg-neutral-950 hover:bg-neutral-800 text-white shadow'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                      }`}
                    >
                      <span>Pilih Paket & Cek Slot</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Studio Backdrops Section Preview */}
        <div className="mt-16 bg-white rounded-2xl p-6 sm:p-8 border border-neutral-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h4 className="text-lg font-bold text-neutral-950 font-display">
                Pilihan Warna Backdrop Studio
              </h4>
              <p className="text-xs sm:text-sm text-neutral-600">
                Semua sesi foto dapat memilih salah satu dari 4 warna background minimalis berikut tanpa biaya tambahan:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {BACKDROP_OPTIONS.map((bg) => (
              <div
                key={bg.id}
                className="p-4 rounded-xl border border-neutral-200 flex flex-col items-center text-center gap-2.5 bg-neutral-50/50"
              >
                <div
                  className="w-12 h-12 rounded-full border shadow-inner"
                  style={{ backgroundColor: bg.colorHex, borderColor: bg.borderHex }}
                />
                <div>
                  <div className="text-xs font-bold text-neutral-900">{bg.name}</div>
                  <div className="text-[11px] text-neutral-500">{bg.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
