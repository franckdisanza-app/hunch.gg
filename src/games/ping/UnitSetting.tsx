"use client";

import type { DistanceUnit } from "@/engines/map/geo";
import { SegmentedControl } from "@/frame/ui/SegmentedControl";
import { strings } from "./strings";
import { saveDistanceUnit, useDistanceUnit } from "./useDistanceUnit";

/** Kilometres or miles, in the settings sheet. Scores never depend on it. */
export function UnitSetting() {
  const unit = useDistanceUnit();
  return (
    <SegmentedControl<DistanceUnit>
      label={strings.settings.unit}
      value={unit}
      options={[
        { value: "km", label: strings.settings.km },
        { value: "mi", label: strings.settings.mi },
      ]}
      onChange={saveDistanceUnit}
    />
  );
}
