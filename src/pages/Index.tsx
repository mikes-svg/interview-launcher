import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Vapi from '@vapi-ai/web';
import {
  VAPI_PUBLIC_KEY,
  INTERVIEWER_NAME,
  resolvePosition,
} from '../config';

type Step = 'device-check' | 'interview';
type CheckStatus = 'idle' | 'testing' | 'success' | 'error';
type CallStatus = 'idle' | 'loading' | 'active' | 'ended' | 'error';

export default function Index() {
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name') ?? '';
  const email = searchParams.get('email') ?? '';
  const upworkUrl = searchParams.get('upworkUrl') ?? '';
  const whatsapp = searchParams.get('whatsapp') ?? '';
  const blockedDays = searchParams.get('blockedDays') ?? '';
  const positionSlug = searchParams.get('position');
  const position = resolvePosition(positionSlug);

  const [step, setStep] = useState<Step>('device-check');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="bg-card rounded-2xl shadow-lg w-full max-w-md p-8 sm:p-10">
        {step === 'device-check' ? (
          <DeviceCheck
            name={name}
            onContinue={() => setStep('interview')}
          />
        ) : (
          <Interview
            candidateName={name}
            candidateEmail={email}
            upworkUrl={upworkUrl}
            whatsapp={whatsapp}
            blockedDays={blockedDays}
            positionLabel={position.label}
            assistantId={position.assistantId}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------- Step 1: Devices

function DeviceCheck({
  name,
  onContinue,
}: {
  name: string;
  onContinue: () => void;
}) {
  const [micStatus, setMicStatus] = useState<CheckStatus>('idle');
  const [camStatus, setCamStatus] = useState<CheckStatus>('idle');
  const [micError, setMicError] = useState<string>('');
  const [camError, setCamError] = useState<string>('');
  const [micLevel, setMicLevel] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  function cleanup() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function runCheck() {
    cleanup();
    setMicStatus('testing');
    setCamStatus('testing');
    setMicError('');
    setCamError('');

    let stream: MediaStream | null = null;
    try {
      // Single gUM call preserves user-gesture context.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setMicStatus('success');
      setCamStatus('success');
    } catch (err: unknown) {
      const e = err as { name?: string };
      const message =
        e?.name === 'NotAllowedError'
          ? 'Permission denied. Please allow access and retry.'
          : 'Not found or unavailable.';
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStatus('success');
        setCamStatus('error');
        setCamError(message);
      } catch (err2: unknown) {
        const e2 = err2 as { name?: string };
        setMicStatus('error');
        setCamStatus('error');
        const m2 =
          e2?.name === 'NotAllowedError'
            ? 'Permission denied. Please allow access and retry.'
            : 'Not found or unavailable.';
        setMicError(m2);
        setCamError(message);
        return;
      }
    }

    streamRef.current = stream;

    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // mic-level meter is a nicety, not a blocker
    }
  }

  useEffect(() => {
    if (camStatus === 'success' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [camStatus]);

  useEffect(() => cleanup, []);

  const bothPass = micStatus === 'success' && camStatus === 'success';
  const eitherFail = micStatus === 'error' || camStatus === 'error';

  return (
    <section className="text-center">
      <div className="text-5xl mb-3">🔧</div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">
        Hi {name || 'there'}!
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Before we begin your interview, let's make sure your microphone and
        camera are working.
      </p>

      {/* Camera preview */}
      <div className="aspect-video w-full rounded-xl bg-muted overflow-hidden mb-4 flex items-center justify-center">
        {camStatus === 'success' ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="text-muted-foreground">
            <div className="text-5xl mb-1">📷</div>
            <div className="text-sm">Camera preview will appear here</div>
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4 text-left">
        <StatusRow
          icon="🎤"
          label="Microphone"
          status={micStatus}
          error={micError}
          extra={
            micStatus === 'success' ? (
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-success transition-all duration-75"
                  style={{ width: `${micLevel}%` }}
                />
              </div>
            ) : null
          }
        />
        <StatusRow icon="📷" label="Camera" status={camStatus} error={camError} />
      </div>

      <div className="space-y-2">
        {micStatus === 'idle' && (
          <button
            onClick={runCheck}
            className="w-full rounded-xl bg-primary text-primary-foreground font-semibold py-4 hover:opacity-90 transition shadow-sm"
          >
            🔍 Test Microphone &amp; Camera
          </button>
        )}
        {eitherFail && (
          <button
            onClick={runCheck}
            className="w-full rounded-xl border border-border bg-card font-medium py-3 hover:bg-muted transition"
          >
            🔄 Retry test
          </button>
        )}
        {bothPass && (
          <button
            onClick={() => {
              cleanup();
              onContinue();
            }}
            className="w-full rounded-xl bg-primary text-primary-foreground font-semibold py-4 hover:opacity-90 transition shadow-sm"
          >
            Continue to interview →
          </button>
        )}
      </div>

      {micStatus === 'idle' && (
        <p className="text-xs text-muted-foreground mt-4">
          💡 If prompted, click <span className="font-medium">Allow</span> to
          grant access to your microphone and camera.
        </p>
      )}
    </section>
  );
}

function StatusRow({
  icon,
  label,
  status,
  error,
  extra,
}: {
  icon: string;
  label: string;
  status: CheckStatus;
  error?: string;
  extra?: React.ReactNode;
}) {
  const statusIcon =
    status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'testing' ? '…' : '⚪';
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {icon} {label}
        </span>
        <span aria-label={status}>{statusIcon}</span>
      </div>
      {error && <p className="text-sm text-danger mt-1">{error}</p>}
      {extra}
    </div>
  );
}

// ---------------------------------------------------------- Step 2: Interview

function Interview({
  candidateName,
  candidateEmail,
  upworkUrl,
  whatsapp,
  blockedDays,
  positionLabel,
  assistantId,
}: {
  candidateName: string;
  candidateEmail: string;
  upworkUrl: string;
  whatsapp: string;
  blockedDays: string;
  positionLabel: string;
  assistantId: string;
}) {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [statusText, setStatusText] = useState('Ready to begin');
  const [speaker, setSpeaker] = useState<'ai' | 'user' | null>(null);
  const [errorText, setErrorText] = useState('');
  const vapiRef = useRef<Vapi | null>(null);

  function attachHandlers(vapi: Vapi) {
    vapi.on('call-start', () => {
      setCallStatus('active');
      setStatusText('Interview in progress…');
      setSpeaker('ai');
    });
    vapi.on('speech-start', () => {
      setStatusText(`${INTERVIEWER_NAME} is speaking…`);
      setSpeaker('ai');
    });
    vapi.on('speech-end', () => {
      setStatusText('Listening to you…');
      setSpeaker('user');
    });
    vapi.on('call-end', () => {
      setCallStatus('ended');
      setStatusText('Thank you! Your interview has been recorded.');
      setSpeaker(null);
    });
    vapi.on('error', (err: unknown) => {
      console.error('Vapi error:', err);
      setCallStatus('error');
      setStatusText('Something went wrong. Please refresh and try again.');
      setSpeaker(null);
    });
  }

  async function start() {
    if (!VAPI_PUBLIC_KEY) {
      setErrorText('Missing VITE_VAPI_PUBLIC_KEY — set it in your environment.');
      setCallStatus('error');
      return;
    }
    if (!assistantId) {
      setErrorText('Missing assistant ID — set VITE_VAPI_ASSISTANT_ID in your environment.');
      setCallStatus('error');
      return;
    }

    setCallStatus('loading');
    setStatusText('Starting…');
    setErrorText('');

    try {
      const vapi = new Vapi(VAPI_PUBLIC_KEY);
      vapiRef.current = vapi;
      attachHandlers(vapi);

      // Vapi's {{candidateName}} should resolve to the first name only.
      // We still pass the full name in metadata for the webhook / sheet logging.
      const firstName =
        (candidateName.split(/\s+/)[0] || candidateName || 'there').trim();

      await vapi.start(assistantId, {
        variableValues: {
          candidateName: firstName,
          blockedDays: blockedDays || 'none specified',
        },
        metadata: {
          candidateName,
          candidateEmail,
          upworkUrl,
          whatsapp,
          blockedDays,
        },
        artifactPlan: {
          videoRecordingEnabled: true,
        },
      } as Parameters<Vapi['start']>[1]);
    } catch (err) {
      console.error('Failed to start Vapi call:', err);
      setCallStatus('error');
      setStatusText('Could not start the interview.');
      setErrorText(err instanceof Error ? err.message : String(err));
    }
  }

  function stop() {
    vapiRef.current?.stop();
  }

  useEffect(
    () => () => {
      vapiRef.current?.stop();
    },
    []
  );

  const dotColor =
    callStatus === 'active'
      ? 'bg-success'
      : callStatus === 'error'
      ? 'bg-danger'
      : 'bg-muted-foreground';

  const isLive = callStatus === 'active';
  const isEnded = callStatus === 'ended';

  return (
    <section className="text-center">
      <div className="text-5xl mb-3">{isEnded ? '✅' : '🏠'}</div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">
        {isEnded ? `Thanks${candidateName ? `, ${candidateName}` : ''}!` : `Hi ${candidateName || 'there'}!`}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {isEnded ? (
          <>Your interview has been recorded. We'll be in touch within 3 business days.</>
        ) : isLive ? (
          <>You're connected to <span className="font-semibold text-card-foreground">{INTERVIEWER_NAME}</span>. Speak naturally — the call usually takes 12–15 minutes.</>
        ) : (
          <>Your AI screening interview for the{' '}
            <span className="font-semibold text-card-foreground">
              {positionLabel} position
            </span>{' '}
            is ready. Click below and the interview will begin.</>
        )}
      </p>

      {/* Waveform shows only during active call */}
      {isLive && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 mb-4">
          <Waveform active={isLive} speaker={speaker} />
        </div>
      )}

      {errorText && (
        <p className="text-sm text-danger mb-3">{errorText}</p>
      )}

      <div className="space-y-2">
        {!isLive && !isEnded && (
          <button
            onClick={start}
            disabled={callStatus === 'loading'}
            className="w-full rounded-xl bg-primary text-primary-foreground font-semibold py-4 hover:opacity-90 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {callStatus === 'loading' ? 'Starting…' : '🎙️ Start Interview'}
          </button>
        )}
        {isLive && (
          <button
            onClick={stop}
            className="w-full rounded-xl border border-danger text-danger font-semibold py-4 hover:bg-danger hover:text-primary-foreground transition"
          >
            Stop Interview
          </button>
        )}
      </div>

      {/* Status indicator under the button (only before the call ends) */}
      {!isEnded && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <span
            className={`inline-block w-2 h-2 rounded-full ${dotColor} ${
              isLive ? 'animate-pulse-dot' : ''
            }`}
          />
          <span className="text-sm text-muted-foreground">{statusText}</span>
        </div>
      )}

      {!isLive && !isEnded && (
        <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
          <span className="text-amber-600">⚠️ Note:</span> We have a limit of 10
          simultaneous interviews. If you click "Start Interview" and it stays
          on "Starting…" without beginning, our system is at capacity — please
          come back in 1 hour and try again.
        </p>
      )}
    </section>
  );
}

function Waveform({
  active,
  speaker,
}: {
  active: boolean;
  speaker: 'ai' | 'user' | null;
}) {
  const bars = [60, 90, 70, 100, 75, 85, 55];
  const animClass = !active
    ? ''
    : speaker === 'user'
    ? 'animate-waveform-user'
    : 'animate-waveform';
  const color = speaker === 'user' ? 'bg-success' : 'bg-primary';

  return (
    <div className="flex items-center justify-center gap-1.5 h-16">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`block w-1.5 rounded-full ${color} ${animClass}`}
          style={
            {
              animationDelay: `${i * 0.08}s`,
              ['--bar-height' as string]: `${h}%`,
              height: active ? undefined : '20%',
              opacity: active ? 1 : 0.3,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
