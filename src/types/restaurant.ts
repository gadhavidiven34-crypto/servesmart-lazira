export type AppView = 'customer' | 'kitchen' | 'reception' | 'table-qrs' | 'admin';

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed';

export type PaymentMethod = 'upi' | 'cash' | null;

export type PaymentStatus = 'unpaid' | 'waiting_confirmation' | 'paid';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  prepTimeMins: number;
  image?: string;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  prepTimeMins: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  tableNumber: number;
  items: OrderItem[];
  totalAmount: number;
  estimatedPrepMins: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: number;
  prepStartedAt: number | null;
  readyAt: number | null;
  paidAt: number | null;
  reviewId: string | null;
}

export interface Review {
  id: string;
  orderId: string;
  tableNumber: number;
  rating: number;
  comment: string;
  createdAt: number;
}

export interface RestaurantSettings {
  restaurantName: string;
  upiId: string;
  totalTables: number;
  adminPin: string;
}

export interface TableOccupancyInfo {
  tableNumber: number;
  isOccupied: boolean;
  activeOrders: Order[];
  unpaidOrdersCount: number;
  totalActiveAmount: number;
  latestOrder: Order | null;
}
