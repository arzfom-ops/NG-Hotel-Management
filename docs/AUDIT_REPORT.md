# AUDIT REPORT — NG Hotel Management (Hotel PMS)

| Item | Nilai |
| --- | --- |
| Tanggal audit | 2026-11-26 |
| Commit yang diaudit | `e0f800e` (merge PR #161, `main`) |
| Cakupan | `index.html`, `js/app.js`, `js/config/`, `js/utils/`, `js/services/`, `js/modules/` |
| Metode | Pembacaan statis seluruh source, `node --check` per modul, pemetaan `supabase.from()/rpc()`, pencocokan `id` HTML vs `getElementById()` |
| Batas audit | Tidak ada koneksi langsung ke Supabase. Skema tabel/kolom **diinferensi** dari query di kode dan dokumen SQL/dokumentasi lama. Setiap kolom yang tidak bisa dipastikan diberi catatan asumsi. |
| Aturan sesi | Hanya file dokumentasi yang diubah. Tidak ada kode aplikasi yang disentuh. |

> **Catatan status (2026-11-26, setelah audit).** Seluruh temuan **P0 (P0-1 s/d P0-4)** dan **P1-1 s/d P1-5** sudah diperbaiki: OCR dikonsolidasi ke `js/services/ocrService.js`, listener ganda dihapus, gender dinormalisasi, seluruh field KTP di-populate saat edit, data KTP otomatis disimpan ke `guest_card_files` (upsert berdasarkan `id_card_no`), selector tipe identitas (KTP/Paspor/SIM) tersedia, dan default kewarganegaraan dinormalisasi ke `Indonesia`. Isi laporan di bawah dipertahankan sebagai rekaman kondisi saat audit. Masih terbuka: P1-6 s/d P1-10.

---

## 1. Ringkasan Eksekutif

Aplikasi adalah SPA *zero-build* (Vanilla JS ES6 Modules + Tailwind CDN + Supabase JS v2). Secara fitur, cakupannya sudah sangat luas: frontdesk & tape chart, reservasi, group booking, folio pribadi/master, kasir & shift, night audit, laporan, housekeeping, NSG, corporate, dan GCF (Guest Card File).

Namun hasil audit menemukan **satu cacat blocking yang membuat seluruh aplikasi tidak bisa dijalankan**:

> `js/modules/reservation.js` **gagal di-parse** (SyntaxError) pada baris 3245–3251. Karena `js/app.js` meng-`import` modul tersebut, seluruh rantai ES module berhenti. Akibatnya `window.*` binding tidak pernah terpasang, dan semua `onclick="..."` di `index.html` menjadi tidak berfungsi. Halaman akan tampak kosong/statis tanpa data.

Temuan lain yang bersifat material: mismatch `id` HTML vs JS pada form reservasi (NIK, country/city, identity type), duplikasi implementasi OCR (dua fungsi berbeda + satu service yang tidak dipakai), dan KTP data yang hilang saat edit reservasi.

**Status keseluruhan: fitur ±90% terpasang, tetapi rilis saat ini TIDAK RUNNING (build/runtime broken).**

---

## 2. Status per Modul

Legenda: **Selesai** = terpasang & konsisten dengan HTML · **Parsial** = ada gap/bug material · **Belum Terhubung** = kode ada tapi tidak dipakai UI.

| Modul / File | LOC | Status | Catatan singkat |
| --- | ---: | --- | --- |
| `js/app.js` | 1218 | **Parsial** | Bootstrap, `switchView`, drag-select, realtime, binding ±370 export ke `window` (376 assignment). Ikut gagal total karena import `reservation.js` rusak. |
| `js/config/supabase.js` | 9 | **Selesai** | Client Supabase + `window.supabaseClient`. URL & publishable key hardcoded. |
| `js/utils/formatters.js` | 119 | **Selesai** | Tanggal, currency, badge status, `showToast`. |
| `js/modules/frontdesk.js` | 1323 | **Selesai** | Dashboard 4 tab, DataGrid, Tape Chart 14 hari, Room Forecast 14 hari, drag-select, realtime `rooms`. |
| `js/modules/reservation.js` | 3552 | **Rusak (blocking)** | SyntaxError; mismatch ID NIK/city/country; OCR ganda; KTP tidak tampil saat edit. |
| `js/modules/group.js` | 977 | **Selesai** | Group booking + allotment, rooming list, split group (RPC), cancel group. |
| `js/modules/folio.js` | 2828 | **Selesai** | Folio pribadi/master, charge/payment/paid-out, void, transfer bill, routing, checkout. |
| `js/modules/cashier.js` | 803 | **Selesai** | Sesi kasir, blind drop denomination, over/short, laporan shift 4 seksi. |
| `js/modules/shift.js` | 554 | **Parsial** | Buka/tutup shift (RPC), logbook. `shift_logbooks` di-`order('opened_at')` — kolom perlu diverifikasi. |
| `js/modules/night_audit.js` | 860 | **Selesai** | Pre-audit check, eksekusi night audit (RPC), EOD report, riwayat, rekonsiliasi kasir. |
| `js/modules/reports.js` | 472 | **Selesai** | Daily Financial Report & Daily Revenue Report via RPC, cetak. |
| `js/modules/operations.js` | 863 | **Selesai** | Housekeeping, blok kamar OOO/OOS, update status kamar, NSG, corporate, cancel list + refund/fee. |
| `js/modules/guestProfiles.js` | 1014 | **Parsial** | GCF master, editor 3 tab, kontak, contract rate, merge, histori. Menulis `sex`, sedangkan modul lain menulis `gender`. |
| `js/modules/settings.js` | 1776 | **Selesai** | 10 tab konfigurasi properti + OCR API key di tab Invoice Setting. |
| `js/services/guestService.js` | 289 | **Selesai** | RPC pencarian GCF + fallback query, get/save, apply ke form reservasi. |
| `js/services/ocrService.js` | 194 | **Belum Terhubung** | `callOcrSpace()` & `parseKtpText()` tidak di-import di mana pun (dead code). |
| `index.html` | 4306 | **Parsial** | Struktur & modal lengkap; beberapa `id` yang dicari JS tidak ada. |

---

## 3. Progres Fitur OCR.space KTP/Paspor — Verifikasi Klaim

Premis tugas menyebut Sub-Tahap 3B & 3C "masih tertunda". Hasil verifikasi kode **berbeda**: keduanya sudah ditulis, tetapi fitur tetap tidak berfungsi karena modulnya rusak.

| Komponen yang diminta diverifikasi | Kondisi aktual | Bukti |
| --- | --- | --- |
| `js/services/ocrService.js` sudah ada | **Ya, ada** — tetapi **tidak dipakai** | File 194 baris; tidak ada `import ... ocrService` di seluruh `js/`. `server.log` juga tidak memuat request file ini. |
| Form KTP di modal reservasi | **Ya** — lengkap (NIK, tempat/tgl lahir, gender, alamat, RT/RW, kel/desa, kecamatan, kab/kota, provinsi, kewarganegaraan) | `index.html:1587–1668` |
| Input `#setting-ocr-api-key` | **Ya** — di tab Settings → Invoice Setting | `index.html:3389` |
| Penyimpanan API key ke `system_settings` | **Ya** — `upsert({ setting_key:'ocr_space_api_key' })` saat simpan form | `js/modules/settings.js:647–666` (get) & `699–712` (upsert) |
| Tombol `#btn-scan-ocr` | **Sudah ada** (bukan tertunda) | `index.html:1572` — `onclick="processOCRImage()"` |
| Wiring di `reservation.js` (Sub-Tahap 3B & 3C) | **Sudah ada, tapi ganda** — `processOCRImage()` + listener `DOMContentLoaded` untuk tombol yang sama | `js/modules/reservation.js:3386–3540` dan `3542–3553` |

### Kesimpulan OCR
1. **Sub-Tahap 3B/3C secara kode sudah selesai**, bukan tertunda. Yang tertunda adalah **perbaikan**, bukan penambahan.
2. Fitur **tidak dapat dipakai** karena dua hal:
   - `reservation.js` gagal parse → `processOCRImage` tidak pernah terdefinisi.
   - Klik tombol memicu **dua request** ke OCR.space (inline `onclick` + `addEventListener`), sehingga kuota API terbuang 2× per klik.
3. Ada **dua implementasi OCR paralel**:
   - `scanDocumentOcr()` + `parseOcrText()` (`:3100`, `:2941`) → menargetkan `#btn-scan-doc` yang **tidak ada** di HTML → dead code.
   - `processOCRImage()` + `parseKTPData()` (`:3386`, `:3242`) → dipakai tombol nyata, tetapi `parseKTPData` justru bagian yang rusak sintaksnya.
4. `ocrService.js` seharusnya menjadi satu-satunya sumber logika OCR. Saat ini isinya duplikat dari logika di `reservation.js` dan tidak dipakai.

### Catatan ID
Premis menyebut `#modal-reservation`. Di HTML, id modal reservasi adalah **`reservationModal`** (`index.html:1473`). Tidak ada elemen `#modal-reservation`.

---

## 4. Temuan Kritis (P0) — Harus Diperbaiki Sebelum Rilis

### P0-1. SyntaxError di `js/modules/reservation.js` (aplikasi tidak bisa boot)

`node --check` menghasilkan:

```
/tmp/reservation.mjs:3245
    const lines = text.split(/
                             ^
SyntaxError: Invalid regular expression: missing /
```

Detail kerusakan (byte-level):

| Baris | Isi rusak | Seharusnya |
| ---: | --- | --- |
| 3245–3247 | Regex literal terpotong oleh newline: `text.split(/` + baris `?` + `/)` | `text.split(/\r?\n/)` |
| 3251 | `text.match(/\x08\d{16}\x08/)` — karakter `\b` berubah menjadi **0x08 (backspace)** | `text.match(/\b\d{16}\b/)` |
| 3296 | idem (0x08 pada `\b`) | `/\b(\d{2})[-/.](\d{2})[-/.](\d{4})\b/` |
| 3327 | idem | `/\b\d{2,3}\s*\/\s*\d{2,3}\b/` |
| 3379 | idem | `/\bWNI\b|INDONESIA/i` |

Dampak berantai: `app.js` → `import './modules/reservation.js'` gagal → seluruh graph module tidak dieksekusi → `initApp()` tidak jalan, semua handler `window.*` kosong, UI mati.

### P0-2. `#res-id-card` tidak ada, padahal dipakai tanpa guard

| Lokasi | Kode | Masalah |
| --- | --- | --- |
| `js/modules/reservation.js:2392` | `document.getElementById('res-id-card').value.trim()` | `null.value` → TypeError saat **menyimpan** reservasi |
| `js/modules/reservation.js:1238` | `document.getElementById('res-id-card').value = ...` | TypeError saat **membuka edit** reservasi |
| `js/services/guestService.js:207` | `document.getElementById('res-id-card')` | Null-safe (dipakai dengan `if`), tetapi tidak pernah mengisi apa pun |

HTML hanya menyediakan **`#res-id-card-no`** (`index.html:1587`). Artinya jalur simpan/edit reservasi selalu gagal.

### P0-3. Kontrol Country/City tidak sinkron

JS mencari `#res-country`, `#res-city-select`, `#res-city-manual`, `#res-city-select-container`. HTML hanya punya **`#res-city`** (input teks) dan `#res-province`.

Konsekuensi:
- `populateResCityDropdown()` langsung `return` (elemen tidak ada).
- `handleResCountryChange()` no-op.
- Saat simpan, `cityVal` diambil dari `#res-city-select` → `null` → **kota tamu tidak pernah tersimpan**.
- `#res-city` yang diisi user (atau hasil OCR) diabaikan.

### P0-4. `#res-identity-type` tidak ada

JS memakai fallback `?.value || 'KTP'`, jadi tidak crash, tetapi pilihan identitas (KTP/Paspor) tidak pernah bisa diubah dari UI. OCR pun tidak bisa men-set tipe identitas.

**Status: selesai.** `index.html` kini punya `<select id="res-identity-type">` (opsi `KTP`, `PASSPORT`/Paspor, `SIM`) di samping `#res-id-card-no`. Nilainya dibaca saat simpan, di-populate saat `openEditReservation`/autofill GCF, dan di-set otomatis oleh `processOCRImage()` lewat `document_type` dari `parseKtpText()`.

---

## 5. Temuan Tinggi (P1)

| ID | Temuan | Lokasi | Dampak |
| --- | --- | --- | --- |
| P1-1 | OCR dipanggil 2× per klik (inline `onclick` + `addEventListener`) | `index.html:1572` + `reservation.js:3542–3553` | Kuota OCR.space terbuang; race condition UI |
| P1-2 | OCR menulis `LAKI-LAKI`/`PEREMPUAN` ke `<select>` yang opsinya `Laki-laki`/`Perempuan` | `reservation.js:3477–3480` vs `index.html:1622–1625` | `select.value` jadi kosong → gender hilang |
| P1-3 | Field KTP tidak di-populate saat `openEditReservation` (birth place, gender, RT/RW, kel/desa, kecamatan, provinsi, kota) | `reservation.js:1180–1275` | Data tersimpan tetapi tampak hilang saat edit → berisiko tertimpa `null` |
| P1-4 | KTP hanya tersimpan ke `guest_card_files` jika sedang edit GCF atau checkbox "Save to GCF" dicentang | `reservation.js:2484–2525` | Reservasi tamu baru tanpa GCF → seluruh data KTP dibuang. **Status: selesai** — `handleSaveReservation` otomatis membuat/memperbarui profil bila ada data identitas dan tamu belum tertaut, lalu menautkan `guest_card_id` |
| P1-5 | `#res-nationality` punya `value="WNI / Indonesia"` dan nilainya disimpan apa adanya | `index.html:1665`, `reservation.js:2417` | Kolom nationality berisi string tidak baku. **Status: selesai** — default UI kini `Indonesia` |
| P1-6 | Dua fungsi gender: `gender` (reservasi/guestService) vs `sex` (GCF editor) | `guestService.js:155`, `guestProfiles.js:651` | Data gender terpecah dua kolom, saling menimpa |
| P1-7 | `shift_logbooks` diurutkan dengan `opened_at` | `shift.js:385` | Jika kolom tidak ada → query error → logbook kosong |
| P1-8 | `closeRoomingListModal` didefinisikan di dua modul (`reservation.js` & `group.js`); `app.js` hanya memakai versi `group.js` | `reservation.js`, `group.js`, `app.js` | Penutupan modal rooming list dari jalur reservasi berpotensi salah target |
| P1-9 | `guest_card_contacts` / `guest_card_contract_rates` dibaca, tetapi kode menulis ke `guest_contacts` / `contract_rates` | `guestService.js:118–140` | Relasi kontak/rate tidak pernah terbaca lewat service; error ditelan `try/catch` kosong |
| P1-10 | `group_bookings.contact_person` dipakai menyimpan JSON `{check_in_date, check_out_date, status}` | `reservation.js:2712–2724`, `group.js:934–942` | Kolom teks dipakai sebagai metadata; rawan gagal parse |

---

## 6. Tech Debt, Dead Code, dan Inkonsistensi

### 6.1 Dead code / duplikasi

| Item | Lokasi | Status |
| --- | --- | --- |
| `js/services/ocrService.js` (`callOcrSpace`, `parseKtpText`) | seluruh file | Tidak pernah di-import |
| `scanDocumentOcr()` | `reservation.js:3100` | Menargetkan `#btn-scan-doc` yang tidak ada; tetap diekspos ke `window` |
| `parseOcrText()` | `reservation.js:2941` | Hanya dipakai `scanDocumentOcr()` |
| `getCompressedDocBase64()` | `reservation.js:3080` | Duplikat `getCompressedDocBlob()` (`:1115`) |
| `webcamStream` | diimpor `app.js:79` | Tidak dipakai di `app.js` |
| `openGroupRoomingListModal`, `handleSaveGroupRoomingList` (reservation) | `reservation.js` | Overlap fungsi dengan `group.js` |
| `#daily-rate-0`, `#daily-meal-0` | `reservation.js` | Dibuat dinamis, bukan elemen statis (false positive, bukan bug) |

### 6.2 Inkonsistensi status (string enum)

Satu status punya banyak ejaan yang harus ditangani manual di banyak tempat:

- Reservasi: `Reserved`, `GUARANTEED`, `TENTATIVE`, `6PM_HOLD`, `ORAL_CONFIRM`, `Checkin`, `CHECKED_IN`, `Checked In`, `Checkout`, `CHECKED_OUT`, `Cancelled`, `CANCELLED`, `INACTIVE` (NSG), `ACTIVE` (NSG).
- Kamar: `VC`, `VD`, `OC`, `OD`, `OOO`, `OOS`, `CLEAN`, `DIRTY`.

Setiap filter melakukan `||` berlapis. Risiko: reservasi "hilang" dari dashboard/tape chart karena ejaan tidak masuk daftar.

### 6.3 Isu struktur & maintainability

1. `index.html` = 4.306 baris / ±335 KB, memuat 37 modal dan 11 view. Setiap perubahan berisiko.
2. Tidak ada `package.json`, linter, formatter, atau build step — tidak ada *static analysis* otomatis (inilah sebabnya SyntaxError bisa lolos ke `main`).
3. 157 file di root, mayoritas screenshot (±11 MB) + `__pycache__/` ikut ter-commit.
4. Satu-satunya test adalah `test_guest_lifecycle.py` (Playwright) yang butuh server lokal + Supabase live; tidak ada unit test.
5. Banyak `alert()`/`prompt()` (contoh: alasan cancel lewat `prompt`) — tidak konsisten dengan `showToast()`.
6. Day-change detector melakukan `alert()` lalu `window.location.reload()` tiap 60 detik bila tanggal berubah (`app.js`) — bisa memutus input user.
7. `#supabase-status` disembunyikan (`hidden`) saat sukses, sehingga pesan error koneksi hanya muncul pada kondisi gagal.

### 6.4 Risiko keamanan

| Risiko | Detail |
| --- | --- |
| Kredensial di repo | `SUPABASE_URL` + `sb_publishable_...` hardcoded di `js/config/supabase.js`. Publishable/anon key memang publik by design, tetapi tetap harus dibatasi lewat RLS. |
| API key OCR plaintext | Disimpan di `system_settings.ocr_space_api_key` tanpa enkripsi, lalu di-cache di `window.cachedOcrApiKey`. Siapa pun yang bisa membaca tabel bisa mengambil key. |
| Tidak ada otorisasi per peran | Tidak ada layer auth/role. "Admin" vs "Front Desk" vs "Kasir" hanya konvensi UI. `cashierName` diambil dari `localStorage`, default `'Admin'`. |
| Panggilan langsung ke OCR.space dari browser | Key terekspos di DevTools/network. Untuk produksi sebaiknya diproxy lewat edge function. |
| RLS tidak dapat diverifikasi | Karena tidak ada akses DB, kepatuhan RLS tidak bisa diaudit dari repo. |

### 6.5 Tabel "hantu" — dirujuk kode tetapi keberadaannya belum terverifikasi

Temuan tambahan (Batch 1, 2026-11-27): lima nama tabel/bucket berikut dipakai atau diasumsikan di kode, tetapi keberadaannya di database **belum dapat dipastikan**. Bila tabel tidak ada, query akan gagal (sebagian error ditelan `try/catch` sehingga bug tidak terlihat). Perbaikan kode ditunda ke **Batch 2**.

| Nama | Jenis | Referensi kode | Catatan |
| --- | --- | --- | --- |
| `folio_routing_rules` | tabel | `js/modules/folio.js:2143, 2240, 2255`; `js/modules/reservation.js:2871, 2883` | Dipakai untuk routing charge folio. Jika tidak ada, fitur routing/transfer gagal. Belum diverifikasi. |
| `guest_card_contacts` | tabel | `js/services/guestService.js:108` | Dibaca di dalam `try/catch` yang menelan error; kemungkinan tabel legacy/opsional. |
| `guest_card_contract_rates` | tabel | `js/services/guestService.js:118` | Sama seperti di atas; hanya dibaca, error diabaikan. |
| `guest_documents` | **storage bucket** (bukan tabel) | `js/modules/reservation.js:2572, 2583` via `storage.from('guest_documents')` | Hanya dipakai sebagai bucket Storage untuk dokumen identitas. Jangan diakses lewat `supabase.from('guest_documents')`. |
| `cashier_shifts` | tabel | Tidak ada referensi di kode | Tidak dipakai sama sekali; tabel shift yang aktual adalah `cashier_sessions` (`cashier.js`, `shift.js`, `night_audit.js`). Kemungkinan nama lama/rencana. |

---

## 7. Peta Skema yang Diinferensi (ringkas)

Detail kolom ada di `docs/TECH_SPEC.md` §4. Ringkasnya:

- **35 tabel** diakses via `supabase.from()`.
- **14 RPC** dipanggil via `supabase.rpc()`.
- **1 storage bucket**: `guest_documents` (dokumen identitas, public URL).
- Kunci pengaturan: `system_settings.current_hotel_date`, `system_settings.ocr_space_api_key`.
- Kolom baru KTP di `guest_card_files`: `birth_place`, `birthdate`, `gender`, `rt_rw`, `village`, `sub_district`, `province` (plus `sex` yang dipakai GCF editor — duplikat fungsi `gender`).

---

## 8. Rekomendasi Berurutan

### P0 — agar aplikasi hidup kembali
1. Perbaiki `reservation.js:3245–3251, 3296, 3327, 3379` (regex + `\b`). Verifikasi dengan `node --check`.
2. Samakan ID: gunakan `#res-id-card-no` di `reservation.js` (atau tambahkan `#res-id-card`), dan ganti akses non-null-safe menjadi null-safe.
3. Selesaikan keputusan desain city/country: **pilih salah satu** — pertahankan input teks `#res-city` (paling murah) atau pasang kembali `select` + `manual` + `country`.
4. Tambahkan `#res-identity-type` (select KTP/Paspor) atau hapus ketergantungan padanya.

### P1 — integritas data
5. Hapus salah satu implementasi OCR; jadikan `ocrService.js` satu-satunya sumber, lalu panggil dari `reservation.js`.
6. Hapus listener ganda `#btn-scan-ocr`.
7. Normalisasi gender ke satu kolom (`gender`) dan satu format (`Laki-laki`/`Perempuan`).
8. Populate seluruh field KTP di `openEditReservation`.
9. Pastikan data KTP tersimpan walau "Save to GCF" tidak dicentang (buat GCF minimal otomatis atau simpan ke reservasi).
10. Ganti `prompt()` cancel reason dengan modal.

### P2 — kualitas
11. Tambahkan `npm run lint`/`node --check` di CI meski tanpa bundler.
12. Satukan konstanta status ke satu modul (`js/utils/constants.js`).
13. Bersihkan screenshot/`__pycache__` dari repo.
14. Pindahkan pemanggilan OCR.space ke edge function bila akan dipakai produksi.

---

## 9. Asumsi & Keterbatasan

1. Struktur tabel/kolom **tidak diverifikasi ke database**. Semua kolom berasal dari `select()`, payload `insert/update`, dan nama field di dokumentasi lama.
2. Kolom bertanda "fallback alias" (mis. `phone_number`, `special_discount`, `discount`, `company_name`, `first_name`, `last_name`, `notes`, `telefax`, `country_code`, `nationality_code`) **mungkin tidak ada** di tabel; kode memakainya secara defensif.
3. Keberadaan constraint FK `fk_reservations_guest_card` diasumsikan benar karena dipakai sebagai hint join di `frontdesk.js`.
4. Nama parameter RPC (`p_report_date`, `p_business_date`, dll.) diasumsikan sesuai definisi fungsi di database.
5. `shift_logbooks.opened_at` dan `night_audit_history.*` tidak dapat dipastikan.
6. Audit ini statis; tidak ada pengujian runtime terhadap Supabase, kecuali `node --check` untuk sintaks.
