import { LEAD_STAGES, type LeadStage } from "@/lib/leads";
import { LEAD_STAGE_COLORS, LEAD_STAGE_LABELS } from "@/lib/lead-stage-ui";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function mapPinStageColor(stage: string): string {
  return LEAD_STAGE_COLORS[stage as LeadStage] ?? LEAD_STAGE_COLORS.cold;
}

function dotInlineStyle(color: string): string {
  return [
    "display:inline-block",
    "width:10px",
    "height:10px",
    "border-radius:9999px",
    `background:${color}`,
    "border:2px solid #fff",
    "box-shadow:0 0 0 1px rgba(15,23,42,0.2)",
    "flex-shrink:0",
  ].join(";");
}

function stageOptionButton(stage: LeadStage, selected: boolean): string {
  const color = mapPinStageColor(stage);
  return `<li role="presentation">
    <button
      type="button"
      class="map-pin-stage-option${selected ? " map-pin-stage-option--selected" : ""}"
      data-value="${escapeHtml(stage)}"
      role="option"
      aria-selected="${selected ? "true" : "false"}"
    >
      <span class="map-pin-stage-dot" style="${dotInlineStyle(color)}"></span>
      <span class="map-pin-stage-option-label">${escapeHtml(LEAD_STAGE_LABELS[stage])}</span>
    </button>
  </li>`;
}

function setPickerValue(root: HTMLElement, stage: LeadStage): void {
  root.dataset.value = stage;
  const color = mapPinStageColor(stage);
  const triggerDot = root.querySelector(".map-pin-stage-trigger .map-pin-stage-dot") as HTMLElement | null;
  const triggerLabel = root.querySelector(".map-pin-stage-trigger-label");
  if (triggerDot) triggerDot.style.cssText = dotInlineStyle(color);
  if (triggerLabel) triggerLabel.textContent = LEAD_STAGE_LABELS[stage];

  root.querySelectorAll<HTMLButtonElement>(".map-pin-stage-option").forEach((btn) => {
    const isSelected = btn.dataset.value === stage;
    btn.classList.toggle("map-pin-stage-option--selected", isSelected);
    btn.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
}

function closePickerMenu(root: HTMLElement): void {
  const menu = root.querySelector(".map-pin-stage-menu") as HTMLElement | null;
  const trigger = root.querySelector(".map-pin-stage-trigger") as HTMLButtonElement | null;
  if (menu) menu.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

function openPickerMenu(root: HTMLElement): void {
  const menu = root.querySelector(".map-pin-stage-menu") as HTMLElement | null;
  const trigger = root.querySelector(".map-pin-stage-trigger") as HTMLButtonElement | null;
  if (menu) menu.hidden = false;
  if (trigger) trigger.setAttribute("aria-expanded", "true");
}

/** Wire up the custom stage picker inside a Leaflet popup. Returns cleanup. */
export function initMapPinStageDropdown(
  root: HTMLElement,
  onChange: (stage: LeadStage) => void
): () => void {
  const trigger = root.querySelector(".map-pin-stage-trigger") as HTMLButtonElement | null;
  if (!trigger) return () => {};

  const current = (root.dataset.value as LeadStage) || "cold";
  setPickerValue(root, LEAD_STAGES.includes(current) ? current : "cold");

  const onDocumentClick = (e: MouseEvent) => {
    if (!root.contains(e.target as Node)) closePickerMenu(root);
  };

  const onTriggerClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = root.querySelector(".map-pin-stage-menu") as HTMLElement | null;
    if (menu?.hidden) {
      openPickerMenu(root);
      document.addEventListener("click", onDocumentClick);
    } else {
      closePickerMenu(root);
      document.removeEventListener("click", onDocumentClick);
    }
  };

  const onOptionClick = (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest(".map-pin-stage-option") as HTMLButtonElement | null;
    if (!btn?.dataset.value) return;
    e.preventDefault();
    e.stopPropagation();
    const stage = btn.dataset.value as LeadStage;
    if (!LEAD_STAGES.includes(stage)) return;
    setPickerValue(root, stage);
    closePickerMenu(root);
    document.removeEventListener("click", onDocumentClick);
    onChange(stage);
  };

  trigger.addEventListener("click", onTriggerClick);
  root.addEventListener("click", onOptionClick);

  return () => {
    document.removeEventListener("click", onDocumentClick);
    trigger.removeEventListener("click", onTriggerClick);
    root.removeEventListener("click", onOptionClick);
    closePickerMenu(root);
  };
}

/** Custom stage dropdown for Leaflet marker popups (dots on every option). */
export function buildMapPinStageSelectHtml(slug: string, stage: LeadStage): string {
  const safeStage = LEAD_STAGES.includes(stage) ? stage : "cold";
  const color = mapPinStageColor(safeStage);
  const options = LEAD_STAGES.map((s) => stageOptionButton(s, s === safeStage)).join("");

  return `<div class="map-pin-stage-row">
    <label class="map-pin-stage-label">Lead stage</label>
    <div class="map-pin-stage-picker" data-slug="${escapeHtml(slug)}" data-value="${escapeHtml(safeStage)}">
      <button type="button" class="map-pin-stage-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="map-pin-stage-dot" style="${dotInlineStyle(color)}"></span>
        <span class="map-pin-stage-trigger-label">${escapeHtml(LEAD_STAGE_LABELS[safeStage])}</span>
        <span class="map-pin-stage-chevron" aria-hidden="true">▾</span>
      </button>
      <ul class="map-pin-stage-menu" role="listbox" hidden>${options}</ul>
    </div>
  </div>`;
}
