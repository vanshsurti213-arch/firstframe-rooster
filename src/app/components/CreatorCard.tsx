import { useRef, useState } from 'react';
import { Creator } from '../data/creators';

interface CreatorCardProps {
  creator: Creator;
}

const GITHUB_VIDEO_BASE = 'https://media.githubusercontent.com/media/vanshsurti213-arch/firstframe-rooster/main/public/videos';

export function CreatorCard({ creator }: CreatorCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  // Desktop: hover to play
  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setPlaying(false);
    }
  };

  // Mobile: tap to toggle
  const handleClick = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  return (
    <div className="creator-card">
      <div
        className="creator-card__video-wrap"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {creator.videoFile ? (
          <>
            <video
              ref={videoRef}
              preload="metadata"
              loop
              playsInline
              muted
            >
              <source
              src={`${GITHUB_VIDEO_BASE}/${creator.videoFile}`}
              type={creator.videoFile.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'}
            />
            <source src={`${GITHUB_VIDEO_BASE}/${creator.videoFile}`} type="video/mp4" />
            {/* local dev fallback */}
            <source src={`/videos/${creator.videoFile}`} type="video/mp4" />
            </video>

            {/* Play overlay — visible when paused, hidden when playing */}
            <div className={`creator-card__play-overlay${playing ? ' hidden' : ''}`}>
              <div className="creator-card__play-btn">
                <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                  <path d="M1 1L13 8L1 15V1Z" fill="#111111"/>
                </svg>
              </div>
            </div>
          </>
        ) : (
          <div className="creator-card__placeholder">
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
              <path d="M1 1L19 12L1 23V1Z" fill="#444" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      <div className="creator-card__info">
        <p className="creator-card__name">{creator.name}</p>

        <div className="creator-card__stats">
          <div className="stat-item">
            <span className="stat-label">Followers</span>
            <span className="stat-value">{creator.followers}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Views</span>
            <span className="stat-value">{creator.avgViews}</span>
          </div>
        </div>

        {creator.niches.length > 0 && (
          <div className="creator-card__niches">
            {creator.niches.map((n) => (
              <span key={n} className="niche-tag">{n}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
