import { z } from "zod";

export const ProductListResponseSchema = z.object({
  products: z.array(z.any()), // TODO: Define actual product schema
  pagination: z.object({
    total_count: z.number(),
    has_next_page: z.boolean(),
    has_previous_page: z.boolean(),
    start_cursor: z.string().optional(),
    end_cursor: z.string().optional(),
  }),
  search_info: z.any().optional(), // TODO: Define actual search info schema
  performance: z.any().optional(), // TODO: Define actual performance schema
});

export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;
