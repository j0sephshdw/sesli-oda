import React from 'react';
import {
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  ParticipantTile,
} from '@livekit/components-react';

export default function AudioRoom({ roomName, onLeave }) {
  const participants = useParticipants();

  return (
    <div className="room-container">
      <header className="room-header">
        <h1>Oda: {roomName}</h1>
        <span className="participant-count">{participants.length} Katılımcı</span>
      </header>

      <main className="participants-grid">
        {participants.map((p) => (
          <ParticipantTile key={p.identity} participant={p} />
        ))}
      </main>

      <footer className="room-footer">
        <ControlBar controls={{ microphone: true, camera: false, screenShare: false }} />
        <button className="leave-btn" onClick={onLeave}>
          Ayrıl
        </button>
      </footer>

      <RoomAudioRenderer />
    </div>
  );
}