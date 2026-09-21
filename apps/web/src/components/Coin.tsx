"use client";

/**
 * 一枚铜钱。字面刻"赛博通宝"（上下右左），背面素面。
 * `back` 为 true 时背面朝上；`spin` 每加一次多转两圈，保证同一面连续出现时也有动画。
 */
export function Coin({ back, spin, delay = 0, hopping }: { back: boolean; spin: number; delay?: number; hopping: boolean }) {
  const deg = spin * 720 + (back ? 180 : 0);
  return (
    <div className={`coin-scene h-20 w-20 sm:h-24 sm:w-24 ${hopping ? "coin-hop" : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="coin relative h-full w-full" style={{ transform: `rotateX(${deg}deg)`, transitionDelay: `${delay}ms` }}>
        <div className="coin-face">
          <CoinFace inscribed />
        </div>
        <div className="coin-face back">
          <CoinFace />
        </div>
      </div>
    </div>
  );
}

function CoinFace({ inscribed = false }: { inscribed?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]" aria-hidden>
      <defs>
        <radialGradient id="brass" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#e6d3a3" />
          <stop offset="55%" stopColor="#c9a86a" />
          <stop offset="100%" stopColor="#7d6232" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#brass)" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="#8c6f3a" strokeWidth="1.2" opacity="0.7" />
      <rect x="40" y="40" width="20" height="20" fill="#0f1516" />
      <rect x="38" y="38" width="24" height="24" fill="none" stroke="#8c6f3a" strokeWidth="1" opacity="0.8" />
      {inscribed && (
        <g fill="#3d2f14" fontFamily="var(--font-display)" fontSize="17" fontWeight="700" textAnchor="middle">
          <text x="50" y="32">赛</text>
          <text x="50" y="82">博</text>
          <text x="77" y="57">通</text>
          <text x="23" y="57">宝</text>
        </g>
      )}
    </svg>
  );
}
