import { useState, useRef, useCallback, useEffect } from 'react';

/** Web Speech API 全局类型声明 */
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

/** Web Speech API 类型声明 */
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare const SpeechRecognition: new () => SpeechRecognitionInstance;
declare const webkitSpeechRecognition: new () => SpeechRecognitionInstance;

export interface SpeechResult {
  /** 是否正在录音 */
  isListening: boolean;
  /** 最终识别文本 */
  transcript: string;
  /** 中间识别文本（实时滚动） */
  interimText: string;
  /** 浏览器是否支持 */
  isSupported: boolean;
  /** 开始录音 */
  start: () => Promise<void>;
  /** 停止录音 */
  stop: () => void;
}

export function useSpeechRecognition(onComplete?: (text: string) => void): SpeechResult {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');

  const isSupported = Boolean(
    typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition),
  );

  // 清理
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) return;

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Ctor();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalText) {
        setTranscript(finalText);
      }
      if (interim) {
        setInterimText(interim);
      }
    };

    recognition.onerror = (_event: SpeechRecognitionErrorEvent) => {
      // 忽略用户主动停止触发的 error
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      const fullText = (transcript + interimText).trim();
      if (fullText && onComplete) {
        onComplete(fullText);
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript('');
    setInterimText('');
  }, [isSupported, onComplete, transcript, interimText]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { isListening, transcript, interimText, isSupported, start, stop };
}
