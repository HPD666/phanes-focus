import {
  Activity,
  AlertTriangle,
  Building2,
  CloudSun,
  History,
  Layers,
  Leaf,
  Radio,
  Scan,
  ScrollText,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type LayerId =
  | "core"
  | "history"
  | "inscriptions"
  | "energy"
  | "weather"
  | "flow"
  | "biosphere"
  | "structure"
  | "signals"
  | "anomalies"
  | "omni";

export interface FocusLayer {
  id: LayerId;
  name: string;
  code: string;
  tagline: string;
  color: string;
  icon: LucideIcon;
  hotkey: string;
  super: boolean;
}

/** The ten analysis layers, plus OMNI — the super layer that renders every
 *  layer at once. */
export const LAYERS: FocusLayer[] = [
  {
    id: "core",
    name: "Core",
    code: "CORE",
    tagline: "Live structural scan of the scene",
    color: "#52e0ff",
    icon: Scan,
    hotkey: "1",
    super: false,
  },
  {
    id: "history",
    name: "History",
    code: "HIST",
    tagline: "Past captures ghosted over the present",
    color: "#ffb454",
    icon: History,
    hotkey: "2",
    super: false,
  },
  {
    id: "inscriptions",
    name: "Inscriptions",
    code: "TEXT",
    tagline: "Hidden & visible text read by on-device OCR",
    color: "#c3a1ff",
    icon: ScrollText,
    hotkey: "3",
    super: false,
  },
  {
    id: "energy",
    name: "Energy",
    code: "PWR",
    tagline: "Signal filaments & energy-dense regions",
    color: "#ffcf3f",
    icon: Zap,
    hotkey: "4",
    super: false,
  },
  {
    id: "weather",
    name: "Weather",
    code: "MET",
    tagline: "Live atmospheric telemetry",
    color: "#6fb5ff",
    icon: CloudSun,
    hotkey: "5",
    super: false,
  },
  {
    id: "flow",
    name: "Flow",
    code: "FLW",
    tagline: "Movement & operator activity around you",
    color: "#ff8fa3",
    icon: Activity,
    hotkey: "6",
    super: false,
  },
  {
    id: "biosphere",
    name: "Biosphere",
    code: "BIO",
    tagline: "Vegetation signal & green mass",
    color: "#7dff9b",
    icon: Leaf,
    hotkey: "7",
    super: false,
  },
  {
    id: "structure",
    name: "Structure",
    code: "STR",
    tagline: "Edge mass, forms & built density",
    color: "#9fb6ff",
    icon: Building2,
    hotkey: "8",
    super: false,
  },
  {
    id: "signals",
    name: "Signals",
    code: "RF",
    tagline: "Network & beacon telemetry",
    color: "#2ff3e0",
    icon: Radio,
    hotkey: "9",
    super: false,
  },
  {
    id: "anomalies",
    name: "Anomalies",
    code: "ANM",
    tagline: "Deviations from your measured baseline",
    color: "#ff5d6c",
    icon: AlertTriangle,
    hotkey: "0",
    super: false,
  },
  {
    id: "omni",
    name: "Omni",
    code: "OMNI",
    tagline: "Every layer rendered at once",
    color: "#e8f6ff",
    icon: Layers,
    hotkey: "o",
    super: true,
  },
];

export const LAYER_MAP: Record<LayerId, FocusLayer> = Object.fromEntries(
  LAYERS.map((l) => [l.id, l]),
) as Record<LayerId, FocusLayer>;

export const ACTIVE_LAYERS: FocusLayer[] = LAYERS.filter((l) => !l.super);