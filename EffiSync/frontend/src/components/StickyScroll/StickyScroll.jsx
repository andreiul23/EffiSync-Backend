import { useEffect, useRef, useState } from 'react';
import InfoCard from '../InfoCard/InfoCard';
import './StickyScroll.scss';

function StickyScroll({ features }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRefs = useRef([]);

  useEffect(() => {
    const observers = [];

    sectionRefs.current.forEach((ref, index) => {
      if (!ref) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveIndex(index);
          }
        },
        {
          rootMargin: '-40% 0px -40% 0px',
          threshold: 0.1,
        }
      );

      observer.observe(ref);
      observers.push(observer);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, [features]);

  const visuals = {
    calendar: (
      <div className="sticky-visual sticky-visual--calendar">
        <div className="sticky-visual__grid">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className={`sticky-visual__day ${i === 2 ? 'sticky-visual__day--active' : ''}`}>
              <span className="sticky-visual__day-num">{i + 14}</span>
              {i === 2 && <div className="sticky-visual__task">Team sync</div>}
              {i === 4 && <div className="sticky-visual__task sticky-visual__task--alt">Review</div>}
            </div>
          ))}
        </div>
      </div>
    ),
    groups: (
      <div className="sticky-visual sticky-visual--groups">
        <div className="sticky-visual__avatars">
          {['A', 'M', 'E', 'S'].map((letter, i) => (
            <div key={i} className="sticky-visual__avatar" style={{ animationDelay: `${i * 0.1}s` }}>
              {letter}
            </div>
          ))}
        </div>
        <div className="sticky-visual__status">
          <div className="sticky-visual__bar sticky-visual__bar--filled" style={{ width: '75%' }}></div>
          <span>3/4 available</span>
        </div>
      </div>
    ),
    ai: (
      <div className="sticky-visual sticky-visual--ai">
        <div className="sticky-visual__chat">
          <div className="sticky-visual__bubble sticky-visual__bubble--ai">
            <span className="sticky-visual__ai-badge">AI</span>
            Overlap detected at 14:00
          </div>
          <div className="sticky-visual__bubble sticky-visual__bubble--user">
            Reschedule it
          </div>
          <div className="sticky-visual__bubble sticky-visual__bubble--ai">
            <span className="sticky-visual__ai-badge">AI</span>
            Done! Moved to 16:00 ✨
          </div>
        </div>
      </div>
    ),
    balance: (
      <div className="sticky-visual sticky-visual--balance">
        <div className="sticky-visual__meters">
          {[
            { label: 'Sleep', value: 85, emoji: '😴' },
            { label: 'Meals', value: 70, emoji: '🍽️' },
            { label: 'Breaks', value: 60, emoji: '☕' },
            { label: 'Deep Work', value: 90, emoji: '🎯' },
          ].map((meter, i) => (
            <div key={i} className="sticky-visual__meter">
              <span className="sticky-visual__meter-emoji">{meter.emoji}</span>
              <div className="sticky-visual__meter-track">
                <div
                  className="sticky-visual__meter-fill"
                  style={{ width: `${meter.value}%`, animationDelay: `${i * 0.2}s` }}
                ></div>
              </div>
              <span className="sticky-visual__meter-label">{meter.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  };

  return (
    <div className="sticky-scroll">
      <div className="sticky-scroll__left">
        {features.map((feature, index) => (
          <div
            key={feature.id}
            className={`sticky-scroll__section ${activeIndex === index ? 'sticky-scroll__section--active' : ''}`}
            ref={(el) => (sectionRefs.current[index] = el)}
          >
            <span className="sticky-scroll__icon">{feature.icon}</span>
            <h3 className="sticky-scroll__title">{feature.title}</h3>
            <p className="sticky-scroll__subtitle">{feature.subtitle}</p>
            <p className="sticky-scroll__desc">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="sticky-scroll__right">
        <div className="sticky-scroll__sticky">
          <InfoCard feature={features[activeIndex]} visual={visuals[features[activeIndex]?.visual]} />
        </div>
      </div>
    </div>
  );
}

export default StickyScroll;
