/**
 * Mock Storage Utility for Bulk Import Tests
 *
 * Provides a mock implementation of Supabase storage operations.
 * Used to test file download/upload without hitting actual storage.
 *
 * @module @v1/testing/bulk-import/mock-storage
 */

// ============================================================================
// Types
// ============================================================================

export interface MockStorageOptions {
  /** Pre-populate storage with files. Map of path -> content */
  files?: Map<string, Uint8Array>;
  /** Paths that should fail on download */
  failOnPaths?: string[];
  /** Simulate network latency in ms */
  latencyMs?: number;
}

export interface MockedDownloadResult {
  data: Blob | null;
  error: Error | null;
}

// ============================================================================
// Mock Storage State
// ============================================================================

/** In-memory file storage */
const fileStorage = new Map<string, Uint8Array>();

/** Paths configured to fail */
const failPaths = new Set<string>();

/** Download count per path (for assertions) */
const downloadCounts = new Map<string, number>();

/** Upload count per path (for assertions) */
const uploadCounts = new Map<string, number>();

/** Simulated latency */
let simulatedLatencyMs = 0;

// ============================================================================
// Mock Storage Class
// ============================================================================

/**
 * Mock storage utility for testing bulk import file operations.
 *
 * @example
 * ```typescript
 * // Setup mock storage with a test file
 * const excelBuffer = await ExcelBuilder.create({ products: [testProduct] });
 * MockStorage.addFile("imports/test-file.xlsx", excelBuffer);
 *
 * // Run your test that downloads files...
 *
 * // Verify download was called
 * expect(MockStorage.getDownloadCount("imports/test-file.xlsx")).toBe(1);
 *
 * // Cleanup
 * MockStorage.clear();
 * ```
 */
export class MockStorage {
  /**
   * Initialize mock storage with optional configuration
   */
  static setup(options?: MockStorageOptions): void {
    // Clear existing state
    MockStorage.clear();

    // Set up initial files
    if (options?.files) {
      for (const [path, content] of options.files) {
        fileStorage.set(path, content);
      }
    }

    // Set up fail paths
    if (options?.failOnPaths) {
      for (const path of options.failOnPaths) {
        failPaths.add(path);
      }
    }

    // Set latency
    simulatedLatencyMs = options?.latencyMs ?? 0;
  }

  /**
   * Add a file to mock storage
   */
  static addFile(path: string, content: Uint8Array): void {
    fileStorage.set(path, content);
  }

  /**
   * Get a file from mock storage
   */
  static getFile(path: string): Uint8Array | undefined {
    return fileStorage.get(path);
  }

  /**
   * Check if a file exists in mock storage
   */
  static hasFile(path: string): boolean {
    return fileStorage.has(path);
  }

  /**
   * Remove a file from mock storage
   */
  static removeFile(path: string): boolean {
    return fileStorage.delete(path);
  }

  /**
   * Configure a path to fail on download
   */
  static setPathToFail(path: string): void {
    failPaths.add(path);
  }

  /**
   * Mock download function that simulates Supabase storage download
   */
  static async download(path: string): Promise<MockedDownloadResult> {
    // Simulate latency
    if (simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs));
    }

    // Track download attempt
    downloadCounts.set(path, (downloadCounts.get(path) ?? 0) + 1);

    // Check if path should fail
    if (failPaths.has(path)) {
      return {
        data: null,
        error: new Error(`Storage error: File not found at path "${path}"`),
      };
    }

    // Get file content
    const content = fileStorage.get(path);
    if (!content) {
      return {
        data: null,
        error: new Error(`Storage error: File not found at path "${path}"`),
      };
    }

    // Return as Blob (simulating Supabase storage response)
    // Create a copy of the buffer to avoid ArrayBuffer compatibility issues
    const buffer = new ArrayBuffer(content.length);
    const view = new Uint8Array(buffer);
    view.set(content);
    return {
      data: new Blob([buffer]),
      error: null,
    };
  }

  /**
   * Mock upload function that simulates Supabase storage upload
   */
  static async upload(
    path: string,
    content: Uint8Array | Blob,
  ): Promise<{ data: { path: string } | null; error: Error | null }> {
    // Simulate latency
    if (simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs));
    }

    // Track upload attempt
    uploadCounts.set(path, (uploadCounts.get(path) ?? 0) + 1);

    // Check if path should fail
    if (failPaths.has(path)) {
      return {
        data: null,
        error: new Error(`Storage error: Upload failed for path "${path}"`),
      };
    }

    // Store the content
    if (content instanceof Blob) {
      const buffer = await content.arrayBuffer();
      fileStorage.set(path, new Uint8Array(buffer));
    } else {
      fileStorage.set(path, content);
    }

    return {
      data: { path },
      error: null,
    };
  }

  /**
   * Get the number of times a file was downloaded
   */
  static getDownloadCount(path: string): number {
    return downloadCounts.get(path) ?? 0;
  }

  /**
   * Get the number of times a file was uploaded
   */
  static getUploadCount(path: string): number {
    return uploadCounts.get(path) ?? 0;
  }

  /**
   * Get all downloaded paths
   */
  static getDownloadedPaths(): string[] {
    return Array.from(downloadCounts.keys());
  }

  /**
   * Get all uploaded paths
   */
  static getUploadedPaths(): string[] {
    return Array.from(uploadCounts.keys());
  }

  /**
   * Clear all mock storage state
   */
  static clear(): void {
    fileStorage.clear();
    failPaths.clear();
    downloadCounts.clear();
    uploadCounts.clear();
    simulatedLatencyMs = 0;
  }

  /**
   * Get the total number of files in storage
   */
  static getFileCount(): number {
    return fileStorage.size;
  }

  /**
   * List all file paths in storage
   */
  static listFiles(): string[] {
    return Array.from(fileStorage.keys());
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a mock Supabase storage client for testing.
 * This replaces the actual Supabase client in tests.
 *
 * @example
 * ```typescript
 * const mockClient = createMockStorageClient();
 * // Use mockClient.storage.from("bucket").download(path) in tests
 * ```
 */
export function createMockStorageClient() {
  return {
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) => {
          const fullPath = `${bucket}/${path}`;
          return MockStorage.download(fullPath);
        },
        upload: async (path: string, content: Uint8Array | Blob) => {
          const fullPath = `${bucket}/${path}`;
          return MockStorage.upload(fullPath, content);
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://mock-storage.test/${bucket}/${path}` },
        }),
        createSignedUrl: async (path: string, expiresIn: number) => ({
          data: {
            signedUrl: `https://mock-storage.test/${bucket}/${path}?token=mock&expires=${expiresIn}`,
          },
          error: null,
        }),
      }),
    },
  };
}
