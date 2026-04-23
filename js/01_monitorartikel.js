(function() {
    // ==========================================
    // STATE LOKAL
    // ==========================================
    let masterDosenList = []; 
    let masterArtikelData = []; 
    let authorCount = 0;
    let extAuthorCount = 0;
    let masterMahasiswaList = [];
    let studentCount = 0;
    
    // Variabel penahan (Promise) agar tidak fetch berulang kali
    let dosenPromise = null;
    let mhsPromise = null;

    const optIndeksasiJurnal = ["Q1 - Skor SINTA 40", "Q2 - Skor SINTA 24", "Q3 - Skor SINTA 22", "Q4 - Skor SINTA 20", "Non-Q - Skor SINTA 30", "Sinta 1 - Skor SINTA 25", "Sinta 2 - Skor SINTA 25", "Sinta 3 - Skor SINTA 20", "Sinta 4 - Skor SINTA 20", "Sinta 5 - Skor SINTA 15", "Sinta 6 - Skor SINTA 15", "Non-Sinta - Skor SINTA 10"];
    const optIndeksasiProsiding = ["Internasional - Skor SINTA 30", "Nasional - Skor SINTA 10"];
    const optIndeksasiBuku = ["Buku Ajar - Skor SINTA 20", "Buku Referensi - Skor SINTA 40", "Buku Monograf - Skor SINTA 20"];
    
    const optStatusJurnal = ["Draft", "Draft Ready", "Submitted", "On Review Round 1", "Revision Round 1", "Revision Round 1 Submitted", "On Review Round 2", "Revision Round 2", "Revision Round 2 Submitted", "Accepted", "Copyediting/ Proofread", "Published"];
    const optStatusProsiding = ["Draft", "Draft Ready", "Submitted", "On Review", "Revision", "Revision Submitted", "Accepted", "Presented", "Published"];
    const optPeranAuthor = ["First Author", "Corresponding Author", "Co-Author"];

    const timelineJurnal = [
        { label: "Draft", index: 15, status: "Draft" }, { label: "Ready", index: 16, status: "Draft Ready" }, { label: "Submit", index: 17, status: "Submitted" },
        { label: "Review 1", index: 18, status: "On Review Round 1" }, { label: "Rev 1", index: 19, status: "Revision Round 1" }, { label: "Rev 1 Sub", index: 20, status: "Revision Round 1 Submitted" },
        { label: "Review 2", index: 21, status: "On Review Round 2" }, { label: "Rev 2", index: 22, status: "Revision Round 2" }, { label: "Rev 2 Sub", index: 23, status: "Revision Round 2 Submitted" },
        { label: "Accepted", index: 24, status: "Accepted" }, { label: "Proofread", index: 25, status: "Copyediting/ Proofread" }, { label: "Published", index: 26, status: "Published" }
    ];

    const timelineProsiding = [
        { label: "Draft", index: 27, status: "Draft" }, { label: "Ready", index: 28, status: "Draft Ready" }, { label: "Submit", index: 29, status: "Submitted" },
        { label: "Review", index: 30, status: "On Review" }, { label: "Revision", index: 31, status: "Revision" }, { label: "Rev Sub", index: 32, status: "Revision Submitted" },
        { label: "Accepted", index: 33, status: "Accepted" }, { label: "Presented", index: 34, status: "Presented" }, { label: "Published", index: 35, status: "Published" }
    ];

    function initMonitorArtikel() {
        fetchDosenList();
        fetchMahasiswaList();
        fetchArtikelData();
        setupEventListeners();
    }

    let currentMonitorPage = 1;
    let cardsPerPage = 5;
    let currentFilteredMonitorData = [];

    function setupEventListeners() {
        const btnRefresh = document.getElementById("btnRefreshArtikel");
        if(btnRefresh) btnRefresh.addEventListener("click", fetchArtikelData);

        const filterTahun = document.getElementById("filterTahunArtikel");
        if(filterTahun) filterTahun.addEventListener("change", () => { currentMonitorPage = 1; renderArtikelCards(masterArtikelData); });

        // LISTENER BARU: Search dan Sort
        const searchInput = document.getElementById("searchArtikelData");
        if(searchInput) searchInput.addEventListener("keyup", () => { currentMonitorPage = 1; renderArtikelCards(masterArtikelData); });
        
        const sortSelect = document.getElementById("sortArtikelData");
        if(sortSelect) sortSelect.addEventListener("change", () => { currentMonitorPage = 1; renderArtikelCards(masterArtikelData); });

        const ddlSubmit = document.getElementById("rencanaSubmit");
        if(ddlSubmit) ddlSubmit.addEventListener("change", function() { updateDropdownOptions(this.value); });

        document.getElementById("statusTerkini")?.addEventListener("change", function() {
            const containerUrl = document.getElementById("containerUrlPublish");
            this.value === "Published" ? containerUrl.classList.remove("d-none") : containerUrl.classList.add("d-none");
        });

        document.getElementById("btnAddAuthor")?.addEventListener("click", () => createAuthorRow());
        document.getElementById("btnAddStudent")?.addEventListener("click", () => createStudentRow());
        document.getElementById("btnAddExtAuthor")?.addEventListener("click", () => createExtAuthorRow());
        
        document.getElementById("btnSimpanArtikel")?.addEventListener("click", handleSaveArtikel);

        const limitSelect = document.getElementById("limitPerPage");
        if(limitSelect) {
            limitSelect.addEventListener("change", function() {
                if (this.value === "semua") {
                    cardsPerPage = currentFilteredMonitorData.length || 9999;
                } else {
                    cardsPerPage = parseInt(this.value, 10);
                }
                currentMonitorPage = 1; // Kembali ke halaman 1 tiap ganti limit
                displayMonitorPage(currentMonitorPage);
            });
        }

        document.querySelector('[data-bs-target="#modalFormArtikel"]')?.addEventListener("click", async () => {
            document.getElementById("formArtikel").reset();
            document.getElementById("recordId").value = ""; 
            document.getElementById("authorContainer").innerHTML = ""; 
            document.getElementById("studentContainer").innerHTML = ""; 
            document.getElementById("extAuthorContainer").innerHTML = "";
            document.getElementById("emptyStudentText").classList.remove("d-none");
            document.getElementById("emptyExtAuthorText").classList.remove("d-none");
            document.getElementById("extHeader").classList.add("d-none");
            
            if (masterDosenList.length === 0) {
                document.getElementById("authorContainer").innerHTML = `<div class="text-center text-primary small py-2"><div class="spinner-border spinner-border-sm me-1"></div> Menyiapkan data...</div>`;
                await fetchDosenList();
                document.getElementById("authorContainer").innerHTML = "";
            }

            createAuthorRow(true); 
            updateDropdownOptions(""); 
        });
    }

    // ==========================================
    // FUNGSI PENGAMBILAN DATA (DENGAN PROMISE)
    // ==========================================
    function fetchDosenList() {
        if(typeof GAS_LOGIN === 'undefined') return Promise.resolve();
        if(masterDosenList.length > 0) return Promise.resolve();
        if(dosenPromise) return dosenPromise; // Cegah double fetch

        dosenPromise = fetch(GAS_LOGIN, { method: "POST", body: JSON.stringify({ action: "get_users" }) })
        .then(res => res.json())
        .then(data => {
            if(data.status === "ok") {
                masterDosenList = data.user;
            }
        }).catch(err => console.error("Gagal mengambil list dosen:", err));

        return dosenPromise;
    }

    function fetchMahasiswaList() {
        if(typeof GAS_MAHASISWA === 'undefined') return Promise.resolve();
        if(masterMahasiswaList.length > 0) return Promise.resolve();
        if(mhsPromise) return mhsPromise;

        mhsPromise = fetch(GAS_MAHASISWA)
        .then(res => res.json())
        .then(data => {
            if(data.status === "ok") {
                masterMahasiswaList = data.data;
                const datalist = document.createElement('datalist');
                datalist.id = "mhsDataList";
                datalist.innerHTML = masterMahasiswaList.map(m => `<option value="${m.nim} - ${m.nama}"></option>`).join("");
                document.body.appendChild(datalist);
            }
        }).catch(err => console.error("Gagal mengambil data mahasiswa:", err));

        return mhsPromise;
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

    // ==========================================
    // UI BUILDERS
    // ==========================================
    window.createExtAuthorRow = function() {
        extAuthorCount++;
        const container = document.getElementById("extAuthorContainer");
        document.getElementById("emptyExtAuthorText").classList.add("d-none");
        document.getElementById("extHeader").classList.remove("d-none");
        
        const rowId = `extRow_${extAuthorCount}`;
        const rowHTML = `
            <div class="row g-2 align-items-center ext-author-item" id="${rowId}">
                <div class="col-md-5">
                    <input type="text" class="form-control input-ext-nama" placeholder="Nama Penulis..." required>
                </div>
                <div class="col-md-6">
                    <input type="text" class="form-control input-ext-afiliasi" placeholder="Afiliasi/Institusi..." required>
                </div>
                <div class="col-md-1 text-end">
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeExtRow('${rowId}')"><i class="bi bi-trash"></i></button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHTML);
    };

    window.removeExtRow = function(rowId) {
        document.getElementById(rowId)?.remove();
        if(document.getElementById("extAuthorContainer").children.length === 0) {
            document.getElementById("emptyExtAuthorText").classList.remove("d-none");
            document.getElementById("extHeader").classList.add("d-none");
        }
    };

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

    window.removeAuthorRow = function(rowId) {
        const row = document.getElementById(rowId);
        if(row) row.remove();
    };

    function updateDropdownOptions(tipe) {
        const ddlIndeksasi = document.getElementById("targetIndeksasi");
        const ddlStatus = document.getElementById("statusTerkini");
        ddlIndeksasi.innerHTML = '<option value="" disabled selected>Pilih Target...</option>';
        ddlStatus.innerHTML = '<option value="" disabled selected>Pilih Status...</option>';
        if(!tipe) { ddlIndeksasi.disabled = true; ddlStatus.disabled = true; return; }

        ddlIndeksasi.disabled = false; ddlStatus.disabled = false;
        
        let targetIndeksasiList = tipe === "Jurnal" ? optIndeksasiJurnal : (tipe === "Buku" ? optIndeksasiBuku : optIndeksasiProsiding);
        let targetStatusList = tipe === "Jurnal" ? optStatusJurnal : optStatusProsiding;

        targetIndeksasiList.forEach(opt => { ddlIndeksasi.innerHTML += `<option value="${opt}">${opt}</option>`; });
        targetStatusList.forEach(opt => { ddlStatus.innerHTML += `<option value="${opt}">${opt}</option>`; });
        document.getElementById("containerUrlPublish").classList.add("d-none");
        document.getElementById("urlPublish").removeAttribute("required");
    }

    // ==========================================
    // AKSI DATABASE
    // ==========================================
    function handleSaveArtikel() {
        const form = document.getElementById("formArtikel");
        if (!form.checkValidity()) { form.reportValidity(); return; }

        let listPenulis = [];
        document.querySelectorAll('.author-item').forEach(item => {
            const kode = item.querySelector('.select-nama-author').value;
            const peran = item.querySelector('.select-peran-author').value;
            if(kode && peran) listPenulis.push(peran === "Corresponding Author" ? `${kode}*` : kode);
        });

        let listMahasiswaNiu = [];
        document.querySelectorAll('.input-mahasiswa').forEach(input => {
            const mhs = masterMahasiswaList.find(m => `${m.nim} - ${m.nama}` === input.value);
            if (mhs && mhs.niu) listMahasiswaNiu.push(mhs.niu);
        });

        let listNamaExt = [];
        let listAfilExt = [];
        document.querySelectorAll('.ext-author-item').forEach(item => {
            const n = item.querySelector('.input-ext-nama').value.trim();
            const a = item.querySelector('.input-ext-afiliasi').value.trim();
            if(n && a) { listNamaExt.push(n); listAfilExt.push(a); }
        });

        const currentUser = JSON.parse(sessionStorage.getItem("user"));
        const ddlTarget = document.getElementById("targetIndeksasi");
        const targetFullText = ddlTarget.options[ddlTarget.selectedIndex].text;
        const targetShortValue = targetFullText.split(" - ")[0];
        const skorSintaNum = targetFullText.includes(" - Skor SINTA ") ? parseInt(targetFullText.split(" - Skor SINTA ")[1]) : 0;

        const payloadData = {
            action: "save_artikel",
            recordId: document.getElementById("recordId").value,
            emailSubmitter: currentUser.email,
            judul: document.getElementById("judulArtikel").value,
            tahunTarget: document.getElementById("tahunTarget").value,
            rencanaSubmit: document.getElementById("rencanaSubmit").value,
            targetIndeksasi: targetShortValue,
            skorSinta: skorSintaNum,
            sumber: "SIRISMA",
            namaJurnal: document.getElementById("namaJurnal").value,
            daftarPenulis: listPenulis.join(", "),
            keterlibatanMahasiswa: listMahasiswaNiu.join(", "),
            penulisLuar: listNamaExt.join("|"),
            afiliasiLuar: listAfilExt.join("|"),
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
        }).catch(err => { Swal.fire('Error!', 'Terjadi kesalahan komunikasi server.', 'error'); });
    }

    window.deleteArtikel = function(recordId) {
        Swal.fire({
            title: 'Hapus Artikel?', text: "Data akan dihapus permanen!", icon: 'warning',
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

    // PERBAIKAN: Gunakan ASYNC agar aman saat Edit data jika list Dosen belum ada
    window.editArtikel = async function(recordId) {
        const row = masterArtikelData.find(r => r[1] === recordId);
        if (!row) return;

        // Anti Race-Condition
        if (masterDosenList.length === 0) await fetchDosenList();
        if (masterMahasiswaList.length === 0) await fetchMahasiswaList();

        document.getElementById("recordId").value = row[1];
        document.getElementById("judulArtikel").value = row[4];
        document.getElementById("tahunTarget").value = row[5];
        document.getElementById("rencanaSubmit").value = row[6];
        
        updateDropdownOptions(row[6]);
        
        setTimeout(() => {
            const valFromSheet = String(row[7]).trim(); 
            const ddl = document.getElementById("targetIndeksasi");
            for (let i = 0; i < ddl.options.length; i++) {
                if (ddl.options[i].value.split(" - ")[0].trim() === valFromSheet) {
                    ddl.selectedIndex = i; break;
                }
            }

            document.getElementById("statusTerkini").value = row[13];
            if (row[13] === "Published") {
                document.getElementById("containerUrlPublish").classList.remove("d-none");
                document.getElementById("urlPublish").value = row[14]; 
            }
        }, 150);

        document.getElementById("namaJurnal").value = row[8];
        document.getElementById("catatanKendala").value = row[36]; 

        document.getElementById("authorContainer").innerHTML = ""; 
        const authors = String(row[9]).split(", ");
        authors.forEach(authorText => {
            createAuthorRow(); 
            const lastRow = document.getElementById("authorContainer").lastElementChild;
            let isCorr = authorText.includes("*");
            let kode = authorText.replace("*", "");
            lastRow.querySelector('.select-nama-author').value = kode;
            lastRow.querySelector('.select-peran-author').value = isCorr ? "Corresponding Author" : "Co-Author"; 
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

        document.getElementById("extAuthorContainer").innerHTML = "";
        const extNames = String(row[11]).split("|").map(s => s.trim()).filter(s => s);
        const extAfils = String(row[12]).split("|").map(s => s.trim()).filter(s => s);
        
        if (extNames.length > 0) {
            document.getElementById("emptyExtAuthorText").classList.add("d-none");
            document.getElementById("extHeader").classList.remove("d-none");
            for(let i=0; i<extNames.length; i++) {
                createExtAuthorRow();
                const lastRow = document.getElementById("extAuthorContainer").lastElementChild;
                lastRow.querySelector('.input-ext-nama').value = extNames[i];
                lastRow.querySelector('.input-ext-afiliasi').value = extAfils[i] || "";
            }
        } else {
            document.getElementById("emptyExtAuthorText").classList.remove("d-none");
            document.getElementById("extHeader").classList.add("d-none");
        }

        new bootstrap.Modal(document.getElementById('modalFormArtikel')).show();
    };

    // ==========================================
    // RENDER CARDS
    // ==========================================
    function renderArtikelCards(data) {
        const container = document.getElementById("listArtikelData");
        const filterTahunEl = document.getElementById("filterTahunArtikel");
        const searchInputEl = document.getElementById("searchArtikelData");
        const sortSelectEl = document.getElementById("sortArtikelData");
        
        if (!container || !filterTahunEl) return; 
        
        const filterTahun = filterTahunEl.value;
        const valSearch = searchInputEl ? searchInputEl.value.toLowerCase().trim() : "";
        const valSort = sortSelectEl ? sortSelectEl.value : "terbaru";
        
        const activeUser = JSON.parse(sessionStorage.getItem("user"));

        // 1. FILTERING
        currentFilteredMonitorData = data.filter(row => {
            if (row[13] === "Published") return false;
            if (filterTahun !== "Semua" && String(row[5]) !== filterTahun) return false;
            
            // Search Judul & Jurnal Target
            if (valSearch !== "") {
                const judul = String(row[4]).toLowerCase();
                const jurnal = String(row[8]).toLowerCase();
                if (!judul.includes(valSearch) && !jurnal.includes(valSearch)) return false;
            }

            const isAdminExec = ["Admin", "Kadep", "Sekdep"].includes(activeUser.role);
            const isPIC = row[3] === activeUser.email; 
            const isAuthor = String(row[9]).includes(activeUser.kode); 
            return isAdminExec || isPIC || isAuthor; 
        });

        // 2. SORTING
        currentFilteredMonitorData.sort((a, b) => {
            if (valSort === "terbaru") {
                // Default: reverse ID / No Urut
                return b[0] - a[0]; 
            } 
            else if (valSort === "tipe") {
                // Jurnal -> Prosiding -> Buku
                const tipeOrder = { "Jurnal": 1, "Prosiding": 2, "Buku": 3 };
                return (tipeOrder[a[6]] || 99) - (tipeOrder[b[6]] || 99);
            } 
            else if (valSort === "indeks") {
                // Q1-Q4 -> Non-Q -> Sinta1-Sinta6 -> Internasional -> Nasional
                const indexOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'Non-Q', 'Sinta 1', 'Sinta 2', 'Sinta 3', 'Sinta 4', 'Sinta 5', 'Sinta 6', 'Internasional', 'Nasional', 'Buku Referensi', 'Buku Ajar', 'Buku Monograf'];
                let idxA = indexOrder.indexOf(String(a[7]).split(" - ")[0]);
                let idxB = indexOrder.indexOf(String(b[7]).split(" - ")[0]);
                if(idxA === -1) idxA = 99; if(idxB === -1) idxB = 99;
                return idxA - idxB;
            } 
            else if (valSort === "status") {
                // Draft ke Published
                const statusOrder = ["Draft", "Draft Ready", "Submitted", "On Review", "On Review Round 1", "Revision", "Revision Round 1", "Revision Round 1 Submitted", "On Review Round 2", "Revision Round 2", "Revision Round 2 Submitted", "Accepted", "Presented"];
                let sA = statusOrder.indexOf(a[13]); let sB = statusOrder.indexOf(b[13]);
                if(sA === -1) sA = 99; if(sB === -1) sB = 99;
                return sA - sB;
            }
            return 0;
        });

        // 3. RENDER (Panggil fungsi Pagination)
        displayMonitorPage(currentMonitorPage);
    }

    // FUNGSI DISPLAY PER HALAMAN
    function displayMonitorPage(page) {
        const container = document.getElementById("listArtikelData");
        const emptyState = document.getElementById("emptyArtikelState");
        const paginationContainer = document.getElementById("paginationContainerArtikel");
        
        container.innerHTML = "";

        if (currentFilteredMonitorData.length === 0) {
            emptyState.classList.remove("d-none");
            paginationContainer.classList.add("d-none");
            return;
        }

        emptyState.classList.add("d-none");
        paginationContainer.classList.remove("d-none");

        const startIndex = (page - 1) * cardsPerPage;
        const endIndex = startIndex + cardsPerPage;
        const pageData = currentFilteredMonitorData.slice(startIndex, endIndex);

        const activeUser = JSON.parse(sessionStorage.getItem("user"));

        pageData.forEach(row => {
            const type = row[6];
            const steps = type === "Jurnal" ? timelineJurnal : timelineProsiding;
            const currentStatus = row[13]; 
            const tglInput = row[2] ? String(row[2]).split(" ")[0] : "-";
            
            let tglUpdate = tglInput;
            steps.forEach(s => { if(row[s.index]) tglUpdate = String(row[s.index]).split(" ")[0]; });

            let typeColor = type === "Prosiding" ? "bg-success" : (type === "Buku" ? "bg-danger" : "bg-primary");
            let displayIndeks = row[7] || "Unknown";
            
            let skorSinta = row[37]; 
            if (!skorSinta || skorSinta === "" || skorSinta === "-") {
                const scoreMap = { "Q1": 40, "Q2": 24, "Q3": 22, "Q4": 20, "Non-Q": 30, "Sinta 1": 25, "Sinta 2": 25, "Sinta 3": 20, "Sinta 4": 20, "Sinta 5": 15, "Sinta 6": 15, "Non-Sinta": 10, "Internasional": 30, "Nasional": 10, "Buku Ajar": 20, "Buku Referensi": 40, "Buku Monograf": 20 };
                skorSinta = scoreMap[displayIndeks] || "-";
            }

            const indexColor = displayIndeks.includes("Q") ? "bg-warning text-dark" : "bg-info text-dark";
            const canEditDelete = (row[3] === activeUser.email || activeUser.role === "Admin");

            let extAuthorHtml = "";
            const extNames = String(row[11]).split("|").filter(s => s);
            if(extNames.length > 0) {
                extAuthorHtml = `<div class="col-12 mt-1"><strong>Penulis Luar:</strong> <span class="text-secondary small">${extNames.join(", ")}</span></div>`;
            }

            let cardHtml = `
                <div class="col-12 mb-3">
                    <div class="card shadow-sm border-0 overflow-hidden position-relative">
                        <div class="row g-0">
                            <div class="col-md-5 p-4 border-end bg-white position-relative">
                                ${canEditDelete ? `<div class="position-absolute top-0 end-0 p-2 z-3"><button class="btn btn-sm btn-light text-primary shadow-sm me-1" onclick="editArtikel('${row[1]}')" title="Edit"><i class="bi bi-pencil-square"></i></button><button class="btn btn-sm btn-light text-danger shadow-sm" onclick="deleteArtikel('${row[1]}')" title="Hapus"><i class="bi bi-trash"></i></button></div>` : ''}
                                
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
                                    <div class="col-12"><strong>Penulis Internal:</strong> <code class="text-danger">${row[9]}</code></div>
                                    ${extAuthorHtml}
                                    ${row[14] ? `<div class="col-12 text-truncate mt-1"><strong>URL:</strong> <a href="${row[14]}" target="_blank" class="text-decoration-none">${row[14]}</a></div>` : ''}
                                    
                                    <div class="col-12 mt-2 pt-2 border-top">
                                        <div class="fw-bold text-primary mb-1"><i class="bi bi-chat-left-dots me-1"></i>Catatan:</div>
                                        <div class="text-muted" style="font-size: 0.8rem; font-style: italic; line-height: 1.4;">${row[36] || "Belum ada catatan."}</div>
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

        renderMonitorPaginationControls();
    }

    function renderMonitorPaginationControls() {
        const totalData = currentFilteredMonitorData.length;
        const totalPages = Math.ceil(totalData / cardsPerPage);
        const paginationEl = document.getElementById("paginationControlsArtikel");
        const infoEl = document.getElementById("paginationInfoArtikel");

        if (totalData === 0) {
            infoEl.innerHTML = "Tidak ada data";
            paginationEl.innerHTML = "";
            return;
        }

        const startCount = ((currentMonitorPage - 1) * cardsPerPage) + 1;
        const endCount = Math.min(currentMonitorPage * cardsPerPage, totalData);
        
        // Cek jika mode "Semua"
        if (cardsPerPage >= totalData) {
            infoEl.innerHTML = `Menampilkan <span class="fw-bold text-primary">Semua</span> dari <span class="fw-bold">${totalData}</span> Artikel`;
        } else {
            infoEl.innerHTML = `Menampilkan <span class="fw-bold text-primary">${startCount}-${endCount}</span> dari <span class="fw-bold">${totalData}</span> Artikel`;
        }

        paginationEl.innerHTML = "";
        
        // Sembunyikan navigasi angka jika hanya 1 halaman
        if (totalPages <= 1) return;

        const isPrevDisabled = currentMonitorPage === 1 ? "disabled" : "";
        let html = `<li class="page-item ${isPrevDisabled}"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changeMonitorPage(${currentMonitorPage - 1})"><i class="bi bi-chevron-left"></i></a></li>`;

        let startPage = Math.max(1, currentMonitorPage - 2);
        let endPage = Math.min(totalPages, currentMonitorPage + 2);

        if (startPage > 1) {
            html += `<li class="page-item"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changeMonitorPage(1)">1</a></li>`;
            if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentMonitorPage ? "active" : "";
            html += `<li class="page-item ${activeClass}"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changeMonitorPage(${i})">${i}</a></li>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
            html += `<li class="page-item"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changeMonitorPage(${totalPages})">${totalPages}</a></li>`;
        }

        const isNextDisabled = currentMonitorPage === totalPages ? "disabled" : "";
        html += `<li class="page-item ${isNextDisabled}"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changeMonitorPage(${currentMonitorPage + 1})"><i class="bi bi-chevron-right"></i></a></li>`;

        paginationEl.innerHTML = html;
    }

    window.changeMonitorPage = function(pageNumber) {
        const totalPages = Math.ceil(currentFilteredMonitorData.length / cardsPerPage);
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            currentMonitorPage = pageNumber;
            displayMonitorPage(currentMonitorPage);
            // Auto scroll sedikit ke atas agar user nyaman melihat daftar baru
            document.getElementById("containerListArtikel").scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    initMonitorArtikel();
})();