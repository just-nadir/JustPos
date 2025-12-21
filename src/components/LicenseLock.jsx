import React, { useState, useEffect } from 'react';
import { Lock, FileText, RefreshCw, ShieldAlert, PcCase } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

const LicenseLock = ({ reason, onUnlock, expiry, hwid }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [currentHwid, setCurrentHwid] = useState(hwid || 'Loading...');

    useEffect(() => {
        if (!hwid && window.electron) {
            window.electron.ipcRenderer.invoke('license-get-hwid').then(id => setCurrentHwid(id));
        }
    }, [hwid]);

    const handleGenerateRequest = async () => {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await window.electron.ipcRenderer.invoke('license-create-request');
            if (res.success) {
                setSuccessMsg(`Fayl yaratildi: ${res.path}`);
            } else {
                setError(res.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckAgain = async () => {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const result = await onUnlock(); // checkLicense ni chaqiradi
            if (!result) {
                setError("Litsenziya fayli topilmadi yoki yaroqsiz.");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getMessage = () => {
        switch (reason) {
            case 'expired':
                return (
                    <div className="text-center mb-4">
                        <p className="text-red-500 font-bold text-lg">⚠️ Obuna muddati tugagan!</p>
                        <p className="text-gray-600">Amal qilish muddati: {expiry ? formatDate(expiry) : 'Noma\'lum'}</p>
                    </div>
                );
            case 'hwid_mismatch':
                return <p className="text-red-500 font-bold mb-4">⚠️ Litsenziya boshqa kompyuter uchun!</p>;
            case 'missing_file':
            default:
                return (
                    <div className="mb-4">
                        <p className="text-gray-700 font-medium">Ushbu qurilma uchun litsenziya topilmadi.</p>
                        <p className="text-gray-500 text-sm mt-1">Dasturdan foydalanish uchun litsenziya faylini joylashtiring.</p>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                <div className="mx-auto bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mb-6 ring-8 ring-indigo-50">
                    <Lock className="w-10 h-10 text-indigo-600" />
                </div>

                <h2 className="text-3xl font-bold text-gray-800 mb-2">Blocklangan</h2>
                {getMessage()}

                <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200 text-left">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Sizning Hardware ID:</p>
                    <div className="flex items-center justify-between">
                        <code className="bg-white px-2 py-1 rounded border text-indigo-600 font-mono font-bold select-all">{currentHwid}</code>
                        <button onClick={() => navigator.clipboard.writeText(currentHwid)} className="text-xs text-blue-500 hover:underline">Copy</button>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleGenerateRequest}
                        disabled={loading}
                        className="w-full py-4 rounded-xl font-bold bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                        <PcCase size={20} />
                        So'rov faylini yaratish (.hid)
                    </button>

                    {successMsg && (
                        <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm border border-green-200 animate-in fade-in zoom-in">
                            ✅ {successMsg}
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 animate-in fade-in zoom-in flex items-center justify-center gap-2">
                            <ShieldAlert size={16} /> {error}
                        </div>
                    )}

                    <button
                        onClick={handleCheckAgain}
                        disabled={loading}
                        className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 shadow-xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {loading ? <RefreshCw className="animate-spin" /> : <FileText />}
                        Litsenziya faylini tekshirish
                    </button>
                </div>

                <div className="mt-8 text-xs text-gray-400">
                    <p>JustPos License System v2.1 (Auto-Gen)</p>
                </div>
            </div>
        </div>
    );
};

export default LicenseLock;
