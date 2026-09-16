import React from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import Controls from './Controls';

export default function Room({ session, onLeave }) {
  return (
    <div className="room-container">
      <LiveKitRoom
        video={true}
        // AUTO GAIN CONTROL KAPATILDI
        audio={{
          autoGainControl: false,
          echoCancellation: true,
          noiseSuppression: true,
        }}
        token={session.token}
        serverUrl={session.url}
        data-lk-theme="default"
        onDisconnected={onLeave}
        style={{ height: '100vh' }}
      >
        <MyVideoConference />
        <Controls roomName={session.roomName} onLeave={onLeave} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}

function MyVideoConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <GridLayout tracks={tracks} style={{ height: 'calc(100vh - 80px)' }}>
      <ParticipantTile />
    </GridLayout>
  );
}