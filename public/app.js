/**
 * OmniDesk - Native Peer-to-Peer Remote Console
 * Industrial Software Architecture with Real-time Diagnostics & WebRTC DTLS-SRTP
 */

// Global State
let currentPeer = null;
let activeDataConn = null;
let activeMediaCall = null;
let localStream = null;
let isHost = false;
let hostAllowInput = true;
let sessionStartTime = null;
let sessionTimerInterval = null;
let pingInterval = null;

// Emergency ESC listener
let escPressCount = 0;
let lastEscTime = 0;

// WebRTC STUN Configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'host';
  switchView(mode);

  initHostCredentials();
  loadRecentDevices();
  setupEmergencyEscapeListener();

  const targetParam = urlParams.get('target');
  if (targetParam) {
    document.getElementById('targetDeviceIdInput').value = targetParam;
  }

  // Fetch local telemetry if available
  fetch('/api/status').then(r => r.json()).then(data => {
    appendLog(`Sistem lokal terdeteksi: ${data.platform} (Input Engine: ${data.inputEngineReady ? 'Aktif' : 'Menunggu'})`, 'info');
  }).catch(() => {});
});

// --- Tab Switching ---
function switchView(viewName) {
  const hostTab = document.getElementById('tabHostBtn');
  const controllerTab = document.getElementById('tabControllerBtn');
  const hostView = document.getElementById('viewHost');
  const controllerView = document.getElementById('viewController');

  if (viewName === 'host') {
    hostTab.classList.add('active');
    controllerTab.classList.remove('active');
    hostView.classList.add('active');
    controllerView.classList.remove('active');
    isHost = true;
  } else {
    controllerTab.classList.add('active');
    hostTab.classList.remove('active');
    controllerView.classList.add('active');
    hostView.classList.remove('active');
    isHost = false;
  }
}

// --- Terminal Log Helpers ---
function appendLog(message, type = '') {
  const box = document.getElementById('hostLogBox');
  if (!box) return;
  const now = new Date();
  const timeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="time">${timeStr}</span><span class="msg">${message}</span>`;
  box.appendChild(entry);
  box.scrollTop = box.scrollHeight;
}

function clearLogs() {
  const box = document.getElementById('hostLogBox');
  if (box) box.innerHTML = '';
}

// --- Host Identity & Credentials ---
function initHostCredentials() {
  let storedId = localStorage.getItem('omnidesk_host_id');
  if (!storedId) {
    const part1 = Math.floor(100 + Math.random() * 900);
    const part2 = Math.floor(100 + Math.random() * 900);
    const part3 = Math.floor(100 + Math.random() * 900);
    storedId = `${part1}-${part2}-${part3}`;
    localStorage.setItem('omnidesk_host_id', storedId);
  }
  document.getElementById('hostDeviceId').innerText = storedId;
  regeneratePin(false);
}

function regeneratePin(notify = true) {
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  document.getElementById('hostDevicePin').innerText = pin;
  sessionStorage.setItem('omnidesk_host_pin', pin);
  if (notify) {
    showToast('PIN sesi baru telah di-generate.');
    appendLog(`PIN sesi diperbarui: ${pin}`, 'info');
  }
}

function copyToClipboard(elementId, label) {
  const text = document.getElementById(elementId).innerText.replace(/\s+/g, '');
  navigator.clipboard.writeText(text).then(() => {
    showToast(`${label} disalin ke clipboard.`);
  }).catch(() => {
    showToast('Gagal menyalin text.');
  });
}

function showToast(msg) {
  const toast = document.getElementById('toastMsg');
  toast.innerText = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 2400);
}

// --- HOST MODE: Start Sharing & Handle Peer Inbound ---
async function startHostSharing() {
  const btn = document.getElementById('btnStartSharing');
  btn.disabled = true;
  btn.innerText = 'Menginisialisasi Display Media...';

  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor',
        cursor: 'always',
        frameRate: { ideal: 60, max: 60 }
      },
      audio: true
    });

    // Optimasi Ketajaman Teks Desktop (Cegah Layar Buram)
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      if ('contentHint' in videoTrack) {
        videoTrack.contentHint = 'detail';
        appendLog('WebRTC ContentHint diatur ke "detail" (prioritas ketajaman teks/layar).', 'info');
      }
      videoTrack.onended = () => {
        appendLog('Siaran layar dihentikan oleh pengguna.', 'warn');
        stopHostSession();
      };
    }

    const hostId = document.getElementById('hostDeviceId').innerText.replace(/-/g, '');
    const peerId = `omnidesk-${hostId}`;
    if (currentPeer) currentPeer.destroy();

    appendLog(`Mendaftarkan Peer ID di broker STUN: ${peerId}...`);

    currentPeer = new Peer(peerId, {
      config: rtcConfig,
      debug: 1
    });

    currentPeer.on('open', (id) => {
      btn.innerText = 'Siaran Aktif (Menunggu Remote Peer)';
      btn.style.background = 'var(--accent-green)';
      btn.style.borderColor = 'var(--accent-green)';
      document.getElementById('networkStatusText').innerText = 'Siaran Siap';
      appendLog('Siaran layar aktif. Saluran WebRTC siap menerima handshake.', 'success');
      showToast('Siaran layar aktif. Berikan ID & PIN ke remote peer.');
    });

    currentPeer.on('connection', (conn) => {
      appendLog(`Inbound connection request dari: ${conn.peer}`);

      conn.on('data', (data) => {
        handleIncomingDataOnHost(conn, data);
      });

      conn.on('close', () => {
        appendLog('Remote peer terputus dari sesi.', 'warn');
        stopHostSession();
      });

      activeDataConn = conn;
    });

    currentPeer.on('call', (call) => {
      appendLog('Menjawab panggilan video stream dari controller...', 'info');
      call.answer(localStream);
      activeMediaCall = call;
      applySenderOptimizations(call, window._currentQualityPreference || 'balanced');
      showHostActiveBanner();
    });

    currentPeer.on('error', (err) => {
      appendLog(`P2P Error [${err.type}]: ${err.message}`, 'warn');
      btn.disabled = false;
      btn.innerText = 'Mulai Siaran Layar';
      btn.style.background = '';
      btn.style.borderColor = '';
    });

  } catch (err) {
    appendLog(`Gagal mengambil display media: ${err.message}`, 'warn');
    btn.disabled = false;
    btn.innerText = 'Mulai Siaran Layar';
    btn.style.background = '';
    btn.style.borderColor = '';
  }
}

// Optimasi Parameter WebRTC Sender (Prioritaskan Resolusi & Batasi Bitrate Adaptif)
function applySenderOptimizations(call, quality = 'balanced') {
  if (!call || !call.peerConnection) return;

  const configureSenders = () => {
    try {
      const senders = call.peerConnection.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender && videoSender.getParameters) {
        const params = videoSender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }

        // Jangan pernah turunkan resolusi (cegah teks buram!)
        params.degradationPreference = 'maintain-resolution';

        // Konfigurasi bitrate agar tidak tersedak bandwidth upload
        if (quality === 'high') {
          params.encodings[0].maxBitrate = 5000000; // 5 Mbps
          params.encodings[0].maxFramerate = 60;
        } else if (quality === 'low') {
          params.encodings[0].maxBitrate = 1200000; // 1.2 Mbps
          params.encodings[0].maxFramerate = 30;
        } else {
          // Default balanced (Rekomendasi)
          params.encodings[0].maxBitrate = 2500000; // 2.5 Mbps
          params.encodings[0].maxFramerate = 45;
        }

        videoSender.setParameters(params).then(() => {
          appendLog(`Profil video diterapkan: ${quality.toUpperCase()} (maintain-resolution, max: ${(params.encodings[0].maxBitrate/1000000).toFixed(1)} Mbps)`, 'info');
        }).catch(err => {
          console.warn('[WebRTC Sender Config Warning]:', err);
        });
      }
    } catch (e) {
      console.warn('[WebRTC Config Error]:', e);
    }
  };

  if (call.peerConnection.connectionState === 'connected') {
    configureSenders();
  } else {
    call.peerConnection.addEventListener('connectionstatechange', () => {
      if (call.peerConnection.connectionState === 'connected') {
        configureSenders();
      }
    });
  }
}

function handleIncomingDataOnHost(conn, data) {
  if (data.type === 'auth') {
    const expectedPin = sessionStorage.getItem('omnidesk_host_pin') || document.getElementById('hostDevicePin').innerText;
    if (data.pin !== expectedPin) {
      appendLog(`Autentikasi GAGAL: PIN ${data.pin} tidak cocok.`, 'warn');
      conn.send({ type: 'auth_result', success: false, message: 'PIN Salah!' });
      setTimeout(() => conn.close(), 1000);
      return;
    }
    
    // Simpan preferensi kualitas dari controller
    window._currentQualityPreference = data.quality || 'balanced';
    if (activeMediaCall) {
      applySenderOptimizations(activeMediaCall, window._currentQualityPreference);
    }

    appendLog(`Autentikasi BERHASIL untuk remote controller. Kualitas: ${window._currentQualityPreference}`, 'success');
    conn.send({ type: 'auth_result', success: true });
    return;
  }

  if (data.type === 'ping') {
    conn.send({ type: 'pong', timestamp: data.timestamp });
    return;
  }

  if (data.type === 'chat') {
    appendLog(`[Chat Controller]: ${data.message}`, 'info');
    showToast(`Pesan Controller: ${data.message}`);
    return;
  }

  if (data.type === 'file_start') {
    appendLog(`Menerima file inbound: ${data.name} (${(data.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
    window._incomingFile = { name: data.name, size: data.size, chunks: [], received: 0 };
    return;
  }

  if (data.type === 'file_chunk') {
    if (window._incomingFile) {
      window._incomingFile.chunks.push(data.chunk);
      window._incomingFile.received += data.chunk.byteLength || data.chunk.length || 0;
      if (window._incomingFile.received >= window._incomingFile.size) {
        saveReceivedFile(window._incomingFile);
        window._incomingFile = null;
      }
    }
    return;
  }

  if (data.type === 'input') {
    if (!hostAllowInput) return;
    fetch('/api/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.command)
    }).catch(() => {});
  }
}

function saveReceivedFile(fileObj) {
  const blob = new Blob(fileObj.chunks);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileObj.name;
  a.click();
  appendLog(`File ${fileObj.name} selesai diunduh.`, 'success');
  showToast(`File ${fileObj.name} berhasil diterima!`);
}

function showHostActiveBanner() {
  const banner = document.getElementById('hostActiveBanner');
  banner.style.display = 'flex';
  sessionStartTime = Date.now();

  sessionTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    document.getElementById('hostSessionDuration').innerText = `Durasi: ${m}:${s}`;
  }, 1000);
}

function toggleHostInputPermission(allowed) {
  hostAllowInput = allowed;
  appendLog(`Izin kontrol mouse/keyboard diubah: ${allowed ? 'DIIZINKAN' : 'DIBLOKIR'}`, allowed ? 'info' : 'warn');
  showToast(allowed ? 'Kontrol mouse & keyboard diaktifkan' : 'Kontrol mouse & keyboard DIMATIKAN');
}

function stopHostSession() {
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  if (activeMediaCall) activeMediaCall.close();
  if (activeDataConn) activeDataConn.close();
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  document.getElementById('hostActiveBanner').style.display = 'none';
  const btn = document.getElementById('btnStartSharing');
  btn.disabled = false;
  btn.innerText = 'Mulai Siaran Layar';
  btn.style.background = '';
  btn.style.borderColor = '';
  appendLog('Sesi remote lokal telah ditutup.', 'info');
}

function setupEmergencyEscapeListener() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const now = Date.now();
      if (now - lastEscTime < 1000) {
        escPressCount++;
        if (escPressCount >= 3) {
          stopHostSession();
          appendLog('EMERGENCY KILLSWITCH: Sesi diputus via ESC x3', 'warn');
          showToast('⛔ DARURAT: Sesi langsung diputus!');
          escPressCount = 0;
        }
      } else {
        escPressCount = 1;
      }
      lastEscTime = now;
    }
  });
}

// --- CONTROLLER (CLIENT) MODE ---
async function connectToRemote(event) {
  if (event) event.preventDefault();

  const targetInput = document.getElementById('targetDeviceIdInput').value.trim().replace(/-/g, '');
  const pinInput = document.getElementById('targetPinInput').value.trim();
  const btn = document.getElementById('btnConnectRemote');

  if (!targetInput || !pinInput) {
    showToast('Harap isi Device ID dan PIN.');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Menghubungkan...';

  const myCtrlId = `omnidesk-ctrl-${Math.floor(1000 + Math.random() * 9000)}`;
  if (currentPeer) currentPeer.destroy();

  currentPeer = new Peer(myCtrlId, {
    config: rtcConfig,
    debug: 1
  });

  currentPeer.on('open', () => {
    const targetPeerId = `omnidesk-${targetInput}`;
    const conn = currentPeer.connect(targetPeerId, { reliable: true });

    conn.on('open', () => {
      const qualityChoice = document.getElementById('streamQualitySelect') ? document.getElementById('streamQualitySelect').value : 'balanced';
      conn.send({ type: 'auth', pin: pinInput, quality: qualityChoice });
    });

    conn.on('data', (data) => {
      if (data.type === 'auth_result') {
        if (!data.success) {
          showToast('Koneksi Ditolak: ' + (data.message || 'PIN Salah!'));
          btn.disabled = false;
          btn.innerText = 'Hubungkan';
          conn.close();
          return;
        }

        saveRecentDevice(targetInput);

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const dummyStream = canvas.captureStream();

        const call = currentPeer.call(targetPeerId, dummyStream);

        call.on('stream', (remoteStream) => {
          openRemoteViewer(remoteStream, conn);
          btn.disabled = false;
          btn.innerText = 'Hubungkan';
        });

        call.on('error', (err) => {
          showToast('Gagal memuat video stream: ' + err.message);
          btn.disabled = false;
          btn.innerText = 'Hubungkan';
        });

        activeMediaCall = call;
      }

      if (data.type === 'pong') {
        const rtt = Date.now() - data.timestamp;
        document.getElementById('remotePingText').innerText = `${rtt} ms`;
      }

      if (data.type === 'chat') {
        appendChatMessage(data.message, 'theirs');
      }
    });

    conn.on('close', () => {
      showToast('Koneksi ke remote PC telah terputus.');
      closeRemoteViewer();
      btn.disabled = false;
      btn.innerText = 'Hubungkan';
    });

    conn.on('error', () => {
      showToast('Gagal membuka koneksi ke target peer.');
      btn.disabled = false;
      btn.innerText = 'Hubungkan';
    });

    activeDataConn = conn;
  });

  currentPeer.on('error', (err) => {
    showToast('P2P Error: ' + err.type);
    btn.disabled = false;
    btn.innerText = 'Hubungkan';
  });
}

function openRemoteViewer(stream, dataConn) {
  const viewer = document.getElementById('remoteViewerContainer');
  const video = document.getElementById('remoteVideo');
  const wrapper = document.getElementById('remoteVideoWrapper');

  video.srcObject = stream;

  // Optimasi Latensi Ultra-Rendah (Hilangkan Jitter Buffer Delay)
  try {
    if ('playoutDelayHint' in video) {
      video.playoutDelayHint = 0; // Langsung render frame saat tiba, tanpa buffer buatan
    }
    if (activeMediaCall && activeMediaCall.peerConnection) {
      activeMediaCall.peerConnection.getReceivers().forEach(receiver => {
        if ('playoutDelayHint' in receiver) {
          receiver.playoutDelayHint = 0;
        }
      });
    }
  } catch (e) {
    console.warn('[WebRTC Playout Delay Warning]:', e);
  }

  viewer.style.display = 'flex';
  wrapper.focus();

  setupRemoteInputListeners(video, wrapper, dataConn);

  pingInterval = setInterval(() => {
    if (dataConn && dataConn.open) {
      dataConn.send({ type: 'ping', timestamp: Date.now() });
    }
  }, 2000);
}

function closeRemoteViewer() {
  if (pingInterval) clearInterval(pingInterval);
  const viewer = document.getElementById('remoteViewerContainer');
  const video = document.getElementById('remoteVideo');
  video.srcObject = null;
  viewer.style.display = 'none';
  if (activeMediaCall) activeMediaCall.close();
  if (activeDataConn) activeDataConn.close();
}

function disconnectFromRemote() {
  if (confirm('Putus koneksi remote sekarang?')) {
    closeRemoteViewer();
    showToast('Koneksi telah ditutup.');
  }
}

// --- Coordinate Normalization & Input Routing ---
function setupRemoteInputListeners(video, wrapper, dataConn) {
  let isThrottled = false;

  function calculateNormalizedCoords(e) {
    const rect = video.getBoundingClientRect();
    const videoWidth = video.videoWidth || rect.width;
    const videoHeight = video.videoHeight || rect.height;

    const containerAspect = rect.width / rect.height;
    const videoAspect = videoWidth / videoHeight;

    let renderWidth = rect.width;
    let renderHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > videoAspect) {
      renderWidth = rect.height * videoAspect;
      offsetX = (rect.width - renderWidth) / 2;
    } else {
      renderHeight = rect.width / videoAspect;
      offsetY = (rect.height - renderHeight) / 2;
    }

    const mouseX = e.clientX - rect.left - offsetX;
    const mouseY = e.clientY - rect.top - offsetY;

    const normX = Math.max(0, Math.min(1, mouseX / renderWidth));
    const normY = Math.max(0, Math.min(1, mouseY / renderHeight));

    return { normX, normY };
  }

  wrapper.addEventListener('mousemove', (e) => {
    if (!dataConn || !dataConn.open || isThrottled) return;
    isThrottled = true;

    const { normX, normY } = calculateNormalizedCoords(e);
    dataConn.send({
      type: 'input',
      command: { action: 'move', x: normX, y: normY }
    });

    setTimeout(() => { isThrottled = false; }, 16);
  });

  wrapper.addEventListener('mousedown', (e) => {
    if (!dataConn || !dataConn.open) return;
    wrapper.focus();

    const { normX, normY } = calculateNormalizedCoords(e);
    const btnName = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');

    dataConn.send({
      type: 'input',
      command: { action: 'mousedown', x: normX, y: normY, button: btnName }
    });
  });

  wrapper.addEventListener('mouseup', (e) => {
    if (!dataConn || !dataConn.open) return;
    const { normX, normY } = calculateNormalizedCoords(e);
    const btnName = e.button === 2 ? 'right' : (e.button === 1 ? 'middle' : 'left');

    dataConn.send({
      type: 'input',
      command: { action: 'mouseup', x: normX, y: normY, button: btnName }
    });
  });

  wrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  wrapper.addEventListener('wheel', (e) => {
    if (!dataConn || !dataConn.open) return;
    e.preventDefault();
    dataConn.send({
      type: 'input',
      command: { action: 'wheel', deltaY: e.deltaY }
    });
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const viewer = document.getElementById('remoteViewerContainer');
    if (viewer.style.display !== 'flex' || !dataConn || !dataConn.open) return;
    if (e.target.id === 'chatTextInput') return;

    if (['Tab', 'Alt', 'Meta'].includes(e.key)) {
      e.preventDefault();
    }

    dataConn.send({
      type: 'input',
      command: {
        action: 'keydown',
        code: e.code,
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey
      }
    });
  });

  window.addEventListener('keyup', (e) => {
    const viewer = document.getElementById('remoteViewerContainer');
    if (viewer.style.display !== 'flex' || !dataConn || !dataConn.open) return;
    if (e.target.id === 'chatTextInput') return;

    dataConn.send({
      type: 'input',
      command: {
        action: 'keyup',
        code: e.code,
        key: e.key
      }
    });
  });
}

function sendSpecialCommand(actionName) {
  if (activeDataConn && activeDataConn.open) {
    activeDataConn.send({
      type: 'input',
      command: { action: 'special', name: actionName }
    });
    showToast(`Perintah ${actionName} dikirim.`);
  }
}

function toggleRemoteFullscreen() {
  const elem = document.getElementById('remoteViewerContainer');
  if (!document.fullscreenElement) {
    elem.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

// --- Chat & File Transfer ---
function toggleChatDrawer() {
  const drawer = document.getElementById('chatDrawer');
  drawer.style.display = drawer.style.display === 'flex' ? 'none' : 'flex';
}

function sendChatMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatTextInput');
  const msg = input.value.trim();
  if (!msg || !activeDataConn || !activeDataConn.open) return;

  activeDataConn.send({ type: 'chat', message: msg });
  appendChatMessage(msg, 'mine');
  input.value = '';
}

function appendChatMessage(msg, sender) {
  const box = document.getElementById('chatMessages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerText = msg;
  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;
}

function toggleFileDrawer() {
  const drawer = document.getElementById('fileDrawer');
  drawer.style.display = drawer.style.display === 'flex' ? 'none' : 'flex';
}

function handleFileSelected(e) {
  const file = e.target.files[0];
  if (!file || !activeDataConn || !activeDataConn.open) return;

  const status = document.getElementById('fileTransferStatus');
  status.innerText = `Mengirim: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`;

  activeDataConn.send({ type: 'file_start', name: file.name, size: file.size });

  const CHUNK_SIZE = 16384;
  let offset = 0;
  const reader = new FileReader();

  function readSlice() {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    reader.readAsArrayBuffer(slice);
  }

  reader.onload = (event) => {
    activeDataConn.send({ type: 'file_chunk', chunk: event.target.result });
    offset += CHUNK_SIZE;

    const progress = Math.min(100, Math.round((offset / file.size) * 100));
    status.innerText = `Mengirim ${file.name}: ${progress}%`;

    if (offset < file.size) {
      setTimeout(readSlice, 4);
    } else {
      status.innerText = `File ${file.name} selesai terkirim.`;
      showToast('File berhasil dikirim ke remote PC.');
    }
  };

  readSlice();
}

// --- Recent Devices Table Management ---
function saveRecentDevice(deviceId) {
  let devices = JSON.parse(localStorage.getItem('omnidesk_recent') || '[]');
  const formatted = deviceId.length === 9 ? `${deviceId.slice(0,3)}-${deviceId.slice(3,6)}-${deviceId.slice(6,9)}` : deviceId;
  if (!devices.includes(formatted)) {
    devices.unshift(formatted);
    if (devices.length > 5) devices.pop();
    localStorage.setItem('omnidesk_recent', JSON.stringify(devices));
    loadRecentDevices();
  }
}

function loadRecentDevices() {
  const container = document.getElementById('recentDevicesList');
  if (!container) return;
  const devices = JSON.parse(localStorage.getItem('omnidesk_recent') || '[]');
  if (devices.length === 0) {
    container.innerHTML = `<tr><td colspan="3" style="color: var(--text-dim); text-align: center; padding: 24px;">Belum ada riwayat koneksi. Perangkat yang pernah kamu remote akan tercatat di sini.</td></tr>`;
    return;
  }

  container.innerHTML = '';
  devices.forEach(id => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-weight: 600; color: #FFFFFF;">${id}</td>
      <td><span style="color: var(--accent-green); font-size: 11px;">Tersimpan</span></td>
      <td style="text-align: right;">
        <button class="btn btn-default" style="padding: 3px 10px; font-size: 11px;" onclick="quickConnectDevice('${id}')">Hubungkan</button>
      </td>
    `;
    container.appendChild(tr);
  });
}

function quickConnectDevice(id) {
  document.getElementById('targetDeviceIdInput').value = id;
  document.getElementById('targetPinInput').focus();
  showToast(`ID ${id} dimuat.`);
}
