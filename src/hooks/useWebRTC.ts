'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStompClient } from '@/providers/StompProvider';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface SignalingMessage {
  type: 'JOIN' | 'LEAVE' | 'OFFER' | 'ANSWER' | 'ICE' | 'MIC_TOGGLE';
  fromUserId: string;
  fromNickname: string;
  toUserId?: string;
  sessionType?: string;
  sdp?: string;
  candidate?: string;
  micOn?: boolean;
}

export interface VoiceParticipant {
  userId: string;
  nickname: string;
}

export interface UseWebRTCOptions {
  roomIdx: number | null;
  currentUserId: string;
  currentNickname: string;
  sessionType: 'VOICE' | 'VIDEO';
  active: boolean;
  // [I] 녹음 중지 시 호출(서버 보관용). 미지정이면 아무것도 안 함(자동 다운로드 폐기).
  onRecordingComplete?: (segments: Blob[], mimeType: string) => void;
}

export interface UseWebRTCResult {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: VoiceParticipant[];
  speakingUsers: Set<string>;
  micOnUsers: Set<string>;
  localSpeaking: boolean;
  localMicOn: boolean;
  toggleMic: () => void;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
  lastRecordingSegments: Blob[];
  lastRecordingMimeType: string;
  error: string | null;
}

export function useWebRTC({
  roomIdx,
  currentUserId,
  currentNickname,
  sessionType,
  active,
  onRecordingComplete,
}: UseWebRTCOptions): UseWebRTCResult {
  const client = useStompClient();

  // 녹음 완료 콜백 stale closure 방지용 ref
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  useEffect(() => { onRecordingCompleteRef.current = onRecordingComplete; }, [onRecordingComplete]);

  // 콜백 내에서 stale closure 없이 최신값 접근하기 위한 refs
  const localStreamRef  = useRef<MediaStream | null>(null);
  const peerConnsRef    = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const participantsRef = useRef<Map<string, VoiceParticipant>>(new Map());
  const micOnUsersRef   = useRef<Set<string>>(new Set());
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const analysersRef    = useRef<Map<string, AnalyserNode>>(new Map());
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef       = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const segmentsRef       = useRef<Blob[]>([]);
  const recordStreamRef   = useRef<MediaStream | null>(null);
  const segmentTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFinalStopRef    = useRef(false);
  const localVideoRef     = useRef<HTMLVideoElement>(null);

  // toggleMic 에서 최신값 참조용
  const clientRef     = useRef(client);
  const roomIdxRef    = useRef(roomIdx);
  const localMicOnRef = useRef(true);
  useEffect(() => { clientRef.current = client; },  [client]);
  useEffect(() => { roomIdxRef.current = roomIdx; }, [roomIdx]);

  // 렌더링용 상태
  const [localStream,   setLocalStream]   = useState<MediaStream | null>(null);
  const [remoteStreams,  setRemoteStreams]  = useState<Map<string, MediaStream>>(new Map());
  const [participants,  setParticipants]  = useState<VoiceParticipant[]>([]);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [micOnUsers,    setMicOnUsers]    = useState<Set<string>>(new Set());
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [localMicOn,    setLocalMicOn]    = useState(true);
  const [isRecording,           setIsRecording]           = useState(false);
  const [lastRecordingSegments, setLastRecordingSegments] = useState<Blob[]>([]);
  const [lastRecordingMimeType, setLastRecordingMimeType] = useState<string>('');
  const [error,                 setError]                 = useState<string | null>(null);

  // 로컬 비디오를 스트림에 연결
  useEffect(() => {
    if (localVideoRef.current && localStream && sessionType === 'VIDEO') {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, sessionType]);

  // ── 메인 WebRTC 이펙트 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !roomIdx || !client) return;

    let cleanedUp = false;
    let topicSub:  { unsubscribe(): void } | null = null;
    let queueSub:  { unsubscribe(): void } | null = null;

    // 피어 커넥션 생성 또는 기존 것 반환
    const getOrCreatePC = (peerId: string): RTCPeerConnection => {
      if (peerConnsRef.current.has(peerId)) return peerConnsRef.current.get(peerId)!;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnsRef.current.set(peerId, pc);

      // 로컬 트랙 추가
      localStreamRef.current?.getTracks().forEach(t =>
        pc.addTrack(t, localStreamRef.current!)
      );

      // ICE 후보 전송
      pc.onicecandidate = e => {
        if (!e.candidate || cleanedUp) return;
        client.publish({
          destination: `/app/voice.signal/${roomIdx}`,
          body: JSON.stringify({
            type: 'ICE',
            toUserId: peerId,
            candidate: JSON.stringify(e.candidate.toJSON()),
          }),
        });
      };

      // 원격 트랙 수신
      pc.ontrack = e => {
        const stream = e.streams[0];
        if (!stream) return;
        remoteStreamsRef.current.set(peerId, stream);
        setRemoteStreams(new Map(remoteStreamsRef.current));
        addRemoteAnalyser(peerId, stream);
      };

      return pc;
    };

    const addRemoteAnalyser = (userId: string, stream: MediaStream) => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        analysersRef.current.set(userId, analyser);
      } catch { /* ignore */ }
    };

    // 방 토픽 핸들러 (JOIN / LEAVE / MIC_TOGGLE)
    const handleTopic = async (msg: SignalingMessage) => {
      if (msg.fromUserId === currentUserId) return;

      if (msg.type === 'JOIN') {
        participantsRef.current.set(msg.fromUserId, {
          userId: msg.fromUserId, nickname: msg.fromNickname,
        });
        micOnUsersRef.current.add(msg.fromUserId);
        setParticipants([...participantsRef.current.values()]);
        setMicOnUsers(new Set(micOnUsersRef.current));

        // 기존 참여자 → 신규 입장자에게 OFFER 전송
        try {
          const pc = getOrCreatePC(msg.fromUserId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          client.publish({
            destination: `/app/voice.signal/${roomIdx}`,
            body: JSON.stringify({ type: 'OFFER', toUserId: msg.fromUserId, sdp: offer.sdp }),
          });
        } catch { /* ignore */ }

      } else if (msg.type === 'LEAVE') {
        participantsRef.current.delete(msg.fromUserId);
        setParticipants([...participantsRef.current.values()]);
        peerConnsRef.current.get(msg.fromUserId)?.close();
        peerConnsRef.current.delete(msg.fromUserId);
        remoteStreamsRef.current.delete(msg.fromUserId);
        setRemoteStreams(new Map(remoteStreamsRef.current));
        analysersRef.current.delete(msg.fromUserId);
        micOnUsersRef.current.delete(msg.fromUserId);
        setMicOnUsers(new Set(micOnUsersRef.current));

      } else if (msg.type === 'MIC_TOGGLE') {
        if (msg.micOn) micOnUsersRef.current.add(msg.fromUserId);
        else           micOnUsersRef.current.delete(msg.fromUserId);
        setMicOnUsers(new Set(micOnUsersRef.current));
      }
    };

    // 개인 큐 핸들러 (OFFER / ANSWER / ICE)
    const handleQueue = async (msg: SignalingMessage) => {
      if (msg.type === 'OFFER') {
        participantsRef.current.set(msg.fromUserId, {
          userId: msg.fromUserId, nickname: msg.fromNickname,
        });
        micOnUsersRef.current.add(msg.fromUserId);
        setParticipants([...participantsRef.current.values()]);
        setMicOnUsers(new Set(micOnUsersRef.current));

        try {
          const pc = getOrCreatePC(msg.fromUserId);
          await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp! });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          client.publish({
            destination: `/app/voice.signal/${roomIdx}`,
            body: JSON.stringify({ type: 'ANSWER', toUserId: msg.fromUserId, sdp: answer.sdp }),
          });
        } catch { /* ignore */ }

      } else if (msg.type === 'ANSWER') {
        try {
          const pc = peerConnsRef.current.get(msg.fromUserId);
          if (pc) await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp! });
        } catch { /* ignore */ }

      } else if (msg.type === 'ICE') {
        try {
          const pc = peerConnsRef.current.get(msg.fromUserId);
          if (pc && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(msg.candidate)));
          }
        } catch { /* ignore */ }
      }
    };

    const run = async () => {
      try {
        setError(null);

        // 화상은 오디오+비디오 요청. 단, 카메라가 없거나 사용 불가하면 getUserMedia가 통째로 거부되어
        // 오디오까지 못 얻는다(→ 녹음 '오디오 스트림 없음' 버그). 이 경우 오디오 전용으로 폴백해
        // 카메라 없이도 음성 참여 + 녹음이 되게 한다.
        let stream: MediaStream;
        if (sessionType === 'VIDEO') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true, video: { width: 640, height: 480, facingMode: 'user' },
            });
          } catch {
            // 카메라 실패 → 오디오만으로 재시도(영상 없이 참여)
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!cleanedUp) setError('카메라를 사용할 수 없어 음성으로만 참여합니다.');
          }
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        if (cleanedUp) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamRef.current = stream;
        setLocalStream(stream);
        micOnUsersRef.current.add(currentUserId);
        setMicOnUsers(new Set(micOnUsersRef.current));

        // AudioContext 및 로컬 음량 분석
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const localAnalyser = ctx.createAnalyser();
        localAnalyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(localAnalyser);
        analysersRef.current.set('__local__', localAnalyser);

        // 발언 감지 타이머 (100ms 주기)
        timerRef.current = setInterval(() => {
          let localSpeak = false;
          const remote = new Set<string>();
          analysersRef.current.forEach((analyser, uid) => {
            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            if (avg > 15) {
              if (uid === '__local__') localSpeak = true;
              else remote.add(uid);
            }
          });
          setLocalSpeaking(localSpeak);
          setSpeakingUsers(new Set(remote));
        }, 100);

        // 방 토픽 구독 (JOIN / LEAVE / MIC_TOGGLE 브로드캐스트)
        topicSub = client.subscribe(`/topic/voice/${roomIdx}`, frame => {
          try { handleTopic(JSON.parse(frame.body)); } catch { /* ignore */ }
        });

        // 개인 큐 구독 (OFFER / ANSWER / ICE 유니캐스트)
        queueSub = client.subscribe('/user/queue/voice', frame => {
          try { handleQueue(JSON.parse(frame.body)); } catch { /* ignore */ }
        });

        // JOIN 알림 전송
        client.publish({
          destination: `/app/voice.join/${roomIdx}`,
          body: JSON.stringify({ sessionType }),
        });

      } catch {
        if (!cleanedUp) setError('마이크/카메라 권한을 허용해주세요.');
      }
    };

    run();

    return () => {
      cleanedUp = true;
      topicSub?.unsubscribe();
      queueSub?.unsubscribe();

      try {
        client.publish({ destination: `/app/voice.leave/${roomIdx}`, body: '{}' });
      } catch { /* 연결 끊어진 경우 무시 */ }

      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      analysersRef.current.clear();

      peerConnsRef.current.forEach(pc => pc.close());
      peerConnsRef.current.clear();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      remoteStreamsRef.current.clear();
      participantsRef.current.clear();
      micOnUsersRef.current.clear();
      localMicOnRef.current = true;

      setLocalStream(null);
      setRemoteStreams(new Map());
      setParticipants([]);
      setSpeakingUsers(new Set());
      setMicOnUsers(new Set());
      setLocalSpeaking(false);
      setLocalMicOn(true);
      setIsRecording(false);
      setError(null);
      // 세그먼트 타이머 정리 후 최종 stop 처리
      isFinalStopRef.current = true;
      if (segmentTimerRef.current) { clearInterval(segmentTimerRef.current); segmentTimerRef.current = null; }
      recordStreamRef.current = null;
      recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, [active, roomIdx, client, sessionType, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 마이크 토글 ──────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const newMicOn = !localMicOnRef.current;
    localMicOnRef.current = newMicOn;
    stream.getAudioTracks().forEach(t => { t.enabled = newMicOn; });
    setLocalMicOn(newMicOn);

    const c = clientRef.current;
    const ridx = roomIdxRef.current;
    if (c && ridx) {
      try {
        c.publish({
          destination: `/app/voice.mic/${ridx}`,
          body: JSON.stringify({ micOn: newMicOn }),
        });
      } catch { /* ignore */ }
    }
  }, []);

  // ── 녹음/녹화 (세그먼트 자동 분할: 음성 10분 / 화상 3분) ──────────────────
  const startRecording = useCallback(() => {
    if (isRecording) return;
    if (!localStreamRef.current) {
      setError('녹음할 오디오 스트림이 없습니다. 마이크 권한을 확인해주세요.');
      return;
    }
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(localStreamRef.current).connect(dest);
      remoteStreamsRef.current.forEach(rs => {
        try { ctx.createMediaStreamSource(rs).connect(dest); } catch { /* ignore */ }
      });

      // [I] 항목21: 화상 채팅도 '녹화(비디오)' 대신 '녹음(오디오)'으로 통일 → 항상 오디오만 녹음
      const recordStream: MediaStream = dest.stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const maxSegmentMs = 10 * 60 * 1000; // 10분 단위 분할(오디오)

      recordStreamRef.current = recordStream;
      segmentsRef.current = [];
      isFinalStopRef.current = false;

      // 각 세그먼트마다 새 MediaRecorder를 생성해 독립된 webm 파일로 만든다
      const startSegment = (): MediaRecorder => {
        const mr = new MediaRecorder(recordStream, { mimeType });
        chunksRef.current = [];
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          segmentsRef.current.push(blob);
          chunksRef.current = [];

          if (isFinalStopRef.current || !recordStreamRef.current) {
            const segs = [...segmentsRef.current];
            setLastRecordingSegments(segs); // AI 회의록 입력용으로 메모리 보관
            setLastRecordingMimeType(mimeType);
            // [I] 항목20: 자동 다운로드 폐기 → 서버 보관 콜백 호출(ChatWindow가 업로드)
            onRecordingCompleteRef.current?.(segs, mimeType);
            setIsRecording(false);
            if (segmentTimerRef.current) { clearInterval(segmentTimerRef.current); segmentTimerRef.current = null; }
          } else {
            // 자동 분할: 다음 세그먼트 시작
            recorderRef.current = startSegment();
          }
        };
        mr.start(500);
        return mr;
      };

      recorderRef.current = startSegment();
      segmentTimerRef.current = setInterval(() => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      }, maxSegmentMs);
      setIsRecording(true);
    } catch (e) {
      // 기존엔 조용히 삼켜서 '버튼 눌러도 무반응'이었음 → 원인을 화면에 노출
      console.error('[녹음 시작 실패]', e);
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      setError('녹음을 시작할 수 없습니다 — ' + msg);
    }
  }, [isRecording, sessionType]);

  const stopRecording = useCallback(() => {
    isFinalStopRef.current = true;
    if (segmentTimerRef.current) { clearInterval(segmentTimerRef.current); segmentTimerRef.current = null; }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  return {
    localStream,
    remoteStreams,
    participants,
    speakingUsers,
    micOnUsers,
    localSpeaking,
    localMicOn,
    toggleMic,
    localVideoRef,
    startRecording,
    stopRecording,
    isRecording,
    lastRecordingSegments,
    lastRecordingMimeType,
    error,
  };
}
