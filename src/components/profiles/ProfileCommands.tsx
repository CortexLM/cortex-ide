import { onMount, onCleanup } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useProfiles } from "@/context/ProfilesContext";

/**
 * ProfileCommands registers profile-related commands in the command palette.
 * This component should be placed where both ProfilesContext and CommandContext are available.
 */
export function ProfileCommands() {
  const { registerCommand, unregisterCommand } = useCommands();
  const { 
    profiles, 
    activeProfile, 
    switchProfile, 
    openQuickSwitch, 
    openManager 
  } = useProfiles();

  onMount(() => {
    // Register profile commands
    const commands = [
      {
        id: "profiles.switchProfile",
        label: "Switch Profile",
        shortcut: "Ctrl+Alt+P",
        category: "Profiles",
        action: () => openQuickSwitch(),
      },
      {
        id: "profiles.manageProfiles",
        label: "Manage Profiles",
        category: "Profiles",
        action: () => openManager(),
      },
      {
        id: "profiles.createProfile",
        label: "Create New Profile",
        category: "Profiles",
        action: async () => {
          // Open manager in create mode
          openManager();
          // Use a small delay to ensure the manager is open
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("profiles:start-create"));
          }, 100);
        },
      },
      {
        id: "profiles.exportCurrentProfile",
        label: "Export Current Profile",
        category: "Profiles",
        action: () => {
          const profile = activeProfile();
          if (profile) {
            window.dispatchEvent(new CustomEvent("profiles:export", { 
              detail: { profileId: profile.id } 
            }));
          }
        },
      },
      {
        id: "profiles.importProfile",
        label: "Import Profile",
        category: "Profiles",
        action: () => {
          openManager();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("profiles:start-import"));
          }, 100);
        },
      },
      {
        id: "profiles.duplicateCurrentProfile",
        label: "Duplicate Current Profile",
        category: "Profiles",
        action: () => {
          const profile = activeProfile();
          if (profile) {
            window.dispatchEvent(new CustomEvent("profiles:duplicate", { 
              detail: { profileId: profile.id } 
            }));
          }
        },
      },
      {
        id: "profiles.switchToDefault",
        label: "Switch to Default Profile",
        category: "Profiles",
        action: () => switchProfile("default"),
      },
    ];

    // Register all commands
    commands.forEach(cmd => registerCommand(cmd));

    // Cleanup
    onCleanup(() => {
      commands.forEach(cmd => unregisterCommand(cmd.id));
    });
  });

  // Dynamic profile switch commands
  onMount(() => {
    let registeredProfileIds: string[] = [];

    const updateProfileCommands = () => {
      // Unregister old profile-specific commands
      registeredProfileIds.forEach(id => {
        unregisterCommand(`profiles.switchTo.${id}`);
      });

      // Register new profile-specific commands
      registeredProfileIds = profiles().map(profile => {
        const cmdId = `profiles.switchTo.${profile.id}`;
        registerCommand({
          id: cmdId,
          label: `Switch to Profile: ${profile.name}`,
          category: "Profiles",
          action: () => switchProfile(profile.id),
        });
        return profile.id;
      });
    };

    // Initial registration
    updateProfileCommands();

    // Listen for profile changes
    const handleProfilesChanged = () => updateProfileCommands();
    window.addEventListener("profiles:created", handleProfilesChanged);
    window.addEventListener("profiles:deleted", handleProfilesChanged);
    window.addEventListener("profiles:updated", handleProfilesChanged);
    window.addEventListener("profiles:imported", handleProfilesChanged);

    onCleanup(() => {
      registeredProfileIds.forEach(id => {
        unregisterCommand(`profiles.switchTo.${id}`);
      });
      window.removeEventListener("profiles:created", handleProfilesChanged);
      window.removeEventListener("profiles:deleted", handleProfilesChanged);
      window.removeEventListener("profiles:updated", handleProfilesChanged);
      window.removeEventListener("profiles:imported", handleProfilesChanged);
    });
  });

  return null;
}
