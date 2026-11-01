import { Booking, StudioConfig } from '../types';
import { formatIDR, formatDateIndo } from './storage';

export const DEFAULT_CUSTOMER_EMAIL_SUBJECT = 'Konfirmasi Booking {studioName} - #{bookingId}';
export const DEFAULT_CUSTOMER_EMAIL_GREETING = 'Halo {customerName},';
export const DEFAULT_CUSTOMER_EMAIL_MESSAGE =
  'Terima kasih telah melakukan reservasi di {studioName}. Jadwal sesi foto Anda telah berhasil dikonfirmasi dan dicatat dalam kalender studio kami.';
export const DEFAULT_CUSTOMER_EMAIL_INSTRUCTIONS =
  '1. Harap hadir di studio paling lambat 10 menit sebelum jam sesi dimulai.\n2. Aksesoris bando, topi, kacamata aesthetic & properti foto tersedia gratis di studio.\n3. Semua soft files digital original akan diunggah ke link Google Drive dan dikirimkan ke email ini.';
export const DEFAULT_CUSTOMER_EMAIL_FOOTER =
  'Sampai jumpa di studio! Jika ada pertanyaan atau ingin merubah jadwal, silakan hubungi WhatsApp kami di {whatsappNumber}.';

export const DEFAULT_ADMIN_EMAIL_SUBJECT =
  '[Booking Baru Masuk] {serviceName} - {customerName} (#{bookingId})';

/**
 * Replace placeholders like {customerName}, {bookingId}, etc. with actual booking values
 */
export function replaceEmailPlaceholders(
  template: string,
  booking: Booking,
  config: StudioConfig
): string {
  if (!template) return '';
  return template
    .replace(/{customerName}/g, booking.customer.name)
    .replace(/{nama}/g, booking.customer.name)
    .replace(/{bookingId}/g, booking.id)
    .replace(/{kode_booking}/g, booking.id)
    .replace(/{serviceName}/g, booking.serviceName)
    .replace(/{layanan}/g, booking.serviceName)
    .replace(/{date}/g, formatDateIndo(booking.date))
    .replace(/{tanggal}/g, formatDateIndo(booking.date))
    .replace(/{timeSlot}/g, `${booking.timeSlot} WITA`)
    .replace(/{jam}/g, `${booking.timeSlot} WITA`)
    .replace(/{backdrop}/g, booking.backdrop)
    .replace(/{peopleCount}/g, `${booking.peopleCount} Orang`)
    .replace(/{jumlah_orang}/g, `${booking.peopleCount} Orang`)
    .replace(/{totalPrice}/g, formatIDR(booking.totalPrice))
    .replace(/{total_biaya}/g, formatIDR(booking.totalPrice))
    .replace(/{paymentNote}/g, booking.paymentNote || config.paymentNote || 'Pembayaran di studio')
    .replace(/{studioName}/g, config.name)
    .replace(/{nama_studio}/g, config.name)
    .replace(/{address}/g, config.address)
    .replace(/{alamat}/g, config.address)
    .replace(/{whatsappNumber}/g, config.whatsappNumber)
    .replace(/{whatsapp}/g, config.whatsappNumber)
    .replace(/{customerEmail}/g, booking.customer.email)
    .replace(/{customerWhatsapp}/g, booking.customer.whatsapp);
}

export interface FormattedCustomerEmail {
  to: string;
  subject: string;
  greeting: string;
  message: string;
  instructions: string[];
  footer: string;
  fullPlainText: string;
  gmailComposeUrl: string;
  mailtoUrl: string;
}

export interface FormattedAdminEmail {
  to: string;
  subject: string;
  body: string;
  fullPlainText: string;
  gmailComposeUrl: string;
  mailtoUrl: string;
}

/**
 * Build customer confirmation email with customized templates
 */
export function formatCustomerEmail(booking: Booking, config: StudioConfig): FormattedCustomerEmail {
  const rawSubject = config.customerEmailSubject || DEFAULT_CUSTOMER_EMAIL_SUBJECT;
  const rawGreeting = config.customerEmailGreeting || DEFAULT_CUSTOMER_EMAIL_GREETING;
  const rawMessage = config.customerEmailMessage || DEFAULT_CUSTOMER_EMAIL_MESSAGE;
  const rawInstructions = config.customerEmailInstructions || DEFAULT_CUSTOMER_EMAIL_INSTRUCTIONS;
  const rawFooter = config.customerEmailFooter || DEFAULT_CUSTOMER_EMAIL_FOOTER;

  const subject = replaceEmailPlaceholders(rawSubject, booking, config);
  const greeting = replaceEmailPlaceholders(rawGreeting, booking, config);
  const message = replaceEmailPlaceholders(rawMessage, booking, config);
  const instructionsText = replaceEmailPlaceholders(rawInstructions, booking, config);
  const footer = replaceEmailPlaceholders(rawFooter, booking, config);

  const instructions = instructionsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const fullPlainText = [
    `Subjek: ${subject}`,
    '',
    greeting,
    '',
    message,
    '',
    'RINCIAN RESERVASI:',
    `• Kode Booking: #${booking.id}`,
    `• Paket Layanan: ${booking.serviceName}`,
    `• Tanggal Sesi: ${formatDateIndo(booking.date)}`,
    `• Jam Sesi: ${booking.timeSlot} WITA`,
    `• Pilihan Backdrop: ${booking.backdrop}`,
    `• Jumlah Orang: ${booking.peopleCount} Orang`,
    `• Total Biaya: ${formatIDR(booking.totalPrice)}`,
    `• Metode Pembayaran: ${booking.paymentNote || config.paymentNote || 'Pembayaran dapat dilakukan saat di studio'}`,
    '',
    'PETUNJUK SESI FOTO:',
    ...instructions,
    '',
    footer,
    '',
    `Alamat Studio: ${config.address}`,
    `WhatsApp: https://wa.me/${config.whatsappNumber}`,
  ].join('\n');

  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(fullPlainText.replace(`Subjek: ${subject}\n\n`, ''));
  const recipient = encodeURIComponent(booking.customer.email);

  const mailtoUrl = `mailto:${recipient}?subject=${encodedSubject}&body=${encodedBody}`;
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${encodedSubject}&body=${encodedBody}`;

  return {
    to: booking.customer.email,
    subject,
    greeting,
    message,
    instructions,
    footer,
    fullPlainText,
    gmailComposeUrl,
    mailtoUrl,
  };
}

/**
 * Build admin notification email sent to studio owner
 */
export function formatAdminEmail(booking: Booking, config: StudioConfig): FormattedAdminEmail {
  const adminEmail = config.adminEmail || 'yayphotostudio@gmail.com';
  const rawSubject = config.adminNotificationSubject || DEFAULT_ADMIN_EMAIL_SUBJECT;
  const subject = replaceEmailPlaceholders(rawSubject, booking, config);

  const fullPlainText = [
    `Pemberitahuan: Booking Baru Masuk ke Kalender Studio`,
    `--------------------------------------------------`,
    `Kode Booking: #${booking.id}`,
    `Nama Pelanggan: ${booking.customer.name}`,
    `WhatsApp Pelanggan: ${booking.customer.whatsapp}`,
    `Email Pelanggan: ${booking.customer.email}`,
    booking.customer.notes ? `Catatan Khusus: ${booking.customer.notes}` : '',
    '',
    `Paket Layanan: ${booking.serviceName}`,
    `Tanggal: ${formatDateIndo(booking.date)}`,
    `Jam: ${booking.timeSlot} WITA (GMT+8)`,
    `Backdrop: ${booking.backdrop}`,
    `Jumlah Orang: ${booking.peopleCount} Orang`,
    `Total Biaya: ${formatIDR(booking.totalPrice)}`,
    `Status Bayar: ${booking.paymentNote || 'Pembayaran dapat dilakukan saat di studio'}`,
    `Waktu Booking: ${new Date(booking.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA`,
    `--------------------------------------------------`,
    `Kalender Studio: Segera cek jadwal di kalender atau sinkronkan via Admin Panel.`,
  ]
    .filter(Boolean)
    .join('\n');

  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(fullPlainText);
  const recipient = encodeURIComponent(adminEmail);

  const mailtoUrl = `mailto:${recipient}?subject=${encodedSubject}&body=${encodedBody}`;
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${encodedSubject}&body=${encodedBody}`;

  return {
    to: adminEmail,
    subject,
    body: fullPlainText,
    fullPlainText,
    gmailComposeUrl,
    mailtoUrl,
  };
}

// In-flight and recent dispatch cache to guarantee each booking triggers exactly 1 email request
const dispatchedBookingCache = new Map<string, Promise<any>>();

/**
 * Sends booking email notifications through the backend server via SMTP/API
 */
export async function sendBookingEmailViaApi(
  booking: Booking,
  config: StudioConfig
): Promise<{ success: boolean; delivered?: boolean; notConfigured?: boolean; adminEmail?: string; customerEmail?: string; message?: string; error?: string }> {
  if (!booking?.id) {
    return { success: false, error: 'ID booking tidak valid' };
  }

  // If this booking ID is currently being sent or was sent recently in this session, reuse result
  if (dispatchedBookingCache.has(booking.id)) {
    return dispatchedBookingCache.get(booking.id)!;
  }

  const dispatchPromise = (async () => {
    try {
      const res = await fetch('/api/send-booking-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ booking, config }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        const text = await res.text().catch(() => '');
        data = { error: text.slice(0, 200) || `Server HTTP ${res.status}` };
      }

      if (!res.ok) {
        return {
          success: false,
          error: data.error || data.message || `Server HTTP ${res.status}`,
        };
      }

      return data;
    } catch (err: any) {
      console.warn('Network error triggering booking email dispatch:', err);
      return {
        success: false,
        error: err.message || 'Gagal menghubungi server email',
      };
    }
  })();

  dispatchedBookingCache.set(booking.id, dispatchPromise);
  return dispatchPromise;
}

/**
 * Tests SMTP credentials by calling the backend /api/test-smtp route
 */
export async function testSmtpConnection(params: {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser: string;
  smtpPass: string;
  recipient?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/test-smtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any = {};
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => ({}));
    } else {
      const text = await res.text().catch(() => '');
      data = { error: text.slice(0, 200) || `Server HTTP ${res.status}` };
    }

    if (!res.ok) {
      return {
        success: false,
        error: data.error || data.message || `Server HTTP ${res.status}`,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Koneksi ke server gagal',
    };
  }
}

/**
 * Dispatch / trigger booking emails log & record
 */
export function dispatchBookingNotifications(booking: Booking, config: StudioConfig): {
  customerEmail: FormattedCustomerEmail;
  adminEmail: FormattedAdminEmail;
  adminNotificationSent: boolean;
} {
  const customerEmail = formatCustomerEmail(booking, config);
  const adminEmail = formatAdminEmail(booking, config);
  const enableAdmin = config.enableAdminNotification !== false;

  console.log('[Email Dispatch] Customer confirmation email prepared for:', customerEmail.to);
  if (enableAdmin) {
    console.log('[Email Dispatch] Admin notification email prepared for:', adminEmail.to);
  }

  // Attempt real automated backend delivery in the background
  sendBookingEmailViaApi(booking, config).then((res) => {
    if (res.delivered) {
      console.log('✓ Booking notification email delivered automatically via server to:', res.message);
    } else if (res.notConfigured) {
      console.log('ℹ SMTP not yet configured in admin settings. Pre-filled 1-click Gmail fallback is ready.');
    }
  }).catch((e) => {
    console.warn('Booking email dispatch background error:', e);
  });

  return {
    customerEmail,
    adminEmail,
    adminNotificationSent: enableAdmin,
  };
}
