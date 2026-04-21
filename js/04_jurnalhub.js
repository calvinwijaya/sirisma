(function() {
    let rawJurnal = [];
    let rawProsiding = [];
    const user = JSON.parse(sessionStorage.getItem("user"));

    function init() {
        const btnAdmin = document.getElementById('adminActionJurnal');
        if(user && user.role === 'Admin' && btnAdmin) {
            btnAdmin.classList.remove('d-none');
        }
        setupListeners();
        fetchData();
    }

    function setupListeners() {
        ['searchJurnal', 'filterTipeHub', 'filterScopeHub', 'filterPayHub'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('input', renderUI);
        });
        
        const btnRefresh = document.getElementById('btnRefreshHub');
        if(btnRefresh) btnRefresh.addEventListener('click', fetchData);

        const jenisData = document.getElementById('hubJenisData');
        if(jenisData) {
            jenisData.addEventListener('change', function() {
                if(this.value === 'Jurnal') {
                    document.getElementById('fieldsJurnal').classList.remove('d-none');
                    document.getElementById('fieldsProsiding').classList.add('d-none');
                } else {
                    document.getElementById('fieldsJurnal').classList.add('d-none');
                    document.getElementById('fieldsProsiding').classList.remove('d-none');
                }
            });
        }

        const jTipeEl = document.getElementById('j_tipe');
        if(jTipeEl) {
            jTipeEl.addEventListener('change', function() {
                const indeksEl = document.getElementById('j_indeks');
                indeksEl.disabled = false;
                indeksEl.innerHTML = '<option value="" disabled selected>Pilih Indeksasi...</option>';
                
                if (this.value === 'Internasional') {
                    ['Q1', 'Q2', 'Q3', 'Q4', 'Non-Q'].forEach(opt => indeksEl.innerHTML += `<option value="${opt}">${opt}</option>`);
                } else if (this.value === 'Nasional') {
                    ['Sinta 1', 'Sinta 2', 'Sinta 3', 'Sinta 4', 'Sinta 5', 'Sinta 6', 'Non-Sinta'].forEach(opt => indeksEl.innerHTML += `<option value="${opt}">${opt}</option>`);
                }
            });
        }

        // FITUR BARU: Auto-format Ribuan (Ribuan dipisah titik)
        document.querySelectorAll('.currency-input').forEach(input => {
            input.addEventListener('input', function(e) {
                let val = this.value.replace(/[^0-9]/g, ''); // Buang semua karakter selain angka
                if(val) {
                    this.value = parseInt(val, 10).toLocaleString('id-ID'); // Format ke gaya Indonesia (titik)
                } else {
                    this.value = '';
                }
            });
        });
    }

    async function fetchData() {
        if(typeof Loading !== 'undefined') Loading.show();
        try {
            const res = await fetch(GAS_JURNALHUB + "?t=" + new Date().getTime());
            const data = await res.json();
            if (data.status === "ok") {
                rawJurnal = data.jurnal.map((row, index) => ({ data: row, rowIdx: index + 1 }));
                rawProsiding = data.prosiding.map((row, index) => ({ data: row, rowIdx: index + 1 }));
                renderUI();
            }
        } catch (e) { 
            console.error("Gagal memuat data Jurnal Hub:", e); 
        } finally {
            if(typeof Loading !== 'undefined') Loading.hide();
        }
    }

    function renderUI() {
        renderProsiding();
        renderJurnal();
    }

    function renderProsiding() {
        const container = document.getElementById('prosidingBannerContainer');
        const queryEl = document.getElementById('searchJurnal');
        if(!container || !queryEl) return; 

        const query = queryEl.value.toLowerCase();
        const scope = document.getElementById('filterScopeHub').value;
        const tipe = document.getElementById('filterTipeHub').value;
        const sectionProsiding = document.querySelector('.section-prosiding');

        if(tipe === 'Jurnal') {
            container.innerHTML = '';
            if(sectionProsiding) sectionProsiding.style.display = 'none';
            return;
        }

        if(sectionProsiding) sectionProsiding.style.display = 'block';
        
        let filtered = rawProsiding.filter(p => {
            const matchSearch = String(p.data[2]).toLowerCase().includes(query);
            const matchScope = scope === 'Semua' || p.data[0] === scope;
            return matchSearch && matchScope;
        });

        filtered.sort((a, b) => new Date(a.data[1]) - new Date(b.data[1]));

        container.innerHTML = filtered.map(p => {
            const deadline = new Date(p.data[1]);
            const diffTime = deadline - new Date();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let colorClass = "bg-success";
            let statusText = `H-${diffDays}`;
            
            if(diffDays <= 7 && diffDays >= 0) colorClass = "bg-danger";
            else if(diffDays <= 14 && diffDays > 7) colorClass = "bg-warning text-dark";
            else if(diffDays < 0) { colorClass = "bg-secondary"; statusText = "Closed"; }

            const tglBatas = isNaN(deadline) ? "-" : deadline.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            // PERBAIKAN: Tombol Aksi Admin dipindah agar tidak tumpang tindih
            let adminBtns = '';
            if(user.role === 'Admin') {
                adminBtns = `
                    <div class="ms-3 d-inline-block">
                        <button class="btn btn-sm btn-light text-primary shadow-sm py-0 px-1 me-1" onclick="editDataHub('Prosiding', ${p.rowIdx})" title="Edit"><i class="bi bi-pencil-square"></i></button>
                        <button class="btn btn-sm btn-light text-danger shadow-sm py-0 px-1" onclick="deleteDataHub('Prosiding', ${p.rowIdx})" title="Hapus"><i class="bi bi-trash"></i></button>
                    </div>
                `;
            }

            // PERBAIKAN: col-md-6 col-lg-6 agar banner lebih lebar/highlight
            return `
                <div class="col-md-6 col-lg-6">
                    <div class="card h-100 border-0 shadow-sm overflow-hidden position-relative">
                        <div class="${colorClass} px-3 py-2 text-white small d-flex justify-content-between align-items-center">
                            <span class="fw-semibold"><i class="bi bi-globe me-1"></i>${p.data[0]}</span>
                            <div class="d-flex align-items-center">
                                <span class="fw-bold px-2 py-1 bg-white bg-opacity-25 rounded">${statusText}</span>
                                ${adminBtns}
                            </div>
                        </div>
                        <div class="card-body position-relative">
                            <h5 class="fw-bold mb-1">${p.data[2]}</h5>
                            <p class="small text-muted mb-2"><i class="bi bi-geo-alt-fill text-danger me-1"></i>${p.data[3]} <span class="mx-1">•</span> <i class="bi bi-building text-primary me-1"></i>${p.data[4]}</p>
                            <p class="small fw-semibold text-dark mb-3"><i class="bi bi-calendar-event me-1"></i>Batas Akhir: ${tglBatas}</p>
                            
                            <div class="d-flex justify-content-between align-items-center mt-auto">
                                <span class="badge bg-light text-dark border"><i class="bi bi-tags me-1"></i>Fee: ${p.data[5]}</span>
                                <a href="${p.data[6]}" target="_blank" class="btn btn-sm btn-outline-primary px-3 shadow-sm">Link <i class="bi bi-box-arrow-up-right ms-1"></i></a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if(filtered.length === 0) container.innerHTML = `<div class="col-12 text-center text-muted py-4">Tidak ada data konferensi yang sesuai.</div>`;
    }

    function renderJurnal() {
        const tbody = document.getElementById('jurnalTableBody');
        const queryEl = document.getElementById('searchJurnal');
        if(!tbody || !queryEl) return; 

        const query = queryEl.value.toLowerCase();
        const scope = document.getElementById('filterScopeHub').value;
        const pay = document.getElementById('filterPayHub').value;
        const tipe = document.getElementById('filterTipeHub').value;
        const sectionJurnal = document.querySelector('.section-jurnal');

        if(tipe === 'Prosiding') {
            tbody.innerHTML = '';
            if(sectionJurnal) sectionJurnal.style.display = 'none';
            return;
        }
        
        if(sectionJurnal) sectionJurnal.style.display = 'block';

        let filtered = rawJurnal.filter(j => {
            const matchSearch = String(j.data[4]).toLowerCase().includes(query) || String(j.data[6]).toLowerCase().includes(query);
            const matchScope = scope === 'Semua' || j.data[0] === scope;
            const matchPay = pay === 'Semua' || j.data[8] === pay;
            return matchSearch && matchScope && matchPay;
        });

        tbody.innerHTML = filtered.map((j, i) => {
            const indexColor = String(j.data[1]).includes("Q") ? "bg-warning text-dark" : "bg-info text-dark";
            
            let adminBtns = '';
            if(user.role === 'Admin') {
                adminBtns = `
                    <button class="btn btn-sm btn-outline-primary py-0 px-1 me-1" onclick="editDataHub('Jurnal', ${j.rowIdx})" title="Edit"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="deleteDataHub('Jurnal', ${j.rowIdx})" title="Hapus"><i class="bi bi-trash"></i></button>
                `;
            }

            return `
                <tr class="border-bottom">
                    <td class="text-center text-muted fw-bold">${i+1}</td>
                    <td class="text-center"><span class="badge ${indexColor}">${j.data[1]}</span></td>
                    <td>
                        <div class="fw-bold text-dark mb-1">${j.data[4]}</div>
                        <div class="text-muted small"><i class="bi bi-building me-1"></i>${j.data[6]} <span class="mx-1">•</span> ${j.data[5]}</div>
                    </td>
                    <td>
                        <div class="small fw-semibold text-secondary">SJR: <span class="text-dark">${j.data[2]}</span></div>
                        <div class="small fw-semibold text-secondary">IF: <span class="text-dark">${j.data[3]}</span> <span class="mx-1">|</span> H: <span class="text-dark">${j.data[7]}</span></div>
                    </td>
                    <td>
                        <span class="badge bg-light text-primary border mb-1">${j.data[8]}</span>
                        <div class="text-muted fw-semibold" style="font-size:0.75rem">${j.data[9]}</div>
                    </td>
                    <td class="text-center text-nowrap">
                        <a href="${j.data[10]}" target="_blank" class="btn btn-sm btn-outline-secondary shadow-sm me-1" title="Buka Jurnal"><i class="bi bi-box-arrow-up-right"></i></a>
                        ${adminBtns}
                    </td>
                </tr>
            `;
        }).join('');

        if(filtered.length === 0) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data jurnal yang sesuai.</td></tr>`;
    }

    // Helper Fungsi untuk Parser Mata Uang saat Edit
    function parseCurrencyString(val) {
        if(!val) return { curr: 'Rp', amount: '' };
        let str = String(val).trim();
        let curr = 'Rp';
        if(str.startsWith('Rp')) { curr = 'Rp'; str = str.replace('Rp', '').trim(); }
        else if(str.startsWith('$')) { curr = '$'; str = str.replace('$', '').trim(); }
        else if(str.startsWith('€')) { curr = '€'; str = str.replace('€', '').trim(); }
        else if(str.startsWith('£')) { curr = '£'; str = str.replace('£', '').trim(); }
        return { curr, amount: str }; 
    }

    // ==========================================
    // FUNGSI GLOBAL UNTUK HTML (ADMIN)
    // ==========================================
    
    window.openModalJurnal = function() {
        document.getElementById('formJurnalHub').reset();
        document.getElementById('hubRowIdx').value = "";
        document.getElementById('hubJenisData').disabled = false;
        
        document.getElementById('hubJenisData').value = "Jurnal";
        document.getElementById('hubJenisData').dispatchEvent(new Event('change'));
        
        new bootstrap.Modal(document.getElementById('modalJurnalHub')).show();
    };

    window.editDataHub = function(tipe, rowIdx) {
        document.getElementById('formJurnalHub').reset();
        document.getElementById('hubRowIdx').value = rowIdx;
        const ddlJenis = document.getElementById('hubJenisData');
        ddlJenis.value = tipe;
        ddlJenis.disabled = true;
        ddlJenis.dispatchEvent(new Event('change'));

        if(tipe === 'Jurnal') {
            const item = rawJurnal.find(r => r.rowIdx === rowIdx);
            if(item) {
                const jTipeEl = document.getElementById('j_tipe');
                jTipeEl.value = item.data[0];
                jTipeEl.dispatchEvent(new Event('change')); 
                
                setTimeout(() => { document.getElementById('j_indeks').value = item.data[1]; }, 50);

                document.getElementById('j_sjr').value = item.data[2];
                document.getElementById('j_if').value = item.data[3];
                document.getElementById('j_hindex').value = item.data[7];
                document.getElementById('j_nama').value = item.data[4];
                document.getElementById('j_negara').value = item.data[5]; 
                document.getElementById('j_publisher').value = item.data[6];
                document.getElementById('j_paytype').value = item.data[8];
                
                // Parsing Mata Uang APC
                const apcParsed = parseCurrencyString(item.data[9]);
                document.getElementById('j_currency').value = apcParsed.curr;
                document.getElementById('j_apc').value = apcParsed.amount;
                
                document.getElementById('j_url').value = item.data[10];
            }
        } else {
            const item = rawProsiding.find(r => r.rowIdx === rowIdx);
            if(item) {
                document.getElementById('p_tipe').value = item.data[0];
                const dateObj = new Date(item.data[1]);
                if(!isNaN(dateObj)) document.getElementById('p_batas').value = dateObj.toISOString().split('T')[0];
                document.getElementById('p_nama').value = item.data[2];
                document.getElementById('p_negara').value = item.data[3];
                document.getElementById('p_publisher').value = item.data[4];
                
                // Parsing Mata Uang Fee
                const feeParsed = parseCurrencyString(item.data[5]);
                document.getElementById('p_currency').value = feeParsed.curr;
                document.getElementById('p_fee').value = feeParsed.amount;

                document.getElementById('p_url').value = item.data[6];
            }
        }
        new bootstrap.Modal(document.getElementById('modalJurnalHub')).show();
    };

    window.saveDataHub = function() {
        const tipe = document.getElementById('hubJenisData').value;
        const rowIdx = document.getElementById('hubRowIdx').value;
        let values = [];

        if(tipe === 'Jurnal') {
            if(!document.getElementById('j_nama').value || !document.getElementById('j_url').value) {
                return Swal.fire('Error', 'Nama Jurnal dan URL wajib diisi.', 'error');
            }
            
            // Menggabungkan Simbol Mata Uang dengan Nominal Format
            let apcVal = document.getElementById('j_apc').value.trim();
            if(apcVal) apcVal = document.getElementById('j_currency').value + apcVal;

            values = [
                document.getElementById('j_tipe').value, document.getElementById('j_indeks').value,
                document.getElementById('j_sjr').value, document.getElementById('j_if').value,
                document.getElementById('j_nama').value, document.getElementById('j_negara').value,
                document.getElementById('j_publisher').value, document.getElementById('j_hindex').value,
                document.getElementById('j_paytype').value, apcVal, document.getElementById('j_url').value
            ];
        } else {
            if(!document.getElementById('p_nama').value || !document.getElementById('p_batas').value || !document.getElementById('p_url').value) {
                return Swal.fire('Error', 'Nama, Tanggal Batas, dan URL wajib diisi.', 'error');
            }

            // Menggabungkan Simbol Mata Uang dengan Nominal Format
            let feeVal = document.getElementById('p_fee').value.trim();
            if(feeVal) feeVal = document.getElementById('p_currency').value + feeVal;

            values = [
                document.getElementById('p_tipe').value, document.getElementById('p_batas').value,
                document.getElementById('p_nama').value, document.getElementById('p_negara').value,
                document.getElementById('p_publisher').value, feeVal, document.getElementById('p_url').value
            ];
        }

        Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        fetch(GAS_JURNALHUB, {
            method: "POST",
            body: JSON.stringify({ action: "save", type: tipe, rowIdx: rowIdx || null, values: values })
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === "ok") {
                // Sembunyikan modal dulu
                bootstrap.Modal.getInstance(document.getElementById('modalJurnalHub')).hide();
                // Tampilkan sukses, TUNGGU user klik OK, baru fetch ulang data
                Swal.fire('Sukses', data.message, 'success').then(() => {
                    fetchData();
                });
            } else Swal.fire('Gagal', data.message, 'error');
        }).catch(err => Swal.fire('Error', 'Kesalahan server', 'error'));
    };

    window.deleteDataHub = function(tipe, rowIdx) {
        Swal.fire({
            title: 'Hapus Data?', text: "Data ini akan dihapus secara permanen.", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Ya, Hapus'
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                fetch(GAS_JURNALHUB, {
                    method: "POST",
                    body: JSON.stringify({ action: "delete", type: tipe, rowIdx: rowIdx })
                })
                .then(res => res.json())
                .then(data => {
                    if(data.status === "ok") {
                        // Tampilkan sukses, TUNGGU user klik OK, baru fetch ulang data
                        Swal.fire('Terhapus', data.message, 'success').then(() => {
                            fetchData();
                        });
                    } else Swal.fire('Gagal', data.message, 'error');
                }).catch(err => Swal.fire('Error', 'Kesalahan server', 'error'));
            }
        });
    };

    init();
})();