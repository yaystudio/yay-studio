import React, { useState } from 'react';
import { Sparkles, HelpCircle, ChevronDown, ChevronUp, Clock, CheckCircle2, Shield, Heart } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    title: 'Check-In & Persiapan',
    desc: 'Tiba 10-15 menit lebih awal. Anda dapat merapikan riasan di vanity mirror kami, memilih aksesoris properti gratis, dan berganti outfit.',
  },
  {
    step: '02',
    title: 'Sesi Foto Privat dengan Remote',
    desc: 'Masuk ke ruang studio privat ber-AC. Pegang wireless shutter remote, lihat pose di live monitor besar, dan ambil foto sebanyak-banyaknya.',
  },
  {
    step: '03',
    title: 'Kurasi & Pilih Foto Favorit',
    desc: 'Setelah sesi selesai, staf kami akan memandu Anda di layar komputer kurasi untuk memilih frame terbaik yang ingin dicetak.',
  },
  {
    step: '04',
    title: 'Cetak Instan & All Soft Files',
    desc: 'Cetak foto strip atau 4R selesai dalam 10 menit. Seluruh file digital resolusi penuh langsung dikirim ke email & Google Drive Anda.',
  },
];

const FAQS = [
  {
    q: 'Apakah pemula yang belum pernah self-photo bisa dibantu?',
    a: 'Tentu saja! Staf kami akan memberikan demo singkat cara memakai wireless remote clicker dan tips sudut pose terbaik sebelum sesi privat Anda dimulai.',
  },
  {
    q: 'Apakah semua soft file foto digital benar-benar diberikan?',
    a: 'Ya, 100%! Semua file foto original hasil jepretan Anda selama sesi akan diunggah ke Google Drive dan link downloadnya dikirim ke email yang Anda daftarkan.',
  },
  {
    q: 'Bagaimana jika kami ingin membawa hewan peliharaan (anjing/kucing)?',
    a: 'Yay Photo Studio ramah hewan peliharaan (pet-friendly). Anda cukup memilih add-on "Bawa Hewan Peliharaan" saat booking agar tim kami menyiapkan area studio.',
  },
  {
    q: 'Apakah boleh berganti pakaian saat sesi foto berlangsung?',
    a: 'Boleh! Kami menyediakan ruang ganti privat di dalam area studio. Namun harap perhatikan durasi waktu sesi Anda tetap berjalan saat berganti pakaian.',
  },
  {
    q: 'Bagaimana kebijakan reschedule jika ada kendala mendadak?',
    a: 'Reschedule jadwal diperbolehkan maksimal 24 jam (H-1) sebelum jam sesi Anda dengan menghubungi admin studio via WhatsApp.',
  },
];

export const StudioGuide: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <section id="alur-booking" className="py-16 sm:py-24 bg-white border-b border-neutral-200 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        {/* Step-by-Step Experience Guide */}
        <div>
          <div className="max-w-3xl mb-12">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase mb-2">
              <span>Alur Pengalaman Studio</span>
              <span aria-hidden="true">·</span>
              <span>4 Langkah Mudah</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-neutral-950 tracking-tight">
              Cara Kerja Sesi di Yay Photo Studio
            </h2>
            <p className="mt-3 text-base text-neutral-600 leading-relaxed">
              Pengalaman foto studio yang nyaman, terstruktur, dan bebas dari rasa canggung sejak Anda melangkahkan kaki ke dalam studio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div
                key={s.step}
                className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex flex-col justify-between hover:border-neutral-400 transition-all"
              >
                <div>
                  <div className="font-mono text-2xl font-extrabold text-neutral-300 mb-4">
                    {s.step}
                  </div>
                  <h3 className="text-lg font-bold font-display text-neutral-950 mb-2">
                    {s.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Studio Facilities & Amenities */}
        <div className="bg-neutral-950 text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
                Fasilitas Premium
              </span>
              <h3 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
                Ruang Privat Lengkap dengan Alat Standar Industri
              </h3>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Kami merancang Yay Photo Studio agar setiap sesi terasa seperti pemotretan majalah fashion pribadi dengan kenyamanan maksimal.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
                <div className="font-bold text-white text-sm">Wireless Clicker</div>
                <div className="text-neutral-400">Remote tanpa kabel respon instan.</div>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
                <div className="font-bold text-white text-sm">Monitor Live View</div>
                <div className="text-neutral-400">Layar 27 inch menghadap Anda.</div>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
                <div className="font-bold text-white text-sm">Beauty Dish Pro</div>
                <div className="text-neutral-400">Cahaya lembut ramah warna kulit.</div>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
                <div className="font-bold text-white text-sm">Lab Photo Printer</div>
                <div className="text-neutral-400">Cetak tahan pudar puluhan tahun.</div>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
                <div className="font-bold text-white text-sm">Aksesoris & Props</div>
                <div className="text-neutral-400">50+ properti gaya unik gratis.</div>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
                <div className="font-bold text-white text-sm">Private Dressing Room</div>
                <div className="text-neutral-400">Area ganti baju & touch-up rapi.</div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div id="faq" className="max-w-3xl mx-auto scroll-mt-20">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase mb-2">
              <HelpCircle className="w-4 h-4 text-neutral-900" />
              <span>Pertanyaan Umum</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-neutral-950">
              Frequently Asked Questions (FAQ)
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50/50 transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-neutral-900 text-sm hover:text-neutral-950"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-neutral-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 bg-white pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
