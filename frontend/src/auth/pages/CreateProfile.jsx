import React, { useState } from "react";
import AuthCard from "../components/AuthCard";
import AuthInput from "../components/AuthInput";
import AuthButton from "../components/AuthButton";
import { updateDiaryProfile } from "../authApi";

const toAvatarPayload = (value) => {
  if (!value) return null;
  const avatar = String(value).trim();
  if (!avatar) return null;
  if (avatar.startsWith("b64url:")) return avatar;
  const encodeB64Url = (base64) =>
    `b64url:${base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
  if (avatar.startsWith("data:")) {
    const [, base64 = ""] = avatar.split(",");
    return base64 ? encodeB64Url(base64) : null;
  }
  return encodeB64Url(avatar);
};

export default function CreateProfile({ navigate }) {
  const [displayName, setDisplayName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [banner, setBanner] = useState(null);

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

  const compressAvatar = async (file) => {
    const dataUrl = await fileToDataUrl(file);
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = dataUrl;
    });

    const maxSize = 256;
    const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.75);
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5 MB max)
    if (file.size > 5 * 1024 * 1024) {
      setBanner({ type: "error", text: "Avatar file must be 5 MB or less." });
      return;
    }

    setAvatarProcessing(true);
    try {
      const compressed = await compressAvatar(file);
      setAvatarPreview(compressed);
      setBanner(null);
    } catch {
      setBanner({ type: "error", text: "Unable to process avatar image." });
    } finally {
      setAvatarProcessing(false);
    }
  };

  const handleContinue = async () => {
    setBanner(null);
    if (avatarProcessing) return;
    const trimmedName = displayName.trim();
    const trimmedBio = bio.trim();
    const avatar = toAvatarPayload(avatarPreview);

    if (!trimmedName && !trimmedBio && !avatar) {
      navigate("dashboard");
      return;
    }
    setLoading(true);
    try {
      await updateDiaryProfile({
        ...(trimmedName ? { fullName: trimmedName } : {}),
        ...(trimmedBio ? { bio: trimmedBio } : {}),
        ...(avatar ? { avatar } : {}),
      });
      setBanner({ type: "success", text: "Profile updated." });
      setTimeout(() => navigate("dashboard"), 600);
    } catch (err) {
      setBanner({
        type: "error",
        text: err?.message || "Unable to update profile. Try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Create profile" subtitle="Personalize your space">
      {banner && (
        <div className={`auth-banner ${banner.type === "error" ? "error" : ""}`}>
          {banner.text}
        </div>
      )}
      <div className="auth-center">
        <div className="profile-avatar">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Avatar"
              style={{ width: "100%", height: "100%", borderRadius: "50%" }}
            />
          ) : (
            "Upload profile"
          )}
        </div>
        <label className="auth-link auth-upload-link">
          Upload
          <input type="file" accept="image/*" onChange={handleAvatar} hidden />
        </label>
      </div>
      <AuthInput
        label="Display name"
        value={displayName}
        onChange={setDisplayName}
        placeholder="Your name"
        disabled={loading}
      />
      <AuthInput
        label="Bio"
        value={bio}
        onChange={setBio}
        placeholder="Tell your friends about you"
        disabled={loading}
      />
      <AuthButton block onClick={handleContinue} disabled={loading || avatarProcessing}>
        {avatarProcessing ? "Processing image..." : loading ? "Saving..." : "Continue"}
      </AuthButton>
    </AuthCard>
  );
}
