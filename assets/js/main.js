(() => {
    const btn = document.getElementById('copy-email');
    if (!btn || !navigator.clipboard) return;

    const email = btn.dataset.email;
    const tooltip = btn.querySelector('.copy-tooltip');
    let timer;

    btn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(email);
            tooltip.classList.add('show');
            clearTimeout(timer);
            timer = setTimeout(() => tooltip.classList.remove('show'), 2000);
        } catch {
            /* clipboard blocked — fail silently, the mailto link still works */
        }
    });
})();
