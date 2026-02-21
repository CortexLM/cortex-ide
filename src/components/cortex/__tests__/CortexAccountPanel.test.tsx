import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexAccountPanel } from "../CortexAccountPanel";
import { invoke } from "@tauri-apps/api/core";

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: unknown; color?: string }) => (
    <span data-testid={`icon-${props.name}`} />
  ),
}));

vi.mock("../../utils/tauri", () => ({
  getVersion: vi.fn().mockResolvedValue("2.22.0"),
}));

const mockedInvoke = vi.mocked(invoke);

describe("CortexAccountPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockedInvoke.mockResolvedValue(false as never);
  });

  describe("Rendering", () => {
    it("should render tab navigation with all tabs", () => {
      const { container } = render(() => <CortexAccountPanel />);
      expect(container.textContent).toContain("Profile");
      expect(container.textContent).toContain("Subscription");
      expect(container.textContent).toContain("AI Usage");
      expect(container.textContent).toContain("API Tokens");
      expect(container.textContent).toContain("Security");
    });

    it("should render tab icons", () => {
      const { container } = render(() => <CortexAccountPanel />);
      expect(container.querySelector('[data-testid="icon-user-01"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-tag-02"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-pie-chart-01"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-data"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-shield-02"]')).toBeTruthy();
    });

    it("should show Profile tab content by default", () => {
      const { container } = render(() => <CortexAccountPanel />);
      expect(container.textContent).toContain("User");
      expect(container.textContent).toContain("Not signed in");
    });
  });

  describe("Profile Tab - User Info", () => {
    it("should render user avatar area", () => {
      const { container } = render(() => <CortexAccountPanel />);
      expect(container.querySelector('[data-testid="icon-user"]')).toBeTruthy();
    });

    it("should show User label when not signed in", () => {
      const { container } = render(() => <CortexAccountPanel />);
      expect(container.textContent).toContain("User");
      expect(container.textContent).toContain("Not signed in");
    });

    it("should display app version placeholder or resolved version", async () => {
      const { container } = render(() => <CortexAccountPanel />);
      expect(container.textContent).toContain("Cortex Desktop v");
    });
  });

  describe("Login Form - Sign In Buttons", () => {
    it("should show Continue with GitHub button", () => {
      const { container } = render(() => <CortexAccountPanel />);
      expect(container.textContent).toContain("Continue with GitHub");
    });

    it("should show Continue with Google button", () => {
      const { container } = render(() => <CortexAccountPanel />);
      expect(container.textContent).toContain("Continue with Google");
    });

    it("should render GitHub icon in sign-in button", () => {
      const { container } = render(() => <CortexAccountPanel />);
      expect(container.querySelector('[data-testid="icon-git-logo"]')).toBeTruthy();
    });

    it("should render globe icon in Google sign-in button", () => {
      const { container } = render(() => <CortexAccountPanel />);
      expect(container.querySelector('[data-testid="icon-globe"]')).toBeTruthy();
    });
  });

  describe("Tab Navigation", () => {
    it("should switch to Subscription tab", async () => {
      const { container } = render(() => <CortexAccountPanel />);

      const subTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Subscription")
      );
      await fireEvent.click(subTab!);

      expect(container.textContent).toContain("Free Plan");
      expect(container.textContent).toContain("Sign in to manage your subscription");
    });

    it("should switch to AI Usage tab", async () => {
      const { container } = render(() => <CortexAccountPanel />);

      const usageTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("AI Usage")
      );
      await fireEvent.click(usageTab!);

      expect(container.textContent).toContain("AI Usage");
      expect(container.textContent).toContain("Configure an API key to track usage");
    });

    it("should switch to Security tab", async () => {
      const { container } = render(() => <CortexAccountPanel />);

      const securityTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Security")
      );
      await fireEvent.click(securityTab!);

      expect(container.textContent).toContain("Security");
      expect(container.textContent).toContain("API keys are stored securely in your OS keychain");
    });

    it("should switch to API Tokens tab and show providers", async () => {
      const { container } = render(() => <CortexAccountPanel />);

      const tokensTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("API Tokens")
      );
      await fireEvent.click(tokensTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("OpenAI");
        expect(container.textContent).toContain("Anthropic");
        expect(container.textContent).toContain("OpenRouter");
        expect(container.textContent).toContain("Supermaven");
        expect(container.textContent).toContain("Google");
      });
    });

    it("should show active tab indicator", async () => {
      const { container } = render(() => <CortexAccountPanel />);

      const profileTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Profile")
      );
      expect(profileTab).toBeTruthy();

      const subTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Subscription")
      );
      await fireEvent.click(subTab!);

      expect(container.textContent).toContain("Free Plan");
    });
  });

  describe("Settings/Preferences - Subscription Section", () => {
    it("should render subscription placeholder with icon", async () => {
      const { container } = render(() => <CortexAccountPanel />);

      const subTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Subscription")
      );
      await fireEvent.click(subTab!);

      const tagIcons = container.querySelectorAll('[data-testid="icon-tag-02"]');
      expect(tagIcons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Settings/Preferences - Usage Section", () => {
    it("should render usage placeholder with chart icon", async () => {
      const { container } = render(() => <CortexAccountPanel />);

      const usageTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("AI Usage")
      );
      await fireEvent.click(usageTab!);

      const chartIcons = container.querySelectorAll('[data-testid="icon-pie-chart-01"]');
      expect(chartIcons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Settings/Preferences - Security Section", () => {
    it("should render security placeholder with shield icon", async () => {
      const { container } = render(() => <CortexAccountPanel />);

      const securityTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Security")
      );
      await fireEvent.click(securityTab!);

      const shieldIcons = container.querySelectorAll('[data-testid="icon-shield-02"]');
      expect(shieldIcons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("API Tokens Management", () => {
    it("should display all AI provider entries", async () => {
      const { container } = render(() => <CortexAccountPanel />);

      const tokensTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("API Tokens")
      );
      await fireEvent.click(tokensTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("OpenAI");
        expect(container.textContent).toContain("GPT-4, GPT-3.5");
        expect(container.textContent).toContain("Anthropic");
        expect(container.textContent).toContain("Claude models");
        expect(container.textContent).toContain("OpenRouter");
        expect(container.textContent).toContain("Multi-provider router");
        expect(container.textContent).toContain("Supermaven");
        expect(container.textContent).toContain("Code completion");
        expect(container.textContent).toContain("Google");
        expect(container.textContent).toContain("Gemini models");
      });
    });

    it("should display Add button for unconfigured providers", async () => {
      mockedInvoke.mockResolvedValue(false as never);

      const { container } = render(() => <CortexAccountPanel />);

      const tokensTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("API Tokens")
      );
      await fireEvent.click(tokensTab!);

      await vi.waitFor(() => {
        const addButtons = Array.from(container.querySelectorAll("button")).filter(
          (b) => b.textContent?.trim() === "Add"
        );
        expect(addButtons.length).toBeGreaterThan(0);
      });
    });

    it("should display Edit and Remove buttons for configured providers", async () => {
      mockedInvoke.mockImplementation(((cmd: string, args?: Record<string, unknown>) => {
        if (cmd === "settings_get_api_key_exists") {
          return Promise.resolve((args as { keyName: string })?.keyName === "openai_api_key");
        }
        return Promise.resolve(undefined);
      }) as typeof invoke);

      const { container } = render(() => <CortexAccountPanel />);

      const tokensTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("API Tokens")
      );
      await fireEvent.click(tokensTab!);

      await vi.waitFor(() => {
        const editButtons = Array.from(container.querySelectorAll("button")).filter(
          (b) => b.textContent?.trim() === "Edit"
        );
        expect(editButtons.length).toBeGreaterThan(0);

        const removeButtons = Array.from(container.querySelectorAll("button")).filter(
          (b) => b.textContent?.trim() === "Remove"
        );
        expect(removeButtons.length).toBeGreaterThan(0);
      });
    });

    it("should show key input when Add is clicked", async () => {
      mockedInvoke.mockResolvedValue(false as never);

      const { container } = render(() => <CortexAccountPanel />);

      const tokensTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("API Tokens")
      );
      await fireEvent.click(tokensTab!);

      await vi.waitFor(() => {
        const addButtons = Array.from(container.querySelectorAll("button")).filter(
          (b) => b.textContent?.trim() === "Add"
        );
        expect(addButtons.length).toBeGreaterThan(0);
      });

      const addBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Add"
      );
      await fireEvent.click(addBtn!);

      const passwordInput = container.querySelector('input[type="password"]');
      expect(passwordInput).toBeTruthy();
      expect(passwordInput?.getAttribute("placeholder")).toBe("sk-...");
    });

    it("should show Save and Cancel buttons when editing", async () => {
      mockedInvoke.mockResolvedValue(false as never);

      const { container } = render(() => <CortexAccountPanel />);

      const tokensTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("API Tokens")
      );
      await fireEvent.click(tokensTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Add");
      });

      const addBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Add"
      );
      await fireEvent.click(addBtn!);

      expect(container.textContent).toContain("Save");
      expect(container.textContent).toContain("Cancel");
    });

    it("should call settings_set_api_key when Save is clicked with a value", async () => {
      mockedInvoke.mockResolvedValue(false as never);

      const { container } = render(() => <CortexAccountPanel />);

      const tokensTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("API Tokens")
      );
      await fireEvent.click(tokensTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Add");
      });

      const addBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Add"
      );
      await fireEvent.click(addBtn!);

      const passwordInput = container.querySelector('input[type="password"]')!;
      await fireEvent.input(passwordInput, { target: { value: "sk-test-key-12345" } });

      mockedInvoke.mockResolvedValue(undefined as never);

      const saveBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Save"
      );
      await fireEvent.click(saveBtn!);

      expect(mockedInvoke).toHaveBeenCalledWith("settings_set_api_key", {
        keyName: "openai_api_key",
        apiKey: "sk-test-key-12345",
      });
    });

    it("should call settings_delete_api_key when Remove is clicked", async () => {
      mockedInvoke.mockImplementation(((cmd: string, args?: Record<string, unknown>) => {
        if (cmd === "settings_get_api_key_exists") {
          return Promise.resolve((args as { keyName: string })?.keyName === "openai_api_key");
        }
        return Promise.resolve(undefined);
      }) as typeof invoke);

      const { container } = render(() => <CortexAccountPanel />);

      const tokensTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("API Tokens")
      );
      await fireEvent.click(tokensTab!);

      await vi.waitFor(() => {
        const removeButtons = Array.from(container.querySelectorAll("button")).filter(
          (b) => b.textContent?.trim() === "Remove"
        );
        expect(removeButtons.length).toBeGreaterThan(0);
      });

      const removeBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Remove"
      );
      await fireEvent.click(removeBtn!);

      expect(mockedInvoke).toHaveBeenCalledWith("settings_delete_api_key", {
        keyName: "openai_api_key",
      });
    });

    it("should cancel editing when Cancel is clicked", async () => {
      mockedInvoke.mockResolvedValue(false as never);

      const { container } = render(() => <CortexAccountPanel />);

      const tokensTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("API Tokens")
      );
      await fireEvent.click(tokensTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Add");
      });

      const addBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Add"
      );
      await fireEvent.click(addBtn!);

      expect(container.querySelector('input[type="password"]')).toBeTruthy();

      const cancelBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Cancel"
      );
      await fireEvent.click(cancelBtn!);

      expect(container.querySelector('input[type="password"]')).toBeFalsy();
    });

    it("should show keychain info text", async () => {
      const { container } = render(() => <CortexAccountPanel />);

      const tokensTab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("API Tokens")
      );
      await fireEvent.click(tokensTab!);

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Manage API keys for AI providers");
        expect(container.textContent).toContain("Keys are stored in your OS keychain");
      });
    });
  });
});
