import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { Delete } from 'lucide-react';
import { db, APP_ID } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

interface LoginProps {
  employees: Employee[];
  onLogin: (user: Employee | 'admin') => void;
}

export const Login: React.FC<LoginProps> = ({ employees, onLogin }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [adminCode, setAdminCode] = useState("1976"); // Default fallback

  useEffect(() => {
    // Fetch dynamic admin code
    const fetchSettings = async () => {
        try {
            const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'config'));
            if (snap.exists() && snap.data().adminCode) {
                setAdminCode(snap.data().adminCode);
            }
        } catch (e) {
            console.error("Error fetching settings", e);
        }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (code.length === 4) {
      handleVerify();
    }
  }, [code]);

  const handleVerify = () => {
    if (code === adminCode) {
      onLogin('admin');
      return;
    }
    const emp = employees.find(e => e.code === code);
    if (emp) {
      onLogin(emp);
    } else {
      setError(true);
      setTimeout(() => {
        setCode("");
        setError(false);
      }, 1000);
    }
  };

  const handleNum = (n: string) => {
    if (code.length < 4) setCode(prev => prev + n);
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 p-6">
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
          GastroMaster
        </h1>
        <p className="text-slate-400">Authentification</p>
      </div>

      <div className="flex gap-4 mb-8 h-8 items-center">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${i < code.length ? 'bg-indigo-500 scale-125 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-800'}`} />
        ))}
      </div>

      <div className={`text-red-400 font-bold h-6 mb-4 transition-opacity ${error ? 'opacity-100' : 'opacity-0'}`}>
        Code incorrect
      </div>

      <div className="grid grid-cols-3 gap-4 w-80">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button 
            key={n} 
            onClick={() => handleNum(n.toString())}
            className="h-20 rounded-2xl bg-slate-900 border border-slate-800 text-2xl font-bold text-slate-200 shadow-[0_4px_0_#0f172a] active:translate-y-1 active:shadow-none transition-all hover:bg-slate-800"
          >
            {n}
          </button>
        ))}
        <div />
        <button 
          onClick={() => handleNum("0")}
          className="h-20 rounded-2xl bg-slate-900 border border-slate-800 text-2xl font-bold text-slate-200 shadow-[0_4px_0_#0f172a] active:translate-y-1 active:shadow-none transition-all hover:bg-slate-800"
        >
          0
        </button>
        <button 
          onClick={() => setCode("")}
          className="h-20 rounded-2xl bg-slate-900 border border-red-900/30 text-red-400 flex items-center justify-center shadow-[0_4px_0_#0f172a] active:translate-y-1 active:shadow-none transition-all hover:bg-red-900/10"
        >
          <Delete size={32} />
        </button>
      </div>
    </div>
  );
};