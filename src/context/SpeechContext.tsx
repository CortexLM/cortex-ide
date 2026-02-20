import { createContext, useContext, ParentProps, onCleanup, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";

// ============================================================================
// Web Speech API Type Definitions
// ============================================================================

/**
 * Speech recognition result item containing transcript and confidence
 */
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

/**
 * Single result from speech recognition, can have multiple alternatives
 */
interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

/**
 * List of speech recognition results
 */
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

/**
 * Event fired when speech recognition produces results
 */
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

/**
 * Event fired when speech recognition encounters an error
 */
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

/**
 * Web Speech API SpeechRecognition interface
 */
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  
  // Methods
  start(): void;
  stop(): void;
  abort(): void;
  
  // Event handlers
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

/**
 * SpeechRecognition constructor type
 */
interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

/**
 * Extended Window interface with Web Speech API
 */
interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

/**
 * Supported speech recognition languages
 */
export type SpeechLanguage =
  | "en-US"
  | "en-GB"
  | "es-ES"
  | "fr-FR"
  | "de-DE"
  | "it-IT"
  | "pt-BR"
  | "zh-CN"
  | "ja-JP"
  | "ko-KR"
  | "ru-RU"
  | "ar-SA";

/**
 * Speech recognition error types
 */
export type SpeechErrorType =
  | "no-speech"
  | "audio-capture"
  | "not-allowed"
  | "network"
  | "aborted"
  | "service-not-allowed"
  | "bad-grammar"
  | "language-not-supported"
  | "unknown";

/**
 * Current state of speech recognition
 */
export interface SpeechState {
  /** Whether speech recognition is currently active */
  isListening: boolean;
  /** Whether the browser supports Web Speech API */
  isSupported: boolean;
  /** Current interim transcript (may change as speech continues) */
  interimTranscript: string;
  /** Final confirmed transcript */
  finalTranscript: string;
  /** Combined transcript (final + interim) */
  transcript: string;
  /** Current audio input level (0-1) */
  audioLevel: number;
  /** Current recognition language */
  language: SpeechLanguage;
  /** Error state, if any */
  error: SpeechErrorType | null;
  /** Error message for display */
  errorMessage: string | null;
  /** Whether recognition is in the process of starting */
  isStarting: boolean;
}

/**
 * Speech context value providing state and actions
 */
export interface SpeechContextValue {
  /** Current speech recognition state */
  state: SpeechState;
  /** Start listening for speech input */
  startListening: () => void;
  /** Stop listening for speech input */
  stopListening: () => void;
  /** Toggle listening state */
  toggleListening: () => void;
  /** Clear the current transcript */
  clearTranscript: () => void;
  /** Set the recognition language */
  setLanguage: (language: SpeechLanguage) => void;
  /** Get available languages */
  getAvailableLanguages: () => { code: SpeechLanguage; name: string }[];
}

const SpeechContext = createContext<SpeechContextValue>();

/**
 * Map of language codes to display names
 */
const LANGUAGE_NAMES: Record<SpeechLanguage, string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "es-ES": "Spanish (Spain)",
  "fr-FR": "French (France)",
  "de-DE": "German (Germany)",
  "it-IT": "Italian (Italy)",
  "pt-BR": "Portuguese (Brazil)",
  "zh-CN": "Chinese (Simplified)",
  "ja-JP": "Japanese",
  "ko-KR": "Korean",
  "ru-RU": "Russian",
  "ar-SA": "Arabic (Saudi Arabia)",
};

/**
 * Map SpeechRecognitionError codes to our error types
 */
function mapSpeechError(error: string): SpeechErrorType {
  const errorMap: Record<string, SpeechErrorType> = {
    "no-speech": "no-speech",
    "audio-capture": "audio-capture",
    "not-allowed": "not-allowed",
    "network": "network",
    "aborted": "aborted",
    "service-not-allowed": "service-not-allowed",
    "bad-grammar": "bad-grammar",
    "language-not-supported": "language-not-supported",
  };
  return errorMap[error] || "unknown";
}

/**
 * Get human-readable error message
 */
function getErrorMessage(error: SpeechErrorType): string {
  const messages: Record<SpeechErrorType, string> = {
    "no-speech": "No speech was detected. Please try again.",
    "audio-capture": "No microphone was found or microphone is not working.",
    "not-allowed": "Microphone permission was denied. Please allow microphone access.",
    "network": "Network error occurred. Please check your connection.",
    "aborted": "Speech recognition was aborted.",
    "service-not-allowed": "Speech recognition service is not allowed.",
    "bad-grammar": "Speech grammar error occurred.",
    "language-not-supported": "Selected language is not supported.",
    "unknown": "An unknown error occurred.",
  };
  return messages[error];
}

/**
 * Check if Web Speech API is supported
 */
function isSpeechRecognitionSupported(): boolean {
  const win = window as WindowWithSpeech;
  return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
}

/**
 * Get SpeechRecognition constructor (handles vendor prefixes)
 */
function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const win = window as WindowWithSpeech;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

/**
 * SpeechProvider component that provides speech recognition functionality
 */
export function SpeechProvider(props: ParentProps) {
  const isSupported = isSpeechRecognitionSupported();
  
  const [state, setState] = createStore<SpeechState>({
    isListening: false,
    isSupported,
    interimTranscript: "",
    finalTranscript: "",
    transcript: "",
    audioLevel: 0,
    language: "en-US",
    error: null,
    errorMessage: null,
    isStarting: false,
  });

  let recognition: SpeechRecognition | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let microphone: MediaStreamAudioSourceNode | null = null;
  let mediaStream: MediaStream | null = null;
  let animationFrameId: number | null = null;

  /**
   * Initialize audio level monitoring
   */
  const initAudioLevelMonitoring = async (): Promise<void> => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      microphone = audioContext.createMediaStreamSource(mediaStream);
      microphone.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyser || !state.isListening) {
          setState("audioLevel", 0);
          return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate RMS (root mean square) for audio level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalizedLevel = Math.min(1, rms / 128);
        
        setState("audioLevel", normalizedLevel);
        
        if (state.isListening) {
          animationFrameId = requestAnimationFrame(updateLevel);
        }
      };
      
      updateLevel();
    } catch (err) {
      console.error("Failed to initialize audio monitoring:", err);
    }
  };

  /**
   * Cleanup audio monitoring resources
   */
  const cleanupAudioMonitoring = () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    if (microphone) {
      microphone.disconnect();
      microphone = null;
    }
    
    if (audioContext) {
      audioContext.close().catch(console.error);
      audioContext = null;
    }
    
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    
    analyser = null;
    setState("audioLevel", 0);
  };

  /**
   * Initialize speech recognition instance
   */
  const initRecognition = (): SpeechRecognition | null => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return null;

    const instance = new SpeechRecognitionClass();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = state.language;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      setState(
        produce((s) => {
          s.isListening = true;
          s.isStarting = false;
          s.error = null;
          s.errorMessage = null;
        })
      );
    };

    instance.onend = () => {
      setState(
        produce((s) => {
          s.isListening = false;
          s.isStarting = false;
        })
      );
      cleanupAudioMonitoring();
      
      // Auto-restart if it ended unexpectedly while we wanted to keep listening
      // (browser may stop after silence)
    };

    instance.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorType = mapSpeechError(event.error);
      setState(
        produce((s) => {
          s.error = errorType;
          s.errorMessage = getErrorMessage(errorType);
          s.isListening = false;
          s.isStarting = false;
        })
      );
      cleanupAudioMonitoring();
    };

    instance.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = state.finalTranscript;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcriptText + " ";
        } else {
          interimTranscript += transcriptText;
        }
      }

      setState(
        produce((s) => {
          s.interimTranscript = interimTranscript;
          s.finalTranscript = finalTranscript;
          s.transcript = (finalTranscript + interimTranscript).trim();
        })
      );
    };

    instance.onsoundstart = () => {
      // Sound detected - could be used for UI feedback
    };

    instance.onsoundend = () => {
      // Sound ended - could be used for UI feedback
    };

    return instance;
  };

  /**
   * Start listening for speech
   */
  const startListening = () => {
    if (!isSupported) {
      setState(
        produce((s) => {
          s.error = "unknown";
          s.errorMessage = "Speech recognition is not supported in this browser.";
        })
      );
      return;
    }

    if (state.isListening || state.isStarting) return;

    setState("isStarting", true);

    // Clear any previous error
    setState(
      produce((s) => {
        s.error = null;
        s.errorMessage = null;
      })
    );

    // Initialize fresh recognition instance
    recognition = initRecognition();
    if (!recognition) {
      setState(
        produce((s) => {
          s.error = "unknown";
          s.errorMessage = "Failed to initialize speech recognition.";
          s.isStarting = false;
        })
      );
      return;
    }

    // Start audio level monitoring
    initAudioLevelMonitoring();

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setState(
        produce((s) => {
          s.error = "unknown";
          s.errorMessage = "Failed to start speech recognition.";
          s.isStarting = false;
        })
      );
      cleanupAudioMonitoring();
    }
  };

  /**
   * Stop listening for speech
   */
  const stopListening = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {
        console.error("Error stopping recognition:", err);
      }
      recognition = null;
    }

    setState(
      produce((s) => {
        s.isListening = false;
        s.isStarting = false;
      })
    );

    cleanupAudioMonitoring();
  };

  /**
   * Toggle listening state
   */
  const toggleListening = () => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  /**
   * Clear the transcript
   */
  const clearTranscript = () => {
    setState(
      produce((s) => {
        s.interimTranscript = "";
        s.finalTranscript = "";
        s.transcript = "";
      })
    );
  };

  /**
   * Set recognition language
   */
  const setLanguage = (language: SpeechLanguage) => {
    setState("language", language);
    
    // If currently listening, restart with new language
    if (state.isListening) {
      stopListening();
      // Small delay to ensure clean restart
      setTimeout(() => {
        startListening();
      }, 100);
    }
  };

  /**
   * Get available languages
   */
  const getAvailableLanguages = () => {
    return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
      code: code as SpeechLanguage,
      name,
    }));
  };

  // Register global keyboard shortcut (Ctrl+Alt+V)
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        toggleListening();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Cleanup on unmount - wrap in onMount for proper reactive context
  onMount(() => {
    onCleanup(() => {
      stopListening();
      cleanupAudioMonitoring();
    });
  });

  const contextValue: SpeechContextValue = {
    state,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    setLanguage,
    getAvailableLanguages,
  };

  return (
    <SpeechContext.Provider value={contextValue}>
      {props.children}
    </SpeechContext.Provider>
  );
}

/**
 * Hook to access speech recognition functionality
 * @throws Error if used outside of SpeechProvider
 */
export function useSpeech(): SpeechContextValue {
  const ctx = useContext(SpeechContext);
  if (!ctx) {
    throw new Error("useSpeech must be used within SpeechProvider");
  }
  return ctx;
}
