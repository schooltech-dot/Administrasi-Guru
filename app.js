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
function saveAll() {
  LS.set('siswa_master', siswaMaster);
  LS.set('guru_data', guruData);
  LS.set('nilai_data', nilaiData);
  LS.set('ujian_list', ujianList);
  LS.set('absen_history', absenHistory);
  if (typeof jurnalList !== 'undefined') LS.set('jurnal_list', jurnalList);
  if (typeof jadwalData !== 'undefined') LS.set('jadwal_data', jadwalData);
  if (typeof jadwalRows !== 'undefined') LS.set('jadwal_rows', jadwalRows);
  if (typeof materiDocs !== 'undefined') LS.set('materi_docs', materiDocs);
}

function resetAllData() {
  if (!confirm('⚠️ Yakin reset SEMUA data? (Siswa, Guru, Nilai, Ujian, Jadwal, Absensi)
Data demo akan dikembalikan.')) return;
  LS.del('siswa_master');
  LS.del('guru_data');
  LS.del('nilai_data');
  LS.del('ujian_list');
  LS.del('jadwal_data');
  LS.del('jadwal_rows');
  LS.del('absen_history');
  LS.del('materi_docs');
  siswaMaster = [..._siswaDemoDefault];
  guruData    = [..._guruDemoDefault];
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
  let total = 0;
  const keys = ['siswa_master','guru_data','nilai_data','ujian_list','jadwal_data','absen_history','materi_docs','app_config'];
  const info = keys.map(k => {
    const v = localStorage.getItem('sdn3_'+k);
    const sz = v ? (v.length/1024).toFixed(1) : 0;
    if (v) total += v.length;
    return k + ': ' + (v ? sz + ' KB' : '—');
  });
  alert('📦 LocalStorage Usage:
' + info.join('
') + '

Total: ' + (total/1024).toFixed(1) + ' KB');
}

// ============================================================
// NAVIGASI — BUG FIX: gunakan style.display langsung via JS
// ============================================================
function goScreen(id) {
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
  if (id === 'kelas')     kelasLoad();
  if (id === 'materi')    { materiInit();
  jurnalInit(); materiLoad(); }
  if (id === 'jurnal')    jurnalLoad();
  if (id === 'rekap')     rekapLoad();
  if (id === 'raport')     raportInit();
}

window.addEventListener('DOMContentLoaded', function () {
  // Sembunyikan semua screen
  document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; });
  // Tampilkan login saja
  document.getElementById('screen-login').style.display = 'flex';
  // Set tanggal hari ini
  const d = new Date();
  const tgl = d.toISOString().split('T')[0];
  document.getElementById('abs-tgl').value = tgl;
  // Tambahkan soal demo ke ujian
  initDemoUjian();
  // Init penilaian
  initPenilaian();
  if(Object.keys(jadwalData).length===0) initJadwalDemo();
  materiInit();
  jurnalInit();
});

// ===== updateDashStats =====
function updateDashStats() {
  document.getElementById('stat-siswa').textContent = siswaMaster.length || '—';
  document.getElementById('stat-guru').textContent = guruData.length;
  // Update absensi hari ini jika ada elemen
  const now = new Date();
  const tglHariIni = now.toISOString().split('T')[0];
  const absenHariIni = absenHistory[tglHariIni];
  const statAbsenEl = document.getElementById('stat-absen');
  if (statAbsenEl) {
    if (absenHariIni) {
      let totH = 0;
      Object.values(absenHariIni).forEach(e => { totH += e.counts.H; });
      statAbsenEl.textContent = totH;
    } else {
      statAbsenEl.textContent = '—';
    }
  }
}

// ===== TOAST =====
function showToast(msg, color) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || '#2E7D32';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

// ===== LOGIN =====
let currentRole = 'guru';
function setRole(el, role) {
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentRole = role;
  const labels = { guru: 'NIP / Username', kepsek: 'NIP Kepala Sekolah', siswa: 'NISN / Username', admin: 'Username Admin' };
  document.getElementById('lbl-user').textContent = labels[role];
  document.getElementById('login-msg').className = 'msg-box';
}
function togglePw() {
  const pw = document.getElementById('inp-password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
}
function doLogin() {
  const u = document.getElementById('inp-username').value.trim();
  const p = document.getElementById('inp-password').value;
  const msg = document.getElementById('login-msg');
  if (!u || !p) { msg.textContent = 'Username dan password tidak boleh kosong.'; msg.className = 'msg-box error'; return; }
  if (u === '12345' && p === '12345') {
    msg.textContent = 'Login berhasil! Mengalihkan...'; msg.className = 'msg-box success';
    document.getElementById('dash-uname').textContent = u;
    const rl = { guru: 'Guru', kepsek: 'Kepala Sekolah', siswa: 'Siswa', admin: 'Administrator' };
    document.getElementById('dash-role').textContent = rl[currentRole] + ' • SD Negeri 3 Kalipang';
    const targetScreen = currentRole === 'kepsek' ? 'kepsek' : 'dash';
    setTimeout(() => goScreen(targetScreen), 900);
  } else {
    msg.textContent = 'Username atau password salah.'; msg.className = 'msg-box error';
  }
}
function doLogout() {
  document.getElementById('inp-username').value = '';
  document.getElementById('inp-password').value = '';
  document.getElementById('login-msg').className = 'msg-box';
  goScreen('login');
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
  const guruL = guruData.filter(g => g.jk === 'L').length;
  const guruP = guruData.filter(g => g.jk === 'P').length;
  const guEl = document.getElementById('ks-total-guru');
  if (guEl) guEl.textContent = totalGuru || '—';
  const guSub = document.getElementById('ks-guru-sub');
  if (guSub && totalGuru) guSub.textContent = guruL + 'L / ' + guruP + 'P';

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
      + '<div class="kepsek-guru-avatar" style="background:' + (g.jk==='L'?'#E3F2FD':'#FCE4EC') + '">' + (g.jk==='L'?'👨‍🏫':'👩‍🏫') + '</div>'
      + '<div style="flex:1;min-width:0"><div class="kepsek-guru-name">' + g.nama + '</div>'
      + '<div class="kepsek-guru-jabatan">' + g.jabatan + (g.mapel&&g.mapel!=='-'?' · '+g.mapel:'') + '</div></div>'
      + '<span style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;background:' + (g.jk==='L'?'#E3F2FD':'#FCE4EC') + ';color:' + (g.jk==='L'?'#1565C0':'#C2185B') + '">' + (g.jk==='L'?'L':'P') + '</span>'
      + '</div>'
    ).join('') + (guruData.length > 8 ? '<div style="text-align:center;padding:10px;font-size:12px;color:#9E9E9E">+' + (guruData.length-8) + ' guru lainnya · <span onclick="goScreen(\'guru\')" style="color:#1565C0;cursor:pointer">Lihat semua →</span></div>' : '');
  }
}

// ===== DASHBOARD =====
function filterMenu(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.menu-item').forEach(item => {
    item.style.display = item.querySelector('.menu-label').textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ===== ABSENSI =====
let importedSiswa = [];
let absenData = {};
const defaultSiswa = {
  '1':['Achmad Fauzi','Bagas Prasetyo','Citra Dewi','Dian Rahayu','Eko Santoso','Fatimah Zahra','Gilang Ramadhan','Hani Permata','Ivan Kurniawan','Jasmine Putri','Kevin Susanto','Layla Nuraini'],
  '2':['Maulana Yusuf','Nadia Sari','Oscar Pratama','Putri Handayani','Qori Amelia','Rizky Firmansyah','Sari Dewi','Taufik Hidayat','Ulfa Nurhaliza','Vino Ardiansyah','Wulan Safitri','Xena Maharani'],
  '3':['Yogi Permana','Zahra Aulia','Arief Budiman','Bella Kusuma','Cahyo Wibowo','Dina Marlina','Endra Setiawan','Fina Rahmawati','Guntur Wijaya','Heni Lestari','Irfan Maulana','Julia Anggraeni'],
  '4':['Krisna Aditya','Lina Safira','Muhamad Iqbal','Nina Kartika','Oki Saputra','Pita Noviani','Rafi Alamsyah','Sinta Maharani','Toni Setiabudi','Umi Kulsum','Vika Andriani','Wahyu Nugroho'],
  '5':['Angga Permadi','Bima Sakti','Cantika Dewi','Dimas Saputra','Erini Wahyuni','Fahrul Rozi','Galih Wicaksono','Hera Puspita','Ilham Mauludi','Jihan Ramadhani','Khoirul Anwar','Lisa Amelia'],
  '6':['Mirza Fadhlan','Nisa Aulia','Okta Prayuda','Prima Kusuma','Qisthi Amira','Raihan Ardianto','Sella Novita','Teguh Prasetya','Udin Saefudin','Vella Andriani','Wira Kusuma','Yuli Rahayu'],
};
function absDrag(e, active) { e.preventDefault(); document.getElementById('abs-drop').classList.toggle('dragover', active); }
function absDrop(e) { e.preventDefault(); absDrag(e, false); if (e.dataTransfer.files[0]) absHandleFile(e.dataTransfer.files[0]); }
function absHandleFile(file) {
  if (!file) return;
  if (!file.name.match(/\.(xlsx|xls)$/i)) { showToast('File harus .xlsx atau .xls', '#C62828'); return; }
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows.length) { showToast('File kosong!', '#C62828'); return; }
      const first = rows[0];
      function fc(keys) { const rk = Object.keys(first).map(k => k.toLowerCase().trim()); for (const k of keys) { const i = rk.findIndex(r => r.includes(k)); if (i !== -1) return Object.keys(first)[i]; } return null; }
      const cNo = fc(['no', '#']), cInduk = fc(['no. induk', 'no induk', 'induk', 'nis']), cNisn = fc(['nisn']), cNama = fc(['nama siswa', 'nama', 'name']), cKelas = fc(['kelas']), cJk = fc(['jenis kelamin', 'jk', 'gender']);
      if (!cNama) { showToast('Kolom "Nama Siswa" tidak ditemukan!', '#C62828'); return; }
      importedSiswa = rows.filter(r => r[cNama] && String(r[cNama]).trim()).map((r, i) => ({
        no: cNo ? String(r[cNo]).trim() : String(i + 1), noInduk: cInduk ? String(r[cInduk]).trim() : '-',
        nisn: cNisn ? String(r[cNisn]).trim() : '-', nama: String(r[cNama]).trim(),
        kelas: cKelas ? String(r[cKelas]).trim() : '-', jk: cJk ? String(r[cJk]).trim().toUpperCase() : 'L',
      }));
      document.getElementById('abs-fname').textContent = '📄 ' + file.name;
      document.getElementById('abs-fcount').textContent = importedSiswa.length + ' siswa berhasil dibaca';
      document.getElementById('abs-info').classList.add('show');
      showToast('✅ ' + importedSiswa.length + ' siswa berhasil diimport!', '#2E7D32');
    } catch (err) { showToast('Gagal membaca file!', '#C62828'); }
  };
  reader.readAsArrayBuffer(file);
}
function absClear() {
  importedSiswa = [];
  document.getElementById('abs-file').value = '';
  document.getElementById('abs-info').classList.remove('show');
  document.getElementById('abs-area').innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div>Upload Excel atau pilih kelas,<br>lalu klik <strong>Tampilkan</strong></div></div>';
}
function absDownloadTemplate() {
  const wb = XLSX.utils.book_new();
  const data = [['No', 'No. Induk', 'NISN', 'Nama Siswa', 'Kelas', 'Jenis Kelamin'], ['1', '2024001', '0012345678', 'Ahmad Fauzi', 'Kelas 4', 'L'], ['2', '2024002', '0012345679', 'Siti Rahayu', 'Kelas 4', 'P']];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
  XLSX.writeFile(wb, 'Template_Siswa_SDN3Kalipang.xlsx');
  showToast('⬇ Template siswa didownload!', '#1565C0');
}
function absLoad() {
  const kelas = document.getElementById('abs-kelas').value;
  const tgl = document.getElementById('abs-tgl').value;
  if (!tgl) { showToast('Pilih tanggal!', '#C62828'); return; }
  if (!kelas) { showToast('Pilih kelas atau upload Excel!', '#C62828'); return; }
  let list = [];
  if (importedSiswa.length > 0) {
    const f = importedSiswa.filter(s => s.kelas.replace(/[^0-9]/g,'')[0] === kelas);
    list = (f.length > 0 ? f : importedSiswa).map(s => ({ ...s }));
  } else {
    list = (defaultSiswa[kelas] || defaultSiswa['1']).map((nama, i) => ({
      no: String(i + 1), noInduk: '202400' + String(i + 1).padStart(2, '0'),
      nisn: '301' + String(i + 1).padStart(5, '0'), nama, jk: i % 2 === 0 ? 'L' : 'P'
    }));
  }
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
const _guruDemoDefault = [
  { no: '1', nip: '197501012000031002', nama: 'Budi Santoso, S.Pd', jabatan: 'Kepala Sekolah', mapel: '-', jk: 'L' },
  { no: '2', nip: '198203152005012008', nama: 'Sri Wahyuni, S.Pd', jabatan: 'Guru Kelas', mapel: 'Bahasa Indonesia', jk: 'P' },
  { no: '3', nip: '199001202019031004', nama: 'Ahmad Fauzan, S.Pd', jabatan: 'Guru Mapel', mapel: 'Matematika', jk: 'L' },
  { no: '4', nip: '198507072010012015', nama: 'Dewi Rahayu, S.Pd', jabatan: 'Guru Kelas', mapel: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', jk: 'P' },
  { no: '5', nip: '197809092003121003', nama: 'Hendra Wijaya, S.Pd', jabatan: 'Guru Mapel', mapel: 'PJOK', jk: 'L' },
];
let guruData = LS.get('guru_data', _guruDemoDefault);
function guruTab(tab, el) {
  ['import', 'tambah', 'daftar'].forEach(t => { document.getElementById('guru-tab-' + t).classList.toggle('hidden', t !== tab); });
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'daftar') guruRender(guruData);
}
function guruDrag(e, active) { e.preventDefault(); document.getElementById('guru-drop').classList.toggle('dragover', active); }
function guruDropFile(e) { e.preventDefault(); guruDrag(e, false); if (e.dataTransfer.files[0]) guruHandleFile(e.dataTransfer.files[0]); }
function guruHandleFile(file) {
  if (!file) return;
  if (!file.name.match(/\.(xlsx|xls)$/i)) { showToast('File harus .xlsx atau .xls', '#C62828'); return; }
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows.length) { showToast('File kosong!', '#C62828'); return; }
      const first = rows[0];
      function fc(keys) { const rk = Object.keys(first).map(k => k.toLowerCase().trim()); for (const k of keys) { const i = rk.findIndex(r => r.includes(k)); if (i !== -1) return Object.keys(first)[i]; } return null; }
      const cNip = fc(['nip']), cNama = fc(['nama guru', 'nama', 'name']), cJabatan = fc(['jabatan']), cMapel = fc(['mata pelajaran', 'mapel']), cJk = fc(['jenis kelamin', 'jk', 'gender']);
      if (!cNama) { showToast('Kolom "Nama Guru" tidak ditemukan!', '#C62828'); return; }
      const imported = rows.filter(r => r[cNama] && String(r[cNama]).trim()).map((r, i) => ({
        no: String(guruData.length + i + 1), nip: cNip ? String(r[cNip]).trim() : '-',
        nama: String(r[cNama]).trim(), jabatan: cJabatan ? String(r[cJabatan]).trim() : 'Guru',
        mapel: cMapel ? String(r[cMapel]).trim() : '-', jk: cJk ? String(r[cJk]).trim().toUpperCase() : 'L',
      }));
      guruData = [...guruData, ...imported];
      document.getElementById('guru-fname').textContent = '📄 ' + file.name;
      document.getElementById('guru-fcount').textContent = imported.length + ' guru berhasil diimport';
      document.getElementById('guru-info').classList.add('show');
      showToast('✅ ' + imported.length + ' guru diimport!', '#2E7D32');
      setTimeout(() => { document.querySelectorAll('.tab-btn')[2].click(); }, 1200);
    } catch (err) { showToast('Gagal membaca file!', '#C62828'); }
  };
  reader.readAsArrayBuffer(file);
}
function guruClear() { document.getElementById('guru-file').value = ''; document.getElementById('guru-info').classList.remove('show'); }
function guruDownloadTemplate() {
  const wb = XLSX.utils.book_new();
  const data = [['No', 'NIP', 'Nama Guru', 'Jabatan', 'Mata Pelajaran', 'Jenis Kelamin'], ['1', '197501012000031002', 'Budi Santoso, S.Pd', 'Kepala Sekolah', '-', 'L'], ['2', '198203152005012008', 'Sri Wahyuni, S.Pd', 'Guru Kelas', 'Bahasa Indonesia', 'P']];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 26 }, { wch: 22 }, { wch: 32 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Data Guru');
  XLSX.writeFile(wb, 'Template_Guru_SDN3Kalipang.xlsx');
  showToast('⬇ Template guru didownload!', '#1565C0');
}
function guruTambah() {
  const nama = document.getElementById('g-nama').value.trim();
  if (!nama) { showToast('Nama guru tidak boleh kosong!', '#C62828'); return; }
  guruData.push({ no: String(guruData.length + 1), nip: document.getElementById('g-nip').value.trim() || '-', nama, jabatan: document.getElementById('g-jabatan').value, mapel: document.getElementById('g-mapel').value || '-', jk: document.getElementById('g-jk').value });
  document.getElementById('g-nama').value = ''; document.getElementById('g-nip').value = '';
  showToast('✅ ' + nama + ' berhasil ditambahkan!', '#2E7D32');
  setTimeout(() => { document.querySelectorAll('.tab-btn')[2].click(); }, 1000);
}
function guruRender(list) {
  const tL = list.filter(g => g.jk === 'L').length, tP = list.filter(g => g.jk === 'P').length;
  document.getElementById('g-total').textContent = list.length;
  document.getElementById('g-total-l').textContent = tL;
  document.getElementById('g-total-p').textContent = tP;
  document.getElementById('guru-list-el').innerHTML = list.length ? list.map(g => `
    <div class="guru-card">
      <div class="guru-avatar ${g.jk === 'P' ? 'P' : 'L'}">${g.jk === 'P' ? '👩‍🏫' : '👨‍🏫'}</div>
      <div class="guru-info">
        <div class="guru-name">${g.nama}<span class="jk-badge ${g.jk}">${g.jk}</span></div>
        <div class="guru-jabatan">${g.jabatan}</div>
        <div class="guru-nip">NIP: ${g.nip}</div>
        ${g.mapel && g.mapel !== '-' ? `<span class="guru-mapel-badge">${g.mapel}</span>` : ''}
      </div>
    </div>`).join('') : '<div class="empty-state"><div class="empty-icon">👨‍🏫</div><div>Belum ada data guru.</div></div>';
}
function guruCari(q) { guruRender(q ? guruData.filter(g => g.nama.toLowerCase().includes(q.toLowerCase()) || g.nip.includes(q)) : guruData); }


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
  { no:'1', noInduk:'2024001', nisn:'0034567890', nama:'Achmad Fauzi', kelas:'Kelas 4', jk:'L', tmplahir:'Kudus', tgllahir:'2015-03-12', alamat:'Ds. Kalipang Rt.01/01', ortu:'Mukhlis', hp:'081234567890' },
  { no:'2', noInduk:'2024002', nisn:'0034567891', nama:'Bagas Prasetyo', kelas:'Kelas 4', jk:'L', tmplahir:'Kudus', tgllahir:'2015-06-20', alamat:'Ds. Kalipang Rt.02/01', ortu:'Suharto', hp:'081234567891' },
  { no:'3', noInduk:'2024003', nisn:'0034567892', nama:'Citra Dewi', kelas:'Kelas 4', jk:'P', tmplahir:'Kudus', tgllahir:'2015-01-08', alamat:'Ds. Kalipang Rt.01/02', ortu:'Supriyanto', hp:'081234567892' },
  { no:'4', noInduk:'2024004', nisn:'0034567893', nama:'Dian Rahayu', kelas:'Kelas 4', jk:'P', tmplahir:'Kudus', tgllahir:'2015-09-15', alamat:'Ds. Kalipang Rt.03/01', ortu:'Wahyudi', hp:'081234567893' },
  { no:'5', noInduk:'2024005', nisn:'0034567894', nama:'Eko Santoso', kelas:'Kelas 5', jk:'L', tmplahir:'Kudus', tgllahir:'2014-04-22', alamat:'Ds. Kalipang Rt.02/02', ortu:'Ponimin', hp:'081234567894' },
  { no:'6', noInduk:'2024006', nisn:'0034567895', nama:'Fatimah Zahra', kelas:'Kelas 5', jk:'P', tmplahir:'Kudus', tgllahir:'2014-11-30', alamat:'Ds. Kalipang Rt.04/01', ortu:'Mulyono', hp:'081234567895' },
  { no:'7', noInduk:'2024007', nisn:'0034567896', nama:'Gilang Ramadhan', kelas:'Kelas 5', jk:'L', tmplahir:'Kudus', tgllahir:'2014-07-17', alamat:'Ds. Kalipang Rt.01/03', ortu:'Setiawan', hp:'081234567896' },
  { no:'8', noInduk:'2024008', nisn:'0034567897', nama:'Hani Permata', kelas:'Kelas 6', jk:'P', tmplahir:'Kudus', tgllahir:'2013-02-25', alamat:'Ds. Kalipang Rt.05/02', ortu:'Hartono', hp:'081234567897' },
  { no:'9', noInduk:'2024009', nisn:'0034567898', nama:'Ivan Kurniawan', kelas:'Kelas 6', jk:'L', tmplahir:'Kudus', tgllahir:'2013-08-03', alamat:'Ds. Kalipang Rt.02/03', ortu:'Susilo', hp:'081234567898' },
  { no:'10', noInduk:'2024010', nisn:'0034567899', nama:'Jasmine Putri', kelas:'Kelas 6', jk:'P', tmplahir:'Kudus', tgllahir:'2013-05-14', alamat:'Ds. Kalipang Rt.03/02', ortu:'Triyono', hp:'081234567899' },
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
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows.length) { showToast('File kosong!', '#C62828'); return; }
      const first = rows[0];
      function fc(keys) {
        const rk = Object.keys(first).map(k => k.toLowerCase().trim());
        for (const k of keys) { const i = rk.findIndex(r => r.includes(k)); if (i !== -1) return Object.keys(first)[i]; }
        return null;
      }
      const cNo = fc(['no','#']);
      const cInduk = fc(['no. induk','no induk','induk','nis']);
      const cNisn = fc(['nisn']);
      const cNama = fc(['nama siswa','nama','name']);
      const cKelas = fc(['kelas','kelas']);
      const cJk = fc(['jenis kelamin','jk','gender']);
      const cTmpLahir = fc(['tempat lahir','tempat']);
      const cTglLahir = fc(['tanggal lahir','tgl lahir','tgl.lahir']);
      const cAlamat = fc(['alamat']);
      const cOrtu = fc(['nama ortu','nama orang tua','ortu','orang tua','wali']);
      const cHp = fc(['no hp','no. hp','hp','telepon','telp']);
      if (!cNama) { showToast('Kolom "Nama Siswa" tidak ditemukan!', '#C62828'); return; }

      const imported = rows.filter(r => r[cNama] && String(r[cNama]).trim()).map((r, i) => ({
        no: String(siswaMaster.length + i + 1),
        noInduk: cInduk ? String(r[cInduk]).trim() : '-',
        nisn: cNisn ? String(r[cNisn]).trim() : '-',
        nama: String(r[cNama]).trim(),
        kelas: cKelas ? String(r[cKelas]).trim() : '-',
        jk: cJk ? String(r[cJk]).trim().toUpperCase().charAt(0) : 'L',
        tmplahir: cTmpLahir ? String(r[cTmpLahir]).trim() : '-',
        tgllahir: cTglLahir ? String(r[cTglLahir]).trim() : '-',
        alamat: cAlamat ? String(r[cAlamat]).trim() : '-',
        ortu: cOrtu ? String(r[cOrtu]).trim() : '-',
        hp: cHp ? String(r[cHp]).trim() : '-',
      }));

      siswaMaster = [...siswaMaster, ...imported];
      document.getElementById('siswa-fname').textContent = '📄 ' + file.name;
      document.getElementById('siswa-fcount').textContent = imported.length + ' siswa berhasil diimport';
      document.getElementById('siswa-info').classList.add('show');
      showToast('✅ ' + imported.length + ' siswa berhasil diimport!', '#2E7D32');
      // Pindah ke tab daftar
      setTimeout(() => { document.querySelectorAll('.siswa-tab-btn')[2].click(); }, 1200);
    } catch(err) { showToast('Gagal membaca file: ' + err.message, '#C62828'); }
  };
  reader.readAsArrayBuffer(file);
}

function siswaClearImport() {
  document.getElementById('siswa-file').value = '';
  document.getElementById('siswa-info').classList.remove('show');
}

function siswaDownloadTemplate() {
  const wb = XLSX.utils.book_new();
  const data = [
    ['No','No. Induk','NISN','Nama Siswa','Kelas','Jenis Kelamin','Tempat Lahir','Tanggal Lahir','Alamat','Nama Ortu','No HP'],
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
    ortu: document.getElementById('s-ortu').value.trim() || '-',
    hp: document.getElementById('s-hp').value.trim() || '-',
  };
  siswaMaster.push(newSiswa);
  saveAll();
  // Reset form
  ['s-nama','s-induk','s-nisn','s-tmplahir','s-alamat','s-ortu','s-hp'].forEach(id => document.getElementById(id).value = '');
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
    <div class="detail-row"><span class="detail-icon">👨‍👩‍👦</span><div><div class="detail-key">Nama Orang Tua / Wali</div><div class="detail-val">${s.ortu}</div></div></div>
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
  const header = ['No','No. Induk','NISN','Nama Siswa','Kelas','Jenis Kelamin','Tempat Lahir','Tanggal Lahir','Alamat','Nama Ortu','No HP'];
  const rows = siswaMaster.map(s => [s.no, s.noInduk, s.nisn, s.nama, s.kelas,
    s.jk === 'L' ? 'Laki-laki' : 'Perempuan', s.tmplahir, s.tgllahir, s.alamat, s.ortu, s.hp]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [{wch:4},{wch:10},{wch:14},{wch:24},{wch:10},{wch:14},{wch:14},{wch:14},{wch:28},{wch:22},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
  XLSX.writeFile(wb, 'DataSiswa_SDN3Kalipang.xlsx');
  showToast('✅ Data ' + siswaMaster.length + ' siswa diexport!', '#2E7D32');
}


// ============================================================
// ==================== PENILAIAN =============================
// ============================================================

// BAB defaults per mapel
const defaultBabs = {
  'PAIBP': ['Al Qur\'an Pedoman Hidupku','Kasih Sayang terhadap Sesama','Aku Suka Berterima Kasih dan Disiplin','Membiasakan Hidup Bersih','Nabi Adam a.s. Manusia Pertama','BAB 6','BAB 7','BAB 8'],
  'Pendidikan Pancasila': ['Pancasila Dasar Negaraku','Norma & Aturan','Hak dan Kewajiban','Bhinneka Tunggal Ika','NKRI','BAB 6','BAB 7','BAB 8'],
  'Bahasa Indonesia': ['Teks Narasi','Teks Deskripsi','Teks Eksposisi','Membaca & Menulis','Puisi & Sastra','BAB 6','BAB 7','BAB 8'],
  'Matematika': ['Bilangan Cacah','Geometri & Pengukuran','Pecahan','Statistika','Aljabar Dasar','BAB 6','BAB 7','BAB 8'],
  'PJOK': ['Aktivitas Gerak','Permainan Bola Besar','Permainan Bola Kecil','Atletik','Kebugaran Jasmani','BAB 6','BAB 7','BAB 8'],
  'Seni Rupa': ['Menggambar','Mewarnai','Kolase & Mozaik','Seni Budaya Lokal','Apresiasi Karya Seni','BAB 6','BAB 7','BAB 8'],
  'IPAS': ['Makhluk Hidup','Materi & Perubahannya','Bumi & Antariksa','Listrik & Energi','Teknologi & Masyarakat','BAB 6','BAB 7','BAB 8'],
  'Bahasa Inggris': ['Greetings & Introduction','Things Around Us','My Family','Daily Activities','Animals & Nature','BAB 6','BAB 7','BAB 8'],
  'Mulok Bahasa Jawa': ['Aksara Jawa','Tembang Macapat','Cerita Rakyat','Unggah-Ungguh Basa','Pranatacara','BAB 6','BAB 7','BAB 8'],
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
  wrap.innerHTML = Array.from({length:8}, (_,i) => `
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
  const g = guruData.find(g => g.mapel === mapel || g.mapel.includes(mapel));
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
  const klsLbl = (ROM[n]||kelas)+'
('+(NAMA[n]||kelas)+')';
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
      tmplahir:'Kudus', tgllahir:'-', alamat:'-', ortu:'-', hp:'-',
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
  const wali = guruData.find(g => g.jabatan === 'Guru Kelas')?.nama || appConfig.kepsek;

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
  document.getElementById('rp-status').textContent = avg>=appConfig.kkm ? 'Naik' : 'Perlu
Bimbingan';
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
  const cfg = LS.get('app_config', appConfig);
  document.getElementById('cfg-nama-sekolah').value = cfg.namaSekolah  || '';
  document.getElementById('cfg-alamat').value        = cfg.alamat       || '';
  document.getElementById('cfg-tapel').value         = cfg.tapel        || '2025/2026';
  document.getElementById('cfg-semester').value      = cfg.semester     || 'Genap';
  document.getElementById('cfg-kepsek').value        = cfg.kepsek       || '';
  document.getElementById('cfg-nip-kepsek').value    = cfg.nipKepsek    || '';
  document.getElementById('cfg-kkm').value           = cfg.kkm          || 75;
  document.getElementById('cfg-kurikulum').value     = cfg.kurikulum    || 'Kurikulum Merdeka';
  if (document.getElementById('cfg-npsn'))  document.getElementById('cfg-npsn').value  = cfg.npsn  || '';
  if (document.getElementById('cfg-kec'))   document.getElementById('cfg-kec').value   = cfg.kec   || '';
  if (document.getElementById('cfg-kab'))   document.getElementById('cfg-kab').value   = cfg.kab   || '';
  if (document.getElementById('cfg-telp'))  document.getElementById('cfg-telp').value  = cfg.telp  || '';
  if (document.getElementById('cfg-email')) document.getElementById('cfg-email').value = cfg.email || '';
}

function pengaturanSimpan() {
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
  const waliGuru = guruData.filter(g => g.jabatan === 'Guru Kelas');
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
  // load dari localStorage jika ada
  const saved = localStorage.getItem('materi_docs');
  if (saved) try { materiDocs = JSON.parse(saved); } catch(e){}
}

function materiKey() {
  const kelas   = document.getElementById('mt-kelas').value;
  const mapel   = document.getElementById('mt-mapel').value;
  const sem     = document.getElementById('mt-semester').value;
  return kelas + '_' + mapel + '_' + sem;
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

function jurnalInit() {
  const d = new Date();
  document.getElementById('jr-tgl').value = d.toISOString().split('T')[0];
}

function jurnalLoad() {
  jurnalInit();
  jurnalRender();
}

function jurnalSimpan() {
  const tgl     = document.getElementById('jr-tgl').value;
  const kelas   = document.getElementById('jr-kelas').value;
  const mapel   = document.getElementById('jr-mapel').value;
  const jam     = document.getElementById('jr-jam').value;
  const materi  = document.getElementById('jr-materi').value.trim();
  const kegiatan= document.getElementById('jr-kegiatan').value.trim();
  const h = parseInt(document.getElementById('jr-h').value)||0;
  const i = parseInt(document.getElementById('jr-i').value)||0;
  const s = parseInt(document.getElementById('jr-s').value)||0;
  const a = parseInt(document.getElementById('jr-a').value)||0;
  const refleksi= document.getElementById('jr-refleksi').value;
  const catatan = document.getElementById('jr-catatan').value.trim();

  if (!tgl || !kelas) { showToast('Tanggal dan kelas wajib diisi!', '#C62828'); return; }

  jurnalList.unshift({
    id: Date.now(), tgl, kelas, mapel, jam, materi, kegiatan,
    hadir:{H:h,I:i,S:s,A:a}, refleksi, catatan,
    savedAt: new Date().toLocaleString('id-ID')
  });
  LS.set('jurnal_list', jurnalList);

  // Reset form
  ['jr-materi','jr-kegiatan','jr-catatan'].forEach(id => document.getElementById(id).value = '');
  ['jr-h','jr-i','jr-s','jr-a'].forEach(id => document.getElementById(id).value = '0');
  document.getElementById('jr-refleksi').value = '';

  showToast('✅ Jurnal berhasil disimpan!', '#2E7D32');
  jurnalRender();
}

function jurnalRender() {
  const el = document.getElementById('jurnal-list');
  if (!jurnalList.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📓</div><div>Belum ada jurnal tersimpan.</div></div>';
    return;
  }
  el.innerHTML = jurnalList.slice(0,30).map((j,idx) => {
    const tglFmt = j.tgl ? new Date(j.tgl).toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}) : '-';
    return '<div class="jurnal-card">'
      + '<div class="jurnal-card-header">'
      + '<span class="jurnal-tgl">📅 '+tglFmt+'</span>'
      + '<div style="display:flex;gap:6px;align-items:center">'
      + '<span class="jurnal-kelas-badge">'+j.kelas+'</span>'
      + '<button onclick="jurnalHapus('+idx+')" style="background:#FFEBEE;color:#C62828;border:none;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer">🗑</button>'
      + '</div></div>'
      + '<div class="jurnal-mapel">'+(j.mapel||'—')+' — '+j.jam+'</div>'
      + (j.materi   ? '<div class="jurnal-materi"><strong>Materi:</strong> '+j.materi+'</div>' : '')
      + (j.kegiatan ? '<div class="jurnal-materi" style="margin-top:3px"><strong>Kegiatan:</strong> '+j.kegiatan+'</div>' : '')
      + '<div class="jurnal-meta-row">'
      + '<span class="jurnal-meta-pill jp-hadir">H: '+j.hadir.H+'</span>'
      + '<span class="jurnal-meta-pill jp-izin">I: '+j.hadir.I+'</span>'
      + '<span class="jurnal-meta-pill jp-sakit">S: '+j.hadir.S+'</span>'
      + '<span class="jurnal-meta-pill jp-alfa">A: '+j.hadir.A+'</span>'
      + (j.refleksi ? '<span class="jurnal-meta-pill jp-refleksi">'+j.refleksi+'</span>' : '')
      + '</div>'
      + (j.catatan ? '<div style="font-size:11px;color:#757575;margin-top:6px;padding-top:6px;border-top:1px solid #F5F5F5">📝 '+j.catatan+'</div>' : '')
      + '</div>';
  }).join('');
}

function jurnalHapus(idx) {
  if (!confirm('Hapus jurnal ini?')) return;
  jurnalList.splice(idx, 1);
  LS.set('jurnal_list', jurnalList);
  jurnalRender();
  showToast('🗑 Jurnal dihapus.', '#F57F17');
}

function jurnalHapusSemua() {
  if (!confirm('Hapus semua jurnal?')) return;
  jurnalList = [];
  LS.set('jurnal_list', jurnalList);
  jurnalRender();
  showToast('🗑 Semua jurnal dihapus.', '#F57F17');
}

function jurnalExport() {
  if (!jurnalList.length) { showToast('Tidak ada jurnal untuk diexport!','#C62828'); return; }
  const wb = XLSX.utils.book_new();
  const header = ['Tanggal','Kelas','Mata Pelajaran','Jam','Materi/TP','Kegiatan','Hadir','Izin','Sakit','Alfa','Refleksi','Catatan/RTL'];
  const rows = jurnalList.map(j => [
    j.tgl, j.kelas, j.mapel||'-', j.jam, j.materi||'-', j.kegiatan||'-',
    j.hadir.H, j.hadir.I, j.hadir.S, j.hadir.A, j.refleksi||'-', j.catatan||'-'
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [{wch:14},{wch:10},{wch:20},{wch:8},{wch:30},{wch:30},{wch:7},{wch:7},{wch:7},{wch:7},{wch:26},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Guru');
  XLSX.writeFile(wb, 'JurnalGuru_SDN3Kalipang.xlsx');
  showToast('✅ Jurnal berhasil diexport!', '#2E7D32');
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
  const header = ['No','NIP','Nama Guru','Jabatan','Mata Pelajaran','Jenis Kelamin'];
  const rows = guruData.map(g => [g.no, g.nip, g.nama, g.jabatan, g.mapel, g.jk==='L'?'Laki-laki':'Perempuan']);
  const ws = XLSX.utils.aoa_to_sheet([header,...rows]);
  ws['!cols'] = [{wch:5},{wch:20},{wch:26},{wch:22},{wch:30},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, 'Data Guru');
  XLSX.writeFile(wb, 'DataGuru_SDN3Kalipang.xlsx');
  showToast('✅ Data guru diexport!','#2E7D32');
}
