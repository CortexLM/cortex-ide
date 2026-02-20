export function getWindowLabel(): string {
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("window") || "main";
  }
  return "main";
}

/**
 * Gets a storage value, preferring window-specific storage if it exists,
 * otherwise falling back to global storage.
 */
export function getStorageItem(key: string, useSession: boolean = false): string | null {
  const label = getWindowLabel();
  const windowKey = `${key}_${label}`;
  
  // Try window-specific storage first
  let val = useSession ? sessionStorage.getItem(windowKey) : localStorage.getItem(windowKey);
  if (val !== null) return val;
  
  // Fallback to global storage if it's the main window or not found
  return useSession ? sessionStorage.getItem(key) : localStorage.getItem(key);
}

/**
 * Sets a storage value, using a window-specific key.
 */
export function setStorageItem(key: string, value: string, useSession: boolean = false): void {
  const label = getWindowLabel();
  const windowKey = `${key}_${label}`;
  
  if (useSession) {
    sessionStorage.setItem(windowKey, value);
  } else {
    localStorage.setItem(windowKey, value);
  }
  
  // Also update global key if it's the main window
  if (label === "main") {
    if (useSession) {
      sessionStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  }
}

/**
 * Initializes window storage from URL parameters if present.
 */
export function initializeWindowStorage(): void {
  if (typeof window === "undefined") return;
  
  const urlParams = new URLSearchParams(window.location.search);
  const label = urlParams.get("window") || "main";
  const project = urlParams.get("project");
  
  if (project) {
    localStorage.setItem(`cortex_current_project_${label}`, project);
    if (label === "main") localStorage.setItem("cortex_current_project", project);
  }
}
