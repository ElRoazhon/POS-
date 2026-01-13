import React from 'react';
import { Clock, Store, ClipboardCheck, ChevronRight, LogOut, Shield, ChefHat } from 'lucide-react';
import { Employee } from '../types';

interface AppSelectionProps {
  user: Employee | 'admin';
  onSelectApp: (app: 'pointage' | 'caisse' | 'hygiene' | 'admin' | 'kitchen') => void;
  onLogout: () => void;
}

export const AppSelection: React.FC<AppSelectionProps> = ({ user, onSelectApp, onLogout }) => {
  const isAdmin = user === 'admin';
  const perms = isAdmin ? ['all'] : user.permissions || [];

  const canAccess = (app: string) => isAdmin || perms.includes(app) || (app === 'kitchen' && perms.includes('cuisine'));

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 p-6 max-w-lg mx-auto">
      <div className="w-full space-y-4">
        {isAdmin && (
           <button onClick={() => onSelectApp('admin')} className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center justify-between group hover:border-indigo-500/50 transition-all">
             <div className="flex items-center gap-6">
               <div className="bg-slate-800 p-4 rounded-2xl text-indigo-400">
                 <Shield size={32} />
               </div>
               <div className="text-left">
                 <h3 className="text-2xl font-bold text-white">Administration</h3>
                 <p className="text-slate-400 text-sm">Gestion globale</p>
               </div>
             </div>
             <ChevronRight className="text-slate-600 group-hover:text-white transition-colors" />
           </button>
        )}

        {canAccess('pointage') && (
          <button onClick={() => onSelectApp('pointage')} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 p-6 rounded-3xl shadow-xl flex items-center justify-between group hover:scale-[1.02] transition-all">
            <div className="flex items-center gap-6">
              <div className="bg-white/20 p-4 rounded-2xl text-white">
                <Clock size={32} />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold text-white">Pointage</h3>
                <p className="text-indigo-100 text-sm">Gestion des heures</p>
              </div>
            </div>
            <ChevronRight className="text-white/50 group-hover:text-white transition-colors" />
          </button>
        )}

        {canAccess('caisse') && (
          <button onClick={() => onSelectApp('caisse')} className="w-full bg-gradient-to-r from-red-600 to-orange-600 p-6 rounded-3xl shadow-xl flex items-center justify-between group hover:scale-[1.02] transition-all">
            <div className="flex items-center gap-6">
              <div className="bg-white/20 p-4 rounded-2xl text-white">
                <Store size={32} />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold text-white">Caisse</h3>
                <p className="text-red-100 text-sm">Encaissement & Plan</p>
              </div>
            </div>
            <ChevronRight className="text-white/50 group-hover:text-white transition-colors" />
          </button>
        )}
        
        {/* KITCHEN BUTTON */}
        {(isAdmin || canAccess('caisse') || canAccess('cuisine')) && (
            <button onClick={() => onSelectApp('kitchen')} className="w-full bg-gradient-to-r from-orange-600 to-amber-600 p-6 rounded-3xl shadow-xl flex items-center justify-between group hover:scale-[1.02] transition-all">
            <div className="flex items-center gap-6">
              <div className="bg-white/20 p-4 rounded-2xl text-white">
                <ChefHat size={32} />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold text-white">Écran (Cuisine/Bar)</h3>
                <p className="text-orange-100 text-sm">Affichage Commandes</p>
              </div>
            </div>
            <ChevronRight className="text-white/50 group-hover:text-white transition-colors" />
          </button>
        )}

        {canAccess('hygiene') && (
          <button onClick={() => onSelectApp('hygiene')} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 p-6 rounded-3xl shadow-xl flex items-center justify-between group hover:scale-[1.02] transition-all">
            <div className="flex items-center gap-6">
              <div className="bg-white/20 p-4 rounded-2xl text-white">
                <ClipboardCheck size={32} />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold text-white">Hygiène</h3>
                <p className="text-emerald-100 text-sm">HACCP & Traçabilité</p>
              </div>
            </div>
            <ChevronRight className="text-white/50 group-hover:text-white transition-colors" />
          </button>
        )}

        <button onClick={onLogout} className="w-full py-4 mt-8 rounded-2xl border border-red-900/50 bg-red-900/20 text-red-400 font-bold hover:bg-red-900 hover:text-white transition-colors flex items-center justify-center gap-2">
           <LogOut size={20} /> Déconnexion
        </button>
      </div>
    </div>
  );
};