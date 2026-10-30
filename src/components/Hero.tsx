import React, { useState } from 'react';
import { Calendar, ArrowRight, Sparkles, CheckCircle2, Shield, Heart } from 'lucide-react';

interface HeroProps {
  onOpenBooking: () => void;
}

const SAMPLE_PHOTOBOOTH_FRAMES = [
  {
    title: 'Self Photo Reguler',
    caption: 'Besties Monochrome Strip',
    date: '2026.10',
    tone: 'from-neutral-900 to-neutral-800',
    quote: '"Bebas ketawa lepas tanpa rasa canggung di depan kamera!"',
  },
  {
    title: 'Profile Self Photo',
    caption: 'Executive & CV Headshot',
    date: '2026.10',
    tone: 'from-neutral-800 to-neutral-950',
    quote: '"Hasil rapi, pencahayaan pro beauty dish langsung pas."',
  },
  {
    title: 'Photo by Photographer',
    caption: 'Graduation & Warm Group',
    date: '2026.10',
    tone: 'from-neutral-950 to-neutral-900',
    quote: '"Diarahkan fotografer ramah dengan pose super variatif."',
  },
];

export const Hero: React.FC<HeroProps> = ({ onOpenBooking }) => {
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [shotCount, setShotCount] = useState(42);

  const handleSimulateShutter = () => {
    setIsFlashing(true);
    setShotCount((prev) => prev + 1);
    setTimeout(() => {
      setIsFlashing(false);
      setActiveFrameIndex((prev) => (prev + 1) % SAMPLE_PHOTOBOOTH_FRAMES.length);
    }, 200);
  };

  const currentFrame = SAMPLE_PHOTOBOOTH_FRAMES[activeFrameIndex];

  return (
    <section className="relative overflow-hidden bg-white border-b border-neutral-200">
      {/* Subtle Korean Grid Background Texture */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24">
        {/* Split-Screen Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Typographic Hierarchy */}
          <div className="lg:col-span-7 space-y-6">
            {/* Zero-Pill Clean Unboxed Metadata with Typographic Separator */}
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              <span>Korean Minimalist Photo Studio</span>
              <span aria-hidden="true" className="text-neutral-400">·</span>
              <span>Self-Photo & Portrait</span>
              <span aria-hidden="true" className="text-neutral-400">·</span>
              <span className="text-neutral-900 font-bold">Jakarta Selatan</span>
            </div>

            {/* Hero Headline with text-wrap: balance and refined weight */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-neutral-950 tracking-tight leading-[1.1] max-w-2xl">
              Momen Terbaikmu, <br className="hidden sm:inline" />
              Bebas Bergaya <br className="hidden sm:inline" />
              <span className="italic font-normal underline decoration-neutral-300 underline-offset-8">Tanpa Canggung.</span>
            </h1>

            {/* Lead Prose */}
            <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-xl">
              Studio foto mandiri berkonsep monokrom Korea di Senopati. Kendalikan remote shutter sendiri di ruang privat ber-AC, pantau pose lewat live monitor, dan dapatkan cetak photo strip premium serta semua file digital instan.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={onOpenBooking}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 text-base font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-98 whitespace-nowrap"
              >
                <Calendar className="w-5 h-5" />
                <span>Pilih Jadwal & Reservasi</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#layanan"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-neutral-800 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200/80 rounded-xl transition-colors whitespace-nowrap"
              >
                <span>Lihat 3 Layanan Studio</span>
              </a>
            </div>

            {/* Trust Markers without pills */}
            <div className="pt-4 border-t border-neutral-100 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-neutral-600 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-neutral-900" />
                <span>100% Ruang Studio Privat</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-neutral-900" />
                <span>Semua File Digital Diberikan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-neutral-900" />
                <span>Cetak Lab Quality Foto Strip</span>
              </div>
            </div>
          </div>

          {/* Right Column: Korean Studio Viewfinder & Interactive Shutter Simulation */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md lg:max-w-none bg-neutral-950 text-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-neutral-800">
              {/* Flash Overlay effect on shutter click */}
              {isFlashing && (
                <div className="absolute inset-0 bg-white z-30 rounded-2xl animate-fade-out" />
              )}

              {/* Camera Top HUD */}
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white font-semibold">REC [LIVE VIEW]</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>AF-C · FACE DETECT</span>
                  <span className="text-neutral-300 font-bold">100% BAT</span>
                </div>
              </div>

              {/* Viewfinder Main Frame */}
              <div className="relative aspect-[4/5] bg-neutral-900 rounded-xl overflow-hidden my-3 border border-neutral-800 flex flex-col justify-between p-4">
                {/* Viewfinder Corner Brackets */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-neutral-400 pointer-events-none" />
                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-neutral-400 pointer-events-none" />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-neutral-400 pointer-events-none" />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-neutral-400 pointer-events-none" />

                {/* Viewfinder Center Crosshair */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-16 h-16 border border-neutral-600/60 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-neutral-400/80 rounded-full" />
                  </div>
                </div>

                {/* Stylized Monochrome Photo Card inside Viewfinder */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-mono text-neutral-300">
                    FRAME 0{activeFrameIndex + 1} / 03
                  </div>
                  <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>REMOTE CONNECTED</span>
                  </div>
                </div>

                {/* Simulated Photo Visual Aesthetic */}
                <div className="relative z-10 my-auto text-center px-4 py-8 bg-neutral-950/70 backdrop-blur-sm rounded-lg border border-neutral-800/80">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-white">
                    <Heart className="w-6 h-6 text-neutral-300" />
                  </div>
                  <div className="text-xs uppercase tracking-widest text-neutral-400 font-mono mb-1">
                    {currentFrame.title}
                  </div>
                  <div className="text-xl font-display font-bold text-white mb-2">
                    {currentFrame.caption}
                  </div>
                  <p className="text-xs text-neutral-300 italic max-w-xs mx-auto">
                    {currentFrame.quote}
                  </p>
                </div>

                {/* Bottom Viewfinder Info */}
                <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span>ISO 100</span>
                  <span>1/250s · f/2.8</span>
                  <span className="text-white font-bold">SHOT #{shotCount}</span>
                </div>
              </div>

              {/* Shutter Click Remote Controller Interaction */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <div className="text-xs text-neutral-400 font-mono">
                  <span className="text-white font-medium">Wireless Clicker</span>
                  <p className="text-[10px] text-neutral-500">Klik tombol untuk coba remote</p>
                </div>

                <button
                  onClick={handleSimulateShutter}
                  className="group flex items-center gap-2 px-4 py-2 bg-white text-neutral-950 hover:bg-neutral-200 active:scale-95 font-semibold text-xs rounded-lg transition-all shadow"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 group-hover:scale-125 transition-transform" />
                  <span>Klik Shutter Remote</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Row Below Hero Split: 4-Column Metric/Feature Strip */}
        <div className="mt-16 pt-10 border-t border-neutral-200 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-950 tabular-nums">
              100%
            </div>
            <div className="text-sm font-semibold text-neutral-900">Ruang Studio Privat</div>
            <p className="text-xs text-neutral-500">Pintu tertutup rapat & bebas gaya tanpa ditonton orang lain.</p>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-950 tabular-nums">
              30 - 60 Min
            </div>
            <div className="text-sm font-semibold text-neutral-900">Durasi Sesi Sesuai Paket</div>
            <p className="text-xs text-neutral-500">Waktu terstruktur untuk foto leluasa dan pemilihan hasil.</p>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-950 tabular-nums">
              All Files
            </div>
            <div className="text-sm font-semibold text-neutral-900">Digital Soft Files Diberikan</div>
            <p className="text-xs text-neutral-500">Semua foto asli langsung dikirim via link Google Drive.</p>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-display font-bold text-neutral-950 tabular-nums">
              4.9 / 5.0
            </div>
            <div className="text-sm font-semibold text-neutral-900">Kepuasan Pelanggan</div>
            <p className="text-xs text-neutral-500">Lebih dari 1.500+ sesi foto sukses di Yay Photo Studio.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
