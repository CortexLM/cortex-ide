import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("solid-js/web", async () => {
  const actual = await vi.importActual<typeof import("solid-js/web")>("solid-js/web");
  return {
    ...actual,
    Portal: (props: { children: unknown }) => props.children,
  };
});

vi.mock("@/context/ProfilesContext", () => ({
  useProfiles: () => ({
    profiles: () => [
      {
        id: "default",
        name: "Default",
        isDefault: true,
        icon: "user",
      },
      {
        id: "dev",
        name: "Development",
        isDefault: false,
        icon: "code",
      },
    ],
    activeProfile: () => ({
      id: "default",
      name: "Default",
      icon: "user",
    }),
    activeProfileId: () => "default",
    switchProfile: vi.fn(),
    showQuickSwitch: () => false,
    closeQuickSwitch: vi.fn(),
    openQuickSwitch: vi.fn(),
    createProfile: vi.fn(),
  }),
}));

vi.mock("../ui/Icon", () => ({
  Icon: (props: { name: string; size?: number }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

describe("ProfileSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export ProfileSwitcher component", async () => {
    const { ProfileSwitcher } = await import("../ProfileSwitcher");
    expect(ProfileSwitcher).toBeDefined();
    expect(typeof ProfileSwitcher).toBe("function");
  });

  it("should render without crashing", async () => {
    const { ProfileSwitcher } = await import("../ProfileSwitcher");

    createRoot((dispose) => {
      const element = ProfileSwitcher({});
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should export getProfileIcon function", async () => {
    const { getProfileIcon } = await import("../ProfileSwitcher");
    expect(getProfileIcon).toBeDefined();
    expect(typeof getProfileIcon).toBe("function");
  });

  it("getProfileIcon returns element for known icons", async () => {
    const { getProfileIcon } = await import("../ProfileSwitcher");

    createRoot((dispose) => {
      const icon = getProfileIcon("user", 16);
      expect(icon).toBeDefined();
      dispose();
    });
  });

  it("getProfileIcon returns element for unknown icons", async () => {
    const { getProfileIcon } = await import("../ProfileSwitcher");

    createRoot((dispose) => {
      const icon = getProfileIcon("unknown-icon", 16);
      expect(icon).toBeDefined();
      dispose();
    });
  });

  it("should export ProfileStatusBarItem component", async () => {
    const { ProfileStatusBarItem } = await import("../ProfileSwitcher");
    expect(ProfileStatusBarItem).toBeDefined();
    expect(typeof ProfileStatusBarItem).toBe("function");
  });

  it("ProfileStatusBarItem renders without crashing", async () => {
    const { ProfileStatusBarItem } = await import("../ProfileSwitcher");

    createRoot((dispose) => {
      const element = ProfileStatusBarItem();
      expect(element).toBeDefined();
      dispose();
    });
  });
});
