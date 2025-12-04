import type { SimilarProduct } from "@v1/dpp-components";
import Image from "next/image";
import { formatPrice } from "../../utils/formatting";

interface Props {
  product: SimilarProduct;
}

export function ProductCard({ product }: Props) {
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
      <div className="flex carousel__product-details gap-xs">
        <div className="carousel__product-name line-clamp-2 min-w-0">
          {product.name}
        </div>
        <div className="carousel__product-price flex-shrink-0">
          {formatPrice(product.price, product.currency)}
        </div>
      </div>
    </a>
  );
}
