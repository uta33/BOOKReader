import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import {
  appendSpeechTranscript,
  speechInputErrorMessage,
  type SpeechInputErrorCode,
} from '../services/speechInput';

export type SpeechInputTarget = 'quote' | 'comment';
export type SpeechInputPhase = 'idle' | 'preparing' | 'listening' | 'stopping';

type SpeechPackage = typeof import('expo-speech-recognition');
type SpeechModule = SpeechPackage['ExpoSpeechRecognitionModule'];
type EventSubscription = { remove(): void };

type SpeechInputOptions = {
  quote: string;
  comment: string;
  setQuote: (text: string) => void;
  setComment: (text: string) => void;
  contextualStrings?: string[];
};

type SpeechInputError = {
  target: SpeechInputTarget;
  message: string;
};

let speechModulePromise: Promise<SpeechModule | null> | null = null;

async function loadSpeechModule(): Promise<SpeechModule | null> {
  speechModulePromise ??= import('expo-speech-recognition')
    .then((speech) => speech.ExpoSpeechRecognitionModule)
    .catch(() => null);
  return speechModulePromise;
}

export function useSpeechInput({
  quote,
  comment,
  setQuote,
  setComment,
  contextualStrings = [],
}: SpeechInputOptions) {
  const [phase, setPhase] = useState<SpeechInputPhase>('idle');
  const [activeTarget, setActiveTarget] = useState<SpeechInputTarget | null>(null);
  const [error, setError] = useState<SpeechInputError | null>(null);

  const mountedRef = useRef(true);
  const phaseRef = useRef<SpeechInputPhase>('idle');
  const activeTargetRef = useRef<SpeechInputTarget | null>(null);
  const sessionRef = useRef(0);
  const moduleRef = useRef<SpeechModule | null>(null);
  const subscriptionsRef = useRef<EventSubscription[]>([]);

  const updateSessionState = useCallback(
    (nextPhase: SpeechInputPhase, nextTarget: SpeechInputTarget | null) => {
      phaseRef.current = nextPhase;
      activeTargetRef.current = nextTarget;
      if (mountedRef.current) {
        setPhase(nextPhase);
        setActiveTarget(nextTarget);
      }
    },
    [],
  );

  const removeSubscriptions = useCallback(() => {
    for (const subscription of subscriptionsRef.current) subscription.remove();
    subscriptionsRef.current = [];
  }, []);

  const finishSession = useCallback(
    (session: number) => {
      if (sessionRef.current !== session) return;
      removeSubscriptions();
      moduleRef.current = null;
      updateSessionState('idle', null);
    },
    [removeSubscriptions, updateSessionState],
  );

  const failSession = useCallback(
    (session: number, target: SpeechInputTarget, message: string) => {
      if (sessionRef.current !== session) return;
      if (mountedRef.current) setError({ target, message });
      finishSession(session);
    },
    [finishSession],
  );

  const toggle = useCallback(
    async (target: SpeechInputTarget) => {
      if (phaseRef.current !== 'idle') {
        if (activeTargetRef.current === target) {
          if (moduleRef.current && phaseRef.current !== 'stopping') {
            updateSessionState('stopping', target);
            try {
              moduleRef.current.stop();
            } catch {
              failSession(sessionRef.current, target, '音声入力を停止できませんでした。もう一度お試しください。');
            }
          }
        }
        return;
      }

      const session = sessionRef.current + 1;
      sessionRef.current = session;
      updateSessionState('preparing', target);
      setError(null);
      Keyboard.dismiss();

      const existingText = target === 'quote' ? quote : comment;
      const setText = target === 'quote' ? setQuote : setComment;

      try {
        const speechModule = await loadSpeechModule();
        if (sessionRef.current !== session || !mountedRef.current) return;
        if (!speechModule) {
          failSession(
            session,
            target,
            'このアプリには音声入力機能が含まれていません。最新版のインストール版をご利用ください。',
          );
          return;
        }
        if (!speechModule.isRecognitionAvailable()) {
          failSession(
            session,
            target,
            'この端末では音声認識サービスを利用できません。Google 音声認識などを有効にしてください。',
          );
          return;
        }

        const permission = await speechModule.requestPermissionsAsync();
        if (sessionRef.current !== session || !mountedRef.current) return;
        if (!permission.granted) {
          failSession(
            session,
            target,
            'マイクの使用が許可されていません。端末の設定でマイクを許可してください。',
          );
          return;
        }

        moduleRef.current = speechModule;
        let receivedTranscript = false;
        subscriptionsRef.current = [
          speechModule.addListener('start', () => {
            if (sessionRef.current === session) updateSessionState('listening', target);
          }),
          speechModule.addListener('result', (event) => {
            if (sessionRef.current !== session) return;
            const transcript = event.results[0]?.transcript ?? '';
            if (!transcript.trim()) return;
            receivedTranscript = true;
            setText(appendSpeechTranscript(existingText, transcript));
          }),
          speechModule.addListener('nomatch', () => {
            if (sessionRef.current === session && !receivedTranscript && mountedRef.current) {
              setError({
                target,
                message: '音声を聞き取れませんでした。マイクに近づいて、もう一度お試しください。',
              });
            }
          }),
          speechModule.addListener('error', (event) => {
            if (sessionRef.current !== session) return;
            const message = speechInputErrorMessage(event.error as SpeechInputErrorCode);
            if (message && mountedRef.current) setError({ target, message });
            finishSession(session);
          }),
          speechModule.addListener('end', () => finishSession(session)),
        ];

        speechModule.start({
          lang: 'ja-JP',
          interimResults: true,
          continuous: false,
          maxAlternatives: 1,
          addsPunctuation: true,
          contextualStrings: contextualStrings.filter((text) => text.trim()).slice(0, 10),
        });
      } catch (cause) {
        const message = cause instanceof Error && cause.message.includes('permission')
          ? 'マイクの使用が許可されていません。端末の設定でマイクを許可してください。'
          : '音声入力を開始できませんでした。もう一度お試しください。';
        failSession(session, target, message);
      }
    },
    [
      comment,
      contextualStrings,
      failSession,
      finishSession,
      quote,
      setComment,
      setQuote,
      updateSessionState,
    ],
  );

  const clearError = useCallback((target?: SpeechInputTarget) => {
    setError((current) => (!target || current?.target === target ? null : current));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current += 1;
      removeSubscriptions();
      try {
        moduleRef.current?.abort();
      } catch {
        // 画面破棄時は認識サービス側の終了エラーを利用者へ見せない。
      }
      moduleRef.current = null;
    };
  }, [removeSubscriptions]);

  return {
    phase,
    activeTarget,
    error,
    toggle,
    clearError,
    isActive: (target: SpeechInputTarget) => activeTarget === target,
    isUnavailableWhileActive: (target: SpeechInputTarget) =>
      activeTarget !== null && activeTarget !== target,
  };
}
