import { notFound } from "next/navigation";
import { iconImage } from "../../_brand/icon-image";

// Web app manifest icons, rendered once at build time: /pwa-icon/192 and /pwa-icon/512.
const PWA_ICON_SIZES = [192, 512] as const;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return PWA_ICON_SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_request: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const size = Number((await params).size);
  if (!PWA_ICON_SIZES.includes(size as (typeof PWA_ICON_SIZES)[number])) notFound();
  // Full-bleed square so it works as a maskable icon.
  return iconImage(size, { radius: 0 });
}
