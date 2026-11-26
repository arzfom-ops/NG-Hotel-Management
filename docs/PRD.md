# PRD — NG Hotel Management (Hotel Property Management System)

| Item | Nilai |
| --- | --- |
| Versi dokumen | 2.0 |
| Tanggal | 2026-11-26 |
| Status | Sinkron dengan commit `e0f800e` |
| Dokumen terkait | `docs/TECH_SPEC.md` (arsitektur & skema), `docs/AUDIT_REPORT.md` (kondisi & temuan), `AGENTS.md` (aturan pengembangan) |

> Catatan: PRD ini menggantikan `docs/PRD_HOTEL_PMS.md` (legacy) dan sudah mencakup modul yang sebelumnya belum terdokumentasi: GCF, housekeeping, NSG, corporate, laporan, shift logbook, serta fitur KTP + OCR.space.

---

## 1. Ringkasan Produk

**NG Hotel Management** adalah aplikasi Property Management System (PMS) berbasis web untuk hotel skala kecil–menengah. Aplikasi berjalan sepenuhnya di browser sebagai SPA tanpa proses build, dan menggunakan Supabase sebagai backend (PostgreSQL + PostgREST + RPC + Storage).

Tujuan produk:

1. Menggantikan papan tulis/Excel operasional front office dengan satu sumber data.
2. Menjaga konsistensi siklus hidup tamu: reservasi → check-in → posting tagihan → pelunasan → check-out → night audit.
3. Menyediakan kontrol kasir (shift, blind drop, over/short) dan jejak audit transaksi.
4. Mempercepat registrasi tamu Indonesia melalui form berbasis KTP dan pemindaian OCR.

### 1.1 Prinsip produk

| Prinsip | Konsekuensi desain |
| --- | --- |
| Cepat dipakai di front desk | Satu layar: dashboard + tape chart, modal-based editing, tanpa pindah halaman. |
| Data tamu sekali input | GCF (Guest Card File) sebagai master; autofill ke reservasi. |
| Semua uang harus terjejak | Setiap charge/payment masuk `folio_transactions`, terikat sesi kasir & business date. |
| Operasional tidak boleh "hilang" | Status kamar (VC/VD/OC/OD/OOO/OOS) dan blokir kamar tercatat. |
| Identitas tamu sesuai konteks Indonesia | Form KTP: NIK 16 digit, tempat/tanggal lahir, RT/RW, kel/desa, kecamatan, kab/kota, provinsi. |

---

## 2. Peran Pengguna

Aplikasi **belum memiliki autentikasi/otorisasi berbasis peran** di sisi klien. Peran di bawah adalah **persona operasional** yang menentukan modul mana yang dipakai sehari-hari.

### 2.1 Admin / Hotel Manager

| Aspek | Detail |
| --- | --- |
| Tujuan | Menjaga konfigurasi properti dan kebijakan harga tetap benar. |
| Modul utama | Settings (10 tab), Night Audit, Laporan (DRR & Daily Report), Corporate, GCF merge. |
| Kewenangan khas | Mengisi **OCR.space API Key**, prefix invoice & terms, rate plan, tax & service, payment method, outlet & department. |
| KPI | Kelengkapan master data, akurasi rate, tidak ada audit yang tertunda. |

### 2.2 Front Desk / Resepsionis

| Aspek | Detail |
| --- | --- |
| Tujuan | Memproses kedatangan, menginap, dan keberangkatan tamu tanpa antre. |
| Modul utama | Frontdesk Dashboard, Tape Chart, Reservation, Group, GCF, Housekeeping, NSG, Cancel List. |
| Kewenangan khas | Buat/ubah reservasi, assign kamar, check-in, cetak registration card, blokir kamar, cari profil tamu. |
| KPI | Waktu check-in, akurasi data identitas, zero double-booking. |

### 2.3 Kasir (Cashier)

| Aspek | Detail |
| --- | --- |
| Tujuan | Mencatat pembayaran/charge dan menutup shift dengan kas yang cocok. |
| Modul utama | Folio (pribadi & master), Cashier Report, Shift (open/close), Shift Summary, Logbook. |
| Kewenangan khas | Posting charge/payment/paid-out, void dengan alasan, transfer tagihan, proses check-out, hitung denominasi. |
| KPI | Selisih kas (over/short) = 0, tidak ada transaksi tanpa sesi shift. |

### 2.4 Night Auditor (bisa dirangkap Admin)

| Aspek | Detail |
| --- | --- |
| Tujuan | Menutup hari bisnis dan menerbitkan laporan EOD. |
| Modul utama | Night Audit, EOD Report, riwayat audit, rekonsiliasi kasir. |
| Prasyarat | Tidak ada arrival/departure tertunda, tidak ada sesi kasir `OPEN`. |

### 2.5 Batasan peran saat ini (penting)

- Semua pengguna yang membuka aplikasi dapat mengakses semua menu.
- Nama kasir diambil dari `localStorage` (`cashierName`), default `'Admin'`.
- Pembatasan akses yang sebenarnya bergantung pada **RLS Supabase**, bukan pada UI.

---

## 3. Glosarium

| Istilah | Arti |
| --- | --- |
| **Business Date** | Tanggal operasional hotel, disimpan di `system_settings.current_hotel_date`. Tidak selalu sama dengan tanggal kalender. |
| **Tape Chart** | Matriks kamar × tanggal (14 hari) untuk melihat okupansi dan melakukan drag-select booking. |
| **GCF** | Guest Card File — master profil tamu/perusahaan/travel agent. |
| **NSG** | Non-Staying Guest / Paymaster — akun untuk transaksi tanpa menginap. |
| **Folio** | Kumpulan transaksi tagihan milik satu reservasi (personal) atau satu grup (master). |
| **Master Folio** | Folio gabungan untuk grup/korporat; menampung tagihan hasil routing. |
| **Routing** | Aturan pemindahan otomatis charge ke master folio berdasarkan kategori/artikel. |
| **Void** | Pembatalan transaksi dengan alasan wajib; tetap tampil di laporan sebagai jejak audit. |
| **Paid Out** | Pengeluaran kas dari drawer (bukan penjualan). Mengurangi kas fisik, bukan revenue. |
| **Blind Drop** | Metode tutup shift: sistem tidak menampilkan kas seharusnya sebelum kasir menghitung fisik. |
| **Over/Short** | Selisih antara kas fisik dihitung dan kas seharusnya. |
| **VC / VD / OC / OD** | Vacant Clean, Vacant Dirty, Occupied Clean, Occupied Dirty. |
| **OOO / OOS** | Out of Order / Out of Service — kamar diblokir. |
| **DRR** | Daily Revenue Report. |
| **EOD** | End of Day — laporan penutupan hari. |
| **KTP** | Kartu Tanda Penduduk (identitas Indonesia, NIK 16 digit). |

---

## 4. Ruang Lingkup Fitur

### 4.1 Peta modul & navigasi

Sidebar (desktop) dan drawer (mobile) memiliki struktur:

| Grup | Menu | View/aksi |
| --- | --- | --- |
| Frontdesk (accordion) | Frontdesk Dashboard | `#frontdesk-view` |
| | Room Forecast | `#room-forecast-view` |
| | Non-Stay Guest (NSG) | `#nsg-view` |
| — | Housekeeping | `#housekeeping-view` |
| — | Corporate & Travel Agent | `#corporate-view` |
| — | Guest Card File (GCF) | `#view-guest-profiles` |
| — | Night Audit | `#night-audit-view` |
| Reports (accordion) | Daily Reports (modal) | `#modal-daily-reports` |
| | Cashier Report | `#cashier-report-view` |
| | Daily Revenue Report | `#report-drr-view` |
| | Cancel List | `#cancel-list-view` |
| — | Settings (Admin) | `#admin-settings-view` |

---

## 5. Modul Frontdesk & Tape Chart

### 5.1 Frontdesk Dashboard

**Tujuan:** satu layar untuk arrival, in-house, departure, dan group pada satu business date.

**UI/UX flow:**
1. Pengguna membuka aplikasi → `initApp()` memuat nama properti, business date, master data, lalu dashboard.
2. Header kontrol: **date picker**, **filter tipe kamar**, **smart search** (No. reservasi / nama tamu / nomor kamar).
3. Tab: **Arrival List**, **In-House List**, **Departure List**, **Group Bookings** — masing-masing menampilkan counter.
4. Tab Group punya sub-tab: **Active Groups** dan **Cancel List**.
5. Tabel (DataGrid) menampilkan: No. Reservasi, Nama Tamu, Tanggal Inap, Tipe Kamar, Room Rate, Nomor Kamar, Aksi.
6. Aksi baris: buka edit reservasi, check-in, buka folio.

**Aturan bisnis:**
- Reservasi `Non-Staying Guest`, kamar virtual, dan kamar `pm-*` **disembunyikan** dari dashboard operasional.
- Arrival = `check_in_date = tanggal terpilih` dan status masih pra-check-in (`Reserved`/`GUARANTEED`/`TENTATIVE`/`6PM_HOLD`/`ORAL_CONFIRM`).
- Departure = `check_out_date = tanggal terpilih` dan status sudah check-in.
- In-house = semua status check-in (tanpa melihat tanggal).

### 5.2 Tape Chart (Room Allotment)

**Tujuan:** melihat okupansi 14 hari dan membuat reservasi dengan drag.

**UI/UX flow:**
1. Grid: baris = kamar, kolom = 14 tanggal.
2. Kontrol: **Today**, **◀ 7 hari**, **7 hari ▶**, **Jump to Date**, **filter tipe kamar**, **quick search**.
3. Drag dari sel tanggal A ke tanggal B pada baris kamar yang sama → lepas mouse → modal reservasi terbuka dengan room, check-in, dan check-out sudah terisi.
4. Reservasi tampil sebagai kapsul berwarna; warna sumber (Traveloka, Tiket, Agoda, Walk-in, Direct, Phone, Email, Online) membedakan asal booking.
5. Klik kapsul → buka edit reservasi.
6. Perubahan status kamar dari modul lain langsung ter-render ulang melalui **realtime subscription** pada tabel `rooms`.

**Edge case yang ditangani:**
- Drag lintas kamar diabaikan (hanya satu `roomId`).
- Arah drag terbalik dinormalisasi (tanggal awal/akhir diurutkan).
- Check-out otomatis = tanggal akhir + 1 hari.

### 5.3 Room Forecast

Menampilkan proyeksi 14 hari: kamar terjual, tersedia, OOO/OOS, serta indikator okupansi/ADR/RevPAR per hari.

### 5.4 Housekeeping

**Flow:**
1. Daftar kamar dengan status kebersihan.
2. Ubah status (VC/VD/OC/OD) langsung dari baris kamar.
3. Blokir kamar (**OOO/OOS**) melalui modal: tipe blok, tanggal mulai/selesai, alasan.
4. Aksi blokir menulis `room_blocks` **dan** memperbarui `rooms.status`.

**Aturan:** check-in hanya diizinkan bila `rooms.status = 'VC'`.

---

## 6. Modul Reservasi

### 6.1 Struktur modal

Modal `#reservationModal` memiliki 2 tab:

1. **Reservation Details** — 4 kartu:
   - **A. Guest & Booker Info**
   - **B. Stay Details**
   - **C. Room & Pricing**
   - **D. Status, Deposit, Comment, GCF**
2. **Folio Routing (Master Bill)** — dual-list untuk memilih kategori/artikel yang dirutekan.

Footer berubah menurut mode:
- **Create:** `Save Reservation`.
- **Edit:** `Check-In`, `Cancel Booking`, `Print Reg Card`, `Group Split`, `Open Folio`, `Update Data`.

### 6.2 Alur Form Reservasi Berbasis KTP

Form dirancang mengikuti struktur KTP Indonesia, **tanpa** field agama, status perkawinan, dan pekerjaan.

**Field identitas (Card A):**

| Urutan UI | Label | ID elemen | Wajib | Catatan |
| --- | --- | --- | --- | --- |
| 1 | Guest Type | `res-guest-type` | ✓ | `Staying Guest` / `Non-Staying Guest` |
| 2 | Reserve / Booker Name | `res-booker-name` | — | Tombol **Cari GCF** di samping |
| 3 | Card Type | `res-card-type` | — | Individual / Corporate / Travel Agent |
| 4 | Title | `res-title` | — | Mr./Mrs./Ms./Dr. |
| 5 | Foto ID / Paspor | `res-upload-doc`, `webcamModal`, `res-doc-preview` | — | Upload, kamera, scan OCR, clear |
| 6 | NIK | `res-id-card-no` | — | 16 digit |
| 7 | Nama Lengkap | `res-guest-name` | ✓ | Autocomplete GCF |
| 8 | Tempat Lahir | `res-birth-place` | — | |
| 9 | Tanggal Lahir | `res-birth-date` | — | `type=date` |
| 10 | Jenis Kelamin | `res-gender` | — | `Laki-laki` / `Perempuan` |
| 11 | Alamat Jalan | `res-address` | — | |
| 12 | RT/RW | `res-rt-rw` | — | Format `000/000` |
| 13 | Kel/Desa | `res-village` | — | |
| 14 | Kecamatan | `res-sub-district` | — | |
| 15 | Kabupaten/Kota | `res-city` | — | |
| 16 | Provinsi | `res-province` | — | |
| 17 | Kewarganegaraan | `res-nationality` | — | Default teks `WNI / Indonesia` |
| 18 | Phone Number | `res-phone` | ✓ | |
| 19 | Email Address | `res-email` | — | |

**Field menginap (Card B):** Check-in, Check-out, Nights, ETA, ETD, Adult, Child.

**Field kamar & harga (Card C):** Room Type, Room Number (opsional), Rate Code, Room Rate/Night, Meal Plan, Market Segment, Reservation Source, Voucher Number, Bill Receiver (Corporate), Diskon (%), Qty (jumlah kamar), Group Name (muncul jika Qty > 1), Extrabed, Total Preview, dan **Daily Rate Breakdown** (per tanggal: rate + meal plan).

**Field status & deposit (Card D):** Status reservasi, **Add Deposit** (nominal + payment method), riwayat deposit, komentar, checkbox **Save to GCF**.

**Alur langkah demi langkah:**
1. Pengguna menekan **+ New Reservation** atau drag di tape chart.
2. Modal terbuka; dropdown (room type, rate plan, meal plan, segment, corporate) dimuat paralel.
3. Pengguna mengetik nama → autocomplete GCF muncul (debounce). Memilih profil akan mengisi identitas, kontak, dan diskon.
4. Alternatif: tombol **Cari GCF** membuka modal lookup dengan pencarian nama/HP/email/KTP/perusahaan.
5. Pengguna dapat mengunggah foto KTP/Paspor atau mengambil foto via webcam; gambar dikompres (lebar maks 800px, JPEG 0.7).
6. Tekan **Scan KTP/Paspor (OCR)** untuk mengisi otomatis (lihat §7).
7. Tentukan tanggal inap → grid **Daily Rate Breakdown** dibuat otomatis per malam; rate bisa diubah per tanggal, atau disalin dari baris pertama.
8. Pilih kamar (opsional). Bila kamar dipilih, sistem memeriksa bentrok tanggal sebelum simpan.
9. Opsional: tambah deposit. Deposit menjadi transaksi `PAYMENT` di folio setelah reservasi tersimpan.
10. Simpan. Untuk Qty > 1, sistem membuat `group_bookings`, reservasi induk (`-1`), anak (`-2..n`), dan satu `master_folios`.
11. Setelah simpan: dashboard, tape chart, rooms, dan cancel list di-refresh.

**Aturan validasi:**
- Nama tamu wajib.
- Check-out harus setelah check-in (divalidasi pada level form & group booking).
- Kamar yang sudah terpakai pada periode sama ditolak dengan pesan nomor kamar.
- Qty > 1 mewajibkan Group Name.

**Edge case:**
- Mengubah nama tamu pada mode edit akan melepas tautan GCF lama (`guest_profile_id`/`guest_card_id` dikosongkan) agar tidak menimpa profil orang lain.
- Mengubah Qty > 1 memicu pembuatan grup otomatis.
- Edit reservasi memuat ulang dokumen identitas dari `document_url` bila ada.

### 6.3 Check-in

**Prasyarat:** reservasi punya `room_id`; kamar tidak bentrok; `rooms.status = 'VC'`.

**Hasil:** `reservations.status = 'CHECKED_IN'`, `rooms.status = 'OC'`, UI dashboard & tape chart di-refresh.

### 6.4 Pembatalan reservasi

1. Klik **Cancel Booking**.
2. Sistem memeriksa saldo folio.
3. Bila ada saldo/deposit: modal **Deposit Settlement** muncul dengan dua pilihan — **Refund Deposit** atau **Cancellation Fee**. Pilihan ini dicatat sebagai transaksi.
4. Pengguna mengisi alasan pembatalan.
5. `reservations.status = 'Cancelled'`, `cancel_reason` disimpan; reservasi masuk **Cancel List**.

### 6.5 Group Booking & Rooming List

- **New Group Reservation**: nama grup, corporate (opsional), check-in/out, dan repeater **allotment** (room type, qty, agreed rate).
- Data allotment disimpan di `group_allotments`.
- **Rooming List**: memetakan tamu ke kamar fisik; dapat memilih profil GCF per baris.
- **Split**: memecah reservasi grup menjadi reservasi individual (`rpc_split_group_reservation`).
- **Cancel group**: reservasi terkait dibatalkan dan allotment dilepas.

---

## 7. Fitur OCR.space Mandiri (Self-Service)

### 7.1 Konsep

Hotel mengelola sendiri API key OCR.space. Tidak ada key bawaan di aplikasi, tidak ada server perantara: **browser memanggil `https://api.ocr.space/parse/image` langsung** dengan key yang disimpan Admin.

### 7.2 Alur Admin (sekali setup)

1. Admin login ke aplikasi → **Settings** → tab **Invoice Setting**.
2. Pada bagian *Print & Document Settings*, isi field **OCR.space API Key** (`#setting-ocr-api-key`).
3. Klik **Save Changes**.
4. Sistem menyimpan key ke `system_settings` dengan `setting_key = 'ocr_space_api_key'` (upsert, konflik pada `setting_key`).
5. Key di-cache di memori (`cachedOcrApiKey` + `window.cachedOcrApiKey`) agar tidak perlu query ulang.
6. Saat tab Invoice Setting dibuka kembali, `fetchInvoiceSetting()` memuat ulang key dari database.

**Aturan:**
- Field bertipe `password` agar tidak terbaca sekilas.
- Key disimpan sebagai teks biasa (bukan hash) — lihat risiko di `docs/AUDIT_REPORT.md` §6.4.
- Bila key kosong, tombol scan akan menampilkan pesan agar Admin mengisi key.

### 7.3 Alur Resepsionis (pemakaian harian)

1. Buka modal reservasi (baru atau edit).
2. Unggah foto KTP/Paspor **atau** ambil foto lewat kamera (`#webcamModal`).
3. Pratinjau muncul di `#res-doc-preview`.
4. Klik **Scan KTP/Paspor (OCR)** (`#btn-scan-ocr`).
5. Sistem:
   1. Mengambil key dari cache/`system_settings`.
   2. Mengompres gambar menjadi base64 JPEG (maks 800px, kualitas 0.7).
   3. Mengirim `POST` multipart ke OCR.space (`OCREngine=2`, `scale=true`, `detectOrientation=true`).
   4. Membaca `ParsedResults[0].ParsedText`.
   5. Mem-parsing teks menjadi field KTP.
6. Field yang berhasil dikenali terisi otomatis; pengguna **wajib memeriksa** sebelum menyimpan.
7. Bila tidak ada field yang cocok, muncul peringatan agar isi manual.

**Field yang diisi otomatis:** NIK, Nama, Tempat Lahir, Tanggal Lahir, Jenis Kelamin, Alamat, RT/RW, Kel/Desa, Kecamatan, Kab/Kota, Provinsi, Kewarganegaraan. Untuk paspor: nomor paspor, nama dari MRZ, dan kode negara.

**Pesan kesalahan yang diharapkan:**
- Key belum diatur → arahkan ke Settings.
- Tidak ada foto → minta unggah/ambil foto.
- Hasil kosong/gambar buram → minta foto lebih terang.
- HTTP/API error → tampilkan pesan error.

**Batasan yang diketahui (lihat audit):**
- Tombol saat ini terpasang ganda (inline + listener) sehingga berpotensi memanggil API 2×.
- Nilai gender hasil OCR (`LAKI-LAKI`) belum cocok dengan opsi select (`Laki-laki`).
- `ocrService.js` belum dipakai sebagai sumber logika tunggal.

---

## 8. Modul GCF (Guest Card File)

### 8.1 Daftar & pencarian
- Tab: **All**, **Individual**, **Company**, **Travel Agent**.
- Pencarian: nama, HP, email, NIK/KTP, perusahaan.
- Pencarian memakai RPC `rpc_search_guest_cards`, dengan fallback query langsung ke `guest_card_files`.

### 8.2 Editor profil (3 tab)
1. **Basic** — identitas: tipe kartu, title, nama depan/belakang atau nama perusahaan, NIK + tipe identitas, tanggal lahir, jenis kelamin, pekerjaan (khusus GCF), alamat, negara/kota, telepon, email; untuk company: credit limit, sales exec, contract expiry, diskon.
2. **Contacts** — daftar contact person perusahaan (`guest_contacts`).
3. **Rates** — contract rate per tipe kamar (`contract_rates`).

### 8.3 Fitur lain
- **Stay History**: riwayat reservasi per profil.
- **Merge Profiles**: menggabungkan profil duplikat (dipilih sumber & target, relasi dipindahkan).
- **Delete**: menghapus profil beserta kontak/rate terkait.

### 8.4 Perbedaan dengan form reservasi
GCF memuat **pekerjaan** (karena konteks profil perusahaan/individu), sedangkan form reservasi KTP **tidak** memuat pekerjaan, agama, maupun status perkawinan.

---

## 9. Modul Folio & Pembayaran

### 9.1 Struktur
- Dua tab: **Pribadi** (per reservasi) dan **Master** (grup/korporat).
- Header menampilkan nomor folio, tamu, kamar, tanggal inap, status.
- Ringkasan: Total Charge, Total Payment, **Balance**.

### 9.2 Aksi transaksi
| Aksi | Perilaku |
| --- | --- |
| **Add Charge** | Pilih item dari `extra_charges` (atau custom), qty, unit price, kategori. |
| **Add Payment** | Nominal + payment method + reference number. |
| **Add Paid Out** | Kas keluar dari drawer; bukan revenue. |
| **Void** | Wajib alasan; transaksi tetap tampil sebagai jejak audit. |
| **Transfer Bill** | Pilih transaksi (checkbox) → pindahkan ke reservasi/master folio lain. |
| **Move to Master** | Pindahkan seluruh tagihan terpilih ke master folio. |
| **Print Folio / Invoice** | Cetak dokumen tagihan (prefix & footer dari `invoice_settings`). |

### 9.3 Aturan penting
- Semua posting membutuhkan **sesi shift kasir aktif**; jika tidak ada, transaksi ditolak.
- Posting memakai RPC `rpc_post_folio_transaction`; bila gagal, sistem **fallback** ke insert langsung ke `folio_transactions`.
- Transfer memakai `rpc_transfer_folio_transaction` / `rpc_transfer_folio_transactions`.
- Void memakai `rpc_void_folio_transaction`.
- **Check-out ditolak bila balance ≠ 0.**
- NSG menggunakan istilah **Close Bill** (status `INACTIVE`) alih-alih check-out.

### 9.4 Folio Routing
Dual-list pada modal reservasi: kategori/artikel tersedia vs yang sudah dirutekan. Aturan disimpan di `folio_routing_rules` per reservasi sumber.

---

## 10. Modul Kasir & Shift

### 10.1 Open Shift
- Modal meminta nama kasir, nama shift, dan **opening float**.
- RPC `rpc_open_cashier_shift` membuat `cashier_sessions` status `OPEN` untuk business date berjalan.
- Sesi aktif disimpan di `localStorage` (`activeShiftId`, `activeCashierSessionId`, `cashierName`, `shiftName`).

### 10.2 Selama shift
- Cashier Report menampilkan transaksi sesi aktif dan klasifikasinya (cash, bank transfer, credit card, city ledger, paid out, void).
- **Blind drop**: total kas seharusnya **disembunyikan** dari kasir.

### 10.3 Close Shift (Denomination Calculator)
1. Kasir membuka modal tutup shift.
2. Menghitung fisik uang per pecahan (denomination).
3. Mengisi **petty cash retained** dan **cash drop**.
4. Submit → sistem menghitung:

| Metrik | Formula |
| --- | --- |
| `system_net_cash` | Total cash payment − total paid out |
| `system_expected_cash` | Opening float + system net cash |
| `remittance_amount` | Total declared cash − petty cash retained |
| `over_short` | Total declared cash − system expected cash |

5. Laporan shift 4 seksi ditampilkan (cash movement, ringkasan, void, rekap).
6. RPC `rpc_close_cashier_shift` menutup sesi (`status = 'CLOSED'`).

### 10.4 Logbook Handover
- Catatan serah terima antar shift: kategori, nomor kamar, pesan, status selesai.
- Disimpan di `shift_logbooks`, dapat ditandai resolved.

---

## 11. Modul Night Audit & Laporan

### 11.1 Night Audit
1. Buka menu **Night Audit** → `fn_pre_night_audit_check` mengembalikan tanggal bisnis, jumlah arrival/departure tertunda, dan sesi kasir terbuka.
2. Kartu checklist menampilkan tiga prasyarat dengan tautan cepat ke modul terkait.
3. Bila prasyarat belum aman, tombol **Run Night Audit** dinonaktifkan/diblokir.
4. Konfirmasi → `fn_execute_night_audit(p_user_name)`.
5. Sistem memposting room charge, memajukan `current_hotel_date`, dan menyimpan riwayat di `night_audit_history`.
6. **EOD Flash Report** dapat dibuka & dicetak, termasuk rekonsiliasi kasir.

### 11.2 Laporan
| Laporan | Sumber | Isi |
| --- | --- | --- |
| **Daily Financial Report** | `fn_generate_daily_financial_report` | Ringkasan revenue, daftar saldo tamu, daftar check-out, rekap kasir. |
| **Daily Revenue Report (DRR)** | `rpc_get_daily_revenue_report` | Revenue per tanggal, metrik okupansi (ADR/RevPAR). |
| **Cashier Report** | Query `cashier_sessions` + `folio_transactions` | Transaksi per sesi, klasifikasi, selisih. |
| **Cancel List** | Query `reservations` status `Cancelled` | Reservasi batal + alasan + settlement deposit. |

Semua laporan dapat dicetak melalui `window.print()` pada jendela cetak terpisah.

---

## 12. Modul NSG & Corporate

### 12.1 NSG / Paymaster
- Akun non-menginap untuk menampung tagihan (mis. function room, laundry korporat).
- Nomor otomatis `NSG-xxxxxx-xxxx`, `guest_type = 'Non-Staying Guest'`, `room_rate = 0`, status `ACTIVE`.
- Dapat diisi charge/payment; ditutup dengan **Close Bill** → `INACTIVE`.
- Tidak muncul di dashboard operasional & tape chart.

### 12.2 Corporate & Travel Agent
- Field: nama perusahaan, NPWP, PIC, billing address, term of payment (hari), credit limit.
- Menjadi pilihan **Bill Receiver (Corporate)** pada reservasi.
- Dapat dikaitkan ke group booking.

---

## 13. Modul Settings (Admin)

10 tab konfigurasi:

| Tab | Data | Tabel |
| --- | --- | --- |
| Room Types | Bed type + kategori kamar + base price | `bed_types`, `room_types` |
| Rooms | Nomor kamar (bisa bulk, dipisah koma), tipe, view, floor, building | `rooms` |
| Meal Plans | Kode & nama paket + rincian item per outlet | `meal_plans`, `meal_plan_breakdowns` |
| Rate Structure | Rate plan + harga per tipe kamar + segment + meal plan + cancellation policy | `rate_plans`, `rate_plan_prices` |
| Tax & Service | Tipe, nama, persentase | `tax_and_service` |
| Extra Charges | Nama, kategori, harga, kena pajak | `extra_charges` |
| Payment Methods | Nama, tipe, status aktif | `payment_methods` |
| Invoice Setting | Prefix invoice, footer notes, RC terms, **OCR.space API Key** | `invoice_settings`, `system_settings` |
| Market Segments | Main group + segment code | `main_group_segments`, `segment_codes` |
| Revenue Centers | Department + outlet | `departments`, `outlets` |

**Perilaku UI:** setiap tab memuat datanya saat pertama dibuka; simpan/hapus memakai modal; tabel langsung di-refresh setelah mutasi.

---

## 14. Kebutuhan Non-Fungsional

| Aspek | Target |
| --- | --- |
| Waktu muat awal | < 3 detik pada koneksi 4G (CDN Tailwind + Supabase). |
| Interaksi | Feedback < 300 ms; operasi jaringan memakai spinner/disable tombol. |
| Konsistensi | Semua nominal diformat `Rp` (id-ID); semua tanggal ISO `YYYY-MM-DD` untuk data, `dd Mmm` untuk tampilan. |
| Auditabilitas | Void wajib alasan; transaksi menyimpan `created_by`, `cashier_session_id`, `hotel_business_date`. |
| Keandalan | Operasi kritikal punya fallback bila RPC gagal (kecuali night audit & shift). |
| Kompatibilitas | Browser modern (Chrome/Edge/Safari/Firefox terbaru), responsif mobile (drawer sidebar). |
| Aksesibilitas dasar | Label form, `aria-label` pada nav, tombol berikon + teks. |
| Keamanan | RLS Supabase wajib aktif per tabel; key OCR hanya untuk Admin. |

---

## 15. Batasan & Gap yang Diketahui

Dokumen ini menggambarkan **perilaku yang dirancang**. Kondisi implementasi aktual (termasuk bug blocking) dicatat di `docs/AUDIT_REPORT.md`. Gap utama yang memengaruhi PRD:

1. **Aplikasi tidak dapat dijalankan** sampai SyntaxError di `reservation.js` diperbaiki.
2. Simpan/edit reservasi gagal karena `#res-id-card` tidak ada.
3. Kota tamu tidak tersimpan (mismatch `#res-city` vs `#res-city-select`).
4. OCR berjalan ganda per klik dan hasil gender tidak cocok dengan opsi select.
5. Data KTP tidak ditampilkan saat edit reservasi.
6. Tidak ada autentikasi/otorisasi per peran di sisi UI.
7. Belum ada mekanisme enkripsi untuk API key OCR.

---

## 16. Roadmap yang Disarankan

| Prioritas | Item |
| --- | --- |
| P0 | Perbaiki syntax error, samakan ID form, pulihkan alur simpan/edit reservasi. |
| P1 | Satukan OCR ke `ocrService.js`, normalisasi gender, lengkapi autofill saat edit, simpan KTP walau GCF tidak dicentang. |
| P2 | Autentikasi + role-based UI, RLS audit, enkripsi key, proxy OCR. |
| P3 | Konstanta status terpusat, pemisahan komponen modal dari `index.html`, CI `node --check`. |
