# OmniDesk — Enterprise Peer-to-Peer Remote Desktop

> **Solusi Remote Desktop Mandiri, Cepat, Bebas Biaya Langganan, dan Terenkripsi Penuh (E2EE) untuk Keperluan Pribadi & Keluarga.**

OmniDesk lahir dari rasa frustrasi terhadap software remote komersial (seperti AnyDesk atau TeamViewer) yang membatasi sesi kerja (timeout 100 detik "Commercial Use Suspected"), biaya langganan bulanan yang mahal, serta kekhawatiran privasi data sensitif di server pihak ketiga.

---

## ⚡ Keunggulan Utama (Software Engineering Standard)

1. **100% Bebas Biaya & Tanpa Batas Waktu**:
   - Tidak ada timer disconnect tiba-tiba.
   - Tidak ada pop-up iklan atau paksaan upgrade lisensi.

2. **Privasi & Keamanan Tingkat Tinggi (Zero-Knowledge & DTLS-SRTP)**:
   - Menggunakan protokol standar industri **WebRTC Peer-to-Peer**.
   - Video layar dan audio dikirim **langsung** antar-komputer (Direct P2P). Server tidak pernah melihat piksel layar maupun keystroke.
   - Enkripsi end-to-end aktif secara bawaan via **DTLS 1.2/1.3 dan SRTP**.
   - Dilengkapi **One-Time Security PIN** acak untuk mencegah akses tanpa izin.

3. **Performa Tinggi (Hardware-Accelerated & DPI-Aware)**:
   - Streaming hingga **60 FPS** dengan latensi ultra-rendah memanfaatkan encoder video native Chromium.
   - Engine input Windows berbasis `user32.dll SendInput` (Python DPI-aware) yang menjamin klik dan ketikan akurat pada layar resolusi tinggi (1080p, 2K, 4K, maupun scaling 125%-150%).

4. **Desain Modern & Bersih (Anti-AI-Slop)**:
   - Estetika dark mode presisi tinggi terinspirasi dari Linear dan Raycast.
   - Monospace Device ID yang mudah dibaca dengan fitur salin sekali klik.
   - Floating Action Bar saat sesi aktif dengan metrik real-time (FPS, ping ms, status enkripsi).

5. **Fitur Pendukung Lengkap**:
   - ⌨️ **Hotkeys OS Cepat**: Buka Task Manager (`Ctrl+Shift+Esc`), minimize semua jendela (`Win+D`), switch app (`Alt+Tab`).
   - 💬 **Live Chat Terenkripsi**: Komunikasi langsung dengan saudaramu saat sedang memperbaiki komputernya.
   - 📁 **Transfer File P2P**: Kirim file installer, script, atau dokumen perbaikan langsung ke komputer remote.
   - ⛔ **Emergency Killswitch**: Pemilik PC memiliki kontrol penuh. Sesi dapat diputus seketika dengan menekan tombol **ESC sebanyak 3 kali** atau klik tombol merah *"Putus Koneksi"*.

---

## 📁 Struktur Proyek

```
app_remot/
├── Start-Host.bat          # Launcher 1-klik untuk PC yang ingin diremote (Kakak)
├── Start-Controller.bat    # Launcher 1-klik untuk PC yang mengendalikan (Kamu)
├── server.js               # Core HTTP server, WebSocket signaling, & IPC bridge
├── host/
│   └── input_engine.py     # Windows DPI-Aware SendInput & Mouse/Keyboard Engine
├── public/
│   ├── index.html          # Antarmuka web modern (Host & Controller view)
│   ├── style.css           # Desain dark mode presisi tinggi
│   ├── app.js              # Logika WebRTC, DataChannel, koordinat kursor, & chat
│   └── favicon.svg         # Ikon aplikasi
└── README.md               # Dokumentasi lengkap
```

---

## 🚀 Panduan Penggunaan

### Skenario: Kamu ingin meremote PC saudaramu yang bermasalah

#### Langkah 1: Di PC Saudaramu (Host)
1. Kirimkan folder proyek ini ke saudaramu (atau cukup jalankan di komputernya).
2. Klik ganda file:
   ```cmd
   Start-Host.bat
   ```
3. Jendela aplikasi OmniDesk akan terbuka otomatis.
4. Saudaramu cukup mengklik tombol **"Aktifkan Siaran Layar (Mulai Sesi)"** dan memilih layar monitor yang ingin dibagikan.
5. Minta saudaramu membacakan:
   - **Device ID** (misal: `782-901-445`)
   - **One-Time PIN** (misal: `849102`)

#### Langkah 2: Di PC Kamu (Controller)
1. Di komputermu, klik ganda file:
   ```cmd
   Start-Controller.bat
   ```
   *(Atau kamu juga bisa membuka browser apa saja seperti Chrome/Edge ke alamat `http://localhost:3920/?mode=controller`)*.
2. Masukkan **Device ID** dan **PIN** saudaramu.
3. Klik **"Hubungkan Jarak Jauh"**.
4. Dalam 1-2 detik, layar komputer saudaramu akan muncul di layar penuh! Kamu bisa menggerakkan mouse, mengetik, membuka aplikasi, hingga mengirimkan file perbaikan tanpa batas waktu!

---

## 🔒 Arsitektur Keamanan & Privasi

```
[ PC Saudara (Host) ]                             [ PC Kamu (Controller) ]
        │                                                     │
        │─── 1. Exchange SDP & PIN via WebRTC STUN ───────────│
        │                                                     │
        │◄═══════════════════════════════════════════════════►│
        │     2. Direct P2P DTLS-SRTP Encrypted Tunnel        │
        │                                                     │
        │─── [Video & Audio Stream 60 FPS] ──────────────────►│
        │◄── [Mouse & Keyboard Input Channel] ────────────────│
        │◄── [Bidirectional Chat & P2P File Transfer] ────────►│
```

- **Tidak ada rekaman layar yang disimpan**: Stream video hanya ada di memori RAM selama sesi berlangsung.
- **Kedaulatan Pemilik Komputer**: Saudaramu bisa mencentang/membatalkan centang *"Izinkan Kontrol Mouse & Keyboard"* sewaktu-waktu jika ingin menghentikan kendali sementara tanpa menutup siaran layar.

---

## 🛠️ Persyaratan Sistem

- **Sistem Operasi**: Windows 10 / Windows 11 (64-bit).
- **Runtime**:
  - Node.js (v18 ke atas)
  - Python 3.8 ke atas (dengan pustaka standar `ctypes`, tanpa install dependensi eksternal)
- **Browser**: Microsoft Edge atau Google Chrome.

---

## 💡 Tips & Trik

- **Koneksi Lintas Internet**: OmniDesk secara default memanfaatkan public STUN server Google (`stun.l.google.com:19302`) untuk menembus router NAT/WiFi rumah secara otomatis.
- **Koneksi Jaringan Lokal (WiFi yang sama)**: Jika kamu dan saudaramu berada dalam satu rumah/kantor dengan WiFi yang sama, koneksi akan otomatis terjalin dengan latensi lokal <5ms.
- **Full Screen**: Tekan tombol `Fullscreen` di toolbar atas atau tekan `F11` untuk pengalaman seperti menggunakan PC secara langsung.
