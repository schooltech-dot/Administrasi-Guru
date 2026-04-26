// ================================================================
//  app.js — SD Negeri 3 Kalipang
//  Sistem Informasi Sekolah
//  Data persisten via localStorage (prefix: sdn3_)
// ================================================================
// ============================================================
// LS — LocalStorage helper
// ============================================================
const LS = {
  get(k,d){try{const v=localStorage.getItem('sdn3_'+k);return v!==null?JSON.parse(v):d;}catch{return d;}},
  set(k,v){try{localStorage.setItem('sdn3_'+k,JSON.stringify(v));}catch{}},
  del(k)  {try{localStorage.removeItem('sdn3_'+k);}catch{}}
};


// ============================================================
// ==================== AUTO-SAVE ke LocalStorage =============
// ============================================================
function perpusLoad() {
  // Tampilkan/sembunyikan tab Tambah berdasarkan role
  const tambahBtn = document.getElementById('perpus-tab-tambah-btn');
  if (tambahBtn) {
    const bisa = sessionUser && ['admin','kepsek','guru'].includes(sessionUser.role);
    tambahBtn.style.display = bisa ? '' : 'none';
  }
  perpusRenderRak();
}

function saveAll() {
  LS.set('siswa_master', siswaMaster);
  LS.set('guru_data', guruData);
  LS.set('nilai_data', nilaiData);
  LS.set('ujian_list', ujianList);
  LS.set('absen_history', absenHistory);
  LS.set('perpus_data', perpusData);
  if (typeof jurnalList !== 'undefined') LS.set('jurnal_list', jurnalList);
  if (typeof jadwalData !== 'undefined') LS.set('jadwal_data', jadwalData);
  if (typeof jadwalRows !== 'undefined') LS.set('jadwal_rows', jadwalRows);
  if (typeof materiDocs !== 'undefined') LS.set('materi_docs', materiDocs);
}

function resetAllData() {
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'kepsek')) {
    showToast('⛔ Akses ditolak. Hanya Admin yang bisa reset data.', '#C62828'); return;
  }
  if (!confirm('⚠️ Yakin reset SEMUA data? (Siswa, Guru, Nilai, Ujian, Jadwal, Absensi)\nData demo akan dikembalikan.')) return;
  LS.del('siswa_master');
  LS.del('guru_data');
  LS.del('nilai_data');
  LS.del('ujian_list');
  LS.del('jadwal_data');
  LS.del('jadwal_rows');
  LS.del('absen_history');
  LS.del('materi_docs');
  siswaMaster = JSON.parse(JSON.stringify(_siswaDemoDefault));
  guruData    = JSON.parse(JSON.stringify(_guruDemoDefault));
  nilaiData   = {};
  ujianList   = [];
  jadwalData  = {};
  jadwalRows  = [];
  absenHistory= {};
  jurnalList  = [];
  LS.del('jurnal_list');
  initJadwalDemo();
  initDemoUjian();
  materiDocs  = {};
  showToast('🗑 Semua data direset ke default.', '#F57F17');
  goScreen('dash');
}

function lsInfo() {
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'kepsek')) {
    showToast('⛔ Akses ditolak.', '#C62828'); return;
  }
  let total = 0;
  const keys = ['siswa_master','guru_data','nilai_data','ujian_list','jadwal_data','absen_history','materi_docs','app_config'];
  const info = keys.map(k => {
    const v = localStorage.getItem('sdn3_'+k);
    const sz = v ? (v.length/1024).toFixed(1) : 0;
    if (v) total += v.length;
    return k + ': ' + (v ? sz + ' KB' : '—');
  });
  alert('📦 LocalStorage Usage:\n' + info.join('\n') + '\n\nTotal: ' + (total/1024).toFixed(1) + ' KB');
}

// ============================================================
// NAVIGASI — BUG FIX: gunakan style.display langsung via JS
// ============================================================
function goScreen(id) {
  // Bersihkan timer game jika keluar dari screen game
  if (id !== 'game' && typeof gameState !== 'undefined' && gameState.timer) {
    clearInterval(gameState.timer);
    gameState.timer = null;
  }
  // Bersihkan timer ujian jika keluar dari screen ujian
  if (id !== 'ujian' && typeof ujianState !== 'undefined' && ujianState.timer) {
    clearInterval(ujianState.timer);
    ujianState.timer = null;
  }
  document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; });
  const target = document.getElementById('screen-' + id);
  if (!target) return;
  target.style.display = (id === 'login') ? 'flex' : 'block';
  window.scrollTo(0, 0);
  if (id === 'dash')       updateDashStats();
  if (id === 'kepsek')     kepsekLoad();
  if (id === 'ujian')      ujianRefreshKelola();
  if (id === 'jadwal')     jadwalRender();
  if (id === 'pengaturan') pengaturanLoad();
  if (id === 'notifikasi') notifLoad();
  if (id === 'kelas')      kelasLoad();
  if (id === 'guru')       { guruScreenLoad(); }
  if (id === 'materi')     { materiInit(); materiLoad(); }
  if (id === 'jurnal')     { jurnalInit(); jurnalLoad(); }
  if (id === 'rekap')      rekapLoad();
  if (id === 'raport')     raportInit();
  if (id === 'perpustakaan') perpusLoad();
}

window.addEventListener('DOMContentLoaded', function () {
  // Sembunyikan semua screen dulu
  document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; });

  // Set tanggal hari ini
  const d = new Date();
  const tgl = d.toISOString().split('T')[0];
  const absEl = document.getElementById('abs-tgl');
  if (absEl) absEl.value = tgl;

  // Init data & modul — guard typeof agar tidak crash jika fungsi tidak ada
  if (typeof initPenilaian  === 'function') initPenilaian();
  if (typeof initJadwalDemo === 'function') {
    const jd = (typeof jadwalData !== 'undefined') ? jadwalData : {};
    if (Object.keys(jd).length === 0) initJadwalDemo();
  }
  if (typeof materiInit === 'function') materiInit();
  if (typeof jurnalInit === 'function') jurnalInit();

  // ── Restore sesi: initDefaultAccounts async, tapi kita tidak perlu await
  //    karena hanya perlu akun saat login, bukan saat restore sesi ──
  initDefaultAccounts();

  // Restore sesi dari localStorage
  if (sessionUser) {
    const rl = { guru: 'Guru', kepsek: 'Kepala Sekolah', admin: 'Administrator' };
    const uname = document.getElementById('dash-uname');
    const urole = document.getElementById('dash-role');
    if (uname) uname.textContent = sessionUser.nama;
    if (urole) urole.textContent = (rl[sessionUser.role] || sessionUser.role) + ' • SD Negeri 3 Kalipang';
    setTimeout(function () { if (typeof avatarLoad === 'function') avatarLoad(); }, 50);
    const target = sessionUser.role === 'kepsek' ? 'kepsek' : 'dash';
    goScreen(target);
    idleStart();
  } else {
    document.getElementById('screen-login').style.display = 'flex';
  }
});

// ===== updateDashStats =====
function updateDashStats() {
  // Update info strip: tanggal hari ini
  const now = new Date();
  const tglHariIni = now.toISOString().split('T')[0];
  const hariNama = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dateEl = document.getElementById('dash-info-date');
  if (dateEl) dateEl.textContent = '📅 ' + hariNama;

  // Hitung absensi hari ini
  const absenHariIni = absenHistory[tglHariIni];
  let totH = 0, totA = 0;
  if (absenHariIni) {
    Object.values(absenHariIni).forEach(e => {
      totH += (e.counts.H || 0);
      totA += (e.counts.A || 0);
    });
  }
  const hadirEl = document.getElementById('dash-badge-hadir');
  const alphaEl = document.getElementById('dash-badge-alpha');
  if (hadirEl) hadirEl.textContent = '✅ ' + (absenHariIni ? totH : '—') + ' hadir';
  if (alphaEl) alphaEl.textContent = '❌ ' + (absenHariIni ? totA : '—') + ' alpha';

  // Update avatar dari storage
  avatarLoad();
}

// ===== TOAST =====
// ============================================================
// ==================== POPUP NOTIFIKASI ======================
// ============================================================
let _popupTimer = null;
let _popupBarTimer = null;

/**
 * showPopup(msg, type, title, duration)
 * type: 'success' | 'error' | 'warning' | 'info' | 'delete'
 * title: opsional, auto dari type jika kosong
 * duration: ms (default 3200)
 */
function showPopup(msg, type, title, duration) {
  type     = type     || 'success';
  duration = duration || 3200;

  const defaultTitle = {
    success: 'Berhasil!',
    error  : 'Gagal!',
    warning: 'Perhatian!',
    info   : 'Informasi',
    delete : 'Dihapus',
  };
  const defaultIcon = {
    success: '✅',
    error  : '❌',
    warning: '⚠️',
    info   : 'ℹ️',
    delete : '🗑️',
  };

  title = title || defaultTitle[type] || 'Notifikasi';

  const el    = document.getElementById('popup-notif');
  const icon  = document.getElementById('popup-icon');
  const ttl   = document.getElementById('popup-title');
  const txt   = document.getElementById('popup-msg');
  const bar   = document.getElementById('popup-bar');
  if (!el) { console.warn('popup-notif not found'); return; }

  // Clear timer lama
  if (_popupTimer)    clearTimeout(_popupTimer);
  if (_popupBarTimer) clearTimeout(_popupBarTimer);

  // Atur konten
  icon.textContent = defaultIcon[type] || '📢';
  ttl.textContent  = title;
  txt.textContent  = msg;

  // Reset type class
  el.className = '';
  el.classList.add('type-' + type);

  // Reset bar
  bar.style.transition = 'none';
  bar.style.width      = '100%';

  // Tampilkan
  el.classList.add('show');

  // Animasi progress bar
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition = 'width ' + duration + 'ms linear';
      bar.style.width      = '0%';
    });
  });

  // Auto dismiss
  _popupTimer = setTimeout(() => popupDismiss(), duration);
}

function popupDismiss() {
  const el = document.getElementById('popup-notif');
  if (!el) return;
  el.classList.remove('show');
  if (_popupTimer)    clearTimeout(_popupTimer);
  if (_popupBarTimer) clearTimeout(_popupBarTimer);
}

// Alias showToast → showPopup agar semua kode lama tetap jalan
function showToast(msg, color) {
  // Deteksi tipe dari warna lama
  let type = 'success';
  if (color === '#C62828' || color === '#B71C1C') type = 'error';
  else if (color === '#F57F17' || color === '#E65100') type = 'delete';
  else if (color === '#1565C0' || color === '#0D47A1') type = 'info';
  else if (color === '#E65100' || color === '#BF360C') type = 'warning';
  showPopup(msg, type);
}

// ============================================================
// ==================== SISTEM LOGIN AMAN =====================
// ============================================================
// Hash password menggunakan Web Crypto API (SHA-256)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_sdn3kalipang_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Inisialisasi akun default jika belum ada
async function initDefaultAccounts() {
  const existing = LS.get('user_accounts', null);
  if (existing) return; // Sudah ada akun, skip

  const accounts = [
    { username: 'admin',    role: 'admin',  nama: 'Administrator',         hash: await hashPassword('admin123') },
    { username: 'kepsek',   role: 'kepsek', nama: 'Budi Santoso, S.Pd',   hash: await hashPassword('kepsek123') },
    { username: 'guru1',    role: 'guru',   nama: 'Guru Kelas 1',          hash: await hashPassword('guru123') },
    { username: 'guru2',    role: 'guru',   nama: 'Guru Kelas 2',          hash: await hashPassword('guru123') },
  ];
  LS.set('user_accounts', accounts);
}

// State sesi login — pakai localStorage agar persist saat refresh
let sessionUser = null;
try {
  const sesi = localStorage.getItem('sdn3_sesi');
  if (sesi) sessionUser = JSON.parse(sesi);
} catch {}

let currentRole = 'guru';
function setRole(el, role) {
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentRole = role;
  const labels = { guru: 'NIP / Username', kepsek: 'NIP Kepala Sekolah', admin: 'Username Admin' };
  document.getElementById('lbl-user').textContent = labels[role] || 'Username';
  document.getElementById('login-msg').className = 'msg-box';
}

function togglePw() {
  const pw = document.getElementById('inp-password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
}

// Throttle brute force: max 5 percobaan per 30 detik
const loginAttempts = { count: 0, resetAt: 0 };

async function doLogin() {
  const u   = document.getElementById('inp-username').value.trim().toLowerCase();
  const p   = document.getElementById('inp-password').value;
  const msg = document.getElementById('login-msg');

  if (!u || !p) {
    msg.textContent = 'Username dan password tidak boleh kosong.';
    msg.className = 'msg-box error';
    return;
  }

  // Throttle: cek apakah terlalu banyak percobaan
  const now = Date.now();
  if (loginAttempts.count >= 5 && now < loginAttempts.resetAt) {
    const sisaDetik = Math.ceil((loginAttempts.resetAt - now) / 1000);
    msg.textContent = `⛔ Terlalu banyak percobaan. Coba lagi dalam ${sisaDetik} detik.`;
    msg.className = 'msg-box error';
    return;
  }
  if (now >= loginAttempts.resetAt) { loginAttempts.count = 0; loginAttempts.resetAt = 0; }

  // Hash password yang diinput
  const inputHash = await hashPassword(p);

  // Cari akun
  const accounts = LS.get('user_accounts', []);
  const akun = accounts.find(a => a.username.toLowerCase() === u);

  if (!akun || akun.hash !== inputHash) {
    loginAttempts.count++;
    loginAttempts.resetAt = Date.now() + 30000;
    const sisaPercobaan = Math.max(0, 5 - loginAttempts.count);
    msg.textContent = 'Username atau password salah.' + (sisaPercobaan > 0 ? ` (${sisaPercobaan} percobaan tersisa)` : ' Akun dikunci sementara.');
    msg.className = 'msg-box error';
    return;
  }

  // Login berhasil — reset throttle
  loginAttempts.count = 0;

  // Simpan sesi di localStorage agar persist saat refresh/buka ulang
  sessionUser = { username: akun.username, nama: akun.nama, role: akun.role };
  localStorage.setItem('sdn3_sesi', JSON.stringify(sessionUser));

  msg.textContent = '✅ Login berhasil! Mengalihkan...';
  msg.className = 'msg-box success';

  // Update tampilan dashboard
  document.getElementById('dash-uname').textContent = akun.nama;
  const rl = { guru: 'Guru', kepsek: 'Kepala Sekolah', admin: 'Administrator' };
  document.getElementById('dash-role').textContent = (rl[akun.role] || akun.role) + ' • SD Negeri 3 Kalipang';

  // Load avatar profil milik akun ini
  setTimeout(() => avatarLoad(), 100);

  const targetScreen = akun.role === 'kepsek' ? 'kepsek' : 'dash';
  setTimeout(() => { goScreen(targetScreen); idleStart(); }, 800);
}

function doLogout() {
  sessionUser = null;
  try { localStorage.removeItem('sdn3_sesi'); } catch {}
  idleStop(); // hentikan timer idle
  loginAttempts.count = 0;
  document.getElementById('inp-username').value = '';
  document.getElementById('inp-password').value = '';
  document.getElementById('login-msg').className = 'msg-box';
  goScreen('login');
}

// ============================================================
// ==================== AUTO-LOGOUT IDLE 30 MENIT =============
// ============================================================
const IDLE_LIMIT = 30 * 60 * 1000; // 30 menit dalam ms
let _idleTimer = null;

function idleReset() {
  // Simpan timestamp aktivitas terakhir
  localStorage.setItem('sdn3_last_active', Date.now());
  if (_idleTimer) clearTimeout(_idleTimer);
  if (!sessionUser) return;
  _idleTimer = setTimeout(() => {
    // Cek ulang: mungkin user aktif di tab lain
    const last = parseInt(localStorage.getItem('sdn3_last_active') || '0');
    if (Date.now() - last >= IDLE_LIMIT) {
      showPopup('Sesi berakhir karena tidak ada aktivitas selama 30 menit.', 'warning', 'Sesi Berakhir', 5000);
      setTimeout(() => doLogout(), 1500);
    } else {
      // Masih aktif di tab lain, reset timer sisa
      idleReset();
    }
  }, IDLE_LIMIT);
}

function idleStart() {
  ['mousemove','mousedown','keydown','touchstart','scroll','click'].forEach(ev => {
    document.addEventListener(ev, idleReset, { passive: true });
  });
  idleReset();
}

function idleStop() {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
  ['mousemove','mousedown','keydown','touchstart','scroll','click'].forEach(ev => {
    document.removeEventListener(ev, idleReset);
  });
}

// ============================================================
// ==================== FOTO PROFIL / AVATAR ==================
// ============================================================
function avatarGetKey() {
  return 'avatar_' + (sessionUser ? sessionUser.username : 'default');
}

function avatarLoad() {
  const data = LS.get(avatarGetKey(), null);
  const imgEl   = document.getElementById('dash-avatar-img');
  const emojiEl = document.getElementById('dash-avatar-emoji');
  if (!imgEl || !emojiEl) return;

  if (data && data.type === 'image' && data.src) {
    imgEl.src = data.src;
    imgEl.style.display = 'block';
    emojiEl.style.display = 'none';
  } else if (data && data.type === 'emoji' && data.value) {
    emojiEl.textContent = data.value;
    emojiEl.style.display = '';
    imgEl.style.display = 'none';
  } else {
    // Default berdasarkan role
    const defaultEmoji = { kepsek: '🏫', admin: '⚙️', guru: '👨‍🏫' };
    emojiEl.textContent = sessionUser ? (defaultEmoji[sessionUser.role] || '👨‍🏫') : '👨‍🏫';
    emojiEl.style.display = '';
    imgEl.style.display = 'none';
  }
}

function avatarSheetOpen() {
  // Sync preview ke state saat ini
  const data = LS.get(avatarGetKey(), null);
  const sheetImg   = document.getElementById('sheet-avatar-img');
  const sheetEmoji = document.getElementById('sheet-avatar-emoji');

  if (data && data.type === 'image' && data.src) {
    sheetImg.src = data.src;
    sheetImg.style.display = 'block';
    sheetEmoji.style.display = 'none';
  } else {
    sheetImg.style.display = 'none';
    sheetEmoji.style.display = '';
    sheetEmoji.textContent = (data && data.type === 'emoji') ? data.value : '👨‍🏫';
  }

  document.getElementById('avatar-sheet-overlay').style.display = 'block';
  document.getElementById('avatar-sheet').style.display = 'block';
}

function avatarSheetClose() {
  document.getElementById('avatar-sheet-overlay').style.display = 'none';
  document.getElementById('avatar-sheet').style.display = 'none';
}

function avatarHandleUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('File harus berupa gambar!', '#C62828'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('Ukuran foto max 2MB ya bro!', '#C62828'); return; }

  const reader = new FileReader();
  reader.onload = function(e) {
    // Compress via canvas supaya tidak bengkak di localStorage
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const MAX = 200;
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
      else        { w = Math.round(w * MAX / h); h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.82);

      // Simpan
      LS.set(avatarGetKey(), { type: 'image', src: compressed });

      // Update preview sheet
      const sheetImg = document.getElementById('sheet-avatar-img');
      sheetImg.src = compressed;
      sheetImg.style.display = 'block';
      document.getElementById('sheet-avatar-emoji').style.display = 'none';

      // Update header
      avatarLoad();
      showToast('✅ Foto profil diperbarui!', '#2E7D32');
      setTimeout(() => avatarSheetClose(), 800);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value = ''; // reset supaya bisa upload ulang file sama
}

function avatarPilihEmoji(emoji) {
  LS.set(avatarGetKey(), { type: 'emoji', value: emoji });

  // Update preview sheet
  document.getElementById('sheet-avatar-img').style.display = 'none';
  const sheetEmoji = document.getElementById('sheet-avatar-emoji');
  sheetEmoji.style.display = '';
  sheetEmoji.textContent = emoji;

  // Update header
  avatarLoad();
  showToast('✅ Avatar diperbarui!', '#2E7D32');
  setTimeout(() => avatarSheetClose(), 600);
}

function avatarHapus() {
  LS.del(avatarGetKey());
  document.getElementById('sheet-avatar-img').style.display = 'none';
  const sheetEmoji = document.getElementById('sheet-avatar-emoji');
  sheetEmoji.style.display = '';
  sheetEmoji.textContent = '👨‍🏫';
  avatarLoad();
  showToast('🗑 Foto profil direset.', '#F57F17');
  setTimeout(() => avatarSheetClose(), 600);
}

// ===== MANAJEMEN AKUN (di Pengaturan) =====
function akunRender() {
  const el = document.getElementById('akun-list');
  if (!el) return;
  const accounts = LS.get('user_accounts', []);
  if (!accounts.length) { el.innerHTML = '<div style="font-size:12px;color:#9E9E9E;padding:8px 0">Belum ada akun.</div>'; return; }
  const roleLabel = { admin: '⚙️ Admin', kepsek: '🏫 Kepsek', guru: '👨‍🏫 Guru' };
  el.innerHTML = accounts.map((a, i) =>
    `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F5F5F5">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#212121">${a.nama}</div>
        <div style="font-size:11px;color:#9E9E9E">@${a.username} · ${roleLabel[a.role]||a.role}</div>
      </div>
      ${accounts.length > 1 ? `<button onclick="akunHapus(${i})" style="background:#FFEBEE;color:#C62828;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">Hapus</button>` : ''}
    </div>`
  ).join('');
}

async function akunTambah() {
  const u = (document.getElementById('akun-username') ? document.getElementById('akun-username').value.trim() : '').toLowerCase();
  const p = document.getElementById('akun-password') ? document.getElementById('akun-password').value : '';
  const n = document.getElementById('akun-nama') ? document.getElementById('akun-nama').value.trim() : '';
  const r = document.getElementById('akun-role') ? document.getElementById('akun-role').value : 'guru';

  if (!u || !p || !n) { showToast('Semua field akun wajib diisi!', '#C62828'); return; }
  if (p.length < 6) { showToast('Password minimal 6 karakter!', '#C62828'); return; }

  const accounts = LS.get('user_accounts', []);
  if (accounts.find(a => a.username.toLowerCase() === u)) { showToast('Username sudah digunakan!', '#C62828'); return; }

  const hash = await hashPassword(p);
  accounts.push({ username: u, role: r, nama: n, hash });
  LS.set('user_accounts', accounts);

  ['akun-username','akun-password','akun-nama'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  akunRender();
  showToast('✅ Akun @' + u + ' berhasil dibuat!', '#2E7D32');
}

async function akunGantiPassword() {
  const pLama = document.getElementById('akun-pw-lama') ? document.getElementById('akun-pw-lama').value : '';
  const pBaru = document.getElementById('akun-pw-baru') ? document.getElementById('akun-pw-baru').value : '';
  if (!pLama || !pBaru) { showToast('Password lama & baru wajib diisi!', '#C62828'); return; }
  if (pBaru.length < 6) { showToast('Password baru minimal 6 karakter!', '#C62828'); return; }
  if (!sessionUser) { showToast('Sesi tidak ditemukan, silakan login ulang.', '#C62828'); return; }

  const accounts = LS.get('user_accounts', []);
  const idx = accounts.findIndex(a => a.username === sessionUser.username);
  if (idx < 0) { showToast('Akun tidak ditemukan!', '#C62828'); return; }

  const hashLama = await hashPassword(pLama);
  if (accounts[idx].hash !== hashLama) { showToast('Password lama salah!', '#C62828'); return; }

  accounts[idx].hash = await hashPassword(pBaru);
  LS.set('user_accounts', accounts);
  ['akun-pw-lama','akun-pw-baru'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  showToast('✅ Password berhasil diubah!', '#2E7D32');
}

function akunHapus(i) {
  const accounts = LS.get('user_accounts', []);
  if (accounts.length <= 1) { showToast('Harus ada minimal 1 akun!', '#C62828'); return; }
  if (sessionUser && accounts[i].username === sessionUser.username) {
    showToast('Tidak bisa hapus akun yang sedang login!', '#C62828'); return;
  }
  if (!confirm('Hapus akun @' + accounts[i].username + '?')) return;
  accounts.splice(i, 1);
  LS.set('user_accounts', accounts);
  akunRender();
  showToast('🗑 Akun dihapus.', '#F57F17');
}

// ===== DASHBOARD KEPALA SEKOLAH =====
function kepsekLoad() {
  // Tanggal hari ini
  const now = new Date();
  const tglFmt = now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const tglEl = document.getElementById('kepsek-tgl-badge');
  if (tglEl) tglEl.textContent = tglFmt;

  // Nama kepsek dari config
  const cfg = LS.get('app_config', {});
  const namaEl = document.getElementById('kepsek-nama');
  if (namaEl) namaEl.textContent = cfg.kepsek || 'Kepala Sekolah';
  const tapelEl = document.getElementById('ks-tapel');
  if (tapelEl) tapelEl.textContent = cfg.tapel || '2025/2026';
  const semEl = document.getElementById('ks-semester');
  if (semEl) semEl.textContent = cfg.semester || 'Genap';
  const kurEl = document.getElementById('ks-kurikulum');
  if (kurEl) kurEl.textContent = cfg.kurikulum || 'Kur. Merdeka';
  const kkmEl = document.getElementById('ks-kkm');
  if (kkmEl) kkmEl.textContent = cfg.kkm || '75';

  // Statistik siswa
  const totalSiswa = siswaMaster.length;
  const totalL = siswaMaster.filter(s => s.jk === 'L').length;
  const totalP = siswaMaster.filter(s => s.jk === 'P').length;
  const siEl = document.getElementById('ks-total-siswa');
  if (siEl) siEl.textContent = totalSiswa || '—';
  const siSub = document.getElementById('ks-siswa-sub');
  if (siSub && totalSiswa) siSub.textContent = totalL + 'L / ' + totalP + 'P';

  // Statistik guru
  const totalGuru = guruData.length;
  const guruKls   = guruData.filter(g => g.jenisGuru === 'Guru Kelas').length;
  const guruMapel = guruData.filter(g => g.jenisGuru && g.jenisGuru.startsWith('Guru Mapel')).length;
  const guEl = document.getElementById('ks-total-guru');
  if (guEl) guEl.textContent = totalGuru || '—';
  const guSub = document.getElementById('ks-guru-sub');
  if (guSub && totalGuru) guSub.textContent = guruKls + ' Kelas · ' + guruMapel + ' Mapel';

  // Rekap absensi bulan ini
  const bulanIni = String(now.getMonth() + 1).padStart(2, '0');
  let totH = 0, totI = 0, totS = 0, totA = 0;
  Object.entries(absenHistory).forEach(([tgl, kelasMap]) => {
    if (tgl.split('-')[1] !== bulanIni) return;
    Object.values(kelasMap).forEach(e => {
      totH += e.counts.H; totI += e.counts.I;
      totS += e.counts.S; totA += e.counts.A;
    });
  });
  const totalAbsen = totH + totI + totS + totA;
  const pctHadir = totalAbsen > 0 ? Math.round((totH / totalAbsen) * 100) : 0;

  document.getElementById('ks-absen-h').textContent = totH;
  document.getElementById('ks-absen-i').textContent = totI;
  document.getElementById('ks-absen-s').textContent = totS;
  document.getElementById('ks-absen-a').textContent = totA;
  document.getElementById('ks-bar-hadir').style.width = pctHadir + '%';
  document.getElementById('ks-pct-hadir').textContent = totalAbsen ? pctHadir + '%' : '—';
  document.getElementById('ks-absen-desc').textContent = totalAbsen
    ? pctHadir + '% kehadiran dari ' + totalAbsen + ' total catatan absensi'
    : 'Belum ada data absensi bulan ini';

  // Rata-rata nilai semua mapel
  let allNilaiRaport = [];
  Object.keys(nilaiData).forEach(mapelKey => {
    const mapelObj = nilaiData[mapelKey];
    if (!mapelObj) return;
    Object.values(mapelObj).forEach(d => {
      const allTP = d.tp.flat().filter(v => v!=='' && !isNaN(parseFloat(v))).map(Number);
      const naF = allTP.length ? allTP.reduce((a,b)=>a+b,0)/allTP.length : null;
      const allSum = d.sum.filter(v => v!=='' && !isNaN(parseFloat(v))).map(Number);
      const naS = allSum.length ? allSum.reduce((a,b)=>a+b,0)/allSum.length : null;
      let parts=[], weights=[];
      if (naF!==null){ parts.push(naF*40); weights.push(40); }
      if (naS!==null){ parts.push(naS*20); weights.push(20); }
      const totalW = weights.reduce((a,b)=>a+b,0);
      if (totalW > 0) allNilaiRaport.push(parts.reduce((a,b)=>a+b,0)/totalW);
    });
  });
  const avgNilai = allNilaiRaport.length
    ? Math.round(allNilaiRaport.reduce((a,b)=>a+b,0)/allNilaiRaport.length)
    : null;
  document.getElementById('ks-avg-nilai').textContent = avgNilai !== null ? avgNilai : '—';

  // Nilai per Mapel
  const mapelList = ['PAIBP','Pendidikan Pancasila','Bahasa Indonesia','Matematika','PJOK','Seni Rupa','IPAS','Bahasa Inggris','Mulok Bahasa Jawa'];
  const nilaiListEl = document.getElementById('ks-nilai-list');
  const mapelWithData = mapelList.filter(m => nilaiData[m] && Object.keys(nilaiData[m]).length);
  if (!mapelWithData.length) {
    nilaiListEl.innerHTML = '<div class="empty-state" style="padding:16px 0"><div class="empty-icon" style="font-size:28px">📊</div><div style="font-size:12px">Belum ada data nilai.<br>Input nilai di menu Penilaian.</div></div>';
  } else {
    nilaiListEl.innerHTML = mapelWithData.map(m => {
      const entries = Object.values(nilaiData[m]);
      const raporNilai = entries.map(d => {
        const allTP = d.tp.flat().filter(v => v!=='' && !isNaN(parseFloat(v))).map(Number);
        const naF = allTP.length ? allTP.reduce((a,b)=>a+b,0)/allTP.length : null;
        const allSum = d.sum.filter(v => v!=='' && !isNaN(parseFloat(v))).map(Number);
        const naS = allSum.length ? allSum.reduce((a,b)=>a+b,0)/allSum.length : null;
        let parts=[], weights=[];
        if (naF!==null){ parts.push(naF*40); weights.push(40); }
        if (naS!==null){ parts.push(naS*20); weights.push(20); }
        const tw = weights.reduce((a,b)=>a+b,0);
        return tw>0 ? parts.reduce((a,b)=>a+b,0)/tw : null;
      }).filter(v => v !== null);
      const avg = raporNilai.length ? Math.round(raporNilai.reduce((a,b)=>a+b,0)/raporNilai.length) : null;
      const lulus = raporNilai.filter(v => v >= 75).length;
      const pct = avg ? Math.min(100, avg) : 0;
      const barColor = avg >= 90 ? '#2E7D32' : avg >= 75 ? '#1565C0' : avg >= 60 ? '#F57F17' : '#C62828';
      return '<div class="kepsek-nilai-bar-row">'
        + '<div class="kepsek-nilai-bar-label" title="' + m + '">' + (m.length>14?m.slice(0,13)+'…':m) + '</div>'
        + '<div class="kepsek-nilai-bar-track"><div class="kepsek-nilai-bar-fill" style="width:'+pct+'%;background:'+barColor+'"></div></div>'
        + '<div class="kepsek-nilai-bar-count" style="color:'+barColor+'">' + (avg||'—') + '</div>'
        + '</div>';
    }).join('') + '<div style="font-size:10px;color:#9E9E9E;margin-top:4px">Angka = rata-rata nilai raport. Warna: hijau≥90, biru≥75, oranye≥60, merah<60</div>';
  }

  // Siswa per Kelas
  const kelasList = ['Kelas 1','Kelas 2','Kelas 3','Kelas 4','Kelas 5','Kelas 6'];
  const kelasListEl = document.getElementById('ks-kelas-list');
  const kelasCounts = kelasList.map(k => ({
    k, jml: siswaMaster.filter(s=>s.kelas===k).length,
    l: siswaMaster.filter(s=>s.kelas===k&&s.jk==='L').length,
    p: siswaMaster.filter(s=>s.kelas===k&&s.jk==='P').length
  })).filter(x => x.jml > 0);
  if (!kelasCounts.length) {
    kelasListEl.innerHTML = '<div class="empty-state" style="padding:16px 0"><div class="empty-icon" style="font-size:28px">🏫</div><div style="font-size:12px">Belum ada data siswa.</div></div>';
  } else {
    const maxJml = Math.max(...kelasCounts.map(x => x.jml));
    kelasListEl.innerHTML = '<div style="padding:0 12px">'
      + '<div style="display:grid;grid-template-columns:80px 1fr 36px 36px 48px;gap:6px;padding:10px 0;font-size:11px;font-weight:700;color:#9E9E9E;border-bottom:1px solid #F5F5F5">'
      + '<div>Kelas</div><div>Jumlah</div><div style="text-align:center;color:#1565C0">L</div><div style="text-align:center;color:#C2185B">P</div><div style="text-align:center">Total</div>'
      + '</div>'
      + kelasCounts.map(x =>
        '<div style="display:grid;grid-template-columns:80px 1fr 36px 36px 48px;gap:6px;padding:10px 0;align-items:center;border-bottom:1px solid #F9F9F9">'
        + '<div style="font-size:12px;font-weight:600;color:#212121">' + x.k + '</div>'
        + '<div><div style="background:#E8F5E9;border-radius:4px;height:8px;overflow:hidden"><div style="width:'+Math.round((x.jml/maxJml)*100)+'%;height:100%;background:linear-gradient(90deg,#2E7D32,#66BB6A);border-radius:4px"></div></div></div>'
        + '<div style="text-align:center;font-size:12px;font-weight:700;color:#1565C0">' + x.l + '</div>'
        + '<div style="text-align:center;font-size:12px;font-weight:700;color:#C2185B">' + x.p + '</div>'
        + '<div style="text-align:center;font-size:14px;font-weight:800;color:#2E7D32">' + x.jml + '</div>'
        + '</div>'
      ).join('')
      + '<div style="display:grid;grid-template-columns:80px 1fr 36px 36px 48px;gap:6px;padding:10px 0;background:#F1F8E9;font-weight:700;font-size:12px;color:#1B5E20;border-top:2px solid #A5D6A7">'
      + '<div>TOTAL</div><div></div>'
      + '<div style="text-align:center;color:#1565C0">' + kelasCounts.reduce((a,x)=>a+x.l,0) + '</div>'
      + '<div style="text-align:center;color:#C2185B">' + kelasCounts.reduce((a,x)=>a+x.p,0) + '</div>'
      + '<div style="text-align:center;color:#2E7D32">' + kelasCounts.reduce((a,x)=>a+x.jml,0) + '</div>'
      + '</div>'
      + '</div>';
  }

  // Daftar Guru
  const guruListEl = document.getElementById('ks-guru-list');
  if (!guruData.length) {
    guruListEl.innerHTML = '<div class="empty-state" style="padding:16px 0"><div class="empty-icon" style="font-size:28px">👨‍🏫</div><div style="font-size:12px">Belum ada data guru.</div></div>';
  } else {
    guruListEl.innerHTML = guruData.slice(0, 8).map(g =>
      '<div class="kepsek-guru-item">'
      + '<div class="kepsek-guru-avatar" style="background:' + (g.jenisGuru==='Guru Mapel PJOK'?'#E3F2FD':g.jenisGuru==='Guru Mapel PAIBP'?'#FFF8E1':'#E8F5E9') + '">' + (g.jenisGuru==='Guru Mapel PJOK'?'🏃':g.jenisGuru==='Guru Mapel PAIBP'?'📖':'👩‍🏫') + '</div>'
      + '<div style="flex:1;min-width:0"><div class="kepsek-guru-name">' + g.nama + '</div>'
      + '<div class="kepsek-guru-jabatan">' + (g.jenisGuru || g.jabatan || 'Guru') + '</div></div>'
      + '<span style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;background:#E8F5E9;color:#2E7D32">' + (g.jenisGuru ? g.jenisGuru.replace('Guru ','') : '—') + '</span>'
      + '</div>'
    ).join('') + (guruData.length > 8 ? '<div style="text-align:center;padding:10px;font-size:12px;color:#9E9E9E">+' + (guruData.length-8) + ' guru lainnya · <span onclick="goScreen(\'guru\')" style="color:#1565C0;cursor:pointer">Lihat semua →</span></div>' : '');
  }
}

// ===== DASHBOARD =====
function filterMenu(q) {
  q = q.toLowerCase().trim();
  // Filter semua menu-item di kedua grid sekaligus
  document.querySelectorAll('.menu-item').forEach(item => {
    const label = item.querySelector('.menu-label');
    if (!label) return;
    item.style.display = label.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
  // Sembunyikan section-title jika semua item di bawahnya hidden
  ['menu-utama', 'menu-lain'].forEach(gridId => {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const hasVisible = [...grid.querySelectorAll('.menu-item')].some(el => el.style.display !== 'none');
    const title = grid.previousElementSibling;
    if (title && title.classList.contains('section-title')) {
      title.style.display = q === '' ? '' : (hasVisible ? '' : 'none');
    }
  });
}

// ===== ABSENSI =====
// importedSiswa dihapus — absensi kini langsung dari siswaMaster
let absenData = {};
const defaultSiswa = {
  '1':['Achmad Fauzi','Bagas Prasetyo','Citra Dewi','Dian Rahayu','Eko Santoso','Fatimah Zahra','Gilang Ramadhan','Hani Permata','Ivan Kurniawan','Jasmine Putri','Kevin Susanto','Layla Nuraini'],
  '2':['Maulana Yusuf','Nadia Sari','Oscar Pratama','Putri Handayani','Qori Amelia','Rizky Firmansyah','Sari Dewi','Taufik Hidayat','Ulfa Nurhaliza','Vino Ardiansyah','Wulan Safitri','Xena Maharani'],
  '3':['Yogi Permana','Zahra Aulia','Arief Budiman','Bella Kusuma','Cahyo Wibowo','Dina Marlina','Endra Setiawan','Fina Rahmawati','Guntur Wijaya','Heni Lestari','Irfan Maulana','Julia Anggraeni'],
  '4':['Krisna Aditya','Lina Safira','Muhamad Iqbal','Nina Kartika','Oki Saputra','Pita Noviani','Rafi Alamsyah','Sinta Maharani','Toni Setiabudi','Umi Kulsum','Vika Andriani','Wahyu Nugroho'],
  '5':['Angga Permadi','Bima Sakti','Cantika Dewi','Dimas Saputra','Erini Wahyuni','Fahrul Rozi','Galih Wicaksono','Hera Puspita','Ilham Mauludi','Jihan Ramadhani','Khoirul Anwar','Lisa Amelia'],
  '6':['Mirza Fadhlan','Nisa Aulia','Okta Prayuda','Prima Kusuma','Qisthi Amira','Raihan Ardianto','Sella Novita','Teguh Prasetya','Udin Saefudin','Vella Andriani','Wira Kusuma','Yuli Rahayu'],
};
function absLoad() {
  const kelas = document.getElementById('abs-kelas').value;
  const tgl   = document.getElementById('abs-tgl').value;
  if (!tgl)   { showToast('Pilih tanggal terlebih dahulu!', '#C62828'); return; }
  if (!kelas) { showToast('Pilih kelas terlebih dahulu!', '#C62828'); return; }

  // Ambil dari siswaMaster (data siswa terpusat)
  let list = siswaMaster.filter(s => s.kelas && s.kelas.replace(/[^0-9]/g,'')[0] === kelas);

  if (!list.length) {
    // Fallback ke defaultSiswa jika belum ada data di siswaMaster untuk kelas ini
    list = (defaultSiswa[kelas] || defaultSiswa['1']).map((nama, i) => ({
      no: String(i+1), noInduk: '202400'+String(i+1).padStart(2,'0'),
      nisn: '301'+String(i+1).padStart(5,'0'), nama,
      kelas: 'Kelas '+kelas, jk: i%2===0?'L':'P'
    }));
    showToast('ℹ️ Belum ada data siswa Kelas '+kelas+' di sistem. Menggunakan data demo.', '#1565C0');
  }

  // Update sub-header
  const subEl = document.getElementById('abs-sub');
  if (subEl) subEl.textContent = 'Kelas '+kelas+' · '+list.length+' siswa · '+new Date(tgl).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});

  absenData = {};
  list.forEach((_, i) => { absenData[i] = 'H'; });
  absRender(list, 'Kelas ' + kelas);
}
function absRender(list, kelas) {
  let rows = '';
  list.forEach((s, i) => {
    rows += `<div class="student-row">
      <div class="stu-no">${i + 1}</div>
      <div><div class="stu-name">${s.nama} <span style="font-size:10px;color:${s.jk === 'P' ? '#C2185B' : '#1565C0'}">${s.jk}</span></div><div class="stu-meta">Induk: ${s.noInduk} • NISN: ${s.nisn}</div></div>
      <div><div class="radio-btn sel-H" id="b-H-${i}" onclick="absSet(${i},'H')">H</div></div>
      <div><div class="radio-btn" id="b-I-${i}" onclick="absSet(${i},'I')">I</div></div>
      <div><div class="radio-btn" id="b-S-${i}" onclick="absSet(${i},'S')">S</div></div>
      <div><div class="radio-btn" id="b-A-${i}" onclick="absSet(${i},'A')">A</div></div>
    </div>`;
  });
  document.getElementById('abs-area').innerHTML = `
    <div class="summary-row">
      <div class="sum-card sum-h"><div class="sum-num" id="c-H">${list.length}</div><div class="sum-lbl">Hadir</div></div>
      <div class="sum-card sum-i"><div class="sum-num" id="c-I">0</div><div class="sum-lbl">Izin</div></div>
      <div class="sum-card sum-s"><div class="sum-num" id="c-S">0</div><div class="sum-lbl">Sakit</div></div>
      <div class="sum-card sum-a"><div class="sum-num" id="c-A">0</div><div class="sum-lbl">Alfa</div></div>
    </div>
    <div class="mark-all-row">
      <button class="mark-all-btn h" onclick="absMarkAll('H')">✓ Hadir</button>
      <button class="mark-all-btn i" onclick="absMarkAll('I')">I Izin</button>
      <button class="mark-all-btn s" onclick="absMarkAll('S')">S Sakit</button>
      <button class="mark-all-btn a" onclick="absMarkAll('A')">A Alfa</button>
    </div>
    <div class="list-card">
      <div class="list-header"><div>#</div><div>Nama Siswa</div><div class="col-h">H</div><div class="col-i">I</div><div class="col-s">S</div><div class="col-a">A</div></div>
      ${rows}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn-simpan" onclick="absSimpan()">💾 Simpan Absensi</button>
      <button style="padding:13px;background:#E3F2FD;color:#1565C0;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer" onclick="absShowHistory()">📋 Riwayat</button>
    </div>`;
}
function absSet(idx, status) {
  absenData[idx] = status;
  ['H', 'I', 'S', 'A'].forEach(s => { const b = document.getElementById('b-' + s + '-' + idx); if (b) b.className = 'radio-btn' + (s === status ? ' sel-' + s : ''); });
  absUpdateSummary();
}
function absMarkAll(status) { Object.keys(absenData).forEach(i => absSet(parseInt(i), status)); }
function absUpdateSummary() {
  const c = { H: 0, I: 0, S: 0, A: 0 }; Object.values(absenData).forEach(v => c[v]++);
  ['H', 'I', 'S', 'A'].forEach(s => { const el = document.getElementById('c-' + s); if (el) el.textContent = c[s]; });
}
// Absen history: absenHistory[tgl][kelas_mapel] = { siswaData, counts }
let absenHistory = LS.get('absen_history', {});

function absSimpan() {
  const kelas  = document.getElementById('abs-kelas').value;
  const mapel  = document.getElementById('abs-mapel').value || 'Umum';
  const jam    = document.getElementById('abs-jam').value || 'Jam 1';
  const tgl    = document.getElementById('abs-tgl').value;
  const kelasLabel = kelas ? 'Kelas ' + kelas : 'Semua';
  const c = { H:0, I:0, S:0, A:0 };
  Object.values(absenData).forEach(v => c[v]++);

  // Simpan rekap ke history
  if (tgl) {
    if (!absenHistory[tgl]) absenHistory[tgl] = {};
    const histKey = kelasLabel + '_' + mapel + '_' + jam;
    absenHistory[tgl][histKey] = {
      kelas: kelasLabel, mapel, jam, tgl,
      counts: { ...c },
      detail: { ...absenData },
      savedAt: new Date().toLocaleTimeString('id-ID'),
    };
    LS.set('absen_history', absenHistory);
  }
  showToast('✅ Tersimpan! ' + kelasLabel + ' | H:' + c.H + ' I:' + c.I + ' S:' + c.S + ' A:' + c.A, '#2E7D32');
}

function absShowHistory() {
  const entries = [];
  Object.entries(absenHistory).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30).forEach(([tgl, kelasMap]) => {
    Object.values(kelasMap).forEach(e => entries.push({...e, tgl}));
  });

  if (!entries.length) { showToast('Belum ada riwayat absensi tersimpan.', '#F57F17'); return; }

  const rows = entries.slice(0,20).map(e => {
    const tglFmt = new Date(e.tgl).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
    return '<div style="background:#fff;border-radius:12px;padding:12px 14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.07)">'
      + '<div style="font-size:13px;font-weight:700;color:#212121">' + e.kelas + ' — ' + e.mapel + '</div>'
      + '<div style="font-size:11px;color:#757575;margin:2px 0">📅 ' + tglFmt + ' &bull; ' + e.jam + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:6px">'
      + '<span style="background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">H: ' + e.counts.H + '</span>'
      + '<span style="background:#FFF8E1;color:#F57F17;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">I: ' + e.counts.I + '</span>'
      + '<span style="background:#E3F2FD;color:#1565C0;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">S: ' + e.counts.S + '</span>'
      + '<span style="background:#FFEBEE;color:#C62828;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">A: ' + e.counts.A + '</span>'
      + '</div></div>';
  }).join('');

  const el = document.getElementById('abs-area');
  el.innerHTML = '<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">'
    + '<div style="font-size:14px;font-weight:700;color:#212121">📋 Riwayat Absensi</div>'
    + '<button style="background:#FFEBEE;color:#C62828;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer" onclick="absClearHistory()">🗑 Hapus Semua</button>'
    + '</div>' + rows
    + '<button class="btn-simpan" style="margin-top:8px;background:#F5F5F5;color:#616161" onclick="absLoad()">← Kembali ke Absensi</button>';
}

function absClearHistory() {
  if (!confirm('Hapus semua riwayat absensi?')) return;
  absenHistory = {};
  LS.del('absen_history');
  showToast('🗑 Riwayat absensi dihapus.', '#F57F17');
  document.getElementById('abs-area').innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div>Riwayat kosong.</div></div>';
}

// ===== DATA GURU =====
// ============================================================
// ==================== DATA GURU =============================
// ============================================================
// Struktur guru: { no, nip, nama, jenisGuru }
// jenisGuru: "Guru Kelas" | "Guru Mapel PJOK" | "Guru Mapel PAIBP"
const _guruDemoDefault = [
  { no: '1', nip: '198203152005012008', nama: 'Sri Wahyuni, S.Pd',   jenisGuru: 'Guru Kelas' },
  { no: '2', nip: '199001202019031004', nama: 'Ahmad Fauzan, S.Pd',  jenisGuru: 'Guru Kelas' },
  { no: '3', nip: '198507072010012015', nama: 'Dewi Rahayu, S.Pd',   jenisGuru: 'Guru Kelas' },
  { no: '4', nip: '197809092003121003', nama: 'Hendra Wijaya, S.Pd', jenisGuru: 'Guru Mapel PJOK' },
  { no: '5', nip: '199205182018032001', nama: 'Nur Aini, S.Pd.I',    jenisGuru: 'Guru Mapel PAIBP' },
];
let guruData = LS.get('guru_data', _guruDemoDefault);

// state filter aktif
let _guruFilterJenis = '';

// ----- Tab navigation -----
// ----- Role-based screen loader -----
function guruScreenLoad() {
  const isAdmin = sessionUser && (sessionUser.role === 'admin' || sessionUser.role === 'kepsek');

  // Tampilkan/sembunyikan tab sesuai role
  const tabs = document.querySelectorAll('#screen-guru .tab-btn');
  const panelAdmin  = document.getElementById('guru-panel-admin');
  const panelPribadi = document.getElementById('guru-panel-pribadi');

  if (isAdmin) {
    if (panelAdmin)   panelAdmin.style.display   = '';
    if (panelPribadi) panelPribadi.style.display = 'none';
    tabs.forEach(t => t.style.display = '');
    guruUpdateStats();
  } else {
    // Mode guru biasa → tampilkan data pribadi saja
    if (panelAdmin)   panelAdmin.style.display   = 'none';
    if (panelPribadi) panelPribadi.style.display = '';
    tabs.forEach(t => t.style.display = 'none');
    guruRenderPribadi();
  }
}

// ----- Tampilan data pribadi guru (non-admin) -----
function guruRenderPribadi() {
  const el = document.getElementById('guru-pribadi-content');
  if (!el || !sessionUser) return;

  // Cari data guru berdasarkan username (addedBy) atau cocokkan nama dari akun
  const accounts = LS.get('user_accounts', []);
  const akun = accounts.find(a => a.username === sessionUser.username);
  const namaAkun = akun ? akun.nama : sessionUser.nama;

  // Match by nama (flexible: cek include atau starts with)
  let myData = guruData.find(g =>
    g.nama && namaAkun &&
    (g.nama.toLowerCase() === namaAkun.toLowerCase() ||
     g.nama.toLowerCase().includes(namaAkun.toLowerCase().split(',')[0]) ||
     namaAkun.toLowerCase().includes(g.nama.toLowerCase().split(',')[0]))
  );

  const jenisIcon  = { 'Guru Kelas': '👩‍🏫', 'Guru Mapel PJOK': '🏃', 'Guru Mapel PAIBP': '📖' };
  const jenisBg    = { 'Guru Kelas': '#E8F5E9', 'Guru Mapel PJOK': '#E3F2FD', 'Guru Mapel PAIBP': '#FFF8E1' };
  const jenisClr   = { 'Guru Kelas': '#2E7D32', 'Guru Mapel PJOK': '#1565C0', 'Guru Mapel PAIBP': '#E65100' };

  if (myData) {
    const icon = jenisIcon[myData.jenisGuru] || '👤';
    const bg   = jenisBg[myData.jenisGuru]  || '#F5F5F5';
    const clr  = jenisClr[myData.jenisGuru] || '#424242';
    const realIdx = guruData.indexOf(myData);

    el.innerHTML = `
      <div class="card" style="text-align:center;padding:24px 16px;background:linear-gradient(135deg,${bg},#fff)">
        <div style="font-size:52px;margin-bottom:10px">${icon}</div>
        <div style="font-size:18px;font-weight:800;color:#212121;margin-bottom:4px">${myData.nama}</div>
        <div style="font-size:12px;color:#9E9E9E;margin-bottom:12px">
          NIP: ${myData.nip && myData.nip !== '-' ? myData.nip : '—'}
        </div>
        <span style="background:${bg};color:${clr};border-radius:20px;padding:5px 16px;font-size:12px;font-weight:700">
          ${icon} ${myData.jenisGuru || '—'}
        </span>
      </div>

      <!-- Info sekolah -->
      <div class="card" style="margin-top:0">
        <div class="card-title">🏫 Informasi Sekolah</div>
        <div class="guru-info-row"><span class="guru-info-lbl">Sekolah</span><span class="guru-info-val">SD Negeri 3 Kalipang</span></div>
        <div class="guru-info-row"><span class="guru-info-lbl">Username</span><span class="guru-info-val">@${sessionUser.username}</span></div>
        <div class="guru-info-row"><span class="guru-info-lbl">Role</span><span class="guru-info-val">${myData.jenisGuru || 'Guru'}</span></div>
      </div>

      <!-- Edit data pribadi -->
      <div class="card" style="margin-top:0" id="guru-pribadi-edit-card">
        <div class="card-title">✏️ Edit Data Saya</div>
        <input type="hidden" id="gp-edit-idx" value="${realIdx}"/>
        <div class="form-field">
          <label class="form-label">Nama Lengkap <span class="req">*</span></label>
          <input type="text" id="gp-nama" class="form-input" value="${myData.nama}"/>
        </div>
        <div class="form-field">
          <label class="form-label">NIP</label>
          <input type="text" id="gp-nip" class="form-input" value="${myData.nip !== '-' ? myData.nip : ''}"/>
        </div>
        <div class="form-field">
          <label class="form-label">Jenis Guru</label>
          <select id="gp-jenis" class="form-select">
            <option value="Guru Kelas"      ${myData.jenisGuru==='Guru Kelas'?'selected':''}>👩‍🏫 Guru Kelas</option>
            <option value="Guru Mapel PJOK" ${myData.jenisGuru==='Guru Mapel PJOK'?'selected':''}>🏃 Guru Mapel PJOK</option>
            <option value="Guru Mapel PAIBP"${myData.jenisGuru==='Guru Mapel PAIBP'?'selected':''}>📖 Guru Mapel PAIBP</option>
          </select>
        </div>
        <button class="btn-green" onclick="guruSimpanPribadi()">💾 Simpan Perubahan</button>
      </div>`;
  } else {
    // Belum ada data guru yang cocok → tampilkan form pengisian
    el.innerHTML = `
      <div style="background:#FFF8E1;border-radius:12px;padding:14px;margin-bottom:14px;font-size:12px;color:#E65100">
        ⚠️ Data guru Anda belum terdaftar di sistem. Silakan isi data di bawah agar Anda bisa diidentifikasi di dokumen sekolah.
      </div>
      <div class="card">
        <div class="card-title">📝 Lengkapi Data Saya</div>
        <input type="hidden" id="gp-edit-idx" value="-1"/>
        <div class="form-field">
          <label class="form-label">Nama Lengkap <span class="req">*</span></label>
          <input type="text" id="gp-nama" class="form-input" placeholder="Nama sesuai SK..."/>
        </div>
        <div class="form-field">
          <label class="form-label">NIP</label>
          <input type="text" id="gp-nip" class="form-input" placeholder="Kosongkan jika GTT"/>
        </div>
        <div class="form-field">
          <label class="form-label">Jenis Guru <span class="req">*</span></label>
          <select id="gp-jenis" class="form-select">
            <option value="Guru Kelas">👩‍🏫 Guru Kelas</option>
            <option value="Guru Mapel PJOK">🏃 Guru Mapel PJOK</option>
            <option value="Guru Mapel PAIBP">📖 Guru Mapel PAIBP</option>
          </select>
        </div>
        <button class="btn-green" onclick="guruSimpanPribadi()">💾 Simpan Data Saya</button>
      </div>`;
  }
}

function guruSimpanPribadi() {
  const nama  = document.getElementById('gp-nama').value.trim();
  const nip   = document.getElementById('gp-nip').value.trim() || '-';
  const jenis = document.getElementById('gp-jenis').value;
  if (!nama) { showToast('Nama tidak boleh kosong!', '#C62828'); return; }

  const editIdx = parseInt(document.getElementById('gp-edit-idx').value);

  if (editIdx >= 0) {
    guruData[editIdx] = { ...guruData[editIdx], nip, nama, jenisGuru: jenis };
  } else {
    guruData.push({ no: String(guruData.length + 1), nip, nama, jenisGuru: jenis });
  }
  saveAll();
  showToast('✅ Data pribadi berhasil diperbarui!', '#2E7D32');
  guruRenderPribadi(); // refresh tampilan
}

function guruTab(tab, el) {
  ['tambah', 'daftar', 'kepsek'].forEach(t => {
    document.getElementById('guru-tab-' + t).classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('#screen-guru .tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'daftar') guruRenderDaftar();
  if (tab === 'kepsek') guruKepsekLoad();
}

// ----- Tambah / Edit guru -----
function guruTambah() {
  const nama  = document.getElementById('g-nama').value.trim();
  const nip   = document.getElementById('g-nip').value.trim() || '-';
  const jenis = document.getElementById('g-jenis').value;
  if (!nama) { showToast('Nama guru tidak boleh kosong!', '#C62828'); return; }

  const editIdx = parseInt(document.getElementById('g-edit-idx').value);

  if (editIdx >= 0) {
    // Mode edit
    guruData[editIdx] = { ...guruData[editIdx], nip, nama, jenisGuru: jenis };
    showToast('✅ Data ' + nama + ' diperbarui!', '#2E7D32');
    guruBatalEdit();
  } else {
    // Mode tambah baru
    guruData.push({ no: String(guruData.length + 1), nip, nama, jenisGuru: jenis });
    showToast('✅ ' + nama + ' berhasil ditambahkan!', '#2E7D32');
    document.getElementById('g-nama').value = '';
    document.getElementById('g-nip').value  = '';
  }
  saveAll();
  guruUpdateStats();
}

function guruEditMode(idx) {
  const g = guruData[idx];
  if (!g) return;
  document.getElementById('g-edit-idx').value = idx;
  document.getElementById('g-nama').value      = g.nama;
  document.getElementById('g-nip').value       = g.nip !== '-' ? g.nip : '';
  document.getElementById('g-jenis').value     = g.jenisGuru || 'Guru Kelas';

  document.getElementById('guru-form-title').textContent     = '✏️ Edit Data Guru';
  document.getElementById('btn-guru-simpan').textContent     = '💾 Simpan Perubahan';
  document.getElementById('btn-guru-batal').style.display    = '';

  // Switch ke tab tambah
  document.querySelectorAll('#screen-guru .tab-btn')[0].click();
  window.scrollTo(0, 0);
}

function guruBatalEdit() {
  document.getElementById('g-edit-idx').value = '-1';
  document.getElementById('g-nama').value     = '';
  document.getElementById('g-nip').value      = '';
  document.getElementById('g-jenis').value    = 'Guru Kelas';
  document.getElementById('guru-form-title').textContent  = '➕ Tambah Data Guru';
  document.getElementById('btn-guru-simpan').textContent  = '➕ Simpan';
  document.getElementById('btn-guru-batal').style.display = 'none';
}

function guruHapus(idx) {
  if (!confirm('Hapus data guru "' + guruData[idx].nama + '"?')) return;
  guruData.splice(idx, 1);
  guruData.forEach((g, i) => g.no = String(i + 1));
  saveAll();
  guruRenderDaftar();
  guruUpdateStats();
  showToast('🗑 Data guru dihapus.', '#F57F17');
}

// ----- Stats mini di tab tambah -----
function guruUpdateStats() {
  const total  = guruData.length;
  const kelas  = guruData.filter(g => g.jenisGuru === 'Guru Kelas').length;
  const mapel  = guruData.filter(g => g.jenisGuru && g.jenisGuru.startsWith('Guru Mapel')).length;
  ['g-total','g-total-d'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = total; });
  ['g-kelas-count','g-kls-d'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = kelas; });
  ['g-mapel-count','g-mp-d'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = mapel; });
}

// ----- Render daftar guru -----
function guruRenderDaftar() {
  guruUpdateStats();
  let list = [...guruData];
  if (_guruFilterJenis) list = list.filter(g => g.jenisGuru === _guruFilterJenis);
  const q = _guruSearchQ || '';
  if (q) list = list.filter(g => g.nama.toLowerCase().includes(q.toLowerCase()) || (g.nip && g.nip.includes(q)));

  const jenisIcon = { 'Guru Kelas': '👩‍🏫', 'Guru Mapel PJOK': '🏃', 'Guru Mapel PAIBP': '📖' };
  const jenisBg   = { 'Guru Kelas': '#E8F5E9', 'Guru Mapel PJOK': '#E3F2FD', 'Guru Mapel PAIBP': '#FFF8E1' };
  const jenisClr  = { 'Guru Kelas': '#2E7D32', 'Guru Mapel PJOK': '#1565C0', 'Guru Mapel PAIBP': '#E65100' };

  const el = document.getElementById('guru-list-el');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👨‍🏫</div><div>Belum ada data guru ditemukan.</div></div>';
    return;
  }
  el.innerHTML = list.map((g, i) => {
    const realIdx = guruData.indexOf(g);
    const icon = jenisIcon[g.jenisGuru] || '👤';
    const bg   = jenisBg[g.jenisGuru]  || '#F5F5F5';
    const clr  = jenisClr[g.jenisGuru] || '#424242';
    return `<div class="guru-card" style="position:relative">
      <div class="guru-avatar" style="background:${bg};font-size:22px;display:flex;align-items:center;justify-content:center">${icon}</div>
      <div class="guru-info" style="flex:1;min-width:0">
        <div class="guru-name">${g.nama}</div>
        <div class="guru-nip" style="font-size:11px;color:#9E9E9E">NIP: ${g.nip && g.nip !== '-' ? g.nip : '—'}</div>
        <span style="display:inline-block;margin-top:4px;background:${bg};color:${clr};border-radius:8px;padding:2px 9px;font-size:11px;font-weight:700">${icon} ${g.jenisGuru || '—'}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button onclick="guruEditMode(${realIdx})" style="background:#E8F5E9;color:#2E7D32;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">✏️ Edit</button>
        <button onclick="guruHapus(${realIdx})"   style="background:#FFEBEE;color:#C62828;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function guruFilterJenis(jenis, el) {
  _guruFilterJenis = jenis;
  document.querySelectorAll('.guru-filter-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  guruRenderDaftar();
}

let _guruSearchQ = '';
function guruCariFilter(q) {
  _guruSearchQ = q || '';
  guruRenderDaftar();
}

// backward compat
function guruCari(q) { guruCariFilter(q); }
function guruRender(list) { guruRenderDaftar(); }

// ----- Export Excel -----
function guruExportExcel() {
  const wb   = XLSX.utils.book_new();
  const header = ['No', 'NIP', 'Nama Guru', 'Jenis Guru'];
  const rows   = guruData.map(g => [g.no, g.nip !== '-' ? g.nip : '', g.nama, g.jenisGuru || '']);
  const ws     = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols']  = [{ wch: 5 }, { wch: 22 }, { wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Data Guru');
  XLSX.writeFile(wb, 'DataGuru_SDN3Kalipang.xlsx');
  showToast('✅ Data guru diexport!', '#2E7D32');
}

// ----- Kepala Sekolah -----
function guruKepsekLoad() {
  const cfg = LS.get('app_config', {});
  const namaEl   = document.getElementById('ks-nama');
  const nipEl    = document.getElementById('ks-nip');
  const kotaEl   = document.getElementById('ks-kota-tgl');
  if (namaEl) namaEl.value = cfg.kepsek    || '';
  if (nipEl)  nipEl.value  = cfg.nipKepsek || '';
  if (kotaEl) kotaEl.value = cfg.kotaTglTtd || ('Kalipang, ' + new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }));
  guruKepsekPreview();
}

function guruKepsekPreview() {
  const nama   = (document.getElementById('ks-nama') || {}).value  || '—';
  const nip    = (document.getElementById('ks-nip') || {}).value   || '—';
  const kota   = (document.getElementById('ks-kota-tgl') || {}).value || '—';
  const cfg    = LS.get('app_config', {});
  const el = (id) => document.getElementById(id);
  if (el('prev-nama-sekolah')) el('prev-nama-sekolah').textContent = (cfg.namaSekolah || 'SD NEGERI 3 KALIPANG').toUpperCase();
  if (el('prev-alamat'))       el('prev-alamat').textContent       = cfg.alamat || 'Ds. Kalipang, Kec. Grobogan, Kab. Grobogan';
  if (el('prev-kota-tgl'))     el('prev-kota-tgl').textContent     = kota;
  if (el('prev-ks-nama'))      el('prev-ks-nama').textContent      = nama;
  if (el('prev-ks-nip'))       el('prev-ks-nip').textContent       = nip ? 'NIP. ' + nip : '';
}

function guruKepsekSimpan() {
  const nama = (document.getElementById('ks-nama') || {}).value.trim();
  const nip  = (document.getElementById('ks-nip')  || {}).value.trim();
  const kota = (document.getElementById('ks-kota-tgl') || {}).value.trim();
  if (!nama) { showToast('Nama Kepala Sekolah tidak boleh kosong!', '#C62828'); return; }

  // Sinkron ke app_config agar raport, absensi, dsb langsung pakai
  const cfg = LS.get('app_config', {});
  cfg.kepsek     = nama;
  cfg.nipKepsek  = nip;
  cfg.kotaTglTtd = kota;
  LS.set('app_config', cfg);

  // Sync ke appConfig in-memory
  if (typeof appConfig !== 'undefined') {
    appConfig.kepsek    = nama;
    appConfig.nipKepsek = nip;
  }

  guruKepsekPreview();
  showToast('✅ Data Kepala Sekolah disimpan & terhubung ke semua dokumen!', '#2E7D32');
}

// Panggil preview saat ketik
document.addEventListener('input', function(e) {
  if (e.target && ['ks-nama','ks-nip','ks-kota-tgl'].includes(e.target.id)) guruKepsekPreview();
});


// ============================================================
// ==================== GAME EDUKASI ==========================
// ============================================================

const gameQuestions = {
  mtk: [
    { q: '8 × 7 = ?', opts: ['54', '56', '58', '52'], ans: 1 },
    { q: '144 ÷ 12 = ?', opts: ['11', '12', '13', '14'], ans: 1 },
    { q: '25 + 47 = ?', opts: ['70', '71', '72', '73'], ans: 2 },
    { q: '100 − 38 = ?', opts: ['62', '63', '72', '61'], ans: 0 },
    { q: '9 × 9 = ?', opts: ['72', '80', '81', '90'], ans: 2 },
    { q: '56 ÷ 8 = ?', opts: ['5', '6', '7', '8'], ans: 2 },
    { q: '123 + 77 = ?', opts: ['190', '195', '200', '205'], ans: 2 },
    { q: '7 × 8 = ?', opts: ['48', '54', '56', '64'], ans: 2 },
    { q: '250 − 125 = ?', opts: ['100', '115', '125', '135'], ans: 2 },
    { q: '6 × 12 = ?', opts: ['60', '66', '72', '78'], ans: 2 },
    { q: '81 ÷ 9 = ?', opts: ['7', '8', '9', '10'], ans: 2 },
    { q: '345 + 155 = ?', opts: ['490', '495', '500', '505'], ans: 2 },
  ],
  ipas: [
    { q: 'Hewan apa yang bisa mengeluarkan cahaya sendiri?', opts: ['Kunang-kunang', 'Belalang', 'Kecoa', 'Semut'], ans: 0 },
    { q: 'Proses tumbuhan membuat makanan sendiri disebut?', opts: ['Respirasi', 'Fotosintesis', 'Transpirasi', 'Evaporasi'], ans: 1 },
    { q: 'Planet terbesar dalam tata surya adalah?', opts: ['Saturnus', 'Mars', 'Jupiter', 'Neptunus'], ans: 2 },
    { q: 'Presiden pertama Republik Indonesia adalah?', opts: ['Soeharto', 'BJ Habibie', 'Soekarno', 'Megawati'], ans: 2 },
    { q: 'Tulang apa yang melindungi jantung dan paru-paru?', opts: ['Tulang belakang', 'Tulang rusuk', 'Tulang tengkorak', 'Tulang panggul'], ans: 1 },
    { q: 'Bahan makanan yang mengandung protein tinggi?', opts: ['Nasi', 'Tempe', 'Singkong', 'Jagung'], ans: 1 },
    { q: 'Hari Kemerdekaan Indonesia diperingati setiap?', opts: ['17 Agustus', '20 Oktober', '28 Oktober', '1 Juni'], ans: 0 },
    { q: 'Gunung berapi aktif tertinggi di Indonesia adalah?', opts: ['Gunung Rinjani', 'Gunung Semeru', 'Gunung Kerinci', 'Gunung Agung'], ans: 2 },
    { q: 'Gerhana matahari terjadi ketika?', opts: ['Bumi di antara Matahari dan Bulan', 'Bulan di antara Matahari dan Bumi', 'Matahari di antara Bumi dan Bulan', 'Bulan dan Bumi sejajar'], ans: 1 },
    { q: 'Ibu kota provinsi Jawa Tengah adalah?', opts: ['Surabaya', 'Bandung', 'Semarang', 'Yogyakarta'], ans: 2 },
    { q: 'Darah dipompa ke seluruh tubuh oleh?', opts: ['Paru-paru', 'Hati', 'Ginjal', 'Jantung'], ans: 3 },
    { q: 'Rumah adat Jawa Tengah adalah?', opts: ['Rumah Gadang', 'Rumah Joglo', 'Rumah Limas', 'Rumah Honai'], ans: 1 },
  ],
  emoji: [
    { q: '🍎 + 📚 = Tempat apa?', emoji: '🍎📚', opts: ['Rumah Sakit', 'Sekolah', 'Pasar', 'Kantor'], ans: 1 },
    { q: '🌊 + 🐟 + ⛵ = Siapa?', emoji: '🌊🐟⛵', opts: ['Petani', 'Sopir', 'Nelayan', 'Pedagang'], ans: 2 },
    { q: '🌱 + ☀️ + 💧 = Proses apa?', emoji: '🌱☀️💧', opts: ['Respirasi', 'Fotosintesis', 'Evaporasi', 'Polusi'], ans: 1 },
    { q: '🌙 + ⭐ + 🌑 = Fenomena apa?', emoji: '🌙⭐🌑', opts: ['Siang hari', 'Gerhana Bulan', 'Hujan meteor', 'Matahari terbenam'], ans: 1 },
    { q: '🦁 + 🐘 + 🦒 = Tempat apa?', emoji: '🦁🐘🦒', opts: ['Pasar ikan', 'Kebun binatang', 'Hutan kota', 'Kolam renang'], ans: 1 },
    { q: '✏️ + 📏 + 📐 = Kegiatan apa?', emoji: '✏️📏📐', opts: ['Memasak', 'Menggambar', 'Berolahraga', 'Bernyanyi'], ans: 1 },
    { q: '❄️ + 🌨️ + 🏔️ = Cuaca apa?', emoji: '❄️🌨️🏔️', opts: ['Musim kemarau', 'Musim hujan', 'Musim salju', 'Musim semi'], ans: 2 },
    { q: '🚌 + 🏫 + 🎒 = Kegiatan apa?', emoji: '🚌🏫🎒', opts: ['Liburan', 'Berangkat sekolah', 'Belanja', 'Piknik'], ans: 1 },
    { q: '🌍 + ☀️ + 🔄 = Fenomena apa?', emoji: '🌍☀️🔄', opts: ['Gempa bumi', 'Siang dan malam', 'Hujan', 'Angin'], ans: 1 },
    { q: '🌾 + 🚜 + 👨‍🌾 = Siapa?', emoji: '🌾🚜👨‍🌾', opts: ['Nelayan', 'Petani', 'Pedagang', 'Dokter'], ans: 1 },
  ],
  bhs: [
    { q: 'Kata "rajin" adalah contoh kata?', opts: ['Kata benda', 'Kata kerja', 'Kata sifat', 'Kata keterangan'], ans: 2 },
    { q: '"Apple" dalam Bahasa Indonesia artinya?', opts: ['Jeruk', 'Mangga', 'Apel', 'Anggur'], ans: 2 },
    { q: 'Kalimat yang benar adalah?', opts: ['Ibu memasak nasi goreng.', 'Memasak nasi goreng ibu.', 'Goreng nasi ibu memasak.', 'Nasi ibu goreng memasak.'], ans: 0 },
    { q: '"I am a student" artinya?', opts: ['Saya seorang guru', 'Saya seorang siswa', 'Dia seorang pelajar', 'Kami pelajar'], ans: 1 },
    { q: 'Antonim (lawan kata) dari "rajin" adalah?', opts: ['Pintar', 'Bodoh', 'Malas', 'Cerdas'], ans: 2 },
    { q: '"Book" dalam Bahasa Indonesia adalah?', opts: ['Pensil', 'Penggaris', 'Buku', 'Tas'], ans: 2 },
    { q: 'Sinonim (persamaan kata) dari "cepat" adalah?', opts: ['Lambat', 'Pelan', 'Diam', 'Kencang'], ans: 3 },
    { q: '"How are you?" artinya?', opts: ['Di mana kamu?', 'Siapa kamu?', 'Apa kabar?', 'Berapa umurmu?'], ans: 2 },
    { q: 'Kalimat tanya diakhiri tanda?', opts: ['Titik (.)', 'Koma (,)', 'Tanda tanya (?)', 'Tanda seru (!)'], ans: 2 },
    { q: '"Teacher" dalam Bahasa Indonesia adalah?', opts: ['Siswa', 'Kepala sekolah', 'Guru', 'Penjaga'], ans: 2 },
  ],
};

const gameConfig = {
  mtk:  { title: 'Matematika Sprint', sub: '12 soal • 60 detik', time: 60, icon: '🔢' },
  ipas: { title: 'Kuis IPAS', sub: '12 soal • 90 detik', time: 90, icon: '🌍' },
  emoji:{ title: 'Tebak Emoji', sub: '10 soal • 75 detik', time: 75, icon: '🎯' },
  bhs:  { title: 'Kuis Bahasa', sub: '10 soal • 75 detik', time: 75, icon: '📖' },
};

let gameState = {
  type: '', questions: [], current: 0, score: 0, benar: 0, salah: 0,
  timer: null, timeLeft: 0, timeUsed: 0, answered: false
};
let gameLeaderboard = [];

function gameBackToDash() {
  if (gameState.timer) clearInterval(gameState.timer);
  goScreen('dash');
}

function showGameSelect() {
  if (gameState.timer) clearInterval(gameState.timer);
  document.getElementById('game-select-section').style.display = 'block';
  document.getElementById('game-play-area').classList.remove('active');
  document.getElementById('game-result-area').style.display = 'none';
  renderLeaderboard();
}

function renderLeaderboard() {
  const el = document.getElementById('lb-list');
  if (!gameLeaderboard.length) {
    el.innerHTML = '<div class="empty-state" style="padding:16px 0"><div class="empty-icon" style="font-size:28px">🏅</div><div style="font-size:12px">Belum ada skor. Mulai bermain!</div></div>';
    return;
  }
  const rankClass = ['gold','silver','bronze'];
  el.innerHTML = gameLeaderboard.slice(0,5).map((e,i) => `
    <div class="leaderboard-row">
      <div class="lb-rank ${rankClass[i]||'other'}">${i+1}</div>
      <div class="lb-info"><div class="lb-name">${e.name}</div><div class="lb-game">${gameConfig[e.type].icon} ${gameConfig[e.type].title}</div></div>
      <div class="lb-score">⭐ ${e.score}</div>
    </div>`).join('');
}

function startGame(type) {
  const cfg = gameConfig[type];
  const pool = [...gameQuestions[type]].sort(() => Math.random() - 0.5).slice(0, 10);
  gameState = { type, questions: pool, current: 0, score: 0, benar: 0, salah: 0, timer: null, timeLeft: cfg.time, timeUsed: 0, answered: false };

  document.getElementById('game-select-section').style.display = 'none';
  document.getElementById('game-result-area').style.display = 'none';
  document.getElementById('game-play-area').classList.add('active');
  document.getElementById('game-play-title').textContent = cfg.icon + ' ' + cfg.title;
  document.getElementById('game-play-sub').textContent = pool.length + ' soal';

  renderGameQuestion();
  startGameTimer();
}

function startGameTimer() {
  if (gameState.timer) clearInterval(gameState.timer);
  const startTime = Date.now();
  gameState.timer = setInterval(() => {
    gameState.timeLeft--;
    gameState.timeUsed = Math.round((Date.now() - startTime) / 1000);
    document.getElementById('game-timer').textContent = gameState.timeLeft;
    const badge = document.getElementById('game-timer-badge');
    badge.classList.toggle('danger', gameState.timeLeft <= 10);
    if (gameState.timeLeft <= 0) { clearInterval(gameState.timer); showGameResult(); }
  }, 1000);
}

function renderGameQuestion() {
  const gs = gameState;
  const total = gs.questions.length;
  if (gs.current >= total) { clearInterval(gs.timer); showGameResult(); return; }

  const q = gs.questions[gs.current];
  const pct = (gs.current / total) * 100;
  document.getElementById('game-progress-bar').style.width = pct + '%';
  document.getElementById('game-score').textContent = gs.score;
  gs.answered = false;

  const hasEmoji = gs.type === 'emoji';
  document.getElementById('game-question-area').innerHTML = `
    <div class="question-card">
      <div class="question-num">Soal ${gs.current + 1} dari ${total}</div>
      ${hasEmoji ? `<div class="question-emoji">${q.emoji}</div>` : ''}
      <div class="question-text">${q.q}</div>
    </div>
    <div class="options-grid">
      ${q.opts.map((opt, i) => `
        <button class="option-btn" id="opt-${i}" onclick="selectGameOption(${i})">${opt}</button>
      `).join('')}
    </div>`;
}

function selectGameOption(idx) {
  if (gameState.answered) return;
  gameState.answered = true;
  const q = gameState.questions[gameState.current];
  const isCorrect = idx === q.ans;

  // Highlight answer
  q.opts.forEach((_, i) => {
    const btn = document.getElementById('opt-' + i);
    btn.disabled = true;
    if (i === q.ans) btn.classList.add('correct');
    else if (i === idx && !isCorrect) btn.classList.add('wrong');
  });

  if (isCorrect) {
    gameState.score += 10 + Math.max(0, gameState.timeLeft);
    gameState.benar++;
    showToast('✅ Benar! +10 poin', '#2E7D32');
  } else {
    gameState.salah++;
    showToast('❌ Salah! Jawaban: ' + q.opts[q.ans], '#C62828');
  }

  setTimeout(() => {
    gameState.current++;
    renderGameQuestion();
  }, 1200);
}

function showGameResult() {
  clearInterval(gameState.timer);
  document.getElementById('game-play-area').classList.remove('active');
  document.getElementById('game-result-area').style.display = 'block';

  const { score, benar, salah, questions, timeUsed, type } = gameState;
  const total = questions.length;
  const pct = Math.round((benar / total) * 100);

  let emoji, title;
  if (pct >= 90) { emoji = '🏆'; title = 'Luar Biasa! Sempurna!'; }
  else if (pct >= 70) { emoji = '🎉'; title = 'Bagus Sekali!'; }
  else if (pct >= 50) { emoji = '👍'; title = 'Cukup Baik!'; }
  else { emoji = '💪'; title = 'Terus Berlatih!'; }

  document.getElementById('res-emoji').textContent = emoji;
  document.getElementById('res-title').textContent = title;
  document.getElementById('res-score').textContent = score + ' Poin';
  document.getElementById('res-sub').textContent = `${benar} benar dari ${total} soal (${pct}%)`;
  document.getElementById('res-benar').textContent = benar;
  document.getElementById('res-salah').textContent = salah;
  document.getElementById('res-waktu').textContent = timeUsed;

  document.getElementById('btn-play-again').onclick = () => startGame(type);

  // Add to leaderboard
  gameLeaderboard.push({ name: '👤 Kamu', type, score, benar, pct, time: timeUsed });
  gameLeaderboard.sort((a, b) => b.score - a.score);
  if (gameLeaderboard.length > 10) gameLeaderboard = gameLeaderboard.slice(0, 10);
}


// ============================================================
// ==================== UJIAN ONLINE ==========================
// ============================================================

let soalList = [];
let ujianList = LS.get('ujian_list', []);
let ujianState = {
  ujian: null, jawaban: {}, current: 0, timer: null, timeLeft: 0, selesai: false
};

function ujianTab(tab, el) {
  ['buat', 'kelola', 'kerjakan'].forEach(t => {
    document.getElementById('ujian-tab-' + t).classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('.ujian-tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'kelola') ujianRefreshKelola();
  if (tab === 'kerjakan') ujianRefreshPilih();
}

function tambahSoal() {
  const p = document.getElementById('soal-pertanyaan').value.trim();
  const a = document.getElementById('soal-a').value.trim();
  const b = document.getElementById('soal-b').value.trim();
  const c = document.getElementById('soal-c').value.trim();
  const d = document.getElementById('soal-d').value.trim();
  const j = document.getElementById('soal-jawaban').value;
  if (!p || !a || !b || !c || !d) { showToast('Semua field soal wajib diisi!', '#C62828'); return; }
  soalList.push({ pertanyaan: p, opsi: { A: a, B: b, C: c, D: d }, jawaban: j });
  ['soal-pertanyaan', 'soal-a', 'soal-b', 'soal-c', 'soal-d'].forEach(id => document.getElementById(id).value = '');
  renderSoalList();
  showToast('✅ Soal ' + soalList.length + ' berhasil ditambahkan!', '#2E7D32');
}

function renderSoalList() {
  document.getElementById('soal-count').textContent = soalList.length;
  const el = document.getElementById('soal-list');
  if (!soalList.length) {
    el.innerHTML = '<div class="empty-state" style="padding:16px 0"><div class="empty-icon" style="font-size:32px">📝</div><div>Belum ada soal ditambahkan.</div></div>';
    return;
  }
  el.innerHTML = soalList.map((s, i) => `
    <div class="soal-item">
      <button class="soal-delete" onclick="hapusSoal(${i})">✕</button>
      <div class="soal-num">Soal ${i + 1}</div>
      <div class="soal-pertanyaan">${s.pertanyaan}</div>
      <div class="soal-opsi">
        ${['A','B','C','D'].map(k => `<div class="soal-opsi-item ${s.jawaban===k?'correct-opsi':''}">${k}. ${s.opsi[k]}</div>`).join('')}
      </div>
      <div style="font-size:11px;color:#2E7D32;font-weight:600">✓ Jawaban: ${s.jawaban}. ${s.opsi[s.jawaban]}</div>
    </div>`).join('');
}

function hapusSoal(idx) {
  soalList.splice(idx, 1);
  renderSoalList();
  showToast('Soal dihapus.', '#F57F17');
}

function simpanUjian() {
  const judul = document.getElementById('ujian-judul').value.trim();
  if (!judul) { showToast('Judul ujian tidak boleh kosong!', '#C62828'); return; }
  if (soalList.length < 2) { showToast('Minimal 2 soal diperlukan!', '#C62828'); return; }
  const ujian = {
    id: Date.now(),
    judul,
    mapel: document.getElementById('ujian-mapel').value,
    durasi: parseInt(document.getElementById('ujian-durasi').value),
    kelas: document.getElementById('ujian-kelas').value,
    kkm: parseInt(document.getElementById('ujian-kkm').value) || 75,
    soal: [...soalList],
    createdAt: new Date().toLocaleDateString('id-ID'),
  };
  ujianList.push(ujian);
  saveAll();
  soalList = [];
  renderSoalList();
  document.getElementById('ujian-judul').value = '';
  showToast('✅ Ujian "' + judul + '" berhasil dipublikasikan!', '#2E7D32');
  ujianRefreshKelola();
}

function ujianRefreshKelola() {
  const el = document.getElementById('kelola-list');
  if (!ujianList.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div>Belum ada ujian dibuat.<br>Buat ujian di tab <strong>Buat Soal</strong>.</div></div>';
    return;
  }
  el.innerHTML = ujianList.map((u, i) => `
    <div class="ujian-card">
      <div class="ujian-card-title">${u.judul}</div>
      <div class="ujian-card-meta">
        <span class="ujian-meta-pill">📚 ${u.mapel}</span>
        <span class="ujian-meta-pill">🏛 ${u.kelas}</span>
        <span class="ujian-meta-pill">⏱ ${u.durasi} menit</span>
        <span class="ujian-meta-pill">📝 ${u.soal.length} soal</span>
        <span class="ujian-meta-pill">KKM: ${u.kkm}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-mulai-ujian" onclick="ujianMulaiDari(${i})">▶ Pratinjau Ujian</button>
        <button style="background:#FFEBEE;color:#C62828;border:none;border-radius:9px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer" onclick="hapusUjian(${i})">🗑 Hapus</button>
      </div>
    </div>`).join('');
}

function hapusUjian(idx) {
  ujianList.splice(idx, 1);
  saveAll();
  ujianRefreshKelola();
  showToast('Ujian dihapus.', '#F57F17');
}

function ujianRefreshPilih() {
  const el = document.getElementById('pilih-list');
  if (!ujianList.length) {
    el.innerHTML = '<div class="empty-state" style="padding:16px 0"><div class="empty-icon" style="font-size:32px">📝</div><div style="font-size:13px">Belum ada ujian tersedia.<br>Minta guru untuk membuat ujian.</div></div>';
    return;
  }
  el.innerHTML = ujianList.map((u, i) => `
    <div class="ujian-card">
      <div class="ujian-card-title">${u.judul}</div>
      <div class="ujian-card-meta">
        <span class="ujian-meta-pill">📚 ${u.mapel}</span>
        <span class="ujian-meta-pill">🏛 ${u.kelas}</span>
        <span class="ujian-meta-pill">⏱ ${u.durasi} menit</span>
        <span class="ujian-meta-pill">📝 ${u.soal.length} soal</span>
      </div>
      <button class="btn-mulai-ujian" onclick="ujianMulai(${i})">🖊 Mulai Kerjakan</button>
    </div>`).join('');
}

function ujianMulaiDari(idx) {
  // Switch ke tab kerjakan dan mulai
  document.querySelectorAll('.ujian-tab-btn').forEach((b, i) => b.classList.toggle('active', i === 2));
  ['buat', 'kelola', 'kerjakan'].forEach(t => document.getElementById('ujian-tab-' + t).classList.toggle('hidden', t !== 'kerjakan'));
  ujianRefreshPilih();
  ujianMulai(idx);
}

function ujianMulai(idx) {
  const u = ujianList[idx];
  ujianState = {
    ujian: u, jawaban: {}, current: 0,
    timer: null, timeLeft: u.durasi * 60, selesai: false
  };

  document.getElementById('ujian-pilih-area').style.display = 'none';
  document.getElementById('ujian-result-area').style.display = 'none';
  const playArea = document.getElementById('ujian-play-area');
  playArea.classList.add('active');
  playArea.style.display = 'block';
  document.getElementById('ujian-nama-siswa').textContent = document.getElementById('dash-uname').textContent || 'Siswa';

  renderUjianSoal();
  startUjianTimer();
}

function startUjianTimer() {
  if (ujianState.timer) clearInterval(ujianState.timer);
  ujianState.timer = setInterval(() => {
    ujianState.timeLeft--;
    const m = Math.floor(ujianState.timeLeft / 60);
    const s = ujianState.timeLeft % 60;
    document.getElementById('ujian-timer-num').textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    if (ujianState.timeLeft <= 60) document.getElementById('ujian-timer-num').style.color = '#C62828';
    if (ujianState.timeLeft <= 0) { clearInterval(ujianState.timer); showUjianResult(); }
  }, 1000);
}

function renderUjianSoal() {
  const { current, jawaban, ujian } = ujianState;
  const total = ujian.soal.length;
  const soal = ujian.soal[current];
  document.getElementById('ujian-progress-info').textContent = `Soal ${current + 1} / ${total}`;

  const letters = ['A','B','C','D'];
  document.getElementById('ujian-q-display').innerHTML = `
    <div class="ujian-q-card">
      <div class="ujian-q-num">Pertanyaan ${current + 1} dari ${total}</div>
      <div class="ujian-q-text">${soal.pertanyaan}</div>
      <div class="ujian-options">
        ${letters.map(l => `
          <button class="ujian-opt ${jawaban[current]===l?'selected':''}" id="uopt-${l}" onclick="pilihJawaban('${l}')">
            <span class="opt-letter">${l}</span>${soal.opsi[l]}
          </button>`).join('')}
      </div>
    </div>`;

  const btnNext = document.getElementById('btn-next-soal');
  const isLast = current === total - 1;
  btnNext.textContent = jawaban[current] ? (isLast ? '✓ Selesaikan Ujian' : 'Soal Berikutnya →') : 'Pilih Jawaban Dulu →';
  btnNext.disabled = !jawaban[current];
}

function pilihJawaban(letter) {
  ujianState.jawaban[ujianState.current] = letter;
  const letters = ['A','B','C','D'];
  letters.forEach(l => {
    const btn = document.getElementById('uopt-' + l);
    if (btn) btn.classList.toggle('selected', l === letter);
  });
  const btnNext = document.getElementById('btn-next-soal');
  const isLast = ujianState.current === ujianState.ujian.soal.length - 1;
  btnNext.textContent = isLast ? '✓ Selesaikan Ujian' : 'Soal Berikutnya →';
  btnNext.disabled = false;
}

function ujianNext() {
  const { current, jawaban, ujian } = ujianState;
  if (!jawaban[current]) return;
  if (current < ujian.soal.length - 1) {
    ujianState.current++;
    renderUjianSoal();
  } else {
    clearInterval(ujianState.timer);
    showUjianResult();
  }
}

function showUjianResult() {
  ujianState.selesai = true;
  clearInterval(ujianState.timer);
  document.getElementById('ujian-play-area').classList.remove('active');
  document.getElementById('ujian-play-area').style.display = 'none';
  document.getElementById('ujian-result-area').style.display = 'block';

  const { jawaban, ujian } = ujianState;
  let benar = 0;
  ujian.soal.forEach((s, i) => { if (jawaban[i] === s.jawaban) benar++; });
  const total = ujian.soal.length;
  const salah = total - benar;
  const nilai = Math.round((benar / total) * 100);
  const lulus = nilai >= ujian.kkm;

  let emoji, grade, gradeClass;
  if (nilai >= 90) { emoji = '🏆'; grade = 'A — Sangat Baik'; gradeClass = 'grade-a'; }
  else if (nilai >= 80) { emoji = '🎉'; grade = 'B — Baik'; gradeClass = 'grade-b'; }
  else if (nilai >= 70) { emoji = '👍'; grade = 'C — Cukup'; gradeClass = 'grade-c'; }
  else { emoji = '💪'; grade = 'D — Perlu Belajar Lagi'; gradeClass = 'grade-d'; }

  document.getElementById('ujian-res-emoji').textContent = emoji;
  document.getElementById('ujian-res-score').textContent = nilai;
  document.getElementById('ujian-res-score').style.color = lulus ? '#2E7D32' : '#C62828';
  const gradeEl = document.getElementById('ujian-res-grade');
  gradeEl.textContent = grade + (lulus ? ' ✅ LULUS' : ' ❌ Belum Lulus (KKM ' + ujian.kkm + ')');
  gradeEl.className = 'score-grade ' + gradeClass;
  document.getElementById('ujian-res-benar').textContent = benar;
  document.getElementById('ujian-res-salah').textContent = salah;
  document.getElementById('ujian-res-total').textContent = total;

  // Review
  document.getElementById('ujian-review-list').innerHTML = '<div style="font-size:13px;font-weight:700;color:#212121;margin-bottom:10px">📋 Review Jawaban:</div>' +
    ujian.soal.map((s, i) => {
      const jUser = jawaban[i] || '—';
      const isBenar = jawaban[i] === s.jawaban;
      return `<div class="review-item ${isBenar ? 'benar' : 'salah'}">
        <div class="review-q">${i + 1}. ${s.pertanyaan}</div>
        <div class="review-a">Jawaban kamu: <strong>${jUser}</strong>${!isBenar ? ` • Benar: <strong>${s.jawaban}. ${s.opsi[s.jawaban]}</strong>` : ' ✓'}</div>
      </div>`;
    }).join('');
}

function ujianKembali() {
  document.getElementById('ujian-result-area').style.display = 'none';
  document.getElementById('ujian-pilih-area').style.display = 'block';
  ujianRefreshPilih();
}


// ============================================================
// ==================== DATA SISWA ============================
// ============================================================

const _siswaDemoDefault = [
  { no:'1',  noInduk:'2024001', nisn:'0034567890', nama:'Achmad Fauzi',    kelas:'Kelas 4', jk:'L', tmplahir:'Kudus', tgllahir:'2015-03-12', alamat:'Ds. Kalipang Rt.01/01', ayah:'Mukhlis',    ibu:'Siti Aminah',   hp:'081234567890' },
  { no:'2',  noInduk:'2024002', nisn:'0034567891', nama:'Bagas Prasetyo',  kelas:'Kelas 4', jk:'L', tmplahir:'Kudus', tgllahir:'2015-06-20', alamat:'Ds. Kalipang Rt.02/01', ayah:'Suharto',    ibu:'Mariyem',       hp:'081234567891' },
  { no:'3',  noInduk:'2024003', nisn:'0034567892', nama:'Citra Dewi',      kelas:'Kelas 4', jk:'P', tmplahir:'Kudus', tgllahir:'2015-01-08', alamat:'Ds. Kalipang Rt.01/02', ayah:'Supriyanto', ibu:'Warsiti',       hp:'081234567892' },
  { no:'4',  noInduk:'2024004', nisn:'0034567893', nama:'Dian Rahayu',     kelas:'Kelas 4', jk:'P', tmplahir:'Kudus', tgllahir:'2015-09-15', alamat:'Ds. Kalipang Rt.03/01', ayah:'Wahyudi',    ibu:'Sri Lestari',   hp:'081234567893' },
  { no:'5',  noInduk:'2024005', nisn:'0034567894', nama:'Eko Santoso',     kelas:'Kelas 5', jk:'L', tmplahir:'Kudus', tgllahir:'2014-04-22', alamat:'Ds. Kalipang Rt.02/02', ayah:'Ponimin',    ibu:'Sulastri',      hp:'081234567894' },
  { no:'6',  noInduk:'2024006', nisn:'0034567895', nama:'Fatimah Zahra',   kelas:'Kelas 5', jk:'P', tmplahir:'Kudus', tgllahir:'2014-11-30', alamat:'Ds. Kalipang Rt.04/01', ayah:'Mulyono',    ibu:'Hartini',       hp:'081234567895' },
  { no:'7',  noInduk:'2024007', nisn:'0034567896', nama:'Gilang Ramadhan', kelas:'Kelas 5', jk:'L', tmplahir:'Kudus', tgllahir:'2014-07-17', alamat:'Ds. Kalipang Rt.01/03', ayah:'Setiawan',   ibu:'Puji Rahayu',   hp:'081234567896' },
  { no:'8',  noInduk:'2024008', nisn:'0034567897', nama:'Hani Permata',    kelas:'Kelas 6', jk:'P', tmplahir:'Kudus', tgllahir:'2013-02-25', alamat:'Ds. Kalipang Rt.05/02', ayah:'Hartono',    ibu:'Nuraini',       hp:'081234567897' },
  { no:'9',  noInduk:'2024009', nisn:'0034567898', nama:'Ivan Kurniawan',  kelas:'Kelas 6', jk:'L', tmplahir:'Kudus', tgllahir:'2013-08-03', alamat:'Ds. Kalipang Rt.02/03', ayah:'Susilo',     ibu:'Endang Wati',   hp:'081234567898' },
  { no:'10', noInduk:'2024010', nisn:'0034567899', nama:'Jasmine Putri',   kelas:'Kelas 6', jk:'P', tmplahir:'Kudus', tgllahir:'2013-05-14', alamat:'Ds. Kalipang Rt.03/02', ayah:'Triyono',    ibu:'Dwi Astuti',    hp:'081234567899' },
];
let siswaMaster = LS.get('siswa_master', _siswaDemoDefault);

function siswaTab(tab, el) {
  ['import','tambah','daftar','statistik'].forEach(t => {
    document.getElementById('siswa-tab-' + t).classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('.siswa-tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'daftar') siswaRenderDaftar();
  if (tab === 'statistik') siswaRenderStatistik();
}

// ---- Import Excel ----
function siswaDrag(e, active) { e.preventDefault(); document.getElementById('siswa-drop').classList.toggle('dragover', active); }
function siswaDropFile(e) { e.preventDefault(); siswaDrag(e, false); if (e.dataTransfer.files[0]) siswaHandleFile(e.dataTransfer.files[0]); }

function siswaHandleFile(file) {
  if (!file) return;
  if (!file.name.match(/\.(xlsx|xls)$/i)) { showToast('File harus .xlsx atau .xls', '#C62828'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      // Baca sebagai array 2D untuk handle header multi-baris (khas Dapodik)
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!raw.length) { showToast('File kosong!', '#C62828'); return; }

      // ── Deteksi format: Dapodik atau template biasa ──
      // Dapodik: baris 1-4 adalah judul sekolah, header data di baris 5
      const isDapodik = raw.length > 5 &&
        raw[0] && String(raw[0][0]||'').includes('Daftar Peserta Didik') ||
        (raw[4] && String(raw[4][1]||'').toLowerCase() === 'nama');

      let imported = [];

      if (isDapodik) {
        // ════════════════════════════════════════
        // FORMAT DAPODIK — Mapping kolom by-index
        // Baris 5 (index 4) = header utama
        // Baris 6 (index 5) = sub-header ayah/ibu
        // Data mulai baris 7 (index 6)
        // Kolom kunci:
        //  [0]=No [1]=Nama [2]=NIPD [3]=JK [4]=NISN
        //  [5]=Tempat Lahir [6]=Tanggal Lahir [9]=Alamat
        //  [18]=Telepon [19]=HP
        //  [24]=Nama Ayah [30]=Nama Ibu
        //  [42]=Rombel/Kelas
        // ════════════════════════════════════════
        const dataRows = raw.slice(6); // lewati 6 baris header Dapodik

        function normTgl(val) {
          if (!val) return '-';
          if (val instanceof Date) {
            const y = val.getFullYear(), m = String(val.getMonth()+1).padStart(2,'0'), d = String(val.getDate()).padStart(2,'0');
            return y+'-'+m+'-'+d;
          }
          const s = String(val).trim();
          if (!s || s === '0') return '-';
          // YYYY-MM-DD (sudah benar)
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
          // DD/MM/YYYY atau DD-MM-YYYY
          const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (m1) return m1[3]+'-'+m1[2].padStart(2,'0')+'-'+m1[1].padStart(2,'0');
          return s;
        }

        function normKelas(val) {
          if (!val) return '-';
          const s = String(val).trim();
          // "Kelas 1", "Kelas 2", dst
          const m = s.match(/(\d)/);
          if (m) return 'Kelas ' + m[1];
          return s;
        }

        function normJk(val) {
          const v = String(val||'').trim().toUpperCase();
          return v === 'P' ? 'P' : 'L';
        }

        function normHp(a, b) {
          // Ambil kolom Telepon[18] atau HP[19], mana yang ada
          const va = String(a||'').trim();
          const vb = String(b||'').trim();
          return vb || va || '-';
        }

        function normAlamat(row) {
          // Gabung: Alamat[9] + RT[10]/RW[11] + Dusun[12] + Kelurahan[13]
          const parts = [
            String(row[9]||'').trim(),
            row[10] && row[11] ? 'RT '+row[10]+'/'+String(row[11]).padStart(2,'0') : '',
            String(row[12]||'').trim(),
            String(row[13]||'').trim(),
          ].filter(Boolean);
          return parts.join(', ') || '-';
        }

        imported = dataRows
          .filter(r => r[1] && String(r[1]).trim())  // harus ada Nama
          .map((r, i) => ({
            no      : String(siswaMaster.length + i + 1),
            noInduk : String(r[2]||'').trim() || '-',   // NIPD
            nisn    : String(r[4]||'').trim() || '-',   // NISN
            nama    : String(r[1]).trim(),               // Nama
            kelas   : normKelas(r[42]),                  // Rombel Saat Ini
            jk      : normJk(r[3]),                      // JK
            tmplahir: String(r[5]||'').trim() || '-',   // Tempat Lahir
            tgllahir: normTgl(r[6]),                     // Tanggal Lahir
            alamat  : normAlamat(r),                     // Alamat lengkap
            ortu    : String(r[24]||r[30]||'').trim() || '-',
            ayah    : String(r[24]||'').trim() || '-',  // Data Ayah > Nama
            ibu     : String(r[30]||'').trim() || '-',  // Data Ibu > Nama
            hp      : normHp(r[18], r[19]),              // Telepon / HP
          }));

      } else {
        // ════════════════════════════════════════
        // FORMAT TEMPLATE BIASA — Deteksi otomatis nama kolom
        // ════════════════════════════════════════

        // Cari baris header: baris pertama yang mengandung kata nama/siswa
        let headerRow = 0;
        for (let i = 0; i < Math.min(raw.length, 10); i++) {
          const s = raw[i].join('|').toLowerCase();
          if (s.includes('nama') || s.includes('siswa') || s.includes('peserta')) { headerRow = i; break; }
        }
        const headers = raw[headerRow].map(h => String(h||'').trim());
        const dataRows = raw.slice(headerRow + 1).filter(r => r.some(c => String(c).trim()));

        function fc(candidates) {
          const lower = headers.map(h => h.toLowerCase().replace(/\s+/g,' ').trim());
          for (const c of candidates) {
            let idx = lower.findIndex(k => k === c);
            if (idx !== -1) return idx;
          }
          for (const c of candidates) {
            let idx = lower.findIndex(k => k.includes(c));
            if (idx !== -1) return idx;
          }
          return -1;
        }

        const iNama    = fc(['nama lengkap','nama siswa','nama peserta didik','nama','name']);
        const iNisn    = fc(['nisn','nomor induk siswa nasional']);
        const iInduk   = fc(['nis','no. induk','no induk','nomor induk','nipd']);
        const iKelas   = fc(['kelas','rombel','rombongan belajar','tingkat','grade']);
        const iJk      = fc(['jenis kelamin','jk','l/p','gender','kelamin']);
        const iTmpLahir= fc(['tempat lahir','kota lahir','place of birth']);
        const iTglLahir= fc(['tanggal lahir','tgl lahir','tgl. lahir','date of birth','lahir']);
        const iAlamat  = fc(['alamat','alamat lengkap','address','domisili']);
        const iAyah    = fc(['nama ayah','ayah','nama ayah kandung']);
        const iIbu     = fc(['nama ibu','ibu','nama ibu kandung']);
        const iOrtu    = fc(['orang tua','nama ortu','ortu','wali','nama wali']);
        const iHp      = fc(['no. hp','no hp','hp','telepon','handphone','no. wa','whatsapp']);

        if (iNama === -1) {
          showToast('Kolom nama tidak ditemukan! Kolom tersedia: ' + headers.slice(0,10).join(', '), '#C62828');
          return;
        }

        function getV(row, idx) { return idx >= 0 && row[idx] !== undefined ? String(row[idx]).trim() : '-'; }

        function parseTgl(val) {
          if (!val || val === '-') return '-';
          if (val instanceof Date) {
            const y=val.getFullYear(),m=String(val.getMonth()+1).padStart(2,'0'),d=String(val.getDate()).padStart(2,'0');
            return y+'-'+m+'-'+d;
          }
          const s = String(val).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
          const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (m1) return m1[3]+'-'+m1[2].padStart(2,'0')+'-'+m1[1].padStart(2,'0');
          return s;
        }

        function parseKelas(val) {
          if (!val || val === '-') return '-';
          const s = String(val).trim();
          if (/^kelas\s*\d/i.test(s)) return 'Kelas ' + s.replace(/kelas\s*/i,'').trim();
          if (/^[1-6]$/.test(s)) return 'Kelas ' + s;
          const rom = {'I':'1','II':'2','III':'3','IV':'4','V':'5','VI':'6'};
          const up = s.toUpperCase().replace(/[^IVX]/g,'');
          if (rom[up]) return 'Kelas ' + rom[up];
          const mNum = s.match(/\b([1-6])\b/);
          if (mNum) return 'Kelas ' + mNum[1];
          return s;
        }

        function parseJk(val) {
          const v = String(val||'').trim().toUpperCase();
          if (['L','LAKI','LAKI-LAKI','M','MALE'].some(x => v.startsWith(x))) return 'L';
          if (['P','PEREMPUAN','WANITA','F','FEMALE'].some(x => v.startsWith(x))) return 'P';
          return v.charAt(0) || 'L';
        }

        const ayahFallback = iOrtu >= 0 ? iOrtu : -1;
        imported = dataRows
          .filter(r => r[iNama] && String(r[iNama]).trim())
          .map((r, i) => ({
            no      : String(siswaMaster.length + i + 1),
            noInduk : getV(r, iInduk),
            nisn    : getV(r, iNisn),
            nama    : String(r[iNama]).trim(),
            kelas   : parseKelas(getV(r, iKelas)),
            jk      : parseJk(iJk >= 0 ? r[iJk] : 'L'),
            tmplahir: getV(r, iTmpLahir),
            tgllahir: parseTgl(iTglLahir >= 0 ? r[iTglLahir] : ''),
            alamat  : getV(r, iAlamat),
            ortu    : iOrtu >= 0 ? getV(r, iOrtu) : '-',
            ayah    : iAyah >= 0 ? getV(r, iAyah) : (ayahFallback >= 0 ? getV(r, ayahFallback) : '-'),
            ibu     : getV(r, iIbu),
            hp      : getV(r, iHp),
          }));
      }

      if (!imported.length) { showToast('Tidak ada data siswa yang valid!', '#C62828'); return; }

      // Preview sebelum simpan
      _siswaImportPreview(imported, file.name, isDapodik ? 'Dapodik' : 'Template');

    } catch(err) { showToast('Gagal membaca file: ' + err.message, '#C62828'); console.error(err); }
  };
  reader.readAsArrayBuffer(file);
}

// Preview sebelum konfirmasi simpan
function _siswaImportPreview(data, filename, sumber) {
  const overlay = document.getElementById('siswa-preview-overlay');
  if (!overlay) { _siswaImportSimpan(data, filename); return; }

  document.getElementById('siswa-preview-filename').textContent = filename;
  document.getElementById('siswa-preview-count').textContent = data.length + ' siswa · dari ' + sumber;

  const sample = data.slice(0, 6);
  const cols = ['nama','nisn','kelas','jk','tgllahir','ayah','ibu','hp'];
  const heads = ['Nama','NISN','Kelas','L/P','Tgl Lahir','Ayah','Ibu','HP'];

  document.getElementById('siswa-preview-table').innerHTML =
    '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
    '<thead><tr>' + heads.map(h =>
      '<th style="background:#E8F5E9;padding:5px 8px;border:1px solid #C8E6C9;white-space:nowrap;text-align:left">'+h+'</th>'
    ).join('') + '</tr></thead><tbody>' +
    sample.map(s =>
      '<tr>' + cols.map(c =>
        '<td style="padding:4px 8px;border:1px solid #E0E0E0;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+String(s[c]||'-')+'">'+String(s[c]||'-')+'</td>'
      ).join('') + '</tr>'
    ).join('') +
    (data.length > 6 ? '<tr><td colspan="8" style="text-align:center;color:#9E9E9E;padding:6px;border:1px solid #E0E0E0;font-style:italic">... dan '+(data.length-6)+' siswa lainnya</td></tr>' : '') +
    '</tbody></table>';

  window._pendingImport = { data, filename };
  overlay.style.display = 'flex';
}

function siswaImportKonfirmasi() {
  if (!window._pendingImport) return;
  const { data, filename } = window._pendingImport;
  _siswaImportSimpan(data, filename);
  document.getElementById('siswa-preview-overlay').style.display = 'none';
  window._pendingImport = null;
  // Langsung pindah ke tab Daftar
  const daftarBtn = document.querySelectorAll('.siswa-tab-btn')[2];
  if (daftarBtn) daftarBtn.click();
}

function siswaImportBatal() {
  document.getElementById('siswa-preview-overlay').style.display = 'none';
  window._pendingImport = null;
  showToast('Import dibatalkan.', '#F57F17');
}

function _siswaImportSimpan(imported, filename) {
  siswaMaster = [...siswaMaster, ...imported];
  saveAll();
  const infoEl = document.getElementById('siswa-info');
  const fnameEl = document.getElementById('siswa-fname');
  const fcountEl = document.getElementById('siswa-fcount');
  if (fnameEl)  fnameEl.textContent  = '📄 ' + filename;
  if (fcountEl) fcountEl.textContent = imported.length + ' siswa berhasil diimport';
  if (infoEl)   infoEl.classList.add('show');
  showToast('✅ ' + imported.length + ' siswa berhasil diimport!', '#2E7D32');
}

function siswaClearImport() {
  document.getElementById('siswa-file').value = '';
  document.getElementById('siswa-info').classList.remove('show');
}

function siswaDownloadTemplate() {
  const wb = XLSX.utils.book_new();
  const data = [
    ['No','No. Induk','NISN','Nama Siswa','Kelas','Jenis Kelamin','Tempat Lahir','Tanggal Lahir','Alamat','Nama Ayah','Nama Ibu','No HP'],
    ['1','2024001','0034567890','Ahmad Fauzi','Kelas 4','L','Kudus','2015-03-12','Ds. Kalipang Rt.01/01','Mukhlis','081234567890'],
    ['2','2024002','0034567891','Siti Rahayu','Kelas 4','P','Kudus','2015-06-20','Ds. Kalipang Rt.02/01','Supriyanto','081234567891'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:4},{wch:10},{wch:14},{wch:24},{wch:10},{wch:14},{wch:14},{wch:14},{wch:28},{wch:22},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
  XLSX.writeFile(wb, 'Template_Siswa_SDN3Kalipang.xlsx');
  showToast('⬇ Template didownload!', '#1565C0');
}

// ---- Tambah Manual ----
function siswaTambah() {
  const nama = document.getElementById('s-nama').value.trim();
  const kelas = document.getElementById('s-kelas').value;
  if (!nama) { showToast('Nama siswa tidak boleh kosong!', '#C62828'); return; }
  if (!kelas) { showToast('Pilih kelas!', '#C62828'); return; }
  const newSiswa = {
    no: String(siswaMaster.length + 1),
    noInduk: document.getElementById('s-induk').value.trim() || ('-'),
    nisn: document.getElementById('s-nisn').value.trim() || '-',
    nama,
    kelas,
    jk: document.getElementById('s-jk').value,
    tmplahir: document.getElementById('s-tmplahir').value.trim() || '-',
    tgllahir: document.getElementById('s-tgllahir').value || '-',
    alamat: document.getElementById('s-alamat').value.trim() || '-',
    ayah: document.getElementById('s-ayah').value.trim() || '-',
    ibu : document.getElementById('s-ibu').value.trim()  || '-',
    hp: document.getElementById('s-hp').value.trim() || '-',
  };
  siswaMaster.push(newSiswa);
  saveAll();
  // Reset form
  ['s-nama','s-induk','s-nisn','s-tmplahir','s-alamat','s-ayah','s-ibu','s-hp'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('s-tgllahir').value = '';
  document.getElementById('s-kelas').value = '';
  showToast('✅ ' + nama + ' berhasil ditambahkan!', '#2E7D32');
  setTimeout(() => { document.querySelectorAll('.siswa-tab-btn')[2].click(); }, 900);
}

// ---- Daftar Siswa ----
function siswaRenderDaftar() {
  const q = (document.getElementById('siswa-search').value || '').toLowerCase();
  const kelasFilter = document.getElementById('siswa-filter-kelas').value;
  let list = siswaMaster;
  if (q) list = list.filter(s => s.nama.toLowerCase().includes(q) || s.nisn.includes(q) || s.noInduk.includes(q));
  if (kelasFilter) list = list.filter(s => s.kelas === kelasFilter);

  const totalL = siswaMaster.filter(s => s.jk === 'L').length;
  const totalP = siswaMaster.filter(s => s.jk === 'P').length;
  document.getElementById('sd-total').textContent = siswaMaster.length;
  document.getElementById('sd-l').textContent = totalL;
  document.getElementById('sd-p').textContent = totalP;

  const el = document.getElementById('siswa-daftar-list');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div>Tidak ada siswa ditemukan.</div></div>';
    return;
  }
  el.innerHTML = list.map((s, idx) => {
    const umur = hitungUmur(s.tgllahir);
    return `<div class="siswa-card">
      <div class="siswa-avatar ${s.jk === 'P' ? 'P' : 'L'}">${s.jk === 'P' ? '👧' : '👦'}</div>
      <div class="siswa-info">
        <div class="siswa-nama">${s.nama}</div>
        <div class="siswa-detail">No. Induk: ${s.noInduk}${umur ? ' • ' + umur : ''}</div>
        <div class="siswa-badge-row">
          <span class="siswa-badge sb-kelas">🏛 ${s.kelas}</span>
          <span class="siswa-badge ${s.jk === 'P' ? 'sb-jk-p' : 'sb-jk-l'}">${s.jk === 'P' ? '♀ P' : '♂ L'}</span>
          ${s.nisn !== '-' ? `<span class="siswa-badge sb-nisn">NISN: ${s.nisn}</span>` : ''}
          <span class="siswa-badge sb-aktif">● Aktif</span>
        </div>
      </div>
      <div class="siswa-action-btn">
        <button class="btn-icon edit" onclick="lihatDetail(${siswaMaster.indexOf(s)})" title="Detail">👁</button>
        <button class="btn-icon del" onclick="hapusSiswa(${siswaMaster.indexOf(s)})" title="Hapus">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function hitungUmur(tgl) {
  if (!tgl || tgl === '-') return '';
  try {
    const lahir = new Date(tgl);
    if (isNaN(lahir)) return '';
    const today = new Date();
    let age = today.getFullYear() - lahir.getFullYear();
    const m = today.getMonth() - lahir.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < lahir.getDate())) age--;
    return age > 0 ? age + ' tahun' : '';
  } catch { return ''; }
}

function lihatDetail(idx) {
  const s = siswaMaster[idx];
  if (!s) return;
  const umur = hitungUmur(s.tgllahir);
  const tglFmt = s.tgllahir && s.tgllahir !== '-'
    ? new Date(s.tgllahir).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })
    : '-';
  document.getElementById('modal-siswa-content').innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div class="modal-avatar-big ${s.jk === 'P' ? 'P' : 'L'}" style="background:${s.jk==='P'?'#FCE4EC':'#E3F2FD'}">${s.jk==='P'?'👧':'👦'}</div>
      <div style="font-size:18px;font-weight:800;color:#212121">${s.nama}</div>
      <div style="display:flex;gap:6px;justify-content:center;margin-top:6px;flex-wrap:wrap">
        <span class="siswa-badge sb-kelas">🏛 ${s.kelas}</span>
        <span class="siswa-badge ${s.jk==='P'?'sb-jk-p':'sb-jk-l'}">${s.jk==='P'?'♀ Perempuan':'♂ Laki-laki'}</span>
        <span class="siswa-badge sb-aktif">● Aktif</span>
      </div>
    </div>
    <div class="detail-row"><span class="detail-icon">🪪</span><div><div class="detail-key">No. Induk / NISN</div><div class="detail-val">${s.noInduk} / ${s.nisn}</div></div></div>
    <div class="detail-row"><span class="detail-icon">🏛</span><div><div class="detail-key">Kelas</div><div class="detail-val">${s.kelas}</div></div></div>
    <div class="detail-row"><span class="detail-icon">🎂</span><div><div class="detail-key">Tempat, Tanggal Lahir</div><div class="detail-val">${s.tmplahir !== '-' ? s.tmplahir + ', ' : ''}${tglFmt}${umur ? ' (' + umur + ')' : ''}</div></div></div>
    <div class="detail-row"><span class="detail-icon">🏠</span><div><div class="detail-key">Alamat</div><div class="detail-val">${s.alamat}</div></div></div>
    <div class="detail-row"><span class="detail-icon">👨</span><div><div class="detail-key">Nama Ayah</div><div class="detail-val">${s.ayah || s.ortu || '—'}</div></div></div>
    <div class="detail-row"><span class="detail-icon">👩</span><div><div class="detail-key">Nama Ibu</div><div class="detail-val">${s.ibu || '—'}</div></div></div>
    <div class="detail-row"><span class="detail-icon">📱</span><div><div class="detail-key">No. HP Orang Tua</div><div class="detail-val">${s.hp !== '-' ? '<a href="tel:'+s.hp+'" style="color:#2E7D32;font-weight:700;text-decoration:none">'+s.hp+'</a>' : '-'}</div></div></div>`;
  document.getElementById('modal-siswa').classList.remove('hidden');
}

function tutupModal() {
  document.getElementById('modal-siswa').classList.add('hidden');
}

function hapusSiswa(idx) {
  const nama = siswaMaster[idx]?.nama || 'Siswa';
  siswaMaster.splice(idx, 1);
  saveAll();
  // Renomor
  siswaMaster.forEach((s, i) => { s.no = String(i + 1); });
  siswaRenderDaftar();
  showToast('🗑 ' + nama + ' dihapus dari daftar.', '#F57F17');
}

// ---- Statistik ----
function siswaRenderStatistik() {
  const total = siswaMaster.length;
  const L = siswaMaster.filter(s => s.jk === 'L').length;
  const P = siswaMaster.filter(s => s.jk === 'P').length;

  document.getElementById('stk-total').textContent = total;
  document.getElementById('stk-l').textContent = L;
  document.getElementById('stk-p').textContent = P;

  // Kelas unik
  const kelasList = ['Kelas 1','Kelas 2','Kelas 3','Kelas 4','Kelas 5','Kelas 6'];
  const kelasCounts = {};
  kelasList.forEach(k => { kelasCounts[k] = siswaMaster.filter(s => s.kelas === k).length; });
  const terisi = kelasList.filter(k => kelasCounts[k] > 0).length;
  document.getElementById('stk-kelas-aktif').textContent = terisi;

  const max = Math.max(...Object.values(kelasCounts), 1);
  const el = document.getElementById('stk-kelas-list');
  const aktifKelas = kelasList.filter(k => kelasCounts[k] > 0);
  if (!aktifKelas.length) {
    el.innerHTML = '<div class="empty-state" style="padding:12px 0"><div class="empty-icon" style="font-size:28px">📊</div><div style="font-size:12px">Belum ada data siswa.</div></div>';
  } else {
    el.innerHTML = kelasList.map(k => kelasCounts[k] > 0 ? `
      <div class="kelas-stat-item">
        <div class="kelas-stat-label">${k}</div>
        <div class="kelas-bar-wrap"><div class="kelas-bar" style="width:${Math.round((kelasCounts[k]/max)*100)}%"></div></div>
        <div class="kelas-stat-count">${kelasCounts[k]}</div>
      </div>` : '').join('');
  }

  // Rasio bar
  const pctL = total > 0 ? Math.round((L / total) * 100) : 50;
  const pctP = total > 0 ? Math.round((P / total) * 100) : 50;
  document.getElementById('stk-bar-l').style.width = pctL + '%';
  document.getElementById('stk-bar-p').style.width = pctP + '%';
  document.getElementById('stk-pct-l').textContent = pctL + '%';
  document.getElementById('stk-pct-p').textContent = pctP + '%';
}

// ---- Export Excel ----
function siswaDownloadExcel() {
  if (!siswaMaster.length) { showToast('Tidak ada data untuk diexport!', '#C62828'); return; }
  const wb = XLSX.utils.book_new();
  const header = ['No','No. Induk','NISN','Nama Siswa','Kelas','Jenis Kelamin','Tempat Lahir','Tanggal Lahir','Alamat','Nama Ayah','Nama Ibu','No HP'];
  const rows = siswaMaster.map(s => [s.no, s.noInduk, s.nisn, s.nama, s.kelas,
    s.jk === 'L' ? 'Laki-laki' : 'Perempuan', s.tmplahir, s.tgllahir, s.alamat,
    s.ayah||s.ortu||'-', s.ibu||'-', s.hp]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [{wch:4},{wch:10},{wch:14},{wch:24},{wch:10},{wch:14},{wch:14},{wch:14},{wch:28},{wch:22},{wch:22},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
  XLSX.writeFile(wb, 'DataSiswa_SDN3Kalipang.xlsx');
  showToast('✅ Data ' + siswaMaster.length + ' siswa diexport!', '#2E7D32');
}


// ============================================================
// ==================== PENILAIAN =============================
// ============================================================

// BAB defaults per mapel
const defaultBabs = {
  'PAIBP': ['Al Qur\'an Pedoman Hidupku','Kasih Sayang terhadap Sesama','Aku Suka Berterima Kasih dan Disiplin','Membiasakan Hidup Bersih','Nabi Adam a.s. Manusia Pertama','BAB 6','BAB 7','BAB 8','BAB 9','BAB 10'],
  'Pendidikan Pancasila': ['Pancasila Dasar Negaraku','Norma & Aturan','Hak dan Kewajiban','Bhinneka Tunggal Ika','NKRI','BAB 6','BAB 7','BAB 8','BAB 9','BAB 10'],
  'Bahasa Indonesia': ['Teks Narasi','Teks Deskripsi','Teks Eksposisi','Membaca & Menulis','Puisi & Sastra','BAB 6','BAB 7','BAB 8','BAB 9','BAB 10'],
  'Matematika': ['Bilangan Cacah','Geometri & Pengukuran','Pecahan','Statistika','Aljabar Dasar','BAB 6','BAB 7','BAB 8','BAB 9','BAB 10'],
  'PJOK': ['Aktivitas Gerak','Permainan Bola Besar','Permainan Bola Kecil','Atletik','Kebugaran Jasmani','BAB 6','BAB 7','BAB 8','BAB 9','BAB 10'],
  'Seni Rupa': ['Menggambar','Mewarnai','Kolase & Mozaik','Seni Budaya Lokal','Apresiasi Karya Seni','BAB 6','BAB 7','BAB 8','BAB 9','BAB 10'],
  'IPAS': ['Makhluk Hidup','Materi & Perubahannya','Bumi & Antariksa','Listrik & Energi','Teknologi & Masyarakat','BAB 6','BAB 7','BAB 8','BAB 9','BAB 10'],
  'Bahasa Inggris': ['Greetings & Introduction','Things Around Us','My Family','Daily Activities','Animals & Nature','BAB 6','BAB 7','BAB 8','BAB 9','BAB 10'],
  'Mulok Bahasa Jawa': ['Aksara Jawa','Tembang Macapat','Cerita Rakyat','Unggah-Ungguh Basa','Pranatacara','BAB 6','BAB 7','BAB 8','BAB 9','BAB 10'],
};

let nilaiCfg = {
  mapel:'PAIBP', kelas:'Kelas 1', semester:'Genap', tahun:'2025/2026',
  nBab:5, nTP:4,
  babNames:['Al Qur\'an Pedoman Hidupku','Kasih Sayang terhadap Sesama','Aku Suka Berterima Kasih dan Disiplin','Membiasakan Hidup Bersih','Nabi Adam a.s. Manusia Pertama'],
  siswaList:[],
};
// nilaiData[siswaKey] = { tp: [[nTP values per BAB], ...], sum:[5], nonTes:null, tengah:null, akhir:null }
let nilaiData = LS.get('nilai_data', {});

function nilaiTab(tab, el) {
  ['setup','input','rekap'].forEach(t => document.getElementById('nilai-tab-'+t).classList.toggle('hidden', t!==tab));
  document.querySelectorAll('.nilai-tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  if (tab==='input') nilaiRenderTabel();
  if (tab==='rekap') nilaiRenderRekap();
}

function nilaiMapelChange() {
  const mapel = document.getElementById('n-mapel').value;
  const babs = defaultBabs[mapel] || [];
  const nBab = parseInt(document.getElementById('n-nbab').value) || 5;
  const inputs = document.querySelectorAll('.bab-name-input');
  inputs.forEach((inp, i) => { if (babs[i]) inp.value = babs[i]; });
}

function nilaiUpdateBabInputs() {
  const nBab = parseInt(document.getElementById('n-nbab').value) || 5;
  const mapel = document.getElementById('n-mapel').value;
  const babs = defaultBabs[mapel] || [];
  const wrap = document.getElementById('bab-inputs-wrap');
  wrap.innerHTML = Array.from({length:10}, (_,i) => `
    <div class="setup-bab-row" style="${i>=nBab?'display:none':''}">
      <div class="setup-bab-num">${i+1}</div>
      <input class="setup-bab-input bab-name-input" type="text" placeholder="Nama BAB ${i+1}..." value="${babs[i]||'BAB '+(i+1)}" />
    </div>`).join('');
}

function nilaiTerapkan() {
  const nBab = parseInt(document.getElementById('n-nbab').value);
  const inputs = document.querySelectorAll('.bab-name-input');
  const babNames = Array.from(inputs).slice(0,nBab).map(i=>i.value.trim()||'BAB');
  nilaiCfg = {
    mapel: document.getElementById('n-mapel').value,
    kelas: document.getElementById('n-kelas').value,
    semester: document.getElementById('n-semester').value,
    tahun: document.getElementById('n-tahun').value.trim(),
    nBab, nTP: parseInt(document.getElementById('n-ntp').value),
    babNames,
    siswaList: siswaMaster.filter(s=>s.kelas===document.getElementById('n-kelas').value),
  };
  // Seed empty nilaiData for each siswa
  const mapelKey = nilaiCfg.mapel;
  if (!nilaiData[mapelKey]) nilaiData[mapelKey] = {};
  nilaiCfg.siswaList.forEach(s => {
    const key = s.noInduk+'_'+s.nisn;
    if (!nilaiData[mapelKey][key]) {
      nilaiData[mapelKey][key] = {
        tp: Array.from({length:nilaiCfg.nBab}, ()=>Array(nilaiCfg.nTP).fill('')),
        sum: Array(5).fill(''), nonTes:'', tengah:'', akhir:''
      };
    }
  });
  // Update sub header
  document.getElementById('nilai-sub-header').textContent = `${nilaiCfg.mapel} • ${nilaiCfg.kelas} • ${nilaiCfg.semester} ${nilaiCfg.tahun}`;
  document.querySelector('.nilai-tab-btn:nth-child(2)').click();
  showToast('✅ Pengaturan diterapkan! Silakan input nilai.', '#2E7D32');
}

function nilaiGetKey(s) { return s.noInduk+'_'+s.nisn; }

function nilaiCalc(key, mapel) {
  const mKey = mapel || nilaiCfg.mapel;
  const d = nilaiData[mKey] ? nilaiData[mKey][key] : null;
  if (!d) return { naF:'-', naS:'-', nr:'-' };
  // Formatif
  const allTP = d.tp.flat().filter(v => v!=='' && !isNaN(parseFloat(v))).map(Number);
  const naF = allTP.length ? Math.round(allTP.reduce((a,b)=>a+b,0)/allTP.length) : null;
  // Sumatif LM
  const allSum = d.sum.filter(v => v!=='' && !isNaN(parseFloat(v))).map(Number);
  const naS = allSum.length ? Math.round(allSum.reduce((a,b)=>a+b,0)/allSum.length) : null;
  // Nilai Raport weighted
  let parts=[], weights=[];
  if (naF!==null){ parts.push(naF*40); weights.push(40); }
  if (naS!==null){ parts.push(naS*20); weights.push(20); }
  if (d.nonTes!==''&&!isNaN(d.nonTes)){ parts.push(Number(d.nonTes)*10); weights.push(10); }
  if (d.tengah!==''&&!isNaN(d.tengah)){ parts.push(Number(d.tengah)*15); weights.push(15); }
  if (d.akhir!==''&&!isNaN(d.akhir)){ parts.push(Number(d.akhir)*15); weights.push(15); }
  const totalW = weights.reduce((a,b)=>a+b,0);
  const nr = totalW>0 ? Math.round(parts.reduce((a,b)=>a+b,0)/totalW) : null;
  return { naF: naF!==null?naF:'-', naS: naS!==null?naS:'-', nr: nr!==null?nr:'-' };
}

function nilaiColor(v) {
  if (v===''||v===null||isNaN(v)) return '';
  v = Number(v);
  if (v>=90) return 'nilai-a';
  if (v>=75) return 'nilai-b';
  if (v>=60) return 'nilai-c';
  return 'nilai-d';
}

function nilaiRenderTabel() {
  const { mapel, kelas, semester, tahun, nBab, nTP, babNames, siswaList } = nilaiCfg;
  document.getElementById('n-info-mapel').textContent = mapel;
  document.getElementById('n-info-kelas').textContent = kelas;
  document.getElementById('n-info-sem').textContent = semester + ' ' + tahun;

  const tabel = document.getElementById('nilai-tabel');
  const formatifCols = nBab * nTP;

  // ===== BUILD HEADER =====
  let thead = '<thead>';
  // Row 1: top-level groups
  thead += '<tr>';
  thead += '<th class="th-id" rowspan="2" colspan="3">No. Peserta</th>';
  thead += '<th class="th-id" rowspan="3" style="min-width:130px">Nama Peserta Didik</th>';
  thead += `<th class="th-formatif" colspan="${formatifCols}">FORMATIF</th>`;
  thead += '<th class="th-na" rowspan="2">NILAI AKHIR</th>';
  thead += '<th class="th-sumatif-lm" colspan="5">SUMATIF LINGKUP MATERI</th>';
  thead += '<th class="th-na" rowspan="2" style="background:#C8E6C9!important;color:#1B5E20!important">NILAI AKHIR</th>';
  thead += '<th class="th-nilai-sum" colspan="3">NILAI SUMATIF</th>';
  thead += '<th class="th-raport" rowspan="3">NILAI RAPORT</th>';
  thead += '</tr>';

  // Row 2: BAB names + Sum labels + Sumatif sub-labels
  thead += '<tr>';
  babNames.slice(0,nBab).forEach(n => {
    thead += `<th class="th-bab" colspan="${nTP}" title="${n}">${n.length>18?n.slice(0,16)+'…':n}</th>`;
  });
  // Sum.1-5 (rowspan=2 so they span row 2&3)
  for (let i=1;i<=5;i++) thead += `<th class="th-sum-sub" rowspan="2">Sum.${i}</th>`;
  // Sumatif sub cols (rowspan=2)
  thead += '<th class="th-nilai-sum" rowspan="2" style="font-size:9px;writing-mode:vertical-rl;transform:rotate(180deg);padding:6px 3px">NON TES</th>';
  thead += '<th class="th-nilai-sum" rowspan="2" style="font-size:9px;writing-mode:vertical-rl;transform:rotate(180deg);padding:6px 3px">TENGAH SEMESTER</th>';
  thead += '<th class="th-nilai-sum" rowspan="2" style="font-size:9px;writing-mode:vertical-rl;transform:rotate(180deg);padding:6px 3px">AKHIR SEMESTER</th>';
  thead += '</tr>';

  // Row 3: Urut/Induk/NISN + TP cols per BAB
  thead += '<tr>';
  thead += '<th class="th-id" style="font-size:10px">Urut</th>';
  thead += '<th class="th-id" style="font-size:10px;min-width:44px">Induk</th>';
  thead += '<th class="th-id" style="font-size:10px;min-width:70px">NISN</th>';
  for (let b=0;b<nBab;b++) {
    for (let t=0;t<nTP;t++) {
      thead += `<th class="th-tp">TP.${t+1}</th>`;
    }
  }
  thead += '</tr>';
  thead += '</thead>';

  // ===== BUILD BODY =====
  let tbody = '<tbody>';
  if (!siswaList.length) {
    const totalCols = 4 + formatifCols + 1 + 5 + 1 + 3 + 1;
    tbody += `<tr><td colspan="${totalCols}" style="padding:24px;color:#9E9E9E;font-size:13px">
      Tidak ada siswa di kelas ini.<br><small>Tambah siswa dulu di menu Data Siswa</small></td></tr>`;
  } else {
    siswaList.forEach((s, idx) => {
      const key = nilaiGetKey(s);
      const _mKey = nilaiCfg.mapel;
      const d = (nilaiData[_mKey]&&nilaiData[_mKey][key]) ? nilaiData[_mKey][key] : { tp:Array.from({length:nBab},()=>Array(nTP).fill('')), sum:Array(5).fill(''), nonTes:'', tengah:'', akhir:'' };
      const { naF, naS, nr } = nilaiCalc(key, nilaiCfg.mapel);
      const nrClass = nr!=='-' ? (Number(nr)>=75?'lulus':'tidak-lulus') : '';
      tbody += `<tr>`;
      tbody += `<td class="td-no">${idx+1}</td>`;
      tbody += `<td class="td-no">${s.noInduk}</td>`;
      tbody += `<td class="td-no" style="min-width:70px">${s.nisn}</td>`;
      tbody += `<td class="td-nama">${s.nama}</td>`;
      // TP inputs per BAB
      for (let b=0;b<nBab;b++) {
        for (let t=0;t<nTP;t++) {
          const val = (d.tp[b]||[])[t]||'';
          const cls = nilaiColor(val);
          tbody += `<td class="${cls}" style="${val&&val!==''?'background:'+(Number(val)>=90?'#E8F5E9':Number(val)>=75?'#E3F2FD':Number(val)>=60?'#FFF8E1':'#FFEBEE'):''}">
            <input class="nilai-input" type="number" min="0" max="100" value="${val}"
              data-key="${key}" data-type="tp" data-bab="${b}" data-tp="${t}"
              oninput="nilaiOnInput(this)" onchange="nilaiOnInput(this)" /></td>`;
        }
      }
      // NA Formatif
      tbody += `<td class="td-calc td-na-f">${naF}</td>`;
      // Sumatif LM
      for (let i=0;i<5;i++) {
        const val = d.sum[i]||'';
        const cls = nilaiColor(val);
        tbody += `<td class="${cls}" style="${val&&val!==''?'background:'+(Number(val)>=90?'#E8F5E9':Number(val)>=75?'#E3F2FD':Number(val)>=60?'#FFF8E1':'#FFEBEE'):''}">
          <input class="nilai-input" type="number" min="0" max="100" value="${val}"
            data-key="${key}" data-type="sum" data-idx="${i}"
            oninput="nilaiOnInput(this)" onchange="nilaiOnInput(this)" /></td>`;
      }
      // NA Sumatif LM
      tbody += `<td class="td-calc td-na-s">${naS}</td>`;
      // Non Tes, Tengah, Akhir
      ['nonTes','tengah','akhir'].forEach(f => {
        const val = d[f]||'';
        tbody += `<td class="td-nontes">
          <input class="nilai-input" type="number" min="0" max="100" value="${val}"
            data-key="${key}" data-type="${f}"
            oninput="nilaiOnInput(this)" onchange="nilaiOnInput(this)" /></td>`;
      });
      // Nilai Raport
      tbody += `<td class="td-calc td-nr ${nrClass}" id="nr-${key.replace(/[^a-z0-9]/gi,'_')}">${nr}</td>`;
      tbody += `</tr>`;
    });
  }
  tbody += '</tbody>';
  tabel.innerHTML = thead + tbody;
}

function nilaiOnInput(el) {
  const { key, type, bab, tp: tpIdx, idx } = el.dataset;
  let val = el.value.trim();
  if (val!=='' && (isNaN(val)||Number(val)<0||Number(val)>100)) { el.style.background='#FFEBEE'; return; }
  el.style.background = '';
  const _mk = nilaiCfg.mapel;
  if (!nilaiData[_mk] || !nilaiData[_mk][key]) return;
  if (type==='tp') {
    if (!nilaiData[_mk][key].tp[+bab]) nilaiData[_mk][key].tp[+bab]=[];
    nilaiData[_mk][key].tp[+bab][+tpIdx] = val;
  } else if (type==='sum') {
    nilaiData[_mk][key].sum[+idx] = val;
  } else {
    nilaiData[_mk][key][type] = val;
  }
  // Color cell
  const cell = el.parentElement;
  if (val===''||isNaN(val)) {
    cell.style.background=''; cell.className='';
  } else {
    const n=Number(val);
    cell.style.background = n>=90?'#E8F5E9':n>=75?'#E3F2FD':n>=60?'#FFF8E1':'#FFEBEE';
  }
  // Autosave nilai
  LS.set('nilai_data', nilaiData);
  // Update calculated cells in this row
  const { naF, naS, nr } = nilaiCalc(key);
  const row = el.closest('tr');
  if (row) {
    const naFCell = row.querySelector('.td-na-f');
    const naSCell = row.querySelector('.td-na-s');
    const safeId = 'nr-'+key.replace(/[^a-z0-9]/gi,'_');
    const nrCell = document.getElementById(safeId);
    if (naFCell) naFCell.textContent = naF;
    if (naSCell) naSCell.textContent = naS;
    if (nrCell) {
      nrCell.textContent = nr;
      nrCell.className = 'td-calc td-nr '+(nr!=='-'?(Number(nr)>=75?'lulus':'tidak-lulus'):'');
    }
  }
}

// ---- Rekap ----
function nilaiRenderRekap() {
  const { mapel, kelas, semester, tahun, siswaList } = nilaiCfg;
  document.getElementById('rk-mapel').textContent = mapel;
  document.getElementById('rk-kelas').textContent = kelas;
  document.getElementById('rk-sem').textContent = semester+' '+tahun;

  const el = document.getElementById('rekap-list');
  if (!siswaList.length) {
    document.getElementById('rk-total').textContent='0';
    document.getElementById('rk-lulus').textContent='0';
    document.getElementById('rk-avg').textContent='-';
    el.innerHTML='<div class="empty-state"><div class="empty-icon">📊</div><div>Terapkan pengaturan & input nilai dulu.</div></div>';
    return;
  }
  let totalNR=0, countNR=0, lulus=0;
  const rows = siswaList.map((s,idx) => {
    const key = nilaiGetKey(s);
    const { naF, naS, nr } = nilaiCalc(key);
    const nrNum = nr!=='-'?Number(nr):null;
    if (nrNum!==null){ totalNR+=nrNum; countNR++; if(nrNum>=75)lulus++; }
    let predikat='', predClass='';
    if (nrNum!==null){ if(nrNum>=90){predikat='A';predClass='pred-a';}else if(nrNum>=75){predikat='B';predClass='pred-b';}else if(nrNum>=60){predikat='C';predClass='pred-c';}else{predikat='D';predClass='pred-d';} }
    const pct = nrNum!==null?nrNum:0;
    const barColor = pct>=90?'#2E7D32':pct>=75?'#1565C0':pct>=60?'#E65100':'#C62828';
    return `<div class="rekap-siswa-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div class="rekap-nama">${idx+1}. ${s.nama}</div>
        ${predikat?`<span class="predikat-badge ${predClass}">${predikat}${nrNum!==null?' ('+nrNum+')':''}</span>`:''}
      </div>
      <div class="rekap-score-row">
        <span class="rekap-score-pill rsp-f">📝 Formatif: ${naF}</span>
        <span class="rekap-score-pill rsp-s">📋 Sumatif LM: ${naS}</span>
        <span class="rekap-score-pill rsp-r">🏆 Raport: ${nr}</span>
      </div>
      ${nrNum!==null?`<div class="rekap-progress"><div class="rekap-progress-bar" style="width:${pct}%;background:${barColor}"></div></div>`:''}
    </div>`;
  });
  document.getElementById('rk-total').textContent=siswaList.length;
  document.getElementById('rk-lulus').textContent=lulus;
  document.getElementById('rk-avg').textContent=countNR?Math.round(totalNR/countNR):'-';
  el.innerHTML = rows.join('');
}

// ---- Export Excel ----
function nilaiExportExcel() {
  const { mapel, kelas, semester, tahun, nBab, nTP, babNames, siswaList } = nilaiCfg;
  const wb = XLSX.utils.book_new();
  // Build header rows
  const hRow1 = ['Urut','No. Induk','NISN','Nama Peserta Didik'];
  for (let b=0;b<nBab;b++) for (let t=0;t<nTP;t++) hRow1.push(`${babNames[b]} TP.${t+1}`);
  hRow1.push('NA Formatif');
  for (let i=1;i<=5;i++) hRow1.push('Sum.'+i);
  hRow1.push('NA Sumatif LM','Non Tes','Tengah Semester','Akhir Semester','Nilai Raport');
  const rows = [hRow1];
  siswaList.forEach((s,idx) => {
    const key = nilaiGetKey(s);
    const d = nilaiData[key]||{tp:Array.from({length:nBab},()=>Array(nTP).fill('')),sum:Array(5).fill(''),nonTes:'',tengah:'',akhir:''};
    const { naF, naS, nr } = nilaiCalc(key);
    const row = [idx+1, s.noInduk, s.nisn, s.nama];
    for (let b=0;b<nBab;b++) for (let t=0;t<nTP;t++) row.push((d.tp[b]||[])[t]||'');
    row.push(naF);
    for (let i=0;i<5;i++) row.push(d.sum[i]||'');
    row.push(naS, d.nonTes||'', d.tengah||'', d.akhir||'', nr);
    rows.push(row);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Add info rows at top
  const infoSheet = [
    ['DAFTAR NILAI '+mapel.toUpperCase()+' — KURIKULUM MERDEKA'],
    ['Kelas / Semester', ': '+kelas+'/'+semester],
    ['Tahun Pelajaran', ': '+tahun],
    [],
    ...rows
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(infoSheet);
  XLSX.utils.book_append_sheet(wb, ws2, 'Nilai '+mapel.slice(0,15));
  const fname = `Nilai_${mapel.replace(/[^a-zA-Z0-9]/g,'_')}_${kelas.replace(/\s/g,'')}_SDN3Kalipang.xlsx`;
  XLSX.writeFile(wb, fname);
  showToast('✅ Data nilai diexport!', '#2E7D32');
}

// Init penilaian on DOMContentLoaded
function initPenilaian() {
  nilaiUpdateBabInputs();
}


// ============================================================
// ==================== JADWAL PELAJARAN ======================
// ============================================================

const HARI = ['Senin','Selasa','Rabu','Kamis','Jumat'];
const MAPEL_COLORS = {
  'PAIBP':'#E8F5E9','Pendidikan Pancasila':'#E3F2FD','Bahasa Indonesia':'#FFF3E0',
  'Matematika':'#FCE4EC','PJOK':'#F3E5F5','Seni Rupa':'#FFF8E1',
  'IPAS':'#E0F2F1','Bahasa Inggris':'#E8EAF6','Mulok Bahasa Jawa':'#FBE9E7',
};
const MAPEL_BORDER = {
  'PAIBP':'#2E7D32','Pendidikan Pancasila':'#1565C0','Bahasa Indonesia':'#E65100',
  'Matematika':'#C2185B','PJOK':'#6A1B9A','Seni Rupa':'#F57F17',
  'IPAS':'#00695C','Bahasa Inggris':'#283593','Mulok Bahasa Jawa':'#BF360C',
};

// ===== STRUKTUR BARIS JADWAL =====
// type: 'literasi' | 'istirahat' | 'jam'
let jadwalRows = LS.get('jadwal_rows', [
  { type:'literasi',  mulai:'07:00', selesai:'07:15' },
  { type:'jam', num:1, mulai:'07:15', selesai:'07:50' },
  { type:'jam', num:2, mulai:'07:50', selesai:'08:25' },
  { type:'jam', num:3, mulai:'08:25', selesai:'09:00' },
  { type:'istirahat', label:'Istirahat 1', mulai:'09:00', selesai:'09:15' },
  { type:'jam', num:4, mulai:'09:15', selesai:'09:50' },
  { type:'jam', num:5, mulai:'09:50', selesai:'10:25' },
  { type:'jam', num:6, mulai:'10:25', selesai:'11:00' },
  { type:'istirahat', label:'Istirahat 2', mulai:'11:00', selesai:'11:15' },
  { type:'jam', num:7, mulai:'11:15', selesai:'11:55' },
  { type:'jam', num:8, mulai:'11:55', selesai:'12:30' },
]);

// jadwalData[kelas][hari][jamNum] = { mapel, guru }
let jadwalData = LS.get('jadwal_data', {});

function jadwalGetKey() {
  return document.getElementById('jdw-kelas').value;
}

function jadwalEnsureKelas(kelas) {
  if (!jadwalData[kelas]) {
    jadwalData[kelas] = {};
    HARI.forEach(h => { jadwalData[kelas][h] = {}; });
  }
}

// Default jadwal semua kelas (8 jam, Senin Jam 1 = Upacara)
function initJadwalDemo() {
  const BASE = {
    Senin:  {2:'Matematika',3:'Matematika',4:'Bahasa Indonesia',5:'Bahasa Indonesia',6:'IPAS',7:'IPAS',8:''},
    Selasa: {1:'PAIBP',2:'PAIBP',3:'Pendidikan Pancasila',4:'Pendidikan Pancasila',5:'Seni Rupa',6:'Seni Rupa',7:'Mulok Bahasa Jawa',8:''},
    Rabu:   {1:'Bahasa Indonesia',2:'Bahasa Indonesia',3:'Matematika',4:'Matematika',5:'Bahasa Inggris',6:'Bahasa Inggris',7:'',8:''},
    Kamis:  {1:'IPAS',2:'IPAS',3:'PAIBP',4:'Pendidikan Pancasila',5:'Mulok Bahasa Jawa',6:'Mulok Bahasa Jawa',7:'',8:''},
    Jumat:  {1:'PJOK',2:'PJOK',3:'PJOK',4:'Bahasa Indonesia',5:'Matematika',6:'',7:'',8:''},
  };
  const KLS1 = {
    Senin:{2:'Bahasa Indonesia',3:'Bahasa Indonesia',4:'Matematika',5:'Matematika',6:'PJOK',7:'',8:''},
    Selasa:{1:'PAIBP',2:'PAIBP',3:'Seni Rupa',4:'Seni Rupa',5:'Pendidikan Pancasila',6:'',7:'',8:''},
    Rabu:{1:'Matematika',2:'Matematika',3:'Bahasa Indonesia',4:'Bahasa Indonesia',5:'Mulok Bahasa Jawa',6:'',7:'',8:''},
    Kamis:{1:'Pendidikan Pancasila',2:'Pendidikan Pancasila',3:'IPAS',4:'IPAS',5:'',6:'',7:'',8:''},
    Jumat:{1:'PJOK',2:'PJOK',3:'PJOK',4:'Bahasa Indonesia',5:'',6:'',7:'',8:''},
  };
  const KLS2 = {
    Senin:{2:'Bahasa Indonesia',3:'Bahasa Indonesia',4:'Matematika',5:'Matematika',6:'IPAS',7:'',8:''},
    Selasa:{1:'PAIBP',2:'PAIBP',3:'Pendidikan Pancasila',4:'Pendidikan Pancasila',5:'Seni Rupa',6:'',7:'',8:''},
    Rabu:{1:'Matematika',2:'Matematika',3:'Bahasa Indonesia',4:'Bahasa Indonesia',5:'Bahasa Inggris',6:'',7:'',8:''},
    Kamis:{1:'IPAS',2:'IPAS',3:'Mulok Bahasa Jawa',4:'Mulok Bahasa Jawa',5:'Matematika',6:'',7:'',8:''},
    Jumat:{1:'PJOK',2:'PJOK',3:'PJOK',4:'Bahasa Indonesia',5:'',6:'',7:'',8:''},
  };
  const KLS3 = {
    Senin:{2:'Bahasa Indonesia',3:'Bahasa Indonesia',4:'Matematika',5:'Matematika',6:'IPAS',7:'IPAS',8:''},
    Selasa:{1:'PAIBP',2:'PAIBP',3:'Pendidikan Pancasila',4:'Pendidikan Pancasila',5:'Seni Rupa',6:'Seni Rupa',7:'',8:''},
    Rabu:{1:'Matematika',2:'Matematika',3:'Bahasa Indonesia',4:'Bahasa Indonesia',5:'Mulok Bahasa Jawa',6:'Mulok Bahasa Jawa',7:'',8:''},
    Kamis:{1:'IPAS',2:'IPAS',3:'PAIBP',4:'Pendidikan Pancasila',5:'PJOK',6:'PJOK',7:'',8:''},
    Jumat:{1:'Bahasa Indonesia',2:'Bahasa Indonesia',3:'Matematika',4:'Matematika',5:'',6:'',7:'',8:''},
  };
  const KLS5 = {
    Senin:{2:'IPAS',3:'IPAS',4:'Matematika',5:'Matematika',6:'Bahasa Indonesia',7:'Bahasa Indonesia',8:''},
    Selasa:{1:'Pendidikan Pancasila',2:'Pendidikan Pancasila',3:'PAIBP',4:'PAIBP',5:'Seni Rupa',6:'Seni Rupa',7:'Mulok Bahasa Jawa',8:''},
    Rabu:{1:'Bahasa Indonesia',2:'Bahasa Indonesia',3:'IPAS',4:'IPAS',5:'Bahasa Inggris',6:'Bahasa Inggris',7:'',8:''},
    Kamis:{1:'Matematika',2:'Matematika',3:'Pendidikan Pancasila',4:'PAIBP',5:'Mulok Bahasa Jawa',6:'Mulok Bahasa Jawa',7:'',8:''},
    Jumat:{1:'PJOK',2:'PJOK',3:'PJOK',4:'Matematika',5:'Bahasa Indonesia',6:'',7:'',8:''},
  };
  const KLS6 = {
    Senin:{2:'Matematika',3:'Matematika',4:'IPAS',5:'IPAS',6:'Bahasa Indonesia',7:'Bahasa Indonesia',8:'Pendidikan Pancasila'},
    Selasa:{1:'PAIBP',2:'PAIBP',3:'Bahasa Indonesia',4:'Bahasa Indonesia',5:'Matematika',6:'Matematika',7:'Seni Rupa',8:''},
    Rabu:{1:'IPAS',2:'IPAS',3:'Bahasa Inggris',4:'Bahasa Inggris',5:'Pendidikan Pancasila',6:'Pendidikan Pancasila',7:'',8:''},
    Kamis:{1:'Matematika',2:'Matematika',3:'PAIBP',4:'IPAS',5:'Mulok Bahasa Jawa',6:'Mulok Bahasa Jawa',7:'',8:''},
    Jumat:{1:'PJOK',2:'PJOK',3:'PJOK',4:'Bahasa Indonesia',5:'Matematika',6:'',7:'',8:''},
  };
  const MAP = {'1':KLS1,'2':KLS2,'3':KLS3,'4':BASE,'5':KLS5,'6':KLS6};
  ['1','2','3','4','5','6'].forEach(k => {
    const tpl = MAP[k];
    jadwalData[k] = {};
    HARI.forEach(h => {
      jadwalData[k][h] = {};
      for (let j=1;j<=8;j++) {
        const m = (tpl[h]||{})[j]||'';
        if (m) jadwalData[k][h][j] = { mapel:m, guru:jadwalCariGuru(m) };
      }
    });
  });
  LS.set('jadwal_data', jadwalData);
}


function jadwalCariGuru(mapel) {
  const g = guruData.find(g => (g.jenisGuru && g.jenisGuru.toLowerCase().includes(mapel.toLowerCase()))
    || (g.mapel && (g.mapel === mapel || g.mapel.includes(mapel))));
  return g ? g.nama.split(',')[0] : '';
}

function jadwalTab(tab, el) {
  ['lihat','edit','jam'].forEach(t => document.getElementById('jdw-tab-'+t).classList.toggle('hidden', t!==tab));
  document.querySelectorAll('#screen-jadwal .tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  if (tab==='lihat') jadwalRender();
  if (tab==='jam')   jamRenderInputs();
  if (tab==='edit')  jadwalFillGuruSelect();
}

function jadwalFillGuruSelect() {
  const sel = document.getElementById('jdw-guru');
  sel.innerHTML = '<option value="">-- Pilih Guru --</option>' +
    guruData.map(g => `<option value="${g.nama}">${g.nama}</option>`).join('');
}

function jadwalRender() {
  const kelas = jadwalGetKey();
  jadwalEnsureKelas(kelas);
  const data  = jadwalData[kelas];
  const table = document.getElementById('jadwal-table');
  const ROM   = {1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI'};
  const NAMA  = {1:'SATU',2:'DUA',3:'TIGA',4:'EMPAT',5:'LIMA',6:'ENAM'};
  const n     = parseInt(kelas);
  const klsLbl = (ROM[n]||kelas)+'\n('+(NAMA[n]||kelas)+')';
  const today = new Date().toLocaleDateString('id-ID',{weekday:'long'});
  const totalRows = jadwalRows.length;
  let h = '<thead><tr>';
  h += '<th style="min-width:26px;width:26px">KLS</th>';
  h += '<th style="min-width:30px;width:30px">JAM</th>';
  h += '<th style="min-width:84px;width:84px">WAKTU</th>';
  HARI.forEach(hari => {
    const act = (today===hari);
    h += `<th style="${act?'background:#1B5E20;':''}">${hari}</th>`;
  });
  h += '</tr></thead><tbody>';
  let klsDone = false;
  jadwalRows.forEach(row => {
    const waktu = row.mulai.replace(':','.')+' – '+row.selesai.replace(':','.');
    if (row.type==='istirahat') {
      h += '<tr class="jdw-row-ist">';
      if(!klsDone){h+=`<td class="jdw-kls" rowspan="${totalRows}">${klsLbl}</td>`;klsDone=true;}
      h += `<td class="jdw-jam" style="font-size:9px;color:#E65100">☕</td>`;
      h += `<td class="jdw-waktu" style="color:#E65100;font-weight:700">${waktu}</td>`;
      HARI.forEach(()=>{
        h += `<td class="jdw-cell" style="cursor:default;background:#FFF9C4;border-color:#F9A825"><span style="font-size:10px;font-weight:800;color:#E65100">${row.label}</span></td>`;
      });
      h += '</tr>';
    } else if (row.type==='literasi') {
      h += '<tr class="jdw-row-lit">';
      if(!klsDone){h+=`<td class="jdw-kls" rowspan="${totalRows}">${klsLbl}</td>`;klsDone=true;}
      h += '<td class="jdw-jam" style="font-size:9px;color:#1B5E20">Lit.</td>';
      h += `<td class="jdw-waktu" style="color:#2E7D32">${waktu}</td>`;
      HARI.forEach(()=>{
        h += '<td class="jdw-cell" style="background:#E8F5E9;border-color:#A5D6A7;cursor:default"><span style="font-size:10px;font-weight:700;color:#2E7D32">Literasi</span></td>';
      });
      h += '</tr>';
    } else {
      const j = row.num;
      h += '<tr>';
      if(!klsDone){h+=`<td class="jdw-kls" rowspan="${totalRows}">${klsLbl}</td>`;klsDone=true;}
      h += `<td class="jdw-jam">${j}</td>`;
      h += `<td class="jdw-waktu">${waktu}</td>`;
      HARI.forEach(hari => {
        if (hari==='Senin' && j===1) {
          h += '<td class="jdw-cell" style="background:#FFF3E0;border-color:#FFCC80;cursor:default"><div class="jdw-upacara"><div class="jdw-upacara-m">Upacara</div><div class="jdw-upacara-s">Bendera</div></div></td>';
        } else {
          const slot=(data[hari]||{})[j];
          if(slot&&slot.mapel){
            const bg=MAPEL_COLORS[slot.mapel]||'#F5F5F5';
            const bdr=MAPEL_BORDER[slot.mapel]||'#9E9E9E';
            h+=`<td class="jdw-cell" onclick="jadwalEditCell('${hari}',${j})"><div class="jdw-chip" style="background:${bg};border-left-color:${bdr}"><div class="jdw-chip-m">${slot.mapel}</div>${slot.guru?`<div class="jdw-chip-g">${slot.guru.split(' ')[0]}</div>`:''}</div></td>`;
          } else {
            h+=`<td class="jdw-cell jdw-kosong" onclick="jadwalEditCell('${hari}',${j})">+</td>`;
          }
        }
      });
      h += '</tr>';
    }
  });
  h += '</tbody>';
  table.innerHTML = h;
  const used=new Set();
  HARI.forEach(hari=>{for(let j=1;j<=8;j++){const s=(data[hari]||{})[j];if(s&&s.mapel)used.add(s.mapel);}});
  document.getElementById('jadwal-legend').innerHTML=
    [...used].map(m=>`<div style="display:flex;align-items:center;gap:6px;font-size:11px"><div style="width:12px;height:12px;border-radius:2px;flex-shrink:0;background:${MAPEL_COLORS[m]||'#EEE'};border-left:3px solid ${MAPEL_BORDER[m]||'#999'}"></div><span>${m}</span></div>`).join('')||
    '<span style="font-size:12px;color:#9E9E9E">Belum ada jadwal.</span>';
}
function jadwalEditCell(hari,jam){
  ['lihat','edit','jam'].forEach(t=>document.getElementById('jdw-tab-'+t).classList.toggle('hidden',t!=='edit'));
  document.querySelectorAll('#screen-jadwal .tab-btn').forEach((b,i)=>b.classList.toggle('active',i===1));
  document.getElementById('jdw-hari').value=hari;
  document.getElementById('jdw-jam').value=String(jam);
  jadwalFillGuruSelect();
  const kelas=jadwalGetKey();
  const slot=(jadwalData[kelas]?.[hari]||{})[jam];
  document.getElementById('jdw-mapel').value=slot?.mapel||'';
  document.getElementById('jdw-guru').value=slot?.guru||'';
}
function jadwalSimpanSlot() {
  const kelas=jadwalGetKey(), hari=document.getElementById('jdw-hari').value,
        jam=parseInt(document.getElementById('jdw-jam').value),
        mapel=document.getElementById('jdw-mapel').value,
        guru=document.getElementById('jdw-guru').value;
  if(hari==='Senin'&&jam===1){showToast('Senin Jam 1 adalah Upacara, tidak dapat diubah','#F57F17');return;}
  jadwalEnsureKelas(kelas);
  if(!jadwalData[kelas][hari])jadwalData[kelas][hari]={};
  if(mapel){jadwalData[kelas][hari][jam]={mapel,guru};showToast('Tersimpan! '+hari+' Jam '+jam+' - '+mapel,'#2E7D32');}
  else{delete jadwalData[kelas][hari][jam];showToast('Dikosongkan: '+hari+' Jam '+jam,'#F57F17');}
  LS.set('jadwal_data',jadwalData); jadwalRender();
}


function jadwalHapusSlot() {
  const kelas=jadwalGetKey(), hari=document.getElementById('jdw-del-hari').value,
        jam=parseInt(document.getElementById('jdw-del-jam').value);
  if(hari==='Senin'&&jam===1){showToast('Senin Jam 1 adalah Upacara, tidak dapat dihapus','#F57F17');return;}
  jadwalEnsureKelas(kelas);
  delete jadwalData[kelas][hari][jam];
  LS.set('jadwal_data',jadwalData);
  showToast('Slot '+hari+' Jam '+jam+' dihapus','#F57F17');
  jadwalRender();
}


// ===== JAM PELAJARAN EDITOR =====
function jamRenderInputs() {
  const el = document.getElementById('jam-list');
  el.innerHTML = jadwalRows.map((row, i) => {
    if (row.type === 'literasi') {
      return `<div style="display:grid;grid-template-columns:64px 1fr 1fr;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid #F5F5F5;background:#F1F8E9;border-radius:8px;padding:8px;margin-bottom:4px">
        <div style="text-align:center">
          <div style="font-size:10px;font-weight:800;color:#1B5E20">📖 Literasi</div>
          <div style="font-size:9px;color:#757575">Jam 0</div>
        </div>
        <div>
          <label style="font-size:10px;color:#9E9E9E;display:block;margin-bottom:3px">Mulai</label>
          <input type="time" id="jrow-mulai-${i}" class="form-input" value="${row.mulai}" style="padding:8px;font-size:13px" />
        </div>
        <div>
          <label style="font-size:10px;color:#9E9E9E;display:block;margin-bottom:3px">Selesai</label>
          <input type="time" id="jrow-selesai-${i}" class="form-input" value="${row.selesai}" style="padding:8px;font-size:13px" />
        </div>
      </div>`;
    } else if (row.type === 'istirahat') {
      return `<div style="display:grid;grid-template-columns:64px 1fr 1fr;gap:8px;align-items:center;background:#FFF9C4;border-radius:8px;padding:8px;margin-bottom:4px;border:1px solid #F9A825">
        <div style="text-align:center">
          <div style="font-size:10px;font-weight:800;color:#F57F17">☕ Istirahat</div>
        </div>
        <div>
          <label style="font-size:10px;color:#9E9E9E;display:block;margin-bottom:3px">Mulai</label>
          <input type="time" id="jrow-mulai-${i}" class="form-input" value="${row.mulai}" style="padding:8px;font-size:13px;border-color:#F9A825" />
        </div>
        <div>
          <label style="font-size:10px;color:#9E9E9E;display:block;margin-bottom:3px">Selesai</label>
          <input type="time" id="jrow-selesai-${i}" class="form-input" value="${row.selesai}" style="padding:8px;font-size:13px;border-color:#F9A825" />
        </div>
      </div>`;
    } else {
      return `<div style="display:grid;grid-template-columns:64px 1fr 1fr;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #F5F5F5">
        <div style="text-align:center">
          <div style="font-size:12px;font-weight:800;color:#2E7D32">Jam ${row.num}</div>
        </div>
        <div>
          <label style="font-size:10px;color:#9E9E9E;display:block;margin-bottom:3px">Mulai</label>
          <input type="time" id="jrow-mulai-${i}" class="form-input" value="${row.mulai}" style="padding:8px;font-size:13px" />
        </div>
        <div>
          <label style="font-size:10px;color:#9E9E9E;display:block;margin-bottom:3px">Selesai</label>
          <input type="time" id="jrow-selesai-${i}" class="form-input" value="${row.selesai}" style="padding:8px;font-size:13px" />
        </div>
      </div>`;
    }
  }).join('');
}

function jamSimpan() {
  jadwalRows = jadwalRows.map((row, i) => ({
    ...row,
    mulai:   document.getElementById('jrow-mulai-'+i)?.value   || row.mulai,
    selesai: document.getElementById('jrow-selesai-'+i)?.value || row.selesai,
  }));
  LS.set('jadwal_rows',jadwalRows);
  showToast('Jam pelajaran disimpan!','#2E7D32');
  jadwalRender();
}


// ============================================================
// ==================== RAPORT ================================
// ============================================================

// appConfig — pulled from Pengaturan
let appConfig = LS.get('app_config', {
  namaSekolah : 'SD NEGERI 3 KALIPANG',
  alamat      : 'Ds. Kalipang, Kec. Grobogan, Kab. Grobogan',
  tapel       : '2025/2026',
  semester    : 'Genap',
  kepsek      : 'Budi Santoso, S.Pd',
  nipKepsek   : '197501012000031002',
  kkm         : 75,
  kurikulum   : 'Kurikulum Merdeka',
});

const MAPEL_LIST = [
  'PAIBP','Pendidikan Pancasila','Bahasa Indonesia','Matematika',
  'PJOK','Seni Rupa','IPAS','Bahasa Inggris','Mulok Bahasa Jawa',
];

function raportInit() {
  // sync config
  appConfig = LS.get('app_config', appConfig);
  document.getElementById('rp-nama-sekolah').textContent  = appConfig.namaSekolah.toUpperCase();
  document.getElementById('rp-alamat-sekolah').textContent = appConfig.alamat;
  document.getElementById('rp-tahun-label').textContent   = 'Tahun Pelajaran ' + appConfig.tapel + ' — Semester ' + appConfig.semester;
  document.getElementById('rp-ttd-kota').textContent      = 'Kalipang, ' + new Date().toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  document.getElementById('rp-ttd-name').textContent      = appConfig.kepsek;
  document.getElementById('raport-preview').style.display = 'none';
  document.getElementById('raport-empty').style.display   = 'block';
  document.getElementById('rp-kelas').value  = '';
  document.getElementById('rp-siswa').innerHTML = '<option value="">-- Pilih kelas dulu --</option>';
}

function raportLoadSiswa() {
  const kelas = document.getElementById('rp-kelas').value;
  const sel   = document.getElementById('rp-siswa');
  if (!kelas) { sel.innerHTML = '<option value="">-- Pilih kelas dulu --</option>'; return; }

  // Coba dari siswaMaster dulu, fallback ke defaultSiswa
  let list = siswaMaster.filter(s => s.kelas && s.kelas.replace(/[^0-9]/g,'')[0] === kelas);
  if (!list.length) {
    list = (defaultSiswa[kelas]||[]).map((nama,i) => ({
      no: String(i+1), noInduk: '202400'+String(i+1).padStart(2,'0'),
      nisn: '301'+String(i+1).padStart(5,'0'), nama,
      kelas:'Kelas '+kelas, jk: i%2===0?'L':'P',
      tmplahir:'Kudus', tgllahir:'-', alamat:'-', ayah:'-', ibu:'-', hp:'-',
    }));
  }

  sel.innerHTML = '<option value="">-- Pilih Siswa --</option>' +
    list.map((s,i) => `<option value="${i}">${s.nama}</option>`).join('');
  sel._list = list;

  // hide preview until siswa dipilih
  document.getElementById('raport-preview').style.display = 'none';
  document.getElementById('raport-empty').style.display   = 'block';
}

function raportGenerate() {
  const selSiswa = document.getElementById('rp-siswa');
  const idx = selSiswa.value;
  if (idx === '' || !selSiswa._list) return;

  const s         = selSiswa._list[parseInt(idx)];
  const sem       = document.getElementById('rp-semester').value;
  const kelasNum  = document.getElementById('rp-kelas').value;

  // Cari wali kelas (guru kelas di jadwal, atau default)
  const wali = guruData.find(g => g.jenisGuru === 'Guru Kelas' || g.jabatan === 'Guru Kelas')?.nama || appConfig.kepsek;

  // Populate identitas
  document.getElementById('rp-s-nama').textContent  = s.nama;
  document.getElementById('rp-s-induk').textContent = s.noInduk;
  document.getElementById('rp-s-nisn').textContent  = s.nisn;
  document.getElementById('rp-s-kelas').textContent = s.kelas || 'Kelas '+kelasNum;
  document.getElementById('rp-s-sem').textContent   = sem + ' / ' + appConfig.tapel;
  document.getElementById('rp-s-wali').textContent  = wali.split(',')[0];
  document.getElementById('rp-ttd-name').textContent = wali.split(',')[0];

  // Build nilai list — ambil dari nilaiData[mapel][key] untuk setiap mapel
  const key = s.noInduk + '_' + s.nisn;
  const rows = MAPEL_LIST.map((mapel, mi) => {
    let nr = '-';
    let isReal = false; // apakah nilai berasal dari input nyata

    // Cek nilaiData per mapel
    if (nilaiData[mapel] && nilaiData[mapel][key]) {
      const calc = nilaiCalc(key, mapel);
      if (calc.nr !== '-') { nr = calc.nr; isReal = true; }
    }

    // Fallback demo jika belum ada nilai real
    if (!isReal) {
      const seed = (s.nama.charCodeAt(0) + mi * 7 + parseInt(kelasNum||4) * 3) % 30;
      nr = 65 + seed;
    }

    const nNum = parseInt(nr)||0;
    let pred='', predBg='', predColor='', barColor='';
    if (nNum>=90){pred='A';predBg='#E8F5E9';predColor='#1B5E20';barColor='#2E7D32';}
    else if(nNum>=75){pred='B';predBg='#E3F2FD';predColor='#1565C0';barColor='#1565C0';}
    else if(nNum>=60){pred='C';predBg='#FFF8E1';predColor='#E65100';barColor='#E65100';}
    else{pred='D';predBg='#FFEBEE';predColor='#C62828';barColor='#C62828';}

    return { mapel, nr:nNum, pred, predBg, predColor, barColor, isReal };
  });

  document.getElementById('rp-nilai-list').innerHTML = rows.map((r, i) => `
    <div class="raport-mapel-row">
      <div class="rm-num">${i+1}</div>
      <div class="rm-name">${r.mapel}${!r.isReal ? '<span style="font-size:9px;color:#BDBDBD;margin-left:4px">(demo)</span>' : ''}</div>
      <div class="rm-bar-wrap"><div class="rm-bar" style="width:${r.nr}%;background:${r.barColor}"></div></div>
      <div class="rm-score" style="color:${r.predColor};font-weight:${r.isReal?'800':'400'}">${r.nr}</div>
      <div class="rm-pred" style="background:${r.predBg};color:${r.predColor};opacity:${r.isReal?1:0.55}">${r.pred}</div>
    </div>`).join('');

  // Tampilkan banner jika ada nilai demo
  const hasDemo = rows.some(r => !r.isReal);
  const hasReal = rows.some(r => r.isReal);
  const banner = document.getElementById('rp-demo-banner');
  if (banner) {
    if (hasDemo && !hasReal) {
      banner.style.display = 'block';
      banner.textContent = '⚠️ Semua nilai masih demo. Input nilai di menu Penilaian terlebih dahulu.';
      banner.style.background = '#FFF8E1'; banner.style.color = '#E65100';
    } else if (hasDemo && hasReal) {
      banner.style.display = 'block';
      banner.textContent = '✅ ' + rows.filter(r=>r.isReal).length + ' mapel dari data nyata. ' + rows.filter(r=>!r.isReal).length + ' mapel masih demo.';
      banner.style.background = '#E3F2FD'; banner.style.color = '#1565C0';
    } else {
      banner.style.display = 'none';
    }
  }

  // Rata-rata & predikat keseluruhan
  const avg  = Math.round(rows.reduce((a,b)=>a+b.nr,0)/rows.length);
  let finalPred='', finalColor='';
  if(avg>=90){finalPred='A';finalColor='#1B5E20';}
  else if(avg>=75){finalPred='B';finalColor='#1565C0';}
  else if(avg>=60){finalPred='C';finalColor='#E65100';}
  else{finalPred='D';finalColor='#C62828';}

  document.getElementById('rp-avg').textContent    = avg;
  document.getElementById('rp-avg').style.color    = finalColor;
  document.getElementById('rp-pred').textContent   = finalPred;
  document.getElementById('rp-pred').style.color   = finalColor;
  document.getElementById('rp-status').textContent = avg>=appConfig.kkm ? 'Naik' : 'Perlu\nBimbingan';
  document.getElementById('rp-status').style.color = avg>=appConfig.kkm ? '#2E7D32' : '#C62828';

  document.getElementById('raport-preview').style.display = 'block';
  document.getElementById('raport-empty').style.display   = 'none';
}

function raportPrint() {
  window.print();
}

function raportExportExcel() {
  const nama = document.getElementById('rp-s-nama').textContent;
  if (nama === '—') { showToast('Pilih siswa dulu!','#C62828'); return; }

  const wb  = XLSX.utils.book_new();
  const kls = document.getElementById('rp-kelas').value;
  const sem = document.getElementById('rp-semester').value;

  // Header info
  const info = [
    [appConfig.namaSekolah],
    ['LAPORAN HASIL BELAJAR PESERTA DIDIK'],
    ['Tahun Pelajaran: '+appConfig.tapel+' | Semester: '+sem],
    [],
    ['Nama',':', nama],
    ['No. Induk',':',document.getElementById('rp-s-induk').textContent],
    ['NISN',':',document.getElementById('rp-s-nisn').textContent],
    ['Kelas',':',document.getElementById('rp-s-kelas').textContent],
    [],
    ['No','Mata Pelajaran','Nilai','Predikat'],
  ];

  // Nilai rows
  const rows = document.querySelectorAll('.raport-mapel-row');
  rows.forEach((row, i) => {
    const mapel = row.querySelector('.rm-name').textContent;
    const nilai = row.querySelector('.rm-score').textContent;
    const pred  = row.querySelector('.rm-pred').textContent;
    info.push([i+1, mapel, parseInt(nilai), pred]);
  });

  info.push([]);
  info.push(['Rata-rata','','', document.getElementById('rp-avg').textContent]);
  info.push(['Predikat Akhir','','', document.getElementById('rp-pred').textContent]);
  info.push(['Catatan', '', '', document.getElementById('rp-catatan').value]);

  const ws = XLSX.utils.aoa_to_sheet(info);
  ws['!cols'] = [{wch:4},{wch:30},{wch:10},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, 'Raport '+nama.split(' ')[0]);
  XLSX.writeFile(wb, 'Raport_'+nama.replace(/\s/g,'_')+'_'+kls+'_'+sem+'.xlsx');
  showToast('✅ Raport '+nama.split(' ')[0]+' diexport!','#2E7D32');
}


// ============================================================
// ==================== PENGATURAN ============================
// ============================================================

function pengaturanLoad() {
  // ===== ROLE-BASED VISIBILITY =====
  const isAdmin  = sessionUser && (sessionUser.role === 'admin' || sessionUser.role === 'kepsek');
  const isGuru   = !isAdmin;

  // Elemen yang hanya admin/kepsek yang boleh lihat
  const adminOnlyIds = [
    'peng-storage', 'peng-identitas', 'peng-tapel',
    'peng-kurikulum', 'peng-akun-daftar', 'peng-akun-tambah', 'peng-data'
  ];
  adminOnlyIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isAdmin ? '' : 'none';
  });

  // Banner khusus guru
  const banner = document.getElementById('peng-guru-banner');
  if (banner) banner.style.display = isGuru ? '' : 'none';

  // Info login
  const infoEl = document.getElementById('cfg-login-info');
  if (infoEl && sessionUser) {
    const roleLabel = { admin: '⚙️ Admin', kepsek: '🏫 Kepala Sekolah', guru: '👨‍🏫 Guru' };
    infoEl.textContent = 'Login sebagai: ' + sessionUser.nama + ' (' + (roleLabel[sessionUser.role] || sessionUser.role) + ')';
  }

  // Isi form pengaturan (hanya admin yang bisa akses field ini, tapi tetap di-load supaya safe)
  const cfg = LS.get('app_config', appConfig);
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('cfg-nama-sekolah', cfg.namaSekolah);
  setVal('cfg-alamat',       cfg.alamat);
  setVal('cfg-tapel',        cfg.tapel    || '2025/2026');
  setVal('cfg-semester',     cfg.semester || 'Genap');
  setVal('cfg-kepsek',       cfg.kepsek);
  setVal('cfg-nip-kepsek',   cfg.nipKepsek);
  setVal('cfg-kkm',          cfg.kkm      || 75);
  setVal('cfg-kurikulum',    cfg.kurikulum || 'Kurikulum Merdeka');
  setVal('cfg-npsn',  cfg.npsn);
  setVal('cfg-kec',   cfg.kec);
  setVal('cfg-kab',   cfg.kab);
  setVal('cfg-telp',  cfg.telp);
  setVal('cfg-email', cfg.email);

  // Render daftar akun (admin saja yang lihat, tapi tidak apa-apa jika dipanggil)
  if (isAdmin) akunRender();
}

function pengaturanSimpan() {
  if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'kepsek')) {
    showToast('⛔ Akses ditolak. Hanya Admin yang bisa ubah pengaturan.', '#C62828'); return;
  }
  const cfg = {
    namaSekolah : document.getElementById('cfg-nama-sekolah').value.trim() || 'SD Negeri 3 Kalipang',
    npsn        : document.getElementById('cfg-npsn')?.value.trim()  || '',
    alamat      : document.getElementById('cfg-alamat').value.trim() || '',
    kec         : document.getElementById('cfg-kec')?.value.trim()   || '',
    kab         : document.getElementById('cfg-kab')?.value.trim()   || '',
    telp        : document.getElementById('cfg-telp')?.value.trim()  || '',
    email       : document.getElementById('cfg-email')?.value.trim() || '',
    tapel       : document.getElementById('cfg-tapel').value.trim()  || '2025/2026',
    semester    : document.getElementById('cfg-semester').value,
    kepsek      : document.getElementById('cfg-kepsek').value.trim() || '',
    nipKepsek   : document.getElementById('cfg-nip-kepsek').value.trim() || '',
    kkm         : parseInt(document.getElementById('cfg-kkm').value) || 75,
    kurikulum   : document.getElementById('cfg-kurikulum').value,
  };
  LS.set('app_config', cfg);
  appConfig = cfg;

  // Update title bar
  document.title = 'Sistem Informasi — ' + cfg.namaSekolah;
  showToast('✅ Pengaturan disimpan!', '#2E7D32');
}

function pengaturanReset() {
  resetAllData();
}


// ============================================================
// ==================== DATA KELAS ============================
// ============================================================

const ROMBEL_LIST = ['Kelas 1','Kelas 2','Kelas 3','Kelas 4','Kelas 5','Kelas 6'];

function kelasLoad() {
  const data = kelasHitung();
  const totalSiswa = data.reduce((a,b)=>a+b.jml,0);
  const totalRombel = data.length;

  document.getElementById('kls-total-rombel').textContent = totalRombel;
  document.getElementById('kls-total-siswa').textContent = totalSiswa;
  document.getElementById('kls-avg-siswa').textContent = totalRombel > 0 ? Math.round(totalSiswa/totalRombel) : 0;

  kelasTabelRender(data, totalSiswa);
  kelasGrafikRender(data);
  kelasWaliRender();
}

function kelasHitung() {
  return ROMBEL_LIST.map(kelas => {
    const siswaKelas = siswaMaster.filter(s => s.kelas === kelas);
    const L = siswaKelas.filter(s => s.jk === 'L').length;
    const P = siswaKelas.filter(s => s.jk === 'P').length;

    // Jika siswaMaster kosong, pakai data demo dari defaultSiswa
    if (!siswaMaster.length) {
      const num = kelas.replace(/[^0-9]/g,'');
      const demo = defaultSiswa[num] || [];
      const dL = demo.filter((_,i)=>i%2===0).length;
      const dP = demo.filter((_,i)=>i%2!==0).length;
      return { kelas, L:dL, P:dP, jml:demo.length };
    }
    return { kelas, L, P, jml: L+P };
  });
}

function kelasTabelRender(data, totalSiswa) {
  const totalL = data.reduce((a,b)=>a+b.L,0);
  const totalP = data.reduce((a,b)=>a+b.P,0);

  const rows = data.map((d,i) => `
    <tr>
      <td>${i+1}</td>
      <td class="col-nama">${d.kelas}</td>
      <td class="col-l">${d.L}</td>
      <td class="col-p">${d.P}</td>
      <td class="col-jml">${d.jml}</td>
    </tr>`).join('');

  const totalRow = `
    <tr class="total-row">
      <td colspan="2" style="text-align:left;padding-left:12px">JUMLAH</td>
      <td>${totalL}</td>
      <td>${totalP}</td>
      <td>${totalSiswa}</td>
    </tr>`;

  document.getElementById('rombel-tbody').innerHTML = rows + totalRow;
}

function kelasGrafikRender(data) {
  const max = Math.max(...data.map(d=>d.jml), 1);
  document.getElementById('kelas-grafik').innerHTML = data.map(d => `
    <div class="rombel-bar-row">
      <div class="rombel-bar-label">${d.kelas}</div>
      <div style="flex:1">
        <div style="display:flex;gap:3px;margin-bottom:3px">
          <div style="flex:1">
            <div class="rombel-bar-wrap"><div class="rombel-bar-l" style="width:${max?Math.round((d.L/max)*100):0}%"></div></div>
          </div>
          <div style="flex:1">
            <div class="rombel-bar-wrap"><div class="rombel-bar-p" style="width:${max?Math.round((d.P/max)*100):0}%"></div></div>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:10px;color:#9E9E9E">
          <span style="color:#1565C0">L: ${d.L}</span>
          <span style="color:#C2185B">P: ${d.P}</span>
          <span style="color:#2E7D32;font-weight:700">Jml: ${d.jml}</span>
        </div>
      </div>
    </div>`).join('');
}

function kelasWaliRender() {
  const waliDefault = [
    { kelas:'Kelas 1', nama:'-', nip:'-' },
    { kelas:'Kelas 2', nama:'-', nip:'-' },
    { kelas:'Kelas 3', nama:'-', nip:'-' },
    { kelas:'Kelas 4', nama:'-', nip:'-' },
    { kelas:'Kelas 5', nama:'-', nip:'-' },
    { kelas:'Kelas 6', nama:'-', nip:'-' },
  ];

  // Cocokkan dengan guruData — cari guru yang jabatannya Guru Kelas
  const waliGuru = guruData.filter(g => g.jenisGuru === 'Guru Kelas' || g.jabatan === 'Guru Kelas');
  waliDefault.forEach((w, i) => {
    if (waliGuru[i]) {
      w.nama = waliGuru[i].nama;
      w.nip  = waliGuru[i].nip;
    }
  });

  document.getElementById('wali-tbody').innerHTML = waliDefault.map((w,i) => `
    <tr>
      <td style="text-align:center;color:#9E9E9E">${i+1}</td>
      <td><span class="wali-kelas-badge">${w.kelas}</span></td>
      <td style="font-weight:${w.nama!=='-'?'600':'400'};color:${w.nama!=='-'?'#212121':'#BDBDBD'}">${w.nama}</td>
      <td style="font-size:11px;color:#9E9E9E">${w.nip !== '-' ? w.nip.slice(0,8)+'…' : '-'}</td>
    </tr>`).join('');
}

function kelasExportExcel() {
  const data = kelasHitung();
  const totalSiswa = data.reduce((a,b)=>a+b.jml,0);
  const totalL = data.reduce((a,b)=>a+b.L,0);
  const totalP = data.reduce((a,b)=>a+b.P,0);

  const wb = XLSX.utils.book_new();
  const header = [
    ['SD NEGERI 3 KALIPANG'],
    ['REKAP JUMLAH PESERTA DIDIK PER ROMBEL'],
    ['Tahun Pelajaran: ' + (appConfig.tapel||'2025/2026')],
    [],
    ['No','Nama Rombel','L','P','Jumlah'],
  ];
  const rows = data.map((d,i) => [i+1, d.kelas, d.L, d.P, d.jml]);
  const totalRow = ['','JUMLAH', totalL, totalP, totalSiswa];

  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, [], totalRow]);
  ws['!cols'] = [{wch:5},{wch:16},{wch:8},{wch:8},{wch:10}];

  // Bold header
  ws['A1'] = { v:'SD NEGERI 3 KALIPANG', t:'s', s:{font:{bold:true,sz:14}} };

  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Kelas');
  XLSX.writeFile(wb, 'RekapKelas_SDN3Kalipang.xlsx');
  showToast('✅ Data kelas berhasil diexport!', '#2E7D32');
}



// ============================================================
// ==================== MATERI & PERANGKAT AJAR ===============
// ============================================================

// Simpan dokumen: materiDocs[kelas_mapel_sem][tipeDok] = { filename, link, uploadedAt }
let materiDocs = {};

const DOKUMEN_CONFIG = [
  {
    key:'cp', kelas:'cp', icon:'📘', label:'Capaian Pembelajaran',
    singkatan:'CP', singkatanColor:'#7B1FA2', singkatanBg:'#F3E5F5',
    desc:'Kompetensi yang harus dicapai peserta didik pada setiap fase pembelajaran.',
    color:'cp'
  },
  {
    key:'atp', icon:'🗺', label:'Alur Tujuan Pembelajaran',
    singkatan:'ATP', singkatanColor:'#1565C0', singkatanBg:'#E3F2FD',
    desc:'Rangkaian tujuan pembelajaran yang tersusun secara sistematis dan logis.',
    color:'atp'
  },
  {
    key:'ma', icon:'📖', label:'Modul Ajar',
    singkatan:'MA', singkatanColor:'#2E7D32', singkatanBg:'#E8F5E9',
    desc:'Rencana pelaksanaan pembelajaran berbasis Kurikulum Merdeka.',
    color:'ma'
  },
  {
    key:'kktp', icon:'🎯', label:'KKTP',
    singkatan:'KKTP', singkatanColor:'#E65100', singkatanBg:'#FBE9E7',
    desc:'Kriteria Ketuntasan Tujuan Pembelajaran — acuan penilaian ketercapaian TP.',
    color:'kktp'
  },
  {
    key:'prota', icon:'📅', label:'Program Tahunan',
    singkatan:'Prota', singkatanColor:'#00838F', singkatanBg:'#E0F7FA',
    desc:'Rencana kegiatan pembelajaran selama satu tahun pelajaran.',
    color:'prota'
  },
  {
    key:'promes', icon:'🗓', label:'Program Semester',
    singkatan:'Promes', singkatanColor:'#AD1457', singkatanBg:'#FCE4EC',
    desc:'Rencana kegiatan pembelajaran selama satu semester.',
    color:'promes'
  },
  {
    key:'jurnal', icon:'📝', label:'Jurnal Pembelajaran',
    singkatan:'Jurnal', singkatanColor:'#F57F17', singkatanBg:'#FFF8E1',
    desc:'Catatan refleksi dan dokumentasi kegiatan pembelajaran harian.',
    color:'jurnal'
  },
];

let materiCurrentDok = null;

function materiInit() {
  const saved = localStorage.getItem('materi_docs');
  if (saved) try { materiDocs = JSON.parse(saved); } catch(e){}
}

function materiKey() {
  const kelas = document.getElementById('mt-kelas').value;
  const mapel = document.getElementById('mt-mapel').value;
  const sem   = document.getElementById('mt-semester').value;
  return kelas + '_' + mapel + '_' + sem;
}

// Dipanggil saat ganti kelas/mapel — refresh tab aktif
function materiTabChanged() {
  const activeBtn = document.querySelector('#mt-tab-row .tab-btn.active');
  if (!activeBtn) { materiLoad(); return; }
  const idx = [...document.querySelectorAll('#mt-tab-row .tab-btn')].indexOf(activeBtn);
  const tabs = ['perangkat','jurnal','rekap'];
  const activeTab = tabs[idx] || 'perangkat';
  if (activeTab === 'perangkat') materiLoad();
  else if (activeTab === 'jurnal') mtJurnalLoad();
  else if (activeTab === 'rekap') mtRekapLoad();
}

// Tab switcher materi
function materiTab(tab, el) {
  ['perangkat','jurnal','rekap'].forEach(t => {
    document.getElementById('mt-tab-' + t).classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('#mt-tab-row .tab-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  if (tab === 'perangkat') materiLoad();
  else if (tab === 'jurnal') mtJurnalLoad();
  else if (tab === 'rekap') mtRekapLoad();
}

function materiLoad() {
  const kelas   = document.getElementById('mt-kelas').value;
  const mapel   = document.getElementById('mt-mapel').value;
  const sem     = document.getElementById('mt-semester').value;

  if (!kelas || !mapel) {
    document.getElementById('mt-dokumen-area').innerHTML = `
      <div class="empty-state"><div class="empty-icon">📚</div>
      <div>Pilih kelas dan mata pelajaran<br>untuk melihat perangkat ajar.</div></div>`;
    document.getElementById('mt-info-bar').style.display = 'none';
    return;
  }
  // Pastikan semester terpilih
  if (!sem) document.getElementById('mt-semester').value = 'Genap';

  // Info bar
  const semLabel = sem === 'Genap' ? 'Semester II (Genap)' : 'Semester I (Ganjil)';
  document.getElementById('mt-info-bar').style.display = 'flex';
  document.getElementById('mt-info-label').textContent = mapel + ' — ' + kelas;
  document.getElementById('mt-info-sub').textContent   = 'Tahun Pelajaran 2025/2026';
  document.getElementById('mt-info-sem').textContent   = semLabel;

  const key = materiKey();
  const docs = materiDocs[key] || {};

  // Hitung yang sudah ada
  const jumlahAda = DOKUMEN_CONFIG.filter(d => docs[d.key]?.ada).length;

  const html = `
    <div class="dokumen-section-title">
      📌 Daftar Isi Perangkat Ajar
      <span style="margin-left:auto;font-size:11px;background:#E8F5E9;color:#2E7D32;padding:2px 9px;border-radius:10px;font-weight:700;">${jumlahAda}/${DOKUMEN_CONFIG.length} tersedia</span>
    </div>
    <div class="dokumen-grid">
      ${DOKUMEN_CONFIG.map(function(d) {
        const dok = docs[d.key] || {};
        const ada = !!dok.ada;
        const tglInfo = (ada && dok.uploadedAt) ? '<div style="font-size:10px;color:#9E9E9E;margin-top:3px">📅 ' + dok.uploadedAt + '</div>' : '';
        const fileInfo = (ada && dok.filename) ? '<div style="font-size:10px;color:#2E7D32;margin-top:2px">📄 ' + dok.filename + '</div>' : '';
        const bukaBtn = (ada && dok.link) ? '<button class="btn-dok lihat" onclick="materiBukaLink(\'' + dok.link.replace(/'/g,"\'") + '\')">🔗 Buka</button>' : '';
        const statusHtml = ada
          ? '<span class="status-badge ada">✅ Ada</span><div class="dokumen-actions">' + bukaBtn + '<button class="btn-dok upload" onclick="materiOpenModal(\'' + d.key + '\',\'' + d.label.replace(/'/g,"\'") + '\')">🔄 Ganti</button></div>'
          : '<span class="status-badge buat">⬜ Belum</span><div class="dokumen-actions"><button class="btn-dok upload" onclick="materiOpenModal(\'' + d.key + '\',\'' + d.label.replace(/'/g,"\'") + '\')">⬆ Upload</button></div>';
        return '<div class="dokumen-card ' + d.color + '">'
          + '<div class="dokumen-icon-wrap ' + d.color + '">' + d.icon + '</div>'
          + '<div class="dokumen-info">'
          + '<div class="dokumen-title">' + d.label + '</div>'
          + '<span class="dokumen-singkatan" style="background:' + d.singkatanBg + ';color:' + d.singkatanColor + '">' + d.singkatan + '</span>'
          + '<div class="dokumen-desc">' + d.desc + '</div>'
          + tglInfo + fileInfo
          + '</div>'
          + '<div class="dokumen-status">' + statusHtml + '</div>'
          + '</div>';
      }).join('')}
    </div>
    <div style="background:#E3F2FD;border-radius:12px;padding:12px 14px;font-size:12px;color:#0D47A1;">
      💡 Upload file atau tempel link Google Drive untuk menyimpan dokumen perangkat ajar.
    </div>`;

  document.getElementById('mt-dokumen-area').innerHTML = html;
}

function materiOpenModal(dokKey, dokLabel) {
  materiCurrentDok = dokKey;
  document.getElementById('mt-modal-title').textContent = '⬆ Upload — ' + dokLabel;
  document.getElementById('mt-file-info').style.display = 'none';
  document.getElementById('mt-link-input').value = '';
  document.getElementById('mt-file-input').value = '';

  // Isi link yg sudah ada jika ada
  const key = materiKey();
  const existing = (materiDocs[key] || {})[dokKey];
  if (existing?.link) document.getElementById('mt-link-input').value = existing.link;

  document.getElementById('mt-modal').classList.remove('hidden');
}

function materiTutupModal() {
  document.getElementById('mt-modal').classList.add('hidden');
  materiCurrentDok = null;
}

function materiHandleFile(input) {
  const file = input.files[0];
  if (!file) return;
  const info = document.getElementById('mt-file-info');
  info.style.display = 'block';
  info.textContent = '📄 ' + file.name + ' (' + (file.size/1024).toFixed(1) + ' KB)';
  // Simpan nama file ke input untuk referensi
  input.dataset.filename = file.name;
}

function materiSimpanDok() {
  if (!materiCurrentDok) return;
  const key = materiKey();
  const link = document.getElementById('mt-link-input').value.trim();
  const fileInput = document.getElementById('mt-file-input');
  const filename = fileInput.dataset.filename || (fileInput.files[0]?.name) || '';

  if (!link && !filename) {
    showToast('Upload file atau masukkan link terlebih dahulu!', '#C62828');
    return;
  }

  if (!materiDocs[key]) materiDocs[key] = {};
  materiDocs[key][materiCurrentDok] = {
    ada: true,
    link: link || '',
    filename: filename || (link ? link.split('/').pop().slice(0,30) : ''),
    uploadedAt: new Date().toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'}),
  };

  // Simpan ke localStorage
  try { localStorage.setItem('materi_docs', JSON.stringify(materiDocs)); } catch(e){}

  materiTutupModal();
  materiLoad();
  showToast('✅ Dokumen berhasil disimpan!', '#2E7D32');
}

function materiSimpanLink() { materiSimpanDok(); }

function materiHapusDok(dokKey) {
  const key = materiKey();
  if (materiDocs[key]) {
    delete materiDocs[key][dokKey];
    try { localStorage.setItem('materi_docs', JSON.stringify(materiDocs)); } catch(e){}
    materiLoad();
    showToast('🗑 Dokumen dihapus.', '#F57F17');
  }
}

function materiHapusSemua() {
  const key = materiKey();
  if (!confirm('Hapus semua dokumen untuk kelas & mapel ini?')) return;
  delete materiDocs[key];
  try { localStorage.setItem('materi_docs', JSON.stringify(materiDocs)); } catch(e){}
  materiLoad();
  showToast('🗑 Semua dokumen dihapus.', '#F57F17');
}

function materiReset() {
  materiDocs = {};
  try { localStorage.removeItem('materi_docs'); } catch(e){}
  materiLoad();
}

function materiRekap() {
  let total = 0;
  Object.values(materiDocs).forEach(kd => { Object.values(kd).forEach(d => { if(d.ada) total++; }); });
  showToast('📚 Total dokumen tersimpan: ' + total, '#1565C0');
}

function materiBukaLink(link) {
  if (!link) { showToast('Tidak ada link!','#C62828'); return; }
  // buka di tab baru
  const a = document.createElement('a');
  a.href = link.startsWith('http') ? link : 'https://' + link;
  a.target = '_blank';
  a.rel = 'noopener';
  a.click();
}
function materiOpenLink(link) { materiBukaLink(link); }
function materiOpenFile(url) { window.open(url, '_blank'); }
function materiFilePreview(dokKey) {
  const key = materiKey();
  const dok = (materiDocs[key]||{})[dokKey];
  if (dok?.link) materiBukaLink(dok.link);
  else showToast('Tidak ada link atau file yang tersimpan.', '#F57F17');
}
function materiDownload(dokKey) { materiFilePreview(dokKey); }
function materiEditLink(dokKey, dokLabel) { materiOpenModal(dokKey, dokLabel); }

function materiSimpanLinkDirect(dokKey, dokLabel) {
  const link = prompt('Masukkan link Google Drive / URL dokumen ' + dokLabel + ':');
  if (!link) return;
  const key = materiKey();
  if (!materiDocs[key]) materiDocs[key] = {};
  if (!materiDocs[key][dokKey]) materiDocs[key][dokKey] = {};
  materiDocs[key][dokKey].ada = true;
  materiDocs[key][dokKey].link = link;
  materiDocs[key][dokKey].filename = link.split('/').pop().slice(0,40);
  materiDocs[key][dokKey].uploadedAt = new Date().toLocaleDateString('id-ID');
  try { localStorage.setItem('materi_docs', JSON.stringify(materiDocs)); } catch(e){}
  materiLoad();
  showToast('✅ Link berhasil disimpan!', '#2E7D32');
}

function materiStatusToggle(dokKey) {
  const key = materiKey();
  if (!materiDocs[key]) materiDocs[key] = {};
  const ada = !!(materiDocs[key][dokKey]?.ada);
  if (ada) {
    materiHapusDok(dokKey);
  } else {
    const cfg = DOKUMEN_CONFIG.find(d=>d.key===dokKey);
    materiOpenModal(dokKey, cfg?.label || dokKey);
  }
}

function materiViewDok(dokKey) {
  const key = materiKey();
  const dok = (materiDocs[key]||{})[dokKey];
  if (!dok?.link) { showToast('Tidak ada link dokumen!','#C62828'); return; }
  materiBukaLink(dok.link);
}

function materiViewOrUpload(dokKey, dokLabel, isAda) {
  if (isAda) { materiViewDok(dokKey); }
  else { materiOpenModal(dokKey, dokLabel); }
}

function materiTandaiAda(dokKey, dokLabel) {
  const key = materiKey();
  if (!materiDocs[key]) materiDocs[key] = {};
  materiDocs[key][dokKey] = {
    ada: true, link:'', filename:'(Ditandai tersedia)',
    uploadedAt: new Date().toLocaleDateString('id-ID'),
  };
  try { localStorage.setItem('materi_docs', JSON.stringify(materiDocs)); } catch(e){}
  materiLoad();
  showToast('✅ ' + dokLabel + ' ditandai tersedia!', '#2E7D32');
}

function materiHapusEntry(dokKey) {
  materiHapusDok(dokKey);
}

function materiOpenDoc(dokKey) {
  const key = materiKey();
  const dok = (materiDocs[key]||{})[dokKey];
  if (!dok) { showToast('Dokumen belum diupload.','#C62828'); return; }
  if (dok.link) materiBukaLink(dok.link);
  else showToast('Tidak ada link untuk dokumen ini.','#F57F17');
}

function materiDokCount() {
  const key = materiKey();
  const docs = materiDocs[key] || {};
  return DOKUMEN_CONFIG.filter(d => docs[d.key]?.ada).length;
}



// ============================================================
// ==================== JURNAL GURU ===========================
// ============================================================

let jurnalList = LS.get('jurnal_list', []);

// ============================================================
// ==================== JURNAL GURU ===========================
// ============================================================
// Data tunggal — dipakai oleh tab Jurnal di Materi DAN screen Jurnal

function jurnalTab(tab, el) {
  ['isi','riwayat'].forEach(t => {
    document.getElementById('jr-tab-' + t).classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('#screen-jurnal .tab-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  if (tab === 'riwayat') jurnalRender();
}

// Toggle textarea manual refleksi
function jurnalToggleRefleksi(prefix) {
  const sel = document.getElementById(prefix + '-refleksi');
  const txt = document.getElementById(prefix + '-refleksi-manual');
  if (!sel || !txt) return;
  txt.style.display = sel.value === '__manual__' ? 'block' : 'none';
  if (sel.value === '__manual__') txt.focus();
}

// Toggle textarea manual RTL
function jurnalToggleRTL(prefix) {
  const sel = document.getElementById(prefix + '-rtl-opsi');
  const txt = document.getElementById(prefix + '-catatan');
  if (!sel || !txt) return;
  if (sel.value === '__manual__') {
    txt.value = '';
    txt.focus();
  } else if (sel.value) {
    txt.value = sel.value;
  }
}

// Helper ambil nilai refleksi (dropdown atau manual)
function _getRefleksi(prefix) {
  const sel = document.getElementById(prefix + '-refleksi');
  const txt = document.getElementById(prefix + '-refleksi-manual');
  if (!sel) return '';
  if (sel.value === '__manual__') return txt ? txt.value.trim() : '';
  return sel.value;
}

function jurnalInit() {
  const d = new Date();
  const tglEl = document.getElementById('jr-tgl');
  if (tglEl) tglEl.value = d.toISOString().split('T')[0];
}

function jurnalLoad() { jurnalInit(); jurnalRender(); }

// ----- Helper render satu card jurnal -----
function _jurnalCardHtml(j, idx, showDel) {
  const tglFmt = j.tgl ? new Date(j.tgl).toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}) : '-';
  return '<div class="jurnal-card">'
    + '<div class="jurnal-card-header">'
    + '<span class="jurnal-tgl">📅 ' + tglFmt + '</span>'
    + '<div style="display:flex;gap:6px;align-items:center">'
    + '<span class="jurnal-kelas-badge">' + j.kelas + '</span>'
    + (showDel ? '<button onclick="jurnalHapus(\''+j.id+'\')" style="background:#FFEBEE;color:#C62828;border:none;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer">🗑</button>' : '')
    + '</div></div>'
    + '<div class="jurnal-mapel">' + (j.mapel||'—') + ' — ' + (j.jam||'') + '</div>'
    + (j.materi    ? '<div class="jurnal-materi"><strong>Materi:</strong> '   + j.materi    + '</div>' : '')
    + (j.kegiatan  ? '<div class="jurnal-materi" style="margin-top:3px"><strong>Kegiatan:</strong> ' + j.kegiatan + '</div>' : '')
    + '<div class="jurnal-meta-row">'
    + '<span class="jurnal-meta-pill jp-hadir">H: ' + j.hadir.H + '</span>'
    + '<span class="jurnal-meta-pill jp-izin">I: '  + j.hadir.I + '</span>'
    + '<span class="jurnal-meta-pill jp-sakit">S: ' + j.hadir.S + '</span>'
    + '<span class="jurnal-meta-pill jp-alfa">A: '  + j.hadir.A + '</span>'
    + (j.refleksi ? '<span class="jurnal-meta-pill jp-refleksi">' + j.refleksi + '</span>' : '')
    + '</div>'
    + (j.catatan ? '<div style="font-size:11px;color:#757575;margin-top:6px;padding-top:6px;border-top:1px solid #F5F5F5">📝 ' + j.catatan + '</div>' : '')
    + '</div>';
}

// ----- Jurnal screen lama: tampilkan SEMUA lintas kelas -----
function jurnalRender() {
  const el = document.getElementById('jurnal-list');
  if (!el) return;
  const fKelas = (document.getElementById('jr-filter-kelas') || {}).value || '';
  const fMapel = (document.getElementById('jr-filter-mapel') || {}).value || '';
  let list = jurnalList;
  if (fKelas) list = list.filter(j => j.kelas === fKelas);
  if (fMapel) list = list.filter(j => j.mapel === fMapel);
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📓</div><div>Belum ada jurnal' + (fKelas||fMapel ? ' yang sesuai filter' : ' tersimpan') + '.</div></div>';
    return;
  }
  el.innerHTML = list.slice(0,30).map((j,i) => _jurnalCardHtml(j, i, true)).join('');
}

// ----- Simpan jurnal dari screen Jurnal -----
function jurnalSimpan() {
  const tgl      = document.getElementById('jr-tgl').value;
  const kelas    = document.getElementById('jr-kelas').value;
  const mapel    = document.getElementById('jr-mapel').value;
  const jam      = document.getElementById('jr-jam').value;
  const materi   = document.getElementById('jr-materi').value.trim();
  const kegiatan = document.getElementById('jr-kegiatan').value.trim();
  const h = parseInt(document.getElementById('jr-h').value)||0;
  const i = parseInt(document.getElementById('jr-i').value)||0;
  const s = parseInt(document.getElementById('jr-s').value)||0;
  const a = parseInt(document.getElementById('jr-a').value)||0;
  const refleksi = _getRefleksi('jr');
  const catatan  = document.getElementById('jr-catatan').value.trim();

  if (!tgl || !kelas) { showToast('Tanggal dan kelas wajib diisi!','#C62828'); return; }

  _jurnalPush({ tgl, kelas, mapel, jam, materi, kegiatan, hadir:{H:h,I:i,S:s,A:a}, refleksi, catatan });

  // Reset konten form, tapi pertahankan kelas & tanggal
  ['jr-materi','jr-kegiatan'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  ['jr-h','jr-i','jr-s','jr-a'].forEach(id => { const el=document.getElementById(id); if(el) el.value='0'; });
  document.getElementById('jr-refleksi').value = '';
  document.getElementById('jr-refleksi-manual').style.display = 'none';
  document.getElementById('jr-refleksi-manual').value = '';
  document.getElementById('jr-rtl-opsi').value = '';
  document.getElementById('jr-catatan').value = '';

  showToast('✅ Jurnal berhasil disimpan!','#2E7D32');

  // Auto pindah ke tab riwayat setelah simpan
  setTimeout(() => {
    const riwayatBtn = document.querySelectorAll('#screen-jurnal .tab-btn')[1];
    if (riwayatBtn) riwayatBtn.click();
  }, 800);
}

// ----- Simpan jurnal dari TAB JURNAL di Materi (kelas+mapel otomatis) -----
function jurnalSimpanFromMateri() {
  const kelas    = document.getElementById('mt-kelas').value;
  const mapel    = document.getElementById('mt-mapel').value;
  const tgl      = document.getElementById('mt-jr-tgl').value;
  const jam      = document.getElementById('mt-jr-jam').value;
  const materi   = document.getElementById('mt-jr-materi').value.trim();
  const kegiatan = document.getElementById('mt-jr-kegiatan').value.trim();
  const h = parseInt(document.getElementById('mt-jr-h').value)||0;
  const i = parseInt(document.getElementById('mt-jr-i').value)||0;
  const s = parseInt(document.getElementById('mt-jr-s').value)||0;
  const a = parseInt(document.getElementById('mt-jr-a').value)||0;
  const refleksi = _getRefleksi('mt-jr');
  const catatan  = document.getElementById('mt-jr-catatan').value.trim();

  if (!tgl) { showToast('Tanggal wajib diisi!','#C62828'); return; }

  _jurnalPush({ tgl, kelas, mapel, jam, materi, kegiatan, hadir:{H:h,I:i,S:s,A:a}, refleksi, catatan });

  // Reset hanya field konten, bukan kelas/mapel
  ['mt-jr-materi','mt-jr-kegiatan'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value='';
  });
  ['mt-jr-h','mt-jr-i','mt-jr-s','mt-jr-a'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value='0';
  });
  const ref = document.getElementById('mt-jr-refleksi'); if (ref) ref.value='';
  const refM = document.getElementById('mt-jr-refleksi-manual');
  if (refM) { refM.value=''; refM.style.display='none'; }
  const rtl = document.getElementById('mt-jr-rtl-opsi'); if (rtl) rtl.value='';
  const cat = document.getElementById('mt-jr-catatan'); if (cat) cat.value='';

  showToast('✅ Jurnal ' + kelas + ' – ' + mapel + ' tersimpan!','#2E7D32');
  mtJurnalRenderList();
}

// ----- Helper push jurnal ke list -----
function _jurnalPush(data) {
  jurnalList.unshift({ id: Date.now(), ...data, savedAt: new Date().toLocaleString('id-ID') });
  LS.set('jurnal_list', jurnalList);
}

// ----- Load tab Jurnal di Materi -----
function mtJurnalLoad() {
  const kelas = document.getElementById('mt-kelas').value;
  const mapel = document.getElementById('mt-mapel').value;
  const hasCtx = kelas && mapel;

  // Tampilkan/sembunyikan elemen
  const konteksEl = document.getElementById('mt-jr-konteks');
  const promptEl  = document.getElementById('mt-jr-empty-prompt');
  const formEl    = document.getElementById('mt-jr-form');

  if (konteksEl) konteksEl.style.display = hasCtx ? 'block' : 'none';
  if (promptEl)  promptEl.style.display  = hasCtx ? 'none'  : 'block';
  if (formEl)    formEl.style.display    = hasCtx ? 'block' : 'none';

  if (!hasCtx) return;

  // Isi label konteks
  const lblEl = document.getElementById('mt-jr-konteks-label');
  if (lblEl) lblEl.textContent = kelas + ' — ' + mapel;

  // Set tanggal hari ini
  const tglEl = document.getElementById('mt-jr-tgl');
  if (tglEl && !tglEl.value) tglEl.value = new Date().toISOString().split('T')[0];

  // Render riwayat jurnal untuk kelas+mapel ini
  mtJurnalRenderList();
}

// ----- Render list jurnal khusus kelas+mapel aktif -----
function mtJurnalRenderList() {
  const el    = document.getElementById('mt-jr-list');
  const kelas = document.getElementById('mt-kelas').value;
  const mapel = document.getElementById('mt-mapel').value;
  if (!el) return;

  const filtered = jurnalList.filter(j => j.kelas === kelas && j.mapel === mapel);
  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state" style="padding:20px 0"><div class="empty-icon">📓</div><div>Belum ada jurnal untuk ' + kelas + ' – ' + mapel + '.</div></div>';
    return;
  }
  el.innerHTML = filtered.slice(0,20).map((j,i) => _jurnalCardHtml(j, i, true)).join('');
}

// ----- Load tab Rekap di Materi -----
function mtRekapLoad() {
  const el    = document.getElementById('mt-rekap-content');
  const kelas = document.getElementById('mt-kelas').value;
  const mapel = document.getElementById('mt-mapel').value;
  if (!el) return;

  if (!kelas || !mapel) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div>Pilih kelas dan mata pelajaran<br>untuk melihat rekap jurnal.</div></div>';
    return;
  }

  const filtered = jurnalList.filter(j => j.kelas === kelas && j.mapel === mapel);
  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div>Belum ada jurnal untuk<br>' + kelas + ' – ' + mapel + '.</div></div>';
    return;
  }

  // Hitung statistik
  const totH = filtered.reduce((s,j) => s + (j.hadir.H||0), 0);
  const totA = filtered.reduce((s,j) => s + (j.hadir.A||0), 0);
  const totI = filtered.reduce((s,j) => s + (j.hadir.I||0), 0);
  const totS = filtered.reduce((s,j) => s + (j.hadir.S||0), 0);
  const pertemuan = filtered.length;

  // Refleksi terbanyak
  const reflCounts = {};
  filtered.forEach(j => { if (j.refleksi) reflCounts[j.refleksi] = (reflCounts[j.refleksi]||0)+1; });
  const topRefl = Object.entries(reflCounts).sort((a,b)=>b[1]-a[1])[0];

  // Grup per bulan
  const perBulan = {};
  filtered.forEach(j => {
    const bln = j.tgl ? j.tgl.substring(0,7) : 'Lainnya';
    if (!perBulan[bln]) perBulan[bln] = [];
    perBulan[bln].push(j);
  });

  let html = `
  <div class="card" style="margin-bottom:12px">
    <div class="card-title">📊 Rekap Jurnal — ${kelas} · ${mapel}</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px">
      <div style="background:#E8F5E9;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#1B5E20">${pertemuan}</div>
        <div style="font-size:11px;color:#2E7D32;font-weight:600">Pertemuan</div>
      </div>
      <div style="background:#E3F2FD;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#1565C0">${totH}</div>
        <div style="font-size:11px;color:#1565C0;font-weight:600">Total Hadir</div>
      </div>
      <div style="background:#FFF8E1;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#E65100">${totI}</div>
        <div style="font-size:11px;color:#E65100;font-weight:600">Total Izin</div>
      </div>
      <div style="background:#FFEBEE;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#C62828">${totA}</div>
        <div style="font-size:11px;color:#C62828;font-weight:600">Total Alpha</div>
      </div>
    </div>
    ${topRefl ? `<div style="font-size:12px;color:#616161">Refleksi terbanyak: <strong>${topRefl[0]}</strong> (${topRefl[1]}x)</div>` : ''}
  </div>
  <button onclick="jurnalExportFiltered()" style="width:100%;margin-bottom:12px;padding:12px;background:#E3F2FD;color:#1565C0;border:1.5px solid #90CAF9;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">
    ⬇ Export Excel — ${kelas} · ${mapel}
  </button>`;

  // Timeline per bulan
  Object.entries(perBulan).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([bln, items]) => {
    const blnFmt = bln !== 'Lainnya'
      ? new Date(bln+'-01').toLocaleDateString('id-ID',{month:'long',year:'numeric'})
      : 'Lainnya';
    html += `<div style="font-size:12px;font-weight:700;color:#616161;margin:12px 0 8px;display:flex;align-items:center;gap:8px">
      <span style="flex:1;height:1px;background:#E0E0E0"></span>
      📅 ${blnFmt} · ${items.length} pertemuan
      <span style="flex:1;height:1px;background:#E0E0E0"></span>
    </div>`;
    html += items.map((j,i) => _jurnalCardHtml(j, i, false)).join('');
  });

  el.innerHTML = html;
}

// ----- Export jurnal khusus kelas+mapel aktif -----
function jurnalExportFiltered() {
  const kelas = document.getElementById('mt-kelas')?.value || '';
  const mapel = document.getElementById('mt-mapel')?.value || '';
  const list  = kelas && mapel
    ? jurnalList.filter(j => j.kelas === kelas && j.mapel === mapel)
    : jurnalList;

  if (!list.length) { showToast('Tidak ada jurnal untuk diexport!','#C62828'); return; }
  const wb     = XLSX.utils.book_new();
  const header = ['Tanggal','Kelas','Mata Pelajaran','Jam','Materi/TP','Kegiatan','Hadir','Izin','Sakit','Alpha','Refleksi','Catatan/RTL'];
  const rows   = list.map(j => [
    j.tgl, j.kelas, j.mapel||'-', j.jam, j.materi||'-', j.kegiatan||'-',
    j.hadir.H, j.hadir.I, j.hadir.S, j.hadir.A, j.refleksi||'-', j.catatan||'-'
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header,...rows]);
  ws['!cols'] = [{wch:14},{wch:10},{wch:20},{wch:8},{wch:30},{wch:30},{wch:7},{wch:7},{wch:7},{wch:7},{wch:26},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Guru');
  const fname = kelas && mapel
    ? 'Jurnal_' + kelas.replace(' ','') + '_' + mapel.replace(/ /g,'_') + '.xlsx'
    : 'JurnalGuru_SDN3Kalipang.xlsx';
  XLSX.writeFile(wb, fname);
  showToast('✅ Jurnal berhasil diexport!','#2E7D32');
}

// ----- Export semua jurnal (screen jurnal lama) -----
function jurnalExport() {
  if (!jurnalList.length) { showToast('Tidak ada jurnal untuk diexport!','#C62828'); return; }
  const wb     = XLSX.utils.book_new();
  const header = ['Tanggal','Kelas','Mata Pelajaran','Jam','Materi/TP','Kegiatan','Hadir','Izin','Sakit','Alpha','Refleksi','Catatan/RTL'];
  const rows   = jurnalList.map(j => [
    j.tgl, j.kelas, j.mapel||'-', j.jam, j.materi||'-', j.kegiatan||'-',
    j.hadir.H, j.hadir.I, j.hadir.S, j.hadir.A, j.refleksi||'-', j.catatan||'-'
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header,...rows]);
  ws['!cols'] = [{wch:14},{wch:10},{wch:20},{wch:8},{wch:30},{wch:30},{wch:7},{wch:7},{wch:7},{wch:7},{wch:26},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Guru');
  XLSX.writeFile(wb, 'JurnalGuru_SDN3Kalipang.xlsx');
  showToast('✅ Jurnal berhasil diexport!','#2E7D32');
}

function jurnalHapus(id) {
  if (!confirm('Hapus jurnal ini?')) return;
  jurnalList = jurnalList.filter(j => String(j.id) !== String(id));
  LS.set('jurnal_list', jurnalList);
  jurnalRender();
  mtJurnalRenderList();
  showToast('🗑 Jurnal dihapus.','#F57F17');
}

function jurnalHapusSemua() {
  if (!confirm('Hapus semua jurnal?')) return;
  jurnalList = [];
  LS.set('jurnal_list', jurnalList);
  jurnalRender();
  showToast('🗑 Semua jurnal dihapus.','#F57F17');
}


// ============================================================
// ==================== REKAP ABSENSI =========================
// ============================================================

function rekapLoad() {
  const kelasFilter = document.getElementById('rk-kelas').value;
  const bulanFilter = document.getElementById('rk-bulan').value;

  // Kumpulkan semua entry dari absenHistory
  const entries = [];
  Object.entries(absenHistory).forEach(([tgl, kelasMap]) => {
    if (bulanFilter) {
      const tglMonth = tgl.split('-')[1];
      if (tglMonth !== bulanFilter) return;
    }
    Object.values(kelasMap).forEach(e => {
      if (kelasFilter && e.kelas !== kelasFilter) return;
      entries.push({...e, tgl});
    });
  });

  // Hitung total
  let totH=0, totI=0, totS=0, totA=0;
  entries.forEach(e => { totH+=e.counts.H; totI+=e.counts.I; totS+=e.counts.S; totA+=e.counts.A; });
  document.getElementById('rk-tot-h').textContent = totH;
  document.getElementById('rk-tot-i').textContent = totI;
  document.getElementById('rk-tot-s').textContent = totS;
  document.getElementById('rk-tot-a').textContent = totA;

  const el = document.getElementById('rekap-content');
  if (!entries.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div>Belum ada data absensi.<br><small>Simpan absensi di menu Absensi Kelas terlebih dahulu.</small></div></div>';
    return;
  }

  // Tampilkan per tanggal
  const byDate = {};
  entries.sort((a,b)=>b.tgl.localeCompare(a.tgl)).forEach(e => {
    if (!byDate[e.tgl]) byDate[e.tgl] = [];
    byDate[e.tgl].push(e);
  });

  const rows = Object.entries(byDate).slice(0,30).map(([tgl, list]) => {
    const tglFmt = new Date(tgl).toLocaleDateString('id-ID',{weekday:'short',day:'2-digit',month:'short'});
    const items = list.map(e =>
      '<div style="display:grid;grid-template-columns:1fr 36px 36px 36px 36px;gap:4px;padding:8px 0;border-bottom:1px solid #F5F5F5;align-items:center;font-size:12px">'
      + '<div><div style="font-weight:600;color:#212121">'+e.kelas+'</div><div style="font-size:10px;color:#9E9E9E">'+e.mapel+' — '+e.jam+'</div></div>'
      + '<div style="text-align:center;font-weight:700;color:#2E7D32">'+e.counts.H+'</div>'
      + '<div style="text-align:center;font-weight:700;color:#F57F17">'+e.counts.I+'</div>'
      + '<div style="text-align:center;font-weight:700;color:#1565C0">'+e.counts.S+'</div>'
      + '<div style="text-align:center;font-weight:700;color:#C62828">'+e.counts.A+'</div>'
      + '</div>'
    ).join('');

    return '<div class="rekap-list-wrap" style="margin-bottom:10px">'
      + '<div style="padding:10px 12px;background:#F5F5F5;font-size:12px;font-weight:700;color:#424242;display:flex;justify-content:space-between">'
      + '<span>📅 '+tglFmt+'</span>'
      + '<span style="font-size:11px;font-weight:600;color:#9E9E9E">'+list.length+' sesi</span>'
      + '</div>'
      + '<div style="padding:0 12px">'
      + '<div style="display:grid;grid-template-columns:1fr 36px 36px 36px 36px;gap:4px;padding:6px 0;font-size:10px;font-weight:700;color:#9E9E9E">'
      + '<div>Kelas</div><div style="text-align:center;color:#2E7D32">H</div><div style="text-align:center;color:#F57F17">I</div><div style="text-align:center;color:#1565C0">S</div><div style="text-align:center;color:#C62828">A</div>'
      + '</div>'
      + items
      + '</div></div>';
  }).join('');

  const exportBtn = '<button onclick="rekapExport()" style="width:100%;padding:12px;background:#E3F2FD;color:#1565C0;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-top:4px">⬇ Export Rekap ke Excel</button>';
  el.innerHTML = rows + exportBtn;
}

function rekapExport() {
  const entries = [];
  Object.entries(absenHistory).forEach(([tgl, kelasMap]) => {
    Object.values(kelasMap).forEach(e => entries.push({...e, tgl}));
  });
  if (!entries.length) { showToast('Tidak ada data absensi!','#C62828'); return; }

  const wb = XLSX.utils.book_new();
  const header = ['Tanggal','Kelas','Mata Pelajaran','Jam','Hadir','Izin','Sakit','Alfa','Total'];
  const rows = entries.sort((a,b)=>b.tgl.localeCompare(a.tgl)).map(e => {
    const tot = e.counts.H+e.counts.I+e.counts.S+e.counts.A;
    return [e.tgl, e.kelas, e.mapel||'-', e.jam||'-', e.counts.H, e.counts.I, e.counts.S, e.counts.A, tot];
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [{wch:12},{wch:10},{wch:20},{wch:8},{wch:8},{wch:8},{wch:8},{wch:8},{wch:8}];
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');
  XLSX.writeFile(wb, 'RekapAbsensi_SDN3Kalipang.xlsx');
  showToast('✅ Rekap absensi diexport!', '#2E7D32');
}


// ============================================================
// ==================== PERPUSTAKAAN ==========================
// ============================================================
// Struktur: { id, judul, penulis, kategori, mapel (''/PJOK/PAIBP),
//             kelas (''/1-6), link, coverUrl, deskripsi, addedBy, addedAt }
const _perpusDemoDefault = [
  { id:'p1',  judul:'Buku Teks B. Indonesia Kelas 1', penulis:'Kemendikbud', kategori:'Pelajaran', mapel:'',     kelas:'1', link:'https://buku.kemdikbud.go.id', coverUrl:'', deskripsi:'Buku Bahasa Indonesia Kelas 1 Kurikulum Merdeka.', addedBy:'admin', addedAt:'2026-01-10' },
  { id:'p2',  judul:'Matematika Kelas 1',             penulis:'Kemendikbud', kategori:'Pelajaran', mapel:'',     kelas:'1', link:'https://buku.kemdikbud.go.id', coverUrl:'', deskripsi:'Buku Matematika Kelas 1 Kurikulum Merdeka.',        addedBy:'admin', addedAt:'2026-01-10' },
  { id:'p3',  judul:'IPAS Kelas 4',                   penulis:'Kemendikbud', kategori:'Pelajaran', mapel:'',     kelas:'4', link:'https://buku.kemdikbud.go.id', coverUrl:'', deskripsi:'Ilmu Pengetahuan Alam dan Sosial Kelas 4.',         addedBy:'admin', addedAt:'2026-01-15' },
  { id:'p4',  judul:'Video: Sistem Tata Surya',        penulis:'Ruangguru',   kategori:'Video',     mapel:'',     kelas:'4', link:'https://youtube.com',          coverUrl:'', deskripsi:'Penjelasan tata surya untuk kelas 4 SD.',           addedBy:'guru1', addedAt:'2026-02-01' },
  { id:'p5',  judul:'B. Indonesia Kelas 5',            penulis:'Kemendikbud', kategori:'Pelajaran', mapel:'',     kelas:'5', link:'https://buku.kemdikbud.go.id', coverUrl:'', deskripsi:'Buku Bahasa Indonesia Kelas 5.',                   addedBy:'admin', addedAt:'2026-01-15' },
  { id:'p6',  judul:'Gerak Dasar Lokomotor',           penulis:'Kemendikbud', kategori:'Pelajaran', mapel:'PJOK', kelas:'1', link:'https://buku.kemdikbud.go.id', coverUrl:'', deskripsi:'Materi PJOK gerak dasar kelas 1.',                 addedBy:'admin', addedAt:'2026-02-10' },
  { id:'p7',  judul:'Permainan Bola Besar',            penulis:'Kemendikbud', kategori:'Pelajaran', mapel:'PJOK', kelas:'4', link:'https://buku.kemdikbud.go.id', coverUrl:'', deskripsi:'Materi PJOK permainan bola besar kelas 4.',         addedBy:'admin', addedAt:'2026-02-10' },
  { id:'p8',  judul:'Video: Senam Lantai',             penulis:'Guru Penjas', kategori:'Video',     mapel:'PJOK', kelas:'',  link:'https://youtube.com',          coverUrl:'', deskripsi:'Video tutorial senam lantai untuk semua kelas.',   addedBy:'guru1', addedAt:'2026-03-01' },
  { id:'p9',  judul:'Al-Quran Hadis Kelas 1',          penulis:'Kemenag',     kategori:'Pelajaran', mapel:'PAIBP',kelas:'1', link:'https://buku.kemdikbud.go.id', coverUrl:'', deskripsi:'Buku PAI Kelas 1 Kurikulum Merdeka.',               addedBy:'admin', addedAt:'2026-02-15' },
  { id:'p10', judul:'Akidah Akhlak Kelas 4',           penulis:'Kemenag',     kategori:'Pelajaran', mapel:'PAIBP',kelas:'4', link:'https://buku.kemdikbud.go.id', coverUrl:'', deskripsi:'Materi Akidah Akhlak kelas 4.',                     addedBy:'admin', addedAt:'2026-02-15' },
  { id:'p11', judul:'Video: Tata Cara Sholat',         penulis:'Kemenag',     kategori:'Video',     mapel:'PAIBP',kelas:'',  link:'https://youtube.com',          coverUrl:'', deskripsi:'Panduan sholat 5 waktu untuk semua kelas.',         addedBy:'admin', addedAt:'2026-03-05' },
  { id:'p12', judul:'Laskar Pelangi',                  penulis:'Andrea Hirata',kategori:'Fiksi',    mapel:'',     kelas:'',  link:'https://drive.google.com',     coverUrl:'', deskripsi:'Novel inspiratif tentang semangat belajar.',        addedBy:'admin', addedAt:'2026-01-20' },
  { id:'p13', judul:'Ensiklopedia Hewan Nusantara',    penulis:'LIPI',        kategori:'Referensi', mapel:'',     kelas:'',  link:'https://lipi.go.id',           coverUrl:'', deskripsi:'Fauna asli Indonesia.',                             addedBy:'admin', addedAt:'2026-03-05' },
  { id:'p14', judul:'Portal Rumah Belajar',            penulis:'Kemendikbud', kategori:'Link Edukasi',mapel:'',  kelas:'',  link:'https://belajar.kemdikbud.go.id',coverUrl:'',deskripsi:'Platform belajar resmi pemerintah.',               addedBy:'admin', addedAt:'2026-03-10' },
  { id:'p15', judul:'Batik Nusantara',                 penulis:'Museum Batik',kategori:'Seni & Budaya',mapel:'', kelas:'',  link:'https://kemdikbud.go.id',      coverUrl:'', deskripsi:'Warisan budaya batik dari berbagai daerah.',        addedBy:'admin', addedAt:'2026-03-20' },
];
let perpusData = LS.get('perpus_data', _perpusDemoDefault);

const perpusKatIcon = {
  'Pelajaran':'📚','Fiksi':'📖','Video':'🎥',
  'Link Edukasi':'🌐','Referensi':'🔬','Seni & Budaya':'🎨',
};
const perpusKatColor = {
  'Pelajaran'   :{ bg:'#E8F5E9', clr:'#1B5E20' },
  'Fiksi'       :{ bg:'#FFF8E1', clr:'#E65100' },
  'Video'       :{ bg:'#FCE4EC', clr:'#880E4F' },
  'Link Edukasi':{ bg:'#E3F2FD', clr:'#0D47A1' },
  'Referensi'   :{ bg:'#EDE7F6', clr:'#4527A0' },
  'Seni & Budaya':{ bg:'#FBE9E7', clr:'#BF360C' },
};
const perpusKlsColor = ['','#E3F2FD','#E8F5E9','#FFF8E1','#FFF3E0','#FCE4EC','#EDE7F6'];
const perpusKlsClr   = ['','#1565C0','#2E7D32','#E65100','#E64A19','#880E4F','#4527A0'];

let _perpusCurKat = 'semua';

// --- Toggle hint kelas ---
function perpusToggleKelas() {
  const mapel  = (document.getElementById('perpus-mapel') || {}).value || '';
  const hintEl = document.getElementById('perpus-kelas-hint');
  if (hintEl) hintEl.textContent = mapel
    ? '💡 Pilih kelas tertentu, atau biarkan "Semua Kelas" agar masuk semua rak ' + mapel
    : '💡 Kosongkan jika berlaku untuk semua kelas (masuk rak Umum)';
}

// --- Tab navigation ---
function perpusTab(tab, el) {
  ['rak','cari','tambah'].forEach(t => {
    document.getElementById('perpus-tab-' + t).classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('#screen-perpustakaan .tab-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  if (tab === 'rak')    perpusRenderRak();
  if (tab === 'cari')   { document.getElementById('perpus-search-input').value=''; perpusCari(''); }
  if (tab === 'tambah') perpusBatalEdit();
}

// --- Helper: render card buku ---
function _perpusCardHtml(b) {
  const icon = perpusKatIcon[b.kategori] || '📄';
  const c    = perpusKatColor[b.kategori] || { bg:'#F5F5F5', clr:'#424242' };
  const canEdit = sessionUser && ['admin','kepsek','guru'].includes(sessionUser.role);

  const coverHtml = b.coverUrl
    ? `<img src="${b.coverUrl}" style="width:100%;height:90px;object-fit:cover;border-radius:10px 10px 0 0"
         onerror="this.style.display='none';this.nextSibling.style.display='flex'"/>
       <div style="display:none;height:90px;background:${c.bg};border-radius:10px 10px 0 0;align-items:center;justify-content:center;font-size:36px">${icon}</div>`
    : `<div style="height:90px;background:${c.bg};border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:center;font-size:36px">${icon}</div>`;

  const mapelBadge = b.mapel
    ? `<div class="perpus-type-badge ${b.mapel==='PJOK'?'pjok':'paibp'}">${b.mapel==='PJOK'?'🏃':'📖'} ${b.mapel}</div>` : '';
  const kelasBadge = b.kelas
    ? `<div class="perpus-kelas-badge">Kls ${b.kelas}</div>` : '';

  return `<div class="perpus-card" onclick="perpusBuka('${b.id}')">
    ${coverHtml}
    <div class="perpus-card-body">
      <div class="perpus-card-judul">${b.judul}</div>
      <div class="perpus-card-penulis">${b.penulis||'—'}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${kelasBadge}${mapelBadge}</div>
    </div>
    ${canEdit ? `<div class="perpus-card-actions" onclick="event.stopPropagation()">
      <button onclick="perpusEdit('${b.id}')" class="perpus-act-btn edit">✏️ Edit</button>
      <button onclick="perpusHapus('${b.id}')" class="perpus-act-btn del">🗑</button>
    </div>` : ''}
  </div>`;
}

// --- Helper: render satu rak section ---
function _perpusRakSection(title, icon, clr, items, groupByKelas) {
  if (!items.length) return '';
  let cardsHtml = '';
  if (groupByKelas) {
    ['1','2','3','4','5','6',''].forEach(k => {
      const sub = items.filter(b => b.kelas === k);
      if (!sub.length) return;
      const kLabel = k ? 'Kelas ' + k : 'Semua Kelas';
      const kBg  = k ? perpusKlsColor[parseInt(k)] : '#F5F5F5';
      const kClr = k ? perpusKlsClr[parseInt(k)]   : '#616161';
      cardsHtml += `<div style="margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:${kClr};background:${kBg};display:inline-block;border-radius:6px;padding:2px 9px;margin-bottom:6px">${kLabel}</div>
        <div class="perpus-card-scroll">${sub.map(b => _perpusCardHtml(b)).join('')}</div>
      </div>`;
    });
  } else {
    cardsHtml = `<div class="perpus-card-scroll">${items.map(b => _perpusCardHtml(b)).join('')}</div>`;
  }
  return `<div class="perpus-rak-section">
    <div class="perpus-rak-header">
      <span style="font-size:18px">${icon}</span>
      <span class="perpus-rak-title" style="color:${clr}">${title}</span>
      <span class="perpus-rak-count">${items.length}</span>
    </div>${cardsHtml}
  </div>`;
}

// --- Render rak utama ---
function perpusRenderRak() {
  const el = document.getElementById('perpus-rak-content');
  if (!el) return;
  const kat = _perpusCurKat;
  let html  = '';

  if (kat === 'semua') {
    // Blok kelas
    const klsItems = perpusData.filter(b => b.kelas && !b.mapel);
    if (klsItems.length) {
      html += `<div class="perpus-group-title">🏫 Koleksi Per Kelas</div>`;
      ['1','2','3','4','5','6'].forEach(k => {
        const sub = klsItems.filter(b => b.kelas === k);
        if (!sub.length) return;
        const bg  = perpusKlsColor[parseInt(k)];
        const clr = perpusKlsClr[parseInt(k)];
        const katUrutan = ['Pelajaran','Fiksi','Video','Link Edukasi','Referensi','Seni & Budaya'];
        let subHtml = '';
        katUrutan.forEach(kt => {
          const s2 = sub.filter(b => b.kategori === kt);
          if (!s2.length) return;
          subHtml += _perpusRakSection(kt, perpusKatIcon[kt]||'📄', (perpusKatColor[kt]||{}).clr||'#424242', s2, false);
        });
        html += `<div class="perpus-kelas-block" style="border-left:4px solid ${clr};padding-left:10px;margin-bottom:18px">
          <div style="font-size:13px;font-weight:800;color:${clr};background:${bg};display:inline-flex;align-items:center;gap:6px;border-radius:8px;padding:4px 12px;margin-bottom:10px">
            <span style="font-size:16px;font-weight:800">${k}</span> Kelas ${k}
            <span style="font-size:11px;font-weight:600;opacity:.7">${sub.length} koleksi</span>
          </div>${subHtml}</div>`;
      });
    }
    // Blok PJOK
    const pjok = perpusData.filter(b => b.mapel === 'PJOK');
    if (pjok.length) {
      html += `<div class="perpus-group-title" style="background:#E3F2FD;color:#0D47A1">🏃 PJOK</div>`;
      html += _perpusRakSection('PJOK', '🏃', '#0D47A1', pjok, true);
    }
    // Blok PAIBP
    const paibp = perpusData.filter(b => b.mapel === 'PAIBP');
    if (paibp.length) {
      html += `<div class="perpus-group-title" style="background:#E8F5E9;color:#1B5E20">📖 PAIBP</div>`;
      html += _perpusRakSection('PAIBP', '📖', '#1B5E20', paibp, true);
    }
    // Blok Umum
    const umum = perpusData.filter(b => !b.kelas && !b.mapel);
    if (umum.length) {
      html += `<div class="perpus-group-title">🌐 Koleksi Umum</div>`;
      ['Pelajaran','Fiksi','Video','Link Edukasi','Referensi','Seni & Budaya'].forEach(kt => {
        const sub = umum.filter(b => b.kategori === kt);
        if (!sub.length) return;
        html += _perpusRakSection(kt, perpusKatIcon[kt]||'📄', (perpusKatColor[kt]||{}).clr||'#424242', sub, false);
      });
    }
    if (!html) html = '<div class="empty-state"><div class="empty-icon">📚</div><div>Belum ada koleksi.</div></div>';

  } else if (kat.startsWith('kelas_')) {
    const k   = kat.replace('kelas_','');
    const clr = perpusKlsClr[parseInt(k)];
    const bg  = perpusKlsColor[parseInt(k)];
    const list = perpusData.filter(b => b.kelas === k && !b.mapel);
    html += `<div class="perpus-kelas-block" style="border-left:4px solid ${clr};padding-left:10px">
      <div style="font-size:13px;font-weight:800;color:${clr};background:${bg};display:inline-flex;align-items:center;gap:6px;border-radius:8px;padding:4px 12px;margin-bottom:10px">
        <span style="font-size:16px;font-weight:800">${k}</span> Kelas ${k}
        <span style="font-size:11px;font-weight:600;opacity:.7">${list.length} koleksi</span>
      </div>`;
    if (!list.length) {
      html += '<div class="empty-state"><div class="empty-icon">📚</div><div>Belum ada koleksi untuk kelas ini.</div></div>';
    } else {
      ['Pelajaran','Fiksi','Video','Link Edukasi','Referensi','Seni & Budaya'].forEach(kt => {
        const sub = list.filter(b => b.kategori === kt);
        if (!sub.length) return;
        html += _perpusRakSection(kt, perpusKatIcon[kt]||'📄', (perpusKatColor[kt]||{}).clr||'#424242', sub, false);
      });
    }
    html += '</div>';

  } else if (kat === 'PJOK' || kat === 'PAIBP') {
    const icon = kat==='PJOK'?'🏃':'📖';
    const clr  = kat==='PJOK'?'#0D47A1':'#1B5E20';
    const bg   = kat==='PJOK'?'#E3F2FD':'#E8F5E9';
    const list = perpusData.filter(b => b.mapel === kat);
    html += `<div class="perpus-group-title" style="background:${bg};color:${clr}">${icon} ${kat}</div>`;
    if (!list.length) {
      html += `<div class="empty-state"><div class="empty-icon">${icon}</div><div>Belum ada koleksi ${kat}.</div></div>`;
    } else {
      ['Pelajaran','Video','Link Edukasi','Referensi'].forEach(kt => {
        const sub = list.filter(b => b.kategori === kt);
        if (!sub.length) return;
        html += _perpusRakSection(kt, perpusKatIcon[kt]||'📄', (perpusKatColor[kt]||{}).clr||'#424242', sub, true);
      });
    }

  } else if (kat === 'umum') {
    const list = perpusData.filter(b => !b.kelas && !b.mapel);
    html += `<div class="perpus-group-title">🌐 Koleksi Umum</div>`;
    if (!list.length) {
      html += '<div class="empty-state"><div class="empty-icon">🌐</div><div>Belum ada koleksi umum.</div></div>';
    } else {
      ['Pelajaran','Fiksi','Video','Link Edukasi','Referensi','Seni & Budaya'].forEach(kt => {
        const sub = list.filter(b => b.kategori === kt);
        if (!sub.length) return;
        html += _perpusRakSection(kt, perpusKatIcon[kt]||'📄', (perpusKatColor[kt]||{}).clr||'#424242', sub, false);
      });
    }
  }

  el.innerHTML = html;
  const subEl = document.getElementById('perpus-sub');
  if (subEl) subEl.textContent = perpusData.length + ' koleksi · SD Negeri 3 Kalipang';
}

function perpusFilterKat(kat, el) {
  _perpusCurKat = kat;
  document.querySelectorAll('.perpus-cat-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  perpusRenderRak();
}

// --- Buka modal buku ---
function perpusBuka(id) {
  const b = perpusData.find(x => x.id === id);
  if (!b) return;
  document.getElementById('perpus-modal-judul').textContent = b.judul;
  const kelasTxt = b.kelas ? ' · Kelas ' + b.kelas : '';
  const mapelTxt = b.mapel ? ' · ' + b.mapel : '';
  document.getElementById('perpus-modal-sub').textContent   = (b.penulis||'') + kelasTxt + mapelTxt;
  document.getElementById('perpus-modal-link-btn').href     = b.link;

  let embedUrl = b.link;
  if (b.link.includes('drive.google.com/file')) {
    const m = b.link.match(/\/d\/([^\/]+)/); if (m) embedUrl = 'https://drive.google.com/file/d/'+m[1]+'/preview';
  } else if (b.link.includes('drive.google.com/open')) {
    try { const id2=new URL(b.link).searchParams.get('id'); if(id2) embedUrl='https://drive.google.com/file/d/'+id2+'/preview'; } catch{}
  } else if (b.link.includes('youtube.com/watch')) {
    try { const v=new URL(b.link).searchParams.get('v'); if(v) embedUrl='https://www.youtube.com/embed/'+v; } catch{}
  } else if (b.link.includes('youtu.be/')) {
    const v=b.link.split('youtu.be/')[1]?.split('?')[0]; if(v) embedUrl='https://www.youtube.com/embed/'+v;
  }

  const icon = perpusKatIcon[b.kategori]||'📄';
  const bg   = (perpusKatColor[b.kategori]||{}).bg||'#F5F5F5';
  const body = document.getElementById('perpus-modal-body');
  const canEmbed = embedUrl.includes('drive.google.com')||embedUrl.includes('youtube.com/embed');

  body.innerHTML = canEmbed
    ? `<iframe src="${embedUrl}" style="width:100%;height:100%;border:none" allowfullscreen></iframe>`
    : `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;background:${bg}">
        <div style="font-size:56px;margin-bottom:14px">${icon}</div>
        <div style="font-size:15px;font-weight:700;color:#212121;margin-bottom:8px">${b.judul}</div>
        ${b.deskripsi?`<div style="font-size:12px;color:#616161;line-height:1.6;margin-bottom:16px">${b.deskripsi}</div>`:''}
        <div style="font-size:12px;color:#9E9E9E">Gunakan tombol <strong>Buka di Browser</strong> di bawah.</div>
      </div>`;

  document.getElementById('perpus-modal-overlay').style.display='block';
  const modal = document.getElementById('perpus-modal');
  modal.style.display='flex'; modal.style.position='fixed';
}

function perpusModalTutup() {
  document.getElementById('perpus-modal-overlay').style.display='none';
  document.getElementById('perpus-modal').style.display='none';
  document.getElementById('perpus-modal-body').innerHTML='';
}

// --- Cari ---
function perpusCari(q) {
  const el = document.getElementById('perpus-cari-result');
  if (!el) return;
  q = q.toLowerCase().trim();
  const list = q
    ? perpusData.filter(b =>
        b.judul.toLowerCase().includes(q) ||
        (b.penulis&&b.penulis.toLowerCase().includes(q)) ||
        (b.kategori&&b.kategori.toLowerCase().includes(q)) ||
        (b.mapel&&b.mapel.toLowerCase().includes(q)) ||
        (b.deskripsi&&b.deskripsi.toLowerCase().includes(q))
      )
    : perpusData;

  if (!list.length) { el.innerHTML='<div class="empty-state"><div class="empty-icon">🔍</div><div>Tidak ditemukan.</div></div>'; return; }

  el.innerHTML = list.map(b => {
    const icon = perpusKatIcon[b.kategori]||'📄';
    const c    = perpusKatColor[b.kategori]||{bg:'#F5F5F5',clr:'#424242'};
    const canEdit = sessionUser && ['admin','kepsek','guru'].includes(sessionUser.role);
    const mapelBadge = b.mapel
      ? `<span style="background:${b.mapel==='PJOK'?'#E3F2FD':'#E8F5E9'};color:${b.mapel==='PJOK'?'#0D47A1':'#1B5E20'};border-radius:6px;padding:1px 7px;font-size:10px;font-weight:700">${b.mapel==='PJOK'?'🏃':'📖'} ${b.mapel}</span>` : '';
    const kelasBadge = b.kelas
      ? `<span style="background:${perpusKlsColor[parseInt(b.kelas)]};color:${perpusKlsClr[parseInt(b.kelas)]};border-radius:6px;padding:1px 7px;font-size:10px;font-weight:700">Kls ${b.kelas}</span>` : '';
    return `<div class="guru-card" style="cursor:pointer;margin-bottom:8px" onclick="perpusBuka('${b.id}')">
      <div style="width:44px;height:44px;border-radius:12px;background:${c.bg};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#212121">${b.judul}</div>
        <div style="font-size:11px;color:#9E9E9E;margin-bottom:4px">${b.penulis||'—'} · <span style="color:${c.clr};font-weight:600">${b.kategori}</span></div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">${kelasBadge}${mapelBadge}</div>
      </div>
      ${canEdit?`<div style="display:flex;gap:6px;flex-shrink:0">
        <button onclick="event.stopPropagation();perpusEdit('${b.id}')" class="perpus-act-btn edit">✏️ Edit</button>
        <button onclick="event.stopPropagation();perpusHapus('${b.id}')" class="perpus-act-btn del">🗑</button>
      </div>`:''}
    </div>`;
  }).join('');
}

// --- Simpan / Edit / Hapus ---
function perpusSimpan() {
  if (!sessionUser||!['admin','kepsek','guru'].includes(sessionUser.role)) { showToast('⛔ Akses ditolak.','#C62828'); return; }
  const judul = document.getElementById('perpus-judul').value.trim();
  const link  = document.getElementById('perpus-link').value.trim();
  if (!judul) { showToast('Judul tidak boleh kosong!','#C62828'); return; }
  if (!link)  { showToast('Link tidak boleh kosong!','#C62828'); return; }

  const editId = document.getElementById('perpus-edit-id').value;
  const lama   = editId?(perpusData.find(x=>x.id===editId)||{}):{};
  const item   = {
    id      : editId||'p'+Date.now(),
    judul,
    penulis : document.getElementById('perpus-penulis').value.trim(),
    kategori: document.getElementById('perpus-kategori').value,
    mapel   : document.getElementById('perpus-mapel').value,
    kelas   : document.getElementById('perpus-kelas').value,
    link,
    coverUrl: document.getElementById('perpus-cover').value.trim(),
    deskripsi:document.getElementById('perpus-desk').value.trim(),
    addedBy : lama.addedBy||sessionUser.username,
    addedAt : lama.addedAt||new Date().toISOString().split('T')[0],
  };

  if (editId) { const idx=perpusData.findIndex(x=>x.id===editId); if(idx>=0) perpusData[idx]=item; }
  else perpusData.unshift(item);

  LS.set('perpus_data', perpusData);
  perpusBatalEdit();
  showToast('✅ "'+judul+'" berhasil disimpan!','#2E7D32');
  document.querySelectorAll('#screen-perpustakaan .tab-btn')[0].click();
}

function perpusEdit(id) {
  const b = perpusData.find(x=>x.id===id); if(!b) return;
  document.getElementById('perpus-edit-id').value   = b.id;
  document.getElementById('perpus-judul').value     = b.judul;
  document.getElementById('perpus-penulis').value   = b.penulis||'';
  document.getElementById('perpus-kategori').value  = b.kategori||'Pelajaran';
  document.getElementById('perpus-mapel').value     = b.mapel||'';
  document.getElementById('perpus-kelas').value     = b.kelas||'';
  document.getElementById('perpus-link').value      = b.link||'';
  document.getElementById('perpus-cover').value     = b.coverUrl||'';
  document.getElementById('perpus-desk').value      = b.deskripsi||'';
  document.getElementById('perpus-form-title').textContent   = '✏️ Edit Koleksi';
  document.getElementById('perpus-btn-simpan').textContent   = '💾 Simpan Perubahan';
  document.getElementById('perpus-btn-batal').style.display  = '';
  perpusToggleKelas();
  document.querySelectorAll('#screen-perpustakaan .tab-btn')[2].click();
  window.scrollTo(0,0);
}

function perpusBatalEdit() {
  ['perpus-edit-id','perpus-judul','perpus-penulis','perpus-link','perpus-cover','perpus-desk'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const kat=document.getElementById('perpus-kategori'); if(kat) kat.value='Pelajaran';
  const mp=document.getElementById('perpus-mapel');     if(mp)  mp.value='';
  const kls=document.getElementById('perpus-kelas');    if(kls) kls.value='';
  document.getElementById('perpus-form-title').textContent  = '➕ Tambah Koleksi Baru';
  document.getElementById('perpus-btn-simpan').textContent  = '💾 Simpan';
  document.getElementById('perpus-btn-batal').style.display = 'none';
  perpusToggleKelas();
}

function perpusHapus(id) {
  const b = perpusData.find(x=>x.id===id); if(!b) return;
  if(!confirm('Hapus "'+b.judul+'"?')) return;
  perpusData = perpusData.filter(x=>x.id!==id);
  LS.set('perpus_data', perpusData);
  perpusRenderRak();
  const q=document.getElementById('perpus-search-input')?.value||'';
  if(q) perpusCari(q);
  showToast('🗑 Koleksi dihapus.','#F57F17');
}

// ============================================================
// ==================== CETAK DOKUMEN =========================
// ============================================================

function cetakAbsensi() {
  if (!Object.keys(absenHistory).length) { showToast('Belum ada data absensi tersimpan!','#F57F17'); return; }
  rekapExport();
}

function cetakDataSiswa() {
  if (typeof siswaDownloadExcel === 'function') siswaDownloadExcel();
  else showToast('Buka menu Data Siswa terlebih dahulu.','#F57F17');
}

function cetakRekapKelas() {
  if (typeof kelasExportExcel === 'function') kelasExportExcel();
  else showToast('Buka menu Data Kelas terlebih dahulu.','#F57F17');
}

function cetakNilai() {
  if (!Object.keys(nilaiData).length) { showToast('Belum ada data nilai! Input nilai di menu Penilaian.','#F57F17'); return; }
  // Coba export langsung jika nilaiExportExcel tersedia dan nilaiCfg sudah diatur
  if (typeof nilaiExportExcel === 'function' && typeof nilaiCfg !== 'undefined' && nilaiCfg.kelas) {
    nilaiExportExcel();
  } else {
    showToast('Buka menu Penilaian → Pengaturan → Input → klik Export Excel.','#1565C0');
  }
}

function cetakJurnal() {
  if (typeof jurnalExport === 'function') jurnalExport();
}

function cetakDataGuru() {
  const wb = XLSX.utils.book_new();
  const header = ['No','NIP','Nama Guru','Jenis Guru'];
  const rows = guruData.map(g => [g.no, g.nip !== '-' ? g.nip : '', g.nama, g.jenisGuru || g.jabatan || '']);
  const ws = XLSX.utils.aoa_to_sheet([header,...rows]);
  ws['!cols'] = [{wch:5},{wch:20},{wch:26},{wch:22},{wch:30},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, 'Data Guru');
  XLSX.writeFile(wb, 'DataGuru_SDN3Kalipang.xlsx');
  showToast('✅ Data guru diexport!','#2E7D32');
}


// ============================================================
// ==================== NOTIFIKASI / PENGUMUMAN ===============
// ============================================================
let notifData = LS.get('notif_data', []);
let notifFilterActive = 'semua';

function notifLoad() {
  // Tampilkan tombol tambah hanya untuk admin/kepsek
  const role = sessionUser?.role;
  const btnTambah = document.getElementById('notif-btn-tambah');
  if (btnTambah) btnTambah.style.display = (role === 'admin' || role === 'kepsek') ? 'block' : 'none';

  // Tandai notif telah dibaca
  const lastRead = LS.get('notif_last_read', 0);
  const newLastRead = notifData.length > 0 ? Math.max(...notifData.map(n => n.ts || 0)) : 0;
  LS.set('notif_last_read', newLastRead);
  notifUpdateBadge();
  notifRender();
}

function notifRender() {
  const el = document.getElementById('notif-list');
  if (!el) return;
  const lastRead = LS.get('notif_last_read', 0);

  let list = [...notifData].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (notifFilterActive !== 'semua') list = list.filter(n => n.kategori === notifFilterActive);

  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><div>${notifFilterActive === 'semua' ? 'Belum ada pengumuman' : 'Tidak ada pengumuman kategori ini'}</div></div>`;
    return;
  }

  const katLabel = { umum: '📢 Umum', akademik: '📚 Akademik', kegiatan: '🎉 Kegiatan', penting: '🔴 Penting' };
  const role = sessionUser?.role;
  const canEdit = role === 'admin' || role === 'kepsek';

  el.innerHTML = list.map(n => {
    const isUnread = (n.ts || 0) > (LS.get('notif_last_read_prev', 0) || 0);
    const tgl = new Date(n.ts || Date.now()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div class="notif-card ${n.kategori} ${isUnread ? 'unread' : ''}">
      <div class="notif-card-head">
        <div class="notif-card-judul">${n.judul}</div>
        <div class="notif-card-badge" style="background:${n.kategori==='penting'?'#FFEBEE':n.kategori==='kegiatan'?'#FFF3E0':n.kategori==='akademik'?'#E3F2FD':'#F5F5F5'};color:${n.kategori==='penting'?'#C62828':n.kategori==='kegiatan'?'#E65100':n.kategori==='akademik'?'#1565C0':'#757575'}">${katLabel[n.kategori]||'📢 Umum'}</div>
      </div>
      <div class="notif-card-isi">${n.isi}</div>
      <div class="notif-card-meta">
        <span>👤 ${n.penulis || '—'} · ${n.target==='semua'?'Semua Guru':n.target||'Semua Guru'}</span>
        <span>${tgl}</span>
      </div>
      ${canEdit ? `<div class="notif-card-actions">
        <button onclick="notifEdit('${n.id}')" style="padding:5px 10px;background:#E3F2FD;color:#1565C0;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">✏️ Edit</button>
        <button onclick="notifHapus('${n.id}')" style="padding:5px 10px;background:#FFEBEE;color:#C62828;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">🗑 Hapus</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function notifFilter(cat, btn) {
  notifFilterActive = cat;
  document.querySelectorAll('.notif-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  notifRender();
}

function notifShowForm(reset = true) {
  const wrap = document.getElementById('notif-form-wrap');
  if (wrap) wrap.style.display = 'block';
  if (reset) {
    document.getElementById('notif-edit-id').value = '';
    document.getElementById('notif-judul').value = '';
    document.getElementById('notif-isi').value = '';
    document.getElementById('notif-kategori').value = 'umum';
    document.getElementById('notif-target').value = 'semua';
    document.getElementById('notif-form-title').textContent = '📢 Buat Pengumuman Baru';
  }
  document.getElementById('notif-judul').focus();
}

function notifHideForm() {
  const wrap = document.getElementById('notif-form-wrap');
  if (wrap) wrap.style.display = 'none';
}

function notifSimpan() {
  const judul = document.getElementById('notif-judul').value.trim();
  const isi = document.getElementById('notif-isi').value.trim();
  const kategori = document.getElementById('notif-kategori').value;
  const target = document.getElementById('notif-target').value;
  const editId = document.getElementById('notif-edit-id').value;

  if (!judul) { showToast('Judul pengumuman wajib diisi!', '#C62828'); return; }
  if (!isi) { showToast('Isi pengumuman wajib diisi!', '#C62828'); return; }

  if (editId) {
    const idx = notifData.findIndex(n => n.id === editId);
    if (idx >= 0) {
      notifData[idx] = { ...notifData[idx], judul, isi, kategori, target };
      showToast('✅ Pengumuman diperbarui!', '#2E7D32');
    }
  } else {
    notifData.unshift({
      id: 'n' + Date.now(),
      judul, isi, kategori, target,
      penulis: sessionUser?.nama || sessionUser?.username || '—',
      ts: Date.now()
    });
    showToast('✅ Pengumuman berhasil dibuat!', '#2E7D32');
  }

  LS.set('notif_data', notifData);
  notifHideForm();
  notifUpdateBadge();
  notifRender();
}

function notifEdit(id) {
  const n = notifData.find(x => x.id === id);
  if (!n) return;
  document.getElementById('notif-edit-id').value = n.id;
  document.getElementById('notif-judul').value = n.judul;
  document.getElementById('notif-isi').value = n.isi;
  document.getElementById('notif-kategori').value = n.kategori;
  document.getElementById('notif-target').value = n.target;
  document.getElementById('notif-form-title').textContent = '✏️ Edit Pengumuman';
  notifShowForm(false);
}

function notifHapus(id) {
  if (!confirm('Hapus pengumuman ini?')) return;
  notifData = notifData.filter(n => n.id !== id);
  LS.set('notif_data', notifData);
  notifUpdateBadge();
  notifRender();
  showToast('🗑 Pengumuman dihapus', '#F57F17');
}

function notifUpdateBadge() {
  const lastRead = LS.get('notif_last_read', 0);
  const unread = notifData.filter(n => (n.ts || 0) > lastRead).length;
  // Badge di menu dashboard
  const badge = document.getElementById('notif-badge-menu');
  if (badge) {
    if (unread > 0) {
      badge.style.display = 'flex';
      badge.textContent = unread > 9 ? '9+' : unread;
    } else {
      badge.style.display = 'none';
    }
  }
}

// ============================================================
// ==================== DARK MODE =============================
// ============================================================
let isDarkMode = LS.get('dark_mode', false);

function darkModeInit() {
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    _darkModeUpdateUI(true);
  }
}

function darkModeToggle() {
  isDarkMode = !isDarkMode;
  LS.set('dark_mode', isDarkMode);
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  _darkModeUpdateUI(isDarkMode);
  showToast(isDarkMode ? '🌙 Mode Gelap aktif' : '☀️ Mode Terang aktif', isDarkMode ? '#1A237E' : '#F57F17');
}

function _darkModeUpdateUI(on) {
  const toggle = document.getElementById('dark-mode-toggle');
  const thumb = document.getElementById('dark-mode-thumb');
  if (toggle) toggle.style.background = on ? '#43A047' : '#E0E0E0';
  if (thumb) thumb.style.left = on ? '23px' : '3px';
}

// Inisialisasi dark mode saat halaman load
darkModeInit();
// Update badge notif saat load
notifUpdateBadge();

// ============================================================
// ==================== EXPORT PDF RAPORT =====================
// ============================================================
function raportExportPDF() {
  const nama = document.getElementById('rp-s-nama')?.textContent;
  if (!nama || nama === '—') { showToast('Pilih siswa dulu!', '#C62828'); return; }

  const noInduk  = document.getElementById('rp-s-induk')?.textContent || '-';
  const nisn     = document.getElementById('rp-s-nisn')?.textContent || '-';
  const kelas    = document.getElementById('rp-s-kelas')?.textContent || '-';
  const sem      = document.getElementById('rp-s-sem')?.textContent || '-';
  const wali     = document.getElementById('rp-s-wali')?.textContent || '-';
  const avg      = document.getElementById('rp-avg')?.textContent || '-';
  const pred     = document.getElementById('rp-pred')?.textContent || '-';
  const status   = document.getElementById('rp-status')?.textContent || '-';
  const kepsekNm = document.getElementById('rp-ttd-name')?.textContent || '-';
  const kota     = document.getElementById('rp-ttd-kota')?.textContent || '-';
  const namaSekolah = document.getElementById('rp-nama-sekolah')?.textContent || 'SD Negeri 3 Kalipang';
  const tapel    = document.getElementById('rp-tahun-label')?.textContent || '';

  // Kumpulkan rows nilai dari DOM
  const nilaiRows = [];
  document.querySelectorAll('.raport-mapel-row').forEach((row, i) => {
    const cols = row.querySelectorAll('div');
    if (cols.length >= 5) {
      const mapel = cols[1]?.textContent?.trim().replace(/\(demo\)/gi,'').trim() || '-';
      const nilai = cols[3]?.textContent?.trim() || '-';
      const predikat = cols[4]?.textContent?.trim() || '-';
      nilaiRows.push({ no: i+1, mapel, nilai, predikat });
    }
  });

  const predColor = parseInt(avg) >= 90 ? '#1B5E20' : parseInt(avg) >= 75 ? '#1565C0' : parseInt(avg) >= 60 ? '#E65100' : '#C62828';

  const tableRows = nilaiRows.map(r => `
    <tr>
      <td style="text-align:center">${r.no}</td>
      <td>${r.mapel}</td>
      <td style="text-align:center;font-weight:700">${r.nilai}</td>
      <td style="text-align:center;font-weight:700">${r.predikat}</td>
    </tr>`).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<title>Raport ${nama} — ${kelas}</title>
<style>
  @page { size: A4; margin: 20mm 15mm; }
  body { font-family: 'Times New Roman', serif; font-size: 12px; color: #111; }
  .header { text-align: center; border-bottom: 3px double #111; padding-bottom: 10px; margin-bottom: 16px; }
  .header h2 { margin: 4px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
  .header p { margin: 2px 0; font-size: 12px; }
  .title-raport { text-align: center; margin: 14px 0; }
  .title-raport h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; text-decoration: underline; }
  .identitas { display: grid; grid-template-columns: 140px auto; gap: 4px 0; margin-bottom: 16px; font-size: 12px; }
  .identitas .lbl { font-weight: normal; }
  .identitas .val { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #333; padding: 5px 8px; }
  th { background: #f0f0f0; font-weight: bold; text-align: center; }
  .summary { display: flex; gap: 20px; margin: 10px 0 20px; font-size: 13px; }
  .sum-box { border: 1px solid #333; padding: 8px 14px; text-align: center; border-radius: 4px; }
  .sum-num { font-size: 22px; font-weight: bold; color: ${predColor}; }
  .ttd { display: grid; grid-template-columns: 1fr 1fr; margin-top: 30px; }
  .ttd-box { text-align: center; }
  .ttd-line { margin-top: 50px; border-top: 1px solid #111; padding-top: 4px; font-weight: bold; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head><body>
<div class="header">
  <h2>${namaSekolah}</h2>
  <p>${document.getElementById('rp-alamat-sekolah')?.textContent || 'Kalipang, Kudus, Jawa Tengah'}</p>
</div>
<div class="title-raport"><h3>Laporan Hasil Belajar Peserta Didik</h3><p>${tapel}</p></div>
<div class="identitas">
  <div class="lbl">Nama Peserta Didik</div><div class="val">: ${nama}</div>
  <div class="lbl">No. Induk / NISN</div><div class="val">: ${noInduk} / ${nisn}</div>
  <div class="lbl">Kelas</div><div class="val">: ${kelas}</div>
  <div class="lbl">Semester</div><div class="val">: ${sem}</div>
  <div class="lbl">Wali Kelas</div><div class="val">: ${wali}</div>
</div>
<table>
  <thead><tr><th style="width:30px">No</th><th>Mata Pelajaran</th><th style="width:60px">Nilai</th><th style="width:70px">Predikat</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="summary">
  <div class="sum-box"><div class="sum-num">${avg}</div><div>Rata-rata</div></div>
  <div class="sum-box"><div class="sum-num" style="color:${predColor}">${pred}</div><div>Predikat</div></div>
  <div class="sum-box"><div class="sum-num" style="font-size:14px;color:${parseInt(avg)>= (appConfig.kkm||70)?'#2E7D32':'#C62828'}">${status}</div><div>Status</div></div>
</div>
<div class="ttd">
  <div class="ttd-box"><p>Orang Tua / Wali</p><div class="ttd-line">……………………………</div></div>
  <div class="ttd-box"><p>${kota}</p><p>Wali Kelas / Guru</p><div class="ttd-line">${wali}</div></div>
</div>
<div style="margin-top:20px;text-align:right">
  <p>Mengetahui, Kepala Sekolah</p>
  <br><br>
  <p style="font-weight:bold">${kepsekNm}</p>
  <p>NIP. ${appConfig.kepsekNip || '………………………'}</p>
</div>
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

// ============================================================
// ==================== PWA / SERVICE WORKER ==================
// ============================================================
function pwaRegisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    // Inline service worker sebagai blob
    const swCode = `
const CACHE = 'sdn3-v1';
const URLS  = ['./', './index.html', './app.js', './style.css'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html'))));
});`;
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const url  = URL.createObjectURL(blob);
    navigator.serviceWorker.register(url).then(() => {
      console.log('[SDN3] Service Worker registered (offline mode aktif)');
    }).catch(err => console.warn('[SDN3] SW gagal:', err));
  }
}
pwaRegisterServiceWorker();
