import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PricingEntry } from "@shared/schema";

/**
 * Shared pricing hook that fetches dynamic pricing from the API
 * and provides helpers to get costs for specific models.
 * 
 * Uses TanStack Query caching for efficiency - subsequent pages reuse data.
 * Memoizes pricing map to avoid O(n) rebuilds on every render.
 */
export function usePricing() {
  const pricingQuery = useQuery<PricingEntry[]>({
    queryKey: ["/api/pricing"],
    staleTime: 60 * 1000, // 60 seconds - pricing rarely changes
    gcTime: 5 * 60 * 1000, // 5 minutes cache retention
    refetchOnWindowFocus: true, // Detect admin changes when user returns to tab
  });

  const { data: pricingData = [], isLoading, error, dataUpdatedAt } = pricingQuery;

  // Memoize pricing map for O(1) lookups - only rebuild when data changes
  const pricingMap = useMemo(() => {
    const map = new Map<string, PricingEntry>();
    pricingData.forEach((entry) => {
      map.set(entry.model, entry);
    });
    return map;
  }, [pricingData]);

  /**
   * Get cost for a specific model with fallback.
   * During loading, returns defaultCost to avoid flicker.
   * @param modelName - The model identifier
   * @param defaultCost - Fallback cost if not found in database or during loading
   * @returns Credit cost for the model
   */
  const getModelCost = useCallback(
    (modelName: string, defaultCost: number = 100): number => {
      // During loading, use fallback to prevent flicker
      if (isLoading) return defaultCost;
      
      const pricing = pricingMap.get(modelName);
      return pricing?.creditCost ?? defaultCost;
    },
    [pricingMap, isLoading, dataUpdatedAt]
  );

  /**
   * Get all pricing entries for a specific feature category.
   * Returns empty array during loading.
   * @param feature - Feature name (e.g., 'video', 'image', 'music')
   * @returns Array of pricing entries for that feature
   */
  const getPricingByFeature = useCallback(
    (feature: string): PricingEntry[] => {
      if (isLoading) return [];
      return pricingData.filter((p) => p.feature === feature);
    },
    [pricingData, dataUpdatedAt]
  );

  /**
   * Get all pricing entries for a specific category.
   * Returns empty array during loading.
   * @param category - Category name (e.g., 'generation', 'chat', 'voice')
   * @returns Array of pricing entries for that category
   */
  const getPricingByCategory = useCallback(
    (category: string): PricingEntry[] => {
      if (isLoading) return [];
      return pricingData.filter((p) => p.category === category);
    },
    [pricingData, dataUpdatedAt]
  );

  return {
    pricingData,
    pricingMap,
    isLoading,
    error,
    dataUpdatedAt,
    getModelCost,
    getPricingByFeature,
    getPricingByCategory,
    pricingQuery,
  };
}
