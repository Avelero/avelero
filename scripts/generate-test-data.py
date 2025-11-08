#!/usr/bin/env python3
"""
Product Import Test Data Generator

Generates CSV files for testing the bulk product import system.
Supports multiple scenarios: valid data, duplicates, missing fields, invalid formats, and mixed scenarios.

Usage:
    python generate-test-data.py --scenario valid --rows 1000 --output test-data.csv
    python generate-test-data.py --scenario duplicates --rows 500 --output test-duplicates.csv
    python generate-test-data.py --scenario mixed --rows 5000 --output test-mixed.csv

Requirements:
    Python 3.7+ (no external dependencies required)
"""

import csv
import random
import argparse
import sys
from typing import List, Dict, Any, Optional
from datetime import datetime


# Product name components for realistic generation
PRODUCT_TYPES = [
    "T-Shirt", "Polo Shirt", "Dress Shirt", "Sweater", "Hoodie",
    "Jeans", "Chinos", "Shorts", "Dress Pants", "Joggers",
    "Jacket", "Blazer", "Coat", "Vest", "Parka",
    "Dress", "Skirt", "Blouse", "Cardigan", "Tank Top"
]

PRODUCT_STYLES = [
    "Classic", "Slim Fit", "Regular Fit", "Oversized", "Fitted",
    "Vintage", "Modern", "Casual", "Formal", "Athletic",
    "Premium", "Essential", "Signature", "Limited Edition", "Heritage"
]

PRODUCT_MATERIALS_PRIMARY = [
    "Cotton", "Polyester", "Wool", "Linen", "Silk",
    "Denim", "Leather", "Suede", "Cashmere", "Fleece"
]

COLORS = [
    "Black", "White", "Gray", "Navy Blue", "Red",
    "Green", "Blue", "Yellow", "Orange", "Purple",
    "Pink", "Brown", "Beige", "Charcoal", "Olive",
    "Burgundy", "Teal", "Mint Green", "Sky Blue", "Coral"
]

SIZES = [
    "XS", "S", "M", "L", "XL", "2XL", "3XL"
]

CATEGORIES = [
    "T-Shirts", "Shirts", "Pants", "Outerwear", "Dresses",
    "Knitwear", "Activewear", "Accessories", "Footwear"
]

SEASONS = [
    "Spring 2024", "Summer 2024", "Fall 2024", "Winter 2024",
    "Spring/Summer 2024", "Fall/Winter 2024", "SS24", "FW24", "AW24"
]

MATERIALS = [
    ("Cotton", 100),
    ("Organic Cotton", 100),
    ("Polyester", 100),
    ("Recycled Polyester", 100),
    ("Wool", 100),
    ("Merino Wool", 100),
    ("Cotton", 65), ("Polyester", 35),
    ("Cotton", 95), ("Elastane", 5),
    ("Polyester", 88), ("Elastane", 12),
    ("Wool", 80), ("Nylon", 20),
    ("Linen", 70), ("Cotton", 30),
    ("Viscose", 60), ("Polyester", 40)
]

CARE_CODES = [
    "MACHINE_WASH",
    "HAND_WASH",
    "DRY_CLEAN",
    "TUMBLE_DRY",
    "DO_NOT_BLEACH",
    "IRON_LOW_HEAT",
    "DO_NOT_IRON"
]

ECO_CLAIMS = [
    "ORGANIC",
    "RECYCLED",
    "CARBON_NEUTRAL",
    "GOTS_CERTIFIED",
    "FAIR_TRADE",
    "OEKO_TEX",
    "BLUESIGN",
    "CRADLE_TO_CRADLE"
]


class TestDataGenerator:
    """Generates test data for product imports."""

    def __init__(self, scenario: str = "valid", rows: int = 1000, seed: Optional[int] = None):
        """
        Initialize the test data generator.

        Args:
            scenario: Test scenario type (valid, duplicates, missing_fields, invalid_formats, mixed)
            rows: Number of rows to generate
            seed: Random seed for reproducibility
        """
        self.scenario = scenario
        self.rows = rows
        self.seed = seed or random.randint(1, 1000000)
        random.seed(self.seed)

        # Track generated UPIDs and SKUs to control duplicates
        self.generated_upids: set[str] = set()
        self.generated_skus: set[str] = set()

    def generate_upid(self, allow_duplicate: bool = False) -> str:
        """Generate a unique UPID."""
        if allow_duplicate and self.generated_upids:
            # 30% chance of duplicating an existing UPID
            if random.random() < 0.3:
                return random.choice(list(self.generated_upids))

        upid = f"UPID-{random.randint(100000, 999999):06d}"
        self.generated_upids.add(upid)
        return upid

    def generate_sku(self, allow_duplicate: bool = False) -> str:
        """Generate a unique SKU."""
        if allow_duplicate and self.generated_skus:
            # 30% chance of duplicating an existing SKU
            if random.random() < 0.3:
                return random.choice(list(self.generated_skus))

        sku = f"SKU-{random.choice(['TSH', 'PNT', 'JKT', 'DRS'])}-{random.randint(10000, 99999)}"
        self.generated_skus.add(sku)
        return sku

    def generate_product_name(self, invalid: bool = False) -> str:
        """Generate a product name."""
        if invalid:
            # Generate invalid names
            error_type = random.choice(["too_long", "empty", "special_chars"])
            if error_type == "too_long":
                return "A" * 150  # Exceeds 100 char limit
            elif error_type == "empty":
                return ""
            else:
                return "Product@#$%^&*()"

        style = random.choice(PRODUCT_STYLES)
        ptype = random.choice(PRODUCT_TYPES)
        material = random.choice(PRODUCT_MATERIALS_PRIMARY)

        name_templates = [
            f"{style} {ptype}",
            f"{material} {ptype}",
            f"{style} {material} {ptype}",
            f"{ptype}"
        ]

        return random.choice(name_templates)

    def generate_description(self, invalid: bool = False) -> str:
        """Generate a product description."""
        if invalid:
            return "D" * 2500  # Exceeds 2000 char limit

        templates = [
            "A comfortable and stylish {product} perfect for everyday wear. Made with high-quality {material}.",
            "Discover the {style} {product} crafted from premium {material}. Ideal for any occasion.",
            "Elevate your wardrobe with this {style} {product}. Features exceptional quality and durability.",
            "Classic {product} design meets modern comfort. Made from sustainable {material}.",
            "The perfect {product} for the {season} season. Combines style with functionality."
        ]

        return random.choice(templates).format(
            product=random.choice(PRODUCT_TYPES).lower(),
            material=random.choice(PRODUCT_MATERIALS_PRIMARY).lower(),
            style=random.choice(PRODUCT_STYLES).lower(),
            season=random.choice(["spring", "summer", "fall", "winter"])
        )

    def generate_url(self, invalid: bool = False) -> str:
        """Generate an image URL."""
        if invalid:
            return "not-a-valid-url"

        domains = ["cdn.example.com", "images.product-store.com", "assets.fashion-brand.com"]
        filename = f"product-{random.randint(1000, 9999)}.jpg"
        return f"https://{random.choice(domains)}/products/{filename}"

    def generate_uuid(self, invalid: bool = False) -> str:
        """Generate a UUID."""
        if invalid:
            return "not-a-uuid-format"

        # Generate a valid-looking UUID
        import uuid
        return str(uuid.uuid4())

    def generate_materials(self, invalid: bool = False) -> tuple[List[str], List[int]]:
        """Generate material composition."""
        if invalid:
            # Generate materials that don't sum to 100
            return ["Cotton", "Polyester"], [65, 50]  # Sums to 115

        material_combo = random.choice(MATERIALS)

        if isinstance(material_combo, tuple) and len(material_combo) == 2:
            # Single material
            return [material_combo[0]], [material_combo[1]]
        else:
            # Multiple materials from MATERIALS list
            num_materials = random.choice([1, 2, 3])
            selected = random.sample([m for m in MATERIALS if isinstance(m, tuple) and len(m) == 2],
                                   min(num_materials, len(MATERIALS)))

            materials = [m[0] for m in selected[:num_materials]]
            percentages = [m[1] for m in selected[:num_materials]]

            # Normalize to 100%
            total = sum(percentages)
            if total > 0:
                percentages = [int((p / total) * 100) for p in percentages]
                # Adjust last percentage to ensure sum is exactly 100
                percentages[-1] = 100 - sum(percentages[:-1])

            return materials, percentages

    def generate_row(self, row_number: int) -> Dict[str, Any]:
        """Generate a single row of test data."""
        # Determine if this row should have errors based on scenario
        should_have_error = False
        error_type = None

        if self.scenario == "duplicates":
            should_have_error = row_number > 10  # Allow duplicates after first 10 rows
            error_type = "duplicate"
        elif self.scenario == "missing_fields":
            should_have_error = random.random() < 0.2  # 20% error rate
            error_type = "missing"
        elif self.scenario == "invalid_formats":
            should_have_error = random.random() < 0.2  # 20% error rate
            error_type = "invalid"
        elif self.scenario == "mixed":
            should_have_error = random.random() < 0.1  # 10% error rate
            error_type = random.choice(["duplicate", "missing", "invalid"])

        # Generate UPID and SKU
        if error_type == "missing" and random.random() < 0.5:
            upid = ""
            sku = ""
        else:
            upid = self.generate_upid(allow_duplicate=(error_type == "duplicate"))
            sku = self.generate_sku(allow_duplicate=(error_type == "duplicate"))

        # Generate product name
        if error_type == "missing" and random.random() < 0.3:
            product_name = ""
        else:
            product_name = self.generate_product_name(invalid=(error_type == "invalid" and random.random() < 0.3))

        # Generate optional fields (50% filled for valid scenarios)
        include_optional = random.random() < 0.5 or error_type == "invalid"

        description = self.generate_description(invalid=(error_type == "invalid" and random.random() < 0.2)) if include_optional else ""
        category = random.choice(CATEGORIES) if include_optional else ""
        season = random.choice(SEASONS) if include_optional else ""
        primary_image_url = self.generate_url(invalid=(error_type == "invalid" and random.random() < 0.2)) if include_optional else ""

        color = random.choice(COLORS) if random.random() < 0.7 else ""
        size = random.choice(SIZES) if random.random() < 0.7 else ""
        product_image_url = self.generate_url(invalid=(error_type == "invalid" and random.random() < 0.2)) if random.random() < 0.3 else ""

        # Generate materials
        materials, percentages = self.generate_materials(invalid=(error_type == "invalid" and random.random() < 0.15))

        # Pad materials to 3
        while len(materials) < 3:
            materials.append("")
            percentages.append("")

        # Generate care codes and eco claims
        num_care_codes = random.randint(1, 4) if random.random() < 0.6 else 0
        care_codes = ",".join(random.sample(CARE_CODES, num_care_codes)) if num_care_codes > 0 else ""

        num_eco_claims = random.randint(1, 3) if random.random() < 0.4 else 0
        eco_claims = ",".join(random.sample(ECO_CLAIMS, num_eco_claims)) if num_eco_claims > 0 else ""

        environment_score = random.randint(50, 100) if random.random() < 0.5 else ""

        return {
            "product_name": product_name,
            "upid": upid,
            "sku": sku,
            "description": description,
            "category_name": category,
            "season": season,
            "primary_image_url": primary_image_url,
            "color_name": color,
            "size_name": size,
            "product_image_url": product_image_url,
            "material_1_name": materials[0],
            "material_1_percentage": percentages[0],
            "material_2_name": materials[1],
            "material_2_percentage": percentages[1],
            "material_3_name": materials[2],
            "material_3_percentage": percentages[2],
            "care_codes": care_codes,
            "eco_claims": eco_claims,
            "environment_score": environment_score
        }

    def generate(self) -> List[Dict[str, Any]]:
        """Generate all test data rows."""
        print(f"Generating {self.rows} rows with scenario: {self.scenario}")
        print(f"Random seed: {self.seed}")

        data = []
        for i in range(self.rows):
            row = self.generate_row(i + 1)  # Row numbers start at 1
            data.append(row)

            # Progress indicator for large datasets
            if (i + 1) % 1000 == 0:
                print(f"Generated {i + 1}/{self.rows} rows...")

        return data

    def write_csv(self, data: List[Dict[str, Any]], output_file: str) -> None:
        """Write generated data to CSV file."""
        print(f"\nWriting data to {output_file}...")

        fieldnames = [
            "product_name", "upid", "sku", "description", "category_name", "season",
            "primary_image_url", "color_name", "size_name", "product_image_url",
            "material_1_name", "material_1_percentage", "material_2_name", "material_2_percentage",
            "material_3_name", "material_3_percentage", "care_codes", "eco_claims", "environment_score"
        ]

        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

        print(f"Successfully wrote {len(data)} rows to {output_file}")

        # Print statistics
        self.print_statistics(data)

    def print_statistics(self, data: List[Dict[str, Any]]) -> None:
        """Print statistics about generated data."""
        print("\n=== Generation Statistics ===")
        print(f"Total rows: {len(data)}")
        print(f"Unique UPIDs: {len(self.generated_upids)}")
        print(f"Unique SKUs: {len(self.generated_skus)}")

        # Count rows with missing required fields
        missing_upid_sku = sum(1 for row in data if not row["upid"] and not row["sku"])
        missing_name = sum(1 for row in data if not row["product_name"])
        print(f"Rows missing both UPID and SKU: {missing_upid_sku}")
        print(f"Rows missing product_name: {missing_name}")

        # Count rows with optional fields
        with_description = sum(1 for row in data if row["description"])
        with_materials = sum(1 for row in data if row["material_1_name"])
        with_care_codes = sum(1 for row in data if row["care_codes"])
        with_eco_claims = sum(1 for row in data if row["eco_claims"])

        print(f"\nOptional field coverage:")
        print(f"  - Descriptions: {with_description}/{len(data)} ({with_description/len(data)*100:.1f}%)")
        print(f"  - Materials: {with_materials}/{len(data)} ({with_materials/len(data)*100:.1f}%)")
        print(f"  - Care codes: {with_care_codes}/{len(data)} ({with_care_codes/len(data)*100:.1f}%)")
        print(f"  - Eco claims: {with_eco_claims}/{len(data)} ({with_eco_claims/len(data)*100:.1f}%)")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate test data for product import system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Scenarios:
  valid           100%% valid data (default)
  duplicates      Include duplicate UPIDs/SKUs (30%% duplication rate after row 10)
  missing_fields  Random missing required fields (20%% error rate)
  invalid_formats Invalid UUIDs, URLs, field lengths (20%% error rate)
  mixed           Mix of all error types (10%% error rate)

Examples:
  python generate-test-data.py --scenario valid --rows 5000 --output valid-5k.csv
  python generate-test-data.py --scenario mixed --rows 1000 --output mixed-1k.csv
  python generate-test-data.py --scenario duplicates --rows 500 --output test-duplicates.csv
        """
    )

    parser.add_argument(
        "--scenario",
        choices=["valid", "duplicates", "missing_fields", "invalid_formats", "mixed"],
        default="valid",
        help="Test scenario type (default: valid)"
    )

    parser.add_argument(
        "--rows",
        type=int,
        default=1000,
        help="Number of rows to generate (default: 1000)"
    )

    parser.add_argument(
        "--output",
        type=str,
        default="test-data.csv",
        help="Output CSV file path (default: test-data.csv)"
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for reproducibility (default: random)"
    )

    args = parser.parse_args()

    # Validate row count
    if args.rows < 1:
        print("Error: --rows must be at least 1", file=sys.stderr)
        sys.exit(1)

    if args.rows > 100000:
        print("Warning: Generating more than 100,000 rows may take a while...")

    # Generate test data
    generator = TestDataGenerator(
        scenario=args.scenario,
        rows=args.rows,
        seed=args.seed
    )

    try:
        data = generator.generate()
        generator.write_csv(data, args.output)

        print(f"\n✓ Test data generation complete!")
        print(f"  Scenario: {args.scenario}")
        print(f"  Output: {args.output}")
        print(f"  Seed: {generator.seed} (use --seed={generator.seed} to reproduce)")

    except Exception as e:
        print(f"\n✗ Error generating test data: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
