export const PRACTICE_SOFTWARE_OPTIONS = [
  { id: "revit", label: "Revit" },
  { id: "autocad", label: "AutoCAD" },
  { id: "sketchup", label: "SketchUp" },
  { id: "archicad", label: "Archicad" },
  { id: "rhino", label: "Rhino" },
  { id: "vectorworks", label: "Vectorworks" },
  { id: "other", label: "Other" },
] as const;

export type PracticeSoftwareId = (typeof PRACTICE_SOFTWARE_OPTIONS)[number]["id"];

const LABEL_BY_ID = Object.fromEntries(
  PRACTICE_SOFTWARE_OPTIONS.map((o) => [o.id, o.label])
) as Record<PracticeSoftwareId, string>;

export function isPracticeSoftwareId(value: string): value is PracticeSoftwareId {
  return value in LABEL_BY_ID;
}

export function formatPracticeSoftware(
  software?: string | null,
  softwareOther?: string | null
): string | null {
  if (!software?.trim()) return null;
  if (software === "other") {
    const other = softwareOther?.trim();
    return other || "Other";
  }
  if (isPracticeSoftwareId(software)) return LABEL_BY_ID[software];
  return software;
}
