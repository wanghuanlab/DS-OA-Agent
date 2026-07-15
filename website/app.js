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
  const pointer = { x: 0, y: 0, lastMove: 0 };
  const magnet = { x: 0, y: 0 };
  let particles = [];
  let width = 0;
  let height = 0;
  let animationFrame = 0;
  let startedAt = performance.now();

  function defaultMagnetPosition() {
    return width < 700
      ? { x: width * 0.58, y: height * 0.7 }
      : { x: width * 0.75, y: height * 0.5 };
  }

  function createParticles() {
    const count = width < 640 ? 170 : 320;
    const center = defaultMagnetPosition();
    pointer.x = center.x;
    pointer.y = center.y;
    magnet.x = center.x;
    magnet.y = center.y;
    particles = Array.from({ length: count }, (_, index) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * Math.max(width, height) * 0.62;
      const homeX = center.x + Math.cos(angle) * distance;
      const homeY = center.y + Math.sin(angle) * distance;
      return {
        homeX,
        homeY,
        x: homeX,
        y: homeY,
        z: Math.random(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.55 + Math.random() * 0.9,
        variance: 0.45 + Math.random() * 0.9,
        length: index % 8 === 0 ? 8 : 3 + Math.random() * 4,
        color: index % 11 === 0 ? 'blue' : 'pink'
      };
    });
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
    if (reduceMotion.matches) drawParticles(performance.now(), false);
  }

  function drawCapsule(particle, angle, scale, alpha) {
    const halfLength = particle.length * scale * 0.5;
    const dx = Math.cos(angle) * halfLength;
    const dy = Math.sin(angle) * halfLength;
    context.beginPath();
    context.moveTo(particle.x - dx, particle.y - dy);
    context.lineTo(particle.x + dx, particle.y + dy);
    context.lineWidth = Math.max(1, 1.7 * scale);
    context.lineCap = 'round';
    context.strokeStyle = particle.color === 'blue'
      ? `rgba(110, 178, 255, ${alpha})`
      : `rgba(255, 159, 252, ${alpha})`;
    context.stroke();
  }

  function drawParticles(now, update = true) {
    const elapsed = (now - startedAt) / 1000;
    const idle = now - pointer.lastMove > 1800;
    const resting = defaultMagnetPosition();

    if (idle && update) {
      pointer.x = resting.x + Math.sin(elapsed * 0.42) * width * 0.09;
      pointer.y = resting.y + Math.cos(elapsed * 0.67) * height * 0.12;
    }

    const smooth = reduceMotion.matches ? 1 : 0.055;
    magnet.x += (pointer.x - magnet.x) * smooth;
    magnet.y += (pointer.y - magnet.y) * smooth;
    context.clearRect(0, 0, width, height);

    const magnetRadius = Math.min(width < 640 ? width * 0.72 : 410, height * 0.58);
    const ringRadius = Math.min(width < 640 ? width * 0.25 : 165, height * 0.23);

    for (const particle of particles) {
      const homeDriftX = Math.sin(elapsed * 0.12 * particle.speed + particle.phase) * 12;
      const homeDriftY = Math.cos(elapsed * 0.1 * particle.speed + particle.phase) * 10;
      const baseX = particle.homeX + homeDriftX;
      const baseY = particle.homeY + homeDriftY;
      const dx = baseX - magnet.x;
      const dy = baseY - magnet.y;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const influence = Math.max(0, Math.min(1, 1 - distance / magnetRadius));
      const easedInfluence = influence * influence * (3 - 2 * influence);
      const wave = Math.sin(elapsed * 1.25 * particle.speed + particle.phase + angle * 2) * 15 * particle.variance;
      const depth = (particle.z - 0.5) * 26;
      const currentRadius = ringRadius + wave + depth;
      const ringX = magnet.x + Math.cos(angle) * currentRadius;
      const ringY = magnet.y + Math.sin(angle) * currentRadius * 0.82;
      const targetX = baseX + (ringX - baseX) * easedInfluence;
      const targetY = baseY + (ringY - baseY) * easedInfluence;

      if (update) {
        particle.x += (targetX - particle.x) * 0.055;
        particle.y += (targetY - particle.y) * 0.055;
      } else {
        particle.x = targetX;
        particle.y = targetY;
      }

      const ringDistance = Math.abs(Math.hypot(particle.x - magnet.x, (particle.y - magnet.y) / 0.82) - ringRadius);
      const ringEnergy = Math.max(0, 1 - ringDistance / 130);
      const pulse = reduceMotion.matches ? 1 : 0.86 + Math.sin(elapsed * 3 + particle.phase) * 0.14;
      const scale = (0.45 + ringEnergy * 0.9) * pulse;
      const alpha = Math.min(0.92, 0.18 + ringEnergy * 0.72);
      drawCapsule(particle, angle + Math.PI / 2, scale, alpha);
    }
  }

  function animate(now) {
    drawParticles(now, true);
    animationFrame = window.requestAnimationFrame(animate);
  }

  hero.addEventListener('pointermove', (event) => {
    const bounds = hero.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.lastMove = performance.now();
  });
  hero.addEventListener('pointerleave', () => { pointer.lastMove = 0; });
  window.addEventListener('resize', resizeCanvas, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (reduceMotion.matches) return;
    if (document.hidden) window.cancelAnimationFrame(animationFrame);
    else animationFrame = window.requestAnimationFrame(animate);
  });

  resizeCanvas();
  if (!reduceMotion.matches) animationFrame = window.requestAnimationFrame(animate);
}
