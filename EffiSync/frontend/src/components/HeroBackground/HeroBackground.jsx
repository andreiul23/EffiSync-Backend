import { useEffect, useRef } from 'react';
import './HeroBackground.scss';

function HeroBackground() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 30;
      const y = (clientY / window.innerHeight - 0.5) * 30;

      const blobs = container.querySelectorAll('.hero-bg__blob');
      blobs.forEach((blob, i) => {
        const speed = (i + 1) * 0.4;
        blob.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="hero-bg" ref={containerRef}>
      <div className="hero-bg__blob hero-bg__blob--1"></div>
      <div className="hero-bg__blob hero-bg__blob--2"></div>
      <div className="hero-bg__blob hero-bg__blob--3"></div>
      <div className="hero-bg__blob hero-bg__blob--4"></div>
      <div className="hero-bg__grid"></div>
    </div>
  );
}

export default HeroBackground;
