/**
 * Script to populate product_identifier for existing products
 * Generates identifiers using pattern: PROD-{first 8 chars of UUID}
 */
import { sql } from "drizzle-orm";
import { db } from "../src/client";

async function populateProductIdentifiers() {
  console.log("Starting to populate product_identifier for existing products...");
  
  try {
    // Update all products that don't have a product_identifier
    const result = await db.execute(sql`
      UPDATE products 
      SET product_identifier = CONCAT('PROD-', SUBSTRING(id::text, 1, 8))
      WHERE product_identifier IS NULL;
    `);
    
    console.log(`✅ Successfully populated product_identifier for products`);
    console.log(`Rows affected: ${result.rowCount ?? 0}`);
    
    // Verify the update
    const countResult: any = await db.execute(sql`
      SELECT COUNT(*) as total FROM products WHERE product_identifier IS NULL;
    `);
    
    const nullCount = countResult?.rows?.[0]?.total ?? countResult?.[0]?.total ?? 0;
    console.log(`Products without product_identifier: ${nullCount}`);
    
    if (nullCount === "0" || nullCount === 0) {
      console.log("✅ All products now have product_identifier");
    } else {
      console.warn(`⚠️ Warning: ${nullCount} products still missing product_identifier`);
    }
    
  } catch (error) {
    console.error("❌ Error populating product_identifier:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

populateProductIdentifiers();
