/**
 * Mode detection for Teacher AI assessment generator.
 * Defaults to the Type dropdown mode (currentMode).
 * Only overrides if the prompt explicitly mentions another format.
 */
export type AssessmentMode = "oral" | "written" | "quiz";

export function detectMode(text: string, currentMode: string = "oral"): AssessmentMode {
  const lower = (text || "").toLowerCase();

  // Explicit keyword checks in priority order
  if (lower.includes("mcq") || lower.includes("multiple choice") || lower.includes("quiz")) {
    return "quiz";
  }
  if (lower.includes("written") || lower.includes("reference answer")) {
    return "written";
  }
  if (lower.includes("viva") || lower.includes("oral")) {
    return "oral";
  }

  // Fallback to dropdown value if valid, otherwise "oral"
  if (currentMode === "quiz" || currentMode === "written" || currentMode === "oral") {
    return currentMode as AssessmentMode;
  }
  return "oral";
}
