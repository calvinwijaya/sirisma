const user = JSON.parse(sessionStorage.getItem("user"));
let dashboardMasterData = [];
let masterDosenList = []; 
let chartInstances = {}; 

let currentPage = 1;
const rowsPerPage = 10; 
let currentFilteredData = [];

// Konfigurasi Database SINTA
const SINTA_API_KEY = "AIzaSyA3Pgj8HMdb4ak9jToAiTQV0XFdmgvoYPI";
const SINTA_SHEET_ID = "1TEiYtyDVfb_du4I5fNroaLEa3zk2JRyi8jup7n5DKD4";
let sintaBaseScores = { S1: 0, S2: 0, S3: 0 };

if (!user) {
    window.location.href = 'index.html';
} else {
    document.addEventListener("DOMContentLoaded", () => {
        initUserProfile();
        initDashboardLayout();
    });
}

// ==========================================
// INISIALISASI UI & PROFIL
// ==========================================
function initUserProfile() {
    document.getElementById("userNama").textContent = user.nama;
    document.getElementById("sidebarUserNama").textContent = user.nama;
    
    const badgeRole = document.getElementById("sidebarUserRole");
    badgeRole.textContent = user.role;
    badgeRole.className = "badge border border-light fw-normal"; 
    
    switch(user.role) {
        case "Admin": badgeRole.classList.add("bg-danger"); break;
        case "Kadep": badgeRole.classList.add("bg-primary"); break;
        case "Sekdep": badgeRole.style.backgroundColor = "#6f42c1"; badgeRole.style.color = "white"; break;
        case "Koordinator": badgeRole.classList.add("bg-warning", "text-dark"); break;
        case "Dosen": badgeRole.classList.add("bg-secondary"); break;
        default: badgeRole.classList.add("bg-dark");
    }

    const badgeKbk = document.getElementById("sidebarUserKbk");
    if (user.kbk && user.kbk.trim() !== "" && user.kbk.trim() !== "-") {
        badgeKbk.textContent = user.kbk;
        badgeKbk.className = "badge fw-bold shadow-sm";
        badgeKbk.style.backgroundColor = ""; badgeKbk.style.color = "";
        
        if (user.kbk === "Teknik Geoinformatika") badgeKbk.classList.add("bg-info", "text-dark");
        else if (user.kbk === "Teknik Geodesi") { badgeKbk.style.backgroundColor = "#20c997"; badgeKbk.style.color = "white"; }
        else badgeKbk.classList.add("bg-light", "text-dark");
        
        badgeKbk.classList.remove("d-none");
    } else {
        badgeKbk.classList.add("d-none");
    }

    const userProfilePic = document.getElementById("userProfilePic");
    const nameForAvatar = user.nama.replace(/\s+/g, '+');
    const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=0d6efd&color=fff&rounded=true&bold=true`;

    if (user.picture) {
        userProfilePic.src = user.picture;
        userProfilePic.onerror = function() { this.onerror = null; this.src = defaultAvatarUrl; };
    } else { userProfilePic.src = defaultAvatarUrl; }
}

function initDashboardLayout() {
    const role = user.role;
    const isExecutive = ["Admin", "Kadep", "Sekdep"].includes(role);
    
    const analyticsSection = document.getElementById("executiveAnalytics");
    const filterSearch = document.getElementById("adminFilterSearch");
    const filterKbk = document.getElementById("adminFilterKbk");
    const filterHomebase = document.getElementById("adminFilterHomebase");
    const tableHeader = document.getElementById("tableUpdateHeader");

    if (isExecutive) {
        if(analyticsSection) analyticsSection.classList.remove("d-none");
        if(filterSearch) filterSearch.classList.remove("d-none");
        if(filterKbk) filterKbk.classList.remove("d-none");
        if(filterHomebase) filterHomebase.classList.remove("d-none");
        tableHeader.textContent = "Update Artikel Departemen";
    }

    // Event Listeners
    document.getElementById("filterBulan").addEventListener("change", processAndRenderDashboard);
    document.getElementById("filterTahun").addEventListener("change", processAndRenderDashboard);
    
    if(isExecutive) {
        document.getElementById("filterKbk").addEventListener("change", processAndRenderDashboard);
        document.getElementById("filterHomebase").addEventListener("change", processAndRenderDashboard);
        document.getElementById("filterSearchDosen").addEventListener("keyup", processAndRenderDashboard);
    }

    fetchAllData();
}

// Mengambil tiga sumber data sekaligus
async function fetchAllData() {
    Loading.show();
    try {
        const [resArtikel, resDosen, resSinta] = await Promise.all([
            fetch(GAS_DATABASE + "?t=" + new Date().getTime()).then(r => r.json()),
            fetch(GAS_LOGIN, { method: "POST", body: JSON.stringify({ action: "get_users" }) }).then(r => r.json()),
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SINTA_SHEET_ID}/values/DataSintaProdi?key=${SINTA_API_KEY}`).then(r => r.json()).catch(() => null)
        ]);

        if (resArtikel && resArtikel.status === "ok") dashboardMasterData = resArtikel.data;
        if (resDosen && resDosen.status === "ok") masterDosenList = resDosen.user;

        if (resSinta && resSinta.values) {
            const sintaRows = resSinta.values.slice(1);
            sintaRows.forEach(row => {
                const universitas = row[0] ? String(row[0]).trim().toLowerCase() : "";
                
                if (universitas.includes("gadjah mada")) {
                    const jenjang = row[2] ? String(row[2]).trim().toUpperCase() : "";
                    const scoreStr = String(row[3]).replace(/[^0-9]/g, ''); 
                    const score = parseInt(scoreStr, 10) || 0;
                    
                    if(jenjang === "S1") sintaBaseScores.S1 = score;
                    else if(jenjang === "S2") sintaBaseScores.S2 = score;
                    else if(jenjang === "S3") sintaBaseScores.S3 = score;
                }
            });
        }

        processAndRenderDashboard();
    } catch (err) {
        console.error("Gagal load data dashboard:", err);
    } finally {
        Loading.hide();
    }
}

// ==========================================
// PEMROSESAN DATA UTAMA
// ==========================================
function processAndRenderDashboard() {
    const filterBulanEl = document.getElementById("filterBulan");
    if (!filterBulanEl) return; 

    const role = user.role;
    const isExecutive = ["Admin", "Kadep", "Sekdep"].includes(role);

    const valBulan = document.getElementById("filterBulan").value; 
    const valTahun = document.getElementById("filterTahun").value;
    const valKbk = isExecutive ? document.getElementById("filterKbk").value : "";
    const valHomebase = isExecutive ? document.getElementById("filterHomebase").value : "";
    const valSearch = isExecutive ? document.getElementById("filterSearchDosen").value.toLowerCase() : "";

    const dosenMap = {};
    masterDosenList.forEach(d => { dosenMap[d.kode] = d; });

    const scoreMap = {
        "Q1": 40, "Q2": 24, "Q3": 22, "Q4": 20, "Non-Q": 30,
        "Sinta 1": 25, "Sinta 2": 25, "Sinta 3": 20, "Sinta 4": 20, "Sinta 5": 15, "Sinta 6": 15, "Non-Sinta": 10,
        "Internasional": 30, "Nasional": 10,
        "Buku Ajar": 20, "Buku Referensi": 40, "Buku Monograf": 20 
    };

    let sintaAdditional = { S1: 0, S2: 0, S3: 0 };
    let statusCounts = {};
    let authorCounts = {};
    let indexCounts = {};
    let mhsCounts = { "Melibatkan Mhs.": 0, "Dosen Mandiri": 0 };

    let trendCounts = { 
        "Jurnal": { "01":0, "02":0, "03":0, "04":0, "05":0, "06":0, "07":0, "08":0, "09":0, "10":0, "11":0, "12":0 },
        "Prosiding": { "01":0, "02":0, "03":0, "04":0, "05":0, "06":0, "07":0, "08":0, "09":0, "10":0, "11":0, "12":0 },
        "Buku": { "01":0, "02":0, "03":0, "04":0, "05":0, "06":0, "07":0, "08":0, "09":0, "10":0, "11":0, "12":0 }
    };

    let filteredData = dashboardMasterData.filter(row => {
        const tglInputStr = String(row[2]); 
        let rowBulan = "", rowTahun = "";
        
        if (tglInputStr && tglInputStr !== "") {
            const dateParts = tglInputStr.split(" ")[0].split("/"); 
            if(dateParts.length === 3) {
                rowBulan = dateParts[1];
                rowTahun = dateParts[2];
            }
        }

        if (valBulan !== "" && rowBulan !== valBulan) return false;
        if (valTahun !== "" && rowTahun !== valTahun) return false;

        const authorCodes = String(row[9]).replace(/\*/g, "").split(", ");

        if (!isExecutive) {
            const isPIC = row[3] === user.email; 
            const isAuthor = authorCodes.includes(user.kode); 
            if (!isPIC && !isAuthor) return false;
        } else {
            if (valKbk !== "") {
                const isMatchKbk = authorCodes.some(kode => dosenMap[kode] && dosenMap[kode].kbk === valKbk);
                if (!isMatchKbk) return false;
            }
            if (valHomebase !== "") {
                const isMatchHb = authorCodes.some(kode => dosenMap[kode] && dosenMap[kode].homebase === valHomebase);
                if (!isMatchHb) return false;
            }
            if (valSearch.trim() !== "") {
                const isMatchSearch = authorCodes.some(kode => {
                    const namaLengkap = dosenMap[kode] ? dosenMap[kode].nama.toLowerCase() : "";
                    return namaLengkap.includes(valSearch) || kode.toLowerCase().includes(valSearch);
                });
                if (!isMatchSearch) return false;
            }
        }

        // =====================================
        // KALKULASI SKOR SINTA PER ARTIKEL
        // =====================================
        let tipePub = row[6] || "";
        let indeksFull = String(row[7] || "");
        
        // PERBAIKAN INDEX: Skor SINTA bergeser ke Index 37 (AL)
        let skorSintaNum = parseInt(row[37], 10); 
        
        if (isNaN(skorSintaNum) || skorSintaNum === 0) {
             if (indeksFull.includes(" - Skor SINTA ")) {
                 skorSintaNum = parseInt(indeksFull.split(" - Skor SINTA ")[1]) || 0;
             } else {
                 skorSintaNum = scoreMap[indeksFull] || 0; 
             }
        }

        let involvedHomebases = new Set();
        authorCodes.forEach(kode => {
            if(dosenMap[kode] && dosenMap[kode].homebase) {
                involvedHomebases.add(dosenMap[kode].homebase);
            }
        });

        row.involvedHomebases = Array.from(involvedHomebases);
        row.skorSintaNum = skorSintaNum;

        involvedHomebases.forEach(hb => {
            if(sintaAdditional[hb] !== undefined) sintaAdditional[hb] += skorSintaNum;
        });

        // =====================================
        // KALKULASI CHART (Status, Index, dsb)
        // =====================================
        // PERBAIKAN INDEX: Status Terkini bergeser ke Index 13 (N)
        statusCounts[row[13] || "Unknown"] = (statusCounts[row[13] || "Unknown"] || 0) + 1;
        
        if(rowBulan && trendCounts[tipePub]) {
            trendCounts[tipePub][rowBulan]++;
        }

        let indeksChart = row[7] || "Unknown";
        if(indeksChart.includes(" - ")) indeksChart = indeksChart.split(" - ")[0]; 
        if (indeksChart === "Nasional") indeksChart = "Prosiding Nasional";
        if (indeksChart === "Internasional") indeksChart = "Prosiding Internasional";
        indexCounts[indeksChart] = (indexCounts[indeksChart] || 0) + 1;

        if (isExecutive) {
            authorCodes.forEach(kode => {
                if(kode.trim() !== "") authorCounts[kode] = (authorCounts[kode] || 0) + 1;
            });
        }

        if (row[10] && String(row[10]).trim() !== "") mhsCounts["Melibatkan Mhs."]++;
        else mhsCounts["Dosen Mandiri"]++;

        return true;
    });

    document.getElementById("scoreS1Base").textContent = sintaBaseScores.S1.toLocaleString('id-ID');
    document.getElementById("scoreS2Base").textContent = sintaBaseScores.S2.toLocaleString('id-ID');
    document.getElementById("scoreS3Base").textContent = sintaBaseScores.S3.toLocaleString('id-ID');
    
    document.getElementById("scoreS1Add").textContent = `+${sintaAdditional.S1} Tambahan`;
    document.getElementById("scoreS2Add").textContent = `+${sintaAdditional.S2} Tambahan`;
    document.getElementById("scoreS3Add").textContent = `+${sintaAdditional.S3} Tambahan`;

    let totalDeptBase = sintaBaseScores.S1 + sintaBaseScores.S2 + sintaBaseScores.S3;
    let totalDeptAdd = sintaAdditional.S1 + sintaAdditional.S2 + sintaAdditional.S3;
    document.getElementById("scoreDeptBase").textContent = totalDeptBase.toLocaleString('id-ID');
    document.getElementById("scoreDeptAdd").innerHTML = `<i class="bi bi-graph-up-arrow me-1"></i> +${totalDeptAdd} Potensi Tambahan`;

    renderTableUpdate(filteredData);
    
    Object.keys(chartInstances).forEach(key => { if(chartInstances[key]) chartInstances[key].destroy(); });
    renderChartStatus(statusCounts);
    renderChartTrend(trendCounts); 
    
    if (isExecutive) {
        renderTableAuthorshipHeatmap(authorCounts); 
        renderChartIndexation(indexCounts);
        renderChartMahasiswa(mhsCounts);
    }
}

// ==========================================
// RENDERING KOMPONEN UI
// ==========================================

function renderTableUpdate(data) {
    // Simpan data yang difilter ke variabel global agar bisa dipakai fungsi paginasi
    currentFilteredData = data.slice().reverse(); 
    
    // Reset ke halaman 1 setiap kali filter berubah
    currentPage = 1; 
    
    displayTablePage(currentPage);
}

// Fungsi baru khusus untuk menampilkan data per halaman
function displayTablePage(page) {
    const tbody = document.getElementById("listUpdateBody");
    tbody.innerHTML = "";

    if (currentFilteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">Belum ada update artikel.</td></tr>`;
        document.getElementById("paginationInfo").textContent = "Menampilkan 0 dari 0 data";
        document.getElementById("paginationControls").innerHTML = "";
        return;
    }

    // Hitung index awal dan akhir
    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = currentFilteredData.slice(startIndex, endIndex);

    pageData.forEach((row, idx) => {
        // Nomor urut aslinya berlanjut melintasi halaman
        const actualRowNumber = startIndex + idx + 1; 
        
        let statusBadge = row[13] === "Published" ? "bg-success" : (row[13].includes("Review") ? "bg-warning text-dark" : "bg-primary");
        
        let tipePub = row[6] || "";
        let indeksText = row[7] ? row[7].split(" - ")[0] : "";
        
        if (tipePub === "Prosiding") {
            if (indeksText === "Internasional" || indeksText === "Prosiding Internasional") indeksText = "Internasional";
            if (indeksText === "Nasional" || indeksText === "Prosiding Nasional") indeksText = "Nasional";
        } else if (tipePub === "Buku") {
            tipePub = ""; 
        }
        
        let textToShow = (tipePub + " " + indeksText).trim();
        let jenisText = `<span class="badge bg-secondary font-monospace fw-normal">${textToShow}</span>`;

        let badgeSkorHtml = "";
        if (row.skorSintaNum > 0 && row.involvedHomebases && row.involvedHomebases.length > 0) {
            // PERBAIKAN: Tambahkan .sort() agar urut S1, S2, S3
            let sortedHomebases = row.involvedHomebases.sort();
            
            sortedHomebases.forEach(hb => {
                badgeSkorHtml += `<span class="badge bg-success mb-1 me-1 shadow-sm">${hb}: +${row.skorSintaNum}</span><br>`;
            });
        } else {
            badgeSkorHtml = `<span class="text-muted small">-</span>`;
        }
        
        let tr = `
            <tr class="border-bottom" style="cursor: pointer;" onclick="showDetailArtikel('${row[1]}')" title="Klik untuk lihat detail">
                <td class="text-center text-muted">${actualRowNumber}</td>
                <td><span class="text-dark fw-semibold" style="font-size: 0.85rem;">${row[4]}</span></td>
                <td>
                    <div class="fw-bold text-dark mb-1" style="font-size: 0.85rem;"><i class="bi bi-journal-text me-1"></i>${row[8] || "-"}</div>
                    <div>${jenisText}</div>
                </td>
                <td class="align-middle">${badgeSkorHtml}</td>
                <td><code class="text-danger bg-light px-2 py-1 rounded border">${row[9]}</code></td>
                <td><span class="badge ${statusBadge}">${row[13]}</span></td>
                <td><span class="small text-muted d-inline-block text-truncate" style="max-width: 120px;">${row[36] || "-"}</span></td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', tr);
    });

    renderPaginationControls();
}

// Fungsi baru untuk merender tombol prev, angka, next
function renderPaginationControls() {
    const totalPages = Math.ceil(currentFilteredData.length / rowsPerPage);
    const paginationEl = document.getElementById("paginationControls");
    const infoEl = document.getElementById("paginationInfo");

    // Update Info Text (Misal: "Menampilkan 1-10 dari 50 data")
    const startCount = ((currentPage - 1) * rowsPerPage) + 1;
    const endCount = Math.min(currentPage * rowsPerPage, currentFilteredData.length);
    infoEl.innerHTML = `Menampilkan <span class="fw-bold">${startCount}-${endCount}</span> dari <span class="fw-bold">${currentFilteredData.length}</span> data`;

    paginationEl.innerHTML = "";

    // Jika hanya 1 halaman, sembunyikan kontrol paginasi
    if (totalPages <= 1) return;

    // Tombol Previous
    const isPrevDisabled = currentPage === 1 ? "disabled" : "";
    let html = `<li class="page-item ${isPrevDisabled}">
                    <a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(${currentPage - 1})"><i class="bi bi-chevron-left"></i></a>
                </li>`;

    // Tombol Angka Halaman
    // Logika agar tidak semua angka muncul (misal cuma tampil 1, 2, 3 ... 10)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(1)">1</a></li>`;
        if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? "active" : "";
        html += `<li class="page-item ${activeClass}"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(${i})">${i}</a></li>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
        html += `<li class="page-item"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(${totalPages})">${totalPages}</a></li>`;
    }

    // Tombol Next
    const isNextDisabled = currentPage === totalPages ? "disabled" : "";
    html += `<li class="page-item ${isNextDisabled}">
                <a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(${currentPage + 1})"><i class="bi bi-chevron-right"></i></a>
             </li>`;

    paginationEl.innerHTML = html;
}

// Fungsi global untuk menerima klik dari tombol halaman
window.changePage = function(pageNumber) {
    const totalPages = Math.ceil(currentFilteredData.length / rowsPerPage);
    if (pageNumber >= 1 && pageNumber <= totalPages) {
        currentPage = pageNumber;
        displayTablePage(currentPage);
    }
};

// Menampilkan Modal Detail (Global)
// Menampilkan Modal Detail (Global)
window.showDetailArtikel = function(recordId) {
    const row = dashboardMasterData.find(r => r[1] === recordId);
    if (!row) return;

    document.getElementById("detJudul").textContent = row[4];
    document.getElementById("detTarget").textContent = row[8] || "-";
    document.getElementById("detStatus").innerHTML = `<span class="badge ${row[13] === 'Published' ? 'bg-success' : 'bg-primary'}">${row[13]}</span>`;
    
    // Injeksi Jenis & Indeksasi
    let tipePub = row[6] || "";
    let indeksText = row[7] ? row[7].split(" - ")[0] : "";
    if (tipePub === "Prosiding") {
        if (indeksText === "Internasional" || indeksText === "Prosiding Internasional") indeksText = "Internasional";
        if (indeksText === "Nasional" || indeksText === "Prosiding Nasional") indeksText = "Nasional";
    } else if (tipePub === "Buku") {
        tipePub = ""; 
    }
    
    let textToShow = (tipePub + " " + indeksText).trim();
    document.getElementById("detIndeksasi").innerHTML = `<span class="badge bg-secondary font-monospace fw-normal fs-6 shadow-sm">${textToShow}</span>`;

    // Injeksi Skor SINTA per Homebase
    let badgeSkorHtml = "";
    if (row.skorSintaNum > 0 && row.involvedHomebases && row.involvedHomebases.length > 0) {
        // PERBAIKAN: Tambahkan .sort() di sini juga
        let sortedHomebases = row.involvedHomebases.sort();
        
        sortedHomebases.forEach(hb => {
            badgeSkorHtml += `<span class="badge bg-success me-1 mb-1 fs-6 shadow-sm"><i class="bi bi-graph-up-arrow me-1"></i>${hb}: +${row.skorSintaNum}</span> `;
        });
    } else {
        badgeSkorHtml = `<span class="text-muted small">-</span>`;
    }
    document.getElementById("detSkor").innerHTML = badgeSkorHtml;

    // ==========================================
    // INJEKSI GRUP PENULIS
    // ==========================================
    
    // A. Internal (Dosen) - Index 9
    let internalHtml = "";
    const intAuthors = String(row[9]).split(",").map(s => s.trim()).filter(s => s);
    if (intAuthors.length > 0) {
        internalHtml = intAuthors.map(kode => {
            // Beri warna merah dan tebal jika dia Corresponding Author (*)
            if (kode.includes("*")) return `<span class="text-danger fw-bold">${kode}</span>`;
            return `<span>${kode}</span>`;
        }).join(", ");
    } else {
        internalHtml = `<span class="text-muted fst-italic">-</span>`;
    }
    document.getElementById("detPenulisInternal").innerHTML = internalHtml;

    // B. Mahasiswa - Index 10
    let mhsHtml = "";
    const mhsNius = String(row[10]).split(",").map(s => s.trim()).filter(s => s);
    if (mhsNius.length > 0) {
        mhsHtml = mhsNius.map(niu => `<span class="bg-white border rounded px-1 me-1">${niu}</span>`).join(" ");
    } else {
        mhsHtml = `<span class="text-muted fst-italic">Tidak melibatkan mahasiswa</span>`;
    }
    document.getElementById("detPenulisMahasiswa").innerHTML = mhsHtml;

    // C. Eksternal - Index 11 (Nama) & 12 (Afiliasi)
    let extHtml = "";
    const extNames = String(row[11]).split("|").map(s => s.trim()).filter(s => s);
    const extAfils = String(row[12]).split("|").map(s => s.trim()).filter(s => s);
    
    if (extNames.length > 0) {
        // Buat list ul/li agar rapi jika penulis luarnya banyak
        extHtml = `<ul class="mb-0 ps-3">`;
        for (let i = 0; i < extNames.length; i++) {
            let afiliasi = extAfils[i] ? ` <span class="text-muted fw-normal">(${extAfils[i]})</span>` : "";
            extHtml += `<li>${extNames[i]}${afiliasi}</li>`;
        }
        extHtml += `</ul>`;
    } else {
        extHtml = `<span class="text-muted fst-italic">-</span>`;
    }
    document.getElementById("detPenulisEksternal").innerHTML = extHtml;

    // Catatan Kendala
    const catatanArea = document.getElementById("detCatatan");
    catatanArea.textContent = row[36] || "Tidak ada catatan / kendala khusus yang dilaporkan.";

    new bootstrap.Modal(document.getElementById('modalDetailArtikel')).show();
};

function renderChartStatus(dataObj) {
    const ctx = document.getElementById('chartStatus');
    if(!ctx) return;
    
    const statusOrder = ["Draft", "Draft Ready", "Submitted", "On Review", "On Review Round 1", "Revision", "Revision Round 1", "Revision Round 1 Submitted", "On Review Round 2", "Revision Round 2", "Revision Round 2 Submitted", "Accepted", "Presented", "Copyediting/ Proofread", "Published"];
    const sortedKeys = Object.keys(dataObj).sort((a,b) => statusOrder.indexOf(a) - statusOrder.indexOf(b));
    const sortedData = sortedKeys.map(k => dataObj[k]);
    const total = sortedData.reduce((a, b) => a + b, 0);

    const formattedLabels = sortedKeys.map(label => {
        if(label.includes("Revision Round 1")) return ["Revision", "Round 1"];
        if(label.includes("Revision Round 2")) return ["Revision", "Round 2"];
        if(label.includes("On Review Round")) return ["On Review", label.replace("On Review ", "")];
        return label;
    });

    const customPalette = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab', '#17becf', '#bcbd22', '#393b79', '#8c6d31'];

    chartInstances['status'] = new Chart(ctx, {
        type: 'pie',
        plugins: [ChartDataLabels],
        data: { labels: formattedLabels, datasets: [{ data: sortedData, backgroundColor: customPalette }] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 12, boxHeight: 12, usePointStyle: false, font: { size: 10 } } },
                datalabels: {
                    color: '#fff', font: { weight: 'bold', size: 11 },
                    formatter: (value) => {
                        let percentage = ((value / total) * 100).toFixed(0);
                        return percentage > 4 ? percentage + "%" : ""; 
                    }
                }
            } 
        }
    });
}

function renderTableAuthorshipHeatmap(dataObj) {
    const tbody = document.getElementById('tableAuthorshipBody');
    if(!tbody) return;
    tbody.innerHTML = "";

    const sortedAuthors = Object.keys(dataObj).sort((a,b) => dataObj[b] - dataObj[a]);
    if(sortedAuthors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-2">Belum ada data.</td></tr>`;
        return;
    }

    const maxCount = dataObj[sortedAuthors[0]];

    sortedAuthors.forEach((kode, index) => {
        const count = dataObj[kode];
        let alpha = (count / maxCount) * 0.85; 
        if (alpha < 0.1) alpha = 0.1;
        const textColor = alpha > 0.5 ? '#ffffff' : '#212529'; 

        let tr = `
            <tr class="border-bottom">
                <td class="text-center text-muted py-2" style="font-size: 0.9rem;">${index + 1}</td>
                <td class="py-2 text-dark" style="font-size: 0.9rem;">${kode}</td>
                <td class="text-center py-2" style="background-color: rgba(13, 110, 253, ${alpha}); color: ${textColor}; transition: background-color 0.3s;">
                    ${count}
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', tr);
    });
}

function renderChartTrend(dataObj) {
    const ctx = document.getElementById('chartTrend');
    if(!ctx) return;

    chartInstances['trend'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [
                { 
                    label: 'Jurnal', 
                    data: Object.values(dataObj["Jurnal"] || {}), 
                    backgroundColor: '#4e73df', // Biru
                    borderRadius: 3 
                },
                { 
                    label: 'Prosiding', 
                    data: Object.values(dataObj["Prosiding"] || {}), 
                    backgroundColor: '#1cc88a', // Hijau
                    borderRadius: 3 
                },
                { 
                    label: 'Buku', 
                    data: Object.values(dataObj["Buku"] || {}), 
                    backgroundColor: '#dc3545', // Merah
                    borderRadius: 3 
                }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { position: 'bottom' } },
            scales: { 
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } 
            } 
        }
    });
}

function renderChartIndexation(dataObj) {
    const ctx = document.getElementById('chartIndexation');
    if(!ctx) return;

    const indexOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'Non-Q', 'Sinta 1', 'Sinta 2', 'Sinta 3', 'Sinta 4', 'Sinta 5', 'Sinta 6', 'Non-Sinta', 'Prosiding Internasional', 'Prosiding Nasional', 'Buku Ajar', 'Buku Referensi', 'Buku Monograf'];
    const sortedKeys = Object.keys(dataObj).sort((a,b) => {
        let indexA = indexOrder.indexOf(a); let indexB = indexOrder.indexOf(b);
        if(indexA === -1) indexA = 99; if(indexB === -1) indexB = 99;
        return indexA - indexB;
    });
    
    const sortedData = sortedKeys.map(k => dataObj[k]);

    chartInstances['indexation'] = new Chart(ctx, {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: sortedKeys,
            datasets: [{
                data: sortedData,
                backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#0d6efd', '#6610f2', '#6f42c1', '#e83e8c', '#17a2b8', '#adb5bd', '#28a745', '#198754', '#0dcaf0', '#495057', '#d63384', '#6c757d', '#343a40']
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            cutout: '50%',
            plugins: { 
                legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true, font: { size: 10 } } },
                datalabels: {
                    color: '#fff', font: { weight: 'bold', size: 12 },
                    formatter: (value) => { return value; } 
                }
            } 
        }
    });
}

function renderChartMahasiswa(dataObj) {
    const ctx = document.getElementById('chartMahasiswa');
    if(!ctx) return;

    chartInstances['mahasiswa'] = new Chart(ctx, {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: Object.keys(dataObj),
            datasets: [{
                data: Object.values(dataObj),
                backgroundColor: ['#20c997', '#adb5bd'] 
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            cutout: '60%',
            plugins: { 
                legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 11 } } },
                datalabels: {
                    color: '#fff', font: { weight: 'bold', size: 13 },
                    formatter: (value) => { return value > 0 ? value : ""; } 
                }
            } 
        }
    });
}

// ==========================================
// SCRIPT NAVIGASI & UTILITIES
// ==========================================
const Loading = { show: () => document.getElementById("loadingOverlay")?.classList.remove("d-none"), hide: () => document.getElementById("loadingOverlay")?.classList.add("d-none") };

document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) toggleBtn.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));

    document.getElementById("btnLogout").addEventListener("click", (e) => {
        e.preventDefault();
        Swal.fire({
            title: 'Keluar dari SIRISMA?', text: "Sesi Anda akan berakhir.", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#0d6efd', cancelButtonColor: '#dc3545', confirmButtonText: 'Ya, Keluar', reverseButtons: true
        }).then((result) => { if (result.isConfirmed) performLogout(); });
    });

    const params = new URLSearchParams(window.location.search);
    const pageKey = params.get("page");
    if (pageKey) {
        const routes = { 'monitorartikel': '01_monitorartikel.html', 'arsippublikasi': '02_arsippublikasi.html', 'sintasimulator': '03_sintasimulator.html', 'jurnalhub': '04_jurnalhub.html' };
        if (routes[pageKey]) loadPage(routes[pageKey], pageKey);
    }
});

function loadPage(eventOrPage, pagePath, key) {
    let finalPage, finalKey;
    if (typeof eventOrPage === 'object' && eventOrPage !== null) { eventOrPage.preventDefault(); finalPage = pagePath; finalKey = key; } 
    else { finalPage = eventOrPage; finalKey = pagePath; }

    if (!finalPage || !finalKey) return;
    Loading.show();
    fetch(finalPage).then(res => res.text()).then(html => {
        document.getElementById("mainContent").innerHTML = html;
        history.pushState({ page: finalPage, key: finalKey }, "", `${window.location.origin}${window.location.pathname}?page=${finalKey}`);
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`a[onclick*="'${finalKey}'"]`);
        if (activeLink) activeLink.classList.add('active');

        const scripts = { 'monitorartikel': 'js/01_monitorartikel.js', 'arsippublikasi': 'js/02_arsippublikasi.js', 'sintasimulator': 'js/03_sintasimulator.js', 'jurnalhub': 'js/04_jurnalhub.js' };
        if (scripts[finalKey]) loadScript(scripts[finalKey]);
    }).catch(err => {
        document.getElementById("mainContent").innerHTML = "<div class='text-center mt-5'><i class='bi bi-exclamation-circle text-danger fs-1'></i><p>Gagal memuat halaman.</p></div>";
    }).finally(() => Loading.hide());
}

function loadScript(src) {
    const oldScript = document.querySelector(`script[src="${src}"]`);
    if (oldScript) oldScript.remove();
    const script = document.createElement('script');
    script.src = src; script.async = true;
    document.body.appendChild(script);
}

function performLogout() { sessionStorage.clear(); localStorage.clear(); window.location.href = "index.html"; }