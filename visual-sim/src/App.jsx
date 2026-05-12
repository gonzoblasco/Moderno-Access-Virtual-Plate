import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  DoorOpen, 
  DoorClosed, 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Scan, 
  Wifi, 
  Smartphone,
  Cpu
} from 'lucide-react';
import axios from 'axios';
import './index.css';

const socket = io();

// --- Components ---

const WiegandReader = ({ onRead, status }) => {
  const [cardNumber, setCardNumber] = useState('');
  
  const handleSimulate = (e) => {
    e.preventDefault();
    if (!cardNumber) return;
    onRead(cardNumber);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
        <Wifi size={16} className="text-blue-400 animate-pulse" />
      </div>
      
      <div className="flex flex-col items-center gap-6">
        <h3 className="text-zinc-500 font-mono text-xs tracking-widest uppercase">Wiegand RFID Reader</h3>
        
        {/* Visual Scan Zone */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className={`absolute inset-0 rounded-full border-4 transition-colors duration-500 ${
            status === 'granted' ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' :
            status === 'denied' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' :
            'border-zinc-800'
          }`} />
          
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-2 border border-zinc-700 border-dashed rounded-full"
          />

          <div className={`w-16 h-20 rounded-lg border-2 border-zinc-700 flex items-center justify-center bg-zinc-800/50 relative overflow-hidden ${
            status === 'scanning' ? 'bg-blue-900/20' : ''
          }`}>
             <Scan className={`text-zinc-500 ${status === 'scanning' ? 'text-blue-400 animate-bounce' : ''}`} size={32} />
             {status === 'scanning' && (
               <motion.div 
                 initial={{ top: -10 }}
                 animate={{ top: 80 }}
                 transition={{ duration: 0.8, repeat: Infinity }}
                 className="absolute left-0 right-0 h-1 bg-blue-400 shadow-[0_0_10px_#60a5fa] z-10"
               />
             )}
          </div>
          
          {/* LED Indicators */}
          <div className="absolute top-0 flex gap-2">
            <div className={`w-2 h-2 rounded-full shadow-lg ${status === 'granted' ? 'bg-green-500 animate-pulse' : 'bg-zinc-800'}`} />
            <div className={`w-2 h-2 rounded-full shadow-lg ${status === 'denied' ? 'bg-red-500 animate-pulse' : 'bg-zinc-800'}`} />
            <div className={`w-2 h-2 rounded-full shadow-lg ${status === 'idle' ? 'bg-blue-500/50' : 'bg-zinc-800'}`} />
          </div>
        </div>

        <form onSubmit={handleSimulate} className="w-full flex flex-col gap-3">
          <input 
            type="text" 
            placeholder="ENTER CARD ID..." 
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            className="bg-black border border-zinc-800 rounded-lg px-4 py-2 text-center font-mono text-blue-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button 
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-all active:scale-95 shadow-lg shadow-blue-900/20"
          >
            SIMULATE SCAN
          </button>
        </form>
      </div>
    </div>
  );
};

const PhysicalDoor = ({ doorState, relayActive }) => {
  return (
    <div className="flex flex-col items-center gap-6">
      <h3 className="text-zinc-500 font-mono text-xs tracking-widest uppercase">Building Entrance #1</h3>
      
      <div className="relative w-64 h-96 bg-zinc-950 border-4 border-zinc-800 rounded-t-lg overflow-hidden flex perspective-1000">
        
        {/* Frame / Magnet Area */}
        <div className="absolute top-0 inset-x-0 h-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-center">
          <div className={`h-2 w-12 rounded-sm transition-colors duration-300 ${relayActive ? 'bg-zinc-600' : 'bg-red-900 shadow-[0_0_10px_#ef4444]'}`} />
        </div>

        {/* The Door Leaf */}
        <motion.div 
          animate={{ 
            rotateY: doorState === 'OPEN' ? -85 : 0,
            transition: { duration: 0.8, ease: "easeOut" }
          }}
          className="w-full h-full bg-zinc-900/80 border-l-2 border-zinc-800 relative flex items-center justify-center origin-left"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Glass Area */}
          <div className="w-3/4 h-3/4 bg-blue-400/5 border border-white/10 rounded flex flex-col items-center justify-center gap-4">
             <div className="text-[10px] text-blue-400/20 font-mono">REINFORCED GLASS</div>
             {relayActive && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-green-400 text-xs font-mono">DESENERGIZADO</motion.div>}
          </div>
          
          {/* Handle */}
          <div className="absolute right-4 w-1 h-12 bg-zinc-700 rounded-full" />
        </motion.div>
        
        {/* Status Overlay */}
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div 
              key={doorState}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                doorState === 'CLOSED' ? 'bg-zinc-900 text-zinc-500 border-zinc-800' :
                doorState === 'OPEN' ? 'bg-green-900/20 text-green-400 border-green-500' :
                'bg-red-900/20 text-red-400 border-red-500'
              }`}
            >
              {doorState}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      
      <div className="flex gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${relayActive ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-zinc-800'}`} />
          <span className="text-[8px] text-zinc-600 uppercase font-bold">Relay Active</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${doorState === 'OPEN' ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-zinc-800'}`} />
          <span className="text-[8px] text-zinc-600 uppercase font-bold">Mag Sensor</span>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [readerStatus, setReaderStatus] = useState('idle');
  const [doorState, setDoorState] = useState('CLOSED');
  const [relayActive, setRelayActive] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    socket.on('access_granted', (data) => {
      setReaderStatus('granted');
      setLogs(prev => [{ id: Date.now(), msg: `Access Granted: ${data.user}`, type: 'success' }, ...prev]);
      setTimeout(() => setReaderStatus('idle'), 3000);
    });

    socket.on('access_denied', (data) => {
      setReaderStatus('denied');
      setLogs(prev => [{ id: Date.now(), msg: `Denied: Card ${data.cardNumber}`, type: 'error' }, ...prev]);
      setTimeout(() => setReaderStatus('idle'), 3000);
    });

    socket.on('relay_on', () => setRelayActive(true));
    socket.on('relay_off', () => setRelayActive(false));
    socket.on('door_open', () => setDoorState('OPEN'));
    socket.on('door_close', () => setDoorState('CLOSED'));

    return () => socket.off();
  }, []);

  const handleRead = async (cardNumber) => {
    setReaderStatus('scanning');
    try {
      await axios.post('/api/simulate-wiegand', { cardNumber });
    } catch (err) {
      console.error(err);
      setReaderStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-8 font-sans selection:bg-blue-500/30">
      <header className="max-w-6xl mx-auto flex justify-between items-end mb-12 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
            <Cpu className="text-blue-500" /> PHYSICAL SIM <span className="text-zinc-600 text-lg font-normal">v1.0</span>
          </h1>
          <p className="text-zinc-500 font-mono text-xs mt-1">Environment Monitoring & Hardware Injection</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono text-zinc-400">BRIDGE CONNECTED</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Column 1: Lector */}
        <div className="flex flex-col gap-6">
          <WiegandReader onRead={handleRead} status={readerStatus} />
          
          <div className="bg-zinc-900/50 border border-zinc-800/50 p-4 rounded-xl">
             <h4 className="text-zinc-500 text-[10px] font-bold uppercase mb-4 flex items-center gap-2">
               <Activity size={12} /> System Health
             </h4>
             <div className="space-y-3">
               <div className="flex justify-between items-center">
                 <span className="text-xs text-zinc-400">Firmware Bridge</span>
                 <span className="text-xs text-green-500 font-mono">1ms</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-xs text-zinc-400">CGI Persistence</span>
                 <span className="text-xs text-blue-500 font-mono">ACTIVE</span>
               </div>
             </div>
          </div>
        </div>

        {/* Column 2: Puerta */}
        <div className="md:col-span-1 flex justify-center bg-zinc-900/20 rounded-3xl p-8 border border-zinc-800/50">
          <PhysicalDoor doorState={doorState} relayActive={relayActive} />
        </div>

        {/* Column 3: Monitor */}
        <div className="flex flex-col gap-4">
          <h3 className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">Live Activity Monitor</h3>
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl h-[500px] overflow-y-auto p-4 flex flex-col gap-2 shadow-inner">
            <AnimatePresence initial={false}>
              {logs.map(log => (
                <motion.div 
                  key={log.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className={`p-3 rounded-lg border text-[11px] font-mono flex items-center gap-3 ${
                    log.type === 'success' ? 'bg-green-900/10 border-green-900/30 text-green-400' :
                    'bg-red-900/10 border-red-900/30 text-red-400'
                  }`}
                >
                  {log.type === 'success' ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                  <div>
                    <div className="font-bold uppercase tracking-tighter">{log.msg}</div>
                    <div className="opacity-50 text-[9px]">{new Date(log.id).toLocaleTimeString()}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {logs.length === 0 && (
              <div className="h-full flex items-center justify-center text-zinc-700 text-xs italic">
                Awaiting hardware events...
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto mt-12 pt-6 border-t border-zinc-900 text-center">
        <div className="text-[10px] text-zinc-700 uppercase tracking-widest flex items-center justify-center gap-8">
           <span className="flex items-center gap-1"><Zap size={10} /> Powered by Moderno Access</span>
           <span className="flex items-center gap-1"><Smartphone size={10} /> Digital Twin Simulation</span>
        </div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
