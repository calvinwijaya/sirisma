(function() {
    // ==========================================
    // INISIALISASI
    // ==========================================
    function initSintaSimulator() {
        const iframe = document.getElementById('sintaIframe');
        const loader = document.getElementById('iframeLoader');

        if (iframe && loader) {
            // Ketika iframe selesai memuat konten dari ugm.id
            iframe.onload = function() {
                // Sembunyikan spinner
                loader.classList.add('d-none');
                // Tampilkan iframe dengan efek fade-in (karena ada transition di CSS inline-nya)
                iframe.style.opacity = '1';
            };

            // [PENTING] Fallback Keamanan:
            // Kadang-kadang URL shortener (seperti ugm.id) melakukan redirect ke domain lain
            // yang memiliki aturan Cross-Origin yang memblokir event 'onload'.
            // Timeout 4 detik ini memastikan iframe tetap akan dimunculkan meskipun onload terblokir.
            setTimeout(() => {
                if (!loader.classList.contains('d-none')) {
                    loader.classList.add('d-none');
                    iframe.style.opacity = '1';
                }
            }, 4000); 
        }
    }

    // Eksekusi fungsi saat script diload oleh router SPA
    initSintaSimulator();
})();