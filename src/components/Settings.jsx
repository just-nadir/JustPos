import React, { useState, useEffect } from 'react';
import { Save, Printer, Database, Store, Receipt, Percent, RefreshCw, ChefHat, Plus, Trash2, Users, Shield, Key, Coins, CheckCircle, PcCase, MessageSquare, Send } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { formatDate } from '../utils/dateUtils';
import { APP_INFO } from '../config/appConfig';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general'); // Tabs: general, network, kitchen, users, printers, sms, license, about);
  const [loading, setLoading] = useState(false);
  const [kitchens, setKitchens] = useState([]);
  const [users, setUsers] = useState([]);
  const [notification, setNotification] = useState(null);
  const [systemPrinters, setSystemPrinters] = useState([]);


  const [licenseInfo, setLicenseInfo] = useState({ active: false, status: 'checking', hwid: '' });
  const [newKitchen, setNewKitchen] = useState({ name: '', printer_ip: '' });
  const [newUser, setNewUser] = useState({ name: '', pin: '', role: 'waiter' });

  const [modal, setModal] = useState({ isOpen: false, type: null, id: null, message: '' });

  const [settings, setSettings] = useState({
    restaurantName: "", address: "", phone: "", wifiPassword: "",
    serviceChargeType: "percent", serviceChargeValue: 0, receiptFooter: "",

    printerReceiptIP: "",
    eskiz_email: "", eskiz_password: "", eskiz_nickname: "4546",
    telegram_bot_token: "", telegram_chat_id: "", telegram_auto_send: "false" // YANGI
  });

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotify = (type, msg) => setNotification({ type, msg });

  const loadAllData = async () => {
    if (!window.electron) return;
    try {
      const { ipcRenderer } = window.electron;
      const sData = await ipcRenderer.invoke('get-settings');
      setSettings(prev => ({
        ...prev,
        ...sData,
        serviceChargeValue: Number(sData.serviceChargeValue) || 0
      }));

      const kData = await ipcRenderer.invoke('get-kitchens');
      setKitchens(kData);

      const uData = await ipcRenderer.invoke('get-users');
      setUsers(uData);

      const printers = await ipcRenderer.invoke('get-system-printers');
      setSystemPrinters(printers || []);

      // License Info olish (YANGI)
      const lData = await ipcRenderer.invoke('license-get-info');
      setLicenseInfo(lData);
    } catch (err) { console.error(err); }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const settingsToSave = {
        ...settings,
        printerReceiptPort: 0,
        printerReceiptType: 'driver'
      };
      await window.electron.ipcRenderer.invoke('save-settings', settingsToSave);
      showNotify('success', "Sozlamalar saqlandi!");
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSaveKitchen = async (e) => {
    e.preventDefault();
    if (!newKitchen.name) return;
    try {
      const kitchenToSave = {
        ...newKitchen,
        printer_port: 0,
        printer_type: 'driver'
      };
      await window.electron.ipcRenderer.invoke('save-kitchen', kitchenToSave);
      setNewKitchen({ name: '', printer_ip: '' });
      loadAllData();
      showNotify('success', "Oshxona qo'shildi");
    } catch (err) { console.error(err); }
  };

  const handleDeleteAction = async () => {
    try {
      const { ipcRenderer } = window.electron;
      if (modal.type === 'kitchen') {
        await ipcRenderer.invoke('delete-kitchen', modal.id);
        showNotify('success', "O'chirildi");
      } else if (modal.type === 'user') {
        await ipcRenderer.invoke('delete-user', modal.id);
        showNotify('success', "O'chirildi");
      } else if (modal.type === 'backup') {
        const res = await ipcRenderer.invoke('backup-db');
        if (res.success) {
          showNotify('success', `Nusxa saqlandi: ${res.path}`);
        }
      }
      loadAllData();
    } catch (err) {
      showNotify('error', err.message);
    }
  };

  const confirmDeleteKitchen = (id) => {
    setModal({ isOpen: true, type: 'kitchen', id, message: "Oshxonani o'chirmoqchimisiz?" });
  };

  const confirmDeleteUser = (id) => {
    setModal({ isOpen: true, type: 'user', id, message: "Xodimni o'chirmoqchimisiz?" });
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.pin) return;
    try {
      await window.electron.ipcRenderer.invoke('save-user', newUser);
      setNewUser({ name: '', pin: '', role: 'waiter' });
      loadAllData();
      showNotify('success', "Xodim saqlandi!");
    } catch (err) {
      showNotify('error', err.message);
    }
  };

  const handleBackupClick = () => {
    setModal({ isOpen: true, type: 'backup', id: null, message: "Ma'lumotlar bazasidan nusxa olinsinmi?" });
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold uppercase">Admin</span>;
      case 'cashier': return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold uppercase">Kassir</span>;
      default: return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase">Ofitsiant</span>;
    }
  }

  return (
    <div className="flex w-full h-full bg-gray-100 relative">
      {notification && (
        <div className={`absolute top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-white font-bold animate-in slide-in-from-top duration-300 ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.type === 'success' ? <CheckCircle size={20} /> : <Shield size={20} />}
          {notification.msg}
        </div>
      )}

      <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full p-4 shadow-sm z-10">
        <h2 className="text-xl font-bold text-gray-800 mb-6 px-2">Sozlamalar</h2>
        <div className="space-y-2">
          <button onClick={() => setActiveTab('general')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'general' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}><Store size={20} /> Umumiy Ma'lumot</button>
          <button onClick={() => setActiveTab('users')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'users' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}><Users size={20} /> Xodimlar</button>
          <button onClick={() => setActiveTab('order')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'order' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}><Percent size={20} /> Buyurtma va Xizmat</button>
          <button onClick={() => setActiveTab('kitchens')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'kitchens' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}><ChefHat size={20} /> Oshxonalar & Printer</button>
          <button onClick={() => setActiveTab('printers')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'printers' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}><Printer size={20} /> Kassa Printeri</button>
          <button onClick={() => setActiveTab('sms')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'sms' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}><MessageSquare size={20} /> SMS Sozlamalari</button>
          <button onClick={() => setActiveTab('telegram')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'telegram' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}><Send size={20} /> Telegram Bot</button>
          <button onClick={() => setActiveTab('license')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'license' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}><Key size={20} /> Litsenziya</button>

          <button onClick={() => setActiveTab('database')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'database' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}><Database size={20} /> Baza va Tizim</button>
          <button onClick={() => setActiveTab('about')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-colors ${activeTab === 'about' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}><Store size={20} /> Dastur Haqida</button>
        </div>
        <div className="mt-auto">
          {activeTab !== 'about' && (
            <button onClick={handleSaveSettings} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70">
              {loading ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />} Saqlash
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {/* --- GENERAL --- */}
        {activeTab === 'general' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Store size={20} className="text-blue-500" /> Restoran Ma'lumotlari</h3>
              <div className="grid gap-4">
                <div><label className="block text-sm font-bold text-gray-500 mb-1">Restoran Nomi</label><input type="text" name="restaurantName" value={settings.restaurantName || ''} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500 font-bold text-gray-700" /></div>
                <div><label className="block text-sm font-bold text-gray-500 mb-1">Manzil</label><input type="text" name="address" value={settings.address || ''} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500" /></div>
                <div><label className="block text-sm font-bold text-gray-500 mb-1">Telefon</label><input type="text" name="phone" value={settings.phone || ''} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500" /></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Receipt size={20} className="text-orange-500" /> Chek Sozlamalari</h3>
              <div><label className="block text-sm font-bold text-gray-500 mb-1">Chekosti yozuvi</label><textarea rows="3" name="receiptFooter" value={settings.receiptFooter || ''} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500 resize-none"></textarea></div>
            </div>
          </div>
        )}

        {/* --- USERS --- */}
        {activeTab === 'users' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Users size={20} className="text-blue-500" /> Xodim Qo'shish</h3>
              <form onSubmit={handleSaveUser} className="grid grid-cols-12 gap-4 items-end">
                <div className="col-span-4">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Ism</label>
                  <input required type="text" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Ali" className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-blue-500 font-bold" />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">PIN Kod</label>
                  <div className="relative">
                    <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input required type="text" maxLength="4" value={newUser.pin} onChange={e => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '') })} placeholder="1234" className="w-full pl-9 pr-3 py-3 rounded-xl border border-gray-200 outline-none focus:border-blue-500 font-mono text-center tracking-widest" />
                  </div>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Rol</label>
                  <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-blue-500">
                    <option value="waiter">Ofitsiant</option>
                    <option value="cashier">Kassir</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700">Qo'shish</button>
                </div>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Xodimlar Ro'yxati</h3>
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 group">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white 
                                        ${u.role === 'admin' ? 'bg-purple-500' : u.role === 'cashier' ? 'bg-orange-500' : 'bg-blue-500'}`}>
                        {u.role === 'admin' ? <Shield size={18} /> : u.role === 'cashier' ? <Coins size={18} /> : <Users size={18} />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-500 font-mono flex items-center gap-1">PIN: ••••</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRoleBadge(u.role)}
                      <button onClick={() => confirmDeleteUser(u.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={20} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- ORDER --- */}
        {activeTab === 'order' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Percent size={20} className="text-green-500" /> Xizmat Haqi (Service Charge)</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button onClick={() => setSettings({ ...settings, serviceChargeType: 'percent' })} className={`p-4 rounded-xl border-2 font-bold transition-all ${settings.serviceChargeType === 'percent' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 hover:bg-gray-50'}`}>Foiz (%) da</button>
                <button onClick={() => setSettings({ ...settings, serviceChargeType: 'fixed' })} className={`p-4 rounded-xl border-2 font-bold transition-all ${settings.serviceChargeType === 'fixed' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 hover:bg-gray-50'}`}>Kishi boshiga (Fixed)</button>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">{settings.serviceChargeType === 'percent' ? 'Xizmat foizi' : 'Kishi boshiga summa'}</label>
                <div className="relative">
                  <input type="number" name="serviceChargeValue" value={settings.serviceChargeValue || 0} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500 font-bold text-xl" />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{settings.serviceChargeType === 'percent' ? '%' : "so'm"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- KITCHENS --- */}
        {activeTab === 'kitchens' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus size={20} className="text-blue-500" /> Yangi Oshxona Qo'shish</h3>
              <p className="text-xs text-gray-400 mb-4">Oshxona printerini tanlang (Faqat Driver orqali ulanadi)</p>

              <form onSubmit={handleSaveKitchen} className="space-y-4">
                <div className="grid grid-cols-12 gap-4 items-end">
                  <div className="col-span-6">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Oshxona Nomi</label>
                    <input required type="text" value={newKitchen.name} onChange={e => setNewKitchen({ ...newKitchen, name: e.target.value })} placeholder="Masalan: Bar" className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-blue-500 font-bold" />
                  </div>

                  <div className="col-span-4">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Printer Tanlash</label>
                    <select value={newKitchen.printer_ip} onChange={e => setNewKitchen({ ...newKitchen, printer_ip: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-blue-500 bg-white">
                      <option value="">Tanlanmagan</option>
                      {systemPrinters.map(p => (
                        <option key={p.name} value={p.name}>{p.name} ({p.displayName || p.name})</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 h-[50px]">Saqlash</button>
                  </div>
                </div>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><ChefHat size={20} className="text-orange-500" /> Oshxonalar Ro'yxati</h3>
              <div className="space-y-3">
                {kitchens.map(k => (
                  <div key={k.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 group">
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{k.name}</p>
                      <div className="text-xs text-gray-500 font-mono flex items-center gap-2 mt-1">
                        <PcCase size={14} className="text-blue-500" /> Printer: {k.printer_ip || 'Tanlanmagan'}
                      </div>
                    </div>
                    <button onClick={() => confirmDeleteKitchen(k.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={20} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- PRINTERS (KASSA) --- */}
        {activeTab === 'printers' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Printer size={20} className="text-purple-500" /> Kassa Printeri</h3>
              <p className="text-sm text-gray-400 mb-6">Mijozga beriladigan chek uchun asosiy printerni tanlang.</p>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="block text-xs font-bold text-gray-500 mb-1">Tizim Printeri</label>
                <select
                  name="printerReceiptIP"
                  value={settings.printerReceiptIP || ''}
                  onChange={handleChange}
                  className="w-full p-2 rounded-lg border border-gray-300 outline-none text-sm bg-white"
                >
                  <option value="">Printerni tanlang...</option>
                  {systemPrinters.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* --- SMS SETTINGS (YANGI) --- */}
        {activeTab === 'sms' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><MessageSquare size={20} className="text-blue-500" /> Eskiz.uz Sozlamalari</h3>
              <p className="text-sm text-gray-400 mb-6">SMS xabarnomalar uchun Eskiz.uz ma'lumotlarini kiriting.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">Email</label>
                  <input type="email" name="eskiz_email" value={settings.eskiz_email || ''} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">Parol</label>
                  <input type="password" name="eskiz_password" value={settings.eskiz_password || ''} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">Nickname (From)</label>
                  <input type="text" name="eskiz_nickname" value={settings.eskiz_nickname || '4546'} onChange={handleChange} placeholder="4546" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">Eskiz.uz da tasdiqlangan nikni yozing (masalan: MYBRAND). Default: 4546</p>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* --- TELEGRAM SETTINGS (YANGI) --- */}
        {activeTab === 'telegram' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Send size={20} className="text-blue-500" /> Telegram Bot Sozlamalari</h3>
              <p className="text-sm text-gray-400 mb-6">BotFather orqali yaratilgan bot ma'lumotlarini kiriting.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">Bot Token</label>
                  <input type="text" name="telegram_bot_token" value={settings.telegram_bot_token || ''} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500 font-mono" placeholder="123456789:ABCDefGHI..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">Chat ID</label>
                  <div className="flex gap-2">
                    <input type="text" name="telegram_chat_id" value={settings.telegram_chat_id || ''} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500 font-mono" placeholder="123456789" />
                    <button
                      onClick={async () => {
                        try {
                          await window.electron.ipcRenderer.invoke('telegram-test');
                          showNotify('success', "Xabar yuborildi!");
                        } catch (e) {
                          showNotify('error', e.message);
                        }
                      }}
                      className="whitespace-nowrap px-4 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
                    >
                      Test
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Botni guruhga qo'shing yoki unga /start bosing.</p>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800">Avtomatik hisobot</p>
                    <p className="text-xs text-gray-400">Har kecha soat 23:55 da hisobot yuborish</p>
                  </div>
                  <button
                    onClick={() => setSettings(p => ({ ...p, telegram_auto_send: p.telegram_auto_send === 'true' ? 'false' : 'true' }))}
                    className={`w-14 h-8 rounded-full p-1 transition-colors ${settings.telegram_auto_send === 'true' ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${settings.telegram_auto_send === 'true' ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- LICENSE (FILE BASED) --- */}
        {activeTab === 'license' && (
          <div className="max-w-2xl space-y-6">
            <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 ${licenseInfo.active ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                {licenseInfo.active ? <CheckCircle size={20} className="text-green-500" /> : <Shield size={20} className="text-red-500" />}
                Litsenziya Holati
              </h3>

              <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${licenseInfo.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {licenseInfo.active ? 'FAOL' : 'FAOL EMAS'}
                </span>
                {licenseInfo.expiry && <span className="text-sm text-gray-500">Muddat: {formatDate(licenseInfo.expiry)}</span>}
              </div>

              {!licenseInfo.active && (
                <div className="mb-4 text-sm text-gray-600">
                  <p>Holat: <b>{licenseInfo.status}</b></p>
                  <p className="mt-2">Ilovani faollashtirish uchun:</p>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Quyidagi tugmani bosib so'rov faylini yarating.</li>
                    <li>Hosil bo'lgan faylni dasturchiga yuboring.</li>
                    <li>Sizga berilgan litsenziya faylini dastur papkasiga joylashtiring.</li>
                  </ol>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-xl border-2 border-dashed border-gray-300 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">HARDWARE ID:</p>
                    <p className="font-mono text-lg font-bold text-gray-800 select-all">{licenseInfo.hwid || '...'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const res = await window.electron.ipcRenderer.invoke('license-create-request');
                      if (res.success) {
                        showNotify('success', `So'rov fayli yaratildi: ${res.path}`);
                      } else {
                        showNotify('error', res.error);
                      }
                    } catch (err) { showNotify('error', err.message); }
                    setLoading(false);
                  }}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <PcCase size={20} /> Litsenziya so'rovini yaratish (.hid)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- DATABASE --- */}
        {activeTab === 'database' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-red-500">
              <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2"><Database size={20} className="text-red-500" /> Ma'lumotlar Bazasi</h3>
              <p className="text-sm text-gray-500 mb-6">Ehtiyot bo'ling! Ma'lumotlarni yo'qotmaslik uchun tez-tez nusxa olib turing.</p>
              <div className="flex gap-4">
                <button onClick={handleBackupClick} className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2"><Save size={18} /> Backup (Nusxa olish)</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        onConfirm={handleDeleteAction}
        message={modal.message}
        title="Tasdiqlang"
      />
      {activeTab === 'about' && (
        <div className="w-full h-full flex flex-col items-center justify-center min-h-[600px]">

          <div className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden w-full max-w-4xl border border-gray-100 transform transition-all hover:scale-[1.01] duration-500">

            <div className="absolute top-0 w-full h-48 bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700"></div>

            <div className="absolute top-8 right-8 text-white/20">
              <Store size={180} />
            </div>

            <div className="relative z-10 pt-24 px-12 pb-12">
              <div className="flex flex-col items-center text-center">
                <div className="w-40 h-40 bg-white rounded-[30px] shadow-xl flex items-center justify-center mb-6 ring-8 ring-white/50">
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[20px] flex items-center justify-center text-white shadow-inner">
                    <Store size={64} />
                  </div>
                </div>

                <h2 className="text-5xl font-black text-gray-800 mb-2 tracking-tight">{APP_INFO.name}</h2>
                <div className="flex items-center gap-3 mb-10">
                  <span className="px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-100 text-sm tracking-wide shadow-sm">
                    {APP_INFO.version}
                  </span>
                  <span className="px-4 py-1.5 rounded-full bg-purple-50 text-purple-600 font-bold border border-purple-100 text-sm tracking-wide shadow-sm">
                    PRO
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-6 w-full max-w-3xl">
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 hover:bg-white hover:shadow-xl hover:border-blue-200 transition-all duration-300 group text-left">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider flex items-center gap-2">
                      <Users size={14} className="text-blue-500" /> Yaratuvchi
                    </p>
                    <p className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{APP_INFO.creator}</p>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 hover:bg-white hover:shadow-xl hover:border-green-200 transition-all duration-300 group text-left">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider flex items-center gap-2">
                      <MessageSquare size={14} className="text-green-500" /> Aloqa
                    </p>
                    <p className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">{APP_INFO.phone}</p>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 hover:bg-white hover:shadow-xl hover:border-purple-200 transition-all duration-300 group text-left">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider flex items-center gap-2">
                      <Send size={14} className="text-purple-500" /> Veb-sayt
                    </p>
                    <a href={`https://${APP_INFO.website}`} target="_blank" rel="noreferrer" className="text-xl font-bold text-gray-800 group-hover:text-purple-600 transition-colors hover:underline">{APP_INFO.website}</a>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 hover:bg-white hover:shadow-xl hover:border-orange-200 transition-all duration-300 group text-left">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider flex items-center gap-2">
                      <Store size={14} className="text-orange-500" /> Ishga tushirilgan
                    </p>
                    <p className="text-xl font-bold text-gray-800 group-hover:text-orange-600 transition-colors">{APP_INFO.since}-yil</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-12 py-6 border-t border-gray-100 flex justify-between items-center text-sm font-medium text-gray-400">
              <p>© {new Date().getFullYear()} {APP_INFO.creator}</p>
              <p>Barcha huquqlar himoyalangan</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;