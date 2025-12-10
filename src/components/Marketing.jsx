import React, { useState, useEffect } from 'react';
import { Send, Settings, History, FileText, Save, RefreshCw } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';

const Marketing = () => {
  const { showToast } = useGlobal();
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ eskiz_email: '', eskiz_password: '', eskiz_nickname: '' });
  const [bulkMessage, setBulkMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (!window.electron) return;
    const { ipcRenderer } = window.electron;

    try {
      if (activeTab === 'templates') {
        const data = await ipcRenderer.invoke('get-sms-templates');
        // "new_menu" shablonini filtrlab tashlaymiz, faqat keraklilarini qoldiramiz
        const filtered = (data || []).filter(t => t.type !== 'new_menu');
        setTemplates(filtered);
      } else if (activeTab === 'history') {
        const data = await ipcRenderer.invoke('get-sms-logs');
        setLogs(data || []);
      } else if (activeTab === 'settings') {
        const data = await ipcRenderer.invoke('get-settings');
        setSettings({
          eskiz_email: data.eskiz_email || '',
          eskiz_password: data.eskiz_password || '',
          eskiz_nickname: data.eskiz_nickname || ''
        });
      }
    } catch (error) {
      console.error("Yuklashda xatolik:", error);
      showToast('error', 'Ma\'lumotlarni yuklashda xatolik bo\'ldi');
    }
  };

  const handleSaveTemplate = async (template) => {
    if (!window.electron) return;
    try {
      // is_active ni doim 1 deb yuboramiz (chunki UI dan o'chirib tashladik)
      await window.electron.ipcRenderer.invoke('save-sms-template', { ...template, is_active: 1 });
      showToast('success', 'Shablon saqlandi');
      loadData();
    } catch (error) {
      console.error(error);
      showToast('error', 'Xatolik yuz berdi');
    }
  };

  const handleSaveSettings = async () => {
    if (!window.electron) return;
    try {
      await window.electron.ipcRenderer.invoke('save-settings', settings);
      showToast('success', 'Sozlamalar saqlandi va tizim qayta ulandi');
    } catch (error) {
      showToast('error', 'Saqlashda xatolik');
    }
  };

  const handleSendBulk = async () => {
    if (!bulkMessage) return showToast('error', 'Xabar matnini kiriting');
    if (!window.electron) return;
    
    setLoading(true);
    try {
      const res = await window.electron.ipcRenderer.invoke('send-mass-sms', { message: bulkMessage, filter: 'all' });
      showToast('success', `${res.count} ta xabar yuborildi`);
      setBulkMessage('');
    } catch (e) {
      showToast('error', 'Yuborishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-gray-100">
      {/* Sidebar Tabs */}
      <div className="w-64 bg-white border-r p-4 flex flex-col gap-2">
        <h2 className="text-xl font-bold mb-4 text-gray-800">SMS Marketing</h2>
        
        <button onClick={() => setActiveTab('templates')} className={`p-3 rounded-lg text-left flex items-center gap-3 ${activeTab === 'templates' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}>
          <FileText size={20} /> Shablonlar
        </button>
        <button onClick={() => setActiveTab('broadcast')} className={`p-3 rounded-lg text-left flex items-center gap-3 ${activeTab === 'broadcast' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}>
          <Send size={20} /> Ommaviy Xabar
        </button>
        <button onClick={() => setActiveTab('history')} className={`p-3 rounded-lg text-left flex items-center gap-3 ${activeTab === 'history' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}>
          <History size={20} /> Tarix
        </button>
        <button onClick={() => setActiveTab('settings')} className={`p-3 rounded-lg text-left flex items-center gap-3 ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}>
          <Settings size={20} /> Sozlamalar
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        
        {/* SHABLONLAR */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.length === 0 && <p className="text-gray-400 col-span-2 text-center">Shablonlar yuklanmoqda...</p>}
            
            {templates.map(t => (
              <div key={t.type} className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-gray-700">{t.title}</h3>
                  {/* Checkbox olib tashlandi, endi faqat nom va matn */}
                </div>
                <textarea 
                  className="w-full p-3 border rounded-lg h-32 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  value={t.content}
                  onChange={(e) => {
                    const newTemplates = templates.map(temp => temp.type === t.type ? {...temp, content: e.target.value} : temp);
                    setTemplates(newTemplates);
                  }}
                />
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-xs text-gray-400">
                    O'zgaruvchilar: {t.type === 'debt_reminder' ? '{name}, {amount}' : '{name}'}
                  </span>
                  <button 
                    onClick={() => handleSaveTemplate(templates.find(temp => temp.type === t.type))}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Save size={16} /> Saqlash
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* OMMAVIY XABAR */}
        {activeTab === 'broadcast' && (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm">
            <h3 className="text-xl font-bold mb-6">Barcha mijozlarga xabar yuborish</h3>
            <div className="mb-4 p-4 bg-blue-50 text-blue-700 rounded-lg text-sm">
              Diqqat! Bu xabar bazadagi barcha raqami bor mijozlarga yuboriladi.
            </div>
            
            <label className="block text-sm font-medium text-gray-700 mb-2">Xabar matni</label>
            <textarea 
              className="w-full p-4 border rounded-lg h-40 focus:ring-2 focus:ring-blue-500 outline-none mb-4"
              placeholder="Masalan: Bizda yangi menyu! Marhamat qilib tashrif buyuring..."
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
            />
            
            <button 
              onClick={handleSendBulk}
              disabled={loading}
              className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2
                ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {loading ? <RefreshCw className="animate-spin" /> : <Send />} 
              {loading ? 'Yuborilmoqda...' : 'Barchaga Yuborish'}
            </button>
          </div>
        )}

        {/* TARIX */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 font-medium text-gray-600">Sana</th>
                  <th className="p-4 font-medium text-gray-600">Raqam</th>
                  <th className="p-4 font-medium text-gray-600">Xabar</th>
                  <th className="p-4 font-medium text-gray-600">Tur</th>
                  <th className="p-4 font-medium text-gray-600">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-500">{new Date(log.date).toLocaleString()}</td>
                    <td className="p-4 font-medium">{log.phone}</td>
                    <td className="p-4 text-sm text-gray-600 max-w-xs truncate" title={log.message}>{log.message}</td>
                    <td className="p-4 text-sm">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">{log.type}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold
                        ${log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {log.status === 'sent' ? 'Yuborildi' : 'Xatolik'}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                    <tr>
                        <td colSpan="5" className="p-8 text-center text-gray-400">Tarix bo'sh</td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SOZLAMALAR */}
        {activeTab === 'settings' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings className="text-gray-400" /> Eskiz.uz Sozlamalari
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  type="email" 
                  value={settings.eskiz_email}
                  onChange={(e) => setSettings({...settings, eskiz_email: e.target.value})}
                  className="w-full p-3 border rounded-lg outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parol</label>
                <input 
                  type="password" 
                  value={settings.eskiz_password}
                  onChange={(e) => setSettings({...settings, eskiz_password: e.target.value})}
                  className="w-full p-3 border rounded-lg outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nickname (From)</label>
                <input 
                  type="text" 
                  value={settings.eskiz_nickname}
                  onChange={(e) => setSettings({...settings, eskiz_nickname: e.target.value})}
                  className="w-full p-3 border rounded-lg outline-none focus:border-blue-500"
                  placeholder="4546"
                />
              </div>
              
              <button 
                onClick={handleSaveSettings}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 mt-4"
              >
                Saqlash va Ulash
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Marketing;