import { iconImage } from "./_brand/icon-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // iOS applies its own rounded mask.
  return iconImage(180, { radius: 0 });
}
