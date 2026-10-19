import { Disc } from "lucide-react";

/** 音名转换：root 0-11 + mode → C / C# / D ... 带大小调色彩。 */
export function rootToName(root: number, mode?: "major" | "minor"): string {
  const sharps = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flats =  ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  // 大调用升号，小调用降号（惯例）—— 但 A 例外（A minor 常用 A 而非 Bb 系）
  if (mode === "minor" && root !== 9) return flats[root % 12];
  return sharps[root % 12];
}

/** quality → 显示标签。 */
export function qualityLabel(q: string): string {
  const map: Record<string, string> = {
    maj: "", min: "m", dim: "°", aug: "+",
    sus4: "sus4", sus2: "sus2",
    "7": "7", maj7: "maj7", min7: "m7",
    dim7: "°7", half_dim7: "ø7", aug7: "+7",
  };
  return map[q] ?? q;
}

/** 结构段 label → 背景色。 */
export function sectionColor(label: string): string {
  const map: Record<string, string> = {
    intro:      "#5B8DEF",
    pre:        "#8FB3F5",
    verse:      "#6DBF8F",
    prechorus:  "#A8D5BB",
    chorus:     "#E8805C",
    bridge:     "#C46CC4",
    drop:       "#E6B347",
    outro:      "#8888aa",
    outro_2:    "#aaaaaa",
    full:       "#8888aa",
  };
  return map[label] ?? "#bbbbbb";
}

export const SECTION_ORDER = ["intro", "pre", "verse", "prechorus", "chorus", "bridge", "drop", "outro"];

export { Disc };
