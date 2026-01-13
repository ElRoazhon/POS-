import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { AppSelection } from './components/AppSelection';
import { POS } from './components/POS';
import { Hygiene } from './components/Hygiene';
import { Admin } from './components/Admin';
import { Kitchen } from './components/Kitchen';
import { Employee } from './types';
import { db, APP_ID } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const App: React.FC = () => {
  const [user, setUser] = useState<Employee | 'admin' | null>(null);
  const [currentApp, setCurrentApp] = useState<'selection' | 'pointage' | 'caisse' | 'hygiene' | 'admin' | 'kitchen'>('selection');
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    // Fetch employees to validate codes during login
    const unsub = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });
    return () => unsub();
  }, []);

  const handleLogin = (loggedInUser: Employee | 'admin') => {
    setUser(loggedInUser);
    if (loggedInUser === 'admin') {
      // Direct access for Admin as requested
      setCurrentApp('admin'); 
    } else {
      // Employees go to app selection based on permissions
      setCurrentApp('selection');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentApp('selection');
  };

  if (!user) {
    return <Login employees={employees} onLogin={handleLogin} />;
  }

  if (currentApp === 'selection') {
    return <AppSelection user={user} onSelectApp={setCurrentApp} onLogout={handleLogout} />;
  }

  if (currentApp === 'caisse') {
    return <POS user={user} onBack={() => user === 'admin' ? setCurrentApp('admin') : setCurrentApp('selection')} />;
  }
  
  if (currentApp === 'kitchen') {
    return <Kitchen onBack={() => user === 'admin' ? setCurrentApp('admin') : setCurrentApp('selection')} />;
  }

  if (currentApp === 'hygiene') {
    return <Hygiene user={user} onBack={() => user === 'admin' ? setCurrentApp('admin') : setCurrentApp('selection')} />;
  }

  if (currentApp === 'admin') {
      // Admin can go back to selection to test apps, or logout
      return <Admin onBack={() => setCurrentApp('selection')} onLogout={handleLogout} />;
  }

  // Placeholder for Pointage
  return (
    <div className="h-screen flex items-center justify-center bg-slate-900 text-white flex-col gap-4">
      <h1 className="text-2xl font-bold">Module Pointage</h1>
      <p className="text-slate-400">En cours de développement...</p>
      <button onClick={() => setCurrentApp('selection')} className="bg-indigo-600 px-6 py-2 rounded-lg font-bold">Retour</button>
    </div>
  );
};

export default App;