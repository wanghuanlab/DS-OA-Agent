const toast = document.querySelector('#downloadToast');
let toastTimer;

for (const link of document.querySelectorAll('[data-download]')) {
  link.addEventListener('click', (event) => {
    if (link.getAttribute('href') !== '#') return;
    event.preventDefault();
    window.clearTimeout(toastTimer);
    toast.hidden = false;
    toast.textContent = `${link.querySelector('strong').textContent} 下载链接即将开放。`;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  });
}

const revealItems = document.querySelectorAll('.reveal');
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
}
