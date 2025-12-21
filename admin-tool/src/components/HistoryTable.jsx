import React, { useState } from 'react';
import { Search, RefreshCw, Calendar, User, Key } from 'lucide-react';

export default function HistoryTable({ data, onRefresh }) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = data.filter(item =>
        item.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.hwid.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">License History</h2>
                    <p className="text-slate-400">All generated licenses are stored here locally.</p>
                </div>
                <button
                    onClick={onRefresh}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Toolbar */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search by Client or HWID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900/50 uppercase text-xs font-bold text-slate-200">
                            <tr>
                                <th className="px-6 py-4">Client</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Expiry</th>
                                <th className="px-6 py-4">HWID</th>
                                <th className="px-6 py-4">Issued At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {filteredData.length > 0 ? (
                                filteredData.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                                            <User size={16} className="text-blue-400" />
                                            {item.client_name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.type === 'lifetime' ? 'bg-purple-500/10 text-purple-400' : 'bg-green-500/10 text-green-400'}`}>
                                                {item.type.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={16} />
                                                {item.expiry === 'NEVER' ? 'Lifetime' : new Date(item.expiry).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                            {item.hwid}
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            {new Date(item.issued_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        No licenses found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
