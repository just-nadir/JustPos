import React, { useState, useEffect } from 'react';
import { CreditCard, Users, User, Wallet, X, Printer, Hash, Trash2, Search, PlusCircle } from 'lucide-react';
import PaymentModal from './PaymentModal';
import CustomerModal from './CustomerModal';
import ConfirmModal from './ConfirmModal';
import { useGlobal } from '../context/GlobalContext';

const OrderSummary = ({ table, onDeselect }) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [bonusToUse, setBonusToUse] = useState(0);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [printingCheck, setPrintingCheck] = useState(false);

  // Search & Products
  const [allProducts, setAllProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchInputRef = React.useRef(null);



  const { settings, showToast } = useGlobal(); // Use global settings

  useEffect(() => {
    setSelectedCustomer(null);
    setBonusToUse(0);
    setOrderItems([]);
    if (table) {
      loadOrderItems(table.id);
    }
  }, [table]);

  const loadOrderItems = async (tableId) => {
    if (!window.electron) return;
    setLoading(true);
    try {
      const { ipcRenderer } = window.electron;
      const items = await ipcRenderer.invoke('get-table-items', tableId);
      setOrderItems(items);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    if (!window.electron) return;
    try {
      const products = await window.electron.ipcRenderer.invoke('get-products');
      setAllProducts(products || []);
    } catch (err) {
      console.error("Error loading products:", err);
    }
  };

  // Search Logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const lower = searchQuery.toLowerCase();
    const filtered = allProducts.filter(p =>
      p.active && (p.name.toLowerCase().includes(lower) || (p.code && p.code.toLowerCase().includes(lower)))
    );
    setSearchResults(filtered);
  }, [searchQuery, allProducts]);

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F4 - Focus Search
      if (e.key === 'F4') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Space - Open Payment (only if not typing in input)
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (table && orderItems.length > 0) {
          setIsPaymentModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [table, orderItems]);

  const handleAddProduct = async (product) => {
    if (!table || !window.electron) return;
    try {
      // Add item directly (quantity 1)
      await window.electron.ipcRenderer.invoke('add-order-item', {
        table_id: table.id,
        product_id: product.id,
        quantity: 1,
        price: product.price
      });
      // Clear search
      setSearchQuery('');
      setSearchResults([]);
      // Reload items
      setSearchResults([]);
      // Reload items
      loadOrderItems(table.id);
      // Optional: Sound effect
    } catch (err) {
      console.error(err);
      showToast('error', err.message);
    }
  };

  const handlePrintCheck = async () => {
    if (!table || !window.electron || printingCheck) return;

    setPrintingCheck(true);
    try {
      const { ipcRenderer } = window.electron;
      const result = await ipcRenderer.invoke('print-check', table.id);

      if (result.success) {
        console.log(`✅ HISOB chop etildi: Check #${result.checkNumber}`);
        // Statusni real-time yangilash uchun onDeselect chaqirilishi mumkin
        // yoki stollarni qayta yuklash
      }
    } catch (error) {
      console.error('HISOB chiqarishda xato:', error);
      showToast('error', `Xato: ${error.message}`);
    } finally {
      setPrintingCheck(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!table || !window.electron) return;
    try {
      const { ipcRenderer } = window.electron;
      const result = await ipcRenderer.invoke('cancel-order', table.id);
      if (result.success) {
        if (onDeselect) onDeselect();
      }
    } catch (error) {
      console.error("Cancel error:", error);
      showToast('error', "Xatolik yuz berdi: " + error.message);
    }
  };

  const handlePrintCheckDisabled = () => {
    return !table || orderItems.length === 0 || printingCheck || loading;
  };

  const subtotal = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const guestsCount = table?.guests || 0;

  let service = 0;
  const svcValue = Number(settings.serviceChargeValue) || 0;

  if (settings.serviceChargeType === 'percent') {
    service = (subtotal * svcValue) / 100;
  } else {
    service = guestsCount * svcValue;
  }

  const preTotal = subtotal + service;

  let discountAmount = 0;
  if (selectedCustomer) {
    if (selectedCustomer.type === 'discount') {
      discountAmount = (subtotal * selectedCustomer.value) / 100;
    } else if (selectedCustomer.type === 'cashback') {
      discountAmount = bonusToUse;
    }
  }
  const finalTotal = preTotal - discountAmount;

  const handlePaymentSuccess = async (methodOrPayments, dueDateOrIsSplit) => {
    if (!table || !window.electron) return;
    try {
      const { ipcRenderer } = window.electron;

      let checkoutData;

      // Check if this is a split payment
      const isSplitPayment = Array.isArray(methodOrPayments);

      if (isSplitPayment) {
        // Split payment mode
        const splitPayments = methodOrPayments;

        // Generate payment_details for items_json
        const paymentDetails = splitPayments.map(p => ({
          method: p.method,
          amount: p.amount,
          dueDate: p.dueDate || null
        }));

        checkoutData = {
          tableId: table.id,
          total: finalTotal,
          subtotal: subtotal,
          discount: discountAmount,
          paymentMethod: 'split', // Indicate this is a split payment
          customerId: selectedCustomer ? selectedCustomer.id : null,
          items: orderItems,
          dueDate: null,
          paymentDetails: paymentDetails // Array of payment objects
        };
      } else {
        // Single payment mode (original behavior)
        const method = methodOrPayments;
        const dueDate = dueDateOrIsSplit;

        checkoutData = {
          tableId: table.id,
          total: finalTotal,
          subtotal: subtotal,
          discount: discountAmount,
          paymentMethod: method,
          customerId: selectedCustomer ? selectedCustomer.id : null,
          items: orderItems,
          dueDate: dueDate || null
        };
      }

      await ipcRenderer.invoke('checkout', checkoutData);

      setIsPaymentModalOpen(false);
      if (onDeselect) onDeselect();

    } catch (error) {
      console.error(error);
    }
  };

  const handleBonusChange = (e) => {
    const valueStr = e.target.value;
    if (valueStr === '') {
      setBonusToUse(0);
      return;
    }
    let val = Number(valueStr);
    if (val < 0) return;
    if (val > selectedCustomer.balance) val = selectedCustomer.balance;
    if (val > preTotal) val = preTotal;
    setBonusToUse(val);
  };

  if (!table) {
    return (
      <div className="w-96 bg-white h-screen shadow-xl border-l border-gray-100 flex flex-col items-center justify-center text-gray-400 p-10 text-center">
        <div className="bg-gray-100 p-6 rounded-full mb-4"><CreditCard size={48} /></div>
        <h3 className="font-bold text-lg text-gray-600">Stol tanlanmagan</h3>
        <p>Buyurtmani ko'rish uchun chap tomondan faol stolni tanlang.</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-96 bg-white h-screen shadow-xl flex flex-col border-l border-gray-100">
        {/* HEADER */}
        <div className={`p-6 border-b border-gray-100 ${table.status === 'payment' ? 'bg-yellow-50' : 'bg-gray-50'}`}>
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-2xl font-bold text-gray-800">{table.name}</h2>

            {/* CHEK RAQAMI */}
            {table.current_check_number > 0 && (
              <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200">
                <Hash size={14} className="text-gray-500" />
                <span className="font-black text-lg text-gray-800">{table.current_check_number}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mt-2">
            {settings.serviceChargeType === 'fixed' && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Users size={14} /> <span>{guestsCount} mehmon</span>
              </div>
            )}
            {settings.serviceChargeType !== 'fixed' && <div></div>} {/* Spacer if hidden */}
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
              ${table.status === 'occupied' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {table.status === 'occupied' ? 'Band' : 'To\'lov'}
            </span>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="px-4 py-2 bg-white border-b border-gray-100 relative z-20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Mahsulot qidirish / Shtrixkod (F4)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-4 right-4 bg-white shadow-xl rounded-b-xl border border-gray-100 max-h-60 overflow-y-auto mt-1">
              {searchResults.map(prod => (
                <div
                  key={prod.id}
                  onClick={() => handleAddProduct(prod)}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 flex justify-between items-center group"
                >
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{prod.name}</p>
                    <p className="text-xs text-gray-400">{prod.code || 'Kod yo\'q'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-600 text-sm">{prod.price.toLocaleString()}</span>
                    <PlusCircle size={18} className="text-gray-300 group-hover:text-blue-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CUSTOMER */}
        {selectedCustomer && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <User size={18} className="text-blue-600" />
                <div>
                  <p className="font-bold text-blue-800">{selectedCustomer.name}</p>
                  <p className="text-xs text-blue-600">
                    {selectedCustomer.type === 'discount'
                      ? `VIP: ${selectedCustomer.value}% Chegirma`
                      : `Bonus: ${selectedCustomer.balance.toLocaleString()} so'm`}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="p-1 hover:bg-blue-200 rounded text-blue-600"><X size={16} /></button>
            </div>
            {selectedCustomer.type === 'cashback' && selectedCustomer.balance > 0 && (
              <div className="bg-white p-2 rounded-lg border border-blue-200 mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Bonusdan:</span><span>Max: {selectedCustomer.balance.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-green-500" />
                  <input
                    type="number"
                    value={bonusToUse === 0 ? '' : bonusToUse}
                    onChange={handleBonusChange}
                    placeholder="Summa"
                    className="w-full outline-none text-sm font-bold text-gray-800 bg-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ITEMS */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <div className="text-center mt-10 text-gray-400">Yuklanmoqda...</div> :
            orderItems.length === 0 ? <div className="text-center mt-10 text-gray-400">Buyurtmalar yo'q</div> :
              orderItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-3 border-b border-dashed border-gray-200 last:border-0">
                  <div>
                    <p className="font-medium text-gray-800">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{item.price.toLocaleString()} x {item.quantity}</p>
                  </div>
                  <p className="font-bold text-gray-700">{(item.price * item.quantity).toLocaleString()}</p>
                </div>
              ))}
        </div>

        {/* TOTALS */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-2">
          <div className="flex justify-between text-gray-600"><span>Stol hisobi:</span><span>{subtotal.toLocaleString()}</span></div>

          <div className="flex justify-between text-gray-600">
            <span>Xizmat ({settings.serviceChargeType === 'percent' ? `${settings.serviceChargeValue}%` : 'Fixed'}):</span>
            <span>{service.toLocaleString()}</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-orange-600 font-medium"><span>Chegirma:</span><span>- {discountAmount.toLocaleString()}</span></div>
          )}
          <div className="flex justify-between text-2xl font-bold text-blue-600 mt-2 border-t border-gray-200 pt-2"><span>Jami:</span><span>{finalTotal.toLocaleString()}</span></div>
        </div>

        {/* BUTTONS */}
        <div className="p-4 border-t border-gray-100 space-y-3 bg-white">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setIsCancelModalOpen(true)}
              disabled={!table || orderItems.length === 0}
              className={`flex items-center justify-center gap-1 py-3 border-2 rounded-xl font-bold transition-colors ${!table || orderItems.length === 0 ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200'}`}
              title="Buyurtmani bekor qilish"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className={`col-span-1 flex items-center justify-center gap-2 py-3 border-2 rounded-xl font-bold transition-colors ${selectedCustomer ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'}`}
            >
              <User size={20} /> {selectedCustomer ? 'Almashtirish' : 'Mijoz'}
            </button>
            <button
              onClick={handlePrintCheck}
              disabled={handlePrintCheckDisabled()}
              className={`flex items-center justify-center gap-2 py-3 border-2 rounded-xl font-bold transition-colors ${handlePrintCheckDisabled()
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white border-gray-100 text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-200'
                }`}
            >
              <Printer size={20} /> {printingCheck ? 'Chop...' : 'Chek'}
            </button>
          </div>
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <CreditCard size={20} /> To'lovni Yopish
          </button>
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={finalTotal}
        onPay={handlePaymentSuccess}
        selectedCustomer={selectedCustomer}
      />
      <CustomerModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onSelectCustomer={setSelectedCustomer} />

      <ConfirmModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelOrder}
        title="Buyurtmani bekor qilish"
        message="Haqiqatan ham bu stol buyurtmasini butunlay o'chirib tashlamoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi."
        confirmText="Ha, o'chirish"
        cancelText="Yo'q, qolsin"
        isDanger={true}
      />
    </>
  );
};

export default OrderSummary;