import React, { useState, useEffect } from 'react';
import { LayoutDashboard, History, FileKey, ShieldCheck, FolderOpen } from 'lucide-react';
import GeneratorForm from './components/GeneratorForm';
import HistoryTable from './components/HistoryTable';
const { ipcRenderer } = window.require('electron');

function App() {
    const [activeTab, setActiveTab] = useState('generate');
    const [history, setHistory] = useState([]);

    const loadHistory = async () => {
        const data = await ipcRenderer.invoke('get-history');
        setHistory(data);
    };

    useEffect(() => {
        loadHistory();
    }, []);

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <ShieldCheck className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-none">NadPOS</h1>
                        <p className="text-xs text-slate-400 mt-1">License Manager</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2">
                    <button
                        onClick={() => setActiveTab('generate')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'generate'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                            }`}
                    >
                        <FileKey size={20} />
                        <span className="font-medium">Generate License</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('history'); loadHistory(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'history'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                            }`}
                    >
                        <History size={20} />
                        <span className="font-medium">License History</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-700">
                    <div className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-500">
                        <p>Admin Tool v1.0.0</p>
                        <p>© 2025 Ares Boston Tech</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-slate-900 p-8">
                <div className="max-w-5xl mx-auto">
                    {activeTab === 'generate' ? (
                        <GeneratorForm onSuccess={loadHistory} />
                    ) : (
                        <HistoryTable data={history} onRefresh={loadHistory} />
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
