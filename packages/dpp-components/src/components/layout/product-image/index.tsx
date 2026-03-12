"use client";

/**
 * Product image renderer and measurement helpers for the DPP layout.
 */

import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { getDppSelectableAttributes } from "../../../lib/editor-selection";
import { resolveStyles } from "../../../lib/resolve-styles";
import type { Passport } from "../../../types/passport";
import { COMPONENT_REGISTRY } from "../registry";

/**
 * Product image renderer for the DPP content layout.
 *
 * All utility functions and rendering logic are ported 1:1 from Foundation.app:
 *   - utils/media.ts          → calculateAssetCoverage, getAspectRatioDecimal
 *   - utils/media-balancing.ts → calculateCoverageScalingFactor, getAspectRatioComparisonDescriptor
 *   - utils/numbers.ts        → clampRatio
 *   - utils/helpers.ts        → lerp
 *   - hooks/use-balanced-media → useBalancedMedia (two-ref measurement)
 *   - MintLayout.tsx           → MediaContainer (outer, ResizeObserver content-box)
 *   - NftMedia.tsx             → NftMediaContainer + Media.Root + Media.Tint
 *
 * Layout structure:
 *
 * <MediaContainer ref={mediaContainerRef}>  ← padding, measured by ResizeObserver (content-box) → aspect ratio
 *   <NftMediaContainer ref={nftMediaRef}>   ← flexGrow:1, aspect-ratio from MediaContainer, measured for balancing
 *     <Media.Root>                          ← image's natural aspect-ratio + scale transform
 *       <Media.Tint>                        ← visual wrapper
 *         <img>
 *       </Media.Tint>
 *     </Media.Root>
 *   </NftMediaContainer>
 * </MediaContainer>
 */

// --- Types (from Foundation.app) ---

interface Dimensions {
  width: number;
  height: number;
}

interface AssetSummary extends Dimensions {
  aspectRatio: string;
  aspectRatioDecimal: number;
}

interface LoadedImageDetails extends AssetSummary {
  src: string;
}

type CssVariableProperties = CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

const BASE_IMAGE_STYLE: CSSProperties = {
  backgroundColor: "var(--background)",
  display: "block",
  height: "100%",
  objectFit: "cover",
  width: "100%",
};

// --- Utility functions (1:1 from Foundation.app) ---

// utils/numbers.ts → clampRatio
function clampRatio(value: number): number {
  // Clamp balancing math to Foundation's expected 0..1 range.
  return Math.min(1, Math.max(0, value));
}

// utils/helpers.ts → lerp
function lerp(a: number, b: number, t: number): number {
  // Interpolate the scaling factor across the supported coverage window.
  return a + (b - a) * t;
}

// utils/media.ts → getAspectRatioCssString
function getAspectRatioCssString(d: Dimensions): string {
  // Serialize dimensions into the CSS aspect-ratio format Foundation uses.
  return `${d.width} / ${d.height}`;
}

// utils/media.ts → getAspectRatioDecimal
function getAspectRatioDecimal(d: Dimensions): number {
  // Convert dimensions into the decimal ratio used by balancing helpers.
  return d.width / d.height;
}

// utils/media.ts → getCoverage (internal helper)
function getCoverage(item: Dimensions, container: Dimensions): number {
  // Calculate how much of the container the rendered media would occupy.
  const coverageX = item.width / container.width;
  const coverageY = item.height / container.height;
  return clampRatio(coverageX * coverageY);
}

// utils/media.ts → calculateAssetCoverage
function calculateAssetCoverage(
  asset: AssetSummary,
  container: Dimensions,
): number {
  // Mirror Foundation's coverage math for balancing scale decisions.
  if (container.width === 0 || container.height === 0) return 1;
  if (asset.width === 0 || asset.height === 0) return 0;
  if (asset.width === container.width && asset.height === container.height)
    return 1;

  // Asset is smaller than container on both dimensions
  if (asset.width < container.width && asset.height < container.height) {
    return getCoverage(asset, container);
  }

  const assetAspect = asset.aspectRatioDecimal;

  // Portrait
  if (assetAspect < 1) {
    return getCoverage(
      { height: container.height, width: container.height * assetAspect },
      container,
    );
  }

  // Landscape
  if (assetAspect > 1) {
    return getCoverage(
      { height: container.width / assetAspect, width: container.width },
      container,
    );
  }

  // Square asset — check container aspect
  const containerAspect = getAspectRatioDecimal(container);

  if (containerAspect < 1) {
    return getCoverage(
      { height: container.width / assetAspect, width: container.width },
      container,
    );
  }

  if (containerAspect > 1) {
    return getCoverage(
      { height: container.height, width: container.height * assetAspect },
      container,
    );
  }

  return 1;
}

// utils/media-balancing.ts → constants
const MIN_COVERAGE_FOR_BALANCING = 0.75;
const MAX_COVERAGE_FOR_BALANCING = 1;
const COVERAGE_RANGE = MAX_COVERAGE_FOR_BALANCING - MIN_COVERAGE_FOR_BALANCING;
const MAX_BALANCING_SIZE_REDUCTION = 0.15;
const MIN_BALANCING_SIZE_REDUCTION = 0;

// utils/media-balancing.ts → calculateCoverageScalingFactor
function calculateCoverageScalingFactor(coverage: number): number {
  // Convert coverage into the slight scale reduction Foundation applies.
  if (
    coverage < MIN_COVERAGE_FOR_BALANCING ||
    coverage > MAX_COVERAGE_FOR_BALANCING
  ) {
    return 0;
  }

  const ratio = (coverage - MIN_COVERAGE_FOR_BALANCING) / COVERAGE_RANGE;
  const clampedRatio = clampRatio(ratio);
  return clampRatio(
    lerp(
      MIN_BALANCING_SIZE_REDUCTION,
      MAX_BALANCING_SIZE_REDUCTION,
      clampedRatio,
    ),
  );
}

// utils/media-balancing.ts → getAspectRatioComparisonDescriptor
type MediaShape = "wider" | "taller" | "equal";

function getMediaShape(
  assetAspectDecimal: number,
  containerAspectDecimal: number,
): MediaShape {
  // Compare asset and container ratios to choose the correct fit strategy.
  const diff = assetAspectDecimal - containerAspectDecimal;
  if (Math.abs(diff) < 0.001) return "equal";
  if (assetAspectDecimal > containerAspectDecimal) return "wider";
  return "taller";
}

function useHasIntersected(
  ref: RefObject<HTMLElement | null>,
  options: IntersectionObserverInit = {},
): boolean {
  // Start preloading once the media container has entered the viewport once.
  const [hasIntersected, setHasIntersected] = useState(false);
  const thresholdKey = Array.isArray(options.threshold)
    ? options.threshold.join(",")
    : `${options.threshold ?? 0}`;

  useEffect(() => {
    // Stop observing after the first successful intersection.
    if (hasIntersected) return;

    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setHasIntersected(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        setHasIntersected(true);
        observer.disconnect();
        break;
      }
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasIntersected, options.root, options.rootMargin, ref, thresholdKey]);

  return hasIntersected;
}

function useLoadedImage(src: string | null): LoadedImageDetails | null {
  // Preload the asset off-DOM so layout math does not depend on the visible img.
  const [loadedImage, setLoadedImage] = useState<LoadedImageDetails | null>(
    null,
  );

  useEffect(() => {
    // Reset immediately when the image source is removed or changed.
    if (!src) {
      setLoadedImage(null);
      return;
    }

    let isCancelled = false;
    let isSettled = false;
    const imageElement = new window.Image();

    const finalizeLoad = () => {
      // Only publish dimensions once for the current request.
      if (isCancelled || isSettled) return;
      isSettled = true;

      const dimensions = {
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight,
      };

      if (dimensions.width === 0 || dimensions.height === 0) {
        setLoadedImage(null);
        return;
      }

      setLoadedImage({
        src,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: getAspectRatioCssString(dimensions),
        aspectRatioDecimal: getAspectRatioDecimal(dimensions),
      });
    };

    imageElement.decoding = "async";
    imageElement.onload = finalizeLoad;
    imageElement.onerror = () => {
      // Clear the loaded state when the preload request fails.
      if (isCancelled || isSettled) return;
      isSettled = true;
      setLoadedImage(null);
    };
    imageElement.src = src;

    if (imageElement.complete) {
      finalizeLoad();
    }

    return () => {
      isCancelled = true;
      imageElement.onload = null;
      imageElement.onerror = null;
    };
  }, [src]);

  return loadedImage;
}

function useLoadedPreviewMedia(
  image: string | null,
  options: { enabled: boolean } = { enabled: true },
): LoadedImageDetails | null {
  // Match Foundation's preview-media boundary by deferring preload until enabled.
  return useLoadedImage(options.enabled ? image : null);
}

function useMediaContainerSize(ref: RefObject<HTMLDivElement | null>): {
  aspectRatio: number | null;
  height: number;
  width: number;
} {
  // Continuously observe the padded outer container because it defines the inner box ratio.
  const [size, setSize] = useState<{
    aspectRatio: number | null;
    height: number;
    width: number;
  }>({
    aspectRatio: null,
    height: 0,
    width: 0,
  });

  useEffect(() => {
    // Track the content box so padding does not distort the media aspect ratio.
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { height, width } = entry.contentRect;
      const aspectRatio = width > 0 && height > 0 ? width / height : null;

      setSize((previous) => {
        if (
          previous.width === width &&
          previous.height === height &&
          previous.aspectRatio === aspectRatio
        ) {
          return previous;
        }

        return { aspectRatio, height, width };
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function findNearestScrollContainer(
  element: HTMLElement | null,
): HTMLElement | null {
  // Walk ancestors until we find the scrolling box that sticky positioning uses.
  let currentElement = element?.parentElement ?? null;

  while (currentElement) {
    const { overflowY } = window.getComputedStyle(currentElement);
    const isScrollContainer = ["auto", "overlay", "scroll"].includes(overflowY);

    if (isScrollContainer) {
      return currentElement;
    }

    currentElement = currentElement.parentElement;
  }

  return null;
}

function useAvailableViewportHeight(
  ref: RefObject<HTMLElement | null>,
): number | null {
  // Resolve the local scrolling viewport so embedded previews size like the live page.
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    // Prefer the nearest scroll container height and fall back to the window viewport.
    const element = ref.current;
    if (!element) return;

    const scrollContainer = findNearestScrollContainer(element);
    const updateHeight = () => {
      const nextHeight = scrollContainer?.clientHeight ?? window.innerHeight;
      setHeight((previous) =>
        previous === nextHeight ? previous : nextHeight,
      );
    };

    updateHeight();

    if (scrollContainer) {
      const observer = new ResizeObserver(() => {
        updateHeight();
      });

      observer.observe(scrollContainer);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [ref]);

  return height;
}

function useBalancedMedia(options: {
  asset: AssetSummary | null;
  containerRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
}): {
  containerAspectDecimal: number;
  containerDimensions: Dimensions;
  mediaCoverage: number;
  mediaScaleFactor: number;
  mediaTransformScale: number;
} {
  // Measure the rendered media box so balancing stays in sync with sticky/layout changes.
  const { asset, containerRef, enabled = true } = options;
  const [containerDimensions, setContainerDimensions] = useState<Dimensions>({
    height: 0,
    width: 0,
  });
  const [coverage, setCoverage] = useState(1);
  const [containerAspectDecimal, setContainerAspectDecimal] =
    useState<number>(0);

  useEffect(() => {
    // Re-measure whenever the asset or the inner media box changes size.
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const container = {
        width: rect.width,
        height: rect.height,
      };
      const nextAspectDecimal =
        container.width > 0 && container.height > 0
          ? getAspectRatioDecimal(container)
          : 0;
      const nextCoverage = asset ? calculateAssetCoverage(asset, container) : 1;

      setContainerDimensions((previous) => {
        if (
          previous.width === container.width &&
          previous.height === container.height
        ) {
          return previous;
        }

        return container;
      });
      setContainerAspectDecimal((previous) =>
        previous === nextAspectDecimal ? previous : nextAspectDecimal,
      );
      setCoverage((previous) =>
        previous === nextCoverage ? previous : nextCoverage,
      );
    };

    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [asset, containerRef]);

  const mediaCoverage = coverage;
  const mediaScaleFactor = calculateCoverageScalingFactor(mediaCoverage);
  const mediaTransformScale = enabled ? 1 - mediaScaleFactor : 1;

  return {
    containerAspectDecimal,
    containerDimensions,
    mediaCoverage,
    mediaScaleFactor,
    mediaTransformScale,
  };
}

// --- Component ---

interface Props {
  productImage: Passport["productImage"] | undefined;
  tokens: Passport["tokens"];
  image: string;
  alt: string;
}

export function ProductImage({ productImage, tokens, image, alt }: Props) {
  // Mirror Foundation's media pipeline: outer measurement, gated preload, then inner balancing.
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const nftMediaRef = useRef<HTMLDivElement>(null);
  const availableViewportHeight = useAvailableViewportHeight(mediaContainerRef);
  const hasIntersected = useHasIntersected(mediaContainerRef, {
    threshold: 0.3,
  });
  const loadedMedia = useLoadedPreviewMedia(image || null, {
    enabled: hasIntersected,
  });
  const s = resolveStyles(
    productImage?.styles ??
      COMPONENT_REGISTRY.productImage!.schema.defaults.styles,
    tokens,
  );
  const mediaContainerSize = useMediaContainerSize(mediaContainerRef);
  const balancer = useBalancedMedia({
    asset: loadedMedia,
    containerRef: nftMediaRef,
    enabled: true,
  });
  const isMediaLoaded = loadedMedia !== null;
  const mediaShape = loadedMedia
    ? getMediaShape(
        loadedMedia.aspectRatioDecimal,
        balancer.containerAspectDecimal,
      )
    : "equal";

  /**
   * CSS fitting strategy (from NftMedia styled variants):
   *
   * "wider":
   *   Media.Root → (no maxHeight constraint)
   *   Media (img) → height: auto, width: 100%
   *
   * "taller" / "equal":
   *   Media.Root → maxHeight: 100%
   *   Media (img) → height: 100%
   */
  const mediaRootStyle: CSSProperties =
    mediaShape === "wider" ? {} : { maxHeight: "100%" };

  const imageStyle: CSSProperties =
    mediaShape === "wider"
      ? {
          ...BASE_IMAGE_STYLE,
          height: "auto",
          borderRadius: s.frame?.borderRadius,
        }
      : { ...BASE_IMAGE_STYLE, borderRadius: s.frame?.borderRadius };
  const imageFrameStyle: CSSProperties = {
    boxSizing: "border-box",
    display: "block",
    overflow: "hidden",
    ...s.frame,
  };

  const transform = isMediaLoaded
    ? `scale(${balancer.mediaTransformScale}) translateY(0%)`
    : `scale(${balancer.mediaTransformScale - 0.02}) translateY(2%)`;
  const mediaContainerStyle: CssVariableProperties = {
    flexGrow: 1,
    "--dpp-available-viewport-height":
      availableViewportHeight !== null
        ? `${availableViewportHeight}px`
        : undefined,
  };
  const productImageSelection = getDppSelectableAttributes({
    kind: "fixed",
    editorId: "productImage",
  });

  return (
    <div className="w-full px-4 @md:px-0">
      {image ? (
        /**
         * MediaContainer (from MintLayout.MediaContainer)
         *
         * Foundation.app styles:
         *   mobile:  padding: 5%, height: 50vh
         *   desktop: paddingTop/Bottom: 5%, paddingLeft: 0, paddingRight: $8,
         *            height: calc(viewportHeight - navHeight)
         *   large:   NftMedia maxHeight: 75vh
         */
        <div
          ref={mediaContainerRef}
          className="flex items-center justify-center p-[5%] h-[50vh] @md:h-[calc(var(--dpp-available-viewport-height,_100vh)-var(--header-height))] @md:py-[5%] @md:px-0"
          style={mediaContainerStyle}
        >
          {/**
           * NftMediaContainer (from NftMedia)
           *
           * - flexGrow: 1 fills the padded area (set by MediaContainer's [NFT_MEDIA_SELECTOR])
           * - aspectRatio comes from the MediaContainer's content-box measurement
           *   (NOT from its own measurement — this is critical for correct balancing)
           */}
          <div
            ref={nftMediaRef}
            className="relative flex items-center justify-center"
            style={{
              flexGrow: 1,
              aspectRatio: mediaContainerSize.aspectRatio ?? undefined,
              transition: "transform 0.6s ease-in-out",
            }}
          >
            {/** Media.Root — natural aspect ratio + scale transform */}
            <div
              style={{
                aspectRatio: loadedMedia?.aspectRatio,
                transform,
                transition:
                  "opacity 0.3s ease-in-out, transform 0.6s ease-in-out",
                opacity: isMediaLoaded ? 1 : 0,
                willChange: "opacity, transform",
                backgroundColor: "inherit",
                ...mediaRootStyle,
              }}
            >
              {/** Media.Tint — visual wrapper */}
              <div
                {...productImageSelection}
                className="product__image"
                style={imageFrameStyle}
              >
                {loadedMedia ? (
                  <img
                    src={loadedMedia.src}
                    alt={alt}
                    style={imageStyle}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          {...productImageSelection}
          className="product__image flex min-h-[240px] w-full items-center justify-center"
          style={{ ...imageFrameStyle, backgroundColor: "var(--accent)" }}
        >
          <span
            className="type-body-sm"
            style={{ color: "var(--muted-light-foreground)" }}
          >
            No product image available
          </span>
        </div>
      )}
    </div>
  );
}
