# AGENTS.md — Aturan Baku Pengembangan NG Hotel Management

Dokumen ini adalah **kontrak kerja wajib** untuk setiap AI agent (dan manusia) yang menyentuh repositori ini. Baca sampai habis sebelum mengubah kode.

Dokumentasi kanonik:

| Dokumen | Isi |
| --- | --- |
| `docs/PRD.md` | Perilaku produk, peran, alur UI/UX per modul |
| `docs/TECH_SPEC.md` | Tech stack, struktur folder, skema Supabase, konvensi ID |
| `docs/AUDIT_REPORT.md` | Kondisi aktual, bug, dead code, prioritas perbaikan |
| `AGENTS.md` | Dokumen ini — aturan eksekusi |

Jika kode dan dokumen berbeda, **kode adalah kebenaran**; perbarui dokumen, jangan memaksa kode mengikuti dokumen lama.

---

## 0. Status repositori yang harus diketahui

> **Status P0 sudah diperbaiki.** SyntaxError `reservation.js` (regex terpotong + `\b` menjadi `0x08`) telah dihapus bersama seluruh OCR duplikat, dan ID form KTP sudah disinkronkan. Regresi bisa muncul lagi karena tidak ada CI; **selalu** jalankan pemeriksaan sintaks di bawah sebelum dan sesudah perubahan.

Selalu jalankan pemeriksaan sintaks sebelum dan sesudah perubahan:

```bash
for f in js/app.js js/config/*.js js/utils/*.js js/services/*.js js/modules/*.js; do
  cp "$f" "/tmp/$(basename "$f" .js).mjs"
  node --check "/tmp/$(basename "$f" .js).mjs" || echo "SYNTAX ERROR: $f"
done
```

Jangan menganggap halaman berfungsi hanya karena file terlihat "benar" di editor.

---

## 1. Aturan Arsitektur (TIDAK BOLEH DILANGGAR)

### 1.1 Proyek ini Zero-build. Dilarang menambah toolchain.

**DILARANG:**

- Menginstal atau menambahkan React, Vue, Svelte, Angular, Next, Nuxt, Vite, Webpack, Rollup, Parcel, esbuild, Turbopack, Babel, TypeScript.
- Membuat `package.json`, `vite.config.*`, `webpack.config.*`, `tsconfig.json`, `postcss.config.*` untuk proses build.
- Menjalankan `npm install`, `npm run build`, `npm run dev` sebagai bagian dari alur kerja aplikasi.
- Mengubah `index.html` agar memuat bundle/hasil kompilasi.
- Menambahkan framework CSS berbasis proses build (mis. Tailwind via PostCSS). Tailwind **hanya** via CDN seperti sekarang.

**DIPERBOLEHKAN:**

- Menambah library browser-only via CDN `<script>` (dengan justifikasi kuat dan tanpa mengubah arsitektur).
- Menulis ES module murni di `js/`.
- Menjalankan `node --check` untuk validasi sintaks (bukan build).

**Alasan:** proyek harus tetap bisa di-deploy sebagai file statis, tanpa langkah build, tanpa Node runtime di server.

### 1.2 Struktur wajib

```
index.html          → shell UI (view + modal). Jangan menaruh logika bisnis di sini.
js/app.js           → entry point & satu-satunya tempat binding window.*
js/config/          → inisialisasi client (Supabase)
js/utils/           → helper murni (format tanggal, currency, toast)
js/services/        → lapisan API & logika bisnis yang reusable
js/modules/         → orkestrasi UI per domain (DOM + memanggil services)
```

### 1.3 Urutan pengerjaan fitur baru (WAJIB)

1. Tulis query/API di `js/services/` lebih dulu (mis. `ocrService.js`, `guestService.js`).
2. Buat fungsi service murni: terima parameter, kembalikan data/throw error. **Tanpa** `document.getElementById`.
3. Baru sambungkan ke `js/modules/` sebagai orkestrasi UI.
4. Tambahkan elemen HTML di `index.html` bila perlu (lihat §3).
5. Daftarkan fungsi ke `window` di `js/app.js` bila dipanggil dari atribut inline.

**Dilarang** menaruh `fetch`, `.from(...)`, `.rpc(...)` baru langsung di `js/modules/` bila operasi tersebut bersifat reusable atau punya parsing kompleks. Bila terpaksa (jalur cepat/legacy), beri komentar satu baris alasan dan catat sebagai utang teknis.

### 1.4 Satu sumber kebenaran untuk logika duplikat

Saat ini ada duplikasi yang **tidak boleh diperbanyak**:

| Logika | Lokasi yang ada | Target konsolidasi |
| --- | --- | --- |
| OCR + parsing KTP | Sudah dikonsolidasi: `ocrService.js` (`callOcrSpace`, `parseKtpText`, `blobToBase64`); `reservation.js` hanya mengorkestrasi `processOCRImage` | `ocrService.js` |
| Kompresi gambar | `getCompressedDocBlob` + `getCompressedDocBase64` | satu helper di `utils/` atau `services/` |
| Sanitasi UUID | `folio.js` (`sanitizeUuid`), `group.js` (`sanitizeUuid`), `reservation.js` (`sanitizeId`) | satu util bersama |
| Gender tamu | kolom `gender` (reservation/guestService) vs `sex` (GCF editor) | putuskan satu kolom |
| Konstanta status | string literal tersebar | `js/utils/constants.js` |

---

## 2. Sanitasi Data Sebelum ke Supabase (WAJIB)

Postgres akan menolak string kosong untuk kolom `uuid`, `date`, `time`, dan `numeric`. Setiap nilai dari `<input>` yang bisa kosong **harus** dinormalisasi.

### 2.1 Aturan

| Tipe kolom tujuan | Nilai kosong harus menjadi |
| --- | --- |
| `uuid` | `null` (bukan `""`, bukan `"null"`, bukan `"undefined"`) |
| `date` | `null` (bukan `""`; format `YYYY-MM-DD` bila ada) |
| `time` | `null` (bukan `""`) |
| `numeric` / `int` | `null` atau `0` sesuai makna bisnis — **jangan** `NaN` |
| `text` | `null` bila kosong dan kolom nullable; jangan simpan `"-"` |

### 2.2 Pola yang benar

```js
// UUID
const toUuid = (v) => {
  const s = (v ?? '').toString().trim();
  return s && s !== 'null' && s !== 'undefined' ? s : null;
};

// Date
const toDate = (v) => {
  const s = (v ?? '').toString().trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

// Text
const toText = (v) => {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : s;
};

// Number
const toNum = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
```

### 2.3 Pola yang dilarang

```js
// SALAH — string kosong dikirim sebagai uuid
room_id: document.getElementById('res-room-number').value

// SALAH — date kosong dikirim apa adanya
birthdate: document.getElementById('res-birth-date').value

// SALAH — NaN masuk ke numeric
amount: parseFloat(document.getElementById('x').value)
```

### 2.4 Akses DOM wajib null-safe

Banyak bug saat ini berasal dari `getElementById(...)` yang mengembalikan `null`:

```js
// SALAH
const nik = document.getElementById('res-id-card').value.trim();

// BENAR
const nik = (document.getElementById('res-id-card-no')?.value || '').trim();
```

Aturan tambahan: **jangan menambah** ketergantungan pada ID yang tidak ada di `index.html`. Verifikasi dengan grep sebelum menulis kode:

```bash
grep -n 'id="res-id-card-no"' index.html
```

---

## 3. Mengedit `index.html` (HATI-HATI)

`index.html` berukuran ±335 KB / 4.306 baris, memuat 11 view dan 50+ modal. Perubahan sekecil apa pun berisiko.

### 3.1 Aturan wajib

1. **Edit terisolasi**: satu perubahan = satu blok kecil. Jangan reformat, jangan reindent, jangan hapus baris kosong massal.
2. **Jangan memindahkan modal** atau mengubah urutan nesting tanpa alasan kuat.
3. **Pertahankan `id` yang sudah dipakai JS.** Mengganti `id` tanpa meng-update JS akan mematikan fitur tanpa error yang jelas.
4. **Sebelum mengganti/menghapus `id`**, cek referensi:

   ```bash
   grep -rn "res-guest-name" js/ index.html
   ```

5. **Satu sumber markup per modal.** Jangan menambah modal duplikat dengan fungsi sama.
6. **Gunakan diff minimal** dan baca ulang blok 20 baris sebelum & sesudah area yang diubah.
7. Untuk perubahan besar (memecah modal menjadi komponen), **jangan** dilakukan sekaligus. Ajukan rencana dan pisahkan per PR.

### 3.2 Konvensi ID (ringkas)

| Pola | Contoh |
| --- | --- |
| Field form | `res-guest-name`, `gcf-email`, `invoice-prefix` |
| Modal (camelCase) | `reservationModal`, `folioModal` |
| Modal (kebab) | `modal-gcf-editor`, `modal-eod-report` |
| Tabel body | `frontdesk-dashboard-tbody` |
| Tombol aksi | `btn-scan-ocr`, `btn-run-night-audit` |
| Tab settings | `tab-btn-rooms` / `tab-content-rooms` |
| Tab reservasi | `res-tab-btn-details` / `res-tab-container-details` |
| View container | `frontdesk-view`, `admin-settings-view` |
| Hidden PK | `edit-room-id`, `invoice-setting-id` |

Detail lengkap: `docs/TECH_SPEC.md` §8.

### 3.3 ID yang saat ini tidak sinkron (jangan tambah ketergantungan)

Tidak ada lagi untuk modal reservasi. Gunakan `res-identity-type` (KTP/Paspor/SIM), input teks `res-city` dan `res-province`; jangan menghidupkan kembali `res-country`, `res-city-select`, atau `res-city-manual`.

Bila memperbaiki: pilih satu arah — **tambahkan elemen** atau **ubah JS agar memakai ID yang ada**. Jangan membiarkan keduanya setengah jalan.

---

## 4. Binding ke `window` (WAJIB untuk handler inline)

`index.html` memanggil fungsi lewat atribut inline (`onclick="openModal()"`). Fungsi hanya tersedia bila di-bind di `js/app.js`:

```js
import { openModal } from './modules/reservation.js';
window.openModal = openModal;
```

Checklist saat menambah fungsi yang dipanggil dari HTML:

1. `export function namaFungsi(...)` di modul.
2. Import di `js/app.js` pada blok modul yang sesuai.
3. Tambahkan `window.namaFungsi = namaFungsi;` di blok binding modul tersebut.
4. Verifikasi dengan grep:

   ```bash
   grep -rn "window.namaFungsi" js/app.js
   grep -rn "namaFungsi(" index.html
   ```

5. Jangan membuat binding ganda di modul **dan** di `app.js` untuk fungsi yang sama (beberapa modul legacy melakukannya; jangan ditiru).

---

## 5. Akses Data & Backend

### 5.1 Client

Selalu impor dari config, jangan membuat client baru:

```js
import { supabaseClient } from '../config/supabase.js';
```

### 5.2 RPC-first, fallback hanya bila sudah ada polanya

- Operasi keuangan (posting, transfer, void, checkout) memakai RPC lalu fallback insert langsung.
- **Night audit, open shift, close shift tidak punya fallback.** Jangan menambahkan fallback yang melewati validasi server untuk operasi ini.
- Jangan mengubah nama parameter RPC tanpa memverifikasi signature di database.

### 5.3 Business date

Gunakan `window.currentHotelDate` (sumber: `system_settings.current_hotel_date`) untuk semua kolom `hotel_business_date` dan filter sesi kasir. Jangan memakai `new Date()` langsung untuk tanggal bisnis.

### 5.4 Tabel & kolom

- Jangan mengarang nama kolom. Cari bukti di kode lain:

  ```bash
  grep -rn "from('guest_card_files')" -A 20 js/
  ```

- Skema hasil inferensi ada di `docs/TECH_SPEC.md` §5. Kolom bertanda *(asumsi)* belum terverifikasi.
- Bila menambah kolom baru, catat di `docs/TECH_SPEC.md` dan sebutkan bahwa nilainya belum diverifikasi ke database.

### 5.5 Storage

- Bucket: `guest_documents`.
- Pola nama file: `{Hotel}_{ResNumber}_{GuestName}_ID.jpg`.
- Selalu kompres sebelum upload (maks 800 px, JPEG 0.7).
- Jangan mengunggah dokumen identitas ke lokasi publik lain.

---

## 6. Gaya Kode

- ES modules, `const`/`let`, template literal, async/await.
- 4 spasi indentasi, kutip tunggal untuk string JS.
- Nama fungsi: `handleX` (event), `fetchX` (baca), `renderX` (DOM), `openX`/`closeX` (modal), `saveX`/`deleteX` (mutasi).
- Komentar hanya untuk hal yang tidak jelas dari kode (invariant, workaround, urutan yang sensitif). Jangan menulis komentar naratif/changelog.
- Jangan menambah `console.log` untuk debugging permanen; gunakan `console.warn`/`console.error` untuk kondisi error.
- Gunakan `showToast(message, type)` untuk feedback non-blocking. **Jangan menambah `alert()`/`prompt()` baru**; yang lama boleh dimigrasikan bertahap.
- Format uang: `formatCurrency`/`formatRupiah`. Format tanggal DB: `formatDateISO`.
- Jangan menambah string status baru. Gunakan nilai yang sudah ada di `docs/TECH_SPEC.md` §5.4.

---

## 7. Pengujian & Verifikasi

### 7.1 Minimum sebelum commit

1. `node --check` untuk **semua** file JS (lihat §0).
2. Grep ID: pastikan setiap `getElementById('x')` baru punya elemen `id="x"` di `index.html`.
3. Jalankan aplikasi lokal:

   ```bash
   python3 -m http.server 8000
   ```

4. Buka browser, cek Console: tidak ada error, `window.supabaseClient` ada, `window.initApp` ada.
5. Uji alur yang diubah (minimal: buka modal → isi → simpan → refresh).

### 7.2 E2E

`test_guest_lifecycle.py` (Playwright) menulis data **nyata** ke Supabase. Jangan jalankan ke database produksi.

### 7.3 Definition of Done

- [ ] `node --check` bersih untuk semua modul.
- [ ] Tidak ada `getElementById(...).value` tanpa guard untuk ID yang tidak pasti.
- [ ] Nilai kosong dinormalisasi ke `null` untuk uuid/date/time.
- [ ] Fungsi baru ter-bind di `app.js` bila dipanggil dari HTML.
- [ ] `docs/` diperbarui bila perilaku/skema berubah.
- [ ] Tidak ada dependency/framework baru.

---

## 8. Larangan Lain

1. **Jangan** commit screenshot baru, `__pycache__/`, `server.log`, atau file besar ke root. Artefak lama sudah ada; jangan menambah.
2. **Jangan** menghapus file screenshot lama tanpa izin eksplisit.
3. **Jangan** mengubah `js/config/supabase.js` untuk menaruh service role key atau secret apa pun.
4. **Jangan** melakukan `git push` ke `main`/`master` atau membuka PR tanpa permintaan eksplisit.
5. **Jangan** merapikan seluruh `index.html` dalam satu commit "cleanup".
6. **Jangan** mengubah perilaku bisnis (perhitungan pajak, over/short, balance, status) tanpa mencatat alasannya di deskripsi PR.
7. **Jangan** menonaktifkan/menghapus validasi (mis. balance ≠ 0 saat checkout, kamar harus VC) demi "memperlancar" testing.

---

## 9. Perintah Berguna

```bash
# Daftar tabel yang diakses
grep -rho "\.from('[a-z_0-9]*'" js | sed "s/.from('//;s/'//" | sort | uniq -c | sort -rn

# Daftar RPC
grep -rho "\.rpc('[a-z_0-9]*'" js | sort -u

# ID HTML yang dicari JS tapi tidak ada
python3 - <<'EOF'
import re, glob
html = open('index.html', encoding='utf-8', errors='replace').read()
ids = set(re.findall(r'\bid="([^"]+)"', html))
for f in glob.glob('js/**/*.js', recursive=True):
    src = open(f, encoding='utf-8', errors='replace').read()
    missing = {m for m in re.findall(r"getElementById\(\s*['\"]([^'\"]+)['\"]", src) if m not in ids}
    if missing:
        print(f, '->', ', '.join(sorted(missing)))
EOF

# Handler inline tanpa definisi
python3 - <<'EOF'
import re, glob
html = open('index.html', encoding='utf-8').read()
calls = set(re.findall(r'on\w+="(?:window\.)?([A-Za-z_]\w*)\(', html))
defined = set()
for f in glob.glob('js/**/*.js', recursive=True):
    s = open(f, encoding='utf-8', errors='replace').read()
    defined |= set(re.findall(r'window\.([A-Za-z_]\w*)\s*=', s))
    defined |= set(re.findall(r'export\s+(?:async\s+)?function\s+([A-Za-z_]\w*)', s))
    defined |= set(re.findall(r'function\s+([A-Za-z_]\w*)', s))
print(sorted(c for c in calls if c not in defined))
EOF
```

---

## 10. Prioritas Perbaikan (rujukan: `docs/AUDIT_REPORT.md`)

| Prioritas | Pekerjaan |
| --- | --- |
| P0 | **Selesai** — SyntaxError `reservation.js`, ID NIK (`res-id-card-no`), serta simpan/edit reservasi dan autofill KTP |
| P1 | **P1-1 s/d P1-5 selesai** — OCR dikonsolidasi ke `ocrService.js`, listener ganda dihapus, gender dinormalisasi, autofill edit lengkap, KTP tersimpan otomatis ke GCF (upsert via `id_card_no`), selector tipe identitas, kewarganegaraan `Indonesia` |
| P2 | Autentikasi/role, RLS audit, enkripsi OCR key, proxy OCR |
| P3 | Konstanta status terpusat, CI `node --check`, pemisahan modal dari `index.html` |

Kerjakan berurutan. Jangan memulai P1 sebelum P0 hijau.
