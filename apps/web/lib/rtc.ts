import type { IceConfig, SignalData } from "@quad/shared";

const MAX_VIDEO_BITRATE = 500_000;

/**
 * One WebRTC connection for one call. The offerer sends the offer; the answerer replies.
 * ICE candidates that arrive before the remote description are queued.
 */
export class Peer {
  readonly pc: RTCPeerConnection;
  private pending: RTCIceCandidateInit[] = [];
  private closed = false;

  constructor(
    ice: IceConfig,
    private readonly role: "offerer" | "answerer",
    local: MediaStream | null,
    private readonly sendSignal: (data: SignalData) => void,
    onRemote: (stream: MediaStream) => void,
    onState: (state: RTCPeerConnectionState) => void,
  ) {
    this.pc = new RTCPeerConnection({
      iceServers: ice.iceServers,
      iceTransportPolicy: ice.iceTransportPolicy,
    });
    if (local) for (const track of local.getTracks()) this.pc.addTrack(track, local);
    else {
      // Still receive video/audio even if our own camera is unavailable.
      this.pc.addTransceiver("video", { direction: "recvonly" });
      this.pc.addTransceiver("audio", { direction: "recvonly" });
    }
    this.pc.onicecandidate = (ev) => {
      const c = ev.candidate;
      this.sendSignal({
        candidate: c
          ? {
              candidate: c.candidate,
              sdpMid: c.sdpMid,
              sdpMLineIndex: c.sdpMLineIndex,
              usernameFragment: c.usernameFragment,
            }
          : null,
      });
    };
    this.pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      onRemote(stream ?? new MediaStream([ev.track]));
    };
    this.pc.onconnectionstatechange = () => {
      onState(this.pc.connectionState);
      if (this.pc.connectionState === "connected") void this.capBitrate();
    };
  }

  async start() {
    if (this.role !== "offerer") return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ sdp: { type: "offer", sdp: offer.sdp ?? "" } });
  }

  async handle(data: SignalData) {
    if (this.closed) return;
    if ("sdp" in data) {
      await this.pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === "offer") {
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.sendSignal({ sdp: { type: "answer", sdp: answer.sdp ?? "" } });
      }
      for (const c of this.pending.splice(0)) await this.pc.addIceCandidate(c).catch(() => {});
      return;
    }
    if (!data.candidate) return;
    const candidate = {
      candidate: data.candidate.candidate,
      sdpMid: data.candidate.sdpMid ?? null,
      sdpMLineIndex: data.candidate.sdpMLineIndex ?? null,
      usernameFragment: data.candidate.usernameFragment ?? null,
    };
    if (this.pc.remoteDescription) await this.pc.addIceCandidate(candidate).catch(() => {});
    else this.pending.push(candidate);
  }

  /** ~480p at 500 kbps keeps relay bandwidth (our biggest cost) in check. */
  private async capBitrate() {
    for (const sender of this.pc.getSenders()) {
      if (sender.track?.kind !== "video") continue;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      for (const e of params.encodings) {
        e.maxBitrate = MAX_VIDEO_BITRATE;
        e.maxFramerate = 24;
      }
      await sender.setParameters(params).catch(() => {});
    }
  }

  close() {
    this.closed = true;
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
  }
}

export async function getCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 24 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
}

/** Grabs the current frame of a video as a small JPEG data URL (for report evidence). */
export function captureFrame(
  video: HTMLVideoElement | null,
  maxBytes = 140 * 1024,
): string | undefined {
  if (!video || video.readyState < 2 || !video.videoWidth) return undefined;
  const scale = Math.min(1, 480 / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.7, 0.5, 0.35]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if ((url.length * 3) / 4 <= maxBytes) return url;
  }
  return undefined;
}
