import React, { useState, useEffect } from 'react';
import { Check, Trash2, Camera, Loader } from 'lucide-react';
import { db, APP_ID } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { HygieneLog, Employee, HygieneTask } from '../types';
import { Button, Input, Modal } from './Shared';
import { analyzeTraceabilityLabel } from '../services/geminiService';
import { ClipboardCheck } from 'lucide-react';

interface HygieneProps {
  user: Employee | 'admin';
  onBack: () => void;
}

export const Hygiene: React.FC<HygieneProps> = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState<'clean' | 'temp' | 'trace'>('clean');
  const [logs, setLogs] = useState<HygieneLog[]>([]);
  const [tasks, setTasks] = useState<HygieneTask[]>([]); // Dynamic tasks
  const [loading, setLoading] = useState(false);

  // Traceability State
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [traceImage, setTraceImage] = useState<string | null>(null);
  const [traceProduct, setTraceProduct] = useState("");
  const [traceQty, setTraceQty] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const userName = user === 'admin' ? 'Admin' : user.name;

  useEffect(() => {
    // Listen to Logs
    const qLogs = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'hygiene_logs'), orderBy('date', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snap) => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as HygieneLog))));
    
    // Listen to Tasks Configured in Admin
    const qTasks = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'hygiene_tasks'));
    const unsubTasks = onSnapshot(qTasks, (snap) => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as HygieneTask))));

    return () => { unsubLogs(); unsubTasks(); };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        setTraceImage(base64);
        setIsAnalyzing(true);
        const result = await analyzeTraceabilityLabel(base64);
        setIsAnalyzing(false);
        if (result) {
            if (result.productName) setTraceProduct(result.productName);
            if (result.quantity) setTraceQty(result.quantity);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const saveTraceability = async () => {
    if (!traceProduct || !traceImage) return alert("Image et Nom requis");
    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'hygiene_logs'), {
        type: 'traceability',
        productName: traceProduct,
        quantity: traceQty,
        image: traceImage,
        user: userName,
        date: Timestamp.now()
      });
      setShowTraceModal(false); setTraceImage(null); setTraceProduct(""); setTraceQty("");
    } catch (e) {
      console.error(e);
      alert("Erreur de sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const logTask = async (taskId: string, name: string) => {
    const today = new Date().toDateString();
    const existing = logs.find(l => l.type === 'clean' && l.itemId === taskId && l.date.toDate().toDateString() === today);
    
    if (existing) {
        if(existing.id) await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'hygiene_logs', existing.id));
    } else {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'hygiene_logs'), {
            type: 'clean', itemId: taskId, itemName: name, value: true, user: userName, date: Timestamp.now()
        });
    }
  };

  const todayStr = new Date().toDateString();
  const zones = Array.from(new Set(tasks.map(t => t.zone)));

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shadow-md z-10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck size={24} className="text-emerald-500" />
            HACCP Control
          </h2>
          <p className="text-xs text-slate-400">Opérateur: {userName}</p>
        </div>
        <Button variant="danger" onClick={onBack} className="py-2 px-4 text-sm">Quitter</Button>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex p-4 gap-2 bg-slate-900/50">
          <button onClick={() => setActiveTab('clean')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'clean' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>Nettoyage</button>
          <button onClick={() => setActiveTab('temp')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'temp' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>Températures</button>
          <button onClick={() => setActiveTab('trace')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'trace' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>Traçabilité</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'clean' && (
            <div className="space-y-6">
                {tasks.length === 0 && <div className="text-center text-slate-500 mt-10">Aucune tâche configurée. Demandez à l'admin.</div>}
                
                {zones.map(zone => (
                    <div key={zone}>
                        <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-3 ml-2">{zone}</h3>
                        <div className="grid gap-3">
                            {tasks.filter(t => t.zone === zone).map(t => {
                                const isDone = logs.some(l => l.type === 'clean' && l.itemId === t.id && l.date.toDate().toDateString() === todayStr);
                                return (
                                <div key={t.id} onClick={() => logTask(t.id, t.name)} className={`p-4 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${isDone ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
                                    <div>
                                        <h4 className={`font-bold text-lg ${isDone ? 'text-emerald-400' : 'text-white'}`}>{t.name}</h4>
                                        <p className="text-xs text-slate-500 uppercase">{t.frequency}</p>
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isDone ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                        {isDone && <Check className="text-white" size={24} />}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
          )}

          {activeTab === 'trace' && (
            <>
              <Button onClick={() => setShowTraceModal(true)} className="w-full mb-6 py-4 flex items-center justify-center gap-2">
                <Camera /> Scanner une étiquette
              </Button>
              <div className="space-y-3">
                {logs.filter(l => l.type === 'traceability').map(l => (
                    <div key={l.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex gap-4">
                        <div className="w-20 h-20 bg-black rounded-lg overflow-hidden shrink-0">
                            {l.image && <img src={l.image} alt="Trace" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-white">{l.productName}</h4>
                            <p className="text-indigo-400 font-medium">{l.quantity}</p>
                            <p className="text-xs text-slate-500 mt-1">{l.date.toDate().toLocaleString()} par {l.user}</p>
                        </div>
                    </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'temp' && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <p>Relevés de températures</p>
                  <p className="text-xs">Module bientôt disponible</p>
              </div>
          )}
        </div>
      </div>

      <Modal isOpen={showTraceModal} onClose={() => setShowTraceModal(false)} title="Traçabilité IA">
        <div className="space-y-4">
            <div className="relative w-full h-48 bg-slate-950 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center overflow-hidden group hover:border-indigo-500 transition-colors">
                {traceImage ? (
                    <>
                        <img src={traceImage} className="w-full h-full object-contain opacity-50 group-hover:opacity-30 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            {isAnalyzing ? <div className="bg-black/70 px-4 py-2 rounded-full flex items-center gap-2 text-indigo-400"><Loader className="animate-spin" size={16}/> Analyse IA...</div> : <span className="text-white font-bold drop-shadow-md">Scanner à nouveau</span>}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center text-slate-500">
                        <Camera size={40} className="mb-2" />
                        <span className="text-sm font-bold">Prendre photo</span>
                    </div>
                )}
                <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
            </div>

            <div className="space-y-2">
                <label className="text-xs uppercase font-bold text-slate-400">Produit (Détecté)</label>
                <Input value={traceProduct} onChange={e => setTraceProduct(e.target.value)} placeholder="Nom du produit" />
            </div>
            
            <div className="space-y-2">
                <label className="text-xs uppercase font-bold text-slate-400">Quantité / Poids</label>
                <Input value={traceQty} onChange={e => setTraceQty(e.target.value)} placeholder="Ex: 500g" />
            </div>

            <Button onClick={saveTraceability} disabled={loading || isAnalyzing} className="w-full mt-4">
                {loading ? 'Sauvegarde...' : 'Valider'}
            </Button>
        </div>
      </Modal>
    </div>
  );
};