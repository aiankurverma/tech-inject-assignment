import * as React from "react";

type Source = string | ArrayBuffer | Uint8Array | Blob | undefined;

/**
 * Turns a URL / Blob / byte buffer into a URL an <img>, <video> or <audio> can use.
 * Object URLs are revoked when the source changes or the component unmounts.
 */
export function useObjectUrl(src: Source, mimeType?: string): string | undefined {
  const url = React.useMemo(() => {
    if (!src) return undefined;
    if (typeof src === "string") return src;
    const blob =
      src instanceof Blob
        ? src
        : new Blob([src instanceof Uint8Array ? src.slice() : src], {
            type: mimeType ?? "application/octet-stream",
          });
    return URL.createObjectURL(blob);
  }, [src, mimeType]);

  React.useEffect(() => {
    return () => {
      if (url && url.startsWith("blob:") && typeof src !== "string") URL.revokeObjectURL(url);
    };
  }, [url, src]);

  return url;
}
