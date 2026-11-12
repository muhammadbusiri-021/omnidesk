# OmniDesk — Enterprise Peer-to-Peer Remote Desktop

> **Solusi Remote Desktop Mandiri, Cepat, Bebas Biaya Langganan, dan Terenkripsi Penuh (E2EE) untuk IT Support, Sysadmin, dan Manajemen Perangkat Jarak Jauh.**

OmniDesk dirancang sebagai alternatif open-source mandiri untuk mengatasi limitasi software remote komersial proprietary (seperti AnyDesk atau TeamViewer) yang membatasi sesi kerja (*commercial use timeout*), model langganan berbayar, serta risiko privasi data pada server relay pihak ketiga.

---

## ⚡ Fitur & Keunggulan Arsitektur

1. **100% Bebas Biaya & Tanpa Batas Durasi Sesi**:
   - Tidak ada batasan waktu koneksi (*unlimited session timeout*).
   - Bebas iklan, telemetri komersial, maupun pembatasan lisensi.

2. **Privasi & Keamanan Tingkat Tinggi (Zero-Knowledge & DTLS-SRTP)**:
   - Menggunakan standar industri **WebRTC Peer-to-Peer**.
   - Video layar, audio, dan keystroke ditransmisikan **langsung secara peer-to-peer (Direct P2P)** antar-perangkat. Server perantara (signaling) tidak memiliki akses terhadap piksel layar maupun aliran data.
   - Enkripsi end-to-end terpasang secara *native* via **DTLS 1.2/1.3 dan SRTP**.
   - Dilengkapi autentikasi **One-Time Security PIN** dinamis untuk mencegah akses tidak sah.

3. **Performa Tinggi (Hardware-Accelerated & DPI-Aware)**:
   - Streaming hingga **60 FPS** dengan latensi ultra-rendah memanfaatkan encoder Chromium bawaan.
   - Engine input Windows berbasis `user32.dll SendInput` (Python DPI-aware) menjamin presisi koordinat kursor dan event keyboard pada multi-monitor maupun resolusi tinggi (1080p, 2K, 4K, skala DPI 125%-150%).

4. **Antarmuka Minimalis & Utilitarian (Industrial Design)**:
   - Tampilan dark mode bertema utilitas teknis tanpa elemen grafis yang berlebihan (*no glassmorphism / no neon gradients*).
   - Format Device ID monospace dengan aksi salin instan.
   - Telemetri sistem terintegrasi dan terminal log audit real-time.

5. **Fitur Pengendalian Lengkap**:
   - ⌨️ **Pintasan Sistem Cepat**: Akses instan ke Task Manager (`Ctrl+Shift+Esc`), minimize jendela (`Win+D`), dan app switcher (`Alt+Tab`).
   - 💬 **Live Chat Terenkripsi**: Saluran pesan langsung antar-operator dan pengguna host selama sesi berjalan.
   - 📁 **Transfer File P2P**: Pengiriman berkas teknis, script, atau installer melalui DataChannel WebRTC terenkripsi.
   - ⛔ **Emergency Killswitch**: Pemilik perangkat host memegang kendali penuh. Sesi dapat diputus sewaktu-waktu dengan menekan tombol **ESC 3 kali berturut-turut** atau klik tombol *"Putus Sesi"*.

---

## 📁 Struktur Berkas

```
omnidesk/
├── Start-Host.bat          # Launcher 1-klik untuk mode Host (Komputer yang diremote)
├── Start-Controller.bat    # Launcher 1-klik untuk mode Controller (Operator pengendali)
├── server.js               # Core HTTP server, WebSocket signaling, & IPC bridge
├── host/
│   └── input_engine.py     # Windows DPI-Aware SendInput & Keyboard/Mouse Driver
├── public/
│   ├── index.html          # Antarmuka web konsol remote
│   ├── style.css           # Desain tema industrial utility
│   ├── app.js              # Logika WebRTC, DataChannel, event input, & transfer file
│   └── favicon.svg         # Ikon aplikasi
└── README.md               # Dokumentasi teknis
```

---

## 🚀 Panduan Pengoperasian

### 1. Di Komputer Target (Host)
1. Buka folder aplikasi dan jalankan:
   ```cmd
   Start-Host.bat
   ```
2. Aplikasi akan terbuka otomatis dalam mode jendela aplikasi mandiri.
3. Klik tombol **"Mulai Siaran Layar"** dan tentukan monitor yang ingin dibagikan.
4. Salin kredensial sesi yang tertera pada layar:
   - **Device ID** (contoh: `782-901-445`)
   - **Password Sesi (PIN)** (contoh: `849102`)

### 2. Di Komputer Operator (Controller)
1. Jalankan launcher pengendali:
   ```cmd
   Start-Controller.bat
   ```
   *(Atau buka peramban Chrome/Edge menuju alamat `http://localhost:3920/?mode=controller`)*.
2. Masukkan **Device ID** dan **PIN** dari komputer target pada baris koneksi.
3. Klik **"Hubungkan"**.
4. Dalam 1-2 detik, sesi desktop remote aktif secara penuh dengan kendali kursor, keyboard, transfer file, dan monitoring latensi.

---

## 🔒 Arsitektur Keamanan & Aliran Data

```
[ Target Device (Host) ]                          [ Operator (Controller) ]
         │                                                    │
         │─── 1. Exchange SDP & PIN via WebRTC STUN ──────────│
         │                                                    │
         │◄══════════════════════════════════════════════════►│
         │      2. Direct P2P DTLS-SRTP Encrypted Tunnel      │
         │                                                    │
         │─── [Video & Audio Stream 60 FPS] ─────────────────►│
         │◄── [Mouse & Keyboard Input Channel] ───────────────│
         │◄── [Bidirectional Chat & P2P File Transfer] ───────►│
```

- **Ephemeral Memory Only**: Aliran video layar diproses langsung di memori (RAM) tanpa disimpan ke penyimpanan disk permanen.
- **Granular Permissions**: Pengguna lokal dapat mengaktifkan atau menonaktifkan izin kendali mouse/keyboard secara langsung tanpa harus memutus siaran layar.

---

## 🛠️ Persyaratan Sistem

- **Sistem Operasi**: Windows 10 / Windows 11 (64-bit).
- **Runtime**:
  - Node.js (v18 ke atas)
  - Python 3.8 ke atas (menggunakan library bawaan `ctypes`, tanpa dependensi pip eksternal)
- **Peramban**: Microsoft Edge atau Google Chrome.

---

## 💡 Konfigurasi Jaringan

- **Koneksi Lintas Internet (WAN)**: OmniDesk menggunakan server STUN publik resmi Google (`stun.l.google.com:19302`) untuk melakukan NAT traversal secara otomatis menembus router firewall tanpa perlu konfigurasi port forwarding manual.
- **Koneksi Jaringan Lokal (LAN)**: Pada jaringan lokal yang sama atau melalui VPN (Tailscale/WireGuard), paket data terhubung secara direct socket dengan latensi ultra-rendah (<5ms).
- **Mode Layar Penuh**: Gunakan tombol `Fullscreen` pada toolbar atau tekan `F11` untuk pengalaman kendali desktop imersif.
