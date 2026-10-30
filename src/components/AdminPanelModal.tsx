import React, { useState } from 'react';
import { Booking, BookingStatus, BlockedSlot, Service, StudioConfig, BackdropOption } from '../types';
import { TIME_SLOTS_MASTER, BACKDROP_OPTIONS } from '../data/studioData';
import {
  getStoredBookings,
  updateBookingStatus,
  deleteBooking,
  getStoredBlockedSlots,
  toggleBlockSlot,
  getStoredServices,
  updateService,
  getStoredStudioConfig,
  updateStudioConfig,
  resetDemoData,
  formatIDR,
  formatDateIndo,
} from '../utils/storage';
import {
  X,
  ShieldCheck,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
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
} from 'lucide-react';
import { initAuth, googleSignIn, logout, getAccessToken } from '../utils/googleAuth';
import {
  createGoogleCalendarEvent,
  getSyncedCalendarRecords,
  generateGoogleCalendarWebUrl,
  SyncedCalendarRecord,
} from '../utils/googleCalendar';

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

  // Active Tab: 'services' | 'bookings' | 'calendar' | 'slots' | 'studio'
  const [activeTab, setActiveTab] = useState<'services' | 'bookings' | 'calendar' | 'slots' | 'studio'>('services');

  // Google Calendar Integration State
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [googleError, setGoogleError] = useState<string>('');
  const [syncingBookingId, setSyncingBookingId] = useState<string>('');
  const [syncAllLoading, setSyncAllLoading] = useState<boolean>(false);
  const [syncedRecords, setSyncedRecords] = useState<Record<string, SyncedCalendarRecord>>(getSyncedCalendarRecords());

  // Booking list filters & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Slot Management State
  const [slotDate, setSlotDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Local sync states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [studioConfig, setStudioConfig] = useState<StudioConfig>(getStoredStudioConfig());

  // Editing service state
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newTierPeople, setNewTierPeople] = useState<number>(3);
  const [newTierPrice, setNewTierPrice] = useState<number>(150000);

  // Success Notification banner
  const [successNotif, setSuccessNotif] = useState<string>('');

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
      desc: newBgDesc.trim() || undefined,
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

  // Subscribe to Google Auth
  React.useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(null)
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Load data on open
  React.useEffect(() => {
    if (isOpen) {
      const svcs = getStoredServices();
      setBookings(getStoredBookings());
      setBlockedSlots(getStoredBlockedSlots());
      setServices(svcs);
      setStudioConfig(getStoredStudioConfig());
      setSyncedRecords(getSyncedCalendarRecords());
      if (svcs.length > 0 && !selectedServiceId) {
        setSelectedServiceId(svcs[0].id);
        setEditingService({ ...svcs[0] });
      }
    }
  }, [isOpen]);

  // When selected service to edit changes
  const handleSelectServiceToEdit = (svcId: string) => {
    setSelectedServiceId(svcId);
    const found = services.find((s) => s.id === svcId);
    if (found) {
      setEditingService({ ...found });
    }
  };

  // Google Sign-In Handler
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setGoogleError('');
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setGoogleUser(res.user);
        setSuccessNotif(`Google Calendar terhubung (${res.user.email})`);
        setTimeout(() => setSuccessNotif(''), 3000);
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      setGoogleError(err.message || 'Gagal masuk dengan Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google Logout Handler
  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUser(null);
    setSuccessNotif('Berhasil keluar dari akun Google.');
    setTimeout(() => setSuccessNotif(''), 3000);
  };

  // Sync Single Booking to Google Calendar
  const handleSyncSingleBooking = async (booking: Booking) => {
    setSyncingBookingId(booking.id);
    setGoogleError('');
    try {
      let token = await getAccessToken();
      if (!token) {
        const signinResult = await googleSignIn();
        token = signinResult?.accessToken || null;
      }
      if (!token) {
        throw new Error('Izin Google Calendar diperlukan untuk sinkronisasi.');
      }

      const res = await createGoogleCalendarEvent(booking, token, 30);
      if (res.success) {
        setSyncedRecords(getSyncedCalendarRecords());
        setSuccessNotif(`Booking #${booking.id} berhasil disinkronkan ke Google Calendar!`);
        setTimeout(() => setSuccessNotif(''), 3000);
      } else {
        setGoogleError(res.error || 'Gagal sinkronisasi ke Google Calendar.');
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Gagal sinkronisasi.');
    } finally {
      setSyncingBookingId('');
    }
  };

  // Sync All Active Bookings to Google Calendar
  const handleSyncAllBookings = async () => {
    const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
    if (activeBookings.length === 0) {
      alert('Tidak ada reservasi aktif untuk disinkronkan.');
      return;
    }

    setSyncAllLoading(true);
    setGoogleError('');
    try {
      let token = await getAccessToken();
      if (!token) {
        const signinResult = await googleSignIn();
        token = signinResult?.accessToken || null;
      }
      if (!token) {
        throw new Error('Izin Google Calendar diperlukan untuk sinkronisasi.');
      }

      let count = 0;
      for (const b of activeBookings) {
        await createGoogleCalendarEvent(b, token, 30);
        count++;
      }
      setSyncedRecords(getSyncedCalendarRecords());
      setSuccessNotif(`${count} reservasi berhasil disinkronkan ke Google Calendar!`);
      setTimeout(() => setSuccessNotif(''), 4000);
    } catch (err: any) {
      setGoogleError(err.message || 'Gagal menyinkronkan seluruh booking.');
    } finally {
      setSyncAllLoading(false);
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
    onDataChanged();
  };

  // Delete Booking
  const handleDeleteBooking = (bookingId: string) => {
    if (window.confirm('Hapus reservasi ini dari sistem?')) {
      const updated = deleteBooking(bookingId);
      setBookings(updated);
      onDataChanged();
    }
  };

  // Toggle Block Slot
  const handleToggleSlot = (timeSlot: string) => {
    const updated = toggleBlockSlot(slotDate, timeSlot);
    setBlockedSlots(updated);
    onDataChanged();
  };

  // Save Service Changes (Full Control over Description, Duration, Open/Close Time, Price)
  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    const updatedList = updateService(editingService);
    setServices(updatedList);
    onDataChanged();
    setSuccessNotif(`Layanan "${editingService.name}" berhasil diperbarui!`);
    setTimeout(() => setSuccessNotif(''), 3000);
  };

  // Upload image for current service
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingService) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setEditingService({ ...editingService, image: dataUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  // Save Studio Settings
  const handleSaveStudioConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateStudioConfig(studioConfig);
    setStudioConfig(updated);
    onDataChanged();
    setSuccessNotif('Pengaturan informasi studio berhasil disimpan!');
    setTimeout(() => setSuccessNotif(''), 3000);
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

  // Filtered Bookings
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customer.whatsapp.includes(searchQuery) ||
      b.serviceName.toLowerCase().includes(searchQuery.toLowerCase());

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
                  {googleUser ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Terhubung" />
                  ) : null}
                </button>

                <button
                  onClick={() => setActiveTab('slots')}
                  className={`py-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'slots'
                      ? 'border-neutral-950 text-neutral-950'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Slot & Jadwal (WITA)</span>
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
                            <span className="text-neutral-400 block text-[10px]">WAKTU (WITA · MAKASSAR)</span>
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

                          <div className="flex items-center gap-2">
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
                              className="p-1 text-neutral-400 hover:text-red-600 rounded"
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

            {/* TAB: GOOGLE CALENDAR INTEGRATION (WITA - GMT+8 MAKASSAR) */}
            {activeTab === 'calendar' && (
              <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                {/* Integration Header Card */}
                <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 text-white p-5 sm:p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                        <CalendarCheck className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base font-display">
                            Integrasi Google Calendar Studio
                          </h4>
                          <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                            WITA (GMT+8)
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Sinkronkan jadwal sesi foto secara otomatis ke Google Calendar dengan format 24 jam zona waktu Makassar.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href="https://calendar.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors shrink-0"
                      >
                        <span>Buka Kalender</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Auth Status & Sign-In Section */}
                  <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {googleUser ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {googleUser.email?.[0]?.toUpperCase() || 'G'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{googleUser.displayName || 'Akun Google Studio'}</span>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/40">
                              Terhubung
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-400 font-mono">
                            {googleUser.email}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-300">
                        <span className="font-semibold block text-white">Status: Belum Terhubung</span>
                        <span className="text-[11px] text-neutral-400">
                          Masuk dengan akun Google (contoh: yayphotostudio@gmail.com) untuk mengaktifkan sinkronisasi otomatis.
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                      {googleUser ? (
                        <>
                          <button
                            type="button"
                            onClick={handleSyncAllBookings}
                            disabled={syncAllLoading}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl transition-all shadow"
                          >
                            {syncAllLoading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Menyinkronkan...</span>
                              </>
                            ) : (
                              <>
                                <CalendarCheck className="w-3.5 h-3.5" />
                                <span>Sinkronkan Semua Booking</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleGoogleLogout}
                            className="px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors"
                          >
                            Keluar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleGoogleLogin}
                          disabled={isGoogleLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all shadow active:scale-95"
                        >
                          {isGoogleLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-neutral-900" />
                          ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path
                                fill="#EA4335"
                                d="M12 5c1.6 0 3 .5 4.1 1.5l3.1-3.1C17.3 1.6 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                              />
                              <path
                                fill="#4285F4"
                                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.3h6.5c-.3 1.5-1.1 2.7-2.3 3.5l3.6 2.8c2.1-1.9 3.4-4.8 3.4-8.3z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.3 14.7c-.2-.7-.3-1.4-.3-2.2s.1-1.5.3-2.2L1.6 7.4C.6 9.4 0 11.6 0 14s.6 4.6 1.6 6.6l3.7-2.9z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c3.2 0 6-1.1 8-3l-3.6-2.8c-1.1.7-2.5 1.2-4.4 1.2-3.1 0-5.8-2.1-6.7-5.1L1.6 16.2C3.5 20.1 7.4 23 12 23z"
                              />
                            </svg>
                          )}
                          <span>Sign in with Google</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {googleError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl font-medium border border-red-200">
                    {googleError}
                  </div>
                )}

                {/* Bookings List to Sync */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Daftar Reservasi & Status Sinkronisasi Google Calendar:
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      Zona: Asia/Makassar (+08:00)
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {bookings.map((b) => {
                      const record = syncedRecords[b.id];
                      const isSynced = Boolean(record);
                      const isCurrentlySyncing = syncingBookingId === b.id;

                      return (
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
                                {b.serviceName}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 font-mono">
                              <span>📅 {formatDateIndo(b.date)}</span>
                              <span>⏰ {b.timeSlot} WITA (GMT+8)</span>
                              <span>👥 {b.peopleCount} Orang</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSynced ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <Check className="w-3 h-3" />
                                <span>Tersinkron</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
                                Belum Terhubung
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSyncSingleBooking(b)}
                              disabled={isCurrentlySyncing}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition-colors active:scale-95"
                            >
                              {isCurrentlySyncing ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CalendarCheck className="w-3.5 h-3.5" />
                              )}
                              <span>{isSynced ? 'Sync Ulang' : 'Sync Calendar'}</span>
                            </button>

                            <a
                              href={record?.htmlLink || generateGoogleCalendarWebUrl(b)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                              title="Buka di Google Calendar Web"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: KELOLA SLOT & JADWAL */}
            {activeTab === 'slots' && (
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Pilih Tanggal Kalender (WITA · GMT+8 Makassar)
                    </label>
                    <input
                      type="date"
                      value={slotDate}
                      onChange={(e) => setSlotDate(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-neutral-300 font-mono focus:outline-none focus:ring-1 focus:ring-neutral-950"
                    />
                  </div>
                  <div className="text-xs text-neutral-600">
                    <span className="font-semibold text-neutral-900 block">
                      {formatDateIndo(slotDate)}
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Klik pada slot waktu di bawah untuk memblokir atau membukanya.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TIME_SLOTS_MASTER.map((slot) => {
                    const isBlocked = blockedSlots.some(
                      (s) => s.date === slotDate && s.timeSlot === slot.time
                    );
                    const isBooked = bookings.some(
                      (b) =>
                        b.date === slotDate &&
                        b.timeSlot === slot.time &&
                        b.status !== 'cancelled'
                    );

                    return (
                      <div
                        key={slot.time}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                          isBooked
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                            : isBlocked
                            ? 'bg-neutral-100 border-neutral-300 text-neutral-500'
                            : 'bg-white border-neutral-200 text-neutral-900'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span>{slot.period}</span>
                          {isBooked ? (
                            <span className="font-semibold text-amber-700">Dipesan</span>
                          ) : isBlocked ? (
                            <span className="font-semibold text-neutral-500">Diblokir</span>
                          ) : (
                            <span className="font-semibold text-emerald-600">Buka</span>
                          )}
                        </div>

                        <div className="text-sm font-bold font-mono">{slot.time}</div>

                        <button
                          type="button"
                          onClick={() => handleToggleSlot(slot.time)}
                          className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            isBlocked
                              ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                          }`}
                        >
                          {isBlocked ? (
                            <>
                              <Unlock className="w-3 h-3" />
                              <span>Buka Slot</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>Blokir Slot</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
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

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        Alamat Studio
                      </label>
                      <input
                        type="text"
                        value={studioConfig.address}
                        onChange={(e) => setStudioConfig({ ...studioConfig, address: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white"
                      />
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
