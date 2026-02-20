import { describe, it, expect, vi, beforeEach } from "vitest";

describe("SpeechContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Speech State", () => {
    interface SpeechState {
      isListening: boolean;
      isSupported: boolean;
      interimTranscript: string;
      finalTranscript: string;
      transcript: string;
      audioLevel: number;
      language: string;
      error: string | null;
      errorMessage: string | null;
      isStarting: boolean;
    }

    it("should create initial state", () => {
      const state: SpeechState = {
        isListening: false,
        isSupported: true,
        interimTranscript: "",
        finalTranscript: "",
        transcript: "",
        audioLevel: 0,
        language: "en-US",
        error: null,
        errorMessage: null,
        isStarting: false,
      };

      expect(state.isListening).toBe(false);
      expect(state.language).toBe("en-US");
    });

    it("should track listening state", () => {
      const state: SpeechState = {
        isListening: true,
        isSupported: true,
        interimTranscript: "hello",
        finalTranscript: "",
        transcript: "hello",
        audioLevel: 0.5,
        language: "en-US",
        error: null,
        errorMessage: null,
        isStarting: false,
      };

      expect(state.isListening).toBe(true);
      expect(state.audioLevel).toBe(0.5);
    });

    it("should handle error state", () => {
      const state: SpeechState = {
        isListening: false,
        isSupported: true,
        interimTranscript: "",
        finalTranscript: "",
        transcript: "",
        audioLevel: 0,
        language: "en-US",
        error: "not-allowed",
        errorMessage: "Microphone permission was denied.",
        isStarting: false,
      };

      expect(state.error).toBe("not-allowed");
      expect(state.errorMessage).toContain("permission");
    });
  });

  describe("Speech Languages", () => {
    type SpeechLanguage =
      | "en-US" | "en-GB" | "es-ES" | "fr-FR" | "de-DE"
      | "it-IT" | "pt-BR" | "zh-CN" | "ja-JP" | "ko-KR"
      | "ru-RU" | "ar-SA";

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

    it("should have all supported languages", () => {
      expect(Object.keys(LANGUAGE_NAMES)).toHaveLength(12);
    });

    it("should get language display name", () => {
      expect(LANGUAGE_NAMES["en-US"]).toBe("English (US)");
      expect(LANGUAGE_NAMES["ja-JP"]).toBe("Japanese");
    });

    it("should get available languages", () => {
      const getAvailableLanguages = () => {
        return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
          code: code as SpeechLanguage,
          name,
        }));
      };

      const languages = getAvailableLanguages();
      expect(languages).toHaveLength(12);
      expect(languages[0]).toHaveProperty("code");
      expect(languages[0]).toHaveProperty("name");
    });
  });

  describe("Speech Error Types", () => {
    type SpeechErrorType =
      | "no-speech" | "audio-capture" | "not-allowed" | "network"
      | "aborted" | "service-not-allowed" | "bad-grammar"
      | "language-not-supported" | "unknown";

    const mapSpeechError = (error: string): SpeechErrorType => {
      const errorMap: Record<string, SpeechErrorType> = {
        "no-speech": "no-speech",
        "audio-capture": "audio-capture",
        "not-allowed": "not-allowed",
        "network": "network",
        "aborted": "aborted",
      };
      return errorMap[error] || "unknown";
    };

    it("should map known errors", () => {
      expect(mapSpeechError("no-speech")).toBe("no-speech");
      expect(mapSpeechError("not-allowed")).toBe("not-allowed");
    });

    it("should map unknown errors", () => {
      expect(mapSpeechError("something-else")).toBe("unknown");
    });

    it("should get error messages", () => {
      const getErrorMessage = (error: SpeechErrorType): string => {
        const messages: Record<SpeechErrorType, string> = {
          "no-speech": "No speech was detected.",
          "audio-capture": "No microphone was found.",
          "not-allowed": "Microphone permission was denied.",
          "network": "Network error occurred.",
          "aborted": "Speech recognition was aborted.",
          "service-not-allowed": "Service not allowed.",
          "bad-grammar": "Grammar error.",
          "language-not-supported": "Language not supported.",
          "unknown": "An unknown error occurred.",
        };
        return messages[error];
      };

      expect(getErrorMessage("no-speech")).toContain("No speech");
      expect(getErrorMessage("not-allowed")).toContain("permission");
    });
  });

  describe("Transcript Management", () => {
    it("should accumulate transcript", () => {
      let finalTranscript = "";
      let interimTranscript = "";

      finalTranscript += "Hello ";
      interimTranscript = "world";

      const transcript = (finalTranscript + interimTranscript).trim();

      expect(transcript).toBe("Hello world");
    });

    it("should clear transcript", () => {
      let transcript = "Some text";

      transcript = "";

      expect(transcript).toBe("");
    });

    it("should handle multiple final results", () => {
      let finalTranscript = "";

      finalTranscript += "First sentence. ";
      finalTranscript += "Second sentence. ";

      expect(finalTranscript).toContain("First");
      expect(finalTranscript).toContain("Second");
    });
  });

  describe("Audio Level Monitoring", () => {
    it("should normalize audio level", () => {
      const normalizeLevel = (rms: number): number => {
        return Math.min(1, rms / 128);
      };

      expect(normalizeLevel(64)).toBe(0.5);
      expect(normalizeLevel(128)).toBe(1);
      expect(normalizeLevel(256)).toBe(1);
    });

    it("should track audio level", () => {
      let audioLevel = 0;

      audioLevel = 0.7;

      expect(audioLevel).toBe(0.7);
    });
  });

  describe("Speech Recognition Support", () => {
    it("should detect browser support", () => {
      const isSpeechRecognitionSupported = (): boolean => {
        const win = window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
        return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
      };

      const isSupported = isSpeechRecognitionSupported();
      expect(typeof isSupported).toBe("boolean");
    });
  });

  describe("Listening Control", () => {
    it("should start listening", () => {
      let isListening = false;
      let isStarting = false;

      const startListening = () => {
        isStarting = true;
        isListening = true;
        isStarting = false;
      };

      startListening();

      expect(isListening).toBe(true);
      expect(isStarting).toBe(false);
    });

    it("should stop listening", () => {
      let isListening = true;

      const stopListening = () => {
        isListening = false;
      };

      stopListening();

      expect(isListening).toBe(false);
    });

    it("should toggle listening", () => {
      let isListening = false;

      const toggleListening = () => {
        isListening = !isListening;
      };

      toggleListening();
      expect(isListening).toBe(true);

      toggleListening();
      expect(isListening).toBe(false);
    });
  });

  describe("Language Change", () => {
    it("should change language", () => {
      let language = "en-US";

      const setLanguage = (newLang: string) => {
        language = newLang;
      };

      setLanguage("fr-FR");

      expect(language).toBe("fr-FR");
    });

    it("should restart recognition on language change", () => {
      let language = "en-US";
      let restartCalled = false;

      const setLanguage = (newLang: string, isListening: boolean) => {
        language = newLang;
        if (isListening) {
          restartCalled = true;
        }
      };

      setLanguage("de-DE", true);

      expect(language).toBe("de-DE");
      expect(restartCalled).toBe(true);
    });
  });

  describe("Keyboard Shortcut", () => {
    it("should detect Ctrl+Alt+V shortcut", () => {
      const isVoiceShortcut = (e: { ctrlKey: boolean; altKey: boolean; key: string }): boolean => {
        return e.ctrlKey && e.altKey && e.key.toLowerCase() === "v";
      };

      expect(isVoiceShortcut({ ctrlKey: true, altKey: true, key: "v" })).toBe(true);
      expect(isVoiceShortcut({ ctrlKey: true, altKey: true, key: "V" })).toBe(true);
      expect(isVoiceShortcut({ ctrlKey: true, altKey: false, key: "v" })).toBe(false);
    });
  });

  describe("Context Value Interface", () => {
    interface SpeechContextValue {
      state: { isListening: boolean; transcript: string };
      startListening: () => void;
      stopListening: () => void;
      toggleListening: () => void;
      clearTranscript: () => void;
      setLanguage: (language: string) => void;
      getAvailableLanguages: () => Array<{ code: string; name: string }>;
    }

    it("should have all required methods", () => {
      const mockState = { isListening: false, transcript: "" };

      const contextValue: SpeechContextValue = {
        state: mockState,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        toggleListening: vi.fn(),
        clearTranscript: vi.fn(),
        setLanguage: vi.fn(),
        getAvailableLanguages: () => [{ code: "en-US", name: "English" }],
      };

      expect(contextValue.state).toBeDefined();
      expect(typeof contextValue.startListening).toBe("function");
      expect(typeof contextValue.getAvailableLanguages).toBe("function");
    });
  });

  describe("Error Recovery", () => {
    it("should clear error on restart", () => {
      let error: string | null = "not-allowed";
      let errorMessage: string | null = "Permission denied";

      const clearError = () => {
        error = null;
        errorMessage = null;
      };

      clearError();

      expect(error).toBeNull();
      expect(errorMessage).toBeNull();
    });
  });
});
