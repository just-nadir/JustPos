import React, { useState } from 'react';
import { Lock, Unlock, DollarSign, X } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';

// Smenani ochish/yopish modali
const ShiftModal = ({ mode, onClose }) => {
    const { user, showToast, checkShift } = useGlobal();
    const [amount, setAmount] = useState('');
    const [cardAmount, setCardAmount] = useState(''); // YANGI
    const [loading, setLoading] = useState(false);

    const isClosing = mode === 'close';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!window.electron) return;

        setLoading(true);
        try {
            const { ipcRenderer } = window.electron;
            const cashAmount = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0;
            const cardAmountVal = parseFloat(cardAmount.replace(/[^0-9.]/g, '')) || 0;

            if (isClosing) {
                // Smenani yopish
                await ipcRenderer.invoke('shift-close', { endCash: cashAmount, endCard: cardAmountVal });
                showToast('success', "Smena yopildi va Z-Report yuborildi!");
            } else {
                // Smenani ochish
                if (!user) {
                    showToast('error', "Iltimos, avval tizimga kiring!");
                    return;
                }
                await ipcRenderer.invoke('shift-open', { cashierName: user.name, startCash: cashAmount });
                showToast('success', "Smena muvaffaqiyatli ochildi!");
            }

            await checkShift(); // Global state yangilash
            onClose();
        } catch (err) {
            console.error(err);
            showToast('error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-[400px] border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        {isClosing ? <Lock className="text-red-500" /> : <Unlock className="text-green-500" />}
                        {isClosing ? "Smenani Yopish" : "Smenani Ochish"}
                    </h2>
                    {!isClosing && (
                        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                            <X size={20} className="text-gray-500" />
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* NAQD PUL INPUT */}
                    <div>
                        <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">
                            {isClosing ? "Haqiqiy Naqd Pul (Kassadagi)" : "Kassa Boshlang'ich Puli"}
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <DollarSign className="text-gray-400" size={20} />
                            </div>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0"
                                autoFocus
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-xl font-bold text-gray-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* TERMINAL INPUT (Faqat yopishda) */}
                    {isClosing && (
                        <div>
                            <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">
                                Haqiqiy Terminal (Z-Report)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <DollarSign className="text-gray-400" size={20} />
                                </div>
                                <input
                                    type="number"
                                    value={cardAmount}
                                    onChange={(e) => setCardAmount(e.target.value)}
                                    placeholder="0"
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-xl font-bold text-gray-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                />
                            </div>
                            <p className="text-xs text-blue-500 mt-2 font-medium">
                                ℹ️ Click va Payme tushumlari tizim tomonidan avtomatik hisoblanadi.
                            </p>
                        </div>
                    )}

                    {isClosing && (
                        <p className="text-xs text-gray-400 mt-2 font-medium">
                            ⚠️ Smena yopilganda Z-Report avtomatik Telegramga yuboriladi va printerdan chiqadi.
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transform active:scale-95 transition-all
              ${isClosing
                                ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-200 hover:shadow-red-300'
                                : 'bg-gradient-to-r from-green-500 to-green-600 shadow-green-200 hover:shadow-green-300'
                            } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? "Bajarilmoqda..." : (isClosing ? "YOPISH VA Z-REPORT" : "SMENANI OCHISH")}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ShiftModal;
