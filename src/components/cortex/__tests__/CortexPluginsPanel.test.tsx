import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexPluginsPanel } from "../CortexPluginsPanel";
import { invoke } from "@tauri-apps/api/core";

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: unknown; color?: string; style?: unknown }) => (
    <span data-testid={`icon-${props.name}`} />
  ),
}));

vi.mock("../primitives/CortexIconButton", () => ({
  CortexIconButton: (props: { icon: string; size?: number; onClick?: () => void; title?: string }) => (
    <button data-testid={`icon-btn-${props.icon}`} onClick={props.onClick} title={props.title} />
  ),
}));

vi.mock("../primitives/CortexToggle", () => ({
  CortexToggle: (props: { checked?: boolean; onChange?: () => void; size?: string }) => (
    <input
      type="checkbox"
      data-testid="plugin-toggle"
      checked={props.checked}
      onChange={() => props.onChange?.()}
    />
  ),
}));

const mockedInvoke = vi.mocked(invoke);

const createInstalledPlugin = (name: string, version = "1.0.0", enabled = true) => ({
  manifest: {
    name,
    version,
    author: `${name} Author`,
    description: `${name} description`,
  },
  enabled,
});

describe("CortexPluginsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockedInvoke.mockResolvedValue(undefined as never);
  });

  describe("Rendering", () => {
    it("should render the Plugins header", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      expect(container.textContent).toContain("Plugins");
    });

    it("should render Marketplace and Installed tabs", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      expect(container.textContent).toContain("Marketplace");
      expect(container.textContent).toContain("Installed");
    });

    it("should render marketplace plugins list by default", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      expect(container.textContent).toContain("GitHub Copilot");
      expect(container.textContent).toContain("Prettier");
      expect(container.textContent).toContain("ESLint");
    });

    it("should render search input in marketplace tab", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      const input = container.querySelector('input[type="text"]');
      expect(input).toBeTruthy();
    });

    it("should render Top Downloads category header", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      expect(container.textContent).toContain("Top Downloads");
    });
  });

  describe("Plugin Card Display", () => {
    it("should display plugin name in marketplace cards", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      expect(container.textContent).toContain("GitHub Copilot");
      expect(container.textContent).toContain("Dart");
      expect(container.textContent).toContain("DeepSeek Developer AI");
    });

    it("should display plugin author in marketplace cards", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      expect(container.textContent).toContain("GitHub");
      expect(container.textContent).toContain("Google");
      expect(container.textContent).toContain("JetCode");
    });

    it("should display plugin downloads count", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      expect(container.textContent).toContain("38.1M");
      expect(container.textContent).toContain("21.5M");
    });

    it("should display plugin rating", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      expect(container.textContent).toContain("2.32");
      expect(container.textContent).toContain("3.69");
    });

    it("should display first letter as avatar icon", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      const avatars = container.querySelectorAll("div");
      const avatarTexts = Array.from(avatars).map((d) => d.textContent);
      const hasG = avatarTexts.some((t) => t?.includes("G"));
      expect(hasG).toBe(true);
    });

    it("should display Install button for marketplace plugins", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      const installButtons = Array.from(container.querySelectorAll("button")).filter(
        (b) => b.textContent?.trim() === "Install"
      );
      expect(installButtons.length).toBeGreaterThan(0);
    });

    it("should display installed plugin name, version, and author", async () => {
      mockedInvoke.mockResolvedValueOnce([
        createInstalledPlugin("MyPlugin", "3.0.0"),
      ] as never);

      const { container } = render(() => <CortexPluginsPanel />);

      const installedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Installed")
      );
      await fireEvent.click(installedTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("MyPlugin");
      });
      expect(container.textContent).toContain("v3.0.0");
      expect(container.textContent).toContain("MyPlugin Author");
    });
  });

  describe("handleToggle - Phase 1 Fix Verification", () => {
    it("should call disable_extension when enabled=true (Phase 1 fix)", async () => {
      mockedInvoke.mockResolvedValue(undefined as never);
      mockedInvoke.mockResolvedValueOnce([
        createInstalledPlugin("TestPlugin", "1.0.0", true),
      ] as never);

      const { container } = render(() => <CortexPluginsPanel />);

      const installedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Installed")
      );
      await fireEvent.click(installedTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("TestPlugin");
      });

      const toggle = container.querySelector('[data-testid="plugin-toggle"]') as HTMLInputElement;
      expect(toggle).toBeTruthy();
      expect(toggle.checked).toBe(true);

      await fireEvent.change(toggle);

      expect(mockedInvoke).toHaveBeenCalledWith("disable_extension", { name: "TestPlugin" });
    });

    it("should call enable_extension when enabled=false", async () => {
      mockedInvoke.mockResolvedValue(undefined as never);
      mockedInvoke.mockResolvedValueOnce([
        createInstalledPlugin("DisabledPlugin", "1.0.0", false),
      ] as never);

      const { container } = render(() => <CortexPluginsPanel />);

      const installedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Installed")
      );
      await fireEvent.click(installedTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("DisabledPlugin");
      });

      const toggle = container.querySelector('[data-testid="plugin-toggle"]') as HTMLInputElement;
      expect(toggle).toBeTruthy();
      expect(toggle.checked).toBe(false);

      await fireEvent.change(toggle);

      expect(mockedInvoke).toHaveBeenCalledWith("enable_extension", { name: "DisabledPlugin" });
    });

    it("should update plugin state after successful toggle", async () => {
      mockedInvoke.mockResolvedValue(undefined as never);
      mockedInvoke.mockResolvedValueOnce([
        createInstalledPlugin("TogglePlugin", "1.0.0", true),
      ] as never);

      const { container } = render(() => <CortexPluginsPanel />);

      const installedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Installed")
      );
      await fireEvent.click(installedTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("TogglePlugin");
      });

      const toggle = container.querySelector('[data-testid="plugin-toggle"]') as HTMLInputElement;
      await fireEvent.change(toggle);

      await vi.waitFor(() => {
        const updatedToggle = container.querySelector('[data-testid="plugin-toggle"]') as HTMLInputElement;
        expect(updatedToggle.checked).toBe(false);
      });
    });
  });

  describe("Install Flow", () => {
    it("should call install_from_marketplace when Install is clicked", async () => {
      mockedInvoke.mockResolvedValue(undefined as never);

      const { container } = render(() => <CortexPluginsPanel />);

      const installButtons = Array.from(container.querySelectorAll("button")).filter(
        (b) => b.textContent?.trim() === "Install"
      );
      await fireEvent.click(installButtons[0]);

      expect(mockedInvoke).toHaveBeenCalledWith("install_from_marketplace", { extensionName: "GitHub Copilot" });
    });

    it("should move plugin to installed list after install", async () => {
      mockedInvoke.mockResolvedValue(undefined as never);
      mockedInvoke.mockResolvedValueOnce([] as never);

      const { container } = render(() => <CortexPluginsPanel />);

      const installButtons = Array.from(container.querySelectorAll("button")).filter(
        (b) => b.textContent?.trim() === "Install"
      );
      const firstPluginName = "GitHub Copilot";

      await fireEvent.click(installButtons[0]);

      await vi.waitFor(() => {
        const remainingInstallBtns = Array.from(container.querySelectorAll("button")).filter(
          (b) => b.textContent?.trim() === "Install"
        );
        expect(remainingInstallBtns.length).toBe(installButtons.length - 1);
      });

      const installedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Installed")
      );
      await fireEvent.click(installedTab!);

      expect(container.textContent).toContain(firstPluginName);
    });
  });

  describe("Uninstall Flow", () => {
    it("should call uninstall_extension when Uninstall is clicked", async () => {
      mockedInvoke.mockResolvedValue(undefined as never);
      mockedInvoke.mockResolvedValueOnce([
        createInstalledPlugin("RemoveMe", "1.0.0"),
      ] as never);

      const { container } = render(() => <CortexPluginsPanel />);

      const installedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Installed")
      );
      await fireEvent.click(installedTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("RemoveMe");
      });

      const uninstallBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Uninstall"
      );
      await fireEvent.click(uninstallBtn!);

      expect(mockedInvoke).toHaveBeenCalledWith("uninstall_extension", { name: "RemoveMe" });
    });

    it("should remove plugin from installed list after uninstall", async () => {
      mockedInvoke.mockResolvedValue(undefined as never);
      mockedInvoke.mockResolvedValueOnce([
        createInstalledPlugin("RemoveMe", "1.0.0"),
      ] as never);

      const { container } = render(() => <CortexPluginsPanel />);

      const installedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Installed")
      );
      await fireEvent.click(installedTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("RemoveMe");
      });

      const uninstallBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Uninstall"
      );
      await fireEvent.click(uninstallBtn!);

      await vi.waitFor(() => {
        expect(container.textContent).not.toContain("RemoveMe");
      });
    });
  });

  describe("Refresh Plugins List", () => {
    it("should reload installed plugins when switching to installed tab", async () => {
      mockedInvoke.mockResolvedValue([] as never);

      const { container } = render(() => <CortexPluginsPanel />);

      const installedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Installed")
      );
      await fireEvent.click(installedTab!);

      expect(mockedInvoke).toHaveBeenCalledWith("get_extensions");
    });

    it("should show empty message when no plugins installed", async () => {
      mockedInvoke.mockResolvedValueOnce([] as never);

      const { container } = render(() => <CortexPluginsPanel />);

      const installedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Installed")
      );
      await fireEvent.click(installedTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("No plugins installed yet");
      });
    });

    it("should show installed plugins count in tab badge", async () => {
      mockedInvoke.mockResolvedValueOnce([
        createInstalledPlugin("P1"),
        createInstalledPlugin("P2"),
        createInstalledPlugin("P3"),
      ] as never);

      const { container } = render(() => <CortexPluginsPanel />);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("3");
      });
    });
  });

  describe("Search Functionality", () => {
    it("should filter marketplace plugins by search query", async () => {
      mockedInvoke.mockImplementation(((cmd: string) => {
        if (cmd === "search_marketplace") {
          return Promise.resolve([
            { name: "Prettier", version: "10.4.0", author: "Prettier", description: "Code formatter", downloads: 45200000, rating: 3.85, download_url: "http://example.com" },
          ]);
        }
        return Promise.resolve([]);
      }) as typeof invoke);

      const { container } = render(() => <CortexPluginsPanel />);
      const input = container.querySelector('input[type="text"]')!;

      await fireEvent.input(input, { target: { value: "Prettier" } });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Prettier");
      });
    });

    it("should call search_marketplace invoke for search queries", async () => {
      mockedInvoke.mockResolvedValue([] as never);

      const { container } = render(() => <CortexPluginsPanel />);
      const input = container.querySelector('input[type="text"]')!;

      await fireEvent.input(input, { target: { value: "test-search" } });

      expect(mockedInvoke).toHaveBeenCalledWith("search_marketplace", { query: "test-search", category: null });
    });

    it("should show no plugins found when search returns empty", async () => {
      mockedInvoke.mockResolvedValue([] as never);

      const { container } = render(() => <CortexPluginsPanel />);
      const input = container.querySelector('input[type="text"]')!;

      await fireEvent.input(input, { target: { value: "nonexistent-plugin-xyz" } });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("No plugins found");
      });
    });

    it("should reset to featured list when search is cleared", async () => {
      const { container } = render(() => <CortexPluginsPanel />);
      const input = container.querySelector('input[type="text"]')!;

      await fireEvent.input(input, { target: { value: "test" } });
      await fireEvent.input(input, { target: { value: "" } });

      await vi.waitFor(() => {
        expect(container.textContent).toContain("GitHub Copilot");
      });
    });
  });

  describe("Settings Button", () => {
    it("should render settings icon button in header", () => {
      const { container } = render(() => <CortexPluginsPanel />);
      const settingsBtn = container.querySelector('[data-testid="icon-btn-gear"]');
      expect(settingsBtn).toBeTruthy();
    });
  });
});
