import { Show, For, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { useProfiles, type Profile } from "@/context/ProfilesContext";
import { Icon } from "../ui/Icon";
import type { JSX } from "solid-js";

// Icon name mapping for profiles
const ICON_NAME_MAP: Record<string, string> = {
  user: "user",
  code: "code",
  terminal: "terminal",
  star: "star",
  sun: "sun",
  moon: "moon",
  cloud: "cloud",
  home: "house",
  globe: "globe",
  folder: "folder",
  gear: "gear",
  book: "book",
  coffee: "mug-hot",
  heart: "heart",
  lightning: "bolt",
  rocket: "box",
  briefcase: "briefcase",
  beaker: "feather",
  palette: "feather",
  bug: "feather",
};

export function getProfileIcon(iconName?: string, size?: number): JSX.Element {
  const mappedName = ICON_NAME_MAP[iconName || "user"] || "user";
  return <Icon name={mappedName} size={size || 16} />;
}

interface ProfileSwitcherProps {
  /** Render as a minimal button (for status bar) */
  minimal?: boolean;
}

export function ProfileSwitcher(_props: ProfileSwitcherProps) {
  const { 
    profiles, 
    activeProfile, 
    switchProfile, 
    showQuickSwitch, 
    closeQuickSwitch,
    createProfile,
  } = useProfiles();
  
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [searchQuery, setSearchQuery] = createSignal("");
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Reset selection when opening
  createEffect(() => {
    if (showQuickSwitch()) {
      setSelectedIndex(0);
      setSearchQuery("");
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  // Filtered profiles based on search
  const filteredProfiles = () => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return profiles();
    return profiles().filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.icon && p.icon.toLowerCase().includes(query))
    );
  };

  // Keyboard navigation
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showQuickSwitch()) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredProfiles().length - 1));
          scrollToSelected();
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          scrollToSelected();
          break;
        case "Enter":
          e.preventDefault();
          const selected = filteredProfiles()[selectedIndex()];
          if (selected) {
            switchProfile(selected.id);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeQuickSwitch();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const scrollToSelected = () => {
    if (listRef) {
      const items = listRef.querySelectorAll("[data-profile-item]");
      const selected = items[selectedIndex()];
      if (selected) {
        selected.scrollIntoView({ block: "nearest" });
      }
    }
  };

  const handleProfileClick = (profile: Profile) => {
    switchProfile(profile.id);
  };

  const handleCreateNew = () => {
    closeQuickSwitch();
    // Open create dialog via manager
    createProfile("New Profile");
  };

  const containerStyle: JSX.CSSProperties = {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    display: "flex",
    "align-items": "flex-start",
    "justify-content": "center",
    "padding-top": "15vh",
    background: "var(--jb-overlay-backdrop)",
    "z-index": "var(--cortex-z-highest)",
  };

  const panelStyle: JSX.CSSProperties = {
    width: "500px",
    "max-width": "90vw",
    background: "var(--jb-modal)",
    "border-radius": "var(--jb-radius-lg)",
    "box-shadow": "var(--jb-shadow-modal)",
    overflow: "hidden",
    display: "flex",
    "flex-direction": "column",
    "max-height": "60vh",
  };

  const searchStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "12px 16px",
    "border-bottom": "1px solid var(--jb-border-default)",
  };

  const inputStyle: JSX.CSSProperties = {
    flex: "1",
    background: "transparent",
    border: "none",
    outline: "none",
    "font-family": "var(--jb-font-ui)",
    "font-size": "14px",
    color: "var(--jb-text-body-color)",
  };

  const listStyle: JSX.CSSProperties = {
    "overflow-y": "auto",
    "max-height": "400px",
  };

  const itemStyle = (isSelected: boolean, isActive: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "10px 16px",
    cursor: "pointer",
    background: isSelected ? "var(--jb-surface-hover)" : "transparent",
    "border-left": isActive ? "2px solid var(--jb-accent)" : "2px solid transparent",
  });

  const iconWrapperStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    "border-radius": "var(--jb-radius-md)",
    background: "var(--jb-surface-alt)",
    color: "var(--jb-text-body-color)",
  };

  const nameStyle: JSX.CSSProperties = {
    flex: "1",
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--jb-text-body-color)",
  };

  const badgeStyle: JSX.CSSProperties = {
    "font-size": "11px",
    padding: "2px 6px",
    "border-radius": "var(--jb-radius-sm)",
    background: "var(--jb-surface-alt)",
    color: "var(--jb-text-muted-color)",
  };

  const footerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 16px",
    "border-top": "1px solid var(--jb-border-default)",
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
  };

  const createButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    padding: "4px 8px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    cursor: "pointer",
    "font-family": "var(--jb-font-ui)",
    "font-size": "12px",
    color: "var(--jb-accent)",
  };

  return (
    <Show when={showQuickSwitch()}>
      <Portal>
        <div 
          style={containerStyle} 
          onClick={(e) => {
            if (e.target === e.currentTarget) closeQuickSwitch();
          }}
        >
          <div style={panelStyle}>
            {/* Search Input */}
            <div style={searchStyle}>
              <Icon name="user" size={16} style={{ color: "var(--jb-text-muted-color)" }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search profiles..."
                style={inputStyle}
                value={searchQuery()}
                onInput={(e) => {
                  setSearchQuery(e.currentTarget.value);
                  setSelectedIndex(0);
                }}
              />
            </div>

            {/* Profile List */}
            <div ref={listRef} style={listStyle}>
              <For each={filteredProfiles()}>
                {(profile, index) => {
                  const isSelected = () => index() === selectedIndex();
                  const isActive = () => profile.id === activeProfile()?.id;
                  
                  return (
                    <div
                      data-profile-item
                      style={itemStyle(isSelected(), isActive())}
                      onClick={() => handleProfileClick(profile)}
                      onMouseEnter={() => setSelectedIndex(index())}
                    >
                      <div style={iconWrapperStyle}>
                        {getProfileIcon(profile.icon)}
                      </div>
                      <span style={nameStyle}>{profile.name}</span>
                      <Show when={profile.isDefault}>
                        <span style={badgeStyle}>Default</span>
                      </Show>
                      <Show when={isActive()}>
                        <Icon name="check" size={16} style={{ color: "var(--jb-success)" }} />
                      </Show>
                    </div>
                  );
                }}
              </For>
              
              <Show when={filteredProfiles().length === 0}>
                <div style={{ 
                  padding: "24px", 
                  "text-align": "center", 
                  color: "var(--jb-text-muted-color)",
                  "font-size": "13px",
                }}>
                  No profiles found
                </div>
              </Show>
            </div>

            {/* Footer */}
            <div style={footerStyle}>
              <span>Press Enter to switch, Esc to cancel</span>
              <button 
                style={createButtonStyle}
                onClick={handleCreateNew}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Icon name="plus" size={14} />
                New Profile
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

/** Minimal profile indicator for status bar */
export function ProfileStatusBarItem() {
  const { activeProfile, openQuickSwitch } = useProfiles();

  const buttonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
    padding: "2px 6px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    cursor: "pointer",
    "font-family": "var(--jb-font-ui)",
    "font-size": "12px",
    color: "var(--jb-text-muted-color)",
  };

  return (
    <button
      style={buttonStyle}
      onClick={openQuickSwitch}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      title={`Active Profile: ${activeProfile()?.name || "Default"}`}
    >
      {getProfileIcon(activeProfile()?.icon, 14)}
      <span>{activeProfile()?.name || "Default"}</span>
    </button>
  );
}
