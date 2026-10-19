import { Popover } from "@douyinfe/semi-ui";
import { IconTick } from "@douyinfe/semi-icons";
import { useState } from "react";
import { colorPalette } from "../../data/constants";

const isLight = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const luma =
    0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luma > 150;
};

export default function ColorPicker({
  value,
  readOnly,
  children,
  onChange,
  onColorPick,
}) {
  const [visible, setVisible] = useState(false);

  const handleSelect = (color) => {
    if (readOnly) return;
    if (color !== value) {
      onChange?.(color);
      onColorPick?.(color);
    }
    setVisible(false);
  };

  const isSelected = (color) => color.toLowerCase() === value?.toLowerCase();

  return (
    <Popover
      trigger="custom"
      visible={visible}
      position="bottomLeft"
      onClickOutSide={() => setVisible(false)}
      content={
        <div className="grid grid-cols-8 gap-2 p-3 w-[240px]">
          {colorPalette.map((color) => (
            <button
              key={color}
              type="button"
              disabled={readOnly}
              className="h-6 w-6 rounded-md border border-black/20 flex items-center justify-center hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              onClick={() => handleSelect(color)}
            >
              {isSelected(color) && (
                <IconTick
                  size="small"
                  style={{ color: isLight(color) ? "#000" : "#fff" }}
                />
              )}
            </button>
          ))}
        </div>
      }
    >
      <div onClick={() => setVisible((v) => !v)}>
        {children || (
          <div
            className="h-8 w-8 rounded-md"
            style={{ backgroundColor: value }}
          />
        )}
      </div>
    </Popover>
  );
}
