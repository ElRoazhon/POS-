import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Package, UtensilsCrossed, Upload, 
  Loader, Save, Trash2, Plus, Grid, Map, ShieldCheck, LogOut, 
  TrendingUp, Receipt, DollarSign, Calendar, BarChart3, ArrowUpRight, ArrowDownRight, Settings, AlertTriangle, Printer, Edit2, Palette, X
} from 'lucide-react';
import { db, APP_ID } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, deleteDoc, doc, updateDoc, where, getDocs, setDoc } from 'firebase/firestore';
import { Employee, Product, InvoiceItemCandidate, Category, Table, HygieneTask, Order, CashSession, AppSettings } from '../types';
import { Button, Input, Modal, Select } from './Shared';
import { analyzeInvoiceImage } from '../services/geminiService';

// --- HELPER COMPONENTS ---

const MenuBtn: React.FC<{
  icon: any;
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, desc, active, onClick }) => (
  <button 
    onClick={onClick} 
    className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all group text-left ${active ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800'}`}
  >
    <div className={`p-3 rounded-lg ${active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'}`}>
      <Icon size={24} />
    </div>
    <div>
      <h3 className={`font-bold ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{label}</h3>
      <p className={`text-xs ${active ? 'text-indigo-200' : 'text-slate-500'}`}>{desc}</p>
    </div>
  </button>
);

const Header: React.FC<{
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <header className="bg-slate-900/50 border-b border-slate-800 p-8 flex justify-between items-end backdrop-blur-sm sticky top-0 z-10">
    <div>
      <h2 className="text-3xl font-black text-white mb-2">{title}</h2>
      <p className="text-slate-400">{subtitle}</p>
    </div>
    <div>{children}</div>
  </header>
);

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: any;
  color: string;
}> = ({ title, value, icon: Icon, color }) => {
  const colors: {[key:string]: string} = {
    emerald: "text-emerald-400 bg-emerald-900/20 border-emerald-900/50",
    indigo: "text-indigo-400 bg-indigo-900/20 border-indigo-900/50",
    blue: "text-blue-400 bg-blue-900/20 border-blue-900/50",
  };
  const theme = colors[color] || colors.indigo;

  return (
    <div className={`p-6 rounded-2xl border ${theme.split(' ')[2]} ${theme.split(' ')[1]}`}>
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-xl ${theme.split(' ')[1]} ${theme.split(' ')[0]}`}>
           <Icon size={24} />
        </div>
        <span className={`font-bold uppercase tracking-widest text-xs ${theme.split(' ')[0]}`}>{title}</span>
      </div>
      <div className="text-4xl font-black text-white">{value}</div>
    </div>
  );
};

interface AdminProps {
    onBack: () => void;
    onLogout: () => void;
}

export const Admin: React.FC<AdminProps> = ({ onBack, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'products' | 'tables' | 'users' | 'hygiene' | 'stats' | 'settings'>('products');
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [users, setUsers] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<HygieneTask[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ country: 'FR', defaultTax: 10, currency: '€', adminCode: '1976' });
  
  // Finance Data
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);

  // Modals & Form State
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<InvoiceItemCandidate[]>([]);
  
  // Z Detail Modal
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);

  // Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetInput, setResetInput] = useState("");

  // Products Editing
  const [productForm, setProductForm] = useState<{id?: string, name: string, price: string, category: string, color?: string}>({ name: '', price: '', category: '' });
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [showDeleteModal, setShowDeleteModal] = useState<{type: string, id: string} | null>(null);
  const [newCatName, setNewCatName] = useState("");

  // Table Editing
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [draggingTable, setDraggingTable] = useState<{id: string, x: number, y: number} | null>(null);

  // User Editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [newUserCode, setNewUserCode] = useState("");
  const [newUserPerms, setNewUserPerms] = useState<string[]>([]);

  // Task Editing
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskZone, setNewTaskZone] = useState("Cuisine");

  useEffect(() => {
    // Core Data
    const unsubProds = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'products')), s => setProducts(s.docs.map(d => ({id:d.id, ...d.data()} as Product))));
    const unsubCats = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'categories')), s => setCategories(s.docs.map(d => ({id:d.id, ...d.data()} as Category))));
    const unsubTables = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'tables')), s => setTables(s.docs.map(d => ({id:d.id, ...d.data()} as Table))));
    const unsubUsers = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'employees')), s => setUsers(s.docs.map(d => ({id:d.id, ...d.data()} as Employee))));
    const unsubTasks = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'hygiene_tasks')), s => setTasks(s.docs.map(d => ({id:d.id, ...d.data()} as HygieneTask))));
    const unsubSettings = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'config'), (s) => {
        if (s.exists()) setSettings(s.data() as AppSettings);
    });

    // Finance Data
    const unsubOrders = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'orders'), where('status', '==', 'paid')), s => setAllOrders(s.docs.map(d => ({id:d.id, ...d.data()} as Order))));
    const unsubSessions = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'cash_sessions'), orderBy('openedAt', 'desc')), s => setSessions(s.docs.map(d => ({id:d.id, ...d.data()} as CashSession))));

    return () => { unsubProds(); unsubCats(); unsubTables(); unsubUsers(); unsubTasks(); unsubOrders(); unsubSessions(); unsubSettings(); };
  }, []);

  // --- ACTIONS ---

  // 1. PRODUCTS
  const handleProductSubmit = async () => {
      if(!productForm.name || !productForm.price) return;
      const data = {
          name: productForm.name,
          price: parseFloat(productForm.price),
          category: productForm.category || 'Divers',
          updatedAt: Timestamp.now()
      };

      if (productForm.id) {
          await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'products', productForm.id), data);
      } else {
          await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'products'), {
              ...data, createdAt: Timestamp.now()
          });
          // Check create category
          if (!categories.find(c => c.name === productForm.category)) {
              await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'categories'), { name: productForm.category, order: 99, color: '#64748b', destination: 'kitchen' });
          }
      }
      setProductForm({ name: '', price: '', category: '' });
  };

  const handleEditProduct = (p: Product) => {
      setProductForm({ id: p.id, name: p.name, price: p.price.toString(), category: p.category });
  };

  const handleAddCategory = async () => {
      if(!newCatName.trim()) return;
      try {
          await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'categories'), {
              name: newCatName,
              order: categories.length + 1,
              color: '#64748b',
              destination: 'kitchen'
          });
          setNewCatName("");
      } catch (e) {
          console.error(e);
      }
  };

  const handleUpdateCategory = async (catId: string, data: any) => {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'categories', catId), data);
  };

  const confirmDelete = async () => {
      if (!showDeleteModal) return;
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', showDeleteModal.type, showDeleteModal.id));
      setShowDeleteModal(null);
  };

  // 2. TABLES
  const addTable = async () => {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'tables'), {
          name: `T-${tables.length + 1}`, x: 50, y: 50, width: 80, height: 80, shape: 'square'
      });
  };
  const updateTable = async (id: string, data: Partial<Table>) => {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'tables', id), data);
  };

  // 3. SETTINGS
  const saveSettings = async () => {
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'config'), settings);
      alert("Paramètres enregistrés !");
  };

  // 4. USERS & PERMISSIONS
  const togglePerm = (perm: string) => {
    setNewUserPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const handleUserSubmit = async () => {
    if (!newUserName || newUserCode.length !== 4) return;
    
    const userData = {
        name: newUserName,
        code: newUserCode,
        permissions: newUserPerms,
        role: 'staff' as const,
        createdAt: Timestamp.now()
    };

    try {
        if (editingUserId) {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'employees', editingUserId), {
                name: newUserName,
                code: newUserCode,
                permissions: newUserPerms
            });
            alert("Employé mis à jour !");
        } else {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'employees'), userData);
            alert("Employé ajouté !");
        }
        // Reset form
        setEditingUserId(null);
        setNewUserName("");
        setNewUserCode("");
        setNewUserPerms([]);
        
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'opération.");
    }
  };

  const handleEditUser = (u: Employee) => {
      setEditingUserId(u.id);
      setNewUserName(u.name);
      setNewUserCode(u.code);
      setNewUserPerms(u.permissions || []);
  };

  const cancelEditUser = () => {
      setEditingUserId(null);
      setNewUserName("");
      setNewUserCode("");
      setNewUserPerms([]);
  };

  // 5. HYGIENE
  const addTask = async () => {
    if (!newTaskName) return;
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'hygiene_tasks'), {
        name: newTaskName,
        zone: newTaskZone,
        frequency: 'daily'
      });
      setNewTaskName("");
    } catch (e) {
      console.error(e);
    }
  };

  // 6. INVOICE IMPORT
  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        setScanImage(base64);
        setIsScanning(true);
        try {
            const result = await analyzeInvoiceImage(base64);
            if (result && result.items) {
                setScannedItems(result.items);
            }
        } catch (error) {
            console.error("Analysis failed", error);
            alert("Erreur d'analyse IA");
        } finally {
            setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const saveScannedItems = async () => {
      let importedCount = 0;
      for (const item of scannedItems) {
          const catExists = categories.find(c => c.name.toLowerCase() === item.category.toLowerCase());
          if (!catExists) {
              await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'categories'), {
                  name: item.category, order: 99, color: '#64748b', destination: 'kitchen'
              });
          }

          await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'products'), {
              name: item.name,
              price: item.price,
              category: catExists ? catExists.name : item.category,
              createdAt: Timestamp.now()
          });
          importedCount++;
      }
      alert(`${importedCount} articles importés avec succès !`);
      setScannedItems([]);
      setScanImage(null);
      setShowScanModal(false);
  };

  // 7. PRINTING
  const handlePrintZ = () => {
      const printContent = document.getElementById('printable-z-ticket');
      const win = window.open('', '', 'width=400,height=600');
      if (win && printContent) {
          win.document.write(`
            <html>
                <head>
                    <title>Ticket Z</title>
                    <style>
                        body { font-family: monospace; padding: 20px; text-align: center; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                        .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
                        .bold { font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12px; }
                        th { text-align: left; border-bottom: 1px solid #000; }
                        td { padding: 4px 0; }
                        h2 { margin: 0; }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                </body>
            </html>
          `);
          win.document.close();
          win.focus();
          win.print();
          win.close();
      }
  };

  // 8. RESET & DELETE
  const handleFactoryReset = () => {
      setShowResetModal(true);
      setResetInput("");
  };
  
  const executeFactoryReset = async () => {
      if(resetInput !== 'RESET') return;

      const collectionsToWipe = ['orders', 'products', 'categories', 'tables', 'cash_sessions', 'hygiene_logs', 'hygiene_tasks', 'customers', 'employees'];
      
      let deletedCount = 0;
      for (const colName of collectionsToWipe) {
          const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', colName));
          const snap = await getDocs(q);
          const promises = snap.docs.map(d => deleteDoc(d.ref));
          await Promise.all(promises);
          deletedCount += promises.length;
      }
      alert(`Site réinitialisé avec succès. ${deletedCount} documents supprimés.`);
      window.location.reload();
  };

  const handleDeleteSessionClick = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); 
      setShowDeleteModal({type: 'cash_sessions', id: id});
  };

  // --- STATS CALCULATION ---
  const calculateStats = () => {
      // Logic Update: Stats are now derived from the SUM of existing SESSIONS (Z-Tickets)
      // This ensures that deleting a history log updates the revenue.
      
      const totalRevenue = sessions.reduce((acc, s) => acc + (s.totalSales || 0), 0);
      
      // Since order count isn't strictly stored in session summary in old versions,
      // we filter the allOrders list to only include orders that belong to the remaining sessions.
      const validSessionIds = new Set(sessions.map(s => s.id));
      const validOrders = allOrders.filter(o => validSessionIds.has(o.sessionId || '') || o.status === 'paid'); 
      // Note: '|| o.status === paid' is a fallback for legacy orders without sessionId, 
      // but ideally we should strictly link them. For user request "updated when I delete closing history",
      // strictly filtering by validSessionIds is the most accurate behavior.
      
      const filteredOrders = allOrders.filter(o => o.sessionId && validSessionIds.has(o.sessionId));
      
      const totalOrdersCount = filteredOrders.length;
      const avgBasket = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

      // Top selling still comes from product aggregation of valid orders
      const prodStats: {[key:string]: {qty: number, revenue: number}} = {};
      filteredOrders.forEach(o => {
          o.items.forEach(i => {
              if(!prodStats[i.name]) prodStats[i.name] = { qty: 0, revenue: 0 };
              prodStats[i.name].qty += i.qty;
              prodStats[i.name].revenue += (i.qty * i.price);
          });
      });

      const sortedByQty = Object.entries(prodStats).map(([name, data]) => ({name, ...data})).sort((a,b) => b.qty - a.qty);
      const sortedByRev = Object.entries(prodStats).map(([name, data]) => ({name, ...data})).sort((a,b) => b.revenue - a.revenue);

      return {
          totalRevenue,
          totalOrders: totalOrdersCount,
          avgBasket,
          topSelling: sortedByQty.slice(0, 5),
          worstSelling: sortedByQty.slice(-5).reverse(),
          topRevenue: sortedByRev.slice(0, 5)
      };
  };

  const stats = calculateStats();
  const filteredProducts = productFilter === 'ALL' ? products : products.filter(p => p.category === productFilter);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
        {/* SIDEBAR */}
        <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col p-6 shadow-2xl z-20">
            <div className="mb-10">
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">ADMIN</h1>
                <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">GastroMaster V2</p>
            </div>
            
            <nav className="space-y-3 flex-1">
                <MenuBtn icon={TrendingUp} label="Finance & Stats" active={activeTab==='stats'} onClick={() => setActiveTab('stats')} desc="CA, Rapports Z, Tops" />
                <MenuBtn icon={Package} label="Carte & Stocks" active={activeTab==='products'} onClick={() => setActiveTab('products')} desc="Produits, Prix, Import IA" />
                <MenuBtn icon={Map} label="Salle & Tables" active={activeTab==='tables'} onClick={() => setActiveTab('tables')} desc="Plan de salle visuel" />
                <MenuBtn icon={Users} label="Équipe & Accès" active={activeTab==='users'} onClick={() => setActiveTab('users')} desc="Employés, Codes, Droits" />
                <MenuBtn icon={ShieldCheck} label="HACCP & Hygiène" active={activeTab==='hygiene'} onClick={() => setActiveTab('hygiene')} desc="Plan de nettoyage" />
                <MenuBtn icon={Settings} label="Paramètres" active={activeTab==='settings'} onClick={() => setActiveTab('settings')} desc="Config & Reset" />
            </nav>

            <div className="space-y-3 pt-6 border-t border-slate-800">
                 <Button variant="outline" onClick={onBack} className="w-full justify-start border-slate-700 text-slate-400 hover:text-white">
                    <Grid size={18} /> Voir Applications
                 </Button>
                 <Button variant="danger" onClick={onLogout} className="w-full justify-start bg-red-900/20 text-red-400 border-red-900/30 hover:bg-red-900">
                    <LogOut size={18} /> Déconnexion
                 </Button>
            </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-hidden relative bg-slate-950 flex flex-col">
            
            {/* 0. STATS & FINANCE TAB */}
            {activeTab === 'stats' && (
                <div className="h-full flex flex-col overflow-y-auto custom-scrollbar">
                    <Header title="Tableau de Bord Financier" subtitle="Suivi d'activité et Rapports Z" />
                    
                    <div className="p-8 space-y-8">
                        {/* KPIS */}
                        <div className="grid grid-cols-3 gap-6">
                            <StatCard title="Chiffre d'Affaires Global" value={`${stats.totalRevenue.toFixed(2)} €`} icon={DollarSign} color="emerald" />
                            <StatCard title="Nombre de Commandes" value={stats.totalOrders.toString()} icon={Receipt} color="indigo" />
                            <StatCard title="Panier Moyen" value={`${stats.avgBasket.toFixed(2)} €`} icon={BarChart3} color="blue" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Z HISTORY RIGHT */}
                            <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col h-[600px]">
                                <div className="p-6 border-b border-slate-800 bg-slate-900/50">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        <Receipt className="text-slate-400" /> Historique des Clôtures (Z)
                                    </h3>
                                </div>
                                <div className="flex-1 overflow-y-auto p-0">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-950 text-xs text-slate-500 uppercase font-bold sticky top-0">
                                            <tr>
                                                <th className="p-4">Date</th>
                                                <th className="p-4">Resp.</th>
                                                <th className="p-4 text-right">Total</th>
                                                <th className="p-4 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {sessions.map(s => {
                                                const date = s.closedAt ? new Date(s.closedAt.seconds * 1000) : (s.openedAt ? new Date(s.openedAt.seconds * 1000) : new Date());
                                                return (
                                                    <tr key={s.id} onClick={() => setSelectedSession(s)} className="hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                                        <td className="p-4 group-hover:text-indigo-300">
                                                            <div className="font-bold">{date.toLocaleDateString()}</div>
                                                            <div className="text-xs text-slate-500">{date.toLocaleTimeString()}</div>
                                                        </td>
                                                        <td className="p-4 text-sm text-slate-300">{s.openedBy}</td>
                                                        <td className="p-4 text-right font-mono font-bold text-emerald-400">
                                                            {s.totalSales?.toFixed(2)} €
                                                        </td>
                                                        <td className="p-4 text-center flex items-center justify-center gap-2">
                                                           <Button variant="outline" className="py-1 px-3 text-xs h-8">Voir Détail</Button>
                                                           <button onClick={(e) => handleDeleteSessionClick(e, s.id!)} className="w-8 h-8 rounded-lg bg-red-900/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                                                <Trash2 size={14} />
                                                           </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. PRODUCTS TAB */}
            {activeTab === 'products' && (
                <div className="h-full flex flex-col">
                    <Header title="Gestion de la Carte" subtitle="Trier, Modifier, Supprimer">
                        <Button variant="secondary" onClick={() => setShowScanModal(true)}>
                            <Upload className="mr-2" size={18} /> Import Facture IA
                        </Button>
                    </Header>
                    
                    <div className="flex-1 overflow-y-auto p-8">
                        {/* FORM & FILTER - PARALLEL LAYOUT (50/50) */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                             {/* CATEGORY CONFIG */}
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg overflow-y-auto max-h-[300px] custom-scrollbar">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-white text-sm">Catégories & Écrans</h3>
                                </div>
                                
                                <div className="flex gap-2 mb-4">
                                    <Input 
                                        placeholder="Nouvelle cat..." 
                                        value={newCatName} 
                                        onChange={(e) => setNewCatName(e.target.value)} 
                                        className="py-1 text-xs"
                                    />
                                    <Button onClick={handleAddCategory} className="py-1 px-3"><Plus size={16}/></Button>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <button onClick={() => setProductFilter('ALL')} className={`px-3 py-1 text-xs rounded-full border ${productFilter === 'ALL' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>TOUT</button>
                                        {categories.map(c => (
                                             <button key={c.id} onClick={() => setProductFilter(c.name)} className={`px-3 py-1 text-xs rounded-full border border-slate-700 ${productFilter === c.name ? 'text-white font-bold bg-slate-700' : 'text-slate-400 bg-slate-800'}`} style={{borderColor: c.color}}>{c.name}</button>
                                        ))}
                                    </div>
                                    <hr className="border-slate-800 my-1"/>
                                    {/* Category Config */}
                                    <div className="space-y-1">
                                        {categories.map(c => (
                                            <div key={c.id} className="flex items-center gap-2 bg-slate-950/50 p-1.5 rounded border border-slate-800">
                                                <input type="color" value={c.color || '#64748b'} onChange={(e) => handleUpdateCategory(c.id, {color: e.target.value})} className="w-6 h-6 rounded border-none cursor-pointer bg-transparent shrink-0" />
                                                <input 
                                                    className="bg-transparent text-xs font-bold text-slate-300 flex-1 border-none focus:outline-none focus:text-white"
                                                    value={c.name}
                                                    onChange={(e) => handleUpdateCategory(c.id, {name: e.target.value})}
                                                />
                                                <select 
                                                    value={c.destination || 'kitchen'} 
                                                    onChange={(e) => handleUpdateCategory(c.id, {destination: e.target.value})}
                                                    className="bg-slate-900 text-xs text-indigo-300 border border-slate-700 rounded p-1 focus:outline-none w-20"
                                                >
                                                    <option value="kitchen">Cuisine</option>
                                                    <option value="bar">Bar</option>
                                                    <option value="none">Aucun</option>
                                                </select>
                                                <button onClick={() => setShowDeleteModal({type: 'categories', id: c.id})} className="text-red-500 hover:text-white"><Trash2 size={12}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* PRODUCT FORM */}
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
                                <h3 className="font-bold text-white mb-4">{productForm.id ? 'Modifier le Produit' : 'Nouveau Produit'}</h3>
                                <div className="flex flex-col gap-4">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nom</label>
                                            <Input placeholder="Burger" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} />
                                        </div>
                                        <div className="w-24">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Prix</label>
                                            <Input placeholder="0.00" type="number" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-end">
                                         <div className="flex-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Catégorie</label>
                                            <Input placeholder="Plats" list="cat-suggestions" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} />
                                            <datalist id="cat-suggestions">{categories.map(c => <option key={c.id} value={c.name}/>)}</datalist>
                                        </div>
                                        <Button onClick={handleProductSubmit} disabled={!productForm.name} className="h-[46px]">
                                            {productForm.id ? <Save size={20}/> : <Plus size={20}/>}
                                        </Button>
                                        {productForm.id && <Button variant="outline" onClick={() => setProductForm({name:'', price:'', category:''})} className="h-[46px]">Annuler</Button>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* List */}
                        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
                            <table className="w-full text-left">
                                <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-bold border-b border-slate-800">
                                    <tr>
                                        <th className="p-4">Produit</th>
                                        <th className="p-4">Catégorie</th>
                                        <th className="p-4 text-right">Prix</th>
                                        <th className="p-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {filteredProducts.map(p => {
                                        const cat = categories.find(c => c.name === p.category);
                                        return (
                                        <tr key={p.id} className="hover:bg-slate-800/50 transition-colors group">
                                            <td className="p-4 font-bold text-white">{p.name}</td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 rounded text-xs font-bold uppercase border border-slate-700 text-white" style={{backgroundColor: cat?.color || '#64748b'}}>{p.category}</span>
                                            </td>
                                            <td className="p-4 text-right font-mono text-emerald-400 font-bold">{p.price.toFixed(2)} €</td>
                                            <td className="p-4 text-center flex items-center justify-center gap-2">
                                                <button onClick={() => handleEditProduct(p)} className="text-slate-500 hover:text-white p-2 bg-slate-800 rounded-lg"><Edit2 size={16}/></button>
                                                <button onClick={() => setShowDeleteModal({type: 'products', id: p.id})} className="text-red-900 hover:text-red-400 p-2 bg-red-900/10 rounded-lg"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. TABLES TAB */}
            {activeTab === 'tables' && (
                <div className="h-full flex flex-col">
                    <Header title="Plan de Salle" subtitle="Glissez pour déplacer • Cliquez pour éditer">
                        <Button onClick={addTable}><Plus className="mr-2" size={18} /> Ajouter Table</Button>
                    </Header>
                    <div className="flex-1 flex">
                        <div className="flex-1 bg-slate-900 m-8 mr-0 rounded-3xl border border-slate-800 relative floor-grid overflow-hidden shadow-inner">
                            {tables.map(t => {
                                // OPTIMIZED DRAG LOGIC: Use local state if dragging, else DB state
                                const displayX = (draggingTable?.id === t.id) ? draggingTable.x : t.x;
                                const displayY = (draggingTable?.id === t.id) ? draggingTable.y : t.y;
                                
                                return (
                                <div 
                                    key={t.id}
                                    className={`absolute bg-slate-800 border-2 ${selectedTable?.id === t.id ? 'border-white z-50' : 'border-indigo-500/50'} hover:border-indigo-400 hover:bg-slate-700 text-white flex items-center justify-center font-bold cursor-move shadow-xl rounded-xl group transition-all`}
                                    style={{
                                        left: `${displayX}px`, top: `${displayY}px`, width: `${t.width}px`, height: `${t.height}px`,
                                        borderRadius: t.shape === 'round' ? '50%' : '12px',
                                        overflow: 'hidden'
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setSelectedTable(t);
                                        const startX = e.clientX - t.x;
                                        const startY = e.clientY - t.y;
                                        
                                        // Track position locally during drag to avoid DB spam
                                        let currentX = t.x;
                                        let currentY = t.y;

                                        const moveHandler = (moveEvent: MouseEvent) => {
                                            currentX = moveEvent.clientX - startX;
                                            currentY = moveEvent.clientY - startY;
                                            setDraggingTable({ id: t.id, x: currentX, y: currentY });
                                        };

                                        const upHandler = () => {
                                            document.removeEventListener('mousemove', moveHandler);
                                            document.removeEventListener('mouseup', upHandler);
                                            setDraggingTable(null); // Clear local override
                                            updateTable(t.id, { x: currentX, y: currentY }); // Commit ONE write
                                        };

                                        document.addEventListener('mousemove', moveHandler);
                                        document.addEventListener('mouseup', upHandler);
                                    }}
                                >
                                    <span>{t.name}</span>
                                </div>
                            )})}
                        </div>
                        {/* Table Editor Sidebar */}
                        <div className="w-64 bg-slate-950 border-l border-slate-800 p-6 flex flex-col gap-4">
                             {selectedTable ? (
                                 <>
                                    <h3 className="font-bold text-white">Éditer Table</h3>
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase font-bold">Nom (Tapez et cliquez ailleurs)</label>
                                        <Input 
                                            value={selectedTable.name} 
                                            onChange={(e) => setSelectedTable({...selectedTable, name: e.target.value})} 
                                            onBlur={() => updateTable(selectedTable.id, {name: selectedTable.name})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase font-bold">Forme</label>
                                        <div className="flex gap-2 mt-1">
                                            <button onClick={() => updateTable(selectedTable.id, {shape: 'round'})} className={`p-2 rounded border text-xs flex-1 transition-colors ${selectedTable.shape === 'round' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Rond</button>
                                            <button onClick={() => updateTable(selectedTable.id, {shape: 'square'})} className={`p-2 rounded border text-xs flex-1 transition-colors ${selectedTable.shape === 'square' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Carré</button>
                                        </div>
                                    </div>
                                    <div className="pt-4 mt-auto">
                                        <Button variant="danger" className="w-full" onClick={() => { setShowDeleteModal({type: 'tables', id: selectedTable.id}); setSelectedTable(null); }}>Supprimer</Button>
                                    </div>
                                 </>
                             ) : <div className="text-slate-500 text-sm text-center mt-10">Sélectionnez une table</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. USERS TAB */}
            {activeTab === 'users' && (
                <div className="h-full flex flex-col">
                    <Header title="Gestion de l'Équipe" subtitle="Codes d'accès et permissions">
                         <div className="bg-slate-800 px-4 py-2 rounded-lg text-xs font-mono text-indigo-300 border border-slate-700">Code Admin: {settings.adminCode}</div>
                    </Header>
                    {/* ... Existing User UI ... */}
                    <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden">
                        {/* Create/Edit User */}
                        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 h-fit shadow-lg">
                            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                                {editingUserId ? <Edit2 size={20} className="text-indigo-500"/> : <Plus size={20} className="text-indigo-500"/>}
                                {editingUserId ? 'Modifier Employé' : 'Nouvel Employé'}
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nom Prénom</label>
                                    <Input placeholder="Ex: Thomas C." value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Code PIN (4 chiffres)</label>
                                    <Input placeholder="1234" maxLength={4} value={newUserCode} onChange={e => setNewUserCode(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Accès Autorisés</label>
                                    <div className="space-y-2">
                                        {['caisse', 'cuisine', 'bar', 'pointage', 'hygiene'].map(perm => (
                                            <label key={perm} className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer hover:border-indigo-500 transition-colors">
                                                <input type="checkbox" checked={newUserPerms.includes(perm)} onChange={() => togglePerm(perm)} className="accent-indigo-500 w-4 h-4" />
                                                <span className="capitalize font-bold text-slate-300">{perm}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    {editingUserId && <Button variant="outline" onClick={cancelEditUser} className="flex-1">Annuler</Button>}
                                    <Button className="flex-1" onClick={handleUserSubmit} disabled={!newUserName || newUserCode.length !== 4}>
                                        {editingUserId ? 'Mettre à jour' : 'Créer le profil'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* List */}
                        <div className="lg:col-span-2 space-y-4 overflow-y-auto pb-20 custom-scrollbar">
                            {users.map(u => (
                                <div key={u.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between group hover:border-slate-700 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xl text-white shadow-lg">
                                            {u.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white text-lg">{u.name}</h4>
                                            <div className="flex gap-2 mt-1 flex-wrap">
                                                {u.permissions?.map(p => (
                                                    <span key={p} className="text-[10px] uppercase font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">{p}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500 uppercase font-bold">Code PIN</div>
                                            <div className="font-mono text-xl text-white tracking-widest">****</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleEditUser(u)} className="w-10 h-10 rounded-lg bg-slate-800 text-indigo-400 flex items-center justify-center hover:bg-indigo-900 hover:text-white transition-all">
                                                <Edit2 size={20} />
                                            </button>
                                            <button onClick={() => setShowDeleteModal({type: 'employees', id: u.id})} className="w-10 h-10 rounded-lg bg-red-900/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 4. HYGIENE TAB */}
            {activeTab === 'hygiene' && (
                <div className="h-full flex flex-col">
                     <Header title="Plan de Maîtrise Sanitaire (HACCP)" subtitle="Configurez les tâches de nettoyage quotidiennes">
                        <div className="flex gap-2">
                             <Input placeholder="Nouvelle tâche..." value={newTaskName} onChange={e => setNewTaskName(e.target.value)} className="w-64" />
                             <Select value={newTaskZone} onChange={e => setNewTaskZone(e.target.value)} className="w-40">
                                 <option value="Cuisine">Cuisine</option>
                                 <option value="Salle">Salle</option>
                                 <option value="Bar">Bar</option>
                                 <option value="Toilettes">Toilettes</option>
                             </Select>
                             <Button onClick={addTask}><Plus size={20}/></Button>
                        </div>
                    </Header>
                    {/* ... Existing Hygiene UI ... */}
                    <div className="flex-1 p-8 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {['Cuisine', 'Salle', 'Bar', 'Toilettes'].map(zone => (
                                <div key={zone} className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-col gap-3">
                                    <h3 className="font-black text-slate-500 uppercase tracking-widest text-sm border-b border-slate-800 pb-2 mb-2">{zone}</h3>
                                    {tasks.filter(t => t.zone === zone).map(t => (
                                        <div key={t.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center group">
                                            <span className="font-medium text-slate-300 text-sm">{t.name}</span>
                                            <button onClick={() => setShowDeleteModal({type: 'hygiene_tasks', id: t.id})} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 5. SETTINGS TAB */}
            {activeTab === 'settings' && (
                <div className="h-full flex flex-col items-center p-8 overflow-y-auto custom-scrollbar">
                    <div className="max-w-2xl w-full space-y-8">
                        {/* Company Info */}
                        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Settings className="text-indigo-400"/> Configuration Générale</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nom de l'établissement</label>
                                    <Input value={settings.companyName || ''} onChange={e => setSettings({...settings, companyName: e.target.value})} placeholder="Ma Super Brasserie" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Adresse</label>
                                    <Input value={settings.companyAddress || ''} onChange={e => setSettings({...settings, companyAddress: e.target.value})} placeholder="123 Rue de la République" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Téléphone</label>
                                        <Input value={settings.companyPhone || ''} onChange={e => setSettings({...settings, companyPhone: e.target.value})} placeholder="01 23 45 67 89" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Devise</label>
                                        <Input value={settings.currency || '€'} onChange={e => setSettings({...settings, currency: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Code Administrateur</label>
                                    <Input value={settings.adminCode || '1976'} onChange={e => setSettings({...settings, adminCode: e.target.value})} maxLength={4} />
                                </div>
                                <Button onClick={saveSettings} className="w-full mt-4">Enregistrer les paramètres</Button>
                            </div>
                        </div>

                        {/* Reset Zone */}
                        <div className="bg-red-950/20 border border-red-900/50 p-8 rounded-3xl shadow-xl text-center">
                            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                                 <AlertTriangle size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Zone de Danger</h2>
                            <p className="text-slate-400 mb-6 text-sm">
                                La réinitialisation d'usine effacera toutes les données. Cette action est irréversible.
                            </p>
                            <Button variant="danger" onClick={handleFactoryReset} className="w-full">
                                <Trash2 className="mr-2" size={18} /> Réinitialiser le Site
                            </Button>
                        </div>
                    </div>
                </div>
            )}

        </main>

        {/* INVOICE SCAN MODAL */}
        <Modal isOpen={showScanModal} onClose={() => setShowScanModal(false)} title="Importation IA (Gemini Vision)" maxWidth="max-w-5xl">
             <div className="flex gap-8 h-[65vh]">
                <div className="w-1/3 bg-slate-950 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group hover:border-indigo-500 transition-colors">
                    {scanImage ? (
                        <img src={scanImage} className="w-full h-full object-contain" />
                    ) : (
                        <div className="text-center text-slate-500 p-6">
                            <Upload className="mx-auto mb-4 text-indigo-500" size={48}/>
                            <p className="text-lg font-bold text-white mb-2">Glisser une facture</p>
                            <p className="text-sm">ou cliquer pour parcourir</p>
                        </div>
                    )}
                    <input type="file" onChange={handleInvoiceUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                    {isScanning && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-indigo-400 backdrop-blur-sm z-10">
                            <Loader className="animate-spin mb-4" size={48} />
                            <span className="font-bold text-xl animate-pulse">Analyse Gemini en cours...</span>
                        </div>
                    )}
                </div>

                <div className="w-2/3 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xl font-bold text-white">Articles Détectés <span className="text-indigo-400 text-sm ml-2">({scannedItems.length})</span></h4>
                        {scannedItems.length > 0 && <Button onClick={() => setScannedItems([])} variant="outline" className="text-xs py-1 h-8">Tout effacer</Button>}
                    </div>
                    
                    <div className="flex-1 bg-slate-900 rounded-xl overflow-y-auto p-2 space-y-2 mb-6 border border-slate-800 shadow-inner custom-scrollbar">
                        {scannedItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 hover:border-indigo-500/30 transition-colors">
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Nom</label>
                                    <input value={item.name} onChange={(e) => { const n = [...scannedItems]; n[idx].name = e.target.value; setScannedItems(n); }} className="bg-transparent text-white font-bold w-full focus:outline-none focus:text-indigo-400" />
                                </div>
                                <div className="w-32">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Catégorie</label>
                                    <input value={item.category} onChange={(e) => { const n = [...scannedItems]; n[idx].category = e.target.value; setScannedItems(n); }} className="bg-slate-900 text-indigo-300 text-xs font-bold uppercase rounded p-1 w-full text-center border border-slate-700 focus:border-indigo-500 focus:outline-none" />
                                </div>
                                <div className="w-24 text-right">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Prix</label>
                                    <input type="number" value={item.price} onChange={(e) => { const n = [...scannedItems]; n[idx].price = parseFloat(e.target.value); setScannedItems(n); }} className="bg-transparent text-emerald-400 font-mono text-right w-full focus:outline-none font-bold" />
                                </div>
                                <button onClick={() => setScannedItems(scannedItems.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-red-400 p-2"><Trash2 size={16} /></button>
                            </div>
                        ))}
                        {scannedItems.length === 0 && !isScanning && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600">
                                <UtensilsCrossed size={48} className="mb-4 opacity-20" />
                                <p>En attente d'une image...</p>
                            </div>
                        )}
                    </div>
                    <Button onClick={saveScannedItems} disabled={scannedItems.length === 0} className="w-full py-4 text-lg shadow-xl shadow-indigo-900/20">
                        <Save className="mr-2" size={24} /> Valider l'importation
                    </Button>
                </div>
            </div>
        </Modal>

        {/* SESSION DETAIL MODAL (FULL RECEIPT) */}
        <Modal isOpen={!!selectedSession} onClose={() => setSelectedSession(null)} title="Détail Clôture" maxWidth="max-w-lg">
            {selectedSession && (
                <div className="space-y-6">
                     <div id="printable-z-ticket" className="bg-white text-slate-900 p-6 rounded-sm shadow-xl font-mono text-sm leading-relaxed">
                        <div className="text-center mb-4 pb-4 border-b border-dashed border-slate-300">
                            <h2 className="text-xl font-black uppercase">{settings.companyName || 'GastroMaster'}</h2>
                            <p>{settings.companyAddress}</p>
                            <p>{settings.companyPhone}</p>
                            <div className="divider"></div>
                            <p className="bold">DUPLICATA TICKET Z</p>
                            <p className="text-xs">Date: {new Date(selectedSession.closedAt?.seconds * 1000).toLocaleString()}</p>
                            <p className="text-xs">Resp: {selectedSession.openedBy}</p>
                        </div>

                        {selectedSession.productBreakdown && (
                             <div className="mb-4">
                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            <th>Produit</th>
                                            <th className="text-center">Qté</th>
                                            <th className="text-right">HT</th>
                                            <th className="text-right">TTC</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    {Object.entries(selectedSession.productBreakdown).map(([name, data]: any) => {
                                        // Fallback logic for old sessions that didn't have HT/VAT stored
                                        const qty = data.qty || 0;
                                        const totalTTC = data.totalTTC || data.total || 0;
                                        const totalHT = data.totalHT || (totalTTC / (1 + (settings.defaultTax/100))); 
                                        
                                        return (
                                        <tr key={name}>
                                            <td>{name}</td>
                                            <td className="text-center">{qty}</td>
                                            <td className="text-right">{totalHT.toFixed(2)}</td>
                                            <td className="text-right">{totalTTC.toFixed(2)}</td>
                                        </tr>
                                    )})}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="divider"></div>

                        <div className="row bold text-lg">
                            <span>TOTAL VENTES</span>
                            <span>{selectedSession.totalSales.toFixed(2)} {settings.currency}</span>
                        </div>

                        <div className="divider"></div>

                        {selectedSession.paymentBreakdown && (
                            <div className="mb-4">
                                <p className="bold">Règlements</p>
                                {Object.entries(selectedSession.paymentBreakdown).map(([method, amount]: any) => (
                                    <div key={method} className="row">
                                        <span className="capitalize">{method === 'card' ? 'CB' : 'Espèces'}</span>
                                        <span>{amount.toFixed(2)} {settings.currency}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedSession.taxBreakdown && (
                            <div className="mb-4">
                                <p className="bold">TVA</p>
                                {Object.entries(selectedSession.taxBreakdown).map(([rate, data]: any) => (
                                    <div key={rate} className="row text-xs">
                                        <span>TVA {rate}% (sur {data.base.toFixed(2)})</span>
                                        <span>{data.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="text-center mt-6 pt-4 border-t border-dashed border-slate-300 text-xs">
                            *** FIN DE SESSION ***
                        </div>
                     </div>
                     <div className="flex gap-2">
                         <Button onClick={handlePrintZ} className="flex-1 bg-slate-700 hover:bg-slate-600">
                             <Printer size={18} className="mr-2"/> Imprimer / PDF
                         </Button>
                         <Button variant="outline" onClick={() => setSelectedSession(null)} className="flex-1">Fermer</Button>
                     </div>
                </div>
            )}
        </Modal>

        {/* DELETE CONFIRMATION MODAL */}
        <Modal isOpen={!!showDeleteModal} onClose={() => setShowDeleteModal(null)} title="Confirmation de suppression" maxWidth="max-w-sm">
            <div className="text-center">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                    <Trash2 size={32} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Êtes-vous sûr ?</h3>
                <p className="text-slate-400 mb-6">Cette action est irréversible. L'élément sera définitivement supprimé.</p>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setShowDeleteModal(null)} className="flex-1">Annuler</Button>
                    <Button variant="danger" onClick={confirmDelete} className="flex-1">Supprimer</Button>
                </div>
            </div>
        </Modal>

        {/* FACTORY RESET CONFIRMATION MODAL */}
        <Modal isOpen={showResetModal} onClose={() => setShowResetModal(false)} title="ZONE DANGER : RÉINITIALISATION" maxWidth="max-w-md">
            <div className="space-y-6 text-center">
                <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mx-auto text-red-500 animate-pulse">
                    <AlertTriangle size={40} />
                </div>
                <div>
                    <p className="text-white font-bold text-lg mb-2">Êtes-vous absolument sûr ?</p>
                    <p className="text-slate-400 text-sm">Cette action effacera TOUTES les données (Commandes, Produits, Employés, Config...). C'est irréversible.</p>
                </div>
                
                <div className="bg-red-950/30 p-4 rounded-xl border border-red-900/50">
                    <label className="text-xs text-red-400 font-bold uppercase block mb-2">Tapez "RESET" pour confirmer</label>
                    <Input 
                        value={resetInput} 
                        onChange={(e) => setResetInput(e.target.value)} 
                        placeholder="RESET"
                        className="text-center font-bold tracking-widest uppercase border-red-900 focus:border-red-500"
                    />
                </div>

                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setShowResetModal(false)} className="flex-1">Annuler</Button>
                    <Button 
                        variant="danger" 
                        onClick={executeFactoryReset} 
                        disabled={resetInput !== 'RESET'}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        TOUT EFFACER
                    </Button>
                </div>
            </div>
        </Modal>
    </div>
  );
};