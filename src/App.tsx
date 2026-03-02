import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Package, 
  MapPin, 
  MapPinned, 
  User, 
  Phone, 
  Clock, 
  ChevronRight, 
  Navigation, 
  CheckCircle2, 
  Bell, 
  Eye, 
  EyeOff,
  History,
  LayoutDashboard,
  ShieldCheck,
  Users,
  BarChart3,
  TrendingUp,
  LogOut,
  Bike,
  Car,
  Truck,
  CreditCard,
  Wrench,
  Stethoscope,
  FlaskConical,
  HelpCircle,
  MessageCircle,
  X,
  ShoppingBag,
  Flower2,
  Dog
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { cn } from './lib/utils';

// Fix Leaflet icon issue
const markerIcon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const markerShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const ANTALYA_COORDS: [number, number] = [36.8841, 30.7056];

const getVehicleInfo = (type: VehicleType) => {
  switch (type) {
    case 'motorcycle': return { icon: Bike, label: 'Motosiklet' };
    case 'car': return { icon: Car, label: 'Araba' };
    case 'van': return { icon: Truck, label: 'Panelvan' };
    default: return { icon: Bike, label: 'Motosiklet' };
  }
};

type VehicleType = 'motorcycle' | 'car' | 'van';
type OrderStatus = 'pending' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';

interface Order {
  id: string;
  customer_name: string;
  customer_id?: string;
  pickup_address: string;
  delivery_address: string;
  status: OrderStatus;
  vehicle_type: VehicleType;
  courier_id?: string;
  distance?: number;
  pickup_lat?: number;
  pickup_lng?: number;
  delivery_lat?: number;
  delivery_lng?: number;
  created_at: string;
}

interface CourierLocation {
  courierId: string;
  lat: number;
  lng: number;
  updated_at: string;
}

interface UserAccount {
  id: string;
  email: string;
  role: AppRole;
  password?: string;
  full_name?: string;
  phone?: string;
}

type AppRole = 'customer' | 'courier' | 'admin';

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(center, { animate: true, duration: 1.5 });
  }, [center, map]);
  return null;
}

async function geocode(address: string) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ", Antalya")}`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Geocoding error:", e);
  }
  return null;
}

const CourierIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png',
  iconSize: [45, 45],
  iconAnchor: [22, 45],
  popupAnchor: [0, -45],
});

const PickupIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1673/1673221.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const DeliveryIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149060.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

function LeafletMapComponent({ 
  location, 
  locations = [], 
  status,
  pickupCoords,
  deliveryCoords
}: { 
  location?: CourierLocation | null, 
  locations?: CourierLocation[], 
  status?: OrderStatus,
  pickupCoords?: { lat: number, lng: number },
  deliveryCoords?: { lat: number, lng: number }
}) {
  const allLocations = location ? [location] : locations;
  
  // Calculate center based on available points
  const center = useMemo(() => {
    if (allLocations.length > 0) return [allLocations[0].lat, allLocations[0].lng] as [number, number];
    if (pickupCoords) return [pickupCoords.lat, pickupCoords.lng] as [number, number];
    if (deliveryCoords) return [deliveryCoords.lat, deliveryCoords.lng] as [number, number];
    return ANTALYA_COORDS;
  }, [allLocations, pickupCoords, deliveryCoords]);

  return (
    <div className="h-full w-full rounded-3xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 relative group">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by Humanitarian OpenStreetMap Team'
        />
        
        {/* Courier Markers */}
        {allLocations.map((loc, idx) => (
          <Marker key={loc.courierId || idx} position={[loc.lat, loc.lng]} icon={CourierIcon}>
            <Popup className="custom-popup">
              <div className="p-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <p className="font-bold text-indigo-600 text-xs">Kurye: {loc.courierId}</p>
                </div>
                <p className="text-[10px] text-slate-500">
                  {status ? (status === 'accepted' ? 'Alış adresine gidiyor' : 'Teslimat adresine gidiyor') : 'Aktif Kurye'}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Pickup Marker */}
        {pickupCoords && (
          <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={PickupIcon}>
            <Popup>
              <div className="p-1 font-bold text-xs text-emerald-600">Alış Adresi</div>
            </Popup>
          </Marker>
        )}

        {/* Delivery Marker */}
        {deliveryCoords && (
          <Marker position={[deliveryCoords.lat, deliveryCoords.lng]} icon={DeliveryIcon}>
            <Popup>
              <div className="p-1 font-bold text-xs text-rose-600">Teslimat Adresi</div>
            </Popup>
          </Marker>
        )}

        <MapController center={center} />
      </MapContainer>
      
      {allLocations.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-white/20 flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <div className="absolute inset-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping"></div>
          </div>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Canlı Takip Aktif</span>
        </div>
      )}

      {!location && locations.length === 0 && status && status !== 'pending' && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-[2rem] shadow-xl flex flex-col items-center gap-4 border border-slate-100">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <span className="text-sm font-bold text-indigo-900 block">Kurye Konumu Bekleniyor...</span>
              <p className="text-[10px] text-slate-400 mt-1">Kuryeniz uygulamayı açtığında konum görünecektir.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthScreen({ onLogin, expectedRole }: { onLogin: (user: UserAccount) => void, expectedRole: AppRole }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AppRole>(expectedRole);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState<{ show: boolean, type: 'terms' | 'kvkk' | 'courier' }>({
    show: false,
    type: 'terms'
  });

  useEffect(() => {
    setRole(expectedRole);
  }, [expectedRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { email, password, role, fullName, phone };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        if (isLogin && data.role !== role && role !== 'admin') {
          setError(`Bu hesap ${data.role === 'customer' ? 'Müşteri' : 'Kurye'} rolüne ait. Lütfen doğru rolü seçin.`);
          return;
        }
        onLogin(data);
      } else {
        setError(data.error || 'Bir hata oluştu');
      }
    } catch (err) {
      setError('Sunucuya bağlanılamadı');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-6xl w-full flex flex-col gap-12">
        {/* Centered Marketing Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-widest">
            <MapPin className="w-3 h-3" />
            Antalya İçi Hızlı Teslimat
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
            Antalya'nın En Akıllı <span className="text-indigo-600">Kurye Ağı</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto">
            Sanayiden kliniğe, her noktaya güvenilir ve hızlı teslimat çözümleri sunuyoruz.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Auth Form */}
          <div className="flex justify-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-slate-200 w-full max-w-md"
            >
              <div className="flex flex-col items-center mb-8">
                <div className="bg-indigo-600 p-4 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">SmartPack</h1>
                <p className="text-slate-500 text-sm mt-1">
                  {isLogin ? 'Hesabınıza giriş yapın' : 'Yeni hesap oluşturun'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Ad Soyad</label>
                      <input 
                        type="text" 
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="Ahmet Yılmaz"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Telefon</label>
                      <input 
                        type="tel" 
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="05XX XXX XX XX"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">E-posta</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="ornek@mail.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Şifre</label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Rolünüz</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => setRole('customer')}
                      className={cn(
                        "py-3 rounded-xl text-sm font-bold border transition-all",
                        role === 'customer' ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500"
                      )}
                    >
                      Müşteri
                    </button>
                    <button 
                      type="button"
                      onClick={() => setRole('courier')}
                      className={cn(
                        "py-3 rounded-xl text-sm font-bold border transition-all",
                        role === 'courier' ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500"
                      )}
                    >
                      Kurye
                    </button>
                  </div>
                </div>

                {error && <p className="text-rose-500 text-xs font-bold text-center">{error}</p>}

                {!isLogin && (
                  <div className="space-y-3 pt-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        required
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all"
                      />
                      <span className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-700 transition-colors">
                        {role === 'customer' ? (
                          <>
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setShowTermsModal({ show: true, type: 'terms' }); }}
                              className="font-bold text-slate-900 underline decoration-slate-300 hover:decoration-indigo-500"
                            >
                              Kullanıcı Sözleşmesi
                            </button> ve <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setShowTermsModal({ show: true, type: 'kvkk' }); }}
                              className="font-bold text-slate-900 underline decoration-slate-300 hover:decoration-indigo-500"
                            >
                              KVKK Aydınlatma Metni
                            </button>'ni okudum, onaylıyorum.
                          </>
                        ) : (
                          <>
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setShowTermsModal({ show: true, type: 'courier' }); }}
                              className="font-bold text-slate-900 underline decoration-slate-300 hover:decoration-indigo-500"
                            >
                              Bağımsız Hizmet Sağlayıcı Sözleşmesi
                            </button> ve <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setShowTermsModal({ show: true, type: 'kvkk' }); }}
                              className="font-bold text-slate-900 underline decoration-slate-300 hover:decoration-indigo-500"
                            >
                              KVKK Aydınlatma Metni
                            </button>'ni okudum, onaylıyorum.
                          </>
                        )}
                      </span>
                    </label>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={!isLogin ? !agreedToTerms : false}
                  className={cn(
                    "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all mt-4",
                    !isLogin && !agreedToTerms && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
                >
                  {isLogin ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
                </button>
              </div>
            </motion.div>
          </div>

          {/* Marketing Content (Services Grid) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { 
                  icon: Wrench, 
                  title: "Sanayi", 
                  desc: "Yedek parça temini.",
                  color: "bg-amber-50 text-amber-600"
                },
                { 
                  icon: Stethoscope, 
                  title: "Diş Klinik", 
                  desc: "Laboratuvar gönderileri.",
                  color: "bg-emerald-50 text-emerald-600"
                },
                { 
                  icon: ShoppingBag, 
                  title: "Petshop", 
                  desc: "Hızlı mama & aksesuar.",
                  color: "bg-orange-50 text-orange-600"
                },
                { 
                  icon: Flower2, 
                  title: "Çiçek", 
                  desc: "Hassas çiçek teslimatı.",
                  color: "bg-pink-50 text-pink-600"
                },
                { 
                  icon: Dog, 
                  title: "Pet Taxi", 
                  desc: "Veteriner ulaşımı.",
                  color: "bg-indigo-50 text-indigo-600"
                },
                { 
                  icon: Package, 
                  title: "Acil Paket", 
                  desc: "Şehir içi hızlı evrak.",
                  color: "bg-rose-50 text-rose-600"
                }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={cn("p-2 rounded-xl shrink-0", item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                    <p className="text-[10px] text-slate-500 leading-tight">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
   {/* Terms Modal */}
        <AnimatePresence>
          {showTermsModal.show && (
            <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowTermsModal(prev => ({ ...prev, show: false }))}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-xl font-bold text-slate-900">
                    {showTermsModal.type === 'terms' && 'Kullanıcı Sözleşmesi'}
                    {showTermsModal.type === 'kvkk' && 'KVKK Aydınlatma Metni'}
                    {showTermsModal.type === 'courier' && 'Bağımsız Hizmet Sağlayıcı Sözleşmesi'}
                  </h3>
                  <button 
                    onClick={() => setShowTermsModal(prev => ({ ...prev, show: false }))}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-500" />
                  </button>
                </div>
                <div className="p-8 overflow-y-auto text-sm text-slate-600 leading-relaxed space-y-4">
                  {showTermsModal.type === 'terms' && (
                    <>
                      <p className="font-bold text-slate-900">1. Taraflar</p>
                      <p>İşbu sözleşme, SmartPack platformu ile platform üzerinden hizmet alan Müşteri arasında akdedilmiştir.</p>
                      <p className="font-bold text-slate-900">2. Hizmetin Niteliği</p>
                      <p>SmartPack, kuryeler ile müşterileri bir araya getiren bir teknoloji platformudur. SmartPack, taşıma hizmetinin bizzat sağlayıcısı değildir.</p>
                      <p className="font-bold text-slate-900">3. Sorumluluk Sınırları</p>
                      <p>Müşteri, gönderinin içeriğinden ve yasalara uygunluğundan sorumludur. SmartPack, kurye tarafından sunulan hizmetin kalitesi veya ifası ile ilgili doğrudan sorumluluk kabul etmez.</p>
                    </>
                  )}
                  {showTermsModal.type === 'kvkk' && (
                    <>
                      <p className="font-bold text-slate-900">1. Veri Sorumlusu</p>
                      <p>SmartPack olarak kişisel verilerinizin güvenliğine önem veriyoruz.</p>
                      <p className="font-bold text-slate-900">2. İşlenen Veriler</p>
                      <p>Ad, soyad, telefon numarası, e-posta adresi ve konum verileriniz hizmetin ifası amacıyla işlenmektedir.</p>
                      <p className="font-bold text-slate-900">3. İşleme Amacı</p>
                      <p>Verileriniz, kurye taleplerinizin yönetilmesi, güvenli teslimatın sağlanması ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir.</p>
                    </>
                  )}
                  {showTermsModal.type === 'courier' && (
                    <>
                      <p className="font-bold text-slate-900">1. Bağımsız Statü</p>
                      <p>Kurye, SmartPack'in bir çalışanı veya temsilcisi değildir. Kurye, kendi nam ve hesabına çalışan bağımsız bir hizmet sağlayıcıdır.</p>
                      <p className="font-bold text-slate-900">2. Vergi ve Sigorta</p>
                      <p>Kurye, kendi vergi mükellefiyetinden, sosyal güvenlik primlerinden ve her türlü sigorta yükümlülüğünden bizzat sorumludur.</p>
                      <p className="font-bold text-slate-900">3. Platformun Rolü</p>
                      <p>Platform, sadece müşteri ile kurye arasında elektronik ortamda aracılık hizmeti sunar. Taşıma hizmetinin ifasından doğan tüm hukuki ve mali sorumluluk kuryeye aittir.</p>
                    </>
                  )}
                </div>
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                  <button 
                    onClick={() => setShowTermsModal(prev => ({ ...prev, show: false }))}
                    className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all"
                  >
                    Anladım
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('smartpack_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [role, setRole] = useState<AppRole>(() => {
    const saved = localStorage.getItem('smartpack_user');
    return saved ? JSON.parse(saved).role : 'customer';
  });
  const [view, setView] = useState<'active' | 'history'>('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [onlineCouriers, setOnlineCouriers] = useState(0);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(() => {
    const saved = localStorage.getItem('smartpack_active_order');
    return saved ? JSON.parse(saved) : null;
  });
  const activeOrderRef = useRef<Order | null>(null);
  
  useEffect(() => {
    if (user) {
      localStorage.setItem('smartpack_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('smartpack_user');
    }
  }, [user]);

  useEffect(() => {
    if (activeOrder) {
      localStorage.setItem('smartpack_active_order', JSON.stringify(activeOrder));
    } else {
      localStorage.removeItem('smartpack_active_order');
    }
  }, [activeOrder]);

  useEffect(() => {
    activeOrderRef.current = activeOrder;
  }, [activeOrder]);

  const [courierLocation, setCourierLocation] = useState<CourierLocation | null>(null);
  const [allCourierLocations, setAllCourierLocations] = useState<CourierLocation[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number, lng: number } | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [packageType, setPackageType] = useState('dosya');
  const [specialRequest, setSpecialRequest] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'sender' | 'receiver'>('sender');
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
  const [showMap, setShowMap] = useState(true);
  const [showCallModal, setShowCallModal] = useState(false);
  const [activeCourier, setActiveCourier] = useState<UserAccount | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<UserAccount | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const [logoClicks, setLogoClicks] = useState(0);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    if (user && user.role === 'customer') {
      if (!customerName) setCustomerName(user.full_name || '');
      if (!customerPhone) setCustomerPhone(user.phone || '');
    }
  }, [user]);

  const myCourierId = useMemo(() => {
    if (user?.role === 'courier') return user.id;
    const savedId = localStorage.getItem('smartpack_courier_id');
    if (savedId) return savedId;
    const newId = `courier_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('smartpack_courier_id', newId);
    return newId;
  }, [user]);

  useEffect(() => {
    if (logoClicks >= 5) {
      setRole('admin');
      setLogoClicks(0);
    }
  }, [logoClicks]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'admin') {
      setRole('admin');
    }
  }, []);

  useEffect(() => {
    if (role === 'courier' && socketConnected) {
      if ("geolocation" in navigator) {
        console.log("Starting geolocation watch...");
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
            if (socketRef.current?.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({
                type: 'location_update',
                courierId: myCourierId,
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }));
            }
          },
          (error) => {
            console.error("Geolocation error:", error);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [role, socketConnected, myCourierId]);

  useEffect(() => {
    if (user?.fullName && !customerName) {
      setCustomerName(user.fullName);
    }
    if (user?.phone && !customerPhone) {
      setCustomerPhone(user.phone);
    }
  }, [user, customerName, customerPhone]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setSocketConnected(true);
      if (user) {
        socket.send(JSON.stringify({
          type: 'auth',
          courierId: user.role === 'courier' ? user.id : undefined,
          role: user.role
        }));
      }
    };
    socket.onclose = () => setSocketConnected(false);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'notification') {
        alert(`Sistem Bildirimi: ${data.message}`);
        playNotificationSound();
      } else if (data.type === 'new_order') {
        setOrders(prev => {
          const exists = prev.some(o => o.id === data.order.id);
          if (exists) {
            return prev.map(o => o.id === data.order.id ? data.order : o);
          }
          return [data.order, ...prev];
        });

        if (role === 'courier') {
          playNotificationSound();
        }
      } else if (data.type === 'courier_location') {
        if (role === 'admin') {
          setAllCourierLocations(prev => {
            const exists = prev.some(l => l.courierId === data.courierId);
            if (exists) {
              return prev.map(l => l.courierId === data.courierId ? data : l);
            }
            return [...prev, data];
          });
        }

        const currentOrder = activeOrderRef.current;
        const isAssignedCourier = currentOrder?.courier_id === data.courierId;
        const isPendingOrder = currentOrder?.status === 'pending';
        
        if (isAssignedCourier || (isPendingOrder && !currentOrder?.courier_id)) {
          setCourierLocation(data);
        }
      } else if (data.type === 'order_updated') {
        setOrders(prev => prev.map(o => o.id === data.orderId ? { ...o, status: data.status, courier_id: data.courierId } : o));
        
        if (role === 'courier') {
          if (data.status === 'cancelled') {
            playNotificationSound();
          }
        }

        setActiveOrder(prev => {
          if (prev?.id === data.orderId) {
            if (data.status === 'delivered' || data.status === 'cancelled') {
              return null;
            }
            return { ...prev, status: data.status, courier_id: data.courierId };
          }
          return prev;
        });
      }
    };

    fetch('/api/orders').then(res => res.json()).then(setOrders);

    // Periodic refresh for couriers to ensure no orders are missed
    let interval: number | null = null;
    if (role === 'courier') {
      interval = window.setInterval(() => {
        fetch('/api/orders')
          .then(res => res.json())
          .then(newOrders => {
            setOrders(prev => {
              // Check for new pending orders that we haven't seen yet
              const hasNewPending = newOrders.some((o: any) => 
                o.status === 'pending' && !prev.some(p => p.id === o.id)
              );
              if (hasNewPending) {
                playNotificationSound();
              }
              return newOrders;
            });
          });
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      socket.close();
      if (interval) clearInterval(interval);
    };
  }, [role, user?.id]);

  useEffect(() => {
    if (activeOrder?.courier_id) {
      fetch(`/api/courier-location/${activeOrder.courier_id}`)
        .then(res => res.json())
        .then(data => {
          if (data) setCourierLocation(data);
        });
    }
  }, [activeOrder?.courier_id]);

  useEffect(() => {
    if (role === 'admin') {
      fetch('/api/admin/users').then(res => res.json()).then(setUsers);
      const fetchStats = () => {
        fetch('/api/admin/stats').then(res => res.json()).then(data => {
          setOnlineCouriers(data.onlineCouriers);
          setWebhookConfigured(data.webhookConfigured);
        });
        fetch('/api/couriers').then(res => res.json()).then(setAllCourierLocations);
      };
      fetchStats();
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [role]);

  const playNotificationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.error("Audio play error:", e));
  };

  useEffect(() => {
    if (activeOrder?.id) {
      if (activeOrder.courier_id) {
        fetch(`/api/users/${activeOrder.courier_id}`)
          .then(res => res.json())
          .then(setActiveCourier)
          .catch(() => setActiveCourier(null));
      } else {
        setActiveCourier(null);
      }

      if (activeOrder.customer_id && role === 'courier') {
        fetch(`/api/users/${activeOrder.customer_id}`)
          .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
          })
          .then(data => {
            if (!data) throw new Error();
            setActiveCustomer(data);
          })
          .catch(() => {
            console.error("Failed to fetch customer info");
            // If we can't get customer info, we still want to show the modal but with a fallback
            setActiveCustomer({ id: activeOrder.customer_id!, email: 'Bilinmiyor', role: 'customer' });
          });
      } else {
        setActiveCustomer(null);
      }
    } else {
      setActiveCourier(null);
      setActiveCustomer(null);
    }
  }, [activeOrder?.id, activeOrder?.courier_id, activeOrder?.customer_id, role]);

  const getPrice = (type: VehicleType) => {
    switch (type) {
      case 'motorcycle': return 100;
      case 'car': return 300;
      case 'van': return 500;
      default: return 0;
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowPriceModal(true);
  };

  const handleConfirmOrder = async () => {
    setShowPriceModal(false);
    setIsCreatingOrder(true);
    try {
      // Generate a mock distance between 1.5 and 12.0 km
      const mockDistance = parseFloat((Math.random() * (12 - 1.5) + 1.5).toFixed(1));

      // Geocode addresses
      const pickupCoords = await geocode(pickup);
      const deliveryCoords = await geocode(delivery);

      console.log("Creating order with data:", { 
        customerName, 
        customerPhone,
        customerId: user?.id,
        pickupAddress: pickup, 
        deliveryAddress: delivery, 
        vehicleType,
        paymentMethod,
        packageType,
        specialRequest,
        distance: mockDistance,
        pickup_lat: pickupCoords?.lat,
        pickup_lng: pickupCoords?.lng,
        delivery_lat: deliveryCoords?.lat,
        delivery_lng: deliveryCoords?.lng
      });

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerName, 
          customerPhone,
          customerId: user?.id,
          pickupAddress: pickup, 
          deliveryAddress: delivery, 
          vehicleType,
          paymentMethod,
          packageType,
          specialRequest,
          distance: mockDistance,
          pickup_lat: pickupCoords?.lat,
          pickup_lng: pickupCoords?.lng,
          delivery_lat: deliveryCoords?.lat,
          delivery_lng: deliveryCoords?.lng
        })
      });
      
      if (!res.ok) throw new Error('Sipariş oluşturulamadı');
      
      const newOrder = await res.json();
      setOrders(prev => {
        if (prev.some(o => o.id === newOrder.id)) return prev;
        return [newOrder, ...prev];
      });
      setActiveOrder(newOrder);
      setPickup('');
      setDelivery('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'accepted', courier_id: myCourierId } : o));
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setActiveOrder({ ...order, status: 'accepted', courier_id: myCourierId });
      setShowCallModal(true);
    }

    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted', courierId: myCourierId })
    });
  };

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, courier_id: myCourierId } : o));
    setActiveOrder(prev => {
      if (prev?.id === orderId) {
        if (status === 'delivered' || status === 'cancelled') {
          return null;
        }
        return { ...prev, status, courier_id: myCourierId };
      }
      return prev;
    });

    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, courierId: myCourierId })
    });
  };

  const handleCourierCancelOrder = async (orderId: string) => {
    if (!window.confirm('Bu talebi iptal etmek istediğinize emin misiniz? Talep diğer kuryelere tekrar açılacaktır.')) return;

    try {
      console.log("Cancelling order:", orderId);
      
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending', courierId: null })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'İptal işlemi başarısız oldu');
      }
      
      // Update local state after successful server update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'pending', courier_id: null as any } : o));
      setCourierLocation(null);
      setShowCallModal(false);
      
      console.log("Order cancelled successfully");
    } catch (error: any) {
      console.error("Cancel error:", error);
      alert(`İptal işlemi sırasında bir hata oluştu: ${error.message}. Lütfen tekrar deneyin.`);
      // Refresh orders to sync state
      fetch('/api/orders').then(res => res.json()).then(setOrders);
    }
  };

  const handleNavigate = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  const handleNavigateFullRoute = (order: Order) => {
    const origin = myLocation ? `${myLocation.lat},${myLocation.lng}` : 'My+Location';
    const destination = encodeURIComponent(order.delivery_address);
    const waypoint = encodeURIComponent(order.pickup_address);
    
    // Google Maps Directions URL with waypoints
    // https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoint}&travelmode=driving`;
    window.open(url, '_blank');
  };

  if (!user && role !== 'admin') {
    return <AuthScreen expectedRole={role} onLogin={(u) => {
      setUser(u);
      setRole(u.role);
    }} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans selection:bg-indigo-100">
      <header className="sticky top-0 z-[1000] bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setLogoClicks(prev => prev + 1)}>
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Package className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SmartPack</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-bold text-slate-900 leading-none">{user.email}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">{user.role}</p>
              </div>
              <button 
                onClick={() => {
                  setUser(null);
                  setActiveOrder(null);
                  setCourierLocation(null);
                }}
                className="ml-2 p-1 text-slate-400 hover:text-rose-500 transition-colors"
                title="Çıkış Yap"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          {!user && role === 'admin' && (
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white shadow-sm text-indigo-600 transition-all"
              >
                Admin
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="flex gap-4 mb-8 border-b border-slate-200">
          <button 
            onClick={() => setView('active')}
            className={cn(
              "pb-4 px-2 text-sm font-bold transition-all relative",
              view === 'active' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Aktif Talepler
            {view === 'active' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
          <button 
            onClick={() => setView('history')}
            className={cn(
              "pb-4 px-2 text-sm font-bold transition-all relative",
              view === 'history' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Sipariş Geçmişi
            {view === 'history' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
        </div>


        {role === 'admin' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold">Yönetici Paneli</h2>
                <p className="text-slate-500 text-sm mt-1">Sistem genelindeki tüm hareketleri izleyin.</p>
              </div>
              <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-2xl text-xs font-bold border border-indigo-100">
                <ShieldCheck className="w-4 h-4" />
                Sistem Yöneticisi
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Toplam Sipariş</span>
                </div>
                <p className="text-2xl font-bold">{orders.length}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Aktif Teslimat</span>
                </div>
                <p className="text-2xl font-bold">{orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'pending').length}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-amber-50 p-2 rounded-xl text-amber-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Bekleyen</span>
                </div>
                <p className="text-2xl font-bold">{orders.filter(o => o.status === 'pending').length}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-rose-50 p-2 rounded-xl text-rose-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Tamamlanan</span>
                </div>
                <p className="text-2xl font-bold">{orders.filter(o => o.status === 'delivered').length}</p>
              </div>
              <div className="bg-indigo-600 p-6 rounded-3xl shadow-lg shadow-indigo-100 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-white/60 uppercase">Online Kurye</span>
                </div>
                <p className="text-2xl font-bold">{onlineCouriers}</p>
                <p className="text-[10px] text-white/40 mt-1 uppercase tracking-widest font-bold">Şu an aktif</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 h-[600px]">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold">Kurye Canlı Takip</h3>
                      <p className="text-sm text-slate-400">Tüm aktif kuryelerin anlık konumları</p>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      Canlı
                    </div>
                  </div>
                  <LeafletMapComponent locations={allCourierLocations} />
                </div>
              </div>

              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-amber-50 p-4 rounded-2xl">
                      <Bell className="w-7 h-7 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Duyuru Gönder</h3>
                      <p className="text-sm text-slate-400">Kuryelere anlık bildirim</p>
                    </div>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value;
                    await fetch('/api/admin/notify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message, targetRole: 'courier' })
                    });
                    form.reset();
                    alert('Bildirim gönderildi!');
                  }} className="space-y-4">
                    <textarea 
                      name="message"
                      required
                      placeholder="Kuryelere iletilecek mesaj..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all min-h-[120px]"
                    />
                    <button 
                      type="submit"
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Bell className="w-5 h-5" />
                      Bildirim Gönder
                    </button>
                  </form>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-50 p-4 rounded-2xl">
                        <MessageCircle className="w-7 h-7 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">WhatsApp Test</h3>
                        <p className="text-sm text-slate-400">Bağlantıyı doğrula</p>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5",
                      webhookConfigured ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", webhookConfigured ? "bg-emerald-500" : "bg-rose-500")}></div>
                      {webhookConfigured ? "Bağlı" : "Bağlı Değil"}
                    </div>
                  </div>
                  
                  {!webhookConfigured && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs leading-relaxed">
                      <p className="font-bold mb-1">⚠️ Webhook URL Eksik!</p>
                      <p>Secrets panelinden <b>WHATSAPP_WEBHOOK_URL</b> anahtarını tanımlamanız gerekiyor.</p>
                    </div>
                  )}

                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/admin/test-whatsapp', { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                          alert(data.message);
                        } else {
                          alert(`Hata: ${data.error || 'Bilinmeyen bir hata oluştu.'}`);
                        }
                      } catch (e) {
                        alert('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
                      }
                    }}
                    className={cn(
                      "w-full font-bold py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2",
                      webhookConfigured 
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-100" 
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    )}
                    disabled={!webhookConfigured}
                  >
                    <MessageCircle className="w-5 h-5" />
                    Bağlantıyı Test Et
                  </button>
                  <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
                    * Bu buton Zapier/Make'e test verisi gönderir. Eğer "Bağlı Değil" yazıyorsa önce Secrets panelini kontrol edin.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-indigo-50 p-4 rounded-2xl">
                    <Users className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Kullanıcı Yönetimi</h3>
                    <p className="text-sm text-slate-400">Tüm kayıtlı kullanıcılar ve şifreleri</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {users.map(u => (
                    <div key={u.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm text-slate-900">{u.full_name || 'İsimsiz Kullanıcı'}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">{u.role} • {u.phone || 'Telefon Yok'}</p>
                        </div>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          u.role === 'courier' ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
                        )}>
                          {u.role}
                        </div>
                      </div>
                      <div className="mt-2 pt-3 border-t border-slate-200 flex items-center gap-2">
                        <ShieldCheck className="w-3 h-3 text-slate-400" />
                        <p className="text-xs font-mono text-indigo-600">Şifre: {u.password}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Orders Table */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-400" />
                    Tüm Siparişler
                  </h3>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Müşteri / ID</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Durum</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Kurye</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Tarih</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.map(order => (
                          <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-sm">{order.customer_name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">#{order.id}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                order.status === 'delivered' ? "bg-emerald-100 text-emerald-700" :
                                order.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                order.status === 'cancelled' ? "bg-rose-100 text-rose-700" :
                                "bg-indigo-100 text-indigo-700"
                              )}>
                                {order.status === 'pending' ? 'Bekliyor' :
                                 order.status === 'accepted' ? 'Kabul Edildi' :
                                 order.status === 'picked_up' ? 'Yolda' :
                                 order.status === 'delivered' ? 'Teslim Edildi' : 'İptal Edildi'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium text-slate-600">{order.courier_id || '-'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString('tr-TR')}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Courier List */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-400" />
                  Kuryeler
                </h3>
                <div className="space-y-3">
                  {users.filter(u => u.role === 'courier').length > 0 ? (
                    users.filter(u => u.role === 'courier').map(courier => (
                      <div key={courier.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{courier.full_name || 'İsimsiz Kurye'}</p>
                            <p className="text-[10px] text-emerald-500 font-bold uppercase">Kayıtlı</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400">Puan</p>
                          <p className="text-sm font-bold">5.0 ★</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400">Henüz kayıtlı kurye yok.</p>
                    </div>
                  )}
                </div>

                <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-100">
                  <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="w-6 h-6" />
                    <h4 className="font-bold">Hızlı Rapor</h4>
                  </div>
                  <p className="text-sm text-indigo-100 mb-6">Bugün toplam ₺1,250.00 kazanç sağlandı. Ortalama teslimat süresi 24 dakika.</p>
                  <button className="w-full bg-white/20 hover:bg-white/30 py-3 rounded-xl text-xs font-bold transition-all">
                    Detaylı Raporu Gör
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {role === 'customer' && (
          <div className="space-y-8">
            {view === 'active' ? (
              <div className="space-y-8">
                {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                    <button 
                      onClick={() => setActiveOrder(null)}
                      className={cn(
                        "flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-bold transition-all border",
                        !activeOrder ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                      )}
                    >
                      + Yeni Sipariş
                    </button>
                    {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').map(order => (
                      <button
                        key={order.id}
                        onClick={() => setActiveOrder(order)}
                        className={cn(
                          "flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-bold transition-all border flex items-center gap-2",
                          activeOrder?.id === order.id ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                        )}
                      >
                        <Package className="w-4 h-4" />
                        #{order.id.substring(0, 4)}
                      </button>
                    ))}
                  </div>
                )}

                {!activeOrder ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="lg:col-span-2 bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-200"
                    >
                      <div className="max-w-2xl mx-auto">
                        <div className="text-center mb-10">
                          <h2 className="text-3xl font-bold mb-3">Paket Gönder</h2>
                          <p className="text-slate-500">Adres bilgilerini girerek hemen bir kurye çağırın.</p>
                        </div>
                        
                        <form onSubmit={handleCreateOrder} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Adınız Soyadınız</label>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input 
                                required
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                placeholder="Örn: Mehmet Ak"
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Telefon Numaranız</label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input 
                                required
                                type="tel"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                placeholder="05xx xxx xx xx"
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Alış Adresi</label>
                            <div className="relative">
                              <MapPin className="absolute left-4 top-4 w-5 h-5 text-emerald-500" />
                              <textarea 
                                required
                                rows={3}
                                value={pickup}
                                onChange={e => setPickup(e.target.value)}
                                placeholder="Paketin alınacağı tam adresi giriniz..."
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Teslim Adresi</label>
                            <div className="relative">
                              <MapPinned className="absolute left-4 top-4 w-5 h-5 text-rose-500" />
                              <textarea 
                                required
                                rows={3}
                                value={delivery}
                                onChange={e => setDelivery(e.target.value)}
                                placeholder="Paketin teslim edileceği tam adresi giriniz..."
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Araç Tipi</label>
                            <div className="grid grid-cols-3 gap-4">
                              {[
                                { id: 'motorcycle', label: 'Motosiklet', icon: Bike, desc: 'Dosya, Paket' },
                                { id: 'car', label: 'Araba', icon: Car, desc: 'Orta Boy, Pet' },
                                { id: 'van', label: 'Panelvan', icon: Truck, desc: 'Ev Eşyası' }
                              ].map((v) => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => setVehicleType(v.id as VehicleType)}
                                  className={cn(
                                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                    vehicleType === v.id 
                                      ? "bg-indigo-50 border-indigo-600 text-indigo-600 shadow-md" 
                                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                  )}
                                >
                                  <v.icon className={cn("w-6 h-6", vehicleType === v.id ? "text-indigo-600" : "text-slate-400")} />
                                  <div className="text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-wider">{v.label}</p>
                                    <p className="text-[8px] opacity-60">{v.desc}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Paket Cinsi</label>
                              <select 
                                value={packageType}
                                onChange={e => setPackageType(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                              >
                                <option value="dosya">Dosya / Evrak</option>
                                <option value="paket">Küçük Paket</option>
                                <option value="koli">Koli / Kutu</option>
                                <option value="yedek_parca">Yedek Parça</option>
                                <option value="tibbi">Tıbbi Malzeme</option>
                                <option value="diger">Diğer</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Özel Talep / Not</label>
                              <input 
                                value={specialRequest}
                                onChange={e => setSpecialRequest(e.target.value)}
                                placeholder="Varsa kuryeye notunuz..."
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <button 
                          type="submit"
                          disabled={isCreatingOrder}
                          className={cn(
                            "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 group text-lg",
                            isCreatingOrder && "opacity-70 cursor-not-allowed"
                          )}
                        >
                          {isCreatingOrder ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              İşleniyor...
                            </>
                          ) : (
                            <>
                              Kurye Çağır
                              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </motion.div>

                  {/* Services Sidebar for Logged-in Customers */}
                  <div className="space-y-6">
                    <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                        <MapPin className="w-3 h-3" />
                        Antalya İçi Teslimat
                      </div>
                      <h3 className="text-xl font-bold mb-4">Neler Taşıyoruz?</h3>
                      <div className="space-y-4">
                        {[
                          { icon: Wrench, title: "Sanayi Parçaları", desc: "Acil yedek parça temini" },
                          { icon: Stethoscope, title: "Diş Klinik & Lab", desc: "Hassas tıbbi gönderiler" },
                          { icon: FlaskConical, title: "Laboratuvar", desc: "Numune ve test kitleri" },
                          { icon: Package, title: "Acil Evrak", desc: "Hızlı şehir içi kurye" }
                        ].map((s, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-white/10 rounded-2xl border border-white/10">
                            <div className="bg-white/20 p-2 rounded-xl">
                              <s.icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold">{s.title}</p>
                              <p className="text-[10px] text-white/60">{s.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <h4 className="font-bold mb-4">Neden SmartPack?</h4>
                      <ul className="space-y-3">
                        {[
                          "Canlı takip imkanı",
                          "Güvenilir kurye ağı",
                          "7/24 kesintisiz hizmet"
                        ].map((t, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                      <div>
                        <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 text-[11px] font-bold uppercase tracking-widest rounded-full mb-3">
                          {activeOrder.status === 'pending' ? 'Kurye Aranıyor' : 'Teslimat Sürecinde'}
                        </span>
                        <h2 className="text-3xl font-bold">Sipariş Takibi</h2>
                        <p className="text-slate-400 text-sm mt-1">Takip No: #{activeOrder.id}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setActiveOrder(null)} 
                          className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-colors flex items-center gap-2 text-xs font-bold"
                        >
                          <Package className="w-5 h-5" />
                          Yeni Sipariş
                        </button>
                        <button 
                          onClick={() => setShowMap(!showMap)} 
                          className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 text-xs font-bold"
                        >
                          {showMap ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          {showMap ? "Haritayı Gizle" : "Haritayı Göster"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                      <div className={cn("space-y-8", showMap ? "lg:col-span-7" : "lg:col-span-12")}>
                        <div className="flex gap-5">
                          <div className="flex flex-col items-center">
                            <div className={cn("w-4 h-4 rounded-full border-4 border-white ring-2 ring-offset-2", activeOrder.status !== 'pending' ? "bg-emerald-500 ring-emerald-500" : "bg-slate-200 ring-slate-200")}></div>
                            <div className="w-0.5 h-16 bg-slate-100"></div>
                            <div className={cn("w-4 h-4 rounded-full border-4 border-white ring-2 ring-offset-2", activeOrder.status === 'picked_up' || activeOrder.status === 'delivered' ? "bg-emerald-500 ring-emerald-500" : "bg-slate-200 ring-slate-200")}></div>
                            <div className="w-0.5 h-16 bg-slate-100"></div>
                            <div className={cn("w-4 h-4 rounded-full border-4 border-white ring-2 ring-offset-2", activeOrder.status === 'delivered' ? "bg-emerald-500 ring-emerald-500" : "bg-slate-200 ring-slate-200")}></div>
                          </div>
                          <div className="flex flex-col gap-12 py-0.5">
                            <div className="flex flex-col">
                              <span className="text-base font-bold">Kurye Atandı</span>
                              <span className="text-sm text-slate-400">Kuryeniz paket için yola çıktı</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-base font-bold">Paket Alındı</span>
                              <span className="text-sm text-slate-400">Paketiniz kurye tarafından teslim alındı</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-base font-bold">Teslim Edildi</span>
                              <span className="text-sm text-slate-400">Paketiniz başarıyla ulaştı</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6 lg:col-span-5">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Teslimat Detayları</h3>
                            {activeOrder.vehicle_type && (
                              <div className="flex flex-wrap gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-slate-200">
                                  {React.createElement(getVehicleInfo(activeOrder.vehicle_type).icon, { className: "w-3 h-3 text-indigo-600" })}
                                  <span className="text-[10px] font-bold text-slate-600 uppercase">{getVehicleInfo(activeOrder.vehicle_type).label}</span>
                                </div>
                                {activeOrder.package_type && (
                                  <div className="px-3 py-1 bg-white rounded-full border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-600 uppercase">{activeOrder.package_type}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="space-y-4">
                            <div className="flex gap-3">
                              <MapPin className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Alış</p>
                                <p className="text-sm font-medium">{activeOrder.pickup_address}</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <MapPinned className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Teslim</p>
                                <p className="text-sm font-medium">{activeOrder.delivery_address}</p>
                              </div>
                            </div>
                            {activeOrder.special_request && (
                              <div className="mt-4 p-3 bg-white rounded-2xl border border-slate-100 italic text-xs text-slate-500">
                                <span className="font-bold not-italic text-slate-400 uppercase text-[9px] mr-2">Not:</span>
                                {activeOrder.special_request}
                              </div>
                            )}
                          </div>
                        </div>

                        {activeOrder.courier_id && (
                          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                                  <User className="w-7 h-7 text-indigo-600" />
                                </div>
                                <div>
                                  <p className="text-base font-bold text-indigo-900">{activeCourier?.full_name || 'Kurye Atanıyor...'}</p>
                                  <p className="text-xs text-indigo-500 font-medium">4.8 ★ Kurye</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {activeCourier?.phone && (
                                  <a 
                                    href={`tel:${activeCourier.phone}`}
                                    className="p-4 bg-white text-indigo-600 rounded-2xl shadow-sm hover:bg-indigo-50 transition-colors"
                                  >
                                    <Phone className="w-5 h-5" />
                                  </a>
                                )}
                                <a 
                                  href={`https://wa.me/?text=${encodeURIComponent(`*Yeni Paket Talebi!* 📦\n\n*Takip No:* #${activeOrder.id}\n*Alım:* ${activeOrder.pickup_address}\n*Teslim:* ${activeOrder.delivery_address}\n*Araç:* ${activeOrder.vehicle_type}\n\nSmartPack Uygulaması`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-4 bg-emerald-500 text-white rounded-2xl shadow-sm hover:bg-emerald-600 transition-colors"
                                  title="WhatsApp ile Paylaş"
                                >
                                  <MessageCircle className="w-5 h-5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeOrder.status === 'pending' && (
                          <button 
                            onClick={() => {
                              handleUpdateStatus(activeOrder.id, 'cancelled');
                              setActiveOrder(null);
                            }}
                            className="w-full py-4 text-rose-500 font-bold text-sm hover:bg-rose-50 rounded-2xl transition-colors border border-rose-100"
                          >
                            Siparişi İptal Et
                          </button>
                        )}
                      </div>

                      {showMap && activeOrder.status !== 'pending' && (
                        <div className="lg:col-span-12 h-[450px] mt-6">
                          <LeafletMapComponent location={courierLocation} status={activeOrder.status} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Tamamlanan Teslimatlarınız</h2>
                <div className="grid grid-cols-1 gap-4">
                  {orders.filter(o => o.status === 'delivered' || o.status === 'cancelled').map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-2xl", order.status === 'delivered' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                          {order.status === 'delivered' ? <CheckCircle2 className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="font-bold">#{order.id}</p>
                          <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString('tr-TR')}</p>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-600 line-clamp-1"><span className="font-bold">Alış:</span> {order.pickup_address}</p>
                        <p className="text-sm text-slate-600 line-clamp-1"><span className="font-bold">Teslim:</span> {order.delivery_address}</p>
                      </div>
                      <div className="flex items-center">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          order.status === 'delivered' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {order.status === 'delivered' ? 'Teslim Edildi' : 'İptal Edildi'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {orders.filter(o => o.status === 'delivered' || o.status === 'cancelled').length === 0 && (
                    <div className="text-center py-12 text-slate-400">Henüz geçmiş siparişiniz bulunmuyor.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {role === 'courier' && (
          <div className="space-y-8">
            {view === 'active' ? (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold">Kurye Paneli</h2>
                    <p className="text-slate-500 text-sm mt-1">Aktif talepleri yönetin.</p>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl text-xs font-bold border border-emerald-100">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    Çevrimiçi
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {orders.filter(o => o.status === 'pending').map(order => (
                    <motion.div 
                      key={order.id}
                      layoutId={order.id}
                      className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 hover:border-indigo-300 transition-all group"
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex-1 space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="bg-slate-100 p-4 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                                <Package className="w-7 h-7 text-slate-600 group-hover:text-indigo-600" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold">{order.customer_name}</h3>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm text-slate-400">Sipariş No: #{order.id}</p>
                                  {order.vehicle_type && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase rounded-md border border-indigo-100">
                                      {React.createElement(getVehicleInfo(order.vehicle_type).icon, { className: "w-2.5 h-2.5" })}
                                      {getVehicleInfo(order.vehicle_type).label}
                                    </span>
                                  )}
                                  {order.package_type && (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase rounded-md border border-slate-200">
                                      {order.package_type}
                                    </span>
                                  )}
                                  {order.payment_method && (
                                    <span className={cn(
                                      "px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border",
                                      order.payment_method === 'sender' 
                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                        : "bg-amber-50 text-amber-600 border-amber-100"
                                    )}>
                                      {order.payment_method === 'sender' ? 'Gönderici Ödemeli' : 'Alıcı Ödemeli'}
                                    </span>
                                  )}
                                </div>
                                {order.special_request && (
                                  <p className="mt-2 text-xs bg-amber-50 text-amber-700 p-3 rounded-xl border border-amber-100 italic">
                                    <span className="font-bold not-italic">Not:</span> {order.special_request}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-2xl font-black text-indigo-600 self-start sm:self-auto">₺{getPrice(order.vehicle_type)}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl relative overflow-hidden">
                            <div className="flex gap-4">
                              <div className="bg-emerald-100 p-2 rounded-lg h-fit">
                                <MapPin className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Alış Adresi</p>
                                <p className="text-sm font-medium text-slate-700 leading-relaxed">{order.pickup_address}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-center justify-center py-2 border-y md:border-y-0 md:border-x border-slate-200">
                              <div className="flex items-center gap-2 text-indigo-600 mb-1">
                                <Navigation className="w-4 h-4 rotate-45" />
                                <span className="text-lg font-black">{order.distance || '?'} km</span>
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tahmini Mesafe</p>
                            </div>

                            <div className="flex gap-4">
                              <div className="bg-rose-100 p-2 rounded-lg h-fit">
                                <MapPinned className="w-4 h-4 text-rose-600" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Teslim Adresi</p>
                                <p className="text-sm font-medium text-slate-700 leading-relaxed">{order.delivery_address}</p>
                              </div>
                            </div>
                          </div>

                          {/* Map Preview for Pending Order */}
                          {(order.pickup_lat || order.delivery_lat) && (
                            <div className="h-48 rounded-2xl overflow-hidden border border-slate-100 shadow-inner">
                              <LeafletMapComponent 
                                pickupCoords={order.pickup_lat ? { lat: order.pickup_lat, lng: order.pickup_lng! } : undefined}
                                deliveryCoords={order.delivery_lat ? { lat: order.delivery_lat, lng: order.delivery_lng! } : undefined}
                              />
                            </div>
                          )}
                        </div>

                        <div className="md:w-48 flex flex-col justify-center">
                          <button 
                            onClick={() => handleAcceptOrder(order.id)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl shadow-lg shadow-indigo-100 transition-all"
                          >
                            Talebi Kabul Et
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {orders.filter(o => o.status !== 'pending' && o.status !== 'delivered' && o.status !== 'cancelled' && o.courier_id === myCourierId).map(order => (
                    <motion.div 
                      key={order.id}
                      className="bg-indigo-600 p-8 rounded-[2rem] shadow-xl text-white"
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-8">
                        <div className="flex-1 space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-4 rounded-2xl">
                              <Navigation className="w-7 h-7 text-white" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold">Aktif Teslimat</h3>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm text-white/60">Sipariş No: #{order.id}</p>
                                {order.vehicle_type && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white text-[9px] font-bold uppercase rounded-md border border-white/20">
                                    {React.createElement(getVehicleInfo(order.vehicle_type).icon, { className: "w-2.5 h-2.5" })}
                                    {getVehicleInfo(order.vehicle_type).label}
                                  </span>
                                )}
                                {order.payment_method && (
                                  <span className="px-2 py-0.5 bg-white/10 text-white text-[9px] font-bold uppercase rounded-md border border-white/20">
                                    {order.payment_method === 'sender' ? 'Gönderici Ödemeli' : 'Alıcı Ödemeli'}
                                  </span>
                                )}
                                {order.package_type && (
                                  <span className="px-2 py-0.5 bg-white/10 text-white text-[9px] font-bold uppercase rounded-md border border-white/20">
                                    {order.package_type}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 bg-white/20 text-white text-[9px] font-bold uppercase rounded-md border border-white/30">
                                  ₺{getPrice(order.vehicle_type)}
                                </span>
                              </div>
                              {order.special_request && (
                                <p className="mt-2 text-xs bg-white/10 text-white/90 p-3 rounded-xl border border-white/10 italic">
                                  <span className="font-bold not-italic">Not:</span> {order.special_request}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/10 p-6 rounded-2xl">
                            <div>
                              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Alış</p>
                              <p className="text-sm font-medium">{order.pickup_address}</p>
                            </div>
                            <div className="flex flex-col items-center justify-center py-2 border-y md:border-y-0 md:border-x border-white/10">
                              <div className="flex items-center gap-2 text-white mb-1">
                                <Navigation className="w-4 h-4 rotate-45" />
                                <span className="text-lg font-black">{order.distance || '?'} km</span>
                              </div>
                              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Mesafe</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Teslim</p>
                              <p className="text-sm font-medium">{order.delivery_address}</p>
                            </div>
                          </div>

                          {/* Integrated Map View for Courier */}
                          {(order.pickup_lat || order.delivery_lat) && (
                            <div className="h-64 rounded-2xl overflow-hidden border border-white/10 shadow-inner">
                              <LeafletMapComponent 
                                location={myLocation} 
                                pickupCoords={order.pickup_lat ? { lat: order.pickup_lat, lng: order.pickup_lng! } : undefined}
                                deliveryCoords={order.delivery_lat ? { lat: order.delivery_lat, lng: order.delivery_lng! } : undefined}
                                status={order.status}
                              />
                            </div>
                          )}
                        </div>

                        <div className="md:w-56 flex flex-col justify-center gap-3">
                          <div className="flex gap-2 mb-2">
                            {/* In a real app, we'd have customer phone here */}
                            {activeCustomer?.phone && (
                              <a 
                                href={`tel:${activeCustomer.phone}`}
                                className="p-3 bg-white text-indigo-600 rounded-2xl shadow-lg hover:bg-indigo-50 transition-all"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                          {order.status === 'accepted' && (
                            <>
                              <button 
                                onClick={() => handleNavigateFullRoute(order)}
                                className="w-full bg-indigo-100 text-indigo-700 font-bold py-4 rounded-2xl hover:bg-indigo-200 transition-all flex items-center justify-center gap-2 border border-indigo-200"
                              >
                                <TrendingUp className="w-5 h-5" />
                                Tam Rotayı Gör
                              </button>
                              <button 
                                onClick={() => handleNavigate(order.pickup_address)}
                                className="w-full bg-indigo-500 text-white font-bold py-4 rounded-2xl hover:bg-indigo-600 transition-all shadow-lg flex items-center justify-center gap-2"
                              >
                                <Navigation className="w-5 h-5" />
                                Navigasyon (Alış)
                              </button>
                              <button 
                                onClick={() => setConfirmModal({
                                  show: true,
                                  title: 'Paketi Aldınız mı?',
                                  message: 'Müşteriden paketi teslim aldığınızı onaylıyor musunuz?',
                                  onConfirm: () => {
                                    handleUpdateStatus(order.id, 'picked_up');
                                    setConfirmModal(prev => ({ ...prev, show: false }));
                                  }
                                })}
                                className="w-full bg-white text-indigo-600 font-bold py-4 rounded-2xl hover:bg-indigo-50 transition-all shadow-lg"
                              >
                                Paketi Aldım
                              </button>
                              <button 
                                onClick={() => handleCourierCancelOrder(order.id)}
                                className="w-full bg-rose-500/10 text-rose-500 font-bold py-4 rounded-2xl hover:bg-rose-500/20 transition-all border border-rose-500/20"
                              >
                                Talebi İptal Et
                              </button>
                            </>
                          )}
                          {order.status === 'picked_up' && (
                            <>
                              <button 
                                onClick={() => handleNavigateFullRoute(order)}
                                className="w-full bg-indigo-100 text-indigo-700 font-bold py-4 rounded-2xl hover:bg-indigo-200 transition-all flex items-center justify-center gap-2 border border-indigo-200"
                              >
                                <TrendingUp className="w-5 h-5" />
                                Tam Rotayı Gör
                              </button>
                              <button 
                                onClick={() => handleNavigate(order.delivery_address)}
                                className="w-full bg-indigo-500 text-white font-bold py-4 rounded-2xl hover:bg-indigo-600 transition-all shadow-lg flex items-center justify-center gap-2"
                              >
                                <Navigation className="w-5 h-5" />
                                Navigasyon (Teslim)
                              </button>
                              <button 
                                onClick={() => setConfirmModal({
                                  show: true,
                                  title: 'Teslimat Tamamlandı mı?',
                                  message: 'Paketi alıcıya başarıyla teslim ettiğinizi onaylıyor musunuz?',
                                  onConfirm: () => {
                                    handleUpdateStatus(order.id, 'delivered');
                                    setConfirmModal(prev => ({ ...prev, show: false }));
                                  }
                                })}
                                className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg"
                              >
                                Teslim Ettim
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length === 0 && (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <div className="bg-slate-100 p-8 rounded-full mb-6">
                      <Bell className="w-12 h-12 opacity-20" />
                    </div>
                    <p className="text-lg font-medium">Şu an aktif bir talep bulunmuyor.</p>
                    <p className="text-sm">Yeni talepler geldiğinde burada görünecektir.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Tamamlanan Teslimatlarınız</h2>
                <div className="grid grid-cols-1 gap-4">
                  {orders.filter(o => (o.status === 'delivered' || o.status === 'cancelled') && o.courier_id === myCourierId).map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-2xl", order.status === 'delivered' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                          {order.status === 'delivered' ? <CheckCircle2 className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="font-bold">{order.customer_name}</p>
                          <p className="text-xs text-slate-400">#{order.id} • {new Date(order.created_at).toLocaleDateString('tr-TR')}</p>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-600 line-clamp-1"><span className="font-bold">Alış:</span> {order.pickup_address}</p>
                        <p className="text-sm text-slate-600 line-clamp-1"><span className="font-bold">Teslim:</span> {order.delivery_address}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="bg-indigo-50 p-4 rounded-full">
                  <HelpCircle className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{confirmModal.title}</h3>
                  <p className="text-sm text-slate-500 mt-2">{confirmModal.message}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full pt-4">
                  <button 
                    onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                    className="py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Hayır
                  </button>
                  <button 
                    onClick={confirmModal.onConfirm}
                    className="py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                  >
                    Evet
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPriceModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4">
                  <CreditCard className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold">Sipariş Özeti</h3>
                <p className="text-slate-500 text-sm">Lütfen ödeme detaylarını onaylayın.</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-500 text-sm">Hizmet Bedeli</span>
                  <span className="text-xl font-black text-indigo-600">₺{getPrice(vehicleType)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {React.createElement(getVehicleInfo(vehicleType).icon, { className: "w-3 h-3" })}
                    {getVehicleInfo(vehicleType).label}
                  </div>
                  <div className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-bold uppercase rounded-md">
                    {packageType}
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Ödeme Yöntemi</p>
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => setPaymentMethod('sender')}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                      paymentMethod === 'sender' ? "bg-indigo-50 border-indigo-600 text-indigo-600" : "bg-white border-slate-100 text-slate-500"
                    )}
                  >
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", paymentMethod === 'sender' ? "border-indigo-600" : "border-slate-200")}>
                      {paymentMethod === 'sender' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}
                    </div>
                    <span className="font-bold text-sm">Ben ödeyeceğim</span>
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('receiver')}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                      paymentMethod === 'receiver' ? "bg-indigo-50 border-indigo-600 text-indigo-600" : "bg-white border-slate-100 text-slate-500"
                    )}
                  >
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", paymentMethod === 'receiver' ? "border-indigo-600" : "border-slate-200")}>
                      {paymentMethod === 'receiver' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}
                    </div>
                    <span className="font-bold text-sm">Alıcı ödeyecek</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleConfirmOrder}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all"
                >
                  Onayla ve Çağır
                </button>
                <button 
                  onClick={() => setShowPriceModal(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all"
                >
                  Vazgeç
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showCallModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center"
            >
              {!activeCustomer ? (
                <div className="py-12 flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-500 font-medium">Müşteri bilgileri alınıyor...</p>
                  <button 
                    onClick={() => setShowCallModal(false)}
                    className="mt-4 text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Kapat
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-6">
                    <Phone className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Müşteriyi Ara</h3>
                  <p className="text-slate-500 mb-8">
                    Talebi kabul ettiniz. Lütfen teslimat detaylarını teyit etmek için <span className="font-bold text-slate-900">{activeCustomer.full_name || activeCustomer.email}</span> isimli müşteriyi arayın.
                  </p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {activeCustomer.phone ? (
                      <a 
                        href={`tel:${activeCustomer.phone}`}
                        onClick={() => setShowCallModal(false)}
                        className="flex items-center justify-center gap-3 bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                      >
                        <Phone className="w-5 h-5" />
                        Şimdi Ara ({activeCustomer.phone})
                      </a>
                    ) : (
                      <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl text-sm mb-4">
                        Müşterinin telefon numarası kayıtlı değil.
                      </div>
                    )}
                    <button 
                      onClick={() => setShowCallModal(false)}
                      className="py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                    >
                      Kapat
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
