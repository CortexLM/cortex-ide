import { Navigate } from "@solidjs/router";
import { getWindowLabel } from "@/utils/windowStorage";

export default function Home() {
  const label = getWindowLabel();
  const currentProject =
    localStorage.getItem(`cortex_current_project_${label}`) ||
    localStorage.getItem("cortex_current_project");

  return <Navigate href={currentProject ? "/session" : "/welcome"} />;
}
