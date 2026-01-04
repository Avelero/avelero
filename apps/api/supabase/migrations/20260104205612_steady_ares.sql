ALTER TABLE "brand_certifications" RENAME COLUMN "file_path" TO "certification_path";
ALTER TABLE "brand_certifications" ALTER COLUMN "certification_path" TYPE text;
