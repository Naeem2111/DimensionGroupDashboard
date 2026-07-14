"use client";

import { useRef, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { AvatarColorPicker } from "@/components/ops/AvatarColorPicker";
import { AvatarTextTonePicker } from "@/components/ops/AvatarTextTonePicker";
import type { AvatarTextTone } from "@/lib/avatar-text-tone";
import { DEFAULT_AVATAR_BG } from "@/lib/hex-color";

type AvatarUploadFieldProps = {
  label: string;
  displayName: string;
  photoUrl: string;
  backgroundColor: string;
  textTone: AvatarTextTone;
  onPhotoUrlChange: (url: string) => void;
  onBackgroundColorChange: (hex: string) => void;
  onTextToneChange: (tone: AvatarTextTone) => void;
  /** When set, enables PNG/file upload to this endpoint. */
  uploadPath?: string;
  objectFit?: "contain" | "cover";
  hint?: string;
};

export function AvatarUploadField({
  label,
  displayName,
  photoUrl,
  backgroundColor,
  textTone,
  onPhotoUrlChange,
  onBackgroundColorChange,
  onTextToneChange,
  uploadPath,
  objectFit = "cover",
  hint = "Upload a PNG or image file, or paste a direct link. Initials show until a photo is set.",
}: AvatarUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function onFileSelected(file: File | null) {
    if (!file || !uploadPath) return;
    setUploadError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.set("photo", file);
      const r = await fetch(uploadPath, { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) {
        setUploadError(j.error || "Upload failed");
        return;
      }
      onPhotoUrlChange(j.photoUrl ?? j.profilePhotoUrl ?? "");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (uploadPath && photoUrl.startsWith("/uploads/")) {
      await fetch(uploadPath, { method: "DELETE" }).catch(() => {});
    }
    onPhotoUrlChange("");
  }

  const previewUrl = photoUrl.trim() || null;
  const bg = backgroundColor || DEFAULT_AVATAR_BG;

  return (
    <div className="md:col-span-2 space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <ClientAvatar
          name={displayName}
          logoUrl={previewUrl}
          backgroundColor={bg}
          textTone={textTone}
          size={56}
          objectFit={objectFit}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs font-medium text-slate-400">{label}</p>
          {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
          {uploadPath ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="btn-secondary rounded-lg px-3 py-1.5 text-xs text-slate-200"
              >
                {uploading ? "Uploading…" : "Upload image"}
              </button>
              {previewUrl ? (
                <button
                  type="button"
                  onClick={() => void removePhoto()}
                  className="text-xs text-slate-500 hover:text-red-300"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
          ) : null}
          {uploadError ? <p className="text-xs text-red-400">{uploadError}</p> : null}
          <AvatarColorPicker
            label="Circle background colour"
            value={bg}
            onChange={onBackgroundColorChange}
            hint="Used behind transparent PNGs and for initials."
          />
          <AvatarTextTonePicker value={textTone} onChange={onTextToneChange} />
        </div>
      </div>
    </div>
  );
}
