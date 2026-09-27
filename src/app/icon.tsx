import { iconImage } from "./_brand/icon-image";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return iconImage(32, { padding: 0.1 });
}
