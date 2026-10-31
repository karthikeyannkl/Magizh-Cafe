import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  from?: number;
  to: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  from = 0,
  to,
  durationMs = 1200,
  prefix = '',
  suffix = '',
  className = '',
}) => {
  const [current, setCurrent] = useState<number>(from);

  useEffect(() => {
    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setCurrent(to);
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = from;
    const endValue = to;
    const change = endValue - startValue;

    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      // Ease-out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + change * easeProgress);
      setCurrent(nextValue);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setCurrent(endValue);
      }
    };

    frameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameId);
  }, [from, to, durationMs]);

  return (
    <span className={className}>
      {prefix}
      {current.toLocaleString('en-IN')}
      {suffix}
    </span>
  );
};
