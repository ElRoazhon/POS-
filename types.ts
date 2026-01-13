import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'employee';

export interface Employee {
  id: string;
  name: string;
  code: string;
  role: 'staff' | 'manager';
  permissions: string[]; // 'caisse', 'hygiene', 'pointage'
  createdAt?: any;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: any;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  color?: string;
  vat?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
  destination?: 'kitchen' | 'bar' | 'none'; // Where orders for this category appear
}

export interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: 'square' | 'round' | 'rect';
  seats?: number;
}

export interface Payment {
  id: string;
  method: 'cash' | 'card' | 'voucher';
  amount: number;
  timestamp: any;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  paid: number; // Quantity fully paid
  taxRate: number;
  discount?: number; // Montant de la remise unitaire
  originalPrice?: number; // Prix avant remise
  isOffer?: boolean; // Si offert
  course?: number; // 1 = Entrée, 2 = Plat, 3 = Dessert...
  category?: string;
}

export interface Order {
  id?: string;
  tableId: string;
  customerId?: string; // Link to customer
  customerName?: string; // Snapshot of name
  items: OrderItem[];
  payments: Payment[]; // Log of all payments
  subtotal: number;
  taxTotal: number;
  discount: number;
  total: number;
  paidAmount: number; // Total paid so far
  status: 'open' | 'paid';
  server: string;
  createdAt: any;
  updatedAt: any;
  sessionId?: string; // Link to the Cash Session
  
  // Kitchen Management
  kitchenStatus?: { [course: number]: 'hold' | 'fired' | 'served' }; 
  // 'hold' = Waiting for server
  // 'fired' = Kitchen is cooking (Server clicked "Suite")
  // 'served' = Kitchen sent it (Ready for next)
}

export interface CashSession {
    id?: string;
    status: 'open' | 'closed';
    openedAt: any;
    closedAt?: any;
    openedBy: string;
    startAmount: number; // Fond de caisse
    totalSales: number;
    paymentBreakdown?: { [key: string]: number };
    taxBreakdown?: { [key: number]: { base: number, amount: number } };
    // Updated structure for detailed sales
    productBreakdown?: { 
        [key: string]: { 
            qty: number, 
            totalTTC: number, 
            totalHT: number, 
            totalVAT: number 
        } 
    };
}

export interface HygieneTask {
    id: string;
    name: string;
    zone: string; // Cuisine, Salle, Bar, Toilettes
    frequency: 'daily' | 'weekly';
    description?: string;
}

export interface HygieneLog {
  id?: string;
  type: 'clean' | 'temp' | 'traceability';
  itemId?: string; // Task ID or Equipment ID
  itemName?: string;
  productName?: string; // For traceability
  quantity?: string; // For traceability
  image?: string; // Base64 or URL
  value?: any; // boolean for clean, number for temp
  user: string;
  date: any;
}

export interface AppSettings {
  country: 'FR' | 'CA';
  defaultTax: number;
  currency: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  adminCode?: string;
}

export interface InvoiceItemCandidate {
  name: string;
  price: number;
  category: string;
  confidence?: number;
}