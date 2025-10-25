/*
  Predefined seasonal collections for fashion industry.
  Single source of truth for season options.
*/

export interface Season {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  startMonth?: number; // 1-12
  endMonth?: number; // 1-12
  isOngoing?: boolean;
}

export const seasons = {
  SPRING_SUMMER: {
    id: "spring-summer",
    name: "Spring/Summer",
    shortName: "SS",
    description: "Spring and Summer collection",
    startMonth: 3,
    endMonth: 8,
  },
  FALL_WINTER: {
    id: "fall-winter",
    name: "Fall/Winter",
    shortName: "FW",
    description: "Fall and Winter collection",
    startMonth: 9,
    endMonth: 2,
  },
  RESORT: {
    id: "resort",
    name: "Resort",
    shortName: "Resort",
    description: "Resort or Cruise collection",
    startMonth: 11,
    endMonth: 1,
  },
  PRE_FALL: {
    id: "pre-fall",
    name: "Pre-Fall",
    shortName: "Pre-Fall",
    description: "Pre-Fall transitional collection",
    startMonth: 7,
    endMonth: 8,
  },
  PRE_SPRING: {
    id: "pre-spring",
    name: "Pre-Spring",
    shortName: "Pre-Spring",
    description: "Pre-Spring transitional collection",
    startMonth: 1,
    endMonth: 2,
  },
  HOLIDAY: {
    id: "holiday",
    name: "Holiday",
    shortName: "Holiday",
    description: "Holiday special collection",
    startMonth: 11,
    endMonth: 12,
  },
  CAPSULE: {
    id: "capsule",
    name: "Capsule",
    shortName: "Capsule",
    description: "Limited capsule collection",
  },
  CORE: {
    id: "core",
    name: "Core",
    shortName: "Core",
    description: "Core or permanent collection",
    isOngoing: true,
  },
  ONGOING: {
    id: "ongoing",
    name: "Ongoing",
    shortName: "Ongoing",
    description: "Continuous or year-round collection",
    isOngoing: true,
  },
} satisfies Record<string, Season>;

export const allSeasons: Season[] = Object.values(seasons);

// Helper to get season by year
export function getSeasonWithYear(seasonId: string, year: number) {
  const baseSeason = seasons[seasonId as keyof typeof seasons];
  if (!baseSeason) {
    throw new Error(`Season with id "${seasonId}" not found`);
  }

  return {
    ...baseSeason,
    year,
  };
}

// Common season combinations with years
export function generateSeasonOptions(startYear: number, years = 3) {
  const mainSeasons = [seasons.SPRING_SUMMER, seasons.FALL_WINTER] as const;
  const options: Array<{ season: Season; year: number; displayName: string }> =
    [];

  for (let i = 0; i < years; i++) {
    const year = startYear + i;
    for (const season of mainSeasons) {
      if (season?.shortName) {
        options.push({
          season,
          year,
          displayName: `${season.shortName} ${year}`,
        });
      }
    }
  }

  return options;
}

export type SeasonId = keyof typeof seasons;
