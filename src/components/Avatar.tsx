import { useState } from "react";
import { initialsAvatar } from "../game/data";

interface Props {
  name: string;
  src?: string;
  size: number;
  ring?: string;
  className?: string;
}

export default function Avatar({ name, src, size, ring = "#c9a063", className = "" }: Props) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = src && failed !== src ? src : initialsAvatar(name);
  return (
    <img
      src={url}
      alt={name}
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setFailed(src ?? null)}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{
        width: size,
        height: size,
        border: `${size >= 60 ? 3 : 2}px solid ${ring}`,
        boxShadow: ring === "transparent" ? undefined : `0 0 0 2px #000, 0 0 ${Math.round(size / 4)}px ${ring}88`,
        background: "#222",
      }}
    />
  );
}
