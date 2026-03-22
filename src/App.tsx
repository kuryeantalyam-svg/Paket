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
  Dog,
  Mail,
  Send,
  Zap,
  ExternalLink,
  Instagram,
  Facebook,
  Twitter,
  Utensils,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { 
  PushNotifications, 
  PushNotificationSchema, 
  Token, 
  ActionPerformed 
} from '@capacitor/push-notifications';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline, Circle } from 'react-leaflet';
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

const API_BASE_URL = Capacitor.isNativePlatform() 
  ? (import.meta.env.DEV 
      ? 'https://ais-dev-cpjafxtnmg27szq65cbjcm-5052813439.europe-west2.run.app' 
      : 'https://ais-pre-cpjafxtnmg27szq65cbjcm-5052813439.europe-west2.run.app')
  : '';

const ANTALYA_COORDS: [number, number] = [36.8841, 30.7056];

const getPackageLabel = (type: string) => {
  const labels: Record<string, string> = {
    'dosya': 'Dosya / Evrak',
    'paket': 'Küçük Paket',
    'koli': 'Koli / Kutu',
    'yedek_parca': 'Yedek Parça',
    'tibbi': 'Tıbbi Malzeme',
    'yemek': 'Yemek / Gıda',
    'cicek': 'Çiçek / Hediye',
    'ev_esyasi': 'Ev Eşyası',
    'petshop': 'Petshop / Mama',
    'diger': 'Diğer'
  };
  return labels[type] || type;
};

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
  courierName?: string;
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

interface SavedAddress {
  id: string;
  user_id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
}

type AppRole = 'customer' | 'courier' | 'admin';

function MapController({ center, zoom }: { center: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (zoom) {
      map.setView(center, zoom);
    } else {
      map.panTo(center, { animate: true, duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
}

async function geocode(address: string) {
  try {
    const allowedDistricts = ['Konyaaltı', 'Muratpaşa', 'Kepez', 'Döşemealtı'];
    // Nominatim search with addressdetails to get structured data
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ", Antalya")}&addressdetails=1&limit=5`);
    const data = await res.json();
    
    if (data && data.length > 0) {
      // Filter results to only include allowed districts in Antalya
      const filtered = data.filter((item: any) => {
        const addr = item.address;
        const district = addr.town || addr.city_district || addr.suburb || addr.district || '';
        const city = addr.province || addr.city || '';
        
        const isAntalya = city.toLocaleLowerCase('tr-TR').includes('antalya');
        const isAllowedDistrict = allowedDistricts.some(d => 
          district.toLocaleLowerCase('tr-TR').includes(d.toLocaleLowerCase('tr-TR'))
        );
        
        return isAntalya && isAllowedDistrict;
      });

      const result = filtered.length > 0 ? filtered[0] : data[0];

      return { 
        lat: parseFloat(result.lat), 
        lng: parseFloat(result.lon),
        displayName: result.display_name
      };
    }
  } catch (e) {
    console.error("Geocoding error:", e);
  }
  return null;
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    // zoom=18 for house number precision
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await res.json();
    if (data) {
      const addr = data.address;
      if (addr) {
        const parts = [];
        // Turkish address format: Road/Street, House Number, Neighbourhood, District, City
        if (addr.road) parts.push(addr.road);
        if (addr.house_number) {
          parts.push(`No: ${addr.house_number}`);
        } else if (addr.house_name) {
          parts.push(addr.house_name);
        }
        
        if (addr.suburb) parts.push(addr.suburb);
        if (addr.neighbourhood && addr.neighbourhood !== addr.suburb) parts.push(addr.neighbourhood);
        if (addr.town || addr.city || addr.district) parts.push(addr.town || addr.city || addr.district);
        
        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
      return data.display_name;
    }
  } catch (e) {
    console.error("Reverse geocoding error:", e);
  }
  return null;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return parseFloat(d.toFixed(1));
}

const CourierIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="relative">
           <div class="absolute -inset-4 bg-indigo-500/20 rounded-full animate-ping"></div>
           <div class="w-10 h-10 bg-indigo-600 rounded-2xl shadow-lg border-2 border-white flex items-center justify-center">
             <div class="text-white">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bike"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
             </div>
           </div>
         </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
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

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

const PickupMarkerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="relative">
           <div class="w-10 h-10 bg-blue-600 rounded-2xl shadow-xl border-2 border-white flex items-center justify-center transform -rotate-45">
             <div class="text-white transform rotate-45">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
             </div>
           </div>
           <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-lg uppercase whitespace-nowrap border border-white/20">Alış Noktası</div>
         </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const DeliveryMarkerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="relative">
           <div class="w-10 h-10 bg-rose-600 rounded-2xl shadow-xl border-2 border-white flex items-center justify-center transform -rotate-45">
             <div class="text-white transform rotate-45">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
             </div>
           </div>
           <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-lg uppercase whitespace-nowrap border border-white/20">Teslim Noktası</div>
         </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function AddressPickerMap({ 
  onLocationSelect, 
  pickupCoords,
  deliveryCoords,
  activeField
}: { 
  onLocationSelect: (lat: number, lng: number, address: string) => void,
  pickupCoords?: { lat: number, lng: number } | null,
  deliveryCoords?: { lat: number, lng: number } | null,
  activeField: 'pickup' | 'delivery'
}) {
  const map = useMap();

  useEffect(() => {
    const activeCoords = activeField === 'pickup' ? pickupCoords : deliveryCoords;
    if (activeCoords) {
      map.flyTo([activeCoords.lat, activeCoords.lng], 16, { duration: 1.5 });
    } else if (pickupCoords && deliveryCoords) {
      const bounds = L.latLngBounds([
        [pickupCoords.lat, pickupCoords.lng],
        [deliveryCoords.lat, deliveryCoords.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [activeField, pickupCoords, deliveryCoords, map]);

  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      const address = await reverseGeocode(lat, lng);
      if (address) {
        onLocationSelect(lat, lng, address);
      }
    },
  });

  return (
    <>
      {pickupCoords && (
        <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={PickupMarkerIcon}>
          <Popup>Alış Adresi</Popup>
        </Marker>
      )}
      {deliveryCoords && (
        <Marker position={[deliveryCoords.lat, deliveryCoords.lng]} icon={DeliveryMarkerIcon}>
          <Popup>Teslim Adresi</Popup>
        </Marker>
      )}
    </>
  );
}

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
  const [followCourier, setFollowCourier] = useState(true);
  const mapRef = useRef<L.Map | null>(null);
  const [hasFitBounds, setHasFitBounds] = useState(false);
  
  // Calculate center based on available points
  const center = useMemo(() => {
    if (location && followCourier) return [location.lat, location.lng] as [number, number];
    if (allLocations.length > 0) return [allLocations[0].lat, allLocations[0].lng] as [number, number];
    if (pickupCoords) return [pickupCoords.lat, pickupCoords.lng] as [number, number];
    if (deliveryCoords) return [deliveryCoords.lat, deliveryCoords.lng] as [number, number];
    return ANTALYA_COORDS;
  }, [location, allLocations, pickupCoords, deliveryCoords, followCourier]);

  const handleFitBounds = () => {
    const pts: L.LatLngExpression[] = [];
    if (location) pts.push([location.lat, location.lng]);
    if (pickupCoords) pts.push([pickupCoords.lat, pickupCoords.lng]);
    if (deliveryCoords) pts.push([deliveryCoords.lat, deliveryCoords.lng]);
    
    // Add all locations if no specific location is being followed
    if (!location && locations.length > 0) {
      locations.forEach(loc => pts.push([loc.lat, loc.lng]));
    }
    
    if (pts.length > 0 && mapRef.current) {
      if (pts.length === 1) {
        mapRef.current.setView(pts[0], 15);
      } else {
        const bounds = L.latLngBounds(pts);
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
      setFollowCourier(false);
    }
  };

  // Auto fit bounds on first load of locations
  useEffect(() => {
    if (!hasFitBounds && allLocations.length > 0 && mapRef.current) {
      handleFitBounds();
      setHasFitBounds(true);
    }
  }, [allLocations.length, hasFitBounds]);

  return (
    <div className="h-full w-full rounded-3xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 relative group">
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        ref={(m) => { if (m) mapRef.current = m; }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {location && followCourier && <RecenterMap center={center} />}
        
        {/* Polyline to destination */}
        {location && (status === 'accepted' || status === 'picked_up') && (
          <>
            {((status === 'accepted' && pickupCoords) || (status === 'picked_up' && deliveryCoords)) && (
              <>
                <Polyline 
                  positions={[
                    [location.lat, location.lng],
                    status === 'accepted' ? [pickupCoords!.lat, pickupCoords!.lng] : [deliveryCoords!.lat, deliveryCoords!.lng]
                  ]}
                  color="#4f46e5"
                  weight={3}
                  dashArray="10, 10"
                  opacity={0.6}
                />
                <Circle 
                  center={status === 'accepted' ? [pickupCoords!.lat, pickupCoords!.lng] : [deliveryCoords!.lat, deliveryCoords!.lng]}
                  radius={100}
                  pathOptions={{ color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.1 }}
                />
              </>
            )}
          </>
        )}

        {/* Courier Markers */}
        {allLocations.map((loc, idx) => (
          <Marker key={loc.courierId || idx} position={[loc.lat, loc.lng]} icon={CourierIcon}>
            <Popup className="custom-popup">
              <div className="p-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <p className="font-bold text-indigo-600 text-xs">Kurye: {loc.courierName || loc.courierId}</p>
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
      
      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button 
          onClick={() => setFollowCourier(!followCourier)}
          className={cn(
            "p-3 rounded-2xl shadow-lg border backdrop-blur-md transition-all",
            followCourier ? "bg-indigo-600 text-white border-indigo-500" : "bg-white/90 text-slate-600 border-white/20 hover:bg-white"
          )}
          title={followCourier ? "Takibi Bırak" : "Kuryeyi Takip Et"}
        >
          <Navigation className={cn("w-5 h-5", followCourier && "animate-pulse")} />
        </button>
        <button 
          onClick={handleFitBounds}
          className="p-3 bg-white/90 text-slate-600 rounded-2xl shadow-lg border border-white/20 backdrop-blur-md hover:bg-white transition-all"
          title="Tümünü Göster"
        >
          <Eye className="w-5 h-5" />
        </button>
      </div>

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

function CourierApplicationScreen({ onBack, onLogin }: { onBack: () => void, onLogin: (user: UserAccount) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(API_BASE_URL + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'courier', fullName, phone })
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data);
      } else {
        setError(data.error || 'Bir hata oluştu');
      }
    } catch (err) {
      setError('Sunucuya bağlanılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-10 lg:p-16 bg-indigo-600 text-white flex flex-col justify-center">
            <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-8">
              <Bike className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black mb-6 leading-tight">Antalya'nın Kurye Ağına Katıl!</h1>
            <p className="text-indigo-100 text-lg mb-8 leading-relaxed">
              Başka bir firmada çalışıyor olsanız bile, Antalya Teslimat üzerinden gelen ek taleplerle boş vakitlerinizi kazanca dönüştürebilirsiniz.
            </p>
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="font-bold">Esnek Çalışma Saatleri</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="font-bold">Anında Ödeme İmkanı</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="font-bold">Ek İş Olarak Yapabilme</span>
              </div>
            </div>


          </div>
          <div className="p-10 lg:p-16">
            <h2 className="text-2xl font-bold mb-6">Hemen Başvur</h2>
            
            <form className="space-y-4" onSubmit={handleSubmit}>
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

              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    required
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all"
                  />
                  <span className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-700 transition-colors">
                    Bağımsız Hizmet Sağlayıcı Sözleşmesi ve KVKK Aydınlatma Metni'ni okudum, onaylıyorum.
                  </span>
                </label>
              </div>

              {error && <p className="text-rose-500 text-xs font-bold text-center">{error}</p>}

              <button 
                type="submit" 
                disabled={loading || !agreedToTerms}
                className={cn(
                  "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all mt-4 flex items-center justify-center gap-2",
                  (loading || !agreedToTerms) && "opacity-50 cursor-not-allowed"
                )}
              >
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Hemen Kayıt Ol'}
              </button>
              <button type="button" onClick={onBack} className="w-full text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors">
                Geri Dön
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AuthScreen({ onLogin, expectedRole, onAdminTrigger, onCourierApplication }: { onLogin: (user: UserAccount) => void, expectedRole: AppRole, onAdminTrigger: () => void, onCourierApplication: () => void }) {
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

  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [adminClickCount, setAdminClickCount] = useState(0);

  useEffect(() => {
    setRole(expectedRole);
  }, [expectedRole]);

  const handleHiddenClick = () => {
    if (isLogin) {
      const newCount = adminClickCount + 1;
      setAdminClickCount(newCount);
      if (newCount >= 5) {
        onAdminTrigger();
        setAdminClickCount(0);
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordMessage(null);
    try {
      const res = await fetch(API_BASE_URL + '/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotPasswordMessage({ type: 'success', text: data.message });
        setTimeout(() => {
          setShowForgotPasswordModal(false);
          setForgotPasswordMessage(null);
          setForgotPasswordEmail('');
        }, 3000);
      } else {
        setForgotPasswordMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setForgotPasswordMessage({ type: 'error', text: 'Sunucuya bağlanılamadı' });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? API_BASE_URL + '/api/auth/login' : API_BASE_URL + '/api/auth/register';
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
          const roleLabels: Record<string, string> = {
            'customer': 'Müşteri',
            'courier': 'Kurye',
            'business': 'İşletme'
          };
          setError(`Bu hesap ${roleLabels[data.role] || data.role} rolüne ait. Lütfen doğru rolü seçin.`);
          return;
        }
        onLogin(data);
      } else {
        setError(data.error || 'Bir hata oluştu');
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(`Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin. (Hedef: ${endpoint})`);
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
          {/* SEO Content Section */}
          <div className="hidden lg:block space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-indigo-100/20">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Antalya'nın Her Yerine Güvenli Teslimat</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Antalya Dosya Gönder & Paket</h3>
                    <p className="text-sm text-slate-500 mt-1">Antalya içinde dosya gönder ve paketlerinizi dakikalar içinde alıyor, hedef adrese en hızlı şekilde ulaştırıyoruz.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Antalya Kurye Bul & Çağır</h3>
                    <p className="text-sm text-slate-500 mt-1">Hızlıca Antalya kurye bul, tek tıkla kurye çağır, gönderini kapından teslim alalım.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shrink-0">
                    <Dog className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Antalya Pet Taxi</h3>
                    <p className="text-sm text-slate-500 mt-1">Evcil dostlarınız için güvenli Antalya pet taxi hizmeti. Konforlu ve güvenli ulaşım.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                    <Utensils className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Antalya Yemek Gönder</h3>
                    <p className="text-sm text-slate-500 mt-1">Sıcak ve taze Antalya yemek gönder hizmeti ile restoran lezzetleri kapınızda.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-600 p-6 rounded-3xl text-white">
                <p className="text-3xl font-black">30dk</p>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Ortalama Teslimat</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-3xl text-white">
                <p className="text-3xl font-black">7/24</p>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Kesintisiz Hizmet</p>
              </div>
            </div>
          </div>

          {/* Auth Form */}
          <div className="flex justify-center">
            <div className="w-full max-w-md relative overflow-visible">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-slate-200 w-full"
              >
              <div className="flex flex-col items-center mb-8">
                <div className="bg-indigo-600 p-4 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <h1 
                  onClick={handleHiddenClick}
                  className="text-2xl font-bold tracking-tight cursor-default select-none"
                >
                  Antalya Teslimat
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  {isLogin ? 'Hesabınıza giriş yapın' : 'Yeni hesap oluşturun'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        {role === 'business' ? 'İşletme Adı' : 'Ad Soyad'}
                      </label>
                      <input 
                        type="text" 
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder={role === 'business' ? "İşletme Adı Giriniz" : "Ahmet Yılmaz"}
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
                  {isLogin && (
                    <div className="flex justify-end mt-2">
                      <button 
                        type="button"
                        onClick={() => setShowForgotPasswordModal(true)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        Şifremi Unuttum
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Rolünüz</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      type="button"
                      onClick={() => setRole('customer')}
                      className={cn(
                        "py-3 rounded-xl text-xs font-bold border transition-all",
                        role === 'customer' ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500"
                      )}
                    >
                      Müşteri
                    </button>
                    <button 
                      type="button"
                      onClick={() => setRole('courier')}
                      className={cn(
                        "py-3 rounded-xl text-xs font-bold border transition-all",
                        role === 'courier' ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500"
                      )}
                    >
                      Kurye
                    </button>
                    <button 
                      type="button"
                      onClick={() => setRole('business')}
                      className={cn(
                        "py-3 rounded-xl text-xs font-bold border transition-all",
                        role === 'business' ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500"
                      )}
                    >
                      İşletme
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
                        {(role === 'customer' || role === 'business') ? (
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

              <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-4">
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm font-bold text-indigo-600 hover:text-indigo-700 block w-full"
                >
                  {isLogin ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
                </button>
                <button 
                  onClick={onCourierApplication}
                  className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  Kurye Olmak mı İstiyorsunuz? Başvuru Yapın
                </button>
              </div>
            </motion.div>
          </div>
        </div>

          <AnimatePresence>
            {showForgotPasswordModal && (
              <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100"
                >
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-4">
                      <Mail className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold">Şifremi Unuttum</h3>
                    <p className="text-slate-500 text-sm">E-posta adresinizi girin, size bir sıfırlama bağlantısı gönderelim.</p>
                  </div>

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">E-posta</label>
                      <input 
                        type="email" 
                        required
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="ornek@mail.com"
                      />
                    </div>

                    {forgotPasswordMessage && (
                      <p className={cn(
                        "text-xs font-bold text-center p-3 rounded-xl",
                        forgotPasswordMessage.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {forgotPasswordMessage.text}
                      </p>
                    )}

                    <div className="flex flex-col gap-3">
                      <button 
                        type="submit"
                        disabled={forgotPasswordLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                      >
                        {forgotPasswordLoading ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : 'Bağlantı Gönder'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setShowForgotPasswordModal(false);
                          setForgotPasswordMessage(null);
                        }}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Marketing Content (Services Grid) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            {/* Trust Statistics Section */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                <p className="text-2xl font-black text-indigo-600">5000+</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teslimat</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                <p className="text-2xl font-black text-indigo-600">600+</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kurye</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                <div className="flex justify-center mb-1">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kurumsal Müşteriler</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { 
                  icon: Wrench, 
                  title: "Sanayi", 
                  desc: "Yedek parça temini.",
                  color: "bg-amber-50 text-amber-600",
                  href: "/sanayi-kurye-antalya"
                },
                { 
                  icon: Stethoscope, 
                  title: "Diş Klinik", 
                  desc: "Laboratuvar gönderileri.",
                  color: "bg-emerald-50 text-emerald-600",
                  href: "/acil-kurye-antalya"
                },
                { 
                  icon: ShoppingBag, 
                  title: "Petshop", 
                  desc: "Hızlı mama & aksesuar.",
                  color: "bg-orange-50 text-orange-600",
                  href: "/antalya-paket-gonder"
                },
                { 
                  icon: Flower2, 
                  title: "Çiçek", 
                  desc: "Hassas çiçek teslimatı.",
                  color: "bg-pink-50 text-pink-600",
                  href: "/moto-kurye-antalya"
                },
                { 
                  icon: Dog, 
                  title: "Pet Taxi", 
                  desc: "Veteriner ulaşımı.",
                  color: "bg-indigo-50 text-indigo-600",
                  href: "/moto-kurye-antalya"
                },
                { 
                  icon: Package, 
                  title: "Acil Paket", 
                  desc: "Şehir içi hızlı evrak.",
                  color: "bg-rose-50 text-rose-600",
                  href: "/acil-kurye-antalya"
                }
              ].map((item, i) => (
                <motion.a 
                  key={i}
                  href={item.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className={cn("p-2 rounded-xl shrink-0", item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                    <p className="text-[10px] text-slate-500 leading-tight">{item.desc}</p>
                  </div>
                </motion.a>
              ))}
            </div>

            {/* Service Areas Section */}
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-sm">Hizmet Bölgelerimiz</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Lara Kurye', 'Konyaaltı Kurye', 'Kepez Kurye', 'Muratpaşa Kurye', 'Döşemealtı Kurye'].map((area) => (
                  <span key={area} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 shadow-sm">
                    {area}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-4 italic">Antalya'nın her noktasına 30 dakikada teslimat garantisi.</p>
            </div>

            {/* FAQ Section */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h4 className="text-xl font-bold text-slate-900">Sıkça Sorulan Sorular</h4>
              </div>
              
              <div className="space-y-6">
                {[
                  {
                    q: "Antalya Teslimat ile ne kadar sürede teslimat yapılır?",
                    a: "Antalya şehir içi gönderileriniz, kuryemiz paketi teslim aldıktan sonra ortalama 30-45 dakika içerisinde alıcıya ulaştırılır."
                  },
                  {
                    q: "Hangi gönderiler taşınmaz?",
                    a: "Yasal olarak taşınması yasak olan maddeler, yanıcı/patlayıcı maddeler ve nakit para taşıması yapılmamaktadır."
                  },
                  {
                    q: "Ödemeyi nasıl yapabilirim?",
                    a: "Ödemeyi gönderici ödemeli veya alıcı ödemeli olarak nakit veya banka transferi (EFT/Havale) ile yapabilirsiniz."
                  }
                ].map((faq, i) => (
                  <div key={i} className="group">
                    <p className="font-bold text-slate-900 mb-2 flex items-start gap-2">
                      <span className="text-indigo-600">Q.</span> {faq.q}
                    </p>
                    <p className="text-sm text-slate-500 pl-6 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer Section */}
        <footer className="bg-white border-t border-slate-100 pt-16 pb-8 mt-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
              <div className="col-span-1 md:col-span-1">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Package className="w-6 h-6" />
                  </div>
                  <span className="text-xl font-black tracking-tighter text-slate-900">Antalya Teslimat</span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Antalya'nın en akıllı kurye takip sistemi. 7/24 hızlı, güvenilir ve profesyonel moto kurye çözümleri.
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-slate-900 mb-6">Hizmetlerimiz</h4>
                <ul className="space-y-4 text-sm text-slate-500">
                  <li><a href="/moto-kurye-antalya" className="hover:text-indigo-600 transition-colors">Moto Kurye</a></li>
                  <li><a href="/acil-kurye-antalya" className="hover:text-indigo-600 transition-colors">Acil Kurye</a></li>
                  <li><a href="/sanayi-kurye-antalya" className="hover:text-indigo-600 transition-colors">Sanayi Kuryesi</a></li>
                  <li><a href="/eczane-kurye-antalya" className="hover:text-indigo-600 transition-colors">Eczane Kuryesi</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-6">Kurumsal</h4>
                <ul className="space-y-4 text-sm text-slate-500">
                  <li><a href="/hakkimizda" className="hover:text-indigo-600 transition-colors">Hakkımızda</a></li>
                  <li><button onClick={() => setShowTermsModal({ show: true, type: 'terms' })} className="hover:text-indigo-600 transition-colors">Kullanım Koşulları</button></li>
                  <li><button onClick={() => setShowTermsModal({ show: true, type: 'kvkk' })} className="hover:text-indigo-600 transition-colors">KVKK</button></li>
                  <li><a href="/iletisim" className="hover:text-indigo-600 transition-colors">İletişim</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-6">İletişim</h4>
                <ul className="space-y-4 text-sm text-slate-500">
                  <li className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    <span>0850 304 93 14</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <span>kuryeantalyam@gmail.com</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    <span>Antalya, Türkiye</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="pt-8 border-t border-slate-100 flex flex-col md:row items-center justify-between gap-4">
              <p className="text-xs text-slate-400">© 2026 Antalya Teslimat. Tüm hakları saklıdır.</p>
              <div className="flex items-center gap-6">
                <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><Instagram className="w-5 h-5" /></a>
                <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><Facebook className="w-5 h-5" /></a>
                <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><Twitter className="w-5 h-5" /></a>
              </div>
            </div>
          </div>
        </footer>


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
                      <p>İşbu sözleşme, Antalya Teslimat platformu ile platform üzerinden hizmet alan Müşteri arasında akdedilmiştir.</p>
                      <p className="font-bold text-slate-900">2. Hizmetin Niteliği</p>
                      <p>Antalya Teslimat, kuryeler ile müşterileri bir araya getiren bir teknoloji platformudur. Antalya Teslimat, taşıma hizmetinin bizzat sağlayıcısı değildir.</p>
                      <p className="font-bold text-slate-900">3. Sorumluluk Sınırları</p>
                      <p>Müşteri, gönderinin içeriğinden ve yasalara uygunluğundan sorumludur. Antalya Teslimat, kurye tarafından sunulan hizmetin kalitesi veya ifası ile ilgili doğrudan sorumluluk kabul etmez.</p>
                    </>
                  )}
                  {showTermsModal.type === 'kvkk' && (
                    <>
                      <p className="font-bold text-slate-900">1. Veri Sorumlusu</p>
                      <p>Antalya Teslimat olarak kişisel verilerinizin güvenliğine önem veriyoruz.</p>
                      <p className="font-bold text-slate-900">2. İşlenen Veriler</p>
                      <p>Ad, soyad, telefon numarası, e-posta adresi ve konum verileriniz hizmetin ifası amacıyla işlenmektedir.</p>
                      <p className="font-bold text-slate-900">3. İşleme Amacı</p>
                      <p>Verileriniz, kurye taleplerinizin yönetilmesi, güvenli teslimatın sağlanması ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir.</p>
                    </>
                  )}
                  {showTermsModal.type === 'courier' && (
                    <>
                      <p className="font-bold text-slate-900">1. Bağımsız Statü</p>
                      <p>Kurye, Antalya Teslimat'ın bir çalışanı veya temsilcisi değildir. Kurye, kendi nam ve hesabına çalışan bağımsız bir hizmet sağlayıcıdır.</p>
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
  const [view, setView] = useState<'active' | 'history' | 'addresses' | 'earnings' | 'mobile-app'>('active');
  const [earningsData, setEarningsData] = useState<{
    totalEarnings: number;
    deliveriesCount: number;
    breakdown: any[];
  } | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [onlineCouriers, setOnlineCouriers] = useState(0);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(() => {
    const saved = localStorage.getItem('smartpack_active_order');
    return saved ? JSON.parse(saved) : null;
  });
  const activeOrderRef = useRef<Order | null>(null);

  const [isCourierApplicationPage, setIsCourierApplicationPage] = useState(false);

  // Push Notifications Setup
  useEffect(() => {
    if (Capacitor.isNativePlatform() && role === 'courier' && user) {
      // Request permission to use push notifications
      PushNotifications.requestPermissions().then(result => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });

      // On success, we should be able to receive notifications
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token: ' + token.value);
        // Send the token to your server
        fetch(`${API_BASE_URL}/api/auth/fcm-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, token: token.value })
        }).catch(err => console.error("Failed to save FCM token:", err));
      });

      // Some error occurred
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      // Show us the notification payload if the app is open on our device
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Push received: ' + JSON.stringify(notification));
      });

      // Method called when tapping on a notification
      PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('Push action performed: ' + JSON.stringify(action));
      });

      return () => {
        PushNotifications.removeAllListeners();
      };
    }
  }, [role, user]);

  // URL Path Handling for SEO and Deep Linking
  useEffect(() => {
    const path = window.location.pathname;
    let title = "Antalya Teslimat - Kurye Çağır | Paket Gönder";
    
    if (path === '/kuryebasvuru') {
      setIsCourierApplicationPage(true);
      title = "Kurye Başvurusu - Antalya Teslimat";
    } else if (path === '/kurye-basvurusu') {
      setRole('courier');
      title = "Kurye Başvurusu - Antalya Teslimat";
    } else if (path === '/musteri-girisi') {
      setRole('customer');
      title = "Müşteri Girişi - Antalya Teslimat";
    } else if (path === '/moto-kurye-antalya') {
      title = "Antalya Moto Kurye Hizmetleri - Antalya Teslimat";
    } else if (path === '/acil-kurye-antalya') {
      title = "Antalya Acil Kurye | 30 Dakikada Teslimat";
    } else if (path === '/hakkimizda') {
      title = "Hakkımızda - Antalya Teslimat";
    }
    
    document.title = title;
  }, []);

  useEffect(() => {
    if (role === 'admin') {
      document.title = "Yönetici Paneli - Antalya Teslimat";
    } else if (role === 'courier') {
      document.title = "Kurye Paneli - Antalya Teslimat";
    } else if (role === 'business') {
      document.title = "Kurumsal Panel - Antalya Teslimat";
    }
  }, [role]);
  
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
    
    if (activeOrder && prevStatus && activeOrder.status !== prevStatus) {
      setShowStatusAnim(true);
      const timer = setTimeout(() => setShowStatusAnim(false), 4000);
      return () => clearTimeout(timer);
    }
    
    if (activeOrder) {
      setPrevStatus(activeOrder.status);
    } else {
      setPrevStatus(null);
    }
  }, [activeOrder?.status]);

  const getStatusLabel = (status?: OrderStatus) => {
    switch (status) {
      case 'pending': return 'Bekliyor';
      case 'accepted': return 'Kabul Edildi';
      case 'picked_up': return 'Yolda';
      case 'delivered': return 'Teslim Edildi';
      case 'cancelled': return 'İptal Edildi';
      default: return 'Bilinmiyor';
    }
  };

  const [courierLocation, setCourierLocation] = useState<CourierLocation | null>(null);
  const [allCourierLocations, setAllCourierLocations] = useState<CourierLocation[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number, lng: number } | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [activePickingField, setActivePickingField] = useState<'pickup' | 'delivery' | null>(null);
  const lastMapAddressRef = useRef<{ pickup: string, delivery: string }>({ pickup: '', delivery: '' });
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [packageType, setPackageType] = useState('Dosya / Evrak');
  const [specialRequest, setSpecialRequest] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'sender' | 'receiver'>('sender');
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [currentDistance, setCurrentDistance] = useState<number>(0);
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
  const [showMap, setShowMap] = useState(true);
  const [showCallModal, setShowCallModal] = useState(false);
  const [activeCourier, setActiveCourier] = useState<UserAccount | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<UserAccount | null>(null);
  const [prevStatus, setPrevStatus] = useState<OrderStatus | null>(null);
  const [showStatusAnim, setShowStatusAnim] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showSavedAddressesModal, setShowSavedAddressesModal] = useState<{ show: boolean, target: 'pickup' | 'delivery' }>({ show: false, target: 'pickup' });

  // Debounced geocoding for pickup address
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (pickup && pickup.length > 5 && pickup !== lastMapAddressRef.current.pickup) {
        const coords = await geocode(pickup);
        if (coords) setPickupCoords(coords);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [pickup]);

  // Debounced geocoding for delivery address
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (delivery && delivery.length > 5 && delivery !== lastMapAddressRef.current.delivery) {
        const coords = await geocode(delivery);
        if (coords) setDeliveryCoords(coords);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [delivery]);

  const [saveAddressChecked, setSaveAddressChecked] = useState({ pickup: false, delivery: false });
  const [addressTitle, setAddressTitle] = useState({ pickup: '', delivery: '' });
  const watchIdRef = useRef<number | null>(null);

  const SavedAddressesModal = () => {
    if (!showSavedAddressesModal.show) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Kayıtlı Adreslerim</h3>
              <p className="text-xs text-slate-500 mt-1">Lütfen bir adres seçin</p>
            </div>
            <button 
              onClick={() => setShowSavedAddressesModal({ show: false, target: 'pickup' })}
              className="p-3 hover:bg-white rounded-2xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
            {savedAddresses.length > 0 ? (
              savedAddresses.map((addr) => (
                <div 
                  key={addr.id}
                  className="group relative bg-white border border-slate-200 p-5 rounded-2xl hover:border-indigo-600 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    if (showSavedAddressesModal.target === 'pickup') {
                      setPickup(addr.address);
                    } else {
                      setDelivery(addr.address);
                    }
                    setShowSavedAddressesModal({ show: false, target: 'pickup' });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1 pr-8">
                      <p className="font-bold text-slate-900">{addr.title}</p>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{addr.address}</p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSavedAddress(addr.id);
                      }}
                      className="absolute right-4 top-4 p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      title="Sil"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-400 text-sm italic">Henüz kayıtlı bir adresiniz bulunmuyor.</p>
              </div>
            )}
          </div>
          <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end">
            <button 
              onClick={() => setShowSavedAddressesModal({ show: false, target: 'pickup' })}
              className="px-8 py-3 bg-white text-slate-600 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all"
            >
              Kapat
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const [logoClicks, setLogoClicks] = useState(0);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState(false);
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
    if (user && (user.role === 'customer' || user.role === 'business')) {
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
    const protocol = API_BASE_URL ? (API_BASE_URL.startsWith('https') ? 'wss:' : 'ws:') : (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    const socket = new WebSocket(`${protocol}//${API_BASE_URL ? API_BASE_URL.replace(/^https?:\/\//, '') : window.location.host}`);
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
      try {
        const data = JSON.parse(event.data);
        if (!data || !data.type) return;

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
          setAllCourierLocations(prev => {
            const exists = prev.some(l => l.courierId === data.courierId);
            if (exists) {
              return prev.map(l => l.courierId === data.courierId ? data : l);
            }
            return [...prev, data];
          });

          const currentOrder = activeOrderRef.current;
          const isAssignedCourier = currentOrder?.courier_id === data.courierId;
          const isPendingOrder = currentOrder?.status === 'pending';
          
          if (isAssignedCourier || (isPendingOrder && !currentOrder?.courier_id)) {
            setCourierLocation(data);
          }
        } else if (data.type === 'courier_offline') {
          setAllCourierLocations(prev => prev.filter(l => l.courierId !== data.courierId));
          if (courierLocation?.courierId === data.courierId) {
            setCourierLocation(null);
          }
        } else if (data.type === 'order_updated') {
          if (!data.orderId) return;

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
      } catch (error) {
        console.error("WebSocket message handling error:", error);
      }
    };

    fetch(API_BASE_URL + '/api/orders').then(res => res.json()).then(setOrders);

    // Periodic refresh for couriers to ensure no orders are missed
    let interval: number | null = null;
    if (role === 'courier') {
      interval = window.setInterval(() => {
        fetch(API_BASE_URL + '/api/orders')
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

  const fetchSavedAddresses = async (userId: string) => {
    try {
      const res = await fetch(API_BASE_URL + `/api/saved-addresses/${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSavedAddresses(data);
      }
    } catch (e) {
      console.error("Fetch saved addresses error:", e);
    }
  };

  const saveAddress = async (title: string, address: string, lat: number, lng: number) => {
    if (!user) return;
    try {
      const res = await fetch(API_BASE_URL + '/api/saved-addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title, address, lat, lng })
      });
      if (res.ok) {
        fetchSavedAddresses(user.id);
      }
    } catch (e) {
      console.error("Save address error:", e);
    }
  };

  const deleteSavedAddress = async (id: string) => {
    try {
      const res = await fetch(API_BASE_URL + `/api/saved-addresses/${id}`, { method: 'DELETE' });
      if (res.ok && user) {
        fetchSavedAddresses(user.id);
      }
    } catch (e) {
      console.error("Delete address error:", e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSavedAddresses(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (activeOrder?.courier_id) {
      fetch(API_BASE_URL + `/api/courier-location/${activeOrder.courier_id}`)
        .then(res => res.json())
        .then(data => {
          if (data) setCourierLocation(data);
        });
    }
  }, [activeOrder?.courier_id]);

  useEffect(() => {
    const fetchStats = () => {
      if (role === 'admin') {
        const adminHeaders = { 'x-admin-password': adminPasswordInput || '5807' };
        fetch(API_BASE_URL + '/api/admin/stats', { headers: adminHeaders }).then(res => res.json()).then(data => {
          setOnlineCouriers(data.onlineCouriers);
          setWebhookConfigured(data.webhookConfigured);
        });
      }
      // Fetch online couriers for everyone to show on live map
      fetch(API_BASE_URL + '/api/couriers').then(res => res.json()).then(data => {
        setAllCourierLocations(data);
        if (role !== 'admin') {
          setOnlineCouriers(data.length);
        }
      });
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Refresh every 10 seconds

    if (role === 'admin') {
      const adminHeaders = { 'x-admin-password': adminPasswordInput || '5807' };
      fetch(API_BASE_URL + '/api/admin/users', { headers: adminHeaders }).then(res => res.json()).then(setUsers);
    }

    return () => clearInterval(interval);
  }, [role, adminPasswordInput]);

  const playNotificationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.error("Audio play error:", e));
  };

  useEffect(() => {
    if (activeOrder?.id) {
      if (activeOrder.courier_id) {
        fetch(API_BASE_URL + `/api/users/${activeOrder.courier_id}`)
          .then(res => res.json())
          .then(setActiveCourier)
          .catch(() => setActiveCourier(null));
      } else {
        setActiveCourier(null);
      }

      if (activeOrder.customer_id && role === 'courier') {
        fetch(API_BASE_URL + `/api/users/${activeOrder.customer_id}`)
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

  const getPrice = (type: VehicleType, pkgType: string, dist: number) => {
    if (type === 'motorcycle') {
      const cheapTypes = ['Dosya / Evrak', 'Yemek / Gıda', 'Küçük Paket', 'Tıbbi Malzeme'];
      let base = cheapTypes.includes(pkgType) ? 100 : 120;
      if (dist > 8) base *= 1.2;
      return Math.round(base);
    } else if (type === 'car') {
      // Base 300 + 10 TL per km after 5km
      let base = 300;
      if (dist > 5) {
        base += (dist - 5) * 10;
      }
      return Math.round(base);
    } else if (type === 'van') {
      // Base 500 + 10 TL per km after 5km
      let base = 500;
      if (dist > 5) {
        base += (dist - 5) * 10;
      }
      return Math.round(base);
    }
    return 0;
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingOrder(true);
    try {
      const pCoords = pickupCoords || await geocode(pickup);
      const dCoords = deliveryCoords || await geocode(delivery);
      
      if (pCoords) setPickupCoords(pCoords);
      if (dCoords) setDeliveryCoords(dCoords);
      
      let dist = 0;
      if (pCoords && dCoords) {
        dist = calculateDistance(pCoords.lat, pCoords.lng, dCoords.lat, dCoords.lng);
        // Add road factor (approx 1.3x straight line)
        dist = parseFloat((dist * 1.3).toFixed(1));
        // Minimum distance 1.5km
        if (dist < 1.5) dist = 1.5;
      } else {
        // Fallback to mock if geocoding fails
        dist = parseFloat((Math.random() * (12 - 1.5) + 1.5).toFixed(1));
      }
      
      setCurrentDistance(dist);
      setShowPriceModal(true);
    } catch (err) {
      console.error("Order creation error:", err);
      // Fallback
      setCurrentDistance(parseFloat((Math.random() * (12 - 1.5) + 1.5).toFixed(1)));
      setShowPriceModal(true);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleConfirmOrder = async () => {
    setShowPriceModal(false);
    setIsCreatingOrder(true);
    try {
      // Use the distance generated when showing the price modal
      const mockDistance = currentDistance;

      // Use existing coords or geocode
      const pCoords = pickupCoords || await geocode(pickup);
      const dCoords = deliveryCoords || await geocode(delivery);

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
        pickup_lat: pCoords?.lat,
        pickup_lng: pCoords?.lng,
        delivery_lat: dCoords?.lat,
        delivery_lng: dCoords?.lng
      });

      const res = await fetch(API_BASE_URL + '/api/orders', {
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
          pickup_lat: pCoords?.lat,
          pickup_lng: pCoords?.lng,
          delivery_lat: dCoords?.lat,
          delivery_lng: dCoords?.lng
        })
      });
      
      if (!res.ok) throw new Error('Sipariş oluşturulamadı');
      
      const newOrder = await res.json();
      
      if (saveAddressChecked.pickup && pickup) {
        saveAddress(addressTitle.pickup || 'Alış Adresi', pickup, pickupCoords?.lat || 0, pickupCoords?.lng || 0);
      }
      if (saveAddressChecked.delivery && delivery) {
        saveAddress(addressTitle.delivery || 'Teslim Adresi', delivery, deliveryCoords?.lat || 0, deliveryCoords?.lng || 0);
      }

      setOrders(prev => {
        if (prev.some(o => o.id === newOrder.id)) return prev;
        return [newOrder, ...prev];
      });
      setActiveOrder(newOrder);
      setPickup('');
      setDelivery('');
      setSaveAddressChecked({ pickup: false, delivery: false });
      setAddressTitle({ pickup: '', delivery: '' });
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

    await fetch(API_BASE_URL + `/api/orders/${orderId}`, {
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

    await fetch(API_BASE_URL + `/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, courierId: myCourierId })
    });
  };

  const handleCourierCancelOrder = async (orderId: string) => {
    if (!window.confirm('Bu talebi iptal etmek istediğinize emin misiniz? Talep diğer kuryelere tekrar açılacaktır.')) return;

    try {
      console.log("Cancelling order:", orderId);
      
      const res = await fetch(API_BASE_URL + `/api/orders/${orderId}`, {
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
      fetch(API_BASE_URL + '/api/orders').then(res => res.json()).then(setOrders);
    }
  };

  useEffect(() => {
    if (view === 'earnings' && user?.id) {
      setLoadingEarnings(true);
      fetch(API_BASE_URL + `/api/courier/earnings/${user.id}`)
        .then(res => res.json())
        .then(data => {
          setEarningsData(data);
          setLoadingEarnings(false);
        })
        .catch(err => {
          console.error("Earnings fetch error:", err);
          setLoadingEarnings(false);
        });
    }
  }, [view, user?.id]);

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

  if (isCourierApplicationPage) {
    return <CourierApplicationScreen 
      onBack={() => {
        setIsCourierApplicationPage(false);
        window.history.pushState({}, '', '/');
      }} 
      onLogin={(u) => {
        setUser(u);
        setRole(u.role);
        setIsCourierApplicationPage(false);
        window.history.pushState({}, '', '/');
      }}
    />;
  }

  if (!user && role !== 'admin') {
    return <AuthScreen 
      expectedRole={role} 
      onAdminTrigger={() => setRole('admin')} 
      onCourierApplication={() => {
        setIsCourierApplicationPage(true);
        window.history.pushState({}, '', '/kuryebasvuru');
      }}
      onLogin={(u) => {
        setUser(u);
        setRole(u.role);
      }} 
    />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans selection:bg-indigo-100">
      <header className="sticky top-0 z-[1000] bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setLogoClicks(prev => prev + 1)}>
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Package className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Antalya Teslimat</h1>
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
                  setIsAdminUnlocked(false);
                  setAdminPasswordInput('');
                }}
                className="ml-2 p-1 text-slate-400 hover:text-rose-500 transition-colors"
                title="Çıkış Yap"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          {!user && role === 'admin' && (
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white shadow-sm text-indigo-600 transition-all"
                >
                  Admin
                </button>
              </div>
              <button 
                onClick={() => {
                  setRole('customer');
                  setIsAdminUnlocked(false);
                  setAdminPasswordInput('');
                }}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                title="Geri Dön"
              >
                <LogOut className="w-4 h-4" />
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
          {role === 'courier' && (
            <button 
              onClick={() => setView('earnings')}
              className={cn(
                "pb-4 px-2 text-sm font-bold transition-all relative",
                view === 'earnings' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Kazançlarım
              {view === 'earnings' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
            </button>
          )}
          {(role === 'customer' || role === 'business') && (
            <button 
              onClick={() => setView('addresses')}
              className={cn(
                "pb-4 px-2 text-sm font-bold transition-all relative",
                view === 'addresses' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Adreslerim
              {view === 'addresses' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
            </button>
          )}
          <button 
            onClick={() => setView('mobile-app')}
            className={cn(
              "pb-4 px-2 text-sm font-bold transition-all relative",
              view === 'mobile-app' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Mobil Uygulama
            {view === 'mobile-app' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
        </div>


        {role === 'admin' && (
          !isAdminUnlocked ? (
            <div className="flex flex-col items-center justify-center py-20">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-sm text-center"
              >
                <div className="bg-indigo-600 p-4 rounded-2xl mb-4 shadow-lg shadow-indigo-200 inline-block">
                  <ShieldCheck className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold mb-2">Yönetici Girişi</h2>
                <p className="text-slate-500 text-sm mb-6">Lütfen yönetici şifresini giriniz.</p>
                <input 
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setAdminPasswordError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (adminPasswordInput === '5807') {
                        setIsAdminUnlocked(true);
                      } else {
                        setAdminPasswordError(true);
                      }
                    }
                  }}
                  className={cn(
                    "w-full px-5 py-4 bg-slate-50 border rounded-2xl text-center text-2xl tracking-[0.5em] font-black focus:outline-none focus:ring-2 transition-all",
                    adminPasswordError ? "border-rose-500 ring-rose-500/20" : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500"
                  )}
                  placeholder="••••"
                  maxLength={4}
                  autoFocus
                />
                {adminPasswordError && <p className="text-rose-500 text-xs font-bold mt-2">Hatalı şifre!</p>}
                <button 
                  onClick={() => {
                    if (adminPasswordInput === '5807') {
                      setIsAdminUnlocked(true);
                    } else {
                      setAdminPasswordError(true);
                    }
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all mt-6"
                >
                  Giriş Yap
                </button>
              </motion.div>
            </div>
          ) : (
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
                    await fetch(API_BASE_URL + '/api/admin/notify', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'x-admin-password': adminPasswordInput || '5807'
                      },
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
                          u.role === 'courier' ? "bg-emerald-100 text-emerald-600" : 
                          u.role === 'business' ? "bg-purple-100 text-purple-600" :
                          "bg-blue-100 text-blue-600"
                        )}>
                          {u.role === 'business' ? 'İşletme' : u.role === 'courier' ? 'Kurye' : 'Müşteri'}
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
                              <AnimatePresence mode="wait">
                                <motion.span 
                                  key={order.status}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className={cn(
                                    "inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                    order.status === 'delivered' ? "bg-emerald-100 text-emerald-700" :
                                    order.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                    order.status === 'cancelled' ? "bg-rose-100 text-rose-700" :
                                    "bg-indigo-100 text-indigo-700"
                                  )}
                                >
                                  {getStatusLabel(order.status)}
                                </motion.span>
                              </AnimatePresence>
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
                  {allCourierLocations.length > 0 ? (
                    allCourierLocations.map((loc, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{loc.courierName || loc.courierId}</p>
                            <p className="text-[10px] text-emerald-500 font-bold uppercase">Aktif</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4 italic">Aktif kurye bulunmuyor.</p>
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
        )
      )}

        {(role === 'customer' || role === 'business') && (
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
                    <div className="lg:col-span-2 relative overflow-visible">
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-200"
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
                            <div className="flex items-center justify-between mb-2 ml-1">
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Alış Adresi</label>
                              <div className="flex items-center gap-3">
                                <button 
                                  type="button"
                                  onClick={() => setActivePickingField(activePickingField === 'pickup' ? null : 'pickup')}
                                  className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors",
                                    activePickingField === 'pickup' ? "text-emerald-600" : "text-slate-400 hover:text-emerald-600"
                                  )}
                                >
                                  <Navigation className="w-3 h-3" />
                                  Haritada Seç
                                </button>
                                {savedAddresses.length > 0 && (
                                  <button 
                                    type="button"
                                    onClick={() => setShowSavedAddressesModal({ show: true, target: 'pickup' })}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider flex items-center gap-1"
                                  >
                                    <History className="w-3 h-3" />
                                    Kayıtlı Adreslerim
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="relative">
                              <MapPin className="absolute left-4 top-4 w-5 h-5 text-emerald-500" />
                              <textarea 
                                required
                                rows={3}
                                value={pickup}
                                onChange={e => setPickup(e.target.value)}
                                onFocus={() => setActivePickingField('pickup')}
                                placeholder="Paketin alınacağı tam adresi giriniz..."
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                              />
                            </div>
                            <div className="mt-2 flex items-center gap-2 px-1">
                              <input 
                                type="checkbox" 
                                id="savePickup"
                                checked={saveAddressChecked.pickup}
                                onChange={e => setSaveAddressChecked(prev => ({ ...prev, pickup: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <label htmlFor="savePickup" className="text-xs text-slate-500 cursor-pointer">Bu adresi kaydet</label>
                              {saveAddressChecked.pickup && (
                                <input 
                                  type="text"
                                  placeholder="Adres Başlığı (Örn: Ev, Ofis)"
                                  value={addressTitle.pickup}
                                  onChange={e => setAddressTitle(prev => ({ ...prev, pickup: e.target.value }))}
                                  className="flex-1 ml-2 px-3 py-1 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2 ml-1">
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Teslim Adresi</label>
                              <div className="flex items-center gap-3">
                                <button 
                                  type="button"
                                  onClick={() => setActivePickingField(activePickingField === 'delivery' ? null : 'delivery')}
                                  className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors",
                                    activePickingField === 'delivery' ? "text-rose-600" : "text-slate-400 hover:text-rose-600"
                                  )}
                                >
                                  <Navigation className="w-3 h-3" />
                                  Haritada Seç
                                </button>
                                {savedAddresses.length > 0 && (
                                  <button 
                                    type="button"
                                    onClick={() => setShowSavedAddressesModal({ show: true, target: 'delivery' })}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider flex items-center gap-1"
                                  >
                                    <History className="w-3 h-3" />
                                    Kayıtlı Adreslerim
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="relative">
                              <MapPinned className="absolute left-4 top-4 w-5 h-5 text-rose-500" />
                              <textarea 
                                required
                                rows={3}
                                value={delivery}
                                onChange={e => setDelivery(e.target.value)}
                                onFocus={() => setActivePickingField('delivery')}
                                placeholder="Paketin teslim edileceği tam adresi giriniz..."
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                              />
                            </div>
                            <div className="mt-2 flex items-center gap-2 px-1">
                              <input 
                                type="checkbox" 
                                id="saveDelivery"
                                checked={saveAddressChecked.delivery}
                                onChange={e => setSaveAddressChecked(prev => ({ ...prev, delivery: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <label htmlFor="saveDelivery" className="text-xs text-slate-500 cursor-pointer">Bu adresi kaydet</label>
                              {saveAddressChecked.delivery && (
                                <input 
                                  type="text"
                                  placeholder="Adres Başlığı (Örn: Ev, Ofis)"
                                  value={addressTitle.delivery}
                                  onChange={e => setAddressTitle(prev => ({ ...prev, delivery: e.target.value }))}
                                  className="flex-1 ml-2 px-3 py-1 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              )}
                            </div>
                          </div>

                          {activePickingField && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-lg"
                            >
                              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full animate-pulse",
                                    activePickingField === 'pickup' ? "bg-emerald-500" : "bg-rose-500"
                                  )}></div>
                                  <span className="text-xs font-bold uppercase tracking-widest text-slate-600">
                                    {activePickingField === 'pickup' ? 'Alış Konumu Seç' : 'Teslim Konumu Seç'}
                                  </span>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => setActivePickingField(null)}
                                  className="p-1 hover:bg-white rounded-lg transition-colors text-slate-400"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="h-[350px] relative">
                                <MapContainer 
                                  center={ANTALYA_COORDS} 
                                  zoom={13} 
                                  style={{ height: '100%', width: '100%' }}
                                >
                                  <TileLayer
                                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                  />
                                  <AddressPickerMap 
                                    pickupCoords={pickupCoords}
                                    deliveryCoords={deliveryCoords}
                                    activeField={activePickingField}
                                    onLocationSelect={(lat, lng, address) => {
                                      if (activePickingField === 'pickup') {
                                        lastMapAddressRef.current.pickup = address;
                                        setPickup(address);
                                        setPickupCoords({ lat, lng });
                                      } else {
                                        lastMapAddressRef.current.delivery = address;
                                        setDelivery(address);
                                        setDeliveryCoords({ lat, lng });
                                      }
                                    }}
                                  />
                                </MapContainer>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
                                  <div className="bg-slate-900/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl border border-white/10">
                                    Haritaya tıklayarak konumu belirleyin
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
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
                                <option value="Dosya / Evrak">Dosya / Evrak</option>
                                <option value="Küçük Paket">Küçük Paket</option>
                                <option value="Koli / Kutu">Koli / Kutu</option>
                                <option value="Yemek / Gıda">Yemek / Gıda</option>
                                <option value="Çiçek / Hediye">Çiçek / Hediye</option>
                                <option value="Ev Eşyası">Ev Eşyası</option>
                                <option value="Petshop / Mama">Petshop / Mama</option>
                                <option value="Yedek Parça">Yedek Parça</option>
                                <option value="Tıbbi Malzeme">Tıbbi Malzeme</option>
                                <option value="Diğer">Diğer</option>
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
                </div>

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
                      <h4 className="font-bold mb-4">Neden Antalya Teslimat?</h4>
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
                        <AnimatePresence mode="wait">
                          <motion.span 
                            key={activeOrder.status}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={cn(
                              "inline-block px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded-full mb-3",
                              activeOrder.status === 'pending' ? "bg-amber-50 text-amber-600" :
                              activeOrder.status === 'accepted' ? "bg-indigo-50 text-indigo-600" :
                              activeOrder.status === 'picked_up' ? "bg-blue-50 text-blue-600" :
                              activeOrder.status === 'delivered' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"
                            )}
                          >
                            {activeOrder.status === 'pending' ? 'Kurye Aranıyor' : 
                             activeOrder.status === 'accepted' ? 'Kurye Atandı' :
                             activeOrder.status === 'picked_up' ? 'Paket Yolda' :
                             activeOrder.status === 'delivered' ? 'Teslim Edildi' : 'Sipariş Durumu'}
                          </motion.span>
                        </AnimatePresence>
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
                            <motion.div 
                              animate={{ 
                                scale: activeOrder.status !== 'pending' ? [1, 1.2, 1] : 1,
                                backgroundColor: activeOrder.status !== 'pending' ? "#10b981" : "#e2e8f0"
                              }}
                              className={cn("w-4 h-4 rounded-full border-4 border-white ring-2 ring-offset-2", activeOrder.status !== 'pending' ? "ring-emerald-500" : "ring-slate-200")}
                            ></motion.div>
                            <motion.div 
                              initial={false}
                              animate={{ backgroundColor: activeOrder.status !== 'pending' ? "#10b981" : "#f1f5f9" }}
                              className="w-0.5 h-16"
                            ></motion.div>
                            <motion.div 
                              animate={{ 
                                scale: (activeOrder.status === 'picked_up' || activeOrder.status === 'delivered') ? [1, 1.2, 1] : 1,
                                backgroundColor: (activeOrder.status === 'picked_up' || activeOrder.status === 'delivered') ? "#10b981" : "#e2e8f0"
                              }}
                              className={cn("w-4 h-4 rounded-full border-4 border-white ring-2 ring-offset-2", (activeOrder.status === 'picked_up' || activeOrder.status === 'delivered') ? "ring-emerald-500" : "ring-slate-200")}
                            ></motion.div>
                            <motion.div 
                              initial={false}
                              animate={{ backgroundColor: (activeOrder.status === 'picked_up' || activeOrder.status === 'delivered') ? "#10b981" : "#f1f5f9" }}
                              className="w-0.5 h-16"
                            ></motion.div>
                            <motion.div 
                              animate={{ 
                                scale: activeOrder.status === 'delivered' ? [1, 1.2, 1] : 1,
                                backgroundColor: activeOrder.status === 'delivered' ? "#10b981" : "#e2e8f0"
                              }}
                              className={cn("w-4 h-4 rounded-full border-4 border-white ring-2 ring-offset-2", activeOrder.status === 'delivered' ? "ring-emerald-500" : "ring-slate-200")}
                            ></motion.div>
                          </div>
                          <div className="flex flex-col gap-12 py-0.5">
                            <div className={cn("flex flex-col transition-opacity", activeOrder.status === 'pending' ? "opacity-40" : "opacity-100")}>
                              <span className="text-base font-bold">Kurye Atandı</span>
                              <span className="text-sm text-slate-400">Kuryeniz paket için yola çıktı</span>
                            </div>
                            <div className={cn("flex flex-col transition-opacity", (activeOrder.status === 'picked_up' || activeOrder.status === 'delivered') ? "opacity-100" : "opacity-40")}>
                              <span className="text-base font-bold">Paket Alındı</span>
                              <span className="text-sm text-slate-400">Paketiniz kurye tarafından teslim alındı</span>
                            </div>
                            <div className={cn("flex flex-col transition-opacity", activeOrder.status === 'delivered' ? "opacity-100" : "opacity-40")}>
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
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{activeOrder.pickup_address}</p>
                                  <button 
                                    onClick={() => handleNavigate(activeOrder.pickup_address)}
                                    className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                    title="Google Haritalar'da Aç"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <MapPinned className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Teslim</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{activeOrder.delivery_address}</p>
                                  <button 
                                    onClick={() => handleNavigate(activeOrder.delivery_address)}
                                    className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                                    title="Google Haritalar'da Aç"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
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
                                  <p className="text-base font-bold text-indigo-900">{activeCourier?.full_name || 'Caner T.'}</p>
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
                                  href={`https://wa.me/?text=${encodeURIComponent(`*Yeni Paket Talebi!* 📦\n\n*Takip No:* #${activeOrder.id}\n*Alım:* ${activeOrder.pickup_address}\n*Teslim:* ${activeOrder.delivery_address}\n*Araç:* ${activeOrder.vehicle_type}\n\nAntalya Teslimat Uygulaması`)}`}
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
                          <LeafletMapComponent 
                            location={courierLocation} 
                            status={activeOrder.status}
                            pickupCoords={activeOrder.pickup_lat ? { lat: activeOrder.pickup_lat, lng: activeOrder.pickup_lng } : undefined}
                            deliveryCoords={activeOrder.delivery_lat ? { lat: activeOrder.delivery_lat, lng: activeOrder.delivery_lng } : undefined}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            ) : view === 'history' ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Tamamlanan Teslimatlarınız</h2>
                <div className="grid grid-cols-1 gap-4">
                  {orders.filter(o => (o.status === 'delivered' || o.status === 'cancelled') && (role === 'admin' || o.customer_id === user?.id)).map(order => (
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
                        <div className="flex items-center gap-2 group/addr">
                          <p className="text-sm text-slate-600 line-clamp-1"><span className="font-bold">Alış:</span> {order.pickup_address}</p>
                          <button 
                            onClick={() => handleNavigate(order.pickup_address)}
                            className="p-1 text-slate-400 hover:text-emerald-600 transition-colors opacity-0 group-hover/addr:opacity-100"
                            title="Google Haritalar'da Aç"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 group/addr">
                          <p className="text-sm text-slate-600 line-clamp-1"><span className="font-bold">Teslim:</span> {order.delivery_address}</p>
                          <button 
                            onClick={() => handleNavigate(order.delivery_address)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors opacity-0 group-hover/addr:opacity-100"
                            title="Google Haritalar'da Aç"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
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
                  {orders.filter(o => (o.status === 'delivered' || o.status === 'cancelled') && (role === 'admin' || o.customer_id === user?.id)).length === 0 && (
                    <div className="text-center py-12 text-slate-400">Henüz geçmiş siparişiniz bulunmuyor.</div>
                  )}
                </div>
              </div>
            ) : view === 'addresses' ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Kayıtlı Adreslerim</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedAddresses.map(addr => (
                    <div key={addr.id} className="bg-white p-6 rounded-3xl border border-slate-200 relative group">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                          <MapPin className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-slate-900">{addr.title}</p>
                            <button 
                              onClick={() => handleNavigate(addr.address)}
                              className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                              title="Google Haritalar'da Aç"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{addr.address}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteSavedAddress(addr.id)}
                        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Sil"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {savedAddresses.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-white rounded-[2.5rem] border border-slate-200">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-400 text-sm italic">Henüz kayıtlı bir adresiniz bulunmuyor.</p>
                      <button 
                        onClick={() => setView('active')}
                        className="mt-4 text-indigo-600 font-bold text-sm hover:underline"
                      >
                        Yeni sipariş oluştururken adres kaydedebilirsiniz
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {role === 'courier' && (
          <div className="space-y-8">
            {view === 'active' && (
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
                                      {getPackageLabel(order.package_type)}
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
                            <span className="text-2xl font-black text-indigo-600 self-start sm:self-auto">₺{getPrice(order.vehicle_type, order.package_type || 'Diğer', order.distance || 0)}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl relative overflow-hidden">
                            <div className="flex gap-4">
                              <div className="bg-emerald-100 p-2 rounded-lg h-fit">
                                <MapPin className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Alış Adresi</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-slate-700 leading-relaxed">{order.pickup_address}</p>
                                  <button 
                                    onClick={() => handleNavigate(order.pickup_address)}
                                    className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                    title="Google Haritalar'da Aç"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
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
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-slate-700 leading-relaxed">{order.delivery_address}</p>
                                  <button 
                                    onClick={() => handleNavigate(order.delivery_address)}
                                    className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                                    title="Google Haritalar'da Aç"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
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
                                    {getPackageLabel(order.package_type)}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 bg-white/20 text-white text-[9px] font-bold uppercase rounded-md border border-white/30">
                                  ₺{getPrice(order.vehicle_type, order.package_type || 'Diğer', order.distance || 0)}
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
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{order.pickup_address}</p>
                                <button 
                                  onClick={() => handleNavigate(order.pickup_address)}
                                  className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                  title="Google Haritalar'da Aç"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
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
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{order.delivery_address}</p>
                                <button 
                                  onClick={() => handleNavigate(order.delivery_address)}
                                  className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                  title="Google Haritalar'da Aç"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
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

                {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && (o.status === 'pending' || o.courier_id === myCourierId)).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <div className="bg-slate-100 p-8 rounded-full mb-6">
                      <Bell className="w-12 h-12 opacity-20" />
                    </div>
                    <p className="text-lg font-medium">Şu an aktif bir talep bulunmuyor.</p>
                    <p className="text-sm">Yeni talepler geldiğinde burada görünecektir.</p>
                  </div>
                )}
              </div>
            )}

            {view === 'history' && (
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
                  {orders.filter(o => (o.status === 'delivered' || o.status === 'cancelled') && o.courier_id === myCourierId).length === 0 && (
                    <div className="text-center py-12 text-slate-400">Henüz geçmiş siparişiniz bulunmuyor.</div>
                  )}
                </div>
              </div>
            )}

            {view === 'earnings' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-white/20 p-3 rounded-2xl">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold">Toplam Kazanç</h3>
                    </div>
                    {loadingEarnings ? (
                      <div className="h-10 w-32 bg-white/10 animate-pulse rounded-lg"></div>
                    ) : (
                      <p className="text-4xl font-black">₺{earningsData?.totalEarnings.toLocaleString('tr-TR') || '0'}</p>
                    )}
                    <p className="text-indigo-100 text-sm mt-2">Tüm zamanların toplam kazancı</p>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold">Tamamlanan Teslimat</h3>
                    </div>
                    {loadingEarnings ? (
                      <div className="h-10 w-24 bg-slate-100 animate-pulse rounded-lg"></div>
                    ) : (
                      <p className="text-4xl font-black text-slate-900">{earningsData?.deliveriesCount || '0'}</p>
                    )}
                    <p className="text-slate-400 text-sm mt-2">Başarıyla tamamlanan paket sayısı</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-400" />
                    Kazanç Detayları
                  </h3>
                  <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                    {loadingEarnings ? (
                      <div className="p-12 flex flex-col items-center justify-center gap-4">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-slate-400 font-bold">Veriler yükleniyor...</p>
                      </div>
                    ) : earningsData?.breakdown.length === 0 ? (
                      <div className="p-12 text-center">
                        <p className="text-slate-400 italic">Henüz tamamlanmış bir teslimatınız bulunmuyor.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Müşteri / Tarih</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Mesafe</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Tutar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {earningsData?.breakdown.map((item: any) => (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                  <p className="font-bold text-sm">{item.customerName}</p>
                                  <p className="text-[10px] text-slate-400">{new Date(item.date).toLocaleDateString('tr-TR')} {new Date(item.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-sm font-medium text-slate-600">{item.distance?.toFixed(1) || '0'} km</p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <p className="text-sm font-black text-indigo-600">₺{item.amount}</p>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {view === 'mobile-app' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-6">
                <Zap className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4">Antalya Teslimat Cebinizde!</h2>
              <p className="text-slate-500 max-w-lg mx-auto mb-8">
                Uygulamamızı telefonunuza yükleyerek daha hızlı sipariş verebilir, kuryenizi anlık bildirimlerle takip edebilirsiniz.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-left">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Hızlı Kurulum (PWA)</h3>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Tarayıcınızın "Ana Ekrana Ekle" özelliğini kullanarak uygulamayı saniyeler içinde yükleyebilirsiniz. APK indirmeye gerek kalmadan her zaman güncel kalır.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                      <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] border border-slate-200">1</div>
                      <span>Tarayıcı menüsünü açın</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                      <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] border border-slate-200">2</div>
                      <span>"Ana Ekrana Ekle"ye dokunun</span>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-600 p-8 rounded-[2rem] text-white text-left relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <Package className="w-32 h-32" />
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white mb-4">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Google Play & APK</h3>
                  <p className="text-xs text-indigo-100 mb-6 leading-relaxed">
                    Çok yakında Google Play Store'da! Şu an için APK sürümümüzü test aşamasında indirebilirsiniz.
                  </p>
                  <button 
                    onClick={() => window.open('https://antalyateslimat.com/download', '_blank')}
                    className="w-full bg-white text-indigo-600 font-bold py-3 rounded-xl text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                  >
                    APK İndir (Beta)
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-4">Neden Uygulamayı Yüklemelisiniz?</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-emerald-400">
                        <Bell className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium">Anlık Bildirimler</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-emerald-400">
                        <Navigation className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium">Canlı Harita Takibi</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-emerald-400">
                        <Clock className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium">Hızlı Sipariş Tekrarı</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium">Güvenli Ödeme</span>
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-48 aspect-square bg-white p-4 rounded-3xl flex items-center justify-center">
                  {/* Placeholder for QR Code */}
                  <div className="text-center">
                    <div className="w-32 h-32 bg-slate-100 rounded-xl mb-2 flex items-center justify-center">
                      <Package className="w-12 h-12 text-slate-300" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">QR Kod Yakında</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
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
                  <span className="text-xl font-black text-indigo-600">₺{getPrice(vehicleType, packageType, currentDistance)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <Navigation className="w-3 h-3" />
                    {currentDistance} km
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {React.createElement(getVehicleInfo(vehicleType).icon, { className: "w-3 h-3" })}
                    {getVehicleInfo(vehicleType).label}
                  </div>
                  <div className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-bold uppercase rounded-md">
                    {getPackageLabel(packageType)}
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
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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

      <SavedAddressesModal />

      <AnimatePresence>
        {showStatusAnim && (
          <>
            {activeOrder?.status === 'accepted' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="fixed inset-0 z-[3000] flex items-center justify-center p-6 pointer-events-none"
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ duration: 0.5, repeat: 1 }}
                  className="bg-white/95 backdrop-blur-md p-10 md:p-16 rounded-[3rem] shadow-2xl border-4 border-emerald-500 flex flex-col items-center gap-6 max-w-lg"
                >
                  <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-16 h-16" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-3xl font-black text-slate-900">Kurye Atandı!</h2>
                    <p className="text-slate-500 font-medium mt-2">Siparişiniz kabul edildi ve kuryeniz yola çıktı.</p>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 50, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -50, x: '-50%' }}
                className="fixed bottom-10 left-1/2 z-[3000] bg-slate-900 text-white px-8 py-5 rounded-3xl shadow-2xl flex items-center gap-4 border border-white/10 min-w-[320px]"
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-sm">Sipariş Durumu Güncellendi</p>
                  <p className="text-xs text-slate-400">Yeni Durum: <span className="text-emerald-400 font-bold">{getStatusLabel(activeOrder?.status)}</span></p>
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
