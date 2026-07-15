const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const revealItems = document.querySelectorAll('.reveal');

if (reduceMotion.matches || !('IntersectionObserver' in window)) {
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

const canvas = document.querySelector('#particleCanvas');
const hero = document.querySelector('.hero');

if (canvas && hero) {
  const context = canvas.getContext('2d');
  const pointer = { x: -1000, y: -1000, active: false };
  let particles = [];
  let width = 0;
  let height = 0;
  let animationFrame = 0;

  function createParticles() {
    const count = width < 640 ? 30 : Math.min(78, Math.round(width / 22));
    particles = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      radius: index % 9 === 0 ? 2.2 : 1.2 + Math.random() * 0.6,
      tone: index % 7 === 0 ? 'green' : 'blue'
    }));
  }

  function resizeCanvas() {
    const bounds = hero.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(1, Math.round(bounds.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const dimensionsChanged = nextWidth !== width || nextHeight !== height;
    width = nextWidth;
    height = nextHeight;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (dimensionsChanged) createParticles();
    if (reduceMotion.matches) drawParticles(false);
  }

  function drawParticles(update = true) {
    context.clearRect(0, 0, width, height);

    for (let first = 0; first < particles.length; first += 1) {
      const particle = particles[first];
      if (update) {
        if (pointer.active) {
          const dx = pointer.x - particle.x;
          const dy = pointer.y - particle.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 150 && distance > 0) {
            particle.vx += (dx / distance) * 0.0025;
            particle.vy += (dy / distance) * 0.0025;
          }
        }
        particle.vx *= 0.997;
        particle.vy *= 0.997;
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -8) particle.x = width + 8;
        if (particle.x > width + 8) particle.x = -8;
        if (particle.y < -8) particle.y = height + 8;
        if (particle.y > height + 8) particle.y = -8;
      }

      for (let second = first + 1; second < particles.length; second += 1) {
        const other = particles[second];
        const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
        if (distance > 125) continue;
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(other.x, other.y);
        context.strokeStyle = `rgba(104, 164, 247, ${(1 - distance / 125) * 0.22})`;
        context.lineWidth = 0.7;
        context.stroke();
      }

      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = particle.tone === 'green' ? 'rgba(83, 211, 157, .76)' : 'rgba(126, 180, 255, .72)';
      context.fill();
    }
  }

  function animate() {
    drawParticles(true);
    animationFrame = window.requestAnimationFrame(animate);
  }

  hero.addEventListener('pointermove', (event) => {
    const bounds = hero.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  });
  hero.addEventListener('pointerleave', () => { pointer.active = false; });
  window.addEventListener('resize', resizeCanvas, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (reduceMotion.matches) return;
    if (document.hidden) {
      window.cancelAnimationFrame(animationFrame);
    } else {
      animationFrame = window.requestAnimationFrame(animate);
    }
  });

  resizeCanvas();
  if (!reduceMotion.matches) animationFrame = window.requestAnimationFrame(animate);
}
