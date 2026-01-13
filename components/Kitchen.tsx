import React, { useState, useEffect } from 'react';
import { db, APP_ID } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { Order, Table, OrderItem, Category } from '../types';
import { Utensils, CheckCircle, Clock, ChefHat, Bell, Martini, ArrowDown, Undo2, Flame, List } from 'lucide-react';
import { Modal, Button } from './Shared';

interface KitchenProps {
    onBack: () => void;
}

export const Kitchen: React.FC<KitchenProps> = ({ onBack }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [viewMode, setViewMode] = useState<'kitchen' | 'bar'>('kitchen');
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    useEffect(() => {
        const qOrders = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'orders'), where('status', '==', 'open'), orderBy('updatedAt', 'asc'));
        const unsubOrders = onSnapshot(qOrders, (snap) => {
            setOrders(snap.docs.map(d => ({id: d.id, ...d.data()} as Order)));
        });
        const unsubTables = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'tables'), (snap) => {
            setTables(snap.docs.map(d => ({id: d.id, ...d.data()} as Table)));
        });
        const unsubCats = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'categories'), (snap) => {
             setCategories(snap.docs.map(d => ({id: d.id, ...d.data()} as Category)));
        });
        return () => { unsubOrders(); unsubTables(); unsubCats(); };
    }, []);

    const updateStatus = async (order: Order, course: number, status: 'served' | 'fired') => {
        if (!order.id || !order.kitchenStatus) return;
        const newStatus = { ...order.kitchenStatus, [course]: status };
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', order.id), {
            kitchenStatus: newStatus
        });
    };

    const getTableName = (id: string) => tables.find(t => t.id === id)?.name || 'T?';
    
    const getCategoryDestination = (catName: string) => {
        if (!catName) return 'kitchen'; 
        const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        return cat?.destination || 'kitchen'; 
    };

    const isItemForView = (item: OrderItem) => {
        const dest = getCategoryDestination(item.category || '');
        return dest === viewMode;
    };

    // --- LOGIC: STRICT STATE MACHINE (Prevents Duplicates) ---
    // State 'active':  At least one relevant course is 'fired' (Cooking).
    // State 'waiting': No 'fired' courses, but has at least one relevant course NOT 'served' (Hold).
    // State 'done':    All relevant courses are 'served'. (Disappears from main screens).

    const getOrderState = (o: Order): 'active' | 'waiting' | 'done' => {
        const relevantCourses = [1,2,3,4,5].filter(c => 
            o.items.some(i => (i.course||1) === c && isItemForView(i))
        );

        // If no relevant courses for this view, it's effectively done/invisible
        if (relevantCourses.length === 0) return 'done';

        // 1. Check for Active (Fired)
        const hasFired = relevantCourses.some(c => o.kitchenStatus?.[c] === 'fired');
        if (hasFired) return 'active';

        // 2. Check for Pending (Not Served)
        // If it's not fired, and not served, it's waiting (or 'hold')
        const hasPending = relevantCourses.some(c => o.kitchenStatus?.[c] !== 'served');
        if (hasPending) return 'waiting';

        // 3. Otherwise, everything is served
        return 'done';
    };

    const activeOrders = orders.filter(o => getOrderState(o) === 'active');
    const waitingOrders = orders.filter(o => getOrderState(o) === 'waiting');
    
    // For the "Tout voir" modal, we show 'waiting' AND 'done' orders (excluding active cooking ones)
    // allowing the chef to review history or fix a mistake.
    const historyModalOrders = orders.filter(o => {
        const s = getOrderState(o);
        return s === 'waiting' || s === 'done';
    });

    return (
        <div className="h-screen bg-slate-950 flex flex-col text-white font-sans overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 p-2 px-4 flex justify-between items-center shadow-lg shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg text-white ${viewMode === 'kitchen' ? 'bg-orange-600' : 'bg-purple-600'}`}>
                        {viewMode === 'kitchen' ? <ChefHat size={24} /> : <Martini size={24} />}
                    </div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-wider">Écran {viewMode === 'kitchen' ? 'Cuisine' : 'Bar'}</h1>
                    </div>
                </div>
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button onClick={() => setViewMode('kitchen')} className={`px-4 py-1.5 text-sm rounded-md font-bold transition-all ${viewMode === 'kitchen' ? 'bg-orange-600 text-white' : 'text-slate-500 hover:text-white'}`}>CUISINE</button>
                    <button onClick={() => setViewMode('bar')} className={`px-4 py-1.5 text-sm rounded-md font-bold transition-all ${viewMode === 'bar' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-white'}`}>BAR</button>
                </div>
                <div className="flex items-center gap-4">
                     <div className="text-2xl font-mono font-bold">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                     <button onClick={onBack} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg border border-slate-700 font-bold text-sm">Sortir</button>
                </div>
            </div>

            {/* MAIN ACTIVE GRID */}
            <div className="flex-1 overflow-y-auto p-2 bg-slate-950">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                    {activeOrders.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center h-64 text-slate-700">
                            <Utensils size={48} className="mb-2 opacity-20"/>
                            <p className="font-bold">Aucune commande en préparation</p>
                        </div>
                    )}
                    
                    {activeOrders.map(order => {
                        const viewItems = order.items.filter(i => isItemForView(i));
                        
                        // Show all courses that have items, regardless of status, so we can see what's done/waiting
                        const courses = [1,2,3,4,5].filter(c => {
                            return viewItems.some(i => (i.course||1) === c);
                        });

                        return (
                            <div key={order.id} className="bg-slate-900 border-2 border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col hover:border-indigo-500 transition-all h-fit">
                                {/* Header */}
                                <div className="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
                                    <span className="font-black text-xl text-white">Table {getTableName(order.tableId)}</span>
                                    <span className="text-xs font-mono text-slate-400">{new Date(order.updatedAt?.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                                
                                {/* Courses List */}
                                <div className="bg-slate-950 p-2 space-y-3">
                                    {courses.map(c => {
                                        const status = order.kitchenStatus?.[c] || 'hold'; 
                                        const isFired = status === 'fired';
                                        const isServed = status === 'served';
                                        const cItems = viewItems.filter(i => (i.course||1) === c);
                                        
                                        // Styling based on status
                                        let containerClass = 'bg-slate-900 border-slate-800 opacity-60'; // Hold
                                        let headerClass = 'bg-slate-800 text-slate-500';
                                        let label = 'EN ATTENTE';

                                        if (isFired) {
                                            containerClass = 'bg-orange-950/30 border-orange-500/50';
                                            headerClass = 'bg-orange-600 text-white';
                                            label = 'EN CUISINE';
                                        } else if (isServed) {
                                            containerClass = 'bg-slate-800/50 border-slate-700 grayscale';
                                            headerClass = 'bg-slate-700 text-slate-400';
                                            label = 'TERMINÉ';
                                        }
                                        
                                        return (
                                            <div key={c} className={`rounded-lg border overflow-hidden ${containerClass}`}>
                                                <div className={`px-2 py-1.5 text-[10px] font-bold uppercase flex justify-between items-center ${headerClass}`}>
                                                    <span>{c === 1 ? 'Entrées/Direct' : `Service ${c}`}</span>
                                                    <span>{label}</span>
                                                </div>
                                                <div className="p-2 space-y-1">
                                                    {cItems.map((item, idx) => (
                                                        <div key={idx} className="flex gap-2 items-start">
                                                            <span className={`font-black text-lg min-w-[20px] leading-none ${isFired ? 'text-white' : 'text-slate-500'}`}>{item.qty}</span>
                                                            <span className={`text-sm font-medium leading-tight ${isFired ? 'text-slate-200' : 'text-slate-500 line-through'}`}>{item.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {isFired && (
                                                    <button 
                                                        onClick={() => updateStatus(order, c, 'served')}
                                                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase flex items-center justify-center gap-1 transition-colors"
                                                    >
                                                        <CheckCircle size={14}/> Terminer
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* BOTTOM WAITING QUEUE (Waiting State Only) */}
            <div className="h-40 bg-slate-900 border-t border-slate-800 shrink-0 flex flex-col shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-10">
                <div className="px-4 py-1 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={12} /> Prochains envois (En attente)
                    </span>
                    <div className="flex gap-4 items-center">
                        <span className="text-xs font-mono text-slate-600">{waitingOrders.length} commandes</span>
                        <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-1 text-[10px] uppercase font-bold bg-slate-800 hover:bg-indigo-600 px-3 py-1 rounded transition-colors text-slate-300 hover:text-white border border-slate-700">
                            <List size={12} /> Tout voir (Historique)
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-x-auto p-2 flex gap-2 items-start custom-scrollbar">
                     {waitingOrders.length === 0 && <div className="w-full h-full flex items-center justify-center text-slate-700 text-sm italic">Aucune suite en attente</div>}
                     
                     {waitingOrders.map(order => {
                         // Find highest served course to show context
                         let lastServed = 0;
                         if (order.kitchenStatus) Object.entries(order.kitchenStatus).forEach(([k,v]) => { if(v==='served') lastServed = Math.max(lastServed, parseInt(k)); });
                         
                         const viewItems = order.items.filter(i => isItemForView(i));
                         
                         return (
                            <div 
                                key={order.id} 
                                className="w-40 shrink-0 bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col gap-2 hover:border-slate-600 transition-colors opacity-70 hover:opacity-100"
                            >
                                <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                                    <span className="font-bold text-slate-400">{getTableName(order.tableId)}</span>
                                    {lastServed > 0 ? (
                                        <span className="text-[10px] bg-emerald-900 text-emerald-400 px-1 rounded border border-emerald-800">Svc {lastServed} OK</span>
                                    ) : (
                                        <span className="text-[10px] bg-slate-800 text-slate-500 px-1 rounded border border-slate-700">En attente</span>
                                    )}
                                </div>
                                <div className="flex-1 overflow-hidden space-y-0.5">
                                    {viewItems.slice(0, 3).map((item, idx) => (
                                        <div key={idx} className="text-xs text-slate-500 flex justify-between">
                                            <span>{item.qty} {item.name}</span>
                                        </div>
                                    ))}
                                    {viewItems.length > 3 && <div className="text-[10px] text-slate-600 italic">... +{viewItems.length - 3} autres</div>}
                                </div>
                            </div>
                         );
                     })}
                </div>
            </div>

            {/* FULL HISTORY MODAL (Waiting + Done) */}
            <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="Historique Complet (En attente + Terminés)" maxWidth="max-w-4xl">
                <div className="space-y-4">
                    {historyModalOrders.length === 0 && <div className="text-center text-slate-500 py-10">Aucune commande disponible.</div>}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {historyModalOrders.map(order => {
                            let lastServed = 0;
                            if (order.kitchenStatus) Object.entries(order.kitchenStatus).forEach(([k,v]) => { if(v==='served') lastServed = Math.max(lastServed, parseInt(k)); });
                            const viewItems = order.items.filter(i => isItemForView(i));
                            const isDone = getOrderState(order) === 'done';

                            return (
                                <div key={order.id} className={`bg-slate-950 border p-4 rounded-xl ${isDone ? 'border-slate-800 opacity-60' : 'border-indigo-900/50'}`}>
                                    <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                                        <span className="font-bold text-white text-lg">Table {getTableName(order.tableId)}</span>
                                        <span className="text-xs text-slate-500">{new Date(order.updatedAt?.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div className="space-y-1 mb-3">
                                        {viewItems.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-sm text-slate-400">
                                                <span>{item.qty} x {item.name}</span>
                                                <span className="text-xs opacity-50">Svc {item.course || 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                                        <span className={`text-xs font-bold uppercase ${isDone ? 'text-slate-500' : 'text-indigo-400'}`}>
                                            {isDone ? 'Service Terminé' : `Dernier envoi : Service ${lastServed}`}
                                        </span>
                                        {/* Allow recall for safety */}
                                        <Button variant="outline" className="py-1 px-3 text-xs h-8" onClick={() => updateStatus(order, lastServed || 1, 'fired')}>
                                            <Undo2 size={12} className="mr-1"/> {isDone ? 'Rouvrir' : 'Rappeler'}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Modal>
        </div>
    );
};