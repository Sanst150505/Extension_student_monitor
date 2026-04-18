import { useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
      confidence?: number;
    };
  }>;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function useVoiceAnalysis() {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [avgVolume, setAvgVolume] = useState(0);
  const [peakVolume, setPeakVolume] = useState(0);
  const [speakingDuration, setSpeakingDuration] = useState(0);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const samplesRef = useRef<number[]>([]);

  useEffect(() => {
    setIsSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition) && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  const stopAudioGraph = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    stopAudioGraph();
    setIsListening(false);
    setStatus("stopped");
  };

  const startListening = async () => {
    setError("");
    setTranscript("");
    setConfidence(0);
    setAvgVolume(0);
    setPeakVolume(0);
    setSpeakingDuration(0);
    samplesRef.current = [];

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice analysis is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const mean = data.reduce((sum, value) => sum + value, 0) / Math.max(data.length, 1) / 255;
        samplesRef.current.push(mean);
        setAvgVolume(samplesRef.current.reduce((sum, value) => sum + value, 0) / samplesRef.current.length);
        setPeakVolume((current) => Math.max(current, mean));
        setSpeakingDuration((Date.now() - startedAtRef.current) / 1000);
        rafRef.current = requestAnimationFrame(tick);
      };

      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";
      recognition.onresult = (event) => {
        let finalTranscript = "";
        let bestConfidence = 0;
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          const alt = result[0];
          finalTranscript += `${alt.transcript} `;
          bestConfidence = Math.max(bestConfidence, alt.confidence ?? 0);
        }
        setTranscript(finalTranscript.trim());
        setConfidence(bestConfidence);
        setStatus("listening");
      };
      recognition.onerror = (event) => {
        setError(event.error || "Voice analysis failed.");
        setStatus("error");
      };
      recognition.onend = () => {
        stopAudioGraph();
        setIsListening(false);
        setStatus((current) => (current === "error" ? current : "stopped"));
      };

      recognitionRef.current = recognition;
      startedAtRef.current = Date.now();
      setIsListening(true);
      setStatus("listening");
      recognition.start();
      tick();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone permission is required.");
      setStatus("error");
      stopAudioGraph();
    }
  };

  useEffect(() => () => {
    recognitionRef.current?.stop();
    stopAudioGraph();
  }, []);

  const voiceScore = Math.min(
    100,
    Math.round(
      Math.min(transcript.split(/\s+/).filter(Boolean).length * 4, 40) +
        Math.min(speakingDuration * 6, 30) +
        Math.min(avgVolume * 100, 20) +
        Math.min(confidence * 10, 10),
    ),
  );

  return {
    isSupported,
    isListening,
    transcript,
    confidence,
    avgVolume,
    peakVolume,
    speakingDuration,
    voiceScore,
    status,
    error,
    startListening,
    stopListening,
  };
}
