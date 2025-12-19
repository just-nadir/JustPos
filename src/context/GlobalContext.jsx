import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  // YANGI: Toast (Xabarnoma) uchun state
  const [toast, setToast] = useState(null);
  const [shift, setShift] = useState(null); // YANGI: Smena holati

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
        const result = await window.electron.ipcRenderer.invoke('license-get-info');
        setLicense({
          active: result.active,
          reason: result.status, // rename reason -> status
          expiry: result.expiry,
          lastOnline: null,
          checked: true
        });
        return result.active;
      } catch (err) {
        console.error("License check failed:", err);
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

          setSettings(loadedSettings || {});

          // Dastur boshlanishida litsenziyani tekshirish
          await checkLicense();

          // YANGI: Smena holatini tekshirish
          const shiftStatus = await window.electron.ipcRenderer.invoke('shift-status');
          setShift(shiftStatus);

        } catch (err) {
          console.error("Global Context Init Error:", err);
        } finally {
          setLoading(false);
        }
      } else {
        // Browser Mode (Mobile) - API orqali yuklash
        try {
          const API_PORT = 3000;
          const protocol = window.location.protocol;
          const hostname = window.location.hostname;
          const apiUrl = `${protocol}//${hostname}:${API_PORT}/api/settings`;

          const res = await axios.get(apiUrl);
          setSettings(res.data || {});
        } catch (err) {
          console.error("Browser Settings Load Error:", err);
        } finally {
          setLoading(false);
        }
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
    checkLicense, // Export
    shift,        // Export
    setShift,     // Export
    checkShift: async () => {
      if (window.electron) {
        const s = await window.electron.ipcRenderer.invoke('shift-status');
        setShift(s);
      }
    }
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