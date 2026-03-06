export type VehicleType = 'motorcycle' | 'car' | 'van';

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  delivery_address: string;
  status: 'pending' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
  vehicle_type: VehicleType;
  payment_method: 'sender' | 'receiver';
  package_type: string;
  special_request?: string;
  courier_id?: string;
  created_at: string;
}

export interface CourierLocation {
  courier_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}

export type AppRole = 'customer' | 'courier' | 'business';
