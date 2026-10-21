/**
 * OCR Service Module for Hotel PMS
 * Handles communication with OCR.space API and parsing Indonesian KTP text data.
 */

/**
 * Sends a base64 encoded image to OCR.space API for parsing.
 * @param {string} base64Image - Base64 data string of the image
 * @param {string} apiKey - OCR.space API key
 * @returns {Promise<string>} Parsed raw text from image or empty string on error
 */
export async function callOcrSpace(base64Image, apiKey) {
    try {
        if (!base64Image || !apiKey) {
            return '';
        }

        const formData = new FormData();
        formData.append('apikey', apiKey);
        formData.append('base64Image', base64Image);
        formData.append('OCREngine', '2');
        formData.append('scale', 'true');
        formData.append('detectOrientation', 'true');
        formData.append('language', 'eng');

        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            console.error('OCR.space API error HTTP status:', response.status);
            return '';
        }

        const result = await response.json();
        return result.ParsedResults?.[0]?.ParsedText || '';
    } catch (error) {
        console.error('Error calling OCR.space API:', error);
        return '';
    }
}

/**
 * Parses raw KTP text extracted via OCR into structured guest information.
 * @param {string} rawText - Raw OCR text
 * @returns {Object} Structured KTP object
 */
export function parseKtpText(rawText) {
    const data = {
        id_card_no: '',
        full_name: '',
        birth_place: '',
        birth_date: '',
        gender: '',
        address: '',
        rt_rw: '',
        village: '',
        sub_district: '',
        city: '',
        province: '',
        nationality: ''
    };

    try {
        if (!rawText || typeof rawText !== 'string') {
            return data;
        }

        const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

        // 1. id_card_no: Regex 16 digit angka (\b\d{16}\b)
        const nikMatch = rawText.match(/\b\d{16}\b/);
        if (nikMatch) {
            data.id_card_no = nikMatch[0];
        }

        // 2. full_name: Cari baris dengan teks "Nama" lalu ambil teks setelah titik dua / nama tersebut
        const namaLine = lines.find(l => /nama/i.test(l));
        if (namaLine) {
            if (namaLine.includes(':')) {
                data.full_name = namaLine.split(':').slice(1).join(':').trim();
            } else {
                data.full_name = namaLine.replace(/^.*nama\b/i, '').replace(/^[:\s-]+/, '').trim();
            }
        }

        // 3 & 4. birth_place & birth_date: Baris "Tempat/Tgl Lahir"
        const birthLine = lines.find(l => /tempat/i.test(l) && /lahir/i.test(l));
        if (birthLine) {
            const content = birthLine.includes(':') ? birthLine.split(':').slice(1).join(':').trim() : birthLine.replace(/^.*lahir/i, '').trim();
            const parts = content.split(',');
            if (parts.length >= 1) {
                data.birth_place = parts[0].trim();
            }
            if (parts.length >= 2) {
                const dateMatch = parts[1].match(/\b(\d{2})[-/.](\d{2})[-/.](\d{4})\b/);
                if (dateMatch) {
                    const [_, dd, mm, yyyy] = dateMatch;
                    data.birth_date = `${yyyy}-${mm}-${dd}`;
                }
            }
        } else {
            // Fallback for DD-MM-YYYY in rawText
            const dateMatch = rawText.match(/\b(\d{2})[-/.](\d{2})[-/.](\d{4})\b/);
            if (dateMatch) {
                const [_, dd, mm, yyyy] = dateMatch;
                data.birth_date = `${yyyy}-${mm}-${dd}`;
            }
        }

        // 5. gender: Deteksi "LAKI-LAKI" atau "PEREMPUAN"
        if (/LAKI-LAKI|LAKI\s*-\s*LAKI/i.test(rawText)) {
            data.gender = 'LAKI-LAKI';
        } else if (/PEREMPUAN/i.test(rawText)) {
            data.gender = 'PEREMPUAN';
        }

        // 6. address: Cari baris setelah "Alamat" hingga sebelum baris RT/RW
        const alamatIdx = lines.findIndex(l => /alamat/i.test(l));
        const rtrwIdx = lines.findIndex(l => /rt\s*\/\s*rw/i.test(l) || /\b\d{2,3}\s*\/\s*\d{2,3}\b/.test(l));

        if (alamatIdx !== -1) {
            const alamatLine = lines[alamatIdx];
            let addr = '';
            if (alamatLine.includes(':')) {
                addr = alamatLine.split(':').slice(1).join(':').trim();
            }
            if (!addr && alamatIdx + 1 < lines.length) {
                if (rtrwIdx === -1 || alamatIdx + 1 < rtrwIdx) {
                    addr = lines[alamatIdx + 1];
                }
            }
            data.address = addr.trim();
        }

        // 7. rt_rw: Regex format /\b\d{2,3}\s*\/\s*\d{2,3}\b/
        const rtrwMatch = rawText.match(/\b\d{2,3}\s*\/\s*\d{2,3}\b/);
        if (rtrwMatch) {
            data.rt_rw = rtrwMatch[0].replace(/\s+/g, '');
        }

        // 8. village: Ambil baris setelah "Kel/Desa"
        const kelIdx = lines.findIndex(l => /kel\s*\/\s*desa|kelurahan|desa/i.test(l));
        if (kelIdx !== -1) {
            const line = lines[kelIdx];
            if (line.includes(':')) {
                data.village = line.split(':').slice(1).join(':').trim();
            } else if (kelIdx + 1 < lines.length && !/kecamatan/i.test(lines[kelIdx + 1])) {
                data.village = lines[kelIdx + 1].replace(/^[:\s-]+/, '').trim();
            }
        }

        // 9. sub_district: Ambil baris setelah "Kecamatan"
        const kecIdx = lines.findIndex(l => /kecamatan/i.test(l));
        if (kecIdx !== -1) {
            const line = lines[kecIdx];
            if (line.includes(':')) {
                data.sub_district = line.split(':').slice(1).join(':').trim();
            } else if (kecIdx + 1 < lines.length && !/agama|status|kabupaten|kota/i.test(lines[kecIdx + 1])) {
                data.sub_district = lines[kecIdx + 1].replace(/^[:\s-]+/, '').trim();
            }
        }

        // 10. city: Deteksi baris yang memuat kata "KABUPATEN" atau "KOTA"
        const cityLine = lines.find(l => /KABUPATEN|KOTA/i.test(l));
        if (cityLine) {
            if (cityLine.includes(':')) {
                data.city = cityLine.split(':').slice(1).join(':').trim();
            } else {
                data.city = cityLine.replace(/^[:\s-]+/, '').trim();
            }
        }

        // 11. province: Deteksi baris yang memuat kata "PROVINSI"
        const provLine = lines.find(l => /PROVINSI/i.test(l));
        if (provLine) {
            if (provLine.includes(':')) {
                data.province = provLine.split(':').slice(1).join(':').trim();
            } else {
                data.province = provLine.replace(/^PROVINSI/i, '').replace(/^[:\s-]+/, '').trim();
            }
        }

        // 12. nationality: Jika ada kata "WNI", kembalikan "Indonesia"
        if (/\bWNI\b/i.test(rawText)) {
            data.nationality = 'Indonesia';
        }
    } catch (error) {
        console.error('Error in parseKtpText:', error);
    }

    return data;
}
