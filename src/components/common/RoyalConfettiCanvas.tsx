import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  type: 'coin' | 'confetti' | 'ribbon' | 'sparkle';
  opacity: number;
  decay: number;
}

interface RoyalConfettiCanvasProps {
  durationMs?: number;
  particleCount?: number;
  showCoins?: boolean;
}

export const RoyalConfettiCanvas: React.FC<RoyalConfettiCanvasProps> = ({
  durationMs = 4500,
  particleCount = 70,
  showCoins = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect reduced motion accessibility
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = [
      '#F59E0B', // Royal Gold
      '#D97706', // Deep Gold
      '#FDE047', // Light Gold Sparkle
      '#059669', // Emerald Green
      '#10B981', // Bright Emerald
      '#EA580C', // Dark Orange
      '#FEF3C7', // Cream Gold
    ];

    const particles: Particle[] = [];
    const actualCount = Math.min(particleCount, window.innerWidth < 640 ? 50 : 85);

    for (let i = 0; i < actualCount; i++) {
      const isCoin = showCoins && Math.random() < 0.28;
      const isSparkle = !isCoin && Math.random() < 0.2;
      const isRibbon = !isCoin && !isSparkle && Math.random() < 0.25;

      particles.push({
        x: Math.random() * width,
        y: -20 - Math.random() * (height * 0.5),
        vx: (Math.random() - 0.5) * 3,
        vy: 2.2 + Math.random() * 3.8,
        size: isCoin ? 14 + Math.random() * 8 : isRibbon ? 16 + Math.random() * 10 : 8 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.05 + Math.random() * 0.08,
        type: isCoin ? 'coin' : isSparkle ? 'sparkle' : isRibbon ? 'ribbon' : 'confetti',
        opacity: 1,
        decay: 1 / (durationMs / 16.6),
      });
    }

    let animationFrameId: number;
    let startTime = performance.now();

    const render = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx + Math.sin(p.wobble) * 1.2;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;

        if (elapsed > durationMs * 0.65) {
          p.opacity = Math.max(0, p.opacity - 0.018);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.opacity);

        if (p.type === 'coin') {
          // Render 3D Royal Gold Coin
          const scaleX = Math.cos(p.wobble);
          ctx.scale(scaleX, 1);

          // Outer Gold Rim
          const grad = ctx.createLinearGradient(-p.size, -p.size, p.size, p.size);
          grad.addColorStop(0, '#FEF08A');
          grad.addColorStop(0.4, '#F59E0B');
          grad.addColorStop(0.8, '#B45309');
          grad.addColorStop(1, '#78350F');

          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#FDE047';
          ctx.stroke();

          // Inner Coin Ring
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.72, 0, Math.PI * 2);
          ctx.fillStyle = '#D97706';
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#FEF08A';
          ctx.stroke();

          // B5 Symbol in center
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${Math.round(p.size * 0.75)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('B5', 0, 0.5);
        } else if (p.type === 'sparkle') {
          // 4-Point Golden Sparkle
          const r = p.size * 0.75;
          ctx.fillStyle = '#FDE047';
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            const mid = angle + Math.PI / 4;
            ctx.lineTo(Math.cos(mid) * (r * 0.28), Math.sin(mid) * (r * 0.28));
          }
          ctx.closePath();
          ctx.fill();
        } else if (p.type === 'ribbon') {
          // Curving Festive Ribbon
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.4, p.size * 1.1, p.rotation, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Confetti Paper Rectangle
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.7);
        }

        ctx.restore();
      });

      if (elapsed < durationMs && particles.some((p) => p.opacity > 0)) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [durationMs, particleCount, showCoins]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[120]"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
};
