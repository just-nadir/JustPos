# Active Context

## Hozirgi Fokus
Loyiha uchun "Memory Bank" (Xotira Banki) tizimini o'rnatish va sozlash. Bu AI yordamchisi loyiha kontekstini to'liq tushunishi uchun zarur.

## Yaqinda Bajarilgan Ishlar
1.  **Litsenziya Tizimi Implemetatsiyasi (YAKUNLANDI):**
    *   **Backend:** `licenseManager.cjs` (JustPOS prefix, Auto-gen logic).
    *   **Frontend:** `Settings.jsx` (UI), `LicenseLock.jsx` (Blocking & Activation).
    *   **Admin Tools:** `admin/generate_license.cjs` va `admin/gui` (Electron GUI).
    *   **Verifikatsiya:** To'liq test qilindi va foydalanuvchi tomonidan tasdiqlandi.

## Hozirgi Holat
*   Loyiha to'liq litsenziya himoyasiga ega.
*   Fayl almashinuvi: `JustPOS_XXXX.hid` -> `JustPOS_XXXX.license`.

## Keyingi Qadamlar
1.  Memory Bank fayllarini to'ldirib bo'lish (`systemPatterns`, `techContext`, `progress`).
2.  Litsenziya tekshiruvi tizimini to'liq testdan o'tkazish.
3.  Loyiha barqarorligini tekshirish uchun regressiya testlarini o'tkazish (ayniqsa printer va tarmoq funksiyalari).
