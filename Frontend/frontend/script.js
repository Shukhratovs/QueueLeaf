document.addEventListener('DOMContentLoaded', () => {
    
    // Theme Toggle logic
    const toggleBtn = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        html.setAttribute('data-theme', 'dark');
    }

    toggleBtn.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Form logic
    const form = document.getElementById('access-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = form.querySelector('button');
        const originalContent = btn.innerHTML;
        
        btn.innerText = 'Processing...';
        btn.style.opacity = '0.8';
        btn.disabled = true;
        
        setTimeout(() => {
            btn.innerText = 'You are on the list!';
            btn.style.background = 'var(--leaf)';
            btn.style.borderColor = 'var(--leaf)';
            btn.style.color = '#fff';
            form.reset();
            
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.style.background = '';
                btn.style.borderColor = '';
                btn.style.color = '';
                btn.style.opacity = '1';
                btn.disabled = false;
            }, 4000);
        }, 1500);
    });
});