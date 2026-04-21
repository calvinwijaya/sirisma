(function() {
    // ==========================================
    // STATE LOKAL (Aman dari error redeclaration SPA)
    // ==========================================
    let masterDosenList = []; 
    let masterArtikelData = []; 
    let authorCount = 0;
    let masterMahasiswaList = [];
    let studentCount = 0;

    const optIndeksasiJurnal = [
        "Q1 - Skor SINTA 40", "Q2 - Skor SINTA 24", "Q3 - Skor SINTA 22", "Q4 - Skor SINTA 20", "Non-Q - Skor SINTA 30", 
        "Sinta 1 - Skor SINTA 25", "Sinta 2 - Skor SINTA 25", "Sinta 3 - Skor SINTA 20", "Sinta 4 - Skor SINTA 20", 
        "Sinta 5 - Skor SINTA 15", "Sinta 6 - Skor SINTA 15", "Non-Sinta - Skor SINTA 10"
    ];
    const optIndeksasiProsiding = [
        "Internasional - Skor SINTA 30", "Nasional - Skor SINTA 10"
    ];
    const optStatusJurnal = ["Draft", "Draft Ready", "Submitted", "On Review Round 1", "Revision Round 1", "Revision Round 1 Submitted", "On Review Round 2", "Revision Round 2", "Revision Round 2 Submitted", "Accepted", "Copyediting/ Proofread", "Published"];
    const optStatusProsiding = ["Draft", "Draft Ready", "Submitted", "On Review", "Revision", "Revision Submitted", "Accepted", "Presented", "Published"];
    const optPeranAuthor = ["First Author", "Corresponding Author", "Co-Author"];

    const timelineJurnal = [
        { label: "Draft", index: 13, status: "Draft" }, { label: "Ready", index: 14, status: "Draft Ready" }, { label: "Submit", index: 15, status: "Submitted" },
        { label: "Review 1", index: 16, status: "On Review Round 1" }, { label: "Rev 1", index: 17, status: "Revision Round 1" }, { label: "Rev 1 Sub", index: 18, status: "Revision Round 1 Submitted" },
        { label: "Review 2", index: 19, status: "On Review Round 2" }, { label: "Rev 2", index: 20, status: "Revision Round 2" }, { label: "Rev 2 Sub", index: 21, status: "Revision Round 2 Submitted" },
        { label: "Accepted", index: 22, status: "Accepted" }, { label: "Proofread", index: 23, status: "Copyediting/ Proofread" }, { label: "Published", index: 24, status: "Published" }
    ];

    const timelineProsiding = [
        { label: "Draft", index: 25, status: "Draft" }, { label: "Ready", index: 26, status: "Draft Ready" }, { label: "Submit", index: 27, status: "Submitted" },
        { label: "Review", index: 28, status: "On Review" }, { label: "Revision", index: 29, status: "Revision" }, { label: "Rev Sub", index: 30, status: "Revision Submitted" },
        { label: "Accepted", index: 31, status: "Accepted" }, { label: "Presented", index: 32, status: "Presented" }, { label: "Published", index: 33, status: "Published" }
    ];

    // ==========================================
    // INISIALISASI
    // ==========================================
    function initMonitorArtikel() {
        fetchDosenList();
        fetchMahasiswaList();
        fetchArtikelData();
        setupEventListeners();
    }

    function setupEventListeners() {
        const btnRefresh = document.getElementById("btnRefreshArtikel");
        if(btnRefresh) btnRefresh.addEventListener("click", fetchArtikelData);

        const filterTahun = document.getElementById("filterTahunArtikel");
        if(filterTahun) filterTahun.addEventListener("change", () => renderArtikelCards(masterArtikelData));

        const ddlSubmit = document.getElementById("rencanaSubmit");
        if(ddlSubmit) ddlSubmit.addEventListener("change", function() { updateDropdownOptions(this.value); });

        document.getElementById("statusTerkini")?.addEventListener("change", function() {
            const containerUrl = document.getElementById("containerUrlPublish");
            this.value === "Published" ? containerUrl.classList.remove("d-none") : containerUrl.classList.add("d-none");
        });

        document.getElementById("btnAddAuthor")?.addEventListener("click", () => createAuthorRow());
        document.getElementById("btnSimpanArtikel")?.addEventListener("click", handleSaveArtikel);

        // Reset Modal Form
        document.getElementById("btnAddStudent")?.addEventListener("click", () => createStudentRow());
        document.querySelector('[data-bs-target="#modalFormArtikel"]')?.addEventListener("click", () => {
            document.getElementById("formArtikel").reset();
            document.getElementById("recordId").value = ""; 
            document.getElementById("authorContainer").innerHTML = ""; 
            document.getElementById("studentContainer").innerHTML = ""; 
            document.getElementById("emptyStudentText").classList.remove("d-none");
            createAuthorRow(true); 
            updateDropdownOptions(""); 
        });
    }

    // ==========================================
    // FUNGSI PENGAMBILAN & PENYIMPANAN DATA
    // ==========================================
    function fetchDosenList() {
        if(typeof GAS_LOGIN === 'undefined') return;
        fetch(GAS_LOGIN, { method: "POST", body: JSON.stringify({ action: "get_users" }) })
        .then(res => res.json())
        .then(data => {
            if(data.status === "ok") {
                masterDosenList = data.user;
                // CEK KEAMANAN DOM: Pastikan user belum pindah halaman
                const authorContainer = document.getElementById("authorContainer");
                if(authorContainer && authorContainer.children.length === 0) {
                    createAuthorRow(true);
                }
            }
        }).catch(err => console.error("Gagal mengambil list dosen:", err));
    }

    function fetchArtikelData() {
        const loadingState = document.getElementById("loadingArtikelState");
        const emptyState = document.getElementById("emptyArtikelState");
        const containerList = document.getElementById("listArtikelData");

        loadingState.classList.remove("d-none");
        emptyState.classList.add("d-none");
        containerList.innerHTML = "";

        const urlAntiCache = GAS_DATABASE + "?t=" + new Date().getTime();

        fetch(urlAntiCache)
            .then(res => res.json())
            .then(response => {
                loadingState.classList.add("d-none");
                if (response.status === "ok" && response.data && response.data.length > 0) {
                    masterArtikelData = response.data;
                    renderArtikelCards(masterArtikelData);
                } else {
                    emptyState.classList.remove("d-none");
                }
            })
            .catch(err => {
                console.error(err);
                loadingState.classList.add("d-none");
                emptyState.classList.remove("d-none");
            });
    }

    function fetchMahasiswaList() {
        if(typeof GAS_MAHASISWA === 'undefined') return;
        fetch(GAS_MAHASISWA)
        .then(res => res.json())
        .then(data => {
            if(data.status === "ok") {
                masterMahasiswaList = data.data;
                // Buat DataList HTML5 untuk fitur Autocomplete/Search
                const datalist = document.createElement('datalist');
                datalist.id = "mhsDataList";
                datalist.innerHTML = masterMahasiswaList.map(m => `<option value="${m.nim} - ${m.nama}"></option>`).join("");
                document.body.appendChild(datalist);
            }
        }).catch(err => console.error("Gagal mengambil data mahasiswa:", err));
    }

    window.createStudentRow = function() {
        studentCount++;
        const container = document.getElementById("studentContainer");
        document.getElementById("emptyStudentText").classList.add("d-none");
        
        const rowId = `studentRow_${studentCount}`;
        const rowHTML = `
            <div class="row g-2 align-items-center student-item" id="${rowId}">
                <div class="col-md-11">
                    <input type="text" list="mhsDataList" class="form-control input-mahasiswa" placeholder="Cari NIM / Nama Mahasiswa..." required>
                </div>
                <div class="col-md-1 text-end">
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeStudentRow('${rowId}')"><i class="bi bi-trash"></i></button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHTML);
    };

    window.removeStudentRow = function(rowId) {
        document.getElementById(rowId)?.remove();
        if(document.getElementById("studentContainer").children.length === 0) {
            document.getElementById("emptyStudentText").classList.remove("d-none");
        }
    };

    function handleSaveArtikel() {
        const form = document.getElementById("formArtikel");
        if (!form.checkValidity()) { form.reportValidity(); return; }

        let listPenulis = [];
        document.querySelectorAll('.author-item').forEach(item => {
            const kode = item.querySelector('.select-nama-author').value;
            const peran = item.querySelector('.select-peran-author').value;
            if(kode && peran) {
                if (peran === "Corresponding Author") listPenulis.push(`${kode}*`);
                else listPenulis.push(kode);
            }
        });

        const stringPenulis = listPenulis.join(", "); 
        const currentUser = JSON.parse(sessionStorage.getItem("user"));
        const recordIdVal = document.getElementById("recordId").value; 

        // EKSTRAK NIU MAHASISWA
        let listMahasiswaNiu = [];
        document.querySelectorAll('.input-mahasiswa').forEach(input => {
            const val = input.value;
            // Cari objek mahasiswa yang NIM & Namanya persis sama dengan input
            const mhs = masterMahasiswaList.find(m => `${m.nim} - ${m.nama}` === val);
            if (mhs && mhs.niu) listMahasiswaNiu.push(mhs.niu);
        });
        const stringMahasiswa = listMahasiswaNiu.join(", "); // Hasil: "493101, 493187"

        const payloadData = {
            action: "save_artikel",
            recordId: recordIdVal, 
            emailSubmitter: currentUser.email,
            judul: document.getElementById("judulArtikel").value,
            tahunTarget: document.getElementById("tahunTarget").value,
            rencanaSubmit: document.getElementById("rencanaSubmit").value,
            targetIndeksasi: document.getElementById("targetIndeksasi").value,
            namaJurnal: document.getElementById("namaJurnal").value,
            daftarPenulis: stringPenulis,
            keterlibatanMahasiswa: stringMahasiswa,
            statusTerkini: document.getElementById("statusTerkini").value,
            urlPublish: document.getElementById("urlPublish").value,
            catatan: document.getElementById("catatanKendala").value,
        };

        Swal.fire({ title: 'Menyimpan Data...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        fetch(GAS_DATABASE, { method: "POST", body: JSON.stringify(payloadData) })
        .then(res => res.json())
        .then(data => {
            if(data.status === "ok") {
                Swal.fire('Berhasil!', data.message, 'success');
                document.getElementById("formArtikel").reset();
                bootstrap.Modal.getInstance(document.getElementById('modalFormArtikel')).hide();
                fetchArtikelData(); 
            } else { Swal.fire('Gagal!', data.message, 'error'); }
        })
        .catch(err => { Swal.fire('Error!', 'Terjadi kesalahan komunikasi server.', 'error'); });
    }

    // ==========================================
    // FUNGSI RENDER UI & HELPER
    // ==========================================
    function renderArtikelCards(data) {
        const container = document.getElementById("listArtikelData");
        const filterTahunEl = document.getElementById("filterTahunArtikel");
        
        // CEK KEAMANAN DOM: Jika elemen tidak ada (user pindah page), hentikan fungsi.
        if (!container || !filterTahunEl) return; 
        
        const filterTahun = filterTahunEl.value;
        const activeUser = JSON.parse(sessionStorage.getItem("user"));
        container.innerHTML = "";

        let filteredData = data.filter(row => {
            if (row[11] === "Published") return false;

            if (filterTahun !== "Semua" && String(row[5]) !== filterTahun) return false;
            
            const isAdminExec = ["Admin", "Kadep", "Sekdep"].includes(activeUser.role);
            const isPIC = row[3] === activeUser.email; 
            const isAuthor = String(row[9]).includes(activeUser.kode); 
            
            return isAdminExec || isPIC || isAuthor; 
        });

        const emptyState = document.getElementById("emptyArtikelState");
        if (filteredData.length === 0) {
            if(emptyState) emptyState.classList.remove("d-none");
            return;
        }

        if(emptyState) emptyState.classList.add("d-none");

        filteredData.reverse().forEach(row => {
            const type = row[6];
            const steps = type === "Jurnal" ? timelineJurnal : timelineProsiding;
            const currentStatus = row[11];
            const tglInput = row[2] ? String(row[2]).split(" ")[0] : "-";
            
            let tglUpdate = tglInput;
            steps.forEach(s => { if(row[s.index]) tglUpdate = String(row[s.index]).split(" ")[0]; });

            const typeColor = type === "Jurnal" ? "bg-primary" : "bg-success";
            
            // LOGIKA PEMISAHAN SKOR SINTA & INDEKS
            let indeksFull = String(row[7] || "");
            let displayIndeks = indeksFull;
            let skorSinta = "-";

            // Jika data baru (mengandung kata "Skor SINTA")
            if (indeksFull.includes(" - Skor SINTA ")) {
                let parts = indeksFull.split(" - Skor SINTA ");
                displayIndeks = parts[0];
                skorSinta = parts[1];
            } else {
                // Retro-compatibility (agar data lama yang belum ada skornya tetap terisi otomatis)
                const scoreMap = {
                    "Q1": "40", "Q2": "24", "Q3": "22", "Q4": "20", "Non-Q": "30",
                    "Sinta 1": "25", "Sinta 2": "25", "Sinta 3": "20", "Sinta 4": "20", "Sinta 5": "15", "Sinta 6": "15", "Non-Sinta": "10",
                    "Internasional": "30", "Nasional": "10"
                };
                skorSinta = scoreMap[indeksFull] || "-";
            }

            const indexColor = displayIndeks.includes("Q") ? "bg-warning text-dark" : "bg-info text-dark";

            const canEditDelete = (row[3] === activeUser.email || activeUser.role === "Admin");
            const actionButtons = canEditDelete ? `
                <div class="position-absolute top-0 end-0 p-2 z-3">
                    <button class="btn btn-sm btn-light text-primary shadow-sm me-1" onclick="editArtikel('${row[1]}')" title="Edit Data"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-light text-danger shadow-sm" onclick="deleteArtikel('${row[1]}')" title="Hapus Data"><i class="bi bi-trash"></i></button>
                </div>
            ` : '';

            let cardHtml = `
                <div class="col-12 mb-3">
                    <div class="card shadow-sm border-0 overflow-hidden position-relative">
                        <div class="row g-0">
                            <div class="col-md-5 p-4 border-end bg-white position-relative">
                                ${actionButtons}
                                
                                <div class="d-flex flex-wrap gap-2 mb-2 pe-5">
                                    <span class="badge ${typeColor} font-monospace">${type}</span>
                                    <span class="badge ${indexColor}">${displayIndeks}</span>
                                    <span class="badge bg-secondary border border-secondary shadow-sm"><i class="bi bi-star-fill text-warning me-1"></i>Estimasi Skor SINTA: ${skorSinta}</span>
                                </div>
                                
                                <h5 class="fw-bold text-dark mb-1 pe-5">${row[4]}</h5>
                                <p class="text-secondary small mb-3"><i class="bi bi-bank me-1"></i>${row[8] || "Target belum ditentukan"}</p>
                                <div class="row g-1 small">
                                    <div class="col-12 mb-1">
                                        <span class="me-3"><strong>Tahun:</strong> ${row[5]}</span>
                                        <span><strong>Status:</strong> <span class="text-primary fw-bold">${currentStatus}</span></span>
                                    </div>
                                    <div class="col-12"><strong>Penulis:</strong> <code class="text-danger">${row[9]}</code></div>
                                    ${row[12] ? `<div class="col-12 text-truncate mt-1"><strong>URL:</strong> <a href="${row[12]}" target="_blank" class="text-decoration-none">${row[12]}</a></div>` : ''}
                                    
                                    <div class="col-12 mt-2 pt-2 border-top">
                                        <div class="fw-bold text-primary mb-1"><i class="bi bi-chat-left-dots me-1"></i>Catatan:</div>
                                        <div class="text-muted" style="font-size: 0.8rem; font-style: italic; line-height: 1.4;">
                                            ${row[34] || "Belum ada catatan."}
                                        </div>
                                    </div>
                                </div>
                                <hr class="my-3">
                                <div class="d-flex justify-content-between align-items-center opacity-75" style="font-size: 0.75rem;">
                                    <span><i class="bi bi-calendar-plus me-1"></i>Input: ${tglInput}</span>
                                    <span><i class="bi bi-clock-history me-1"></i>Update: ${tglUpdate}</span>
                                </div>
                            </div>
                            
                            <div class="col-md-7 p-4 bg-light d-flex align-items-center">
                                <div class="tracker-wrapper">
                                    ${(() => {
                                        const currentStatusIndex = steps.findIndex(s => s.status === currentStatus);
                                        return steps.map((step, index) => {
                                            const isPassed = (row[step.index] !== "") || (index <= currentStatusIndex);
                                            const isCurrent = (index === currentStatusIndex);
                                            const tglStep = row[step.index] ? String(row[step.index]).split(" ")[0] : "";
                                            
                                            return `
                                                <div class="tracker-item ${isPassed ? 'active' : ''} ${isCurrent ? 'current' : ''}">
                                                    <div class="tracker-dot shadow-sm"><i class="bi ${isPassed ? 'bi-check-lg' : 'bi-circle'}"></i></div>
                                                    <div class="tracker-label">${step.label}</div>
                                                    <div class="tracker-date">${tglStep}</div>
                                                </div>
                                            `;
                                        }).join("");
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    function createAuthorRow(isDefault = false) {
        authorCount++;
        const container = document.getElementById("authorContainer");
        const rowId = `authorRow_${authorCount}`;
        
        let options = "";
        masterDosenList.forEach(dosen => {
            options += `<option value="${dosen.kode}">${dosen.nama}</option>`;
        });

        const rowHTML = `
            <div class="row g-2 align-items-center author-item" id="${rowId}">
                <div class="col-md-7">
                    <select class="form-select select-nama-author" required>
                        <option value="" disabled selected>Cari / Pilih Nama Penulis...</option>
                        ${options}
                    </select>
                </div>
                <div class="col-md-4">
                    <select class="form-select select-peran-author" required>
                        <option value="" disabled selected>Peran Author...</option>
                        ${optPeranAuthor.map(p => `<option value="${p}">${p}</option>`).join("")}
                    </select>
                </div>
                <div class="col-md-1 text-end">
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeAuthorRow('${rowId}')" title="Hapus"><i class="bi bi-trash"></i></button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHTML);

        if(isDefault) {
            const rowData = document.getElementById(rowId);
            const activeUser = JSON.parse(sessionStorage.getItem("user"));
            if(activeUser) {
                rowData.querySelector('.select-nama-author').value = activeUser.kode; 
                rowData.querySelector('.select-peran-author').value = "First Author";
                rowData.querySelector('.btn-outline-danger').classList.add('d-none');
            }
        }
    }

    function updateDropdownOptions(tipe) {
        const ddlIndeksasi = document.getElementById("targetIndeksasi");
        const ddlStatus = document.getElementById("statusTerkini");
        ddlIndeksasi.innerHTML = '<option value="" disabled selected>Pilih Indeksasi...</option>';
        ddlStatus.innerHTML = '<option value="" disabled selected>Pilih Status...</option>';
        if(!tipe) { ddlIndeksasi.disabled = true; ddlStatus.disabled = true; return; }

        ddlIndeksasi.disabled = false; ddlStatus.disabled = false;
        let targetIndeksasiList = tipe === "Jurnal" ? optIndeksasiJurnal : optIndeksasiProsiding;
        let targetStatusList = tipe === "Jurnal" ? optStatusJurnal : optStatusProsiding;

        targetIndeksasiList.forEach(opt => { ddlIndeksasi.innerHTML += `<option value="${opt}">${opt}</option>`; });
        targetStatusList.forEach(opt => { ddlStatus.innerHTML += `<option value="${opt}">${opt}</option>`; });
        document.getElementById("containerUrlPublish").classList.add("d-none");
        document.getElementById("urlPublish").removeAttribute("required");
    }

    // ==========================================
    // FUNGSI GLOBAL (Diekspos agar bisa di-klik di HTML)
    // ==========================================
    window.removeAuthorRow = function(rowId) {
        const row = document.getElementById(rowId);
        if(row) row.remove();
    };

    window.deleteArtikel = function(recordId) {
        Swal.fire({
            title: 'Hapus Artikel?', text: "Data akan dihapus secara permanen!", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#dc3545', cancelButtonColor: '#6c757d', confirmButtonText: 'Ya, Hapus!'
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                fetch(GAS_DATABASE, { method: "POST", body: JSON.stringify({ action: "delete_artikel", recordId: recordId }) })
                .then(res => res.json())
                .then(data => {
                    if (data.status === "ok") { Swal.fire('Terhapus!', 'Artikel dihapus.', 'success'); fetchArtikelData(); } 
                    else Swal.fire('Gagal', data.message, 'error');
                }).catch(err => Swal.fire('Error', 'Kesalahan server.', 'error'));
            }
        });
    };

    window.editArtikel = function(recordId) {
        const row = masterArtikelData.find(r => r[1] === recordId);
        if (!row) return;

        document.getElementById("recordId").value = row[1];
        document.getElementById("judulArtikel").value = row[4];
        document.getElementById("tahunTarget").value = row[5];
        document.getElementById("rencanaSubmit").value = row[6];
        
        updateDropdownOptions(row[6]);
        setTimeout(() => {
            document.getElementById("targetIndeksasi").value = row[7];
            document.getElementById("statusTerkini").value = row[11];
            if (row[11] === "Published") {
                document.getElementById("containerUrlPublish").classList.remove("d-none");
                document.getElementById("urlPublish").value = row[12];
            }
        }, 100);

        document.getElementById("namaJurnal").value = row[8];
        document.getElementById("catatanKendala").value = row[34];

        document.getElementById("authorContainer").innerHTML = ""; 
        const authors = String(row[9]).split(", ");
        authors.forEach(authorText => {
            createAuthorRow(); 
            const lastRow = document.getElementById("authorContainer").lastElementChild;
            let isCorr = authorText.includes("*");
            let kode = authorText.replace("*", "");
            
            lastRow.querySelector('.select-nama-author').value = kode;
            if(isCorr) lastRow.querySelector('.select-peran-author').value = "Corresponding Author";
            else lastRow.querySelector('.select-peran-author').value = "Co-Author"; 
        });

        document.getElementById("studentContainer").innerHTML = ""; 
        const mhsSaved = String(row[10]).split(",").map(s => s.trim()).filter(s => s);
        
        if (mhsSaved.length > 0) {
            document.getElementById("emptyStudentText").classList.add("d-none");
            mhsSaved.forEach(niu => {
                const m = masterMahasiswaList.find(m => String(m.niu) === String(niu));
                if (m) {
                    createStudentRow();
                    const lastInput = document.getElementById("studentContainer").lastElementChild.querySelector('input');
                    lastInput.value = `${m.nim} - ${m.nama}`;
                }
            });
        } else {
            document.getElementById("emptyStudentText").classList.remove("d-none");
        }

        new bootstrap.Modal(document.getElementById('modalFormArtikel')).show();
    };

    // Eksekusi saat script dimuat
    initMonitorArtikel();
})();