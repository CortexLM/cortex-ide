import { onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { getWindowLabel } from "@/utils/windowStorage";
import { LoadingSpinner } from "@/components/ui";

export default function Home() {
  const navigate = useNavigate();

  onMount(async () => {
    const label = getWindowLabel();
    
    // Check URL parameters (highest priority)
    const params = new URLSearchParams(window.location.search);
    const urlProject = params.get("project");
    
    if (urlProject) {
      localStorage.setItem(`cortex_current_project_${label}`, urlProject);
    }

    // Check if there's a project open
    const currentProject = localStorage.getItem(`cortex_current_project_${label}`) 
      || localStorage.getItem("cortex_current_project");
    
    if (currentProject) {
      // Project is open - go to session
      navigate("/session");
    } else {
      // No project - go to welcome page
      navigate("/welcome");
    }
  });

  // Simple loading state while redirecting
  return (
    <div 
      style={{ 
        height: "100%", 
        display: "flex", 
        "align-items": "center", 
        "justify-content": "center",
        background: "var(--cortex-bg-primary)" 
      }}
    >
      <LoadingSpinner size="md" />
    </div>
  );
}
