import React from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import './VideoControls.css';

const VideoControls = ({ 
  onEndCall, 
  onToggleMic, 
  onToggleVideo, 
  isMicMuted, 
  isVideoOff 
}) => {
  const { 
    isRealTimeTranslate, 
    toggleRealTimeTranslate,
    enableTTS,
    setEnableTTS,
    enableSubtitles,
    setEnableSubtitles
  } = useTranslation();

  return (
    <div className="video-controls">
      <div className="main-controls">
        <button 
          className={`control-btn mic-btn ${isMicMuted ? 'disabled' : ''}`}
          onClick={onToggleMic}
          title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMicMuted ? '🔇' : '🎤'}
        </button>
        
        <button 
          className="control-btn end-call-btn"
          onClick={onEndCall}
          title="End call"
        >
          📞
        </button>
        
        <button 
          className={`control-btn video-btn ${isVideoOff ? 'disabled' : ''}`}
          onClick={onToggleVideo}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? '🚫' : '📹'}
        </button>
      </div>
      
      <div className="feature-controls">
        <button 
          className={`feature-btn translate-btn ${isRealTimeTranslate ? 'active' : ''}`}
          onClick={toggleRealTimeTranslate}
          title={isRealTimeTranslate ? 'Disable real-time translation' : 'Enable real-time translation'}
        >
          {isRealTimeTranslate ? '🔄 Real-time ON' : '🔄 Real-time OFF'}
        </button>
        
        <button 
          className={`feature-btn subtitle-btn ${enableSubtitles ? 'active' : ''}`}
          onClick={() => setEnableSubtitles(!enableSubtitles)}
          title={enableSubtitles ? 'Hide subtitles' : 'Show subtitles'}
        >
          {enableSubtitles ? '📝 Subtitles ON' : '📝 Subtitles OFF'}
        </button>
        
        <button 
          className={`feature-btn tts-btn ${enableTTS ? 'active' : ''}`}
          onClick={() => setEnableTTS(!enableTTS)}
          title={enableTTS ? 'Disable text-to-speech' : 'Enable text-to-speech'}
        >
          {enableTTS ? '🔊 TTS ON' : '🔊 TTS OFF'}
        </button>
      </div>
    </div>
  );
};

export default VideoControls;