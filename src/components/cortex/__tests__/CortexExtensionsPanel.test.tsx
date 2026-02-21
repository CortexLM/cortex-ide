import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexExtensionsPanel } from "../CortexExtensionsPanel";

const mockCtx = {
  extensions: vi.fn((): any[] => []),
  enabledExtensions: vi.fn((): any[] => []),
  marketplaceExtensions: vi.fn((): any[] => []),
  extensionThemes: vi.fn((): any[] => []),
  loading: vi.fn(() => false),
  error: vi.fn(() => null),
  extensionsDir: vi.fn(() => "/extensions"),
  initialized: vi.fn(() => true),
  outdatedExtensions: vi.fn(() => new Map<string, any>()),
  updateInProgress: vi.fn(() => new Set()),
  lastChecked: vi.fn(() => null),
  checkingForUpdates: vi.fn(() => false),
  updateSettings: vi.fn(() => ({ autoUpdate: true, autoCheckUpdates: true, checkInterval: 60 })),
  outdatedCount: vi.fn(() => 0),
  hostStatus: vi.fn(() => "stopped"),
  hostReady: vi.fn(() => false),
  runtimeStates: vi.fn((): any[] => []),
  activeRuntimeExtensions: vi.fn((): any[] => []),
  loadExtensions: vi.fn().mockResolvedValue(undefined),
  enableExtension: vi.fn().mockResolvedValue(undefined),
  disableExtension: vi.fn().mockResolvedValue(undefined),
  uninstallExtension: vi.fn().mockResolvedValue(undefined),
  installFromPath: vi.fn().mockResolvedValue(undefined),
  openExtensionsDirectory: vi.fn().mockResolvedValue(undefined),
  searchMarketplace: vi.fn().mockResolvedValue(undefined),
  getFeaturedExtensions: vi.fn().mockResolvedValue(undefined),
  installFromMarketplace: vi.fn().mockResolvedValue(undefined),
  refreshThemes: vi.fn().mockResolvedValue(undefined),
  getExtensionCommands: vi.fn().mockResolvedValue([]),
  getExtensionLanguages: vi.fn().mockResolvedValue([]),
  getExtensionPanels: vi.fn().mockResolvedValue([]),
  getExtensionSettings: vi.fn().mockResolvedValue([]),
  executeExtensionCommand: vi.fn().mockResolvedValue(undefined),
  checkForUpdates: vi.fn().mockResolvedValue([]),
  updateExtension: vi.fn().mockResolvedValue(undefined),
  updateAllExtensions: vi.fn().mockResolvedValue(undefined),
  getOutdatedExtensions: vi.fn(() => []),
  isExtensionOutdated: vi.fn(() => false),
  isExtensionUpdating: vi.fn(() => false),
  getUpdateInfo: vi.fn(() => undefined),
  setUpdateSettings: vi.fn(),
  startExtensionHost: vi.fn().mockResolvedValue(undefined),
  stopExtensionHost: vi.fn().mockResolvedValue(undefined),
  restartExtensionHost: vi.fn().mockResolvedValue(undefined),
  activateRuntimeExtension: vi.fn().mockResolvedValue(undefined),
  deactivateRuntimeExtension: vi.fn().mockResolvedValue(undefined),
  executeHostCommand: vi.fn().mockResolvedValue(undefined),
  sendHostEvent: vi.fn(),
  getExtensionHost: vi.fn(() => null),
  installExtensionPack: vi.fn().mockResolvedValue(undefined),
  uninstallExtensionPack: vi.fn().mockResolvedValue(undefined),
  getExtensionPackContents: vi.fn((): any[] => []),
  isExtensionPack: vi.fn(() => false),
  getInstalledPacks: vi.fn((): any[] => []),
  getPackForExtension: vi.fn(() => undefined),
  isWebExtension: vi.fn(() => false),
  getExtensionKind: vi.fn((): any[] => []),
  getWebExtensionHost: vi.fn(() => null),
  startWebExtensionHost: vi.fn().mockResolvedValue(undefined),
  stopWebExtensionHost: vi.fn().mockResolvedValue(undefined),
  getExtensionProfiles: vi.fn((): any[] => []),
  restartExtension: vi.fn().mockResolvedValue(undefined),
  getExtensionMemoryUsage: vi.fn(() => 0),
};

vi.mock("@/context/ExtensionsContext", () => ({
  useExtensions: () => mockCtx,
  ExtensionsProvider: (props: { children: any }) => props.children,
}));

vi.mock("../primitives/CortexButton", () => ({
  CortexButton: (props: { children?: any; onClick?: () => void; variant?: string; size?: string; icon?: string; style?: unknown }) => (
    <button data-testid={`btn-${typeof props.children === "string" ? props.children : "action"}`} data-variant={props.variant} onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: unknown; color?: string; style?: unknown }) => (
    <span data-testid={`icon-${props.name}`} />
  ),
}));

vi.mock("../primitives/CortexIconButton", () => ({
  CortexIconButton: (props: { icon: string; size?: number; onClick?: () => void }) => (
    <button data-testid={`icon-btn-${props.icon}`} onClick={props.onClick} />
  ),
}));

const createExtension = (name: string, version = "1.0.0", enabled = true) => ({
  manifest: {
    name,
    version,
    description: `${name} description`,
    author: `${name} Author`,
    contributes: { themes: [] as any[], languages: [] as any[], commands: [] as any[], panels: [] as any[], settings: [] as any[], keybindings: [] as any[], snippets: [] as any[] },
    keywords: [] as string[],
  },
  path: `/extensions/${name}`,
  enabled,
  source: "local" as const,
});

describe("CortexExtensionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockCtx.extensions.mockReturnValue([]);
    mockCtx.marketplaceExtensions.mockReturnValue([]);
    mockCtx.outdatedExtensions.mockReturnValue(new Map());
    mockCtx.loading.mockReturnValue(false);
  });

  describe("Rendering", () => {
    it("should render the Extensions header", () => {
      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("Extensions");
    });

    it("should render installed extensions list", () => {
      const extensions = [
        createExtension("Python"),
        createExtension("Rust"),
        createExtension("TypeScript"),
      ];
      mockCtx.extensions.mockReturnValue(extensions);

      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("Python");
      expect(container.textContent).toContain("Rust");
      expect(container.textContent).toContain("TypeScript");
    });

    it("should render tab buttons for Installed, Marketplace, Outdated", () => {
      const { container } = render(() => <CortexExtensionsPanel />);
      const buttons = container.querySelectorAll("button");
      const buttonTexts = Array.from(buttons).map((b) => b.textContent?.trim());
      expect(buttonTexts).toContain("Installed");
      expect(buttonTexts).toContain("Marketplace");
      expect(buttonTexts).toContain("Outdated");
    });

    it("should show installed count in tab badge", () => {
      const extensions = [createExtension("Ext1"), createExtension("Ext2")];
      mockCtx.extensions.mockReturnValue(extensions);

      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("2");
    });

    it("should show loading state", () => {
      mockCtx.loading.mockReturnValue(true);

      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("Loading...");
    });

    it("should show empty message when no extensions installed", () => {
      mockCtx.extensions.mockReturnValue([]);

      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("No extensions installed");
    });

    it("should render search input", () => {
      const { container } = render(() => <CortexExtensionsPanel />);
      const input = container.querySelector('input[type="text"]');
      expect(input).toBeTruthy();
      expect(input?.getAttribute("placeholder")).toContain("Search extensions");
    });
  });

  describe("Extension Details Display", () => {
    it("should display extension name, version, author, and description", () => {
      const ext = createExtension("MyExtension", "2.5.0");
      mockCtx.extensions.mockReturnValue([ext]);

      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("MyExtension");
      expect(container.textContent).toContain("v2.5.0");
      expect(container.textContent).toContain("MyExtension Author");
      expect(container.textContent).toContain("MyExtension description");
    });

    it("should display first letter as icon avatar", () => {
      const ext = createExtension("Prettier");
      mockCtx.extensions.mockReturnValue([ext]);

      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("P");
    });

    it("should show Disable button for enabled extensions", () => {
      const ext = createExtension("Prettier", "1.0.0", true);
      mockCtx.extensions.mockReturnValue([ext]);

      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("Disable");
    });

    it("should show Enable button for disabled extensions", () => {
      const ext = createExtension("Prettier", "1.0.0", false);
      mockCtx.extensions.mockReturnValue([ext]);

      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("Enable");
    });

    it("should show Uninstall button for installed extensions", () => {
      const ext = createExtension("Prettier");
      mockCtx.extensions.mockReturnValue([ext]);

      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("Uninstall");
    });

    it("should show update badge when extension has an update available", () => {
      const ext = createExtension("Prettier", "1.0.0");
      mockCtx.extensions.mockReturnValue([ext]);
      mockCtx.outdatedExtensions.mockReturnValue(
        new Map([["Prettier", { extensionName: "Prettier", currentVersion: "1.0.0", availableVersion: "2.0.0" }]])
      );

      const { container } = render(() => <CortexExtensionsPanel />);
      expect(container.textContent).toContain("2.0.0");
      expect(container.textContent).toContain("Update");
    });
  });

  describe("Search and Filter", () => {
    it("should filter installed extensions by name", async () => {
      const extensions = [
        createExtension("Python"),
        createExtension("Rust"),
        createExtension("TypeScript"),
      ];
      mockCtx.extensions.mockReturnValue(extensions);

      const { container } = render(() => <CortexExtensionsPanel />);
      const input = container.querySelector('input[type="text"]')!;
      await fireEvent.input(input, { target: { value: "Rust" } });

      expect(container.textContent).toContain("Rust");
      expect(container.textContent).not.toContain("Python");
      expect(container.textContent).not.toContain("TypeScript");
    });

    it("should filter installed extensions by description", async () => {
      const extensions = [
        createExtension("Python"),
        createExtension("Rust"),
      ];
      mockCtx.extensions.mockReturnValue(extensions);

      const { container } = render(() => <CortexExtensionsPanel />);
      const input = container.querySelector('input[type="text"]')!;
      await fireEvent.input(input, { target: { value: "Python description" } });

      expect(container.textContent).toContain("Python");
      expect(container.textContent).not.toContain("Rust");
    });

    it("should show empty message when search matches nothing", async () => {
      const extensions = [createExtension("Python")];
      mockCtx.extensions.mockReturnValue(extensions);

      const { container } = render(() => <CortexExtensionsPanel />);
      const input = container.querySelector('input[type="text"]')!;
      await fireEvent.input(input, { target: { value: "nonexistent" } });

      expect(container.textContent).toContain("No extensions installed");
    });

    it("should trigger marketplace search when on marketplace tab", async () => {
      const { container } = render(() => <CortexExtensionsPanel />);

      const marketplaceTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Marketplace"
      );
      await fireEvent.click(marketplaceTab!);

      const input = container.querySelector('input[type="text"]')!;
      await fireEvent.input(input, { target: { value: "test-query" } });

      expect(mockCtx.searchMarketplace).toHaveBeenCalledWith("test-query");
    });
  });

  describe("Install and Uninstall Actions", () => {
    it("should call uninstallExtension when Uninstall is clicked", async () => {
      const ext = createExtension("Prettier");
      mockCtx.extensions.mockReturnValue([ext]);

      const { container } = render(() => <CortexExtensionsPanel />);
      const uninstallBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Uninstall"
      );
      await fireEvent.click(uninstallBtn!);

      expect(mockCtx.uninstallExtension).toHaveBeenCalledWith("Prettier");
    });

    it("should call disableExtension when Disable is clicked on enabled extension", async () => {
      const ext = createExtension("Prettier", "1.0.0", true);
      mockCtx.extensions.mockReturnValue([ext]);

      const { container } = render(() => <CortexExtensionsPanel />);
      const disableBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Disable"
      );
      await fireEvent.click(disableBtn!);

      expect(mockCtx.disableExtension).toHaveBeenCalledWith("Prettier");
    });

    it("should call enableExtension when Enable is clicked on disabled extension", async () => {
      const ext = createExtension("Prettier", "1.0.0", false);
      mockCtx.extensions.mockReturnValue([ext]);

      const { container } = render(() => <CortexExtensionsPanel />);
      const enableBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Enable"
      );
      await fireEvent.click(enableBtn!);

      expect(mockCtx.enableExtension).toHaveBeenCalledWith("Prettier");
    });

    it("should call installFromMarketplace when Install is clicked on marketplace extension", async () => {
      mockCtx.marketplaceExtensions.mockReturnValue([
        { name: "NewExt", version: "1.0.0", description: "A new extension", author: "Author", downloads: 1000, rating: 4.5, download_url: "http://example.com", categories: [], updated_at: "2024-01-01", icon_url: undefined, repository_url: undefined },
      ]);

      const { container } = render(() => <CortexExtensionsPanel />);

      const marketplaceTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Marketplace"
      );
      await fireEvent.click(marketplaceTab!);

      const installBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Install"
      );
      await fireEvent.click(installBtn!);

      expect(mockCtx.installFromMarketplace).toHaveBeenCalledWith("NewExt");
    });

    it("should call updateExtension when Update is clicked", async () => {
      const ext = createExtension("Prettier", "1.0.0");
      mockCtx.extensions.mockReturnValue([ext]);
      mockCtx.outdatedExtensions.mockReturnValue(
        new Map([["Prettier", { extensionName: "Prettier", currentVersion: "1.0.0", availableVersion: "2.0.0" }]])
      );

      const { container } = render(() => <CortexExtensionsPanel />);
      const updateBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Update"
      );
      await fireEvent.click(updateBtn!);

      expect(mockCtx.updateExtension).toHaveBeenCalledWith("Prettier");
    });
  });

  describe("Tab Switching", () => {
    it("should switch to marketplace tab and trigger search", async () => {
      const { container } = render(() => <CortexExtensionsPanel />);

      const marketplaceTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Marketplace"
      );
      await fireEvent.click(marketplaceTab!);

      expect(mockCtx.searchMarketplace).toHaveBeenCalledWith("");
    });

    it("should switch to outdated tab and show up-to-date message", async () => {
      mockCtx.extensions.mockReturnValue([createExtension("Ext1")]);
      mockCtx.outdatedExtensions.mockReturnValue(new Map());

      const { container } = render(() => <CortexExtensionsPanel />);

      const outdatedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Outdated"
      );
      await fireEvent.click(outdatedTab!);

      expect(container.textContent).toContain("All extensions up to date");
    });

    it("should show outdated extensions in outdated tab", async () => {
      const ext = createExtension("OldExt", "1.0.0");
      mockCtx.extensions.mockReturnValue([ext]);
      mockCtx.outdatedExtensions.mockReturnValue(
        new Map([["OldExt", { extensionName: "OldExt", currentVersion: "1.0.0", availableVersion: "2.0.0" }]])
      );

      const { container } = render(() => <CortexExtensionsPanel />);

      const outdatedTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim().startsWith("Outdated")
      );
      await fireEvent.click(outdatedTab!);

      expect(container.textContent).toContain("OldExt");
    });

    it("should show marketplace empty message when no results", async () => {
      mockCtx.marketplaceExtensions.mockReturnValue([]);

      const { container } = render(() => <CortexExtensionsPanel />);

      const marketplaceTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Marketplace"
      );
      await fireEvent.click(marketplaceTab!);

      expect(container.textContent).toContain("No extensions found");
    });
  });

  describe("Footer Actions", () => {
    it("should call checkForUpdates when Check for updates is clicked", async () => {
      const { container } = render(() => <CortexExtensionsPanel />);
      const checkBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Check for updates")
      );
      await fireEvent.click(checkBtn!);

      expect(mockCtx.checkForUpdates).toHaveBeenCalled();
    });

    it("should call openExtensionsDirectory when Open folder is clicked", async () => {
      const { container } = render(() => <CortexExtensionsPanel />);
      const openBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Open folder")
      );
      await fireEvent.click(openBtn!);

      expect(mockCtx.openExtensionsDirectory).toHaveBeenCalled();
    });

    it("should call loadExtensions when refresh icon button is clicked", async () => {
      const { container } = render(() => <CortexExtensionsPanel />);
      const refreshBtn = container.querySelector('[data-testid="icon-btn-refresh"]');
      await fireEvent.click(refreshBtn!);

      expect(mockCtx.loadExtensions).toHaveBeenCalled();
    });
  });
});
