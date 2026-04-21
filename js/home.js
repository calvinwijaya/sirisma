const user = JSON.parse(sessionStorage.getItem("user"));
let dashboardMasterData = [];
let masterDosenList = []; // Kamus data dosen
let chartInstances = {}; 

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
    const tableHeader = document.getElementById("tableUpdateHeader");

    if (isExecutive) {
        if(analyticsSection) analyticsSection.classList.remove("d-none");
        if(filterSearch) filterSearch.classList.remove("d-none");
        if(filterKbk) filterKbk.classList.remove("d-none");
        tableHeader.textContent = "Update Artikel Departemen";
    }

    // Event Listeners
    document.getElementById("filterBulan").addEventListener("change", processAndRenderDashboard);
    document.getElementById("filterTahun").addEventListener("change", processAndRenderDashboard);
    
    if(isExecutive) {
        document.getElementById("filterKbk").addEventListener("change", processAndRenderDashboard);
        document.getElementById("filterSearchDosen").addEventListener("keyup", processAndRenderDashboard);
    }

    // Ambil data Artikel DAN data Dosen
    fetchAllData();
}

// Mengambil dua sumber data sekaligus
async function fetchAllData() {
    Loading.show();
    try {
        // 1. Ambil Data Artikel
        const resArtikel = await fetch(GAS_DATABASE + "?t=" + new Date().getTime());
        const dataArtikel = await resArtikel.json();
        if (dataArtikel.status === "ok") dashboardMasterData = dataArtikel.data;

        // 2. Ambil Data Dosen (untuk mapping Nama & KBK)
        const resDosen = await fetch(GAS_LOGIN, { 
            method: "POST", 
            body: JSON.stringify({ action: "get_users" }) 
        });
        const dataDosen = await resDosen.json();
        if (dataDosen.status === "ok") masterDosenList = dataDosen.user;

        processAndRenderDashboard();
    } catch (err) {
        console.error("Gagal load data dashboard:", err);
    } finally {
        Loading.hide();
    }
}

// ==========================================
// PENGAMBILAN DATA & PEMROSESAN
// ==========================================
function fetchDashboardData() {
    if (typeof GAS_DATABASE === 'undefined') return;

    fetch(GAS_DATABASE + "?t=" + new Date().getTime())
        .then(res => res.json())
        .then(response => {
            if (response.status === "ok" && response.data) {
                dashboardMasterData = response.data;
                processAndRenderDashboard();
            }
        })
        .catch(err => {
            console.error("Gagal load dashboard:", err);
            document.getElementById("listUpdateBody").innerHTML = `<tr><td colspan="6" class="text-center text-danger">Gagal memuat data.</td></tr>`;
        });
}

function processAndRenderDashboard() {
    const filterBulanEl = document.getElementById("filterBulan");
    // CEK KEAMANAN DOM: Jika elemen filter tidak ada (berarti user pindah page), hentikan fungsi.
    if (!filterBulanEl) return; 

    const role = user.role;
    const isExecutive = ["Admin", "Kadep", "Sekdep"].includes(role);

    const valBulan = document.getElementById("filterBulan").value; 
    const valTahun = document.getElementById("filterTahun").value;
    const valKbk = isExecutive ? document.getElementById("filterKbk").value : "";
    const valSearch = isExecutive ? document.getElementById("filterSearchDosen").value.toLowerCase() : "";

    // Membuat Map/Kamus Dosen agar pencarian cepat
    // { "CLV": { nama: "Calvin...", kbk: "..." }, ... }
    const dosenMap = {};
    masterDosenList.forEach(d => { dosenMap[d.kode] = d; });

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

        // 1. Filter Waktu
        if (valBulan !== "" && rowBulan !== valBulan) return false;
        if (valTahun !== "" && rowTahun !== valTahun) return false;

        // Ambil Daftar Kode Penulis (array)
        const authorCodes = String(row[9]).replace(/\*/g, "").split(", ");

        // 2. Filter Hak Akses & KBK/Search (Logika Utama)
        if (!isExecutive) {
            // Dosen Biasa
            const isPIC = row[3] === user.email; 
            const isAuthor = authorCodes.includes(user.kode); 
            if (!isPIC && !isAuthor) return false;
        } else {
            // Admin/Eksekutif
            
            // A. Filter KBK
            if (valKbk !== "") {
                // Cek apakah ada salah satu penulis artikel ini yang berasal dari KBK tersebut
                const isMatchKbk = authorCodes.some(kode => {
                    return dosenMap[kode] && dosenMap[kode].kbk === valKbk;
                });
                if (!isMatchKbk) return false;
            }

            // B. Filter Search (Nama atau Kode)
            if (valSearch.trim() !== "") {
                const isMatchSearch = authorCodes.some(kode => {
                    const namaLengkap = dosenMap[kode] ? dosenMap[kode].nama.toLowerCase() : "";
                    const kodeDosen = kode.toLowerCase();
                    return namaLengkap.includes(valSearch) || kodeDosen.includes(valSearch);
                });
                if (!isMatchSearch) return false;
            }
        }
        return true;
    });

    // Struktur Data untuk Chart Baru
    let statusCounts = {};
    let trendCounts = { 
        "Jurnal": { "01":0, "02":0, "03":0, "04":0, "05":0, "06":0, "07":0, "08":0, "09":0, "10":0, "11":0, "12":0 },
        "Prosiding": { "01":0, "02":0, "03":0, "04":0, "05":0, "06":0, "07":0, "08":0, "09":0, "10":0, "11":0, "12":0 }
    };
    let authorCounts = {};
    let indexCounts = {};
    let mhsCounts = { "Melibatkan Mhs.": 0, "Dosen Mandiri": 0 };

    filteredData.forEach(row => {
        const status = row[11] || "Unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        const tipePub = row[6] === "Jurnal" ? "Jurnal" : "Prosiding";
        const tglStr = String(row[2]).split(" ")[0].split("/");
        if(tglStr.length === 3) {
            const bln = tglStr[1];
            if(trendCounts[tipePub][bln] !== undefined) trendCounts[tipePub][bln]++;
        }

        let indeks = row[7] || "Unknown";
        // Ubah penamaan indeksasi prosiding sesuai permintaan
        if (indeks === "Nasional") indeks = "Prosiding Nasional";
        if (indeks === "Internasional") indeks = "Prosiding Internasional";
        indexCounts[indeks] = (indexCounts[indeks] || 0) + 1;

        if (isExecutive) {
            const authorsArr = String(row[9]).replace(/\*/g, "").split(", ");
            authorsArr.forEach(kode => {
                if(kode.trim() !== "") authorCounts[kode] = (authorCounts[kode] || 0) + 1;
            });
        }

        // Cek Kolom 10 (Keterlibatan Mahasiswa)
        if (row[10] && String(row[10]).trim() !== "") {
            mhsCounts["Melibatkan Mhs."]++;
        } else {
            mhsCounts["Dosen Mandiri"]++;
        }
    });

    renderTableUpdate(filteredData);
    
    Object.keys(chartInstances).forEach(key => {
        if(chartInstances[key]) chartInstances[key].destroy();
    });

    renderChartStatus(statusCounts);
    renderChartTrend(trendCounts);
    
    if (isExecutive) {
        renderTableAuthorshipHeatmap(authorCounts); 
        renderChartIndexation(indexCounts);
        renderChartMahasiswa(mhsCounts);
    }
}

// ==========================================
// RENDERING KOMPONEN
// ==========================================

function renderTableUpdate(data) {
    const tbody = document.getElementById("listUpdateBody");
    tbody.innerHTML = "";

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">Belum ada update artikel.</td></tr>`;
        return;
    }

    let latestData = data.slice().reverse().slice(0, 10);
    latestData.forEach((row, index) => {
        let statusBadge = row[11] === "Published" ? "bg-success" : (row[11].includes("Review") ? "bg-warning text-dark" : "bg-primary");
        
        // Perhatikan penambahan style="cursor:pointer" dan atribut onclick
        let tr = `
            <tr class="border-bottom" style="cursor: pointer;" onclick="showDetailArtikel('${row[1]}')" title="Klik untuk lihat detail">
                <td class="text-center text-muted">${index + 1}</td>
                <td><span class="text-dark">${row[4]}</span></td>
                <td><span class="small text-secondary"><i class="bi bi-journal-text me-1"></i>${row[8] || "-"}</span></td>
                <td><code class="text-danger bg-light px-2 py-1 rounded border">${row[9]}</code></td>
                <td><span class="badge ${statusBadge}">${row[11]}</span></td>
                <td><span class="small text-muted d-inline-block text-truncate" style="max-width: 150px;">${row[34] || "-"}</span></td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', tr);
    });
}

// Fungsi Baru untuk menampilkan Modal Detail
window.showDetailArtikel = function(recordId) {
    const row = dashboardMasterData.find(r => r[1] === recordId);
    if (!row) return;

    document.getElementById("detJudul").textContent = row[4];
    document.getElementById("detTarget").textContent = row[8] || "-";
    document.getElementById("detStatus").innerHTML = `<span class="badge ${row[11] === 'Published' ? 'bg-success' : 'bg-primary'}">${row[11]}</span>`;
    document.getElementById("detPenulis").textContent = row[9];
    
    const catatanArea = document.getElementById("detCatatan");
    catatanArea.textContent = row[34] || "Tidak ada catatan.";

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

    // Color Palette Baru yang lebih profesional & harmonis
    const customPalette = [
        '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', 
        '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab', 
        '#17becf', '#bcbd22', '#393b79', '#8c6d31'
    ];

    chartInstances['status'] = new Chart(ctx, {
        type: 'pie',
        plugins: [ChartDataLabels],
        data: {
            labels: formattedLabels,
            datasets: [{
                data: sortedData,
                backgroundColor: customPalette
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { 
                legend: { 
                    position: 'right',
                    labels: { boxWidth: 12, boxHeight: 12, usePointStyle: false, font: { size: 10 } } 
                },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 11 },
                    formatter: (value) => {
                        let percentage = ((value / total) * 100).toFixed(0);
                        return percentage > 4 ? percentage + "%" : ""; 
                    }
                }
            } 
        }
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
                    data: Object.values(dataObj["Jurnal"]), 
                    backgroundColor: '#4e73df', // Biru Elegan
                    borderRadius: 3 
                },
                { 
                    label: 'Prosiding', 
                    data: Object.values(dataObj["Prosiding"]), 
                    backgroundColor: '#1cc88a', // Hijau Mint/Teal
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
        
        // Kalkulasi intensitas warna biru
        let alpha = (count / maxCount) * 0.85; 
        if (alpha < 0.1) alpha = 0.1;
        
        // Warna teks untuk kolom Total Artikel
        const textColor = alpha > 0.5 ? '#ffffff' : '#212529'; 

        // Perhatikan penggunaan 'py-1' untuk merampingkan baris
        // Heatmap HANYA diterapkan pada tag <td> bagian Total Artikel
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

function renderChartIndexation(dataObj) {
    const ctx = document.getElementById('chartIndexation');
    if(!ctx) return;

    // Urutan Indeksasi Baku
    const indexOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'Sinta 1', 'Sinta 2', 'Sinta 3', 'Sinta 4', 'Sinta 5', 'Sinta 6', 'Prosiding Internasional', 'Prosiding Nasional'];
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
                backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#0d6efd', '#6610f2', '#6f42c1', '#e83e8c', '#17a2b8', '#adb5bd', '#28a745', '#198754']
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            cutout: '50%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, font: { size: 10 } } },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 12 },
                    formatter: (value) => { return value; } // Tampilkan jumlah (angka asli) di dalam doughnut
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
                backgroundColor: ['#20c997', '#adb5bd'] // Hijau Teal untuk Kolaborasi, Abu-abu untuk Mandiri
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            cutout: '60%',
            plugins: { 
                legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 11 } } },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 13 },
                    formatter: (value) => { return value > 0 ? value : ""; } 
                }
            } 
        }
    });
}

// ==========================================
// SCRIPT NAVIGASI & UTILITIES (TETAP SAMA)
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