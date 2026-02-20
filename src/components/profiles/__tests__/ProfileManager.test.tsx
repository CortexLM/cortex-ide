import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const mockProfiles = [
  {
    id: "default",
    name: "Default",
    isDefault: true,
    icon: "user",
    settings: {},
    keybindings: [],
    enabledExtensions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "dev",
    name: "Development",
    isDefault: false,
    icon: "code",
    settings: { theme: "dark" },
    keybindings: [],
    enabledExtensions: ["ext1"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

vi.mock("@/context/ProfilesContext", () => ({
  useProfiles: () => ({
    profiles: () => mockProfiles,
    activeProfileId: () => "default",
    showManager: () => true,
    closeManager: vi.fn(),
    createProfile: vi.fn().mockResolvedValue({ id: "new", name: "New" }),
    deleteProfile: vi.fn(),
    duplicateProfile: vi.fn(),
    updateProfile: vi.fn(),
    switchProfile: vi.fn(),
    exportProfile: vi.fn().mockResolvedValue("{}"),
    importProfile: vi.fn().mockResolvedValue({ success: true }),
    getAvailableIcons: () => ["user", "code", "terminal", "star", "sun"],
    isDefaultProfile: (id: string) => id === "default",
  }),
}));

vi.mock("../ProfileSwitcher", () => ({
  getProfileIcon: (icon?: string, size?: number) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", icon || "user");
    el.setAttribute("data-size", String(size || 16));
    return el;
  },
}));

vi.mock("../../ui/Icon", () => ({
  Icon: (props: { name: string }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

vi.mock("@/components/ui", () => ({
  Button: (props: { children: unknown; onClick?: () => void }) => {
    const el = document.createElement("button");
    el.textContent = String(props.children || "");
    if (props.onClick) el.addEventListener("click", props.onClick);
    return el;
  },
  Input: (props: { placeholder?: string }) => {
    const el = document.createElement("input");
    if (props.placeholder) el.placeholder = props.placeholder;
    return el;
  },
  Modal: (props: { open: boolean; children: unknown; title?: string }) => {
    if (!props.open) return document.createComment("hidden");
    const el = document.createElement("div");
    el.setAttribute("data-testid", "modal");
    el.setAttribute("data-title", props.title || "");
    if (props.children instanceof Node) el.appendChild(props.children);
    return el;
  },
  IconButton: (props: { onClick?: () => void }) => {
    const el = document.createElement("button");
    if (props.onClick) el.addEventListener("click", props.onClick);
    return el;
  },
  Text: (props: { children: unknown }) => {
    const el = document.createElement("span");
    el.textContent = String(props.children || "");
    return el;
  },
  Divider: () => document.createElement("hr"),
  Badge: (props: { children: unknown }) => {
    const el = document.createElement("span");
    el.textContent = String(props.children || "");
    return el;
  },
}));

describe("ProfileManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export ProfileManager component", async () => {
    const { ProfileManager } = await import("../ProfileManager");
    expect(ProfileManager).toBeDefined();
    expect(typeof ProfileManager).toBe("function");
  });

  it("should render without crashing when showManager is true", async () => {
    const { ProfileManager } = await import("../ProfileManager");

    createRoot((dispose) => {
      const element = ProfileManager();
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should be a valid component function", async () => {
    const { ProfileManager } = await import("../ProfileManager");
    expect(typeof ProfileManager).toBe("function");
  });
});
