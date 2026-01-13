import React, { useState, useEffect } from 'react';
import { db, APP_ID } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, Timestamp, where, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { Table, Order, Product, Category, AppSettings, Payment, OrderItem, CashSession, Customer } from '../types';
import { Button, Modal, Input } from './Shared';
import { ArrowLeft, CreditCard, Receipt, Trash2, Power, Coins, Users, CheckCircle, Calculator, Minus, Plus, Lock, Loader, Percent, Gift, UserPlus, Search, Utensils, Flame, BellRing, Divide, MousePointer2, Undo2, XCircle } from 'lucide-react';

const CustomerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onSelect: (c: Customer) => void;
}> = ({ isOpen, onClose, customers, onSelect }) => {
  const [search, setSearch] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [view, setView] = useState<'list' | 'create'>('list');

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
      if(!newCustomerName) return;
      try {
        const ref = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'customers'), {
            name: newCustomerName, createdAt: Timestamp.now()
        });
        onSelect({ id: ref.id, name: newCustomerName, createdAt: Timestamp.now() });
        setNewCustomerName("");
        setView('list');
      } catch(e) { console.error(e); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Clients" maxWidth="max-w-md">
        {view === 'list' ? (
            <div className="space-y-4">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                        <input className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <Button onClick={() => setView('create')}><UserPlus size={18}/></Button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                    {filtered.map(c => (
                        <button key={c.id} onClick={() => onSelect(c)} className="w-full text-left p-3 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 text-slate-300 font-bold transition-all">
                            {c.name}
                        </button>
                    ))}
                </div>
            </div>
        ) : (
            <div className="space-y-4">
                <Input placeholder="Nom du client" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} autoFocus />
                <div className="flex gap-2">
                    <Button onClick={() => setView('list')} variant="outline" className="flex-1">Annuler</Button>
                    <Button onClick={handleCreate} className="flex-1">Créer</Button>
                </div>
            </div>
        )}
    </Modal>
  );
};

// --- ADVANCED PAYMENT MODAL (SPLIT / ITEMS / TOTAL) ---
const PaymentModal: React.FC<{
  order: Order;
  onClose: () => void;
  onProcessPayment: (amount: number, method: 'cash' | 'card', items: {id: string, price: number, payQty: number}[]) => void;
}> = ({ order, onClose, onProcessPayment }) => {
  const [mode, setMode] = useState<'total' | 'split' | 'items'>('total');
  const remaining = order.total - order.paidAmount;
  
  // Split State
  const [splitCount, setSplitCount] = useState(2);
  
  // Item Split State
  // Map of item index -> quantity selected to pay
  const [selectedItems, setSelectedItems] = useState<{[key:number]: number}>({});

  const getAmountToPay = () => {
      if (mode === 'total') return remaining;
      if (mode === 'split') return remaining / splitCount;
      if (mode === 'items') {
          let sum = 0;
          order.items.forEach((item, idx) => {
             const qty = Number(selectedItems[idx] || 0);
             sum += qty * item.price;
          });
          return sum;
      }
      return 0;
  };

  const currentAmount = getAmountToPay();

  const handlePay = (method: 'cash' | 'card') => {
      if (currentAmount <= 0.01) return;
      
      let itemsToMarkPaid: {id: string, price: number, payQty: number}[] = [];
      
      if (mode === 'items') {
          itemsToMarkPaid = order.items.map((item, idx) => ({
              id: item.id,
              price: item.price,
              payQty: selectedItems[idx] || 0
          })).filter(i => i.payQty > 0);
      } else if (mode === 'total') {
          // Pay remaining quantities
          itemsToMarkPaid = order.items.map(item => ({
              id: item.id,
              price: item.price,
              payQty: item.qty - item.paid
          })).filter(i => i.payQty > 0);
      }
      // Note: In 'split' mode, we don't mark specific items as paid because it's a monetary split.
      
      onProcessPayment(currentAmount, method, itemsToMarkPaid);
  };

  const toggleItemSelection = (idx: number, maxQty: number) => {
      const current = selectedItems[idx] || 0;
      const next = current >= maxQty ? 0 : current + 1;
      setSelectedItems({...selectedItems, [idx]: next});
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Encaissement & Partage" maxWidth="max-w-2xl">
        <div className="flex flex-col h-[500px]">
            {/* TABS */}
            <div className="flex bg-slate-800 p-1 rounded-xl mb-6 shrink-0">
                <button onClick={() => setMode('total')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${mode==='total' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Total</button>
                <button onClick={() => setMode('split')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${mode==='split' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Diviser (Personnes)</button>
                <button onClick={() => setMode('items')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${mode==='items' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Par Articles</button>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto mb-6">
                
                {/* MODE TOTAL */}
                {mode === 'total' && (
                    <div className="flex flex-col items-center justify-center h-full">
                        <p className="text-slate-400 font-bold uppercase mb-2">Montant Restant</p>
                        <div className="text-6xl font-black text-white mb-2">{remaining.toFixed(2)} €</div>
                        <p className="text-sm text-slate-500">Tout régler en une fois</p>
                    </div>
                )}

                {/* MODE SPLIT */}
                {mode === 'split' && (
                     <div className="flex flex-col items-center justify-center h-full">
                        <div className="flex items-center gap-6 mb-8">
                            <button onClick={() => setSplitCount(Math.max(2, splitCount - 1))} className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center border border-slate-600"><Minus size={32}/></button>
                            <div className="text-center">
                                <div className="text-5xl font-black text-white">{splitCount}</div>
                                <div className="text-slate-400 uppercase font-bold text-xs mt-1">Personnes</div>
                            </div>
                            <button onClick={() => setSplitCount(splitCount + 1)} className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center border border-slate-600"><Plus size={32}/></button>
                        </div>
                        <div className="bg-slate-800 p-6 rounded-2xl text-center border border-slate-700 w-full max-w-sm">
                            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Montant par personne</p>
                            <div className="text-4xl font-black text-emerald-400">{(remaining / splitCount).toFixed(2)} €</div>
                        </div>
                     </div>
                )}

                {/* MODE ITEMS */}
                {mode === 'items' && (
                    <div className="space-y-2">
                        {order.items.map((item, idx) => {
                            const available = item.qty - item.paid;
                            if (available <= 0) return null;
                            const selected = selectedItems[idx] || 0;
                            return (
                                <div key={idx} onClick={() => toggleItemSelection(idx, available)} className={`flex justify-between items-center p-4 rounded-xl border cursor-pointer select-none transition-all ${selected > 0 ? 'bg-indigo-900/30 border-indigo-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800/80'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${selected > 0 ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500'}`}>
                                            {selected > 0 && <CheckCircle size={14} className="text-white"/>}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white">{item.name}</div>
                                            <div className="text-xs text-slate-500">{available} restants</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                             <div className="font-bold text-white">{(item.price * (selected || available)).toFixed(2)} €</div>
                                             {selected > 0 && <div className="text-xs text-indigo-400 font-bold">{selected} / {available} sél.</div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {order.items.every(i => i.qty - i.paid <= 0) && <div className="text-center text-slate-500 mt-10">Tout a été payé.</div>}
                    </div>
                )}
            </div>

            {/* FOOTER ACTIONS */}
            <div className="pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center mb-4 px-2">
                     <span className="text-slate-400 font-bold uppercase text-sm">À Encaisser</span>
                     <span className="text-3xl font-black text-white">{currentAmount.toFixed(2)} €</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Button onClick={() => handlePay('card')} disabled={currentAmount <= 0} className="h-16 flex-col bg-indigo-600 hover:bg-indigo-500">
                        <CreditCard size={24} />
                        <span className="text-xs">Carte Bancaire</span>
                    </Button>
                    <Button onClick={() => handlePay('cash')} disabled={currentAmount <= 0} className="h-16 flex-col bg-emerald-600 hover:bg-emerald-500">
                        <Coins size={24} />
                        <span className="text-xs">Espèces</span>
                    </Button>
                </div>
            </div>
        </div>
    </Modal>
  );
};

export const POS: React.FC<{ onBack: () => void; user: any }> = ({ onBack, user }) => {
  const [view, setView] = useState<'floor' | 'order'>('floor');
  const [session, setSession] = useState<CashSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingZ, setLoadingZ] = useState(false);

  // Normalisation de l'utilisateur (Gère le cas où user === 'admin')
  const effectiveUser = user === 'admin' 
    ? { name: 'Administrateur', id: 'admin', role: 'admin' } 
    : user;

  // Data
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ country: 'FR', defaultTax: 10, currency: '€' });
  
  // Active Order State
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [selectedCat, setSelectedCat] = useState<string>('');
  
  // COURSE SELECTION
  const [selectedCourse, setSelectedCourse] = useState<number>(1); // 1 = Entrée, 2 = Plat, etc.

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showZTicketModal, setShowZTicketModal] = useState(false);
  const [zTicketData, setZTicketData] = useState<any>(null);
  
  // New Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showItemOptionModal, setShowItemOptionModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Listen for Active Session
    const qSession = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'cash_sessions'), where('status', '==', 'open'));
    const unsubSession = onSnapshot(qSession, (snap) => {
        if (!snap.empty) {
            setSession({ id: snap.docs[0].id, ...snap.docs[0].data() } as CashSession);
        } else {
            setSession(null);
        }
        setLoadingSession(false);
    });

    // 2. Data Listeners
    const unsubTables = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'tables'), s => setTables(s.docs.map(d => ({id:d.id, ...d.data()} as Table))));
    const unsubOrders = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'orders'), where('status', '==', 'open')), s => setOrders(s.docs.map(d => ({id:d.id, ...d.data()} as Order))));
    const unsubProds = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'products')), s => setProducts(s.docs.map(d => ({id:d.id, ...d.data()} as Product))));
    const unsubCats = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'categories'), orderBy('order')), s => {
        const cats = s.docs.map(d => ({id:d.id, ...d.data()} as Category));
        setCategories(cats);
        if (cats.length > 0 && !selectedCat) setSelectedCat(cats[0].name);
    });
    const unsubCust = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'customers'), orderBy('name')), s => setCustomers(s.docs.map(d => ({id:d.id, ...d.data()} as Customer))));
    
    // Fetch Settings
    const fetchSettings = async () => {
        const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'config'));
        if (snap.exists()) setSettings(snap.data() as AppSettings);
    };
    fetchSettings();

    return () => { unsubSession(); unsubTables(); unsubOrders(); unsubProds(); unsubCats(); unsubCust(); };
  }, []);

  // --- SESSION MANAGEMENT ---
  const startSession = async () => {
      try {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'cash_sessions'), {
            status: 'open',
            openedAt: Timestamp.now(),
            openedBy: effectiveUser.name,
            startAmount: 0,
            totalSales: 0
        });
      } catch (error) {
          console.error("Error starting session:", error);
          alert("Erreur lors de l'ouverture de caisse.");
      }
  };

  const prepareZTicket = async () => {
      if (!session || !session.id) return;
      setLoadingZ(true);
      
      try {
        // Fetch all paid orders
        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'orders'), 
            where('status', '==', 'paid')
        );
        
        const snap = await getDocs(q);
        const allPaidOrders = snap.docs.map(d => d.data() as Order);

        const getTimestampSeconds = (t: any): number => {
            if (!t) return 0;
            if (typeof t.seconds === 'number') return t.seconds;
            if (typeof t._seconds === 'number') return t._seconds;
            try {
                if (t instanceof Timestamp) return t.seconds;
            } catch(e) {}
            return 0;
        };

        const sessionOrders = allPaidOrders.filter(o => {
            if (o.sessionId === session.id) return true;
            
            const sOpen = session.openedAt;
            const oUpdate = o.updatedAt;

            if (sOpen && oUpdate) {
                 const openTime = getTimestampSeconds(sOpen);
                 const orderTime = getTimestampSeconds(oUpdate);
                 return orderTime >= openTime;
            }
            return false;
        });

        let total = 0;
        const payBreakdown: Record<string, number> = { cash: 0, card: 0 };
        const productBreakdown: Record<string, { qty: number, totalTTC: number, totalHT: number, totalVAT: number }> = {};
        const taxBreakdown: Record<number, { base: number, amount: number }> = {};

        sessionOrders.forEach(o => {
            total += Number(o.total || 0);
            if (o.payments) {
                o.payments.forEach(p => {
                    const method = (p.method || 'cash') as string;
                    // FIX: Ensure 'payBreakdown[method]' is treated as a number
                    const current = payBreakdown[method] || 0;
                    payBreakdown[method] = current + Number(p.amount || 0);
                });
            }
            if (o.items) {
                o.items.forEach(i => {
                    if (!productBreakdown[i.name]) productBreakdown[i.name] = { qty: 0, totalTTC: 0, totalHT: 0, totalVAT: 0 };
                    
                    const tRate = Number(i.taxRate ?? settings.defaultTax ?? 0);
                    const price = Number(i.price ?? 0);
                    const qty = Number(i.qty ?? 0);

                    const lineTTC = price * qty;
                    const lineHT = lineTTC / (1 + (tRate / 100));
                    const lineVAT = lineTTC - lineHT;
                    
                    const entry = productBreakdown[i.name];
                    entry.qty += qty;
                    entry.totalTTC += lineTTC;
                    entry.totalHT += lineHT;
                    entry.totalVAT += lineVAT;
                    
                    if(!taxBreakdown[tRate]) taxBreakdown[tRate] = { base: 0, amount: 0 };
                    const taxEntry = taxBreakdown[tRate];
                    taxEntry.base += lineHT;
                    taxEntry.amount += lineVAT;
                });
            }
        });

        setZTicketData({ total, payBreakdown, productBreakdown, taxBreakdown, orderCount: sessionOrders.length, date: new Date().toLocaleString() });
        setShowZTicketModal(true);
      } catch (error) {
          console.error("Error Z Ticket:", error);
          alert("Erreur technique Ticket Z.");
      } finally {
          setLoadingZ(false);
      }
  };

  const closeSession = async () => {
      if (!session || !session.id) return;
      try {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'cash_sessions', session.id), {
            status: 'closed',
            closedAt: Timestamp.now(),
            totalSales: zTicketData?.total || 0,
            paymentBreakdown: zTicketData?.payBreakdown,
            taxBreakdown: zTicketData?.taxBreakdown,
            productBreakdown: zTicketData?.productBreakdown 
        });
        setShowZTicketModal(false);
        setSession(null);
      } catch (e) { console.error("Close Session Error", e); alert("Erreur fermeture."); }
  };

  // --- ORDER LOGIC ---
  const openTable = (tableId: string) => {
    if (!session) return alert("Veuillez ouvrir la caisse d'abord.");
    setActiveTableId(tableId);
    const existing = orders.find(o => o.tableId === tableId);
    if (existing) {
        setCurrentOrder(existing);
    } else {
        // Initialize new order with first course fired
        setCurrentOrder({
            tableId,
            items: [], payments: [],
            subtotal: 0, taxTotal: 0, discount: 0, total: 0, paidAmount: 0,
            status: 'open', server: effectiveUser.name, createdAt: null, updatedAt: null, sessionId: session.id,
            kitchenStatus: { 1: 'fired' } 
        });
    }
    setView('order');
    setSelectedCourse(1); 
  };

  const cancelTable = async () => {
      if (!currentOrder || !currentOrder.id) return;
      // Removed confirm dialog as requested
      try {
          await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', currentOrder.id));
          setCurrentOrder(null);
          setView('floor');
      } catch (e) {
          console.error("Error deleting order:", e);
          alert("Erreur lors de l'annulation de la table.");
      }
  };

  const addToOrder = (product: Product) => {
    if (!currentOrder) return;
    const newItems = [...currentOrder.items];
    const existingIdx = newItems.findIndex(i => i.id === product.id && i.price === product.price && !i.discount && (i.course || 1) === selectedCourse);
    if (existingIdx >= 0) newItems[existingIdx].qty++;
    else newItems.push({ 
        id: product.id, 
        name: product.name, 
        price: product.price, 
        originalPrice: product.price, 
        qty: 1, 
        paid: 0, 
        taxRate: settings.defaultTax, 
        discount: 0, 
        course: selectedCourse,
        category: product.category 
    });
    saveOrderLocal(newItems, currentOrder.payments);
  };

  const removeFromOrder = (idx: number) => {
    if(!currentOrder) return;
    const newItems = [...currentOrder.items];
    if (newItems[idx].paid > 0) return alert("Article déjà encaissé partiellement.");
    if (newItems[idx].qty > 1) newItems[idx].qty--;
    else newItems.splice(idx, 1);
    saveOrderLocal(newItems, currentOrder.payments);
  };

  // SERVICE MANAGEMENT
  const fireCourse = async (courseNum: number) => {
    if(!currentOrder) return;
    const statuses = currentOrder.kitchenStatus || {};
    if(statuses[courseNum] === 'fired') return; 
    const newStatus = { ...statuses, [courseNum]: 'fired' };
    const updated = { ...currentOrder, kitchenStatus: newStatus };
    setCurrentOrder(updated); 
    await persistOrder(updated);
  };

  const cancelCourse = async (courseNum: number) => {
    if(!currentOrder) return;
    const statuses = currentOrder.kitchenStatus || {};
    // Only allow cancelling if 'fired', not if 'served'
    if(statuses[courseNum] === 'served') return alert("Impossible d'annuler un service déjà terminé en cuisine.");
    
    const newStatus = { ...statuses };
    delete newStatus[courseNum]; // Remove 'fired' status, back to 'hold'
    
    const updated = { ...currentOrder, kitchenStatus: newStatus };
    setCurrentOrder(updated);
    await persistOrder(updated);
  };

  const getNextCourseToFire = (): number | null => {
      if (!currentOrder) return null;
      const courses = currentOrder.items.map(i => i.course || 1);
      const uniqueCourses = Array.from(new Set(courses)).sort((a,b) => a - b);
      for (const c of uniqueCourses) {
          const status = currentOrder.kitchenStatus?.[c];
          if (status !== 'fired' && status !== 'served') return c;
      }
      return null;
  };

  // DISCOUNT & OPTIONS
  const openItemOptions = (idx: number) => { setSelectedItemIndex(idx); setShowItemOptionModal(true); };
  const applyDiscount = (type: 'percent' | 'amount' | 'offer', value: number) => {
      if(!currentOrder || selectedItemIndex === null) return;
      const newItems = [...currentOrder.items];
      const item = { ...newItems[selectedItemIndex] };
      const basePrice = item.originalPrice || item.price;
      if(type === 'offer') { item.price = 0; item.discount = basePrice; item.isOffer = true; }
      else if (type === 'percent') { const discountAmt = basePrice * (value / 100); item.price = basePrice - discountAmt; item.discount = discountAmt; item.isOffer = false; }
      newItems[selectedItemIndex] = item;
      saveOrderLocal(newItems, currentOrder.payments);
      setShowItemOptionModal(false);
  };

  const assignCustomer = (c: Customer) => {
      if(!currentOrder) return;
      const updated = { ...currentOrder, customerId: c.id, customerName: c.name };
      setCurrentOrder(updated);
      persistOrder(updated);
      setShowCustomerModal(false);
  };

  const saveOrderLocal = (items: OrderItem[], payments: Payment[]) => {
    let sub = 0;
    items.forEach(i => sub += Number(i.price ?? 0) * Number(i.qty ?? 0));
    const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
    let tax = 0;
    items.forEach(i => { 
        const p = Number(i.price ?? 0);
        const q = Number(i.qty ?? 0);
        const tr = Number(i.taxRate ?? 0);
        const line = p * q; 
        tax += line - (line / (1 + tr/100)); 
    });
    setCurrentOrder(prev => prev ? ({ ...prev, items, payments, subtotal: sub, taxTotal: tax, total: sub, paidAmount: totalPaid }) : null);
  };

  const persistOrder = async (orderData: Order = currentOrder!) => {
    if (!orderData || !activeTableId) return;
    const kitchenStatus = orderData.kitchenStatus || { 1: 'fired' };
    const data = { ...orderData, kitchenStatus, updatedAt: Timestamp.now() };
    if (!data.createdAt) data.createdAt = Timestamp.now();
    if (data.paidAmount >= data.total - 0.01 && data.total > 0) data.status = 'paid';
    try {
        if (data.id) await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', data.id), data as any);
        else { const ref = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'orders'), data); if (!data.id) data.id = ref.id; }
        if (data.status === 'paid') setView('floor'); 
    } catch (e) { console.error("Error saving order:", e); }
  };

  const handleProcessPayment = async (amount: number, method: 'cash' | 'card' | 'voucher', itemsToPay: {id: string, price: number, payQty: number}[]) => {
      if (!currentOrder) return;
      const payment: Payment = { id: Date.now().toString(), method, amount, timestamp: Timestamp.now() };
      const newPayments = [...currentOrder.payments, payment];
      
      // Update item paid counts if specific items were paid
      const newItems = currentOrder.items.map(item => {
          const payItem = itemsToPay.find(pi => pi.id === item.id && pi.price === item.price);
          return payItem ? { ...item, paid: item.paid + Number(payItem.payQty || 0) } : item;
      });

      const newTotalPaid = newPayments.reduce((a, b) => a + Number(b.amount || 0), 0);
      const isFullyPaid = newTotalPaid >= currentOrder.total - 0.01;

      const updatedOrder: Order = { ...currentOrder, items: newItems, payments: newPayments, paidAmount: newTotalPaid, status: isFullyPaid ? 'paid' : 'open', updatedAt: Timestamp.now() };
      await persistOrder(updatedOrder);
      setShowPaymentModal(false);
      setCurrentOrder(updatedOrder);
      if (isFullyPaid) setView('floor');
  };

  if (loadingSession) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white"><Receipt className="animate-spin mr-2"/> Chargement...</div>;

  if (!session) {
      return (
          <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
              <div className="bg-slate-900 p-10 rounded-3xl border border-slate-800 text-center shadow-2xl max-w-md w-full">
                  <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 border border-slate-700 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                    <Power size={40} />
                  </div>
                  <h1 className="text-3xl font-black mb-2 text-white">Caisse Fermée</h1>
                  <p className="text-slate-400 mb-8">Bonjour <span className="text-indigo-400 font-bold">{effectiveUser.name}</span>. Ouvrez une session pour commencer le service.</p>
                  
                  <Button onClick={startSession} className="w-full py-4 text-lg bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20">
                      Ouvrir la Caisse
                  </Button>
                  <Button variant="outline" onClick={onBack} className="w-full mt-4 border-slate-700 hover:bg-slate-800 text-slate-400">Retour</Button>
              </div>
          </div>
      );
  }

  const nextCourseToFire = getNextCourseToFire();

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 p-3 flex justify-between items-center border-b border-red-900/30">
            <div className="flex items-center gap-4">
                <div>
                    <span className="text-xs text-red-500 font-bold uppercase tracking-widest">POS System</span>
                    <h2 className="text-white font-bold flex items-center gap-2">
                        {effectiveUser.name} 
                        {effectiveUser.role === 'admin' && <span className="bg-red-900/30 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-900/50">ADMIN</span>}
                    </h2>
                </div>
                <div className="bg-slate-900 px-3 py-1 rounded border border-slate-800 text-xs text-emerald-400 flex items-center gap-2 shadow-inner">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Session Ouverte
                </div>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={prepareZTicket} disabled={loadingZ} className="py-2 px-3 text-xs border-slate-700 hover:bg-slate-800 text-white font-bold min-w-[120px]">
                    {loadingZ ? <Loader className="animate-spin mr-2" size={14} /> : <Receipt size={14} className="mr-2 text-indigo-400"/>}
                    {loadingZ ? 'Calcul...' : 'Clôture Z'}
                </Button>
                <Button variant="danger" onClick={onBack} className="py-2 px-3 text-xs">Quitter</Button>
            </div>
        </div>

        {view === 'floor' && (
            <div className="flex-1 relative floor-grid overflow-auto custom-scrollbar">
                {tables.map(t => {
                    const order = orders.find(o => o.tableId === t.id);
                    const isOccupied = order && order.status === 'open';
                    return (
                        <div 
                            key={t.id}
                            onClick={() => openTable(t.id)}
                            className={`absolute flex flex-col items-center justify-center text-white font-bold shadow-xl cursor-pointer transition-transform active:scale-95 border-2 ${isOccupied ? 'bg-red-600 border-red-400' : 'bg-emerald-600 border-emerald-400'}`}
                            style={{ 
                                left: `${t.x}px`, top: `${t.y}px`, 
                                width: `${t.width}px`, height: `${t.height}px`,
                                borderRadius: t.shape === 'round' ? '50%' : '12px',
                                overflow: 'hidden'
                            }}
                        >
                            <span className="text-lg drop-shadow-md">{t.name}</span>
                            {isOccupied && <span className="text-xs bg-black/40 px-1 rounded mt-1">{order.total.toFixed(0)}€</span>}
                        </div>
                    );
                })}
            </div>
        )}

        {view === 'order' && currentOrder && (
            <div className="flex-1 flex overflow-hidden">
                {/* TICKET LEFT */}
                <div className="w-[400px] bg-slate-950 border-r border-slate-800 flex flex-col z-10 shadow-2xl relative">
                    <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                         <div className="flex items-center gap-2">
                             <button onClick={() => { persistOrder(); setView('floor'); }} className="text-slate-400 hover:text-white flex items-center gap-1"><ArrowLeft size={16} /></button>
                             <h3 className="font-bold text-white text-lg">Table {tables.find(t => t.id === activeTableId)?.name}</h3>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => setShowCustomerModal(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${currentOrder.customerId ? 'bg-indigo-900/50 border-indigo-500 text-indigo-200' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                 <Users size={14} /> {currentOrder.customerName || 'Client'}
                             </button>
                             {/* DELETE ORDER BUTTON */}
                             {currentOrder.id && (
                                <button onClick={cancelTable} className="bg-red-900/20 text-red-500 border border-red-900/50 p-1.5 rounded-lg hover:bg-red-900 hover:text-white transition-colors" title="Annuler la table (Supprimer)">
                                    <Trash2 size={16} />
                                </button>
                             )}
                         </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {currentOrder.items.length === 0 && <div className="text-slate-600 text-center mt-10 italic">Commande vide</div>}
                        
                        {/* Group Items by Course */}
                        {[1,2,3,4,5].map(courseNum => {
                            const itemsInCourse = currentOrder.items.filter(i => (i.course || 1) === courseNum);
                            if (itemsInCourse.length === 0) return null;
                            
                            const kStatus = currentOrder.kitchenStatus?.[courseNum] || 'hold';
                            let statusLabel = "";
                            let statusColor = "";
                            
                            if (kStatus === 'fired') { statusLabel = "EN CUISINE"; statusColor = "text-orange-400"; }
                            if (kStatus === 'served') { statusLabel = "SERVI"; statusColor = "text-emerald-500"; }
                            // Hold is default, no label

                            return (
                                <div key={courseNum} className="relative">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-px bg-slate-800 flex-1"></div>
                                        <div className="flex items-center gap-2">
                                             <span className="text-xs font-bold text-slate-500 uppercase">
                                                 {courseNum === 1 ? 'Service 1' : `Service ${courseNum}`}
                                             </span>
                                             
                                             {/* FIRE/CANCEL BUTTONS FOR EACH COURSE */}
                                             {(kStatus === 'hold' || !kStatus) && (
                                                 <button 
                                                     onClick={() => fireCourse(courseNum)}
                                                     className="bg-slate-800 hover:bg-orange-600 hover:text-white text-slate-500 text-[10px] px-2 py-0.5 rounded font-black uppercase flex items-center gap-1 transition-colors border border-slate-700"
                                                     title="Envoyer en cuisine"
                                                 >
                                                     <Flame size={12} /> Envoyer
                                                 </button>
                                             )}
                                             
                                             {kStatus === 'fired' && (
                                                <button 
                                                     onClick={() => cancelCourse(courseNum)}
                                                     className="bg-red-900/20 hover:bg-red-900 hover:text-white text-red-500 text-[10px] px-2 py-0.5 rounded font-black uppercase flex items-center gap-1 transition-colors border border-red-900/50"
                                                     title="Annuler l'envoi"
                                                 >
                                                     <Undo2 size={12} /> Annuler
                                                 </button>
                                             )}

                                             {statusLabel && <span className={`text-[10px] font-black ${statusColor} border border-current px-1 rounded`}>{statusLabel}</span>}
                                        </div>
                                        <div className="h-px bg-slate-800 flex-1"></div>
                                    </div>
                                    <div className="space-y-1">
                                        {itemsInCourse.map((item, idx) => {
                                            // Real index in main array
                                            const realIdx = currentOrder.items.indexOf(item);
                                            return (
                                                <div key={idx} onClick={() => openItemOptions(realIdx)} className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-800/50 hover:bg-slate-900 cursor-pointer group transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-xs font-bold text-white border border-slate-700">{item.qty}</div>
                                                        <div>
                                                            <div className="font-bold text-slate-200 text-sm flex items-center gap-2">
                                                                {item.name}
                                                                {item.discount && item.discount > 0 && <span className="bg-red-900/50 text-red-400 text-[10px] px-1 rounded border border-red-900">-{(item.discount/item.originalPrice! * 100).toFixed(0)}%</span>}
                                                                {item.isOffer && <span className="bg-emerald-900/50 text-emerald-400 text-[10px] px-1 rounded border border-emerald-900">OFFERT</span>}
                                                            </div>
                                                            {item.paid > 0 && <div className="text-[10px] text-emerald-500 font-bold">{item.paid} payé(s)</div>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <div className="font-mono font-bold text-indigo-400 text-sm">{(item.price * item.qty).toFixed(2)}€</div>
                                                            {item.discount ? <div className="text-[10px] text-slate-500 line-through">{(item.originalPrice! * item.qty).toFixed(2)}€</div> : null}
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); removeFromOrder(realIdx); }} className="text-slate-600 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 bg-slate-900 border-t border-slate-800 shadow-[0_-5px_15px_rgba(0,0,0,0.3)]">
                        {/* Request Service Button - Only show if automatic calculation suggests one */}
                        {nextCourseToFire !== null && (
                             <Button 
                                onClick={() => fireCourse(nextCourseToFire)}
                                className="w-full mb-3 bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/20 animate-pulse font-black uppercase text-sm tracking-widest"
                             >
                                 <BellRing className="mr-2" /> Envoyer la suite (Svc {nextCourseToFire})
                             </Button>
                        )}

                        <div className="space-y-1 mb-4 text-sm">
                            <div className="flex justify-between text-slate-400">
                                <span>Sous-total</span>
                                <span>{currentOrder.subtotal.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between text-emerald-500">
                                <span>Déjà payé</span>
                                <span>- {currentOrder.paidAmount.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between items-end pt-2 border-t border-slate-800">
                                <span className="text-white font-bold text-lg">Reste à Payer</span>
                                <span className="text-3xl font-black text-white">{(currentOrder.total - currentOrder.paidAmount).toFixed(2)} €</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button onClick={() => persistOrder()} variant="outline" className="border-slate-700 hover:bg-slate-800">Enregistrer</Button>
                            <Button onClick={() => setShowPaymentModal(true)} variant="secondary" className="bg-emerald-600 hover:bg-emerald-500"><CreditCard size={18}/> Encaisser</Button>
                        </div>
                    </div>
                </div>

                {/* PRODUCT GRID RIGHT */}
                <div className="flex-1 bg-slate-900 flex flex-col">
                    {/* COURSE SELECTOR */}
                    <div className="flex p-2 bg-slate-950 border-b border-slate-800 gap-2 overflow-x-auto no-scrollbar">
                        {[1, 2, 3, 4, 5].map((step: number) => (
                            <button 
                                key={step}
                                onClick={() => setSelectedCourse(step)}
                                className={`flex-1 min-w-[80px] py-3 rounded-lg font-bold text-sm flex flex-col items-center justify-center transition-all border ${selectedCourse === step ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}
                            >
                                <span className="text-[10px] uppercase opacity-70">Service</span>
                                <span className="text-lg">{step}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 p-3 overflow-x-auto border-b border-slate-800 bg-slate-950 no-scrollbar">
                         <button 
                             onClick={() => setSelectedCat('TOUT')}
                             className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${selectedCat === 'TOUT' ? 'bg-white text-slate-900 shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                         >
                             TOUT
                         </button>
                        {categories.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => setSelectedCat(c.name)}
                                className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${selectedCat === c.name ? 'text-white shadow-lg border-2 border-white' : 'bg-slate-800 text-slate-400 hover:text-white border-2 border-transparent'}`}
                                style={{backgroundColor: selectedCat === c.name ? c.color : undefined}}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 content-start">
                        {products.filter(p => selectedCat === 'TOUT' || !selectedCat || p.category === selectedCat).map(p => {
                            const cat = categories.find(c => c.name === p.category);
                            return (
                                <button 
                                    key={p.id}
                                    onClick={() => addToOrder(p)}
                                    className="h-28 bg-slate-800 border-b-4 border-slate-950 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg active:scale-95 active:border-b-0 active:translate-y-1 transition-all hover:bg-slate-700 relative overflow-hidden"
                                >
                                    {cat?.color && <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: cat.color}} />}
                                    <span className="font-bold text-white leading-tight line-clamp-2">{p.name}</span>
                                    <span className="text-indigo-300 font-mono text-sm mt-1">{p.price.toFixed(2)} €</span>
                                    {selectedCourse > 1 && <span className="absolute bottom-1 right-1 bg-black/50 text-[10px] px-1 rounded text-white font-bold">{selectedCourse}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
        
        {/* Modals rendered here... */}
        <CustomerModal isOpen={showCustomerModal} onClose={() => setShowCustomerModal(false)} customers={customers} onSelect={assignCustomer} />
        <Modal isOpen={showItemOptionModal} onClose={() => setShowItemOptionModal(false)} title="Options Article" maxWidth="max-w-sm">
             <div className="space-y-4">
                 <Button onClick={() => applyDiscount('percent', 10)} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white justify-between">
                     <span>Remise 10%</span> <Percent size={18} className="text-indigo-400"/>
                 </Button>
                 <Button onClick={() => applyDiscount('percent', 20)} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white justify-between">
                     <span>Remise 20%</span> <Percent size={18} className="text-indigo-400"/>
                 </Button>
                 <Button onClick={() => applyDiscount('offer', 100)} className="w-full bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-800 text-emerald-400 justify-between">
                     <span>OFFERT (100%)</span> <Gift size={18}/>
                 </Button>
                 <div className="pt-4 border-t border-slate-800">
                     <Button variant="danger" onClick={() => setShowItemOptionModal(false)} className="w-full">Fermer</Button>
                 </div>
             </div>
        </Modal>
        {showPaymentModal && currentOrder && <PaymentModal order={currentOrder} onClose={() => setShowPaymentModal(false)} onProcessPayment={handleProcessPayment} />}
        <Modal isOpen={showZTicketModal} onClose={() => setShowZTicketModal(false)} title="Clôture de Caisse (Z)" maxWidth="max-w-lg">
            {zTicketData && (
                <div className="space-y-6">
                    <div className="bg-white text-slate-900 p-6 rounded-sm shadow-xl font-mono text-sm leading-relaxed">
                        <div className="text-center mb-4 pb-4 border-b border-dashed border-slate-300">
                            <h2 className="text-xl font-black uppercase">{settings.companyName || 'GastroMaster'}</h2>
                            <p>{settings.companyAddress}</p>
                            <p>{settings.companyPhone}</p>
                            <div className="border-b border-dashed border-slate-300 my-2"></div>
                            <p className="font-bold">Ticket Z - Clôture</p>
                            <p className="text-xs text-slate-500">{zTicketData.date}</p>
                            <p className="text-xs">Ouvert par: {session.openedBy}</p>
                        </div>
                        <div className="flex justify-between font-bold text-lg mb-4">
                            <span>TOTAL VENTES</span>
                            <span>{zTicketData.total.toFixed(2)} {settings.currency}</span>
                        </div>
                        {/* Breakdown rendering... */}
                         <div className="mb-4">
                            <p className="font-bold border-b border-slate-300 mb-1">Paiements</p>
                            {Object.entries(zTicketData.payBreakdown).map(([method, amount]: any) => (
                                <div key={method} className="flex justify-between">
                                    <span className="capitalize">{method === 'card' ? 'Carte Bancaire' : 'Espèces'}</span>
                                    <span>{amount.toFixed(2)} {settings.currency}</span>
                                </div>
                            ))}
                        </div>
                        <div className="text-center mt-6 pt-4 border-t border-dashed border-slate-300 text-xs">
                            *** FIN DE SESSION ***
                        </div>
                    </div>
                    <Button onClick={closeSession} variant="danger" className="w-full h-14 text-lg"><Power className="mr-2" /> Valider la Clôture et Fermer</Button>
                </div>
            )}
        </Modal>
    </div>
  );
};