import type { PlannedWorld } from "./types";

/** Worlds designed but not built yet. The picker lists them as planned. */
export const plannedWorlds: PlannedWorld[] = [
  {
    id: "gardener",
    name: "Gardener",
    description:
      "Planting plans. Work grows from seed to bloom; stale work wilts.",
    homeName: "The Homestead",
  },
  {
    id: "samurai",
    name: "Samurai",
    description:
      "Ink-wash campaign scrolls. Clans, retainers and sealed decisions.",
    homeName: "The Castle",
  },
  {
    id: "doctor",
    name: "Doctor",
    description:
      "Ward boards and vitals monitors. Rounds, lab results and diagnoses.",
    homeName: "The Nurses' Station",
  },
];
