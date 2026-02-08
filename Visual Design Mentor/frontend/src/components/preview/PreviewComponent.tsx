import React, { useCallback, useEffect, useRef, useState, useImperativeHandle } from "react";
import classNames from "classnames";
import useThrottle from "../../hooks/useThrottle";
import EditPopup from "../select-and-edit/EditPopup";

interface Props {
  code: string;
  device: "mobile" | "desktop";
  doUpdate: (updateInstruction: string, selectedElement?: HTMLElement) => void;
}

const PreviewComponent = React.forwardRef<HTMLIFrameElement, Props>((props, ref) => {
  const { code, device, doUpdate } = props;
  const internalRef = useRef<HTMLIFrameElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Combine refs
  useImperativeHandle(ref, () => internalRef.current as HTMLIFrameElement);

  // Don't update code more often than every 200ms.
  const throttledCode = useThrottle(code, 200);

  // Select and edit functionality
  const [clickEvent, setClickEvent] = useState<MouseEvent | null>(null);
  const [scale, setScale] = useState(1);
  const handleIframeClick = useCallback((event: MouseEvent) => {
    setClickEvent(event);
  }, []);

  // Add scaling logic
  useEffect(() => {
    const updateScale = () => {
      const wrapper = wrapperRef.current;
      const iframe = internalRef.current;
      if (!wrapper || !iframe) return;

      const viewportWidth = wrapper.clientWidth;
      const baseWidth = device === "desktop" ? 1440 : 375;
      const scaleValue = Math.min(1, viewportWidth / baseWidth);

      setScale(scaleValue);

      iframe.style.transform = `scale(${scaleValue})`;
      iframe.style.transformOrigin = "top left";
      // Adjust wrapper height to account for scaling
      wrapper.style.height = `${iframe.offsetHeight * scaleValue}px`;
    };

    updateScale();

    // Add event listener for window resize
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [device]);

  useEffect(() => {
    const iframe = internalRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const body = iframe.contentWindow?.document.body;
      if (!body) return;
      body.addEventListener("click", handleIframeClick);
    };

    iframe.addEventListener("load", handleLoad);

    return () => {
      iframe.removeEventListener("load", handleLoad);
      const body = iframe.contentWindow?.document.body;
      if (body) {
        body.removeEventListener("click", handleIframeClick);
      }
    };
  }, [handleIframeClick]);

  useEffect(() => {
    const iframe = internalRef.current;
    if (!iframe) return;
    if (iframe.srcdoc !== throttledCode) {
      iframe.srcdoc = throttledCode;
    }
  }, [throttledCode]);

  return (
    <div className="flex justify-center mr-4">
      <div
        ref={wrapperRef}
        className="overflow-y-auto overflow-x-hidden w-full"
      >
        <iframe
          id={`preview-${device}`}
          ref={internalRef}
          title="Preview"
          className={classNames(
            "border-[4px] border-black rounded-[20px] shadow-lg mx-auto",
            {
              "w-[1440px] h-[900px]": device === "desktop",
              "w-[375px] h-[812px]": device === "mobile",
            }
          )}
        ></iframe>
        <EditPopup
          event={clickEvent}
          iframeRef={internalRef}
          doUpdate={doUpdate}
          scale={scale}
        />
      </div>
    </div>
  );
});

export default PreviewComponent;
