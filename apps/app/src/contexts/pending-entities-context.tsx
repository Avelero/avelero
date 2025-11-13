"use client";

import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";

/**
 * Pending entity creation data
 * Stores all the information needed to create an entity later
 */
export interface PendingEntity {
  /** Unique key for this pending entity (entityType:rawValue) */
  key: string;
  /** Type of entity to create */
  entityType: string;
  /** Raw value from CSV */
  rawValue: string;
  /** Source column from CSV */
  sourceColumn: string;
  /** Entity-specific data to create with */
  entityData: Record<string, unknown>;
  /** Job ID this entity belongs to */
  jobId: string;
}

interface PendingEntitiesContextValue {
  /** Map of pending entities by key (entityType:rawValue) */
  pendingEntities: Map<string, PendingEntity>;
  /** Add or update a pending entity */
  setPendingEntity: (entity: PendingEntity) => void;
  /** Remove a pending entity */
  removePendingEntity: (key: string) => void;
  /** Clear all pending entities */
  clearPendingEntities: () => void;
  /** Get a pending entity by key */
  getPendingEntity: (key: string) => PendingEntity | undefined;
  /** Check if an entity is pending */
  hasPendingEntity: (key: string) => boolean;
  /** Get all pending entities as array */
  getAllPendingEntities: () => PendingEntity[];
  /** Get count of pending entities */
  getPendingCount: () => number;
}

const PendingEntitiesContext = createContext<
  PendingEntitiesContextValue | undefined
>(undefined);

interface PendingEntitiesProviderProps {
  children: React.ReactNode;
}

/**
 * Provider for pending entity creations
 *
 * Manages local state for entities that should be created
 * when the user clicks "Approve & Import"
 */
export function PendingEntitiesProvider({
  children,
}: PendingEntitiesProviderProps) {
  const [pendingEntities, setPendingEntitiesState] = useState<
    Map<string, PendingEntity>
  >(new Map());

  const setPendingEntity = useCallback((entity: PendingEntity) => {
    setPendingEntitiesState((prev) => {
      const next = new Map(prev);
      next.set(entity.key, entity);
      return next;
    });
  }, []);

  const removePendingEntity = useCallback((key: string) => {
    setPendingEntitiesState((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearPendingEntities = useCallback(() => {
    setPendingEntitiesState(new Map());
  }, []);

  const getPendingEntity = useCallback(
    (key: string) => {
      return pendingEntities.get(key);
    },
    [pendingEntities],
  );

  const hasPendingEntity = useCallback(
    (key: string) => {
      return pendingEntities.has(key);
    },
    [pendingEntities],
  );

  const getAllPendingEntities = useCallback(() => {
    return Array.from(pendingEntities.values());
  }, [pendingEntities]);

  const getPendingCount = useCallback(() => {
    return pendingEntities.size;
  }, [pendingEntities]);

  const value: PendingEntitiesContextValue = {
    pendingEntities,
    setPendingEntity,
    removePendingEntity,
    clearPendingEntities,
    getPendingEntity,
    hasPendingEntity,
    getAllPendingEntities,
    getPendingCount,
  };

  return (
    <PendingEntitiesContext.Provider value={value}>
      {children}
    </PendingEntitiesContext.Provider>
  );
}

/**
 * Hook to access pending entities context
 */
export function usePendingEntities(): PendingEntitiesContextValue {
  const context = useContext(PendingEntitiesContext);

  if (context === undefined) {
    throw new Error(
      "usePendingEntities must be used within PendingEntitiesProvider",
    );
  }

  return context;
}

/**
 * Helper to generate a unique key for a pending entity
 */
export function generatePendingEntityKey(
  entityType: string,
  rawValue: string,
): string {
  return `${entityType}:${rawValue}`;
}
