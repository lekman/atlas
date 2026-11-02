export interface HeaderButtonsProps {
  soundOn: boolean;
  onSound: () => void;
  onSettings: () => void;
}

/**
 * The header's two icon buttons, as on the full page: sound on or off,
 * then settings.
 */
export function HeaderButtons({
  soundOn,
  onSound,
  onSettings,
}: HeaderButtonsProps) {
  return (
    <div className="meta">
      <button
        type="button"
        className="hbtn"
        aria-label="Sound"
        aria-pressed={soundOn}
        title={soundOn ? "Turn sound off" : "Turn sound on"}
        onClick={onSound}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {soundOn ? (
            <path d="M17 9c1.5 1.5 1.5 4.5 0 6" />
          ) : (
            <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
          )}
        </svg>
      </button>
      <button
        type="button"
        className="hbtn"
        aria-label="Settings"
        title="Settings"
        onClick={onSettings}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
        </svg>
      </button>
    </div>
  );
}
