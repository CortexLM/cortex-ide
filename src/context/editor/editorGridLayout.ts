import { batch } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import type { EditorGroup, EditorSplit } from "../../types";
import type { EditorUIState } from "./EditorUIContext";
import { generateId } from "./languageDetection";

export function createGridLayoutOps(
  _state: EditorUIState,
  setState: SetStoreFunction<EditorUIState>,
) {
  const createGridLayout = (preset: "2x2" | "3x2" | "2x1" | "3x1") => {
    const presetConfig: Record<string, { cols: number; rows: number }> = {
      "2x1": { cols: 2, rows: 1 },
      "3x1": { cols: 3, rows: 1 },
      "2x2": { cols: 2, rows: 2 },
      "3x2": { cols: 3, rows: 2 },
    };
    const { cols, rows } = presetConfig[preset];
    const totalGroups = cols * rows;
    const newGroups: EditorGroup[] = [];
    const newSplits: EditorSplit[] = [];

    for (let i = 0; i < totalGroups; i++) {
      newGroups.push({
        id: `group-${generateId()}-${i}`,
        fileIds: [],
        activeFileId: null,
        splitRatio: 1 / totalGroups,
      });
    }

    for (let c = 0; c < cols - 1; c++) {
      newSplits.push({
        id: `split-h-${generateId()}-${c}`,
        direction: "horizontal",
        firstGroupId: newGroups[c * rows].id,
        secondGroupId: newGroups[(c + 1) * rows].id,
        ratio: (c + 1) / cols,
      });
    }

    if (rows > 1) {
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows - 1; r++) {
          newSplits.push({
            id: `split-v-${generateId()}-${c}-${r}`,
            direction: "vertical",
            firstGroupId: newGroups[c * rows + r].id,
            secondGroupId: newGroups[c * rows + r + 1].id,
            ratio: (r + 1) / rows,
          });
        }
      }
    }

    batch(() => {
      setState("groups", newGroups);
      setState("splits", newSplits);
      setState("activeGroupId", newGroups[0].id);
      setState("maximizedGroupId", null);
    });
  };

  const updateSplitRatio = (splitId: string, ratio: number) => {
    const clampedRatio = Math.max(0.15, Math.min(0.85, ratio));
    setState(
      "splits",
      (s) => s.id === splitId,
      "ratio",
      clampedRatio,
    );
  };

  return {
    createGridLayout,
    updateSplitRatio,
  };
}
