import { sql, eq, gte, lte, and, asc, desc, or, isNull, ilike } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, type Database } from "../client";
import { products } from "../schema";

export class ProductQueryBuilder {
  private db: Database;
  private brandId: string;
  private query: any;
  private whereConditions: any[] = [];
  private orderByExpressions: any[] = [];
  private pagination: any;
  private queryTimeMs: number | undefined;

  constructor(db: Database, brandId: string, pagination?: any) {
    this.db = db;
    this.brandId = brandId;
    this.pagination = pagination;
    this.whereConditions.push(eq(products.brandId, this.brandId));
    this.query = this.db.select().from(products);
  }

  private getSortColumn(sortBy: string) {
    switch (sortBy) {
      case "createdAt":
        return products.createdAt;
      case "name":
        return products.name;
      case "updatedAt":
        return products.updatedAt;
      default:
        return products.createdAt; // Default sort column
    }
  }

  public applyFilters(filters: any) {
    if (filters?.search) {
      // Use basic text search until full-text search is properly set up
      const searchTerm = `%${filters.search}%`;
      const searchConditions = [
        ilike(products.name, searchTerm),
        ilike(products.description, searchTerm)
      ];
      this.whereConditions.push(or(...searchConditions));
    }

    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      this.whereConditions.push(eq(products.categoryId, filters.categoryIds[0])); // Support single category for now
    }

    if (filters?.season) {
      this.whereConditions.push(eq(products.season, filters.season));
    }

    if (filters?.showcaseBrandIds && filters.showcaseBrandIds.length > 0) {
      this.whereConditions.push(eq(products.showcaseBrandId, filters.showcaseBrandIds[0])); // Support single showcase brand for now
    }

    if (filters?.dateRange) {
      if (filters.dateRange.startDate) {
        this.whereConditions.push(gte(products.createdAt, filters.dateRange.startDate));
      }
      if (filters.dateRange.endDate) {
        this.whereConditions.push(lte(products.createdAt, filters.dateRange.endDate));
      }
    }

    return this;
  }

  public applySorting(sort: any) {
    if (sort?.sortBy) {
      const column = this.getSortColumn(sort.sortBy);
      if (sort.sortOrder === "desc") {
        this.orderByExpressions.push(desc(column));
      } else {
        this.orderByExpressions.push(asc(column));
      }
    }
    this.orderByExpressions.push(asc(products.id));
    return this;
  }

  public applyPagination(pagination: any) {
    const method = pagination?.method || "offset";
    let limit = pagination?.limit || 50;
    limit = Math.max(10, Math.min(100, limit)); // Clamp limit between 10 and 100

    if (method === "offset") {
      const page = pagination?.page || 1;
      const offset = (page - 1) * limit;
      this.query = this.query.limit(limit).offset(offset);
    }
    else if (method === "cursor") {
      this.query = this.query.limit(limit);
      if (pagination?.cursor) {
        const [createdAt, id] = pagination.cursor.split("_");
        this.query = this.query.where(and(lte(products.createdAt, createdAt), lte(products.id, id)));
      }
    }

    return this;
  }

  public async getTotalCount() {
    const [countResult] = await this.db.select({ count: sql<number>`count(*)` }).from(products).where(and(...this.whereConditions));
    return countResult?.count || 0;
  }

  public async execute() {
    try {
      if (this.whereConditions.length > 0) {
        this.query = this.query.where(and(...this.whereConditions));
      }
      if (this.orderByExpressions.length > 0) {
        this.query = this.query.orderBy(...this.orderByExpressions);
      }

      const startTime = process.hrtime.bigint();
      const totalCount = await this.getTotalCount();
      const products = await this.query;
      const endTime = process.hrtime.bigint();
      this.queryTimeMs = Number(endTime - startTime) / 1_000_000;

      if (this.queryTimeMs > 500) { // Log if query takes longer than 500ms
        console.warn("Slow query detected in ProductQueryBuilder", {
          queryTimeMs: this.queryTimeMs,
          brandId: this.brandId,
          filtersCount: this.whereConditions.length,
          sortCount: this.orderByExpressions.length,
          pagination: this.pagination,
        });
      }

      let hasNextPage = false;
      let hasPreviousPage = false;
      let startCursor: string | undefined;
      let endCursor: string | undefined;

      const method = this.pagination?.method || "offset";
      const limit = this.pagination?.limit || 50;

      if (method === "offset") {
        const page = this.pagination?.page || 1;
        hasNextPage = (page * limit) < totalCount;
        hasPreviousPage = page > 1;
      }
      else if (method === "cursor") {
        if (products.length > 0) {
          startCursor = `${products[0].createdAt}_${products[0].id}`;
          endCursor = `${products[products.length - 1].createdAt}_${products[products.length - 1].id}`;
          hasNextPage = products.length > limit;
          if (hasNextPage) {
            products.pop();
          }
          hasPreviousPage = !!this.pagination?.cursor;
        }
      }

      return { products, totalCount, hasNextPage, hasPreviousPage, startCursor, endCursor, queryTimeMs: this.queryTimeMs };
    } catch (error) {
      console.error("Database error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch products due to a database error.",
        cause: error,
      });
    }
  }
}
