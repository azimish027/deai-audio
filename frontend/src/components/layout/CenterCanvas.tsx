import { RepairWorkspace } from "../workspaces/repair/RepairWorkspace";
import { ReferenceWorkspace } from "../workspaces/reference/ReferenceWorkspace";
import { ComposeWorkspace } from "../workspaces/compose/ComposeWorkspace";
import { LyricWorkspace } from "../workspaces/lyric/LyricWorkspace";
import { LearnWorkspace } from "../workspaces/learn/LearnWorkspace";
import { useUIStore } from "../../stores/uiStore";

/** Center 主画布：按 currentWorkspace 切换对应工作区。 */
export function CenterCanvas() {
  const ws = useUIStore((s) => s.currentWorkspace);
  return (
    <main className="flex-1 bg-notion-bg overflow-hidden relative">
      {ws === "repair"    && <RepairWorkspace />}
      {ws === "reference" && <ReferenceWorkspace />}
      {ws === "compose"   && <ComposeWorkspace />}
      {ws === "lyric"     && <LyricWorkspace />}
      {ws === "learn"     && <LearnWorkspace />}
    </main>
  );
}
