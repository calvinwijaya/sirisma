(function() {
    // ==========================================
    // STATE LOKAL (SPA Safe)
    // ==========================================
    let masterArsipData = [];

    // ==========================================
    // INISIALISASI & EVENT LISTENERS
    // ==========================================
    function initArsipPublikasi() {
        setupEventListeners();
        fetchArsipData();
    }

    function setupEventListeners() {
        const btnRefresh = document.getElementById("btnRefreshArsip");
        const filterTahun = document.getElementById("filterTahunArsip");
        const filterTipe = document.getElementById("filterTipeArsip");
        const searchInput = document.getElementById("searchArsip");

        if(btnRefresh) btnRefresh.addEventListener("click", fetchArsipData);
        if(filterTahun) filterTahun.addEventListener("change", () => renderArsipTable());
        if(filterTipe) filterTipe.addEventListener("change", () => renderArsipTable());
        
        // Fitur pencarian mengetik (debounce ringan)
        if(searchInput) {
            searchInput.addEventListener("keyup", () => renderArsipTable());
        }
    }

    // ==========================================
    // FUNGSI PENGAMBILAN DATA
    // ==========================================
    function fetchArsipData() {
        const loadingState = document.getElementById("loadingArsipState");
        const emptyState = document.getElementById("emptyArsipState");
        const tableContainer = document.getElementById("tableArsipContainer");

        loadingState.classList.remove("d-none");
        emptyState.classList.add("d-none");
        tableContainer.classList.add("d-none");

        if (typeof GAS_DATABASE === 'undefined') {
            console.error("URL GAS_DATABASE belum diset di config.js");
            return;
        }

        const urlAntiCache = GAS_DATABASE + "?t=" + new Date().getTime();

        fetch(urlAntiCache)
            .then(res => res.json())
            .then(response => {
                loadingState.classList.add("d-none");
                if (response.status === "ok" && response.data && response.data.length > 0) {
                    // Simpan data master
                    masterArsipData = response.data;
                    renderArsipTable();
                } else {
                    emptyState.classList.remove("d-none");
                }
            })
            .catch(err => {
                console.error("Gagal mengambil data arsip:", err);
                loadingState.classList.add("d-none");
                emptyState.classList.remove("d-none");
            });
    }

    // ==========================================
    // FUNGSI RENDER TABEL & FILTER
    // ==========================================
    function renderArsipTable() {
        const tbody = document.getElementById("arsipTableBody");
        const tableContainer = document.getElementById("tableArsipContainer");
        const emptyState = document.getElementById("emptyArsipState");
        
        const filterTahunEl = document.getElementById("filterTahunArsip");
        const filterTipeEl = document.getElementById("filterTipeArsip");
        const searchInputEl = document.getElementById("searchArsip");

        // CEK KEAMANAN DOM: Jika form tidak ditemukan (user pindah menu), batalkan render
        if (!tbody || !filterTahunEl || !filterTipeEl || !searchInputEl) return;
        
        const valTahun = filterTahunEl.value;
        const valTipe = filterTipeEl.value;
        const valSearch = searchInputEl.value.toLowerCase();
        
        const activeUser = JSON.parse(sessionStorage.getItem("user"));
        tbody.innerHTML = "";

        let filteredData = masterArsipData.filter(row => {
            // PERBAIKAN INDEX: Status Terkini sekarang ada di Index 13 (N)
            if (row[13] !== "Published") return false;

            // LOGIKA HAK AKSES: Admin/Kadep/Sekdep otomatis lolos pengecekan ini
            const isAdminExec = ["Admin", "Kadep", "Sekdep"].includes(activeUser.role);
            const isPIC = row[3] === activeUser.email; 
            const isAuthor = String(row[9]).includes(activeUser.kode); 
            if (!isAdminExec && !isPIC && !isAuthor) return false;

            if (valTahun !== "Semua" && String(row[5]) !== valTahun) return false;
            if (valTipe !== "Semua" && String(row[6]) !== valTipe) return false;

            if (valSearch.trim() !== "") {
                const judul = String(row[4]).toLowerCase();
                const jurnal = String(row[8]).toLowerCase();
                if (!judul.includes(valSearch) && !jurnal.includes(valSearch)) return false;
            }

            return true;
        });

        if (filteredData.length === 0) {
            tableContainer.classList.add("d-none");
            emptyState.classList.remove("d-none");
            return;
        }

        emptyState.classList.add("d-none");
        tableContainer.classList.remove("d-none");

        filteredData.reverse().forEach((row, index) => {
            const tipe = row[6]; 
            
            // Penyesuaian warna badge untuk Buku
            let typeColor = "bg-primary";
            if (tipe === "Prosiding") typeColor = "bg-success";
            else if (tipe === "Buku") typeColor = "bg-danger";

            let indeksText = row[7] ? String(row[7]).split(" - ")[0] : "";
            if (tipe === "Prosiding") {
                if (indeksText === "Internasional" || indeksText === "Prosiding Internasional") indeksText = "Internasional";
                if (indeksText === "Nasional" || indeksText === "Prosiding Nasional") indeksText = "Nasional";
            } else if (tipe === "Buku") {
                // Buku sudah punya teks yang utuh (Buku Ajar, dll), kosongkan tipe agar tidak dobel
                indeksText = String(row[7]).split(" - ")[0];
            }
            
            const indexColor = String(row[7]).includes("Q") ? "bg-warning text-dark" : "bg-info text-dark";
            
            let stringTanggal = "";
            let tahunTerbit = "-"; 
            
            if (tipe === "Jurnal") {
                // PERBAIKAN INDEX: Tgl Published Jurnal sekarang di Index 26 (AA)
                const rawTglPub = row[26];
                const tglPub = rawTglPub ? String(rawTglPub).split(" ")[0] : "Belum tercatat";
                
                if (rawTglPub) {
                    const parts = tglPub.split("/");
                    if (parts.length === 3) tahunTerbit = parts[2];
                }
                
                stringTanggal = `<div class="text-success fw-semibold"><i class="bi bi-calendar-check me-1"></i>Pub: ${tglPub}</div>`;
            } else {
                // PERBAIKAN INDEX: Tgl Presented Prosiding di 34 (AI), Tgl Published Prosiding/Buku di 35 (AJ)
                const rawTglPres = row[34];
                const rawTglPub = row[35];
                const tglPres = rawTglPres ? String(rawTglPres).split(" ")[0] : "-";
                const tglPub = rawTglPub ? String(rawTglPub).split(" ")[0] : "Belum tercatat";

                if (rawTglPub) {
                    const parts = tglPub.split("/");
                    if (parts.length === 3) tahunTerbit = parts[2];
                }

                // Untuk buku, jarang ada 'Presented', jadi kita sembunyikan baris Pres jika itu buku
                if (tipe === "Buku") {
                    stringTanggal = `
                        <div class="text-success fw-semibold"><i class="bi bi-calendar-check me-1"></i>Pub: ${tglPub}</div>
                    `;
                } else {
                    stringTanggal = `
                        <div class="text-secondary mb-1" style="font-size: 0.75rem;"><i class="bi bi-mic me-1"></i>Pres: ${tglPres}</div>
                        <div class="text-success fw-semibold"><i class="bi bi-calendar-check me-1"></i>Pub: ${tglPub}</div>
                    `;
                }
            }

            // Jika tanggal publish kosong/belum tercatat, gunakan Tahun Target (Kolom F) sebagai fallback sementara
            if (tahunTerbit === "-") {
                tahunTerbit = row[5];
            }

            let btnUrl = `<span class="text-muted small">-</span>`;
            // PERBAIKAN INDEX: URL Link sekarang ada di Index 14 (O)
            if (row[14] && String(row[14]).trim() !== "") {
                btnUrl = `<a href="${row[14]}" target="_blank" class="btn btn-sm btn-outline-primary shadow-sm" title="Buka Tautan"><i class="bi bi-box-arrow-up-right"></i></a>`;
            }

            // Gabungkan teks badge agar ringkas
            let displayTipe = (tipe === "Buku") ? "" : tipe;
            let displayBadge = `${displayTipe} ${indeksText}`.trim();

            const trHtml = `
                <tr>
                    <td class="text-center text-muted fw-bold">${index + 1}</td>
                    <td>
                        <div class="fw-bold text-dark mb-1">${row[4]}</div>
                        <div class="text-muted small" style="font-size:0.75rem;">Tahun Terbit: <span class="fw-semibold">${tahunTerbit}</span></div>
                    </td>
                    <td>
                        <span class="badge ${typeColor} font-monospace mb-1">${displayBadge}</span><br>
                        <span class="fw-semibold text-secondary" style="font-size:0.8rem;">${row[8] || "Tidak diketahui"}</span>
                    </td>
                    <td class="text-center">
                        <span class="badge ${indexColor}">${indeksText}</span>
                    </td>
                    <td>
                        <code class="text-danger bg-light px-2 py-1 rounded border">${row[9]}</code>
                    </td>
                    <td>
                        ${stringTanggal}
                    </td>
                    <td class="text-center">
                        ${btnUrl}
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', trHtml);
        });
    }

    // Eksekusi otomatis saat script diload
    initArsipPublikasi();
})();