import { useEffect, useRef } from 'react';
import './AuthBackground.scss';

function AuthBackground({ variant = 'login' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 20;
      const y = (clientY / window.innerHeight - 0.5) * 20;

      const blobs = container.querySelectorAll('.auth-bg__blob');
      blobs.forEach((blob, i) => {
        const speed = (i + 1) * 0.3;
        blob.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className={`auth-bg auth-bg--${variant}`} ref={containerRef}>
      <div className="auth-bg__blob auth-bg__blob--1"></div>
      <div className="auth-bg__blob auth-bg__blob--2"></div>
      <div className="auth-bg__blob auth-bg__blob--3"></div>
      <div className="auth-bg__noise"></div>
    </div>
  );
}

export default AuthBackground;
