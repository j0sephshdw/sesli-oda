import React, { useState } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { BackgroundBlur } from '@livekit/track-processors';

export default function Controls({ roomName, onLeave }) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  const toggleMic = async () => {
    await localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
  };

  const toggleCam = async () => {
    await localParticipant.setCameraEnabled(!isCamOn);
    setIsCamOn(!isCamOn);
  };

  const toggleBlur = async () => {
    const track = localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
    if (!track) return alert('Önce kamerayı açın!');
    
    if (!isBlurred) {
      await track.setProcessor(BackgroundBlur(10));
      setIsBlurred(true);
    } else {
      await track.stopProcessor();
      setIsBlurred(false);
    }
  };

  const toggleHand = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    localParticipant.setAttributes({ handRaised: nextState ? 'true' : 'false' });
  };

  const copyInvite = () => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url);
    alert('Davet linki kopyalandı!');
  };

  return (
    <div className="custom-controls">
      <button onClick={toggleMic} className={isMuted ? 'danger' : 'active'}>
        {isMuted ? '🔇 Ses Aç' : '🎙️ Sustur'}
      </button>
      <button onClick={toggleCam} className={isCamOn ? 'active' : ''}>
        {isCamOn ? '📹 Kamerayı Kapat' : '📹 Kamera Aç'}
      </button>
      <button onClick={toggleBlur} className={isBlurred ? 'active' : ''}>
        🌫️ Blur
      </button>
      <button onClick={toggleHand} className={isHandRaised ? 'active' : ''}>
        ✋ El Kaldır
      </button>
      <button onClick={copyInvite}>🔗 Davet Linki</button>
      <button onClick={() => room.disconnect()} className="danger">
        🚪 Ayrıl
      </button>
    </div>
  );
}