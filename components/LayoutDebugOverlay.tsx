"use client";

import { useEffect, useState, useCallback } from "react";

type ContainerInfo = {
  name: string;
  element: HTMLElement | null;
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  borderTop: number;
  borderRight: number;
  borderBottom: number;
  borderLeft: number;
  top: number;
  left: number;
  display: string;
  gap: string;
  gridTemplateColumns: string;
  flexDirection: string;
};

type LayoutDebugOverlayProps = {
  enabled: boolean;
};

const CONTAINER_SELECTORS = [
  { name: "page-shell", selector: ".page-shell", color: "#ff0000" },
  { name: "layout-main", selector: ".layout-main", color: "#00ff00" },
  { name: "controls-panel", selector: ".controls-panel", color: "#0000ff" },
  { name: "preview-panel", selector: ".preview-panel", color: "#ff00ff" },
  { name: "svg-wrapper", selector: ".svg-wrapper", color: "#00ffff" },
  { name: "svg-preview", selector: ".svg-preview", color: "#ffff00" },
];

export default function LayoutDebugOverlay({ enabled }: LayoutDebugOverlayProps) {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);

  const measureContainers = useCallback(() => {
    const measured: ContainerInfo[] = [];

    CONTAINER_SELECTORS.forEach(({ name, selector }) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        const marginTop = parseFloat(styles.marginTop) || 0;
        const marginRight = parseFloat(styles.marginRight) || 0;
        const marginBottom = parseFloat(styles.marginBottom) || 0;
        const marginLeft = parseFloat(styles.marginLeft) || 0;

        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const paddingLeft = parseFloat(styles.paddingLeft) || 0;

        const borderTop = parseFloat(styles.borderTopWidth) || 0;
        const borderRight = parseFloat(styles.borderRightWidth) || 0;
        const borderBottom = parseFloat(styles.borderBottomWidth) || 0;
        const borderLeft = parseFloat(styles.borderLeftWidth) || 0;

        const display = styles.display || "block";
        const gap = styles.gap || "0";
        const gridTemplateColumns = styles.gridTemplateColumns || "none";
        const flexDirection = styles.flexDirection || "row";

        measured.push({
          name,
          element,
          width: rect.width,
          height: rect.height,
          marginTop,
          marginRight,
          marginBottom,
          marginLeft,
          paddingTop,
          paddingRight,
          paddingBottom,
          paddingLeft,
          borderTop,
          borderRight,
          borderBottom,
          borderLeft,
          top: rect.top,
          left: rect.left,
          display,
          gap,
          gridTemplateColumns,
          flexDirection,
        });
      }
    });

    setContainers(measured);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setContainers([]);
      return;
    }

    // Initial measurement
    measureContainers();

    // ResizeObserver for real-time updates
    const resizeObserver = new ResizeObserver(() => {
      measureContainers();
    });

    // Observe all containers
    const elements: HTMLElement[] = [];
    CONTAINER_SELECTORS.forEach(({ selector }) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        elements.push(element);
        resizeObserver.observe(element);
      }
    });

    // Window resize listener as fallback
    const handleResize = () => {
      measureContainers();
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [enabled, measureContainers]);

  if (!enabled || containers.length === 0) {
    return null;
  }

  // Helper to parse gap value
  const parseGap = (gap: string): number => {
    if (!gap || gap === "0" || gap === "normal") return 0;
    const match = gap.match(/([\d.]+)px/);
    return match ? parseFloat(match[1]) : 0;
  };

  return (
    <div className="layout-debug-overlay" style={{ pointerEvents: "none" }}>
      {containers.map((container, index) => {
        const config = CONTAINER_SELECTORS[index];
        if (!config || !container.element) return null;

        const marginStr = `${container.marginTop}px ${container.marginRight}px ${container.marginBottom}px ${container.marginLeft}px`;
        const paddingStr = `${container.paddingTop}px ${container.paddingRight}px ${container.paddingBottom}px ${container.paddingLeft}px`;
        const borderStr = `${container.borderTop}px ${container.borderRight}px ${container.borderBottom}px ${container.borderLeft}px`;
        
        const gapValue = parseGap(container.gap);
        const isGrid = container.display === "grid";
        const isFlex = container.display === "flex";

        return (
          <div key={container.name}>
            {/* Border overlay */}
            <div
              className="layout-debug-border"
              style={{
                position: "fixed",
                top: container.top,
                left: container.left,
                width: container.width,
                height: container.height,
                border: `2px solid ${config.color}`,
                boxSizing: "border-box",
                zIndex: 10000,
                pointerEvents: "none",
              }}
            />
            {/* Gap visualization for grid/flex */}
            {gapValue > 0 && (isGrid || isFlex) && container.element && (
              <>
                {/* Visualize gap between children */}
                {Array.from(container.element.children).map((child, childIndex) => {
                  if (childIndex === 0) return null;
                  const childRect = (child as HTMLElement).getBoundingClientRect();
                  const prevChild = container.element!.children[childIndex - 1] as HTMLElement;
                  const prevRect = prevChild.getBoundingClientRect();
                  
                  // Calculate gap position
                  let gapTop = 0;
                  let gapLeft = 0;
                  let gapWidth = 0;
                  let gapHeight = 0;
                  
                  if (isGrid || (isFlex && container.flexDirection === "row")) {
                    // Horizontal gap
                    gapLeft = prevRect.right;
                    gapTop = Math.min(prevRect.top, childRect.top);
                    gapWidth = gapValue;
                    gapHeight = Math.max(prevRect.height, childRect.height);
                  } else if (isFlex && container.flexDirection === "column") {
                    // Vertical gap
                    gapLeft = Math.min(prevRect.left, childRect.left);
                    gapTop = prevRect.bottom;
                    gapWidth = Math.max(prevRect.width, childRect.width);
                    gapHeight = gapValue;
                  }
                  
                  return (
                    <div
                      key={`gap-${childIndex}`}
                      style={{
                        position: "fixed",
                        top: gapTop,
                        left: gapLeft,
                        width: gapWidth,
                        height: gapHeight,
                        background: `${config.color}40`,
                        border: `1px dashed ${config.color}`,
                        zIndex: 9999,
                        pointerEvents: "none",
                      }}
                    />
                  );
                })}
              </>
            )}
            {/* Label - positioned to avoid overlaps */}
            {(() => {
              // Determine label position based on container hierarchy
              // Outer containers: top-left, inner containers: alternate positions
              let labelTop = container.top - 2;
              let labelLeft = container.left - 2;
              let transform = "none";
              
              if (container.name === "page-shell") {
                // Outermost: top-left
                labelTop = container.top - 2;
                labelLeft = container.left - 2;
              } else if (container.name === "layout-main") {
                // Inside layout-main: top-right inside
                labelTop = container.top + 2;
                labelLeft = container.left + container.width - 2;
                transform = "translateX(-100%)";
              } else if (container.name === "controls-panel") {
                // Left column: bottom-left
                labelTop = container.top + container.height + 2;
                labelLeft = container.left - 2;
              } else if (container.name === "preview-panel") {
                // Inside preview-panel: top-right inside
                labelTop = container.top + 2;
                labelLeft = container.left + container.width - 2;
                transform = "translateX(-100%)";
              } else if (container.name === "svg-wrapper") {
                // SVG wrapper: top-right inside preview
                labelTop = container.top - 2;
                labelLeft = container.left + container.width + 2;
              } else if (container.name === "svg-preview") {
                // SVG element: bottom-left inside preview
                labelTop = container.top + container.height + 2;
                labelLeft = container.left - 2;
              }
              
              return (
                <div
                  className="layout-debug-label"
                  style={{
                    position: "fixed",
                    top: labelTop,
                    left: labelLeft,
                    background: config.color,
                    color: "#ffffff",
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    zIndex: 10001,
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                    lineHeight: "1.4",
                    transform,
                  }}
                >
              <div style={{ fontWeight: "bold" }}>{container.name}</div>
              <div>
                {Math.round(container.width)} × {Math.round(container.height)}px
              </div>
              <div style={{ fontSize: "10px", opacity: 0.9, fontWeight: "bold" }}>
                Display: {container.display}
                {container.display === "flex" && ` (${container.flexDirection})`}
                {container.display === "grid" && container.gridTemplateColumns !== "none" && (
                  <span> - Cols: {container.gridTemplateColumns}</span>
                )}
              </div>
              {container.gap !== "0" && container.gap !== "normal" && (
                <div style={{ fontSize: "10px", opacity: 0.9 }}>
                  Gap: {container.gap}
                </div>
              )}
              <div style={{ fontSize: "10px", opacity: 0.9 }}>
                M: {marginStr}
              </div>
              <div style={{ fontSize: "10px", opacity: 0.9 }}>
                P: {paddingStr}
              </div>
              <div style={{ fontSize: "10px", opacity: 0.9 }}>
                B: {borderStr}
              </div>
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

