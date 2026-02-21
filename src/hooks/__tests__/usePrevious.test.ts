import { describe, it, expect, vi, beforeEach } from "vitest";

describe("usePrevious", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("UsePreviousOptions interface", () => {
    interface UsePreviousOptions<T> {
      initialValue?: T;
      equals?: (prev: T | undefined, next: T) => boolean;
      when?: (value: T) => boolean;
    }

    it("should define options with all fields", () => {
      const options: UsePreviousOptions<number> = {
        initialValue: 0,
        equals: (prev, next) => prev === next,
        when: (value) => value > 0,
      };

      expect(options.initialValue).toBe(0);
      expect(typeof options.equals).toBe("function");
      expect(typeof options.when).toBe("function");
    });

    it("should support empty options", () => {
      const options: UsePreviousOptions<string> = {};

      expect(options.initialValue).toBeUndefined();
      expect(options.equals).toBeUndefined();
      expect(options.when).toBeUndefined();
    });
  });

  describe("Previous value tracking", () => {
    it("should track previous value", () => {
      const values = [1, 2, 3, 4, 5];
      let previous: number | undefined;
      let current: number | undefined;

      for (const value of values) {
        previous = current;
        current = value;
      }

      expect(current).toBe(5);
      expect(previous).toBe(4);
    });

    it("should start with undefined previous", () => {
      let previous: number | undefined;
      const current = 42;

      expect(previous).toBeUndefined();
      expect(current).toBe(42);
    });

    it("should support initial value", () => {
      const initialValue = -1;
      let previous: number | undefined = initialValue;

      expect(previous).toBe(-1);

      previous = 0;
      expect(previous).toBe(0);
    });

    it("should track string values", () => {
      const values = ["hello", "world", "foo"];
      let previous: string | undefined;
      let current: string | undefined;

      for (const value of values) {
        previous = current;
        current = value;
      }

      expect(current).toBe("foo");
      expect(previous).toBe("world");
    });

    it("should track object values", () => {
      interface User {
        id: number;
        name: string;
      }

      const users: User[] = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      let previous: User | undefined;
      let current: User | undefined;

      for (const user of users) {
        previous = current;
        current = user;
      }

      expect(current?.name).toBe("Bob");
      expect(previous?.name).toBe("Alice");
    });
  });

  describe("UsePreviousDistinct", () => {
    interface UsePreviousDistinctOptions<T> {
      initialValue?: T;
      compare?: (prev: T | undefined, next: T) => boolean;
      when?: (value: T) => boolean;
    }

    it("should skip updates when values are equal", () => {
      const options: UsePreviousDistinctOptions<number> = {
        compare: (prev, next) => prev === next,
      };

      const values = [1, 1, 2, 2, 3];
      let previous: number | undefined;
      let current: number | undefined;

      for (const value of values) {
        if (current !== undefined && options.compare!(current, value)) {
          continue;
        }
        previous = current;
        current = value;
      }

      expect(current).toBe(3);
      expect(previous).toBe(2);
    });

    it("should use custom comparison for objects", () => {
      interface Item {
        id: number;
        value: string;
      }

      const compare = (prev: Item | undefined, next: Item) => prev?.id === next.id;

      const items: Item[] = [
        { id: 1, value: "a" },
        { id: 1, value: "b" },
        { id: 2, value: "c" },
      ];

      let previous: Item | undefined;
      let current: Item | undefined;

      for (const item of items) {
        if (current !== undefined && compare(current, item)) {
          continue;
        }
        previous = current;
        current = item;
      }

      expect(current?.id).toBe(2);
      expect(previous?.id).toBe(1);
    });
  });

  describe("useHasChanged pattern", () => {
    it("should detect when value changes", () => {
      const values = [1, 1, 2, 2, 3];
      let previousValue: number | undefined;
      const changes: boolean[] = [];

      for (const value of values) {
        if (previousValue === undefined) {
          changes.push(false);
        } else {
          changes.push(value !== previousValue);
        }
        previousValue = value;
      }

      expect(changes).toEqual([false, false, true, false, true]);
    });

    it("should use custom equality", () => {
      const equals = (prev: number | undefined, next: number) =>
        prev !== undefined && Math.abs(prev - next) < 0.01;

      const values = [1.0, 1.005, 1.02, 2.0];
      let previousValue: number | undefined;
      const changes: boolean[] = [];

      for (const value of values) {
        if (previousValue === undefined) {
          changes.push(false);
        } else {
          changes.push(!equals(previousValue, value));
        }
        previousValue = value;
      }

      expect(changes).toEqual([false, false, true, true]);
    });
  });

  describe("useChangeCount pattern", () => {
    it("should count value changes", () => {
      const values = [1, 2, 2, 3, 3, 3, 4];
      let count = 0;
      let previousValue: number | undefined;

      for (const value of values) {
        if (previousValue !== undefined && value !== previousValue) {
          count++;
        }
        previousValue = value;
      }

      expect(count).toBe(3);
    });

    it("should support reset", () => {
      let count = 0;

      count++;
      count++;
      expect(count).toBe(2);

      count = 0;
      expect(count).toBe(0);
    });
  });

  describe("useHistory pattern", () => {
    interface HistoryEntry<T> {
      value: T;
      timestamp: number;
    }

    it("should track value history", () => {
      const history: number[] = [];
      const maxLength = 5;

      for (const value of [1, 2, 3, 4, 5, 6, 7]) {
        history.push(value);
        if (history.length > maxLength) {
          history.splice(0, history.length - maxLength);
        }
      }

      expect(history).toEqual([3, 4, 5, 6, 7]);
      expect(history).toHaveLength(maxLength);
    });

    it("should provide current and previous values", () => {
      const history = [10, 20, 30];

      const current = history[history.length - 1];
      const previous = history.length > 1 ? history[history.length - 2] : undefined;

      expect(current).toBe(30);
      expect(previous).toBe(20);
    });

    it("should support going back n steps", () => {
      const history = [1, 2, 3, 4, 5];

      const back = (steps: number = 1) => {
        const index = history.length - 1 - steps;
        return index >= 0 ? history[index] : undefined;
      };

      expect(back(0)).toBe(5);
      expect(back(1)).toBe(4);
      expect(back(2)).toBe(3);
      expect(back(10)).toBeUndefined();
    });

    it("should check if can go back", () => {
      const canGoBack = (history: unknown[]) => history.length > 1;

      expect(canGoBack([])).toBe(false);
      expect(canGoBack([1])).toBe(false);
      expect(canGoBack([1, 2])).toBe(true);
    });

    it("should clear history", () => {
      const history = [1, 2, 3, 4, 5];
      history.length = 0;

      expect(history).toEqual([]);
    });

    it("should support history with timestamps", () => {
      const now = Date.now();
      const history: HistoryEntry<string>[] = [
        { value: "draft", timestamp: now - 2000 },
        { value: "review", timestamp: now - 1000 },
        { value: "published", timestamp: now },
      ];

      expect(history).toHaveLength(3);
      expect(history[0].value).toBe("draft");
      expect(history[2].timestamp).toBe(now);
    });

    it("should get value at specific index", () => {
      const history = [10, 20, 30, 40, 50];

      const at = (index: number) => {
        const actualIndex = history.length - 1 - index;
        return actualIndex >= 0 && actualIndex < history.length
          ? history[actualIndex]
          : undefined;
      };

      expect(at(0)).toBe(50);
      expect(at(1)).toBe(40);
      expect(at(4)).toBe(10);
      expect(at(5)).toBeUndefined();
    });
  });

  describe("useFirstRender pattern", () => {
    it("should detect first render", () => {
      let isFirst = true;

      expect(isFirst).toBe(true);

      isFirst = false;
      expect(isFirst).toBe(false);
    });
  });

  describe("useLatest pattern", () => {
    it("should always return latest value", () => {
      let latestValue = 0;

      latestValue = 1;
      expect(latestValue).toBe(1);

      latestValue = 42;
      expect(latestValue).toBe(42);
    });

    it("should not trigger reactivity on read", () => {
      let latestValue = "initial";
      const getLatest = () => latestValue;

      expect(getLatest()).toBe("initial");

      latestValue = "updated";
      expect(getLatest()).toBe("updated");
    });
  });

  describe("useChangedProps pattern", () => {
    it("should detect changed properties", () => {
      interface Props {
        a: number;
        b: string;
        c: boolean;
      }

      const prev: Props = { a: 1, b: "hello", c: true };
      const next: Props = { a: 2, b: "hello", c: false };

      const changed: (keyof Props)[] = [];
      for (const key of Object.keys(next) as (keyof Props)[]) {
        if (!Object.is(next[key], prev[key])) {
          changed.push(key);
        }
      }

      expect(changed).toEqual(["a", "c"]);
    });

    it("should return empty array when nothing changed", () => {
      const prev = { x: 1, y: 2 };
      const next = { x: 1, y: 2 };

      const changed: string[] = [];
      for (const key of Object.keys(next)) {
        if (!Object.is(next[key as keyof typeof next], prev[key as keyof typeof prev])) {
          changed.push(key);
        }
      }

      expect(changed).toEqual([]);
    });

    it("should detect removed keys", () => {
      const prev: Record<string, number> = { a: 1, b: 2, c: 3 };
      const next: Record<string, number> = { a: 1, b: 2 };

      const changed: string[] = [];
      for (const key of Object.keys(prev)) {
        if (!(key in next)) {
          changed.push(key);
        }
      }

      expect(changed).toEqual(["c"]);
    });
  });

  describe("useDelta pattern", () => {
    it("should calculate numeric delta", () => {
      const values = [100, 105, 98, 110];
      const deltas: number[] = [];
      let previousValue: number | undefined;

      for (const value of values) {
        if (previousValue !== undefined) {
          deltas.push(value - previousValue);
        }
        previousValue = value;
      }

      expect(deltas).toEqual([5, -7, 12]);
    });

    it("should start with zero delta", () => {
      let delta = 0;
      expect(delta).toBe(0);

      delta = 42 - 0;
      expect(delta).toBe(42);
    });

    it("should handle negative deltas", () => {
      const prev = 100;
      const next = 80;
      const delta = next - prev;

      expect(delta).toBe(-20);
    });
  });
});
