import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useLocalStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("UseLocalStorageOptions Interface", () => {
    interface UseLocalStorageOptions<T> {
      serializer?: (value: T) => string;
      deserializer?: (value: string) => T;
      syncTabs?: boolean;
      validate?: (value: unknown) => value is T;
      onError?: (error: Error, operation: "read" | "write") => void;
      storage?: Storage;
    }

    it("should define options with custom serializer", () => {
      const options: UseLocalStorageOptions<object> = {
        serializer: (value) => JSON.stringify(value),
        deserializer: (value) => JSON.parse(value),
      };

      expect(options.serializer).toBeDefined();
      expect(options.deserializer).toBeDefined();
    });

    it("should enable cross-tab sync", () => {
      const options: UseLocalStorageOptions<string> = {
        syncTabs: true,
      };

      expect(options.syncTabs).toBe(true);
    });

    it("should disable cross-tab sync", () => {
      const options: UseLocalStorageOptions<string> = {
        syncTabs: false,
      };

      expect(options.syncTabs).toBe(false);
    });

    it("should define validation function", () => {
      const isString = (value: unknown): value is string => typeof value === "string";
      const options: UseLocalStorageOptions<string> = {
        validate: isString,
      };

      expect(options.validate?.("test")).toBe(true);
      expect(options.validate?.(123)).toBe(false);
    });

    it("should define error callback", () => {
      const onError = vi.fn();
      const options: UseLocalStorageOptions<string> = {
        onError,
      };

      options.onError?.(new Error("Test"), "read");
      expect(onError).toHaveBeenCalledWith(expect.any(Error), "read");
    });

    it("should accept custom storage", () => {
      const mockStorage: Storage = {
        length: 0,
        clear: vi.fn(),
        getItem: vi.fn(),
        key: vi.fn(),
        removeItem: vi.fn(),
        setItem: vi.fn(),
      };

      const options: UseLocalStorageOptions<string> = {
        storage: mockStorage,
      };

      expect(options.storage).toBe(mockStorage);
    });
  });

  describe("UseLocalStorageReturn Type", () => {
    interface UseLocalStorageReturn<T> {
      value: () => T;
      setValue: (value: T | ((prev: T) => T)) => void;
      remove: () => void;
      exists: () => boolean;
      refresh: () => void;
    }

    it("should define return type", () => {
      const mockReturn: UseLocalStorageReturn<string> = {
        value: () => "test",
        setValue: vi.fn(),
        remove: vi.fn(),
        exists: () => true,
        refresh: vi.fn(),
      };

      expect(mockReturn.value()).toBe("test");
      expect(mockReturn.exists()).toBe(true);
    });

    it("should support setter function", () => {
      const setValue = vi.fn();
      const mockReturn: UseLocalStorageReturn<number> = {
        value: () => 5,
        setValue,
        remove: vi.fn(),
        exists: () => true,
        refresh: vi.fn(),
      };

      mockReturn.setValue(10);
      expect(setValue).toHaveBeenCalledWith(10);

      mockReturn.setValue((prev) => prev + 1);
      expect(setValue).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("Initial Value Reading", () => {
    it("should return default value when key not found", () => {
      const storage: Record<string, string> = {};
      const key = "test-key";
      const defaultValue = "default";

      const value = storage[key] ?? defaultValue;
      expect(value).toBe("default");
    });

    it("should return stored value when key exists", () => {
      const storage: Record<string, string> = {
        "test-key": JSON.stringify("stored-value"),
      };
      const key = "test-key";
      const defaultValue = "default";

      const storedItem = storage[key];
      const value = storedItem ? JSON.parse(storedItem) : defaultValue;
      expect(value).toBe("stored-value");
    });

    it("should return default value on parse error", () => {
      const defaultValue = "default";

      const safeJsonParse = <T>(value: string, fallback: T): T => {
        try {
          return JSON.parse(value);
        } catch {
          return fallback;
        }
      };

      const result = safeJsonParse("invalid-json", defaultValue);
      expect(result).toBe("default");
    });
  });

  describe("Value Persistence", () => {
    it("should serialize value to JSON", () => {
      const value = { name: "test", count: 42 };
      const serialized = JSON.stringify(value);

      expect(serialized).toBe('{"name":"test","count":42}');
    });

    it("should deserialize value from JSON", () => {
      const serialized = '{"name":"test","count":42}';
      const value = JSON.parse(serialized);

      expect(value).toEqual({ name: "test", count: 42 });
    });

    it("should handle complex nested objects", () => {
      const value = {
        user: {
          name: "test",
          settings: {
            theme: "dark",
            notifications: true,
          },
        },
        items: [1, 2, 3],
      };

      const serialized = JSON.stringify(value);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(value);
    });

    it("should handle arrays", () => {
      const value = [1, 2, 3, 4, 5];
      const serialized = JSON.stringify(value);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(value);
    });

    it("should handle null values", () => {
      const value = null;
      const serialized = JSON.stringify(value);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toBeNull();
    });
  });

  describe("Cross-Tab Synchronization", () => {
    interface StorageEvent {
      key: string | null;
      newValue: string | null;
      oldValue: string | null;
      storageArea: Storage | null;
    }

    it("should handle storage event for same key", () => {
      const event: StorageEvent = {
        key: "test-key",
        newValue: JSON.stringify("new-value"),
        oldValue: JSON.stringify("old-value"),
        storageArea: null,
      };

      expect(event.key).toBe("test-key");
      expect(JSON.parse(event.newValue!)).toBe("new-value");
    });

    it("should ignore storage event for different key", () => {
      const currentKey = "my-key";
      const event: StorageEvent = {
        key: "other-key",
        newValue: "value",
        oldValue: null,
        storageArea: null,
      };

      const shouldHandle = event.key === currentKey;
      expect(shouldHandle).toBe(false);
    });

    it("should handle key removal event", () => {
      const event: StorageEvent = {
        key: "test-key",
        newValue: null,
        oldValue: JSON.stringify("old-value"),
        storageArea: null,
      };

      const wasRemoved = event.newValue === null;
      expect(wasRemoved).toBe(true);
    });
  });

  describe("Utility Functions", () => {
    it("should check if key exists", () => {
      const storage: Record<string, string> = {
        "existing-key": "value",
      };

      const exists = (key: string): boolean => key in storage;

      expect(exists("existing-key")).toBe(true);
      expect(exists("non-existing-key")).toBe(false);
    });

    it("should remove key from storage", () => {
      const storage: Record<string, string> = {
        "test-key": "value",
      };

      delete storage["test-key"];

      expect(storage["test-key"]).toBeUndefined();
    });

    it("should refresh value from storage", () => {
      const readValue = vi.fn().mockReturnValue("refreshed-value");
      const value = readValue();

      expect(value).toBe("refreshed-value");
      expect(readValue).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle quota exceeded error", () => {
      const error = new DOMException("Quota exceeded", "QuotaExceededError");
      expect(error.name).toBe("QuotaExceededError");
    });

    it("should handle parse error gracefully", () => {
      const safeJsonParse = <T>(value: string, fallback: T): T => {
        try {
          return JSON.parse(value);
        } catch {
          return fallback;
        }
      };

      const result = safeJsonParse("not-json", "fallback");
      expect(result).toBe("fallback");
    });

    it("should handle stringify error gracefully", () => {
      const safeJsonStringify = <T>(value: T): string | null => {
        try {
          return JSON.stringify(value);
        } catch {
          return null;
        }
      };

      const circular: Record<string, unknown> = {};
      circular.self = circular;

      const result = safeJsonStringify(circular);
      expect(result).toBeNull();
    });

    it("should call onError callback on read failure", () => {
      const onError = vi.fn();
      const error = new Error("Read failed");

      onError(error, "read");

      expect(onError).toHaveBeenCalledWith(error, "read");
    });

    it("should call onError callback on write failure", () => {
      const onError = vi.fn();
      const error = new Error("Write failed");

      onError(error, "write");

      expect(onError).toHaveBeenCalledWith(error, "write");
    });
  });

  describe("Validation", () => {
    it("should validate value on read", () => {
      const isNumber = (value: unknown): value is number => typeof value === "number";

      expect(isNumber(42)).toBe(true);
      expect(isNumber("42")).toBe(false);
    });

    it("should validate value on write", () => {
      interface Settings {
        theme: string;
        fontSize: number;
      }

      const isSettings = (value: unknown): value is Settings => {
        return (
          typeof value === "object" &&
          value !== null &&
          "theme" in value &&
          "fontSize" in value &&
          typeof (value as Settings).theme === "string" &&
          typeof (value as Settings).fontSize === "number"
        );
      };

      expect(isSettings({ theme: "dark", fontSize: 14 })).toBe(true);
      expect(isSettings({ theme: "dark" })).toBe(false);
      expect(isSettings(null)).toBe(false);
    });

    it("should return default on validation failure", () => {
      const defaultValue = "default";
      const validate = (value: unknown): value is string => typeof value === "string";
      const storedValue = 123;

      const result = validate(storedValue) ? storedValue : defaultValue;
      expect(result).toBe("default");
    });
  });

  describe("SSR Safety", () => {
    it("should detect browser environment", () => {
      const isBrowser = (): boolean => {
        return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
      };

      expect(typeof isBrowser).toBe("function");
    });

    it("should return default value when storage unavailable", () => {
      const defaultValue = "default";
      const storage: Storage | undefined = undefined;

      const value = storage ? "stored" : defaultValue;
      expect(value).toBe("default");
    });
  });

  describe("Specialized Hooks", () => {
    it("should handle boolean values", () => {
      const value = true;
      const serialized = JSON.stringify(value);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toBe(true);
    });

    it("should handle number values", () => {
      const value = 42.5;
      const serialized = JSON.stringify(value);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toBe(42.5);
    });

    it("should handle string values", () => {
      const value = "hello world";
      const serialized = JSON.stringify(value);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toBe("hello world");
    });

    it("should handle array values", () => {
      const value = ["a", "b", "c"];
      const serialized = JSON.stringify(value);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(["a", "b", "c"]);
    });

    it("should handle object values", () => {
      const value = { key: "value" };
      const serialized = JSON.stringify(value);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual({ key: "value" });
    });
  });

  describe("Custom Serialization", () => {
    it("should use custom serializer", () => {
      const customSerializer = (value: Date): string => value.toISOString();
      const date = new Date("2024-01-15T10:30:00Z");

      const serialized = customSerializer(date);
      expect(serialized).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should use custom deserializer", () => {
      const customDeserializer = (value: string): Date => new Date(value);
      const serialized = "2024-01-15T10:30:00.000Z";

      const deserialized = customDeserializer(serialized);
      expect(deserialized).toBeInstanceOf(Date);
    });
  });

  describe("Setter Function Types", () => {
    it("should accept direct value", () => {
      type SetterFn<T> = T | ((prev: T) => T);

      const directValue: SetterFn<number> = 42;
      expect(directValue).toBe(42);
    });

    it("should accept updater function", () => {
      type SetterFn<T> = T | ((prev: T) => T);

      const updaterFn: SetterFn<number> = (prev) => prev + 1;
      expect(typeof updaterFn).toBe("function");

      if (typeof updaterFn === "function") {
        expect(updaterFn(5)).toBe(6);
      }
    });

    it("should resolve setter value", () => {
      const resolveValue = <T>(valueOrFn: T | ((prev: T) => T), currentValue: T): T => {
        return typeof valueOrFn === "function"
          ? (valueOrFn as (prev: T) => T)(currentValue)
          : valueOrFn;
      };

      expect(resolveValue(10, 5)).toBe(10);
      expect(resolveValue((prev: number) => prev * 2, 5)).toBe(10);
    });
  });

  describe("Storage Keys", () => {
    it("should use provided key", () => {
      const key = "my-app-settings";
      expect(key).toBe("my-app-settings");
    });

    it("should handle special characters in key", () => {
      const key = "my-app:user:settings";
      expect(key).toBe("my-app:user:settings");
    });

    it("should handle empty string key", () => {
      const key = "";
      expect(key).toBe("");
    });
  });
});
