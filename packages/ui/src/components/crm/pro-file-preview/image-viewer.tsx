import * as React from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import { ImageOff, Maximize, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useObjectUrl } from "@/hooks/use-object-url";
import type { PreviewFile } from "@/components/crm/pro-file-preview/types";
import {
  Spinner,
  ToolButton,
  ToolDivider,
  Toolbar,
  ViewerMessage,
} from "@/components/crm/pro-file-preview/toolbar";

export interface ImageViewerHandle {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  rotate(): void;
}

/** Image with wheel / pinch zoom, drag pan, double-click zoom and 90deg rotation. */
export const ImageViewer = React.forwardRef<ImageViewerHandle, { file: PreviewFile }>(
  function ImageViewer({ file }, ref) {
    const url = useObjectUrl(file.src, file.mimeType);
    const zpp = React.useRef<ReactZoomPanPinchContentRef>(null);
    const [scale, setScale] = React.useState(1);
    const [rotation, setRotation] = React.useState(0);
    const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
    const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);

    React.useEffect(() => {
      setStatus("loading");
      setRotation(0);
      setNatural(null);
    }, [url]);

    React.useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => zpp.current?.zoomIn(0.4),
        zoomOut: () => zpp.current?.zoomOut(0.4),
        rotate: () => setRotation((r) => (r + 90) % 360),
        reset: () => {
          zpp.current?.resetTransform();
          setRotation(0);
        },
      }),
      [],
    );

    if (!url)
      return <ViewerMessage icon={<ImageOff className="h-8 w-8" />} title="No image source" />;

    return (
      <div className="flex h-full min-h-0 flex-col">
        <Toolbar label="Image controls">
          <ToolButton label="Zoom out (-)" onClick={() => zpp.current?.zoomOut(0.4)}>
            <ZoomOut className="h-4 w-4" />
          </ToolButton>
          <span
            className="w-12 text-center text-xs tabular-nums text-crm-muted-fg"
            aria-live="polite"
          >
            {Math.round(scale * 100)}%
          </span>
          <ToolButton label="Zoom in (+)" onClick={() => zpp.current?.zoomIn(0.4)}>
            <ZoomIn className="h-4 w-4" />
          </ToolButton>
          <ToolDivider />
          <ToolButton
            label="Rotate 90 degrees (R)"
            onClick={() => setRotation((r) => (r + 90) % 360)}
          >
            <RotateCw className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label="Fit to screen (0)"
            onClick={() => {
              zpp.current?.resetTransform();
              setRotation(0);
            }}
          >
            <Maximize className="h-4 w-4" />
          </ToolButton>
          {natural && (
            <span className="ml-auto text-xs tabular-nums text-crm-muted-fg">
              {natural.w} x {natural.h}px
            </span>
          )}
        </Toolbar>
        <div
          className="relative min-h-0 flex-1 overflow-hidden bg-crm-bg"
          style={{
            backgroundImage:
              "linear-gradient(45deg, rgb(127 127 127 / 0.08) 25%, transparent 25%, transparent 75%, rgb(127 127 127 / 0.08) 75%), linear-gradient(45deg, rgb(127 127 127 / 0.08) 25%, transparent 25%, transparent 75%, rgb(127 127 127 / 0.08) 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 8px 8px",
          }}
        >
          {status === "loading" && (
            <div className="absolute inset-0">
              <Spinner label={`Loading ${file.name}`} />
            </div>
          )}
          {status === "error" ? (
            <ViewerMessage
              icon={<ImageOff className="h-8 w-8" />}
              title="This image could not be displayed"
              detail="The file may be corrupt or in a format your browser does not support."
            />
          ) : (
            <TransformWrapper
              ref={zpp}
              minScale={0.2}
              maxScale={16}
              centerOnInit
              doubleClick={{ mode: "toggle", step: 1.5 }}
              wheel={{ step: 0.15 }}
              onTransform={(_, s) => setScale(s.scale)}
            >
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{ width: "100%", height: "100%" }}
              >
                <div className="flex h-full w-full items-center justify-center p-4">
                  <img
                    key={url}
                    src={url}
                    alt={file.name}
                    draggable={false}
                    onLoad={(e) => {
                      setNatural({
                        w: e.currentTarget.naturalWidth,
                        h: e.currentTarget.naturalHeight,
                      });
                      setStatus("ready");
                    }}
                    onError={() => setStatus("error")}
                    className="max-h-full max-w-full select-none object-contain shadow-crm-raised transition-transform duration-200"
                    style={{ transform: `rotate(${rotation}deg)` }}
                  />
                </div>
              </TransformComponent>
            </TransformWrapper>
          )}
        </div>
      </div>
    );
  },
);
