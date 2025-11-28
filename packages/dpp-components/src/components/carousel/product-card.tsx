import type { SimilarProduct } from "@v1/dpp-components";
import { formatPrice } from "../../utils/formatting";

interface Props {
  product: SimilarProduct;
  imageZoom?: number;
  imagePosition?: "top" | "center" | "bottom";
}

export function ProductCard({
  product,
  imageZoom = 100,
  imagePosition = "center",
}: Props) {
  // Convert zoom from percentage to scale value
  const zoomScale = Math.max(1, imageZoom / 100);

  // Determine positioning values
  let objectPosition = "50% 50%"; // Default: center
  let transformOrigin = "50% 50%"; // Default: center

  if (imagePosition === "top") {
    objectPosition = "50% 0%";
    transformOrigin = "50% 0%";
  } else if (imagePosition === "bottom") {
    objectPosition = "50% 100%";
    transformOrigin = "50% 100%";
  }

  return (
    <a
      href={product.url}
      className="flex flex-col gap-sm cursor-pointer w-full h-full"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div
        className="relative w-full overflow-hidden border carousel__product-image"
        style={{ aspectRatio: "3/4" }}
      >
        <img
          src={product.image}
          alt={product.name}
          className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-300 ease-in-out"
          style={{
            objectPosition,
            transform: `scale(${zoomScale})`,
            transformOrigin,
          }}
          loading="lazy"
        />
      </div>
      <div className="flex carousel__product-details gap-micro">
        <div className="carousel__product-name truncate w-full">
          {product.name}
        </div>
        <div className="carousel__product-price">
          {formatPrice(product.price, product.currency)}
        </div>
      </div>
    </a>
  );
}
