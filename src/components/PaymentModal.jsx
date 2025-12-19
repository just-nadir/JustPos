import React, { useState, useEffect } from 'react';
import { X, Banknote, CreditCard, Smartphone, FileText, AlertCircle, Calendar, Plus, Trash2, Divide } from 'lucide-react';

const PaymentModal = ({ isOpen, onClose, totalAmount, onPay, selectedCustomer }) => {
  if (!isOpen) return null;

  const [activeMethod, setActiveMethod] = useState('cash');
  const [error, setError] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState([]);

  // To'lov turlari
  const paymentMethods = [
    { id: 'cash', label: 'Naqd', icon: <Banknote size={24} /> },
    { id: 'card', label: 'Karta', icon: <CreditCard size={24} /> },
    { id: 'click', label: 'Click / Payme', icon: <Smartphone size={24} /> },
    { id: 'debt', label: 'Nasiya (Qarz)', icon: <FileText size={24} /> },
  ];

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (isSplitPayment) {
        // Initialize split payments if totalAmount changes or modal opens
        if (splitPayments.length === 0 || splitPayments[0].amount !== totalAmount) {
          setSplitPayments([{ id: Date.now(), method: 'cash', amount: totalAmount, dueDate: '' }]);
        }
      } else {
        setActiveMethod('cash');
        setDueDate('');
      }
    }
  }, [isOpen, totalAmount, isSplitPayment]);



  const handlePayment = () => {
    setError('');

    if (isSplitPayment) {
      const totalSplitAmount = splitPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      if (totalSplitAmount !== totalAmount) {
        setError("Bo'lingan to'lovlar summasi umumiy summaga teng emas!");
        return;
      }

      for (const payment of splitPayments) {
        if (!payment.method || parseFloat(payment.amount) <= 0) {
          setError("Har bir bo'lingan to'lov uchun usul va miqdor kiritilishi shart!");
          return;
        }
        if (payment.method === 'debt') {
          if (!selectedCustomer) {
            setError("Nasiya yozish uchun avval mijozni tanlashingiz shart!");
            return;
          }
          if (!payment.dueDate) {
            setError("Nasiya uchun qaytarish sanasini tanlashingiz shart!");
            return;
          }
        }
      }
      onPay(splitPayments, true); // Pass splitPayments array and a flag for split
    } else {
      // Agar Nasiya tanlangan bo'lsa va mijoz tanlanmagan bo'lsa -> Xatolik
      if (activeMethod === 'debt' && !selectedCustomer) {
        setError("Nasiya yozish uchun avval mijozni tanlashingiz shart!");
        return;
      }

      // Agar Nasiya tanlangan bo'lsa va sana tanlanmagan bo'lsa -> Xatolik
      if (activeMethod === 'debt' && !dueDate) {
        setError("Qaytarish sanasini tanlashingiz shart!");
        return;
      }

      onPay(activeMethod, dueDate); // Pass single method and dueDate
    }
  };

  // Hotkeys - Moved after handlePayment to avoid ReferenceError
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        // Agar active element button bo'lsa, u holda o'zining click hodisasi ishlaydi
        if (document.activeElement.tagName === 'BUTTON') return;

        e.preventDefault();
        handlePayment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePayment, onClose]);

  const selectMethod = (id) => {
    setActiveMethod(id);
    setError(''); // Metod o'zgarganda xatoni tozalash
  };

  const toggleSplitPayment = () => {
    setIsSplitPayment(!isSplitPayment);
    setError('');
    if (!isSplitPayment) { // If switching to split payment
      setSplitPayments([{ id: Date.now(), method: 'cash', amount: totalAmount, dueDate: '' }]);
    } else { // If switching back to single payment
      setActiveMethod('cash');
      setDueDate('');
    }
  };

  const addSplitPayment = () => {
    const remaining = totalAmount - splitPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    setSplitPayments([...splitPayments, { id: Date.now(), method: 'cash', amount: Math.max(0, remaining), dueDate: '' }]);
  };

  const removeSplitPayment = (id) => {
    setSplitPayments(splitPayments.filter(p => p.id !== id));
  };

  const handleSplitChange = (id, field, value) => {
    setSplitPayments(splitPayments.map(p =>
      p.id === id ? { ...p, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : p
    ));
  };

  const totalSplitAmount = splitPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const remainingAmount = totalAmount - totalSplitAmount;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] animate-in fade-in duration-200">
      <div className="bg-white w-[550px] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">To'lov qilish</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
        </div>
        <div className="p-6">
          <div className="text-center mb-8">
            <p className="text-gray-500 mb-1">Jami to'lov summasi</p>
            <h1 className="text-4xl font-bold text-blue-600">{totalAmount.toLocaleString()} <span className="text-xl text-gray-400">so'm</span></h1>
          </div>

          <div className="mb-4">
            <button
              onClick={toggleSplitPayment}
              className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 font-medium
                ${isSplitPayment
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
            >
              <Divide size={20} /> {isSplitPayment ? "Bo'lingan to'lov" : "To'lovni bo'lish"}
            </button>
          </div>

          {!isSplitPayment ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => selectMethod(method.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left
                      ${activeMethod === method.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'}
                      ${method.id === 'debt' ? 'text-orange-600' : ''}
                      `}
                  >
                    <div className={`${method.id === 'debt' && activeMethod !== 'debt' ? 'text-orange-400' : ''}`}>{method.icon}</div>
                    <span className="font-medium">{method.label}</span>
                    {activeMethod === method.id && <div className="ml-auto text-blue-500"><X size={16} /></div>}
                  </button>
                ))}
              </div>

              {/* Nasiya uchun sana tanlash */}
              {activeMethod === 'debt' && (
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Qaytarish sanasi</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all text-gray-700 font-medium"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            // Split Payment UI
            <div className="mb-4 border p-4 rounded-xl bg-gray-50">
              <h3 className="font-bold text-gray-700 mb-3">Bo'lingan to'lovlar</h3>
              {splitPayments.map((payment, index) => (
                <div key={payment.id} className="flex items-center gap-2 mb-3 p-2 bg-white rounded-lg border border-gray-200">
                  <select
                    value={payment.method}
                    onChange={(e) => handleSplitChange(payment.id, 'method', e.target.value)}
                    className="flex-1 p-2 border rounded-lg focus:ring-blue-200 focus:border-blue-400 outline-none"
                  >
                    {paymentMethods.map(method => (
                      <option key={method.id} value={method.id}>{method.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) => handleSplitChange(payment.id, 'amount', e.target.value)}
                    className="w-32 p-2 border rounded-lg text-right focus:ring-blue-200 focus:border-blue-400 outline-none"
                    placeholder="Miqdor"
                    min="0"
                  />
                  <button
                    onClick={() => removeSplitPayment(payment.id)}
                    className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                    disabled={splitPayments.length === 1}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}

              <button
                onClick={addSplitPayment}
                className="w-full flex items-center justify-center gap-2 p-2 mt-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
              >
                <Plus size={18} /> To'lov qismi qo'shish
              </button>

              <div className="mt-4 pt-3 border-t border-gray-200 text-sm font-medium">
                <div className="flex justify-between mb-1">
                  <span>Jami bo'lingan:</span>
                  <span className={totalSplitAmount !== totalAmount ? 'text-red-600' : 'text-green-600'}>
                    {totalSplitAmount.toLocaleString()} so'm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Qolgan summa:</span>
                  <span className={remainingAmount !== 0 ? 'text-red-600' : 'text-green-600'}>
                    {remainingAmount.toLocaleString()} so'm
                  </span>
                </div>
              </div>

              {splitPayments.some(p => p.method === 'debt') && (
                <div className="mt-4 p-3 bg-orange-50 text-orange-600 rounded-xl text-sm font-bold">
                  {selectedCustomer
                    ? `Nasiya "${selectedCustomer.name}" nomiga yoziladi.`
                    : "DIQQAT: Nasiya uchun mijoz tanlanmagan!"}
                </div>
              )}

              {splitPayments.map(payment => (
                payment.method === 'debt' && (
                  <div key={`debt-date-${payment.id}`} className="mt-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      {payment.amount.toLocaleString()} so'm nasiya uchun qaytarish sanasi
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="date"
                        value={payment.dueDate}
                        onChange={(e) => handleSplitChange(payment.id, 'dueDate', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all text-gray-700 font-medium"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Xato xabari */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm font-bold animate-pulse">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {/* Agar Nasiya tanlangan bo'lsa, ogohlantirish (faqat single payment uchun) */}
          {!isSplitPayment && activeMethod === 'debt' && !error && (
            <div className={`text-center text-sm mb-4 p-2 rounded-lg ${selectedCustomer ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-600 font-bold'}`}>
              {selectedCustomer
                ? `Qarz "${selectedCustomer.name}" nomiga yoziladi.`
                : "DIQQAT: Nasiya uchun mijoz tanlanmagan!"}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-4 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors">Bekor qilish</button>
            <button onClick={handlePayment} className="flex-1 py-4 bg-green-500 text-white font-bold rounded-xl shadow-lg hover:bg-green-600 transition-transform active:scale-95">To'lash</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;