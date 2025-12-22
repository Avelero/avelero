export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4";
  };
  public: {
    Tables: {
      brand_attribute_values: {
        Row: {
          attribute_id: string;
          brand_id: string;
          created_at: string;
          id: string;
          name: string;
          taxonomy_value_id: string | null;
          updated_at: string;
        };
        Insert: {
          attribute_id: string;
          brand_id: string;
          created_at?: string;
          id?: string;
          name: string;
          taxonomy_value_id?: string | null;
          updated_at?: string;
        };
        Update: {
          attribute_id?: string;
          brand_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          taxonomy_value_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_attribute_values_attribute_id_brand_attributes_id_fk";
            columns: ["attribute_id"];
            isOneToOne: false;
            referencedRelation: "brand_attributes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_attribute_values_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_attribute_values_taxonomy_value_id_taxonomy_values_id_fk";
            columns: ["taxonomy_value_id"];
            isOneToOne: false;
            referencedRelation: "taxonomy_values";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_attributes: {
        Row: {
          brand_id: string;
          created_at: string;
          id: string;
          name: string;
          taxonomy_attribute_id: string | null;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          id?: string;
          name: string;
          taxonomy_attribute_id?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          taxonomy_attribute_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_attributes_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_attributes_taxonomy_attribute_id_taxonomy_attributes_id_f";
            columns: ["taxonomy_attribute_id"];
            isOneToOne: false;
            referencedRelation: "taxonomy_attributes";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_certifications: {
        Row: {
          brand_id: string;
          certification_code: string | null;
          created_at: string;
          expiry_date: string | null;
          file_path: string | null;
          id: string;
          institute_address_line_1: string | null;
          institute_address_line_2: string | null;
          institute_city: string | null;
          institute_country_code: string | null;
          institute_email: string | null;
          institute_name: string | null;
          institute_state: string | null;
          institute_website: string | null;
          institute_zip: string | null;
          issue_date: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          certification_code?: string | null;
          created_at?: string;
          expiry_date?: string | null;
          file_path?: string | null;
          id?: string;
          institute_address_line_1?: string | null;
          institute_address_line_2?: string | null;
          institute_city?: string | null;
          institute_country_code?: string | null;
          institute_email?: string | null;
          institute_name?: string | null;
          institute_state?: string | null;
          institute_website?: string | null;
          institute_zip?: string | null;
          issue_date?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          certification_code?: string | null;
          created_at?: string;
          expiry_date?: string | null;
          file_path?: string | null;
          id?: string;
          institute_address_line_1?: string | null;
          institute_address_line_2?: string | null;
          institute_city?: string | null;
          institute_country_code?: string | null;
          institute_email?: string | null;
          institute_name?: string | null;
          institute_state?: string | null;
          institute_website?: string | null;
          institute_zip?: string | null;
          issue_date?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_certifications_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_collections: {
        Row: {
          brand_id: string;
          created_at: string;
          description: string | null;
          filter: Json;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          description?: string | null;
          filter?: Json;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          description?: string | null;
          filter?: Json;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_collections_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_eco_claims: {
        Row: {
          brand_id: string;
          claim: string;
          created_at: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          claim: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          claim?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_eco_claims_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_facilities: {
        Row: {
          address_line_1: string | null;
          address_line_2: string | null;
          brand_id: string;
          city: string | null;
          country_code: string | null;
          created_at: string;
          display_name: string;
          email: string | null;
          id: string;
          legal_name: string | null;
          phone: string | null;
          state: string | null;
          updated_at: string;
          website: string | null;
          zip: string | null;
        };
        Insert: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          brand_id: string;
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          display_name: string;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          phone?: string | null;
          state?: string | null;
          updated_at?: string;
          website?: string | null;
          zip?: string | null;
        };
        Update: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          brand_id?: string;
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          phone?: string | null;
          state?: string | null;
          updated_at?: string;
          website?: string | null;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "brand_facilities_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_integrations: {
        Row: {
          brand_id: string;
          created_at: string;
          credentials: string | null;
          credentials_iv: string | null;
          error_message: string | null;
          id: string;
          integration_id: string;
          last_sync_at: string | null;
          shop_domain: string | null;
          status: string;
          sync_interval: number;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          credentials?: string | null;
          credentials_iv?: string | null;
          error_message?: string | null;
          id?: string;
          integration_id: string;
          last_sync_at?: string | null;
          shop_domain?: string | null;
          status?: string;
          sync_interval?: number;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          credentials?: string | null;
          credentials_iv?: string | null;
          error_message?: string | null;
          id?: string;
          integration_id?: string;
          last_sync_at?: string | null;
          shop_domain?: string | null;
          status?: string;
          sync_interval?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_integrations_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_integrations_integration_id_integrations_id_fk";
            columns: ["integration_id"];
            isOneToOne: false;
            referencedRelation: "integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_invites: {
        Row: {
          brand_id: string;
          created_at: string;
          created_by: string | null;
          email: string;
          expires_at: string | null;
          id: string;
          role: string;
          token_hash: string | null;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          created_by?: string | null;
          email: string;
          expires_at?: string | null;
          id?: string;
          role: string;
          token_hash?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string;
          expires_at?: string | null;
          id?: string;
          role?: string;
          token_hash?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_invites_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_manufacturers: {
        Row: {
          address_line_1: string | null;
          address_line_2: string | null;
          brand_id: string;
          city: string | null;
          country_code: string | null;
          created_at: string;
          email: string | null;
          id: string;
          legal_name: string | null;
          name: string;
          phone: string | null;
          state: string | null;
          updated_at: string;
          website: string | null;
          zip: string | null;
        };
        Insert: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          brand_id: string;
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          name: string;
          phone?: string | null;
          state?: string | null;
          updated_at?: string;
          website?: string | null;
          zip?: string | null;
        };
        Update: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          brand_id?: string;
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          name?: string;
          phone?: string | null;
          state?: string | null;
          updated_at?: string;
          website?: string | null;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "brand_manufacturers_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_materials: {
        Row: {
          brand_id: string;
          certification_id: string | null;
          country_of_origin: string | null;
          created_at: string;
          id: string;
          name: string;
          recyclable: boolean | null;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          certification_id?: string | null;
          country_of_origin?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          recyclable?: boolean | null;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          certification_id?: string | null;
          country_of_origin?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          recyclable?: boolean | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_materials_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_materials_certification_id_brand_certifications_id_fk";
            columns: ["certification_id"];
            isOneToOne: false;
            referencedRelation: "brand_certifications";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_members: {
        Row: {
          brand_id: string;
          created_at: string;
          id: string;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          id?: string;
          role: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_members_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_members_user_id_users_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_seasons: {
        Row: {
          brand_id: string;
          created_at: string;
          end_date: string | null;
          id: string;
          name: string;
          ongoing: boolean;
          start_date: string | null;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          name: string;
          ongoing?: boolean;
          start_date?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          name?: string;
          ongoing?: boolean;
          start_date?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_seasons_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_tags: {
        Row: {
          brand_id: string;
          created_at: string;
          hex: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          hex?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          hex?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_tags_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_theme: {
        Row: {
          brand_id: string;
          created_at: string;
          google_fonts_url: string | null;
          screenshot_desktop_path: string | null;
          screenshot_mobile_path: string | null;
          stylesheet_path: string | null;
          theme_config: Json;
          theme_styles: Json;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          google_fonts_url?: string | null;
          screenshot_desktop_path?: string | null;
          screenshot_mobile_path?: string | null;
          stylesheet_path?: string | null;
          theme_config?: Json;
          theme_styles?: Json;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          google_fonts_url?: string | null;
          screenshot_desktop_path?: string | null;
          screenshot_mobile_path?: string | null;
          stylesheet_path?: string | null;
          theme_config?: Json;
          theme_styles?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_theme_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: true;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          avatar_hue: number | null;
          country_code: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          id: string;
          logo_path: string | null;
          name: string;
          slug: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_hue?: number | null;
          country_code?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          logo_path?: string | null;
          name: string;
          slug?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_hue?: number | null;
          country_code?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          logo_path?: string | null;
          name?: string;
          slug?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      file_assets: {
        Row: {
          brand_id: string | null;
          bucket: string;
          bytes: number | null;
          created_at: string;
          id: string;
          mime_type: string | null;
          path: string;
        };
        Insert: {
          brand_id?: string | null;
          bucket: string;
          bytes?: number | null;
          created_at?: string;
          id?: string;
          mime_type?: string | null;
          path: string;
        };
        Update: {
          brand_id?: string | null;
          bucket?: string;
          bytes?: number | null;
          created_at?: string;
          id?: string;
          mime_type?: string | null;
          path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "file_assets_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      import_jobs: {
        Row: {
          brand_id: string;
          commit_started_at: string | null;
          filename: string;
          finished_at: string | null;
          id: string;
          requires_value_approval: boolean;
          started_at: string;
          status: string;
          summary: Json | null;
        };
        Insert: {
          brand_id: string;
          commit_started_at?: string | null;
          filename: string;
          finished_at?: string | null;
          id?: string;
          requires_value_approval?: boolean;
          started_at?: string;
          status?: string;
          summary?: Json | null;
        };
        Update: {
          brand_id?: string;
          commit_started_at?: string | null;
          filename?: string;
          finished_at?: string | null;
          id?: string;
          requires_value_approval?: boolean;
          started_at?: string;
          status?: string;
          summary?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "import_jobs_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      import_rows: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          job_id: string;
          normalized: Json | null;
          raw: Json;
          row_number: number;
          status: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          job_id: string;
          normalized?: Json | null;
          raw: Json;
          row_number: number;
          status?: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          job_id?: string;
          normalized?: Json | null;
          raw?: Json;
          row_number?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_rows_job_id_import_jobs_id_fk";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_certification_links: {
        Row: {
          brand_integration_id: string;
          certification_id: string;
          created_at: string;
          external_id: string;
          external_name: string | null;
          id: string;
          last_synced_at: string | null;
          updated_at: string;
        };
        Insert: {
          brand_integration_id: string;
          certification_id: string;
          created_at?: string;
          external_id: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_integration_id?: string;
          certification_id?: string;
          created_at?: string;
          external_id?: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_certification_links_brand_integration_id_brand_inte";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_certification_links_certification_id_brand_certific";
            columns: ["certification_id"];
            isOneToOne: false;
            referencedRelation: "brand_certifications";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_eco_claim_links: {
        Row: {
          brand_integration_id: string;
          created_at: string;
          eco_claim_id: string;
          external_id: string;
          external_name: string | null;
          id: string;
          last_synced_at: string | null;
          updated_at: string;
        };
        Insert: {
          brand_integration_id: string;
          created_at?: string;
          eco_claim_id: string;
          external_id: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_integration_id?: string;
          created_at?: string;
          eco_claim_id?: string;
          external_id?: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_eco_claim_links_brand_integration_id_brand_integrat";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_eco_claim_links_eco_claim_id_brand_eco_claims_id_fk";
            columns: ["eco_claim_id"];
            isOneToOne: false;
            referencedRelation: "brand_eco_claims";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_facility_links: {
        Row: {
          brand_integration_id: string;
          created_at: string;
          external_id: string;
          external_name: string | null;
          facility_id: string;
          id: string;
          last_synced_at: string | null;
          updated_at: string;
        };
        Insert: {
          brand_integration_id: string;
          created_at?: string;
          external_id: string;
          external_name?: string | null;
          facility_id: string;
          id?: string;
          last_synced_at?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_integration_id?: string;
          created_at?: string;
          external_id?: string;
          external_name?: string | null;
          facility_id?: string;
          id?: string;
          last_synced_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_facility_links_brand_integration_id_brand_integrati";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_facility_links_facility_id_brand_facilities_id_fk";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "brand_facilities";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_field_configs: {
        Row: {
          brand_integration_id: string;
          created_at: string;
          field_key: string;
          id: string;
          ownership_enabled: boolean;
          source_option_key: string | null;
          updated_at: string;
        };
        Insert: {
          brand_integration_id: string;
          created_at?: string;
          field_key: string;
          id?: string;
          ownership_enabled?: boolean;
          source_option_key?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_integration_id?: string;
          created_at?: string;
          field_key?: string;
          id?: string;
          ownership_enabled?: boolean;
          source_option_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_field_configs_brand_integration_id_brand_integratio";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_manufacturer_links: {
        Row: {
          brand_integration_id: string;
          created_at: string;
          external_id: string;
          external_name: string | null;
          id: string;
          last_synced_at: string | null;
          manufacturer_id: string;
          updated_at: string;
        };
        Insert: {
          brand_integration_id: string;
          created_at?: string;
          external_id: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          manufacturer_id: string;
          updated_at?: string;
        };
        Update: {
          brand_integration_id?: string;
          created_at?: string;
          external_id?: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          manufacturer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_manufacturer_links_brand_integration_id_brand_integ";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_manufacturer_links_manufacturer_id_brand_manufactur";
            columns: ["manufacturer_id"];
            isOneToOne: false;
            referencedRelation: "brand_manufacturers";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_material_links: {
        Row: {
          brand_integration_id: string;
          created_at: string;
          external_id: string;
          external_name: string | null;
          id: string;
          last_synced_at: string | null;
          material_id: string;
          updated_at: string;
        };
        Insert: {
          brand_integration_id: string;
          created_at?: string;
          external_id: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          material_id: string;
          updated_at?: string;
        };
        Update: {
          brand_integration_id?: string;
          created_at?: string;
          external_id?: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          material_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_material_links_brand_integration_id_brand_integrati";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_material_links_material_id_brand_materials_id_fk";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "brand_materials";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_product_links: {
        Row: {
          brand_integration_id: string;
          created_at: string;
          external_id: string;
          external_name: string | null;
          id: string;
          last_synced_at: string | null;
          last_synced_hash: string | null;
          product_id: string;
          updated_at: string;
        };
        Insert: {
          brand_integration_id: string;
          created_at?: string;
          external_id: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          last_synced_hash?: string | null;
          product_id: string;
          updated_at?: string;
        };
        Update: {
          brand_integration_id?: string;
          created_at?: string;
          external_id?: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          last_synced_hash?: string | null;
          product_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_product_links_brand_integration_id_brand_integratio";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_product_links_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_season_links: {
        Row: {
          brand_integration_id: string;
          created_at: string;
          external_id: string;
          external_name: string | null;
          id: string;
          last_synced_at: string | null;
          season_id: string;
          updated_at: string;
        };
        Insert: {
          brand_integration_id: string;
          created_at?: string;
          external_id: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          season_id: string;
          updated_at?: string;
        };
        Update: {
          brand_integration_id?: string;
          created_at?: string;
          external_id?: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          season_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_season_links_brand_integration_id_brand_integration";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_season_links_season_id_brand_seasons_id_fk";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "brand_seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_sync_jobs: {
        Row: {
          brand_integration_id: string;
          created_at: string;
          entities_created: number;
          error_log: Json | null;
          error_summary: string | null;
          finished_at: string | null;
          id: string;
          products_created: number;
          products_failed: number;
          products_processed: number;
          products_skipped: number;
          products_total: number | null;
          products_updated: number;
          started_at: string | null;
          status: string;
          trigger_type: string;
          updated_at: string;
          variants_created: number;
          variants_failed: number;
          variants_processed: number;
          variants_skipped: number;
          variants_updated: number;
        };
        Insert: {
          brand_integration_id: string;
          created_at?: string;
          entities_created?: number;
          error_log?: Json | null;
          error_summary?: string | null;
          finished_at?: string | null;
          id?: string;
          products_created?: number;
          products_failed?: number;
          products_processed?: number;
          products_skipped?: number;
          products_total?: number | null;
          products_updated?: number;
          started_at?: string | null;
          status?: string;
          trigger_type?: string;
          updated_at?: string;
          variants_created?: number;
          variants_failed?: number;
          variants_processed?: number;
          variants_skipped?: number;
          variants_updated?: number;
        };
        Update: {
          brand_integration_id?: string;
          created_at?: string;
          entities_created?: number;
          error_log?: Json | null;
          error_summary?: string | null;
          finished_at?: string | null;
          id?: string;
          products_created?: number;
          products_failed?: number;
          products_processed?: number;
          products_skipped?: number;
          products_total?: number | null;
          products_updated?: number;
          started_at?: string | null;
          status?: string;
          trigger_type?: string;
          updated_at?: string;
          variants_created?: number;
          variants_failed?: number;
          variants_processed?: number;
          variants_skipped?: number;
          variants_updated?: number;
        };
        Relationships: [
          {
            foreignKeyName: "integration_sync_jobs_brand_integration_id_brand_integrations_i";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_tag_links: {
        Row: {
          brand_integration_id: string;
          created_at: string;
          external_id: string;
          external_name: string | null;
          id: string;
          last_synced_at: string | null;
          tag_id: string;
          updated_at: string;
        };
        Insert: {
          brand_integration_id: string;
          created_at?: string;
          external_id: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          tag_id: string;
          updated_at?: string;
        };
        Update: {
          brand_integration_id?: string;
          created_at?: string;
          external_id?: string;
          external_name?: string | null;
          id?: string;
          last_synced_at?: string | null;
          tag_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_tag_links_brand_integration_id_brand_integrations_i";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_tag_links_tag_id_brand_tags_id_fk";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "brand_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_variant_links: {
        Row: {
          brand_integration_id: string;
          created_at: string;
          external_barcode: string | null;
          external_id: string;
          external_product_id: string | null;
          external_sku: string | null;
          id: string;
          last_synced_at: string | null;
          last_synced_hash: string | null;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          brand_integration_id: string;
          created_at?: string;
          external_barcode?: string | null;
          external_id: string;
          external_product_id?: string | null;
          external_sku?: string | null;
          id?: string;
          last_synced_at?: string | null;
          last_synced_hash?: string | null;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          brand_integration_id?: string;
          created_at?: string;
          external_barcode?: string | null;
          external_id?: string;
          external_product_id?: string | null;
          external_sku?: string | null;
          id?: string;
          last_synced_at?: string | null;
          last_synced_hash?: string | null;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_variant_links_brand_integration_id_brand_integratio";
            columns: ["brand_integration_id"];
            isOneToOne: false;
            referencedRelation: "brand_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_variant_links_variant_id_product_variants_id_fk";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      integrations: {
        Row: {
          auth_type: string;
          created_at: string;
          description: string | null;
          icon_path: string | null;
          id: string;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          auth_type: string;
          created_at?: string;
          description?: string | null;
          icon_path?: string | null;
          id?: string;
          name: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          auth_type?: string;
          created_at?: string;
          description?: string | null;
          icon_path?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      oauth_states: {
        Row: {
          brand_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          integration_slug: string;
          shop_domain: string | null;
          state: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          integration_slug: string;
          shop_domain?: string | null;
          state: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          integration_slug?: string;
          shop_domain?: string | null;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_states_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      product_commercial: {
        Row: {
          created_at: string;
          currency: string | null;
          price: number | null;
          product_id: string;
          sales_status: string | null;
          updated_at: string;
          webshop_url: string | null;
        };
        Insert: {
          created_at?: string;
          currency?: string | null;
          price?: number | null;
          product_id: string;
          sales_status?: string | null;
          updated_at?: string;
          webshop_url?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string | null;
          price?: number | null;
          product_id?: string;
          sales_status?: string | null;
          updated_at?: string;
          webshop_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_commercial_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_eco_claims: {
        Row: {
          created_at: string;
          eco_claim_id: string;
          id: string;
          product_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          eco_claim_id: string;
          id?: string;
          product_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          eco_claim_id?: string;
          id?: string;
          product_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_eco_claims_eco_claim_id_brand_eco_claims_id_fk";
            columns: ["eco_claim_id"];
            isOneToOne: false;
            referencedRelation: "brand_eco_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_eco_claims_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_environment: {
        Row: {
          created_at: string;
          metric: string;
          product_id: string;
          unit: string | null;
          updated_at: string;
          value: number | null;
        };
        Insert: {
          created_at?: string;
          metric: string;
          product_id: string;
          unit?: string | null;
          updated_at?: string;
          value?: number | null;
        };
        Update: {
          created_at?: string;
          metric?: string;
          product_id?: string;
          unit?: string | null;
          updated_at?: string;
          value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_environment_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_journey_steps: {
        Row: {
          created_at: string;
          facility_id: string;
          id: string;
          product_id: string;
          sort_index: number;
          step_type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          facility_id: string;
          id?: string;
          product_id: string;
          sort_index: number;
          step_type: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          facility_id?: string;
          id?: string;
          product_id?: string;
          sort_index?: number;
          step_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_journey_steps_facility_id_brand_facilities_id_fk";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "brand_facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_journey_steps_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_materials: {
        Row: {
          brand_material_id: string;
          created_at: string;
          id: string;
          percentage: number | null;
          product_id: string;
          updated_at: string;
        };
        Insert: {
          brand_material_id: string;
          created_at?: string;
          id?: string;
          percentage?: number | null;
          product_id: string;
          updated_at?: string;
        };
        Update: {
          brand_material_id?: string;
          created_at?: string;
          id?: string;
          percentage?: number | null;
          product_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_materials_brand_material_id_brand_materials_id_fk";
            columns: ["brand_material_id"];
            isOneToOne: false;
            referencedRelation: "brand_materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_materials_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_tags: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          tag_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          tag_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          tag_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_tags_tag_id_brand_tags_id_fk";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "brand_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variant_attributes: {
        Row: {
          attribute_value_id: string;
          created_at: string;
          sort_order: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          attribute_value_id: string;
          created_at?: string;
          sort_order?: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          attribute_value_id?: string;
          created_at?: string;
          sort_order?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variant_attributes_attribute_value_id_brand_attribute_v";
            columns: ["attribute_value_id"];
            isOneToOne: false;
            referencedRelation: "brand_attribute_values";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variant_attributes_variant_id_product_variants_id_fk";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          barcode: string | null;
          created_at: string;
          id: string;
          product_id: string;
          sku: string | null;
          updated_at: string;
          upid: string | null;
        };
        Insert: {
          barcode?: string | null;
          created_at?: string;
          id?: string;
          product_id: string;
          sku?: string | null;
          updated_at?: string;
          upid?: string | null;
        };
        Update: {
          barcode?: string | null;
          created_at?: string;
          id?: string;
          product_id?: string;
          sku?: string | null;
          updated_at?: string;
          upid?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_weight: {
        Row: {
          created_at: string;
          product_id: string;
          updated_at: string;
          weight: number | null;
          weight_unit: string | null;
        };
        Insert: {
          created_at?: string;
          product_id: string;
          updated_at?: string;
          weight?: number | null;
          weight_unit?: string | null;
        };
        Update: {
          created_at?: string;
          product_id?: string;
          updated_at?: string;
          weight?: number | null;
          weight_unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_weight_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          brand_id: string;
          category_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          image_path: string | null;
          manufacturer_id: string | null;
          name: string;
          product_handle: string;
          season_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          manufacturer_id?: string | null;
          name: string;
          product_handle: string;
          season_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          manufacturer_id?: string | null;
          name?: string;
          product_handle?: string;
          season_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_id_taxonomy_categories_id_fk";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "taxonomy_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_manufacturer_id_brand_manufacturers_id_fk";
            columns: ["manufacturer_id"];
            isOneToOne: false;
            referencedRelation: "brand_manufacturers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_season_id_brand_seasons_id_fk";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "brand_seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      staging_product_eco_claims: {
        Row: {
          created_at: string;
          eco_claim_id: string;
          job_id: string;
          staging_id: string;
          staging_product_id: string;
        };
        Insert: {
          created_at?: string;
          eco_claim_id: string;
          job_id: string;
          staging_id?: string;
          staging_product_id: string;
        };
        Update: {
          created_at?: string;
          eco_claim_id?: string;
          job_id?: string;
          staging_id?: string;
          staging_product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staging_product_eco_claims_eco_claim_id_brand_eco_claims_id_fk";
            columns: ["eco_claim_id"];
            isOneToOne: false;
            referencedRelation: "brand_eco_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_product_eco_claims_job_id_import_jobs_id_fk";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_product_eco_claims_staging_product_id_staging_products_";
            columns: ["staging_product_id"];
            isOneToOne: false;
            referencedRelation: "staging_products";
            referencedColumns: ["staging_id"];
          },
        ];
      };
      staging_product_environment: {
        Row: {
          carbon_kg_co2e: number | null;
          created_at: string;
          job_id: string;
          staging_id: string;
          staging_product_id: string;
          water_liters: number | null;
        };
        Insert: {
          carbon_kg_co2e?: number | null;
          created_at?: string;
          job_id: string;
          staging_id?: string;
          staging_product_id: string;
          water_liters?: number | null;
        };
        Update: {
          carbon_kg_co2e?: number | null;
          created_at?: string;
          job_id?: string;
          staging_id?: string;
          staging_product_id?: string;
          water_liters?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "staging_product_environment_job_id_import_jobs_id_fk";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_product_environment_staging_product_id_staging_products";
            columns: ["staging_product_id"];
            isOneToOne: false;
            referencedRelation: "staging_products";
            referencedColumns: ["staging_id"];
          },
        ];
      };
      staging_product_journey_steps: {
        Row: {
          created_at: string;
          facility_id: string;
          job_id: string;
          sort_index: number;
          staging_id: string;
          staging_product_id: string;
          step_type: string;
        };
        Insert: {
          created_at?: string;
          facility_id: string;
          job_id: string;
          sort_index: number;
          staging_id?: string;
          staging_product_id: string;
          step_type: string;
        };
        Update: {
          created_at?: string;
          facility_id?: string;
          job_id?: string;
          sort_index?: number;
          staging_id?: string;
          staging_product_id?: string;
          step_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staging_product_journey_steps_facility_id_brand_facilities_id_f";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "brand_facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_product_journey_steps_job_id_import_jobs_id_fk";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_product_journey_steps_staging_product_id_staging_produc";
            columns: ["staging_product_id"];
            isOneToOne: false;
            referencedRelation: "staging_products";
            referencedColumns: ["staging_id"];
          },
        ];
      };
      staging_product_materials: {
        Row: {
          brand_material_id: string;
          created_at: string;
          job_id: string;
          percentage: number | null;
          staging_id: string;
          staging_product_id: string;
        };
        Insert: {
          brand_material_id: string;
          created_at?: string;
          job_id: string;
          percentage?: number | null;
          staging_id?: string;
          staging_product_id: string;
        };
        Update: {
          brand_material_id?: string;
          created_at?: string;
          job_id?: string;
          percentage?: number | null;
          staging_id?: string;
          staging_product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staging_product_materials_brand_material_id_brand_materials_id_";
            columns: ["brand_material_id"];
            isOneToOne: false;
            referencedRelation: "brand_materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_product_materials_job_id_import_jobs_id_fk";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_product_materials_staging_product_id_staging_products_s";
            columns: ["staging_product_id"];
            isOneToOne: false;
            referencedRelation: "staging_products";
            referencedColumns: ["staging_id"];
          },
        ];
      };
      staging_product_tags: {
        Row: {
          created_at: string;
          job_id: string;
          staging_id: string;
          staging_product_id: string;
          tag_id: string;
        };
        Insert: {
          created_at?: string;
          job_id: string;
          staging_id?: string;
          staging_product_id: string;
          tag_id: string;
        };
        Update: {
          created_at?: string;
          job_id?: string;
          staging_id?: string;
          staging_product_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staging_product_tags_job_id_import_jobs_id_fk";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_product_tags_staging_product_id_staging_products_fk";
            columns: ["staging_product_id"];
            isOneToOne: false;
            referencedRelation: "staging_products";
            referencedColumns: ["staging_id"];
          },
          {
            foreignKeyName: "staging_product_tags_tag_id_brand_tags_id_fk";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "brand_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      staging_product_variants: {
        Row: {
          action: string;
          color_id: string | null;
          created_at: string;
          existing_variant_id: string | null;
          id: string;
          job_id: string;
          product_id: string;
          row_number: number;
          size_id: string | null;
          staging_id: string;
          staging_product_id: string;
          upid: string;
        };
        Insert: {
          action: string;
          color_id?: string | null;
          created_at?: string;
          existing_variant_id?: string | null;
          id: string;
          job_id: string;
          product_id: string;
          row_number: number;
          size_id?: string | null;
          staging_id?: string;
          staging_product_id: string;
          upid: string;
        };
        Update: {
          action?: string;
          color_id?: string | null;
          created_at?: string;
          existing_variant_id?: string | null;
          id?: string;
          job_id?: string;
          product_id?: string;
          row_number?: number;
          size_id?: string | null;
          staging_id?: string;
          staging_product_id?: string;
          upid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staging_product_variants_existing_variant_id_product_variants_i";
            columns: ["existing_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_product_variants_job_id_import_jobs_id_fk";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_product_variants_staging_product_id_staging_products_st";
            columns: ["staging_product_id"];
            isOneToOne: false;
            referencedRelation: "staging_products";
            referencedColumns: ["staging_id"];
          },
        ];
      };
      staging_products: {
        Row: {
          action: string;
          brand_id: string;
          category_id: string | null;
          created_at: string;
          description: string | null;
          existing_product_id: string | null;
          id: string;
          image_path: string | null;
          job_id: string;
          manufacturer_id: string | null;
          name: string;
          product_handle: string | null;
          product_upid: string | null;
          row_number: number;
          season_id: string | null;
          staging_id: string;
          status: string | null;
        };
        Insert: {
          action: string;
          brand_id: string;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          existing_product_id?: string | null;
          id: string;
          image_path?: string | null;
          job_id: string;
          manufacturer_id?: string | null;
          name: string;
          product_handle?: string | null;
          product_upid?: string | null;
          row_number: number;
          season_id?: string | null;
          staging_id?: string;
          status?: string | null;
        };
        Update: {
          action?: string;
          brand_id?: string;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          existing_product_id?: string | null;
          id?: string;
          image_path?: string | null;
          job_id?: string;
          manufacturer_id?: string | null;
          name?: string;
          product_handle?: string | null;
          product_upid?: string | null;
          row_number?: number;
          season_id?: string | null;
          staging_id?: string;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "staging_products_existing_product_id_products_id_fk";
            columns: ["existing_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staging_products_job_id_import_jobs_id_fk";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "import_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      taxonomy_attributes: {
        Row: {
          created_at: string;
          description: string | null;
          friendly_id: string;
          id: string;
          name: string;
          public_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          friendly_id: string;
          id?: string;
          name: string;
          public_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          friendly_id?: string;
          id?: string;
          name?: string;
          public_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      taxonomy_categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          parent_id: string | null;
          public_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          parent_id?: string | null;
          public_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          parent_id?: string | null;
          public_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "taxonomy_categories_parent_id_taxonomy_categories_id_fk";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "taxonomy_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      taxonomy_external_mappings: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          slug: string;
          source_system: string;
          source_taxonomy: string;
          target_taxonomy: string;
          updated_at: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          data: Json;
          id?: string;
          slug: string;
          source_system: string;
          source_taxonomy: string;
          target_taxonomy: string;
          updated_at?: string;
          version: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          id?: string;
          slug?: string;
          source_system?: string;
          source_taxonomy?: string;
          target_taxonomy?: string;
          updated_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      taxonomy_values: {
        Row: {
          attribute_id: string;
          created_at: string;
          friendly_id: string;
          id: string;
          metadata: Json | null;
          name: string;
          public_attribute_id: string;
          public_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          attribute_id: string;
          created_at?: string;
          friendly_id: string;
          id?: string;
          metadata?: Json | null;
          name: string;
          public_attribute_id: string;
          public_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          attribute_id?: string;
          created_at?: string;
          friendly_id?: string;
          id?: string;
          metadata?: Json | null;
          name?: string;
          public_attribute_id?: string;
          public_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "taxonomy_values_attribute_id_taxonomy_attributes_id_fk";
            columns: ["attribute_id"];
            isOneToOne: false;
            referencedRelation: "taxonomy_attributes";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          avatar_hue: number | null;
          avatar_path: string | null;
          brand_id: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_hue?: number | null;
          avatar_path?: string | null;
          brand_id?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_hue?: number | null;
          avatar_path?: string | null;
          brand_id?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      value_mappings: {
        Row: {
          brand_id: string;
          created_at: string;
          id: string;
          raw_value: string;
          source_column: string;
          target: string;
          target_id: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          id?: string;
          raw_value: string;
          source_column: string;
          target: string;
          target_id: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          id?: string;
          raw_value?: string;
          source_column?: string;
          target?: string;
          target_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "value_mappings_brand_id_brands_id_fk";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite_from_cookie: {
        Args: { p_token: string };
        Returns: undefined;
      };
      batch_insert_staging_with_status: {
        Args: { p_products: Json; p_status_updates: Json; p_variants: Json };
        Returns: Json;
      };
      claim_invites_for_user: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      get_brands_for_authenticated_user: {
        Args: never;
        Returns: {
          member_brand_id: string;
        }[];
      };
      get_product_brand_id: {
        Args: { product_id_param: string };
        Returns: string;
      };
      is_brand_member: { Args: { b_id: string }; Returns: boolean };
      is_brand_owner: { Args: { b_id: string }; Returns: boolean };
      shares_brand_with: { Args: { p_user_id: string }; Returns: boolean };
    };
    Enums: {
      user_role: "owner" | "member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      user_role: ["owner", "member"],
    },
  },
} as const;
