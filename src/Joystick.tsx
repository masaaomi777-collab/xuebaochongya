import React, { useEffect, useRef, useState } from 'react';
import { Vector2 } from './types';

interface JoystickProps {
  onChange: (v: Vector2) => void;
  size?: number;
}

export const Joystick: React.FC<JoystickProps> = ({ onChange, size = 100 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState<Vector2>({ x: 0, y: 0 });
  const centerRef = useRef<Vector2>({ x: 0, y: 0 });
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!active) return;
      
      const dx = e.clientX - centerRef.current.x;
      const dy = e.clientY - centerRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Reset if dragged more than half the screen height away
      if (distance > window.innerHeight / 2) {
        handleEnd();
        return;
      }

      const maxDist = size / 2;
      let nx = dx;
      let ny = dy;

      if (distance > maxDist) {
        nx = (dx / distance) * maxDist;
        ny = (dy / distance) * maxDist;
      }

      setPosition({ x: nx, y: ny });
      
      // Normalize output to -1 to 1
      onChangeRef.current({
        x: nx / maxDist,
        y: ny / maxDist,
      });
    };

    const handleEnd = () => {
      if (!active) return;
      setActive(false);
      setPosition({ x: 0, y: 0 });
      onChangeRef.current({ x: 0, y: 0 });
    };

    if (active) {
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleEnd);
      window.addEventListener('pointercancel', handleEnd);
    }

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [active, size]);

  const handleStart = (e: React.PointerEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    setActive(true);
    
    const dx = e.clientX - centerRef.current.x;
    const dy = e.clientY - centerRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDist = size / 2;

    let nx = dx;
    let ny = dy;

    if (distance > maxDist) {
      nx = (dx / distance) * maxDist;
      ny = (dy / distance) * maxDist;
    }

    setPosition({ x: nx, y: ny });
    onChangeRef.current({ x: nx / maxDist, y: ny / maxDist });
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-full bg-white/20 backdrop-blur-sm border border-white/30 touch-none select-none"
      style={{ width: size, height: size }}
      onPointerDown={handleStart}
    >
      <div
        className="absolute rounded-full bg-white/80 shadow-md pointer-events-none"
        style={{
          width: size * 0.4,
          height: size * 0.4,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          transition: active ? 'none' : 'transform 0.2s ease-out',
        }}
      />
    </div>
  );
};
