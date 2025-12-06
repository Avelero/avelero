import type { SimilarProduct, ThemeConfig } from "@v1/dpp-components";
import Image from "next/image";
import { formatPrice } from "../../utils/formatting";

interface Props {
  product: SimilarProduct;
  showTitle?: boolean;
  showPrice?: boolean;
}

export function ProductCard({
  product,
  showTitle = true,
  showPrice = true,
}: Props) {
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
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 200px"
        />
      </div>
      {(showTitle || showPrice) && (
        <div className="flex carousel__product-details gap-xs">
          {showTitle && (
            <div className="carousel__product-name line-clamp-2 min-w-0">
              {product.name}
            </div>
          )}
          {showPrice && (
            <div className="carousel__product-price flex-shrink-0">
              {formatPrice(product.price, product.currency)}
            </div>
          )}
        </div>
      )}
    </a>
  );
}
