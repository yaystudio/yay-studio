import React, { useState } from 'react';
import {
  Booking,
  BookingStatus,
  BlockedSlot,
  Service,
  StudioConfig,
  BackdropOption,
  TrafficStats,
  ExternalCalendarBlock,
} from '../types';
import { BACKDROP_OPTIONS, SERVICES } from '../data/studioData';
import {
  getStoredBookings,
  saveBooking,
  updateBookingStatus,
  deleteBooking,
  getStoredBlockedSlots,
  getStoredExternalCalendarBlocks,
  getMakassarDateTime,
  getStoredServices,
  updateService,
  getStoredStudioConfig,
  updateStudioConfig,
  resetDemoData,
  formatIDR,
  formatDateIndo,
} from '../utils/storage';
import {
  DEFAULT_CUSTOMER_EMAIL_SUBJECT,
  DEFAULT_CUSTOMER_EMAIL_GREETING,
  DEFAULT_CUSTOMER_EMAIL_MESSAGE,
  DEFAULT_CUSTOMER_EMAIL_INSTRUCTIONS,
  DEFAULT_CUSTOMER_EMAIL_FOOTER,
  DEFAULT_ADMIN_EMAIL_SUBJECT,
  formatCustomerEmail,
  formatAdminEmail,
  testSmtpConnection,
  sendBookingEmailViaApi,
} from '../utils/emailService';

import {
  X,
  ShieldCheck,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Search,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  Trash2,
  MessageCircle,
  RefreshCw,
  Sliders,
  Image as ImageIcon,
  Upload,
  Check,
  Edit3,
  DollarSign,
  Users,
  Save,
  Building,
  ExternalLink,
  Loader2,
  CalendarCheck,
  Plus,
  Palette,
  AlertTriangle,
  Copy,
  Zap,
  Send,
  Key,
  HelpCircle,
  Eye,
  EyeOff,
  AlertCircle,
  RotateCcw,
  Download,
} from 'lucide-react';
import { generateGoogleCalendarWebUrl } from '../utils/googleCalendar';
import {
  saveServiceToCloud,
  saveStudioConfigToCloud,
  saveBookingToCloud,
  deleteBookingFromCloud,
  subscribeToBookings,
  subscribeToServices,
  cleanForFirestore,
  getStoredTrafficStats,
  subscribeToTrafficStats,
  resetCurrentMonthTraffic,
  formatMonthYearIndo,
  getNextMonthResetIndo,
  subscribeToExternalCalendarBlocks,
  refreshExternalCalendarBlocks,
} from '../utils/firestoreService';
import { compressServiceImage } from '../utils/imageCompressor';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Active Tab: 'services' | 'bookings' | 'calendar' | 'email' | 'studio'
  const [activeTab, setActiveTab] = useState<'services' | 'bookings' | 'calendar' | 'email' | 'studio'>('services');
  const [emailPreviewTab, setEmailPreviewTab] = useState<'customer' | 'admin'>('customer');
  const [copiedVariableTag, setCopiedVariableTag] = useState<string>('');
  const [isSavingEmail, setIsSavingEmail] = useState<boolean>(false);

  // Booking list filters & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Local sync states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [studioConfig, setStudioConfig] = useState<StudioConfig>(getStoredStudioConfig());
  const [trafficStats, setTrafficStats] = useState<TrafficStats>(getStoredTrafficStats());
  const [isResettingTraffic, setIsResettingTraffic] = useState<boolean>(false);
  const [externalCalendarBlocks, setExternalCalendarBlocks] = useState<ExternalCalendarBlock[]>(
    getStoredExternalCalendarBlocks()
  );
  const [isRefreshingExternalCal, setIsRefreshingExternalCal] = useState<boolean>(false);

  // Editing service state
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newTierPeople, setNewTierPeople] = useState<number>(3);
  const [newTierPrice, setNewTierPrice] = useState<number>(150000);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [isSavingService, setIsSavingService] = useState<boolean>(false);

  // Success Notification banner
  const [successNotif, setSuccessNotif] = useState<string>('');

  // SMTP and Email Notification testing states
  const [isTestingEmail, setIsTestingEmail] = useState<boolean>(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAppPasswordHelp, setShowAppPasswordHelp] = useState<boolean>(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState<boolean>(false);
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);

  const handleTestSmtp = async () => {
    setIsTestingEmail(true);
    setTestEmailResult(null);
    try {
      const recipient = studioConfig.adminEmail || 'yayphotostudio@gmail.com';
      const res = await testSmtpConnection({
        smtpHost: studioConfig.smtpHost || 'smtp.gmail.com',
        smtpPort: studioConfig.smtpPort || 465,
        smtpUser: studioConfig.smtpUser || studioConfig.adminEmail || 'yayphotostudio@gmail.com',
        smtpPass: studioConfig.smtpPass || '',
        recipient,
      });
      if (res.success) {
        setTestEmailResult({ success: true, message: res.message || `Email uji coba berhasil dikirim ke ${recipient}!` });
      } else {
        setTestEmailResult({ success: false, message: res.error || 'Gagal mengirim email uji coba.' });
      }
    } catch (err: any) {
      setTestEmailResult({ success: false, message: err.message || 'Koneksi ke server gagal.' });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleResendBookingNotification = async (b: Booking) => {
    setResendingEmailId(b.id);
    try {
      const res = await sendBookingEmailViaApi(b, studioConfig);
      if (res.delivered) {
        setSuccessNotif(`✓ Email booking #${b.id} berhasil dikirim ke ${studioConfig.adminEmail || 'yayphotostudio@gmail.com'}`);
      } else if (res.notConfigured) {
        setSuccessNotif(`ℹ Sandi Aplikasi belum diisi. Membuka Gmail...`);
        const adminEmailObj = formatAdminEmail(b, studioConfig);
        window.open(adminEmailObj.gmailComposeUrl, '_blank');
      } else {
        alert(res.error || 'Gagal mengirim email');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim');
    } finally {
      setResendingEmailId(null);
      setTimeout(() => setSuccessNotif(''), 3500);
    }
  };

  // Handle person pricing updates
  const handleUpdateTierPrice = (count: number, price: number) => {
    if (!editingService) return;
    const currentPricing = { ...(editingService.personPricing || {}) };
    currentPricing[count] = price;
    const nextEditing = {
      ...editingService,
      personPricing: currentPricing,
      ...(count === editingService.maxPeople ? { price } : {}),
    };
    setEditingService(nextEditing);
  };

  const handleAddNewTier = () => {
    if (!editingService || newTierPeople < 1) return;
    const currentPricing = { ...(editingService.personPricing || {}) };
    currentPricing[newTierPeople] = newTierPrice;
    setEditingService({
      ...editingService,
      personPricing: currentPricing,
    });
    setNewTierPeople(newTierPeople + 1);
  };

  const handleDeleteTier = (count: number) => {
    if (!editingService) return;
    const currentPricing = { ...(editingService.personPricing || {}) };
    delete currentPricing[count];
    setEditingService({
      ...editingService,
      personPricing: currentPricing,
    });
  };

  // State for adding new custom backdrop for this specific service
  const [newBgName, setNewBgName] = useState<string>('');
  const [newBgColor, setNewBgColor] = useState<string>('#E2E8F0');
  const [newBgDesc, setNewBgDesc] = useState<string>('');

  // Handle adding a new backdrop to editingService
  const handleAddBackdrop = () => {
    if (!editingService || !newBgName.trim()) {
      alert('Silakan isi nama background terlebih dahulu.');
      return;
    }
    const currentBackdrops =
      editingService.backdrops && editingService.backdrops.length > 0
        ? [...editingService.backdrops]
        : [...BACKDROP_OPTIONS];

    const newId = `bg-${Date.now()}`;
    const newBackdrop: BackdropOption = {
      id: newId,
      name: newBgName.trim(),
      colorHex: newBgColor,
      borderHex: '#cbd5e1',
      ...(newBgDesc.trim() ? { desc: newBgDesc.trim() } : {}),
    };

    setEditingService({
      ...editingService,
      backdrops: [...currentBackdrops, newBackdrop],
    });
    setNewBgName('');
    setNewBgDesc('');
    setNewBgColor('#E2E8F0');
  };

  // Handle deleting a backdrop from editingService
  const handleDeleteBackdrop = (bgId: string) => {
    if (!editingService) return;
    const currentBackdrops =
      editingService.backdrops && editingService.backdrops.length > 0
        ? [...editingService.backdrops]
        : [...BACKDROP_OPTIONS];

    if (currentBackdrops.length <= 1) {
      alert('Layanan harus memiliki minimal 1 pilihan background.');
      return;
    }

    const updated = currentBackdrops.filter((b) => b.id !== bgId);
    setEditingService({
      ...editingService,
      backdrops: updated,
    });
  };

  // Load data on open
  React.useEffect(() => {
    let unsubBookings: (() => void) | undefined;
    let unsubServices: (() => void) | undefined;
    let unsubTraffic: (() => void) | undefined;
    let unsubExternalCal: (() => void) | undefined;
    if (isOpen) {
      const svcs = getStoredServices();
      const bks = getStoredBookings();
      setBookings(bks);
      setBlockedSlots(getStoredBlockedSlots());
      setExternalCalendarBlocks(getStoredExternalCalendarBlocks());
      setServices(svcs);
      setStudioConfig(getStoredStudioConfig());
      setTrafficStats(getStoredTrafficStats());
      if (svcs.length > 0 && !selectedServiceId) {
        setSelectedServiceId(svcs[0].id);
        setEditingService({ ...svcs[0] });
      }

      // Real-time booking subscription from Cloud Firestore
      unsubBookings = subscribeToBookings((cloudBookings) => {
        setBookings(cloudBookings);
      });

      // Real-time services subscription from Cloud Firestore
      unsubServices = subscribeToServices((cloudSvcs) => {
        if (cloudSvcs && cloudSvcs.length > 0) {
          setServices(cloudSvcs);
          if (!selectedServiceId && cloudSvcs.length > 0) {
            setSelectedServiceId(cloudSvcs[0].id);
            setEditingService({ ...cloudSvcs[0] });
          }
        }
      });

      // Real-time visitor traffic subscription from Cloud Firestore
      unsubTraffic = subscribeToTrafficStats((cloudTraffic) => {
        if (cloudTraffic) {
          setTrafficStats(cloudTraffic);
        }
      });

      // Real-time external smartphone Google Calendar blocks subscription
      unsubExternalCal = subscribeToExternalCalendarBlocks((blocks) => {
        setExternalCalendarBlocks(blocks);
      });

      refreshExternalCalendarBlocks().then((res) => {
        if (res.blocks) {
          setExternalCalendarBlocks(res.blocks);
        }
      });
    }
    return () => {
      if (unsubBookings) unsubBookings();
      if (unsubServices) unsubServices();
      if (unsubTraffic) unsubTraffic();
      if (unsubExternalCal) unsubExternalCal();
    };
  }, [isOpen]);

  const handleForceRefreshSmartphoneCalendar = async () => {
    setIsRefreshingExternalCal(true);
    try {
      const res = await refreshExternalCalendarBlocks(true);
      setExternalCalendarBlocks(res.blocks || []);
      setSuccessNotif('✓ Jadwal dari Google Calendar smartphone berhasil diperbarui!');
      setTimeout(() => setSuccessNotif(''), 3500);
      onDataChanged();
    } finally {
      setIsRefreshingExternalCal(false);
    }
  };

  const handleManualResetTraffic = async () => {
    if (!window.confirm(`Reset hitungan pengunjung bulan ${formatMonthYearIndo(trafficStats.currentMonth)} kembali ke 0?`)) {
      return;
    }
    setIsResettingTraffic(true);
    try {
      const reset = await resetCurrentMonthTraffic();
      setTrafficStats(reset);
      setSuccessNotif(`✓ Hitungan trafik pengunjung bulan ${formatMonthYearIndo(reset.currentMonth)} berhasil di-reset ke 0.`);
      setTimeout(() => setSuccessNotif(''), 3500);
    } catch (err) {
      console.warn('Reset traffic error:', err);
    } finally {
      setIsResettingTraffic(false);
    }
  };

  // When selected service to edit changes
  const handleSelectServiceToEdit = (svcId: string) => {
    setSelectedServiceId(svcId);
    const found = services.find((s) => s.id === svcId) || SERVICES.find((s) => s.id === svcId);
    if (found) {
      setEditingService({ ...found });
    }
  };

  if (!isOpen) return null;

  // PIN Login Form
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234' || pinInput === 'admin') {
      setIsAuthenticated(true);
      setPinError('');
    } else {
      setPinError('PIN salah. Gunakan PIN default: 1234');
    }
  };

  // Status Updater
  const handleStatusChange = (bookingId: string, newStatus: BookingStatus) => {
    const updated = updateBookingStatus(bookingId, newStatus);
    setBookings(updated);
    const target = updated.find((b) => b.id === bookingId);
    if (target) {
      saveBookingToCloud(target).catch((err) => console.warn('Cloud sync error:', err));
    }
    onDataChanged();
  };

  // Delete Booking
  const handleDeleteBooking = (bookingId: string) => {
    if (window.confirm('Hapus reservasi ini dari sistem?')) {
      const updated = deleteBooking(bookingId);
      setBookings(updated);
      deleteBookingFromCloud(bookingId).catch((err) => console.warn('Cloud sync error:', err));
      onDataChanged();
    }
  };

  // Save Service Changes (Full Control over Description, Duration, Open/Close Time, Price)
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    setIsSavingService(true);
    try {
      const sanitized = cleanForFirestore(editingService);
      const updatedList = updateService(sanitized);
      setServices(updatedList);
      setEditingService(sanitized);
      await saveServiceToCloud(sanitized);
      onDataChanged();
      setSuccessNotif(`Layanan "${sanitized.name}" berhasil disimpan ke Cloud Database!`);
      setTimeout(() => setSuccessNotif(''), 3000);
    } catch (err: any) {
      console.error('Save service error:', err);
      alert('Gagal menyimpan layanan ke Cloud: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSavingService(false);
    }
  };

  // Upload image for current service with automatic compression (<100KB, 3:4 portrait)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingService) {
      setIsProcessingImage(true);
      try {
        const compressedBase64 = await compressServiceImage(file);
        const updated = cleanForFirestore({ ...editingService, image: compressedBase64 });
        setEditingService(updated);

        // Instantly save to storage and cloud
        const updatedList = updateService(updated);
        setServices(updatedList);
        await saveServiceToCloud(updated);
        onDataChanged();
        setSuccessNotif(`Foto layanan "${updated.name}" berhasil diperbarui & disimpan ke Cloud!`);
        setTimeout(() => setSuccessNotif(''), 3000);
      } catch (err: any) {
        console.error('Image upload error:', err);
        alert('Gagal memproses foto: ' + (err.message || 'File tidak didukung'));
      } finally {
        setIsProcessingImage(false);
        e.target.value = '';
      }
    }
  };

  // Reset photo to default studio illustration
  const handleResetDefaultImage = async () => {
    if (!editingService) return;
    const defaultSvc = SERVICES.find((s) => s.id === editingService.id);
    if (!defaultSvc) return;

    if (window.confirm(`Kembalikan foto "${editingService.name}" ke foto ilustrasi bawaan studio?`)) {
      setIsProcessingImage(true);
      try {
        const updated = cleanForFirestore({ ...editingService, image: defaultSvc.image });
        setEditingService(updated);
        const updatedList = updateService(updated);
        setServices(updatedList);
        await saveServiceToCloud(updated);
        onDataChanged();
        setSuccessNotif(`Foto "${updated.name}" berhasil dikembalikan ke bawaan studio.`);
        setTimeout(() => setSuccessNotif(''), 3000);
      } catch (err: any) {
        console.error('Reset image error:', err);
      } finally {
        setIsProcessingImage(false);
      }
    }
  };

  // Save Studio Settings
  const handleSaveStudioConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateStudioConfig(studioConfig);
    setStudioConfig(updated);
    saveStudioConfigToCloud(updated).catch((err) => console.warn('Cloud sync error:', err));
    onDataChanged();
    setSuccessNotif('Pengaturan informasi studio berhasil disimpan ke Cloud Database!');
    setTimeout(() => setSuccessNotif(''), 3000);
  };

  // Save Email & Notification Settings
  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmail(true);
    try {
      const sanitized = cleanForFirestore(studioConfig);
      const updated = updateStudioConfig(sanitized);
      setStudioConfig(updated);
      await saveStudioConfigToCloud(sanitized);
      onDataChanged();
      setSuccessNotif('Template email & pengaturan notifikasi berhasil disimpan ke Cloud Database!');
      setTimeout(() => setSuccessNotif(''), 3500);
    } catch (err: any) {
      console.error('Save email config error:', err);
      alert('Gagal menyimpan ke Cloud: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Reset Customer Email Template to Default
  const handleResetCustomerEmailTemplate = () => {
    if (window.confirm('Kembalikan format pesan email customer ke template bawaan studio?')) {
      const resetConfig: StudioConfig = {
        ...studioConfig,
        customerEmailSubject: DEFAULT_CUSTOMER_EMAIL_SUBJECT,
        customerEmailGreeting: DEFAULT_CUSTOMER_EMAIL_GREETING,
        customerEmailMessage: DEFAULT_CUSTOMER_EMAIL_MESSAGE,
        customerEmailInstructions: DEFAULT_CUSTOMER_EMAIL_INSTRUCTIONS,
        customerEmailFooter: DEFAULT_CUSTOMER_EMAIL_FOOTER,
      };
      setStudioConfig(resetConfig);
      setSuccessNotif('Template email customer dikembalikan ke format bawaan studio.');
      setTimeout(() => setSuccessNotif(''), 2500);
    }
  };


  // Reset Demo
  const handleResetData = () => {
    if (window.confirm('Reset semua data layanan, slot, dan booking ke awal?')) {
      resetDemoData();
      const svcs = getStoredServices();
      setBookings(getStoredBookings());
      setBlockedSlots(getStoredBlockedSlots());
      setServices(svcs);
      setStudioConfig(getStoredStudioConfig());
      if (svcs.length > 0) {
        setSelectedServiceId(svcs[0].id);
        setEditingService({ ...svcs[0] });
      }
      onDataChanged();
    }
  };

  // Filtered Bookings (strictly guard against any incomplete or stub objects)
  const filteredBookings = bookings.filter((b) => {
    if (!b || !b.customer || typeof b.customer.name !== 'string') return false;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (b.customer.name || '').toLowerCase().includes(q) ||
      (b.id || '').toLowerCase().includes(q) ||
      (b.customer.whatsapp || '').includes(searchQuery) ||
      (b.serviceName || '').toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-neutral-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden my-6">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-neutral-200" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                PANEL KONTROL STUDIO
              </div>
              <h3 className="text-base font-bold font-display">
                Kelola Website & Layanan Yay Photo Studio
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success toast notification */}
        {successNotif && (
          <div className="bg-emerald-600 text-white text-xs px-4 py-2 font-medium flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successNotif}</span>
          </div>
        )}

        {/* PIN LOGIN SCREEN */}
        {!isAuthenticated ? (
          <div className="p-8 sm:p-12 text-center max-w-md mx-auto space-y-6">
            <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto text-neutral-800">
              <Lock className="w-7 h-7" />
            </div>

            <div>
              <h4 className="text-xl font-bold font-display text-neutral-950">
                Akses Khusus Admin Studio
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Masukkan PIN keamanan untuk mengatur isi website, deskripsi layanan, jam buka-tutup, dan durasi.
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Masukkan PIN (Default: 1234)"
                  autoFocus
                  className="w-full text-center tracking-[0.5em] text-lg font-mono py-3 px-4 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                />
                {pinError && <p className="text-xs text-red-600 mt-2">{pinError}</p>}
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs rounded-xl transition-all shadow"
              >
                Buka Panel Admin
              </button>

              <div className="text-[11px] text-neutral-400 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                Tip pengujian: Gunakan kode PIN <strong className="text-neutral-800 font-mono">1234</strong>
              </div>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED DASHBOARD */
          <div>
            {/* Navigation Tabs */}
            <div className="px-6 bg-white border-b border-neutral-200 flex items-center justify-between overflow-x-auto">
              <div className="flex gap-4 sm:gap-6">
                <button
                  onClick={() => setActiveTab('services')}
                  className={`py-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'services'
                      ? 'border-neutral-950 text-neutral-950'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Kelola Layanan (Deskripsi, Jam, Durasi)</span>
                </button>

                <button
                  onClick={() => setActiveTab('bookings')}
                  className={`py-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'bookings'
                      ? 'border-neutral-950 text-neutral-950'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Daftar Reservasi ({bookings.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`py-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'calendar'
                      ? 'border-neutral-950 text-neutral-950'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4 text-blue-600" />
                  <span>Google Calendar</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Aktif Otomatis 24/7" />
                </button>


                <button
                  onClick={() => setActiveTab('email')}
                  className={`py-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'email'
                      ? 'border-neutral-950 text-neutral-950 font-bold'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Mail className="w-4 h-4 text-neutral-800" />
                  <span>Template Email & Notifikasi</span>
                </button>

                <button
                  onClick={() => setActiveTab('studio')}
                  className={`py-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'studio'
                      ? 'border-neutral-950 text-neutral-950'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span>Info Studio & Teks</span>
                </button>
              </div>

              <button
                onClick={() => setIsAuthenticated(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700 py-2 shrink-0 ml-4"
              >
                Kunci
              </button>
            </div>

            {/* MONTHLY WEBSITE VISITOR TRAFFIC SUMMARY BAR (AUTO-RESETS EVERY MONTH) */}
            <div className="px-6 py-3.5 bg-neutral-950 text-white border-b border-neutral-800">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        Trafik Pengunjung Website — {formatMonthYearIndo(trafficStats.currentMonth)}
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                        Reset Otomatis Tiap Bulan
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Hitungan di-reset otomatis ke 0 setiap pergantian bulan. Jadwal reset berikutnya:{' '}
                      <strong className="text-neutral-200 font-mono">
                        {getNextMonthResetIndo(trafficStats.currentMonth)}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-[9px] font-mono uppercase text-neutral-400 leading-none">
                        Total Kunjungan Bulan Ini
                      </div>
                      <div className="text-sm font-extrabold font-mono text-white leading-tight mt-0.5">
                        {Number(trafficStats.monthlyVisits || 0).toLocaleString('id-ID')}{' '}
                        <span className="text-[10px] font-normal text-neutral-400">kunjungan</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <div>
                      <div className="text-[9px] font-mono uppercase text-neutral-400 leading-none">
                        Pengunjung Unik Bulan Ini
                      </div>
                      <div className="text-sm font-extrabold font-mono text-white leading-tight mt-0.5">
                        {Number(trafficStats.uniqueVisitors || 0).toLocaleString('id-ID')}{' '}
                        <span className="text-[10px] font-normal text-neutral-400">orang</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[9px] font-mono uppercase text-neutral-400 leading-none">
                        Hari Ini
                      </div>
                      <div className="text-sm font-extrabold font-mono text-white leading-tight mt-0.5">
                        {Number(trafficStats.todayVisits || 0).toLocaleString('id-ID')}{' '}
                        <span className="text-[10px] font-normal text-neutral-400">kunjungan</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualResetTraffic}
                    disabled={isResettingTraffic}
                    title="Reset manual hitungan pengunjung bulan ini ke 0"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className={`w-3 h-3 ${isResettingTraffic ? 'animate-spin' : ''}`} />
                    <span>Reset</span>
                  </button>
                </div>
              </div>
            </div>

            {/* TAB 1: KELOLA LAYANAN (FULL CONTROL OVER DESCRIPTION, DURATION, OPEN/CLOSE HOURS, PRICE) */}
            {activeTab === 'services' && (
              <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                {/* Service Selector Tabs */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                    Pilih Layanan yang Ingin Diatur:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {services.map((svc) => (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => handleSelectServiceToEdit(svc.id)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                          selectedServiceId === svc.id
                            ? 'border-neutral-950 bg-neutral-950 text-white shadow font-semibold'
                            : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        <span className="text-xs truncate">{svc.name}</span>
                        <span className="text-[10px] opacity-70 font-mono">{svc.durationMinutes}m</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Edit Form for the Selected Service */}
                {editingService && (
                  <form onSubmit={handleSaveService} className="space-y-4 bg-neutral-50/60 p-5 rounded-2xl border border-neutral-200">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
                      <div>
                        <span className="text-[10px] font-mono text-neutral-400 uppercase">EDITING SERVICE</span>
                        <h4 className="text-base font-bold font-display text-neutral-950">
                          {editingService.name}
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-neutral-900 font-mono">
                        {formatIDR(editingService.price)}
                      </span>
                    </div>

                    {/* Basic Name & Badge */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Nama Layanan
                        </label>
                        <input
                          type="text"
                          value={editingService.name}
                          onChange={(e) =>
                            setEditingService({ ...editingService, name: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Badge / Label Promosi
                        </label>
                        <input
                          type="text"
                          value={editingService.badge || ''}
                          onChange={(e) =>
                            setEditingService({ ...editingService, badge: e.target.value })
                          }
                          placeholder="Misal: Paling Favorit, Promo Wisuda"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950"
                        />
                      </div>
                    </div>

                    {/* Subtitle / Deskripsi Singkat */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Deskripsi Singkat (Tampil di Kartu Depan)
                      </label>
                      <input
                        type="text"
                        value={editingService.subtitle}
                        onChange={(e) =>
                          setEditingService({ ...editingService, subtitle: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950"
                      />
                    </div>

                    {/* Deskripsi Lengkap */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Deskripsi Lengkap Layanan
                      </label>
                      <textarea
                        rows={2}
                        value={editingService.description}
                        onChange={(e) =>
                          setEditingService({ ...editingService, description: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950"
                      />
                    </div>

                    {/* Durasi, Jam Buka & Jam Tutup Layanan (REQUESTED) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-white rounded-xl border border-neutral-200">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Durasi Sesi (Menit) *
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={180}
                          value={editingService.durationMinutes}
                          onChange={(e) =>
                            setEditingService({
                              ...editingService,
                              durationMinutes: Number(e.target.value) || 30,
                            })
                          }
                          className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Jam Buka Sesi
                        </label>
                        <input
                          type="time"
                          value={editingService.openTime || '10:00'}
                          onChange={(e) =>
                            setEditingService({ ...editingService, openTime: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Jam Tutup Sesi
                        </label>
                        <input
                          type="time"
                          value={editingService.closeTime || '21:30'}
                          onChange={(e) =>
                            setEditingService({ ...editingService, closeTime: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 font-mono"
                        />
                      </div>
                    </div>

                    {/* Harga Layanan & Kapasitas Orang */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Harga Paket Standar (Rp)
                        </label>
                        <input
                          type="number"
                          step={5000}
                          value={editingService.price}
                          onChange={(e) => {
                            const newPrice = Number(e.target.value) || 0;
                            const currentPricing = { ...(editingService.personPricing || {}) };
                            currentPricing[editingService.maxPeople] = newPrice;
                            setEditingService({
                              ...editingService,
                              price: newPrice,
                              personPricing: currentPricing,
                            });
                          }}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Kapasitas Standar (Orang)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={editingService.maxPeople}
                          onChange={(e) =>
                            setEditingService({
                              ...editingService,
                              maxPeople: Number(e.target.value) || 1,
                            })
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Biaya Orang Tambahan (Rp)
                        </label>
                        <input
                          type="number"
                          step={5000}
                          value={editingService.extraPersonPrice || 30000}
                          onChange={(e) =>
                            setEditingService({
                              ...editingService,
                              extraPersonPrice: Number(e.target.value) || 30000,
                            })
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-mono"
                        />
                      </div>
                    </div>

                    {/* PENGATURAN HARGA PER JUMLAH ORANG (USER REQUESTED) */}
                    <div className="p-4 bg-white rounded-2xl border border-neutral-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2.5 border-b border-neutral-100">
                        <div>
                          <h5 className="text-xs font-bold text-neutral-950 flex items-center gap-1.5">
                            <DollarSign className="w-4 h-4 text-emerald-600" />
                            <span>Pengaturan Harga per Jumlah Orang</span>
                          </h5>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            Atur harga spesifik untuk setiap variasi jumlah orang yang dipilih customer saat booking.
                          </p>
                        </div>
                        <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-100 self-start sm:self-auto">
                          Dynamic Pricing
                        </span>
                      </div>

                      {/* Tiers List */}
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {editingService.personPricing && Object.keys(editingService.personPricing).length > 0 ? (
                          Object.entries(editingService.personPricing)
                            .map(([people, price]) => ({ people: Number(people), price: Number(price) }))
                            .sort((a, b) => a.people - b.people)
                            .map((tier) => (
                              <div
                                key={tier.people}
                                className="flex items-center justify-between gap-2.5 p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs hover:border-neutral-300 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-[110px]">
                                  <Users className="w-3.5 h-3.5 text-neutral-600" />
                                  <span className="font-bold text-neutral-900">{tier.people} Orang</span>
                                  {tier.people === editingService.maxPeople && (
                                    <span className="text-[9px] bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded font-mono font-medium">
                                      Standar
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-1 justify-end">
                                  <span className="text-[11px] text-neutral-500 font-mono">Rp</span>
                                  <input
                                    type="number"
                                    step={5000}
                                    value={tier.price}
                                    onChange={(e) =>
                                      handleUpdateTierPrice(tier.people, Number(e.target.value) || 0)
                                    }
                                    className="w-28 sm:w-36 px-2.5 py-1 text-xs rounded-lg border border-neutral-300 font-mono font-bold text-neutral-950 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTier(tier.people)}
                                    title="Hapus tarif jumlah orang ini"
                                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                        ) : (
                          <div className="text-xs text-neutral-500 italic py-2 text-center bg-neutral-50 rounded-xl p-3">
                            Belum ada konfigurasi harga khusus per orang.
                          </div>
                        )}
                      </div>

                      {/* Add Tier Inline */}
                      <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-700">
                          <span className="text-[11px] font-medium text-neutral-600">Tambah:</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={newTierPeople}
                            onChange={(e) => setNewTierPeople(Number(e.target.value) || 1)}
                            className="w-14 px-2 py-1 text-xs rounded-lg border border-neutral-300 font-bold bg-white"
                          />
                          <span className="text-[11px] text-neutral-600">Orang = Rp</span>
                        </div>

                        <input
                          type="number"
                          step={5000}
                          value={newTierPrice}
                          onChange={(e) => setNewTierPrice(Number(e.target.value) || 0)}
                          placeholder="Harga"
                          className="w-28 px-2.5 py-1 text-xs rounded-lg border border-neutral-300 font-mono bg-white"
                        />

                        <button
                          type="button"
                          onClick={handleAddNewTier}
                          className="px-3 py-1 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm active:scale-95 transition-all ml-auto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Tier</span>
                        </button>
                      </div>
                    </div>

                    {/* PENGATURAN PILIHAN BACKGROUND / BACKDROP (USER REQUESTED) */}
                    <div className="p-4 bg-white rounded-2xl border border-neutral-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2.5 border-b border-neutral-100">
                        <div>
                          <h5 className="text-xs font-bold text-neutral-950 flex items-center gap-1.5">
                            <Palette className="w-4 h-4 text-neutral-900" />
                            <span>Pilihan Warna Background Layanan</span>
                          </h5>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            Kelola pilihan warna backdrop studio khusus untuk layanan ini.
                          </p>
                        </div>
                        <span className="text-[10px] font-mono bg-neutral-100 text-neutral-800 px-2.5 py-0.5 rounded-full font-semibold border border-neutral-200 self-start sm:self-auto">
                          {(editingService.backdrops && editingService.backdrops.length > 0
                            ? editingService.backdrops
                            : BACKDROP_OPTIONS
                          ).length} Warna Aktif
                        </span>
                      </div>

                      {/* Backdrops List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                        {(editingService.backdrops && editingService.backdrops.length > 0
                          ? editingService.backdrops
                          : BACKDROP_OPTIONS
                        ).map((bg) => (
                          <div
                            key={bg.id}
                            className="flex items-center justify-between gap-2.5 p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs hover:border-neutral-300 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-7 h-7 rounded-full border shadow-inner shrink-0"
                                style={{
                                  backgroundColor: bg.colorHex,
                                  borderColor: bg.borderHex || '#cbd5e1',
                                }}
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-neutral-900 truncate">{bg.name}</div>
                                <div className="text-[10px] text-neutral-500 font-mono truncate">
                                  {bg.colorHex} {bg.desc ? `· ${bg.desc}` : ''}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteBackdrop(bg.id)}
                              title={`Hapus background ${bg.name}`}
                              className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add New Backdrop Inline Form */}
                      <div className="pt-2.5 border-t border-neutral-100 space-y-2">
                        <div className="text-[11px] font-semibold text-neutral-700">
                          Tambah Background Baru untuk Layanan Ini:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          {/* Color Picker + Hex */}
                          <div className="sm:col-span-3 flex items-center gap-2 bg-neutral-50 p-1.5 rounded-xl border border-neutral-200">
                            <input
                              type="color"
                              value={newBgColor}
                              onChange={(e) => setNewBgColor(e.target.value)}
                              className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                              title="Pilih warna"
                            />
                            <input
                              type="text"
                              value={newBgColor}
                              onChange={(e) => setNewBgColor(e.target.value)}
                              placeholder="#E2E8F0"
                              className="w-full text-xs font-mono font-medium bg-transparent focus:outline-none uppercase"
                            />
                          </div>

                          {/* Name Input */}
                          <div className="sm:col-span-4">
                            <input
                              type="text"
                              value={newBgName}
                              onChange={(e) => setNewBgName(e.target.value)}
                              placeholder="Nama (misal: Sage Green)"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950 font-medium"
                            />
                          </div>

                          {/* Description Input */}
                          <div className="sm:col-span-3">
                            <input
                              type="text"
                              value={newBgDesc}
                              onChange={(e) => setNewBgDesc(e.target.value)}
                              placeholder="Deskripsi singkat"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-950"
                            />
                          </div>

                          {/* Add Button */}
                          <div className="sm:col-span-2">
                            <button
                              type="button"
                              onClick={handleAddBackdrop}
                              className="w-full py-2 px-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tambah</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Foto Contoh Layanan (Portrait 3:4 Preview) */}
                    <div className="pt-2 border-t border-neutral-200">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-neutral-700">
                          Foto Contoh Layanan (Potret Rasio 3:4)
                        </label>
                        <span className="text-[10px] font-mono text-neutral-500">
                          Format 3:4 Portrait
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-20 aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 border shrink-0 relative shadow-sm">
                          <img
                            src={editingService.image}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-1 right-1 bg-black/80 text-[8px] font-mono text-white px-1 py-0.5 rounded">
                            3:4
                          </div>
                        </div>

                        <div className="flex-1 space-y-2 w-full">
                          <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-semibold text-xs rounded-xl cursor-pointer">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Foto Baru dari Perangkat</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                            />
                          </label>

                          <div>
                            <input
                              type="url"
                              value={editingService.image}
                              onChange={(e) =>
                                setEditingService({ ...editingService, image: e.target.value })
                              }
                              placeholder="Atau masukkan URL foto https://..."
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="pt-3 border-t border-neutral-200 flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl transition-all shadow"
                      >
                        <Save className="w-4 h-4" />
                        <span>Simpan Perubahan Layanan</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: DAFTAR RESERVASI */}
            {activeTab === 'bookings' && (
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama, ID, WA..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-950"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
                    {['all', 'confirmed', 'pending', 'completed', 'cancelled'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                          statusFilter === status
                            ? 'bg-neutral-950 text-white'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                      >
                        {status === 'all' && 'Semua'}
                        {status === 'confirmed' && 'Dikonfirmasi'}
                        {status === 'pending' && 'Menunggu'}
                        {status === 'completed' && 'Selesai'}
                        {status === 'cancelled' && 'Dibatalkan'}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredBookings.length === 0 ? (
                  <div className="p-12 text-center text-xs text-neutral-400 bg-neutral-50 rounded-xl border border-neutral-200">
                    Tidak ada reservasi yang sesuai kriteria.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredBookings.map((b) => (
                      <div
                        key={b.id}
                        className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 transition-all shadow-xs space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-100">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
                              #{b.id}
                            </span>
                            <span className="text-xs font-bold text-neutral-950">
                              {b.customer.name}
                            </span>
                            <span className="text-neutral-400 text-xs">·</span>
                            <span className="text-xs text-neutral-600">
                              {b.serviceName} ({b.backdrop})
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                b.status === 'confirmed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : b.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : b.status === 'completed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-neutral-200 text-neutral-600'
                              }`}
                            >
                              {b.status === 'confirmed' && 'Dikonfirmasi'}
                              {b.status === 'pending' && 'Menunggu'}
                              {b.status === 'completed' && 'Selesai'}
                              {b.status === 'cancelled' && 'Dibatalkan'}
                            </span>
                            <span className="text-xs font-bold font-mono text-neutral-900 tabular-nums">
                              {formatIDR(b.totalPrice)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-neutral-600">
                          <div>
                            <span className="text-neutral-400 block text-[10px]">JADWAL</span>
                            <span className="font-medium text-neutral-800">
                              {formatDateIndo(b.date)}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-400 block text-[10px]">WAKTU (WITA)</span>
                            <span className="font-mono font-medium text-neutral-800">
                              {b.timeSlot} WITA
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-400 block text-[10px]">WHATSAPP</span>
                            <span className="font-mono text-neutral-800">{b.customer.whatsapp}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400 block text-[10px]">PEMBAYARAN</span>
                            <span className="text-neutral-800 font-medium truncate block">Di studio</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-neutral-400">Status:</span>
                            <button
                              onClick={() => handleStatusChange(b.id, 'confirmed')}
                              className={`px-2 py-1 text-[11px] font-semibold rounded ${
                                b.status === 'confirmed'
                                  ? 'bg-neutral-900 text-white'
                                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                              }`}
                            >
                              Konfirmasi
                            </button>
                            <button
                              onClick={() => handleStatusChange(b.id, 'completed')}
                              className={`px-2 py-1 text-[11px] font-semibold rounded ${
                                b.status === 'completed'
                                  ? 'bg-neutral-900 text-white'
                                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                              }`}
                            >
                              Selesai
                            </button>
                            <button
                              onClick={() => handleStatusChange(b.id, 'cancelled')}
                              className={`px-2 py-1 text-[11px] font-semibold rounded ${
                                b.status === 'cancelled'
                                  ? 'bg-neutral-900 text-white'
                                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                              }`}
                            >
                              Batal
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleResendBookingNotification(b)}
                              disabled={resendingEmailId === b.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors disabled:opacity-50"
                              title="Kirim email notifikasi ke admin studio"
                            >
                              {resendingEmailId === b.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Mail className="w-3 h-3" />
                              )}
                              <span>Email Admin</span>
                            </button>

                            <a
                              href={formatCustomerEmail(b, studioConfig).gmailComposeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                              title="Buka email konfirmasi customer di Gmail"
                            >
                              <Send className="w-3 h-3" />
                              <span>Email Customer</span>
                            </a>

                            <a
                              href={`https://wa.me/${b.customer.whatsapp.replace(/^0/, '62')}?text=${encodeURIComponent(
                                `Halo ${b.customer.name}, ini dari Admin Yay Photo Studio terkait jadwal sesi foto #${b.id}...`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>

                            <button
                              onClick={() => handleDeleteBooking(b.id)}
                              className="p-1 text-neutral-400 hover:text-red-600 rounded ml-1"
                              title="Hapus booking"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: SISTEM PENJADWALAN OTOMATIS GOOGLE CALENDAR (SERVER-TO-CALENDAR DIRECT) */}
            {activeTab === 'calendar' && (
              <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                {/* Main Server-Side Direct Google Calendar Card */}
                <div className="bg-gradient-to-br from-neutral-900 via-neutral-950 to-emerald-950 text-white p-6 rounded-2xl border border-emerald-500/30 shadow-lg space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                        <CalendarCheck className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-base font-display text-white">
                            Sinkronisasi 2 Arah Google Calendar ⇄ Website (Direct Server)
                          </h4>
                          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/40 font-bold">
                            SINKRON 2 ARAH AKTIF 24/7
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed max-w-2xl">
                          <strong>1. Website → Kalender HP:</strong> Begitu customer booking di website, jadwal langsung masuk ke Google Calendar <strong>{studioConfig.adminEmail || 'yayphotostudio@gmail.com'}</strong>.<br />
                          <strong>2. Kalender HP → Website:</strong> Jika Anda membuat jadwal manual di Google Calendar smartphone Anda, slot jam yang bersinggungan di website otomatis hilang / tertutup.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={handleForceRefreshSmartphoneCalendar}
                        disabled={isRefreshingExternalCal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl border border-white/15 transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingExternalCal ? 'animate-spin' : ''}`} />
                        <span>Cek Jadwal HP</span>
                      </button>

                      <a
                        href="https://calendar.google.com/calendar/u/0/r"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>Buka Google Calendar</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                      </a>
                    </div>
                  </div>

                  {/* Summary Info Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <span className="text-[10px] font-mono text-neutral-400 uppercase block">AKUN KALENDER ADMIN</span>
                      <span className="font-bold font-mono text-emerald-300 mt-0.5 block truncate">
                        {studioConfig.adminEmail || 'yayphotostudio@gmail.com'}
                      </span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <span className="text-[10px] font-mono text-neutral-400 uppercase block">ARAH SINKRONISASI</span>
                      <span className="font-bold text-white mt-0.5 block">
                        2 Arah Otomatis (Web ⇄ Kalender HP)
                      </span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <span className="text-[10px] font-mono text-neutral-400 uppercase block">PENGINGAT KALENDER</span>
                      <span className="font-bold text-white mt-0.5 block">
                        Notifikasi Default HP Admin (1 Jadwal / Sesi)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Manual Schedules from Smartphone Google Calendar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Jadwal Manual dari Kalender Smartphone Admin ({
                        externalCalendarBlocks.filter((eb) => eb.date >= getMakassarDateTime().todayDate).length
                      } Jadwal Aktif Memblokir Slot Web):
                    </span>
                    <span className="text-[11px] text-emerald-700 font-mono font-semibold">
                      Otomatis Menutup Jam di Website
                    </span>
                  </div>

                  {externalCalendarBlocks.filter((eb) => eb.date >= getMakassarDateTime().todayDate).length === 0 ? (
                    <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-500">
                      Belum ada jadwal manual tambahan pada hari ini atau tanggal mendatang di Google Calendar smartphone Anda. Jika Anda membuat jadwal di aplikasi kalender HP, jam tersebut akan otomatis muncul di sini dan menutup slot di website.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {externalCalendarBlocks
                        .filter((eb) => eb.date >= getMakassarDateTime().todayDate)
                        .map((eb, idx) => (
                          <div
                            key={`${eb.uid}-${eb.date}-${eb.startMinutes}-${idx}`}
                            className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-200/70 text-amber-950">
                                  KALENDER HP
                                </span>
                                <span className="font-bold text-xs text-neutral-950">
                                  {eb.summary || 'Jadwal Kalender Smartphone Admin'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 font-mono">
                                <span>📅 {formatDateIndo(eb.date)}</span>
                                <span>
                                  ⏰ {eb.isAllDay ? 'Seharian Penuh (00:00 - 23:59)' : `${eb.startTime} - ${eb.endTime} WITA`}
                                </span>
                              </div>
                            </div>

                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 bg-amber-100 px-3 py-1 rounded-full border border-amber-300 shrink-0 self-start sm:self-center">
                              <Lock className="w-3 h-3" />
                              <span>Slot Jam di Web Otomatis Hilang</span>
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Scheduled Bookings List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Daftar Jadwal Sesi Foto di Google Calendar ({bookings.filter((b) => b && b.customer && b.status !== 'cancelled').length} Jadwal Aktif):
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      Zona Waktu: WITA (GMT+8)
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {bookings
                      .filter((b) => b && b.customer && b.status !== 'cancelled')
                      .map((b) => (
                        <div
                          key={b.id}
                          className="p-3.5 bg-white rounded-xl border border-neutral-200 hover:border-neutral-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
                                #{b.id}
                              </span>
                              <span className="font-bold text-xs text-neutral-950">
                                {b.customer.name}
                              </span>
                              <span className="text-neutral-400 text-xs">·</span>
                              <span className="text-xs text-neutral-600">
                                {b.serviceName} ({b.durationMinutes || 30} Menit)
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 font-mono">
                              <span>📅 {formatDateIndo(b.date)}</span>
                              <span>⏰ {b.timeSlot} WITA (GMT+8)</span>
                              <span>👥 {b.peopleCount} Orang</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                              <Check className="w-3 h-3" />
                              <span>Terjadwal Otomatis di Kalender</span>
                            </span>

                            <a
                              href={generateGoogleCalendarWebUrl(b)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                              title="Lihat Detail di Google Calendar"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}


            {/* TAB: TEMPLATE EMAIL & NOTIFIKASI BOOKING */}
            {activeTab === 'email' && (
              <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                {/* Header Information Banner */}
                <div className="p-4 bg-neutral-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                        EMAIL DISPATCH & NOTIFICATION SETTINGS
                      </div>
                      <h4 className="text-sm sm:text-base font-bold font-display">
                        Kustomisasi Pesan Email Booking & Notifikasi Admin
                      </h4>
                      <p className="text-xs text-neutral-300 mt-0.5">
                        Sesuaikan kata-kata konfirmasi untuk customer dan aktifkan email masuk ke akun Anda.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-3 py-1 rounded-full font-semibold self-start sm:self-auto shrink-0">
                    Live Cloud Sync
                  </span>
                </div>

                <form onSubmit={handleSaveEmailConfig} className="space-y-6">
                  {/* BAGIAN 1: NOTIFIKASI EMAIL KE PEMILIK STUDIO (ADMIN) */}
                  <div className="p-5 bg-white rounded-2xl border border-neutral-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                      <div>
                        <h5 className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-mono text-xs flex items-center justify-center font-bold">1</span>
                          <span>Notifikasi Otomatis ke Email Pemilik Studio</span>
                        </h5>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Dapatkan email pemberitahuan setiap kali ada customer yang melakukan booking dari website.
                        </p>
                      </div>

                      {/* Toggle Active */}
                      <label className="inline-flex items-center gap-2.5 cursor-pointer bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200 self-start sm:self-auto">
                        <input
                          type="checkbox"
                          checked={studioConfig.enableAdminNotification !== false}
                          onChange={(e) =>
                            setStudioConfig({
                              ...studioConfig,
                              enableAdminNotification: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 relative" />
                        <span className="text-xs font-semibold text-neutral-800">
                          {studioConfig.enableAdminNotification !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Alamat Email Studio Anda (Penerima Notifikasi) *
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            required
                            value={studioConfig.adminEmail || 'yayphotostudio@gmail.com'}
                            onChange={(e) =>
                              setStudioConfig({ ...studioConfig, adminEmail: e.target.value })
                            }
                            placeholder="yayphotostudio@gmail.com"
                            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-mono font-medium focus:ring-1 focus:ring-neutral-950 focus:outline-none"
                          />
                          <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-1">
                          Default: <strong className="text-neutral-800 font-mono">yayphotostudio@gmail.com</strong>
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Subjek Email Notifikasi Admin
                        </label>
                        <input
                          type="text"
                          value={
                            studioConfig.adminNotificationSubject ||
                            DEFAULT_ADMIN_EMAIL_SUBJECT
                          }
                          onChange={(e) =>
                            setStudioConfig({
                              ...studioConfig,
                              adminNotificationSubject: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-medium focus:ring-1 focus:ring-neutral-950 focus:outline-none"
                        />
                        <p className="text-[11px] text-neutral-500 mt-1">
                          Variabel yang didukung: <code className="bg-neutral-100 px-1 py-0.5 rounded text-[10px]">&#123;serviceName&#125;</code>, <code className="bg-neutral-100 px-1 py-0.5 rounded text-[10px]">&#123;customerName&#125;</code>, <code className="bg-neutral-100 px-1 py-0.5 rounded text-[10px]">&#123;bookingId&#125;</code>
                        </p>
                      </div>
                    </div>

                    {/* SMTP / Server Direct Mailer Settings */}
                    <div className="pt-3 border-t border-neutral-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-blue-600" />
                            <span>Pengiriman Otomatis Server (Gmail SMTP)</span>
                          </div>
                          <p className="text-[11px] text-neutral-500">
                            Gunakan Sandi Aplikasi Gmail agar notifikasi terkirim otomatis ke email Anda tanpa perlu klik manual.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAppPasswordHelp(!showAppPasswordHelp)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>{showAppPasswordHelp ? 'Tutup Panduan' : 'Cara Buat Sandi (1 Menit)'}</span>
                        </button>
                      </div>

                      {showAppPasswordHelp && (
                        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-2 animate-fade-in">
                          <div className="font-bold flex items-center gap-1.5">
                            <span>📌 Cara Membuat Sandi Aplikasi Gmail (Sangat Mudah):</span>
                          </div>
                          <ol className="list-decimal pl-4 space-y-1 text-[11px] text-blue-900 leading-relaxed">
                            <li>Buka <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="underline font-semibold">myaccount.google.com/security</a> di tab baru.</li>
                            <li>Pastikan <strong>Verifikasi 2 Langkah</strong> dalam status Aktif.</li>
                            <li>Ketik <strong>Sandi Aplikasi</strong> (App Passwords) di kolom pencarian Akun Google.</li>
                            <li>Ketik nama aplikasi (misal: <em>Yay Studio</em>), lalu klik <strong>Buat</strong>.</li>
                            <li>Salin 16 karakter yang muncul dan tempelkan pada kolom <strong>Sandi Aplikasi Gmail</strong> di bawah ini.</li>
                          </ol>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            Email Pengirim / Akun Google
                          </label>
                          <input
                            type="text"
                            value={studioConfig.smtpUser || studioConfig.adminEmail || 'yayphotostudio@gmail.com'}
                            onChange={(e) =>
                              setStudioConfig({
                                ...studioConfig,
                                smtpUser: e.target.value,
                              })
                            }
                            placeholder="yayphotostudio@gmail.com"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            Sandi Aplikasi Gmail (16 Karakter)
                          </label>
                          <div className="relative">
                            <input
                              type={showSmtpPassword ? 'text' : 'password'}
                              value={studioConfig.smtpPass || ''}
                              onChange={(e) =>
                                setStudioConfig({
                                  ...studioConfig,
                                  smtpPass: e.target.value,
                                })
                              }
                              placeholder="xxxx xxxx xxxx xxxx (16 karakter)"
                              className="w-full pr-8 pl-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                              className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                            >
                              {showSmtpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {studioConfig.smtpPass && studioConfig.smtpPass.replace(/\s+/g, '').length !== 16 && (
                            <div className="mt-1.5 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-1.5 leading-snug">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <strong>Perhatian:</strong> Google menolak sandi login biasa (kode 534). Anda wajib menggunakan <strong>Sandi Aplikasi 16-karakter</strong>.{' '}
                                <a
                                  href="https://myaccount.google.com/apppasswords"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline font-semibold text-blue-600 hover:text-blue-800"
                                >
                                  Buat Sandi Aplikasi di Google (1 menit) &rarr;
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Test SMTP Button and Response */}
                      <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={handleTestSmtp}
                          disabled={isTestingEmail}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isTestingEmail ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Mengirim email uji coba...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Uji Coba Kirim Email ke {studioConfig.adminEmail || 'yayphotostudio@gmail.com'}</span>
                            </>
                          )}
                        </button>

                        <span className="text-[11px] text-neutral-400">
                          {studioConfig.smtpPass ? '✓ Siap kirim otomatis' : 'Belum diisi (Notifikasi tetap bisa dibuka via Gmail 1-klik)'}
                        </span>
                      </div>

                      {testEmailResult && (
                        <div
                          className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                            testEmailResult.success
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-red-50 border-red-200 text-red-900'
                          }`}
                        >
                          {testEmailResult.success ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-bold">
                              {testEmailResult.success ? 'Koneksi Email Berhasil!' : 'Gagal Mengirim Email Uji Coba'}
                            </div>
                            <div className="mt-0.5 text-[11px]">{testEmailResult.message}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BAGIAN 2: EDIT PESAN KONFIRMASI EMAIL KE CUSTOMER */}
                  <div className="p-5 bg-white rounded-2xl border border-neutral-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                      <div>
                        <h5 className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-mono text-xs flex items-center justify-center font-bold">2</span>
                          <span>Format Pesan Konfirmasi Booking ke Email Customer</span>
                        </h5>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Teks ini akan otomatis ditampilkan dan dikirimkan saat customer menyelesaikan reservasi.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetCustomerEmailTemplate}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg transition-colors self-start sm:self-auto shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Kembalikan ke Default</span>
                      </button>
                    </div>

                    {/* Tag Helper Toolbar */}
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/70 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-700">
                        <span>Klik tag di bawah untuk menyalin variabel otomatis:</span>
                        {copiedVariableTag && (
                          <span className="text-emerald-600 font-bold animate-fade-in">
                            ✓ {copiedVariableTag} tersalin!
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { tag: '{nama}', desc: 'Nama Pelanggan' },
                          { tag: '{kode_booking}', desc: 'Kode Booking' },
                          { tag: '{layanan}', desc: 'Nama Layanan' },
                          { tag: '{tanggal}', desc: 'Hari & Tanggal' },
                          { tag: '{jam}', desc: 'Jam Sesi' },
                          { tag: '{backdrop}', desc: 'Backdrop' },
                          { tag: '{jumlah_orang}', desc: 'Jumlah Orang' },
                          { tag: '{total_biaya}', desc: 'Total Biaya' },
                          { tag: '{nama_studio}', desc: 'Nama Studio' },
                          { tag: '{alamat}', desc: 'Alamat' },
                          { tag: '{whatsapp}', desc: 'No. WA' },
                        ].map((item) => (
                          <button
                            key={item.tag}
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(item.tag);
                              setCopiedVariableTag(item.tag);
                              setTimeout(() => setCopiedVariableTag(''), 2000);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-neutral-200/60 border border-neutral-300 rounded-lg text-[11px] font-mono text-neutral-800 transition-colors shadow-2xs"
                            title={item.desc}
                          >
                            <Copy className="w-2.5 h-2.5 opacity-60" />
                            <span>{item.tag}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Subject Input */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Subjek / Judul Email Customer
                      </label>
                      <input
                        type="text"
                        value={
                          studioConfig.customerEmailSubject ||
                          DEFAULT_CUSTOMER_EMAIL_SUBJECT
                        }
                        onChange={(e) =>
                          setStudioConfig({
                            ...studioConfig,
                            customerEmailSubject: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-medium focus:ring-1 focus:ring-neutral-950 focus:outline-none"
                      />
                    </div>

                    {/* Greeting Input */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Salam Pembuka (Greeting)
                      </label>
                      <input
                        type="text"
                        value={
                          studioConfig.customerEmailGreeting ||
                          DEFAULT_CUSTOMER_EMAIL_GREETING
                        }
                        onChange={(e) =>
                          setStudioConfig({
                            ...studioConfig,
                            customerEmailGreeting: e.target.value,
                          })
                        }
                        placeholder="Contoh: Halo {customerName},"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-medium focus:ring-1 focus:ring-neutral-950 focus:outline-none"
                      />
                    </div>

                    {/* Message Body Input */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Pesan Pembuka / Ucapan Terima Kasih
                      </label>
                      <textarea
                        rows={3}
                        value={
                          studioConfig.customerEmailMessage ||
                          DEFAULT_CUSTOMER_EMAIL_MESSAGE
                        }
                        onChange={(e) =>
                          setStudioConfig({
                            ...studioConfig,
                            customerEmailMessage: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white leading-relaxed focus:ring-1 focus:ring-neutral-950 focus:outline-none"
                      />
                    </div>

                    {/* Instructions List Input */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Petunjuk & Tata Tertib Sesi Foto (Satu baris per instruksi)
                      </label>
                      <textarea
                        rows={4}
                        value={
                          studioConfig.customerEmailInstructions ||
                          DEFAULT_CUSTOMER_EMAIL_INSTRUCTIONS
                        }
                        onChange={(e) =>
                          setStudioConfig({
                            ...studioConfig,
                            customerEmailInstructions: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-mono text-[11px] leading-relaxed focus:ring-1 focus:ring-neutral-950 focus:outline-none"
                      />
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Tiap baris baru akan otomatis ditampilkan sebagai nomor urut petunjuk bagi pelanggan.
                      </p>
                    </div>

                    {/* Footer Note Input */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Pesan Penutup / Catatan Kaki (Footer)
                      </label>
                      <input
                        type="text"
                        value={
                          studioConfig.customerEmailFooter ||
                          DEFAULT_CUSTOMER_EMAIL_FOOTER
                        }
                        onChange={(e) =>
                          setStudioConfig({
                            ...studioConfig,
                            customerEmailFooter: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white focus:ring-1 focus:ring-neutral-950 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* BAGIAN 3: LIVE PREVIEW INTERAKTIF */}
                  <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-200">
                      <div>
                        <h5 className="text-sm font-bold text-neutral-950 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-600" />
                          <span>Live Preview Tampilan Email Real-Time</span>
                        </h5>
                        <p className="text-xs text-neutral-500">
                          Pratinjau langsung bagaimana email akan dibaca dengan data pemesanan contoh.
                        </p>
                      </div>

                      {/* Tab Preview Toggle */}
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-200">
                        <button
                          type="button"
                          onClick={() => setEmailPreviewTab('customer')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            emailPreviewTab === 'customer'
                              ? 'bg-neutral-950 text-white shadow-xs'
                              : 'text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          Email Customer
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailPreviewTab('admin')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            emailPreviewTab === 'admin'
                              ? 'bg-neutral-950 text-white shadow-xs'
                              : 'text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          Email Admin
                        </button>
                      </div>
                    </div>

                    {/* Preview Box */}
                    {(() => {
                      const sampleBooking: Booking = bookings[0] || {
                        id: 'YAY-2610-888',
                        serviceId: 'self-photo-reguler',
                        serviceName: 'Self Photo Reguler',
                        date: new Date().toISOString().split('T')[0],
                        timeSlot: '18:30',
                        backdrop: 'Clean Studio White',
                        peopleCount: 2,
                        totalPrice: 120000,
                        paymentNote: studioConfig.paymentNote || 'Pembayaran dapat dilakukan saat di studio',
                        status: 'confirmed',
                        createdAt: new Date().toISOString(),
                        customer: {
                          name: 'Clara Amanda',
                          email: 'clara.amanda@example.com',
                          whatsapp: '081298765432',
                          notes: 'Sesi foto berdua outfit monokrom',
                        },
                      };

                      const custEmail = formatCustomerEmail(sampleBooking, studioConfig);
                      const admEmail = formatAdminEmail(sampleBooking, studioConfig);

                      return emailPreviewTab === 'customer' ? (
                        <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-5 text-xs space-y-3 shadow-xs">
                          <div className="pb-3 border-b border-neutral-100 font-mono text-[11px] text-neutral-500 space-y-1">
                            <div><span className="text-neutral-400">Kepada:</span> {sampleBooking.customer.name} &lt;{sampleBooking.customer.email}&gt;</div>
                            <div><span className="text-neutral-400">Subjek:</span> <strong className="text-neutral-950">{custEmail.subject}</strong></div>
                          </div>

                          <div className="font-bold text-neutral-950 text-sm">{custEmail.greeting}</div>
                          <p className="text-neutral-700 leading-relaxed">{custEmail.message}</p>

                          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px] space-y-1">
                            <div className="font-bold uppercase tracking-wider text-neutral-900 pb-1 border-b border-neutral-200">
                              Rincian Jadwal Reservasi
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div><span className="text-neutral-400">Layanan:</span> <span className="font-semibold text-neutral-800">{sampleBooking.serviceName}</span></div>
                              <div><span className="text-neutral-400">Backdrop:</span> <span className="font-semibold text-neutral-800">{sampleBooking.backdrop}</span></div>
                              <div><span className="text-neutral-400">Jadwal:</span> <span className="font-semibold text-neutral-800">{formatDateIndo(sampleBooking.date)} ({sampleBooking.timeSlot} WITA)</span></div>
                              <div><span className="text-neutral-400">Total:</span> <span className="font-bold font-mono text-neutral-950">{formatIDR(sampleBooking.totalPrice)}</span></div>
                            </div>
                          </div>

                          {custEmail.instructions.length > 0 && (
                            <div className="space-y-1 text-neutral-700 text-[11px]">
                              <span className="font-bold text-neutral-900">Petunjuk Sesi Foto:</span>
                              <ul className="space-y-0.5 pl-3 list-disc">
                                {custEmail.instructions.map((ins, i) => (
                                  <li key={i}>{ins}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {custEmail.footer && (
                            <div className="text-[11px] text-neutral-600 italic pt-1">{custEmail.footer}</div>
                          )}

                          <div className="text-[10px] text-neutral-400 pt-2 border-t border-neutral-100">
                            Studio: {studioConfig.name} · {studioConfig.address}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-5 text-xs space-y-3 shadow-xs">
                          <div className="pb-3 border-b border-neutral-100 font-mono text-[11px] text-neutral-500 space-y-1">
                            <div><span className="text-neutral-400">Penerima:</span> <strong className="text-neutral-950">{admEmail.to}</strong></div>
                            <div><span className="text-neutral-400">Subjek:</span> <strong className="text-neutral-950">{admEmail.subject}</strong></div>
                          </div>

                          <div className="bg-amber-50 text-amber-900 border border-amber-200 p-2.5 rounded-lg text-xs font-semibold">
                            Pemberitahuan: Booking Baru Masuk ke Kalender Studio
                          </div>

                          <pre className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 font-mono text-[11px] text-neutral-800 whitespace-pre-wrap leading-relaxed">
                            {admEmail.body}
                          </pre>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingEmail}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-98"
                    >
                      {isSavingEmail ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Menyimpan ke Cloud...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Simpan Template Email & Notifikasi</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 4: INFO STUDIO & TEKS WEBSITE */}
            {activeTab === 'studio' && (
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                <form onSubmit={handleSaveStudioConfig} className="space-y-4 bg-neutral-50/70 p-5 rounded-2xl border border-neutral-200">
                  <div className="font-bold text-neutral-950 text-sm pb-2 border-b border-neutral-200">
                    Informasi & Kontak Studio
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Nama Studio
                      </label>
                      <input
                        type="text"
                        value={studioConfig.name}
                        onChange={(e) => setStudioConfig({ ...studioConfig, name: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Tagline / Slogan Studio
                      </label>
                      <input
                        type="text"
                        value={studioConfig.tagline}
                        onChange={(e) => setStudioConfig({ ...studioConfig, tagline: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Email Notifikasi Admin
                      </label>
                      <input
                        type="email"
                        value={studioConfig.adminEmail}
                        onChange={(e) => setStudioConfig({ ...studioConfig, adminEmail: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Nomor WhatsApp CS (dengan 62)
                      </label>
                      <input
                        type="tel"
                        value={studioConfig.whatsappNumber}
                        onChange={(e) => setStudioConfig({ ...studioConfig, whatsappNumber: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Jam Operasional Umum
                      </label>
                      <input
                        type="text"
                        value={studioConfig.operatingHours}
                        onChange={(e) => setStudioConfig({ ...studioConfig, operatingHours: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Teks Metode Pembayaran
                      </label>
                      <input
                        type="text"
                        value={studioConfig.paymentNote}
                        onChange={(e) => setStudioConfig({ ...studioConfig, paymentNote: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white font-medium"
                      />
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-neutral-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-neutral-900" />
                          <span>Alamat Lengkap Studio Foto</span>
                        </label>
                        {studioConfig.address && (
                          <button
                            type="button"
                            onClick={() => setStudioConfig({ ...studioConfig, address: '' })}
                            className="text-[11px] text-red-600 hover:text-red-800 font-medium cursor-pointer"
                          >
                            Kosongkan Alamat
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={studioConfig.address || ''}
                        onChange={(e) => setStudioConfig({ ...studioConfig, address: e.target.value })}
                        placeholder="Ketik alamat lengkap studio foto Anda di sini (misal: Jl. ..., No. ..., Ruko/Gedung ..., Kota ...)"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 bg-white leading-relaxed focus:ring-1 focus:ring-neutral-950 focus:outline-none"
                      />
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Alamat yang Anda simpan di sini akan otomatis tampil di footer website, voucher tiket booking pelanggan, sinkronisasi Google Calendar, dan email konfirmasi.
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-200 flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl transition-all shadow"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan Pengaturan Studio</span>
                    </button>
                  </div>
                </form>

                <div className="p-4 bg-red-50/50 rounded-xl border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-red-950">Reset Data Demo</div>
                    <p className="text-[11px] text-red-800">
                      Kembalikan jadwal booking, foto contoh, dan teks layanan ke pengaturan default studio.
                    </p>
                  </div>
                  <button
                    onClick={handleResetData}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset Data Demo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
