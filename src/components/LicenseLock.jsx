import React, { useState } from 'react';
import { Lock, Key, AlertTriangle, ShieldCheck } from 'lucide-react';

const LicenseLock = ({ reason, onUnlock, lastOnline, expiry }) => {
    const [key, setKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleActivate = async () => {
        if (!key.trim()) return;
        setLoading(true);
        setError(null);

        try {
            if (window.electron) {
                const result = await window.electron.ipcRenderer.invoke('license-activate', key);
                if (result.success) {
                    onUnlock(); // Muvaffaqiyatli
                } else {
                    setError(result.message || "Noto'g'ri kalit");
                }
            }
        } catch (err) {
            setError("Tizim xatosi: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getMessage = () => {
        switch (reason) {
            case 'expired':
                return (
                    <div className="text-center">
                        <p className="text-red-500 font-bold mb-2">Obuna muddati tugagan!</p>
                        <p className="text-gray-600 text-sm">Amal qilish muddati: {new Date(expiry).toLocaleDateString()}</p>
                    </div>
                );
            case 'time_tampered':
                return (
                    <div className="text-center">
                        <p className="text-red-500 font-bold mb-2">Vaqt xatoligi aniqlandi!</p>
                        <p className="text-gray-600 text-sm">Tizim vaqti orqaga o'zgartirilgan bo'lishi mumkin.</p>
                        <p className="text-gray-500 text-xs mt-1">Oxirgi kirish: {new Date(lastOnline).toLocaleString()}</p>
                    </div>
                );
            case 'no_license':
            default:
                return <p className="text-gray-600">Dasturni ishlatish uchun litsenziya kalitini kiriting.</p>;
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border-t-4 border-indigo-600">

                <div className="mx-auto bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                    <Lock className="w-10 h-10 text-indigo-600" />
                </div>

                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Litsenziya Talab Qilinadi
                </h2>

                <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
                    {getMessage()}
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <Key className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={key}
                            onChange={(e) => setKey(e.target.value.toUpperCase())}
                            placeholder="XXXX-XXXX-XXXX-XXXX"
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono uppercase text-lg"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center justify-center gap-2 text-red-500 text-sm bg-red-50 p-2 rounded-lg">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        onClick={handleActivate}
                        disabled={loading || !key}
                        className={`w-full py-3 rounded-xl font-semibold text-white transition-all transform active:scale-95 flex items-center justify-center gap-2
              ${loading || !key
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30'
                            }`}
                    >
                        {loading ? 'Tekshirilmoqda...' : (
                            <>
                                <ShieldCheck className="w-5 h-5" />
                                Faollashtirish
                            </>
                        )}
                    </button>
                </div>

                <div className="mt-6 text-xs text-gray-400">
                    <p>Yordam kerakmi? +998 90 123 45 67</p>
                    <p className="mt-1">Device ID: {window.navigator.userAgent.slice(0, 20)}...</p>
                </div>

            </div>
        </div>
    );
};

export default LicenseLock;
