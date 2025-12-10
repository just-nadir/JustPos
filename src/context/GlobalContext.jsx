import React, { createContext, useState, useContext, useEffect } from 'react';

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  // YANGI: Toast (Xabarnoma) uchun state
  const [toast, setToast] = useState(null);

  // YANGI: License Status
  const [license, setLicense] = useState({
    active: true, // Default true to prevent flickering before check
    checked: false,
    reason: null,
    expiry: null,
    lastOnline: null
  });

  const checkLicense = async () => {
    if (window.electron) {
      try {
        const result = await window.electron.ipcRenderer.invoke('license-check');
        setLicense({
          active: result.active,
          reason: result.reason,
          expiry: result.expiry,
          lastOnline: result.lastOnline,
          checked: true
        });
        return result.active;
      } catch (err) {
        console.error("License check failed:", err);
        // Xatolik bo'lsa bloklash xavfsizroq bo'lishi mumkin, lekin UX uchun ehtiyot bo'lish kerak.
        // Hozircha 'checked: true' deb belgilaymiz.
        setLicense(prev => ({ ...prev, checked: true }));
        return false;
      }
    }
    return true; // Web browserda (electron yo'q bo'lsa) o'tkazib yuboramiz
  };

  useEffect(() => {
    const initApp = async () => {
      if (window.electron) {
        try {
          const loadedSettings = await window.electron.ipcRenderer.invoke('get-settings');
          setSettings(loadedSettings || {});

          // Dastur boshlanishida litsenziyani tekshirish
          await checkLicense();

        } catch (err) {
          console.error("Global Context Init Error:", err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  // YANGI: Toast ko'rsatish funksiyasi (3 soniyadan keyin o'chadi)
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const login = (userData) => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    settings,
    loading,
    toast,      // Export qilamiz
    showToast,   // Export qilamiz
    license,    // Export
    checkLicense // Export
  };

  return (
    <GlobalContext.Provider value={value}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("useGlobal must be used within a GlobalProvider");
  }
  return context;
};