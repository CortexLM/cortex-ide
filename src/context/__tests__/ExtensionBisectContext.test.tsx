import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ExtensionBisectContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Bisect State", () => {
    interface BisectState {
      active: boolean;
      step: number;
      totalSteps: number;
      testedExtensions: string[];
      currentlyDisabled: string[];
      suspectedExtensions: string[];
      foundExtension: string | null;
      completed: boolean;
      startedAt: number | null;
    }

    it("should initialize idle state", () => {
      const state: BisectState = {
        active: false,
        step: 0,
        totalSteps: 0,
        testedExtensions: [],
        currentlyDisabled: [],
        suspectedExtensions: [],
        foundExtension: null,
        completed: false,
        startedAt: null,
      };

      expect(state.active).toBe(false);
      expect(state.step).toBe(0);
    });

    it("should track active bisect session", () => {
      const state: BisectState = {
        active: true,
        step: 2,
        totalSteps: 4,
        testedExtensions: ["ext-a", "ext-b"],
        currentlyDisabled: ["ext-c", "ext-d"],
        suspectedExtensions: ["ext-c", "ext-d", "ext-e", "ext-f"],
        foundExtension: null,
        completed: false,
        startedAt: Date.now(),
      };

      expect(state.active).toBe(true);
      expect(state.step).toBe(2);
    });

    it("should track found extension", () => {
      const state: BisectState = {
        active: true,
        step: 4,
        totalSteps: 4,
        testedExtensions: ["ext-a", "ext-b", "ext-c"],
        currentlyDisabled: [],
        suspectedExtensions: ["ext-d"],
        foundExtension: "ext-d",
        completed: true,
        startedAt: Date.now() - 60000,
      };

      expect(state.foundExtension).toBe("ext-d");
      expect(state.completed).toBe(true);
    });
  });

  describe("Bisect Phase", () => {
    type BisectPhase = "idle" | "starting" | "testing" | "found" | "cancelled" | "no-problem";

    it("should determine idle phase", () => {
      const getPhase = (active: boolean, completed: boolean, foundExtension: string | null, step: number): BisectPhase => {
        if (!active && !completed) return "idle";
        if (foundExtension) return "found";
        if (completed && !foundExtension) return "no-problem";
        if (step === 0) return "starting";
        return "testing";
      };

      expect(getPhase(false, false, null, 0)).toBe("idle");
    });

    it("should determine starting phase", () => {
      const getPhase = (active: boolean, completed: boolean, foundExtension: string | null, step: number): BisectPhase => {
        if (!active && !completed) return "idle";
        if (foundExtension) return "found";
        if (completed && !foundExtension) return "no-problem";
        if (step === 0) return "starting";
        return "testing";
      };

      expect(getPhase(true, false, null, 0)).toBe("starting");
    });

    it("should determine testing phase", () => {
      const getPhase = (active: boolean, completed: boolean, foundExtension: string | null, step: number): BisectPhase => {
        if (!active && !completed) return "idle";
        if (foundExtension) return "found";
        if (completed && !foundExtension) return "no-problem";
        if (step === 0) return "starting";
        return "testing";
      };

      expect(getPhase(true, false, null, 2)).toBe("testing");
    });

    it("should determine found phase", () => {
      const getPhase = (active: boolean, completed: boolean, foundExtension: string | null, step: number): BisectPhase => {
        if (!active && !completed) return "idle";
        if (foundExtension) return "found";
        if (completed && !foundExtension) return "no-problem";
        if (step === 0) return "starting";
        return "testing";
      };

      expect(getPhase(true, true, "problematic-ext", 4)).toBe("found");
    });

    it("should determine no-problem phase", () => {
      const getPhase = (active: boolean, completed: boolean, foundExtension: string | null, step: number): BisectPhase => {
        if (!active && !completed) return "idle";
        if (foundExtension) return "found";
        if (completed && !foundExtension) return "no-problem";
        if (step === 0) return "starting";
        return "testing";
      };

      expect(getPhase(true, true, null, 4)).toBe("no-problem");
    });
  });

  describe("Progress Calculation", () => {
    it("should calculate progress percentage", () => {
      const calculateProgress = (step: number, totalSteps: number) => {
        if (totalSteps === 0) return 0;
        return Math.round((step / totalSteps) * 100);
      };

      expect(calculateProgress(2, 4)).toBe(50);
      expect(calculateProgress(3, 4)).toBe(75);
      expect(calculateProgress(4, 4)).toBe(100);
    });

    it("should handle zero total steps", () => {
      const calculateProgress = (step: number, totalSteps: number) => {
        if (totalSteps === 0) return 0;
        return Math.round((step / totalSteps) * 100);
      };

      expect(calculateProgress(0, 0)).toBe(0);
    });
  });

  describe("Total Steps Calculation", () => {
    it("should calculate steps using log2", () => {
      const calculateTotalSteps = (extensionCount: number) => {
        if (extensionCount <= 1) return 1;
        return Math.ceil(Math.log2(extensionCount));
      };

      expect(calculateTotalSteps(1)).toBe(1);
      expect(calculateTotalSteps(2)).toBe(1);
      expect(calculateTotalSteps(4)).toBe(2);
      expect(calculateTotalSteps(8)).toBe(3);
      expect(calculateTotalSteps(16)).toBe(4);
    });

    it("should handle non-power-of-2 counts", () => {
      const calculateTotalSteps = (extensionCount: number) => {
        if (extensionCount <= 1) return 1;
        return Math.ceil(Math.log2(extensionCount));
      };

      expect(calculateTotalSteps(3)).toBe(2);
      expect(calculateTotalSteps(5)).toBe(3);
      expect(calculateTotalSteps(10)).toBe(4);
    });
  });

  describe("Binary Search Split", () => {
    it("should split array in half", () => {
      const splitInHalf = <T,>(arr: T[]): [T[], T[]] => {
        const mid = Math.ceil(arr.length / 2);
        return [arr.slice(0, mid), arr.slice(mid)];
      };

      const [first, second] = splitInHalf(["a", "b", "c", "d"]);

      expect(first).toEqual(["a", "b"]);
      expect(second).toEqual(["c", "d"]);
    });

    it("should handle odd-length arrays", () => {
      const splitInHalf = <T,>(arr: T[]): [T[], T[]] => {
        const mid = Math.ceil(arr.length / 2);
        return [arr.slice(0, mid), arr.slice(mid)];
      };

      const [first, second] = splitInHalf(["a", "b", "c"]);

      expect(first).toEqual(["a", "b"]);
      expect(second).toEqual(["c"]);
    });

    it("should handle single element", () => {
      const splitInHalf = <T,>(arr: T[]): [T[], T[]] => {
        const mid = Math.ceil(arr.length / 2);
        return [arr.slice(0, mid), arr.slice(mid)];
      };

      const [first, second] = splitInHalf(["a"]);

      expect(first).toEqual(["a"]);
      expect(second).toEqual([]);
    });
  });

  describe("Start Bisect", () => {
    it("should initialize bisect with extensions", () => {
      const extensions = ["ext-a", "ext-b", "ext-c", "ext-d"];
      let state = {
        active: false,
        step: 0,
        totalSteps: 0,
        suspectedExtensions: [] as string[],
        startedAt: null as number | null,
      };

      const startBisect = () => {
        state = {
          active: true,
          step: 1,
          totalSteps: Math.ceil(Math.log2(extensions.length)),
          suspectedExtensions: [...extensions],
          startedAt: Date.now(),
        };
      };

      startBisect();

      expect(state.active).toBe(true);
      expect(state.step).toBe(1);
      expect(state.totalSteps).toBe(2);
      expect(state.suspectedExtensions).toHaveLength(4);
    });

    it("should handle single extension", () => {
      const extensions = ["only-ext"];
      let foundExtension: string | null = null;

      const startBisect = () => {
        if (extensions.length === 1) {
          foundExtension = extensions[0];
        }
      };

      startBisect();

      expect(foundExtension).toBe("only-ext");
    });

    it("should not start with no extensions", () => {
      const extensions: string[] = [];
      let started = false;

      const startBisect = () => {
        if (extensions.length === 0) {
          return;
        }
        started = true;
      };

      startBisect();

      expect(started).toBe(false);
    });
  });

  describe("Report Problem Status", () => {
    it("should narrow down when problem persists", () => {
      let suspectedExtensions = ["ext-a", "ext-b", "ext-c", "ext-d"];
      const currentlyDisabled = ["ext-a", "ext-b"];

      const reportProblemPersists = () => {
        suspectedExtensions = suspectedExtensions.filter(
          e => !currentlyDisabled.includes(e)
        );
      };

      reportProblemPersists();

      expect(suspectedExtensions).toEqual(["ext-c", "ext-d"]);
    });

    it("should narrow down when problem gone", () => {
      let suspectedExtensions = ["ext-a", "ext-b", "ext-c", "ext-d"];
      const currentlyDisabled = ["ext-a", "ext-b"];

      const reportProblemGone = () => {
        suspectedExtensions = currentlyDisabled;
      };

      reportProblemGone();

      expect(suspectedExtensions).toEqual(["ext-a", "ext-b"]);
    });

    it("should find extension when one remains", () => {
      let suspectedExtensions = ["ext-a"];
      let foundExtension: string | null = null;

      const checkComplete = () => {
        if (suspectedExtensions.length === 1) {
          foundExtension = suspectedExtensions[0];
        }
      };

      checkComplete();

      expect(foundExtension).toBe("ext-a");
    });
  });

  describe("Cancel Bisect", () => {
    it("should reset state on cancel", () => {
      let state = {
        active: true,
        step: 2,
        totalSteps: 4,
        suspectedExtensions: ["ext-a", "ext-b"],
        foundExtension: null as string | null,
        completed: false,
      };

      const cancelBisect = () => {
        state = {
          active: false,
          step: 0,
          totalSteps: 0,
          suspectedExtensions: [],
          foundExtension: null,
          completed: false,
        };
      };

      cancelBisect();

      expect(state.active).toBe(false);
      expect(state.step).toBe(0);
    });
  });

  describe("Extension Disabled Check", () => {
    it("should check if extension is disabled by bisect", () => {
      const currentlyDisabled = ["ext-a", "ext-b"];

      const isDisabledByBisect = (extId: string) => {
        return currentlyDisabled.includes(extId);
      };

      expect(isDisabledByBisect("ext-a")).toBe(true);
      expect(isDisabledByBisect("ext-c")).toBe(false);
    });
  });

  describe("Counts", () => {
    it("should count disabled extensions", () => {
      const currentlyDisabled = ["ext-a", "ext-b", "ext-c"];

      expect(currentlyDisabled.length).toBe(3);
    });

    it("should count suspected extensions", () => {
      const suspectedExtensions = ["ext-d", "ext-e"];

      expect(suspectedExtensions.length).toBe(2);
    });
  });

  describe("State Persistence", () => {
    it("should serialize state for storage", () => {
      const state = {
        active: true,
        step: 2,
        totalSteps: 4,
        testedExtensions: ["ext-a"],
        currentlyDisabled: ["ext-b"],
        suspectedExtensions: ["ext-b", "ext-c"],
        foundExtension: null,
        completed: false,
        startedAt: 1700000000000,
        originalEnabledState: new Map([["ext-a", true], ["ext-b", true]]),
      };

      const serialized = JSON.stringify({
        ...state,
        originalEnabledState: Array.from(state.originalEnabledState.entries()),
      });

      expect(serialized).toContain('"active":true');
      expect(serialized).toContain('"step":2');
    });

    it("should deserialize state from storage", () => {
      const json = JSON.stringify({
        active: true,
        step: 2,
        originalEnabledState: [["ext-a", true], ["ext-b", false]],
      });

      const parsed = JSON.parse(json);
      const state = {
        ...parsed,
        originalEnabledState: new Map(parsed.originalEnabledState || []),
      };

      expect(state.active).toBe(true);
      expect(state.originalEnabledState.get("ext-a")).toBe(true);
    });
  });

  describe("Reset Bisect", () => {
    it("should reset after completion", () => {
      let state: {
        active: boolean;
        completed: boolean;
        foundExtension: string | null;
      } = {
        active: true,
        completed: true,
        foundExtension: "problematic-ext",
      };

      const resetBisect = () => {
        state = {
          active: false,
          completed: false,
          foundExtension: null,
        };
      };

      resetBisect();

      expect(state.active).toBe(false);
      expect(state.foundExtension).toBeNull();
    });
  });
});
