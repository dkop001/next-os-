import React from 'react';

const BackgroundSphere = () => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      pointerEvents: 'none',
      overflow: 'hidden'
    }}>
      {/* Rotating particle sphere - CSS animated */}
      <div className="bg-sphere-container">
        <div className="bg-sphere-orb">
          <div className="bg-sphere-particle-ring ring-1" />
          <div className="bg-sphere-particle-ring ring-2" />
          <div className="bg-sphere-particle-ring ring-3" />
          <div className="bg-sphere-particle-ring ring-4" />
          <div className="bg-sphere-core" />
        </div>
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="bg-sphere-particle"
            style={{
              '--angle': `${(i / 60) * 360}deg`,
              '--delay': `${i * 0.05}s`,
              '--orbit': `${20 + Math.random() * 40}px`,
              '--size': `${2 + Math.random() * 3}px`,
              '--hue': `${200 + Math.random() * 40}`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default BackgroundSphere;
