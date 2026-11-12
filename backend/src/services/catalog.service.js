
import { env } from "../config/env.js";

/**
 * Relations required by the public movie catalogue,
 * continue-watching and favorites routes.
 *
 * Private video assets and content licences are deliberately
 * excluded from the public movie response.
 */
export const movieInclude = {
  genres: {
    include: {
      genre: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  },

  media: {
    where: {
      mediaType: {
        in: ["poster", "backdrop","trailer"]
      }
    },
    select: {
      mediaType: true,
      fileUrl: true
    }
  },

  credits: {
    orderBy: {
      displayOrder: "asc"
    },
    include: {
      person: {
        select: {
          id: true,
          fullName: true,
          biography: true,
          profileImage: true
        }
      }
    }
  },

  tracks: {
    orderBy: [
      { isDefault: "desc" },
      { language: "asc" }
    ],
    select: {
      trackType: true,
      language: true,
      label: true,
      isDefault: true
    }
  }
};

/**
 * Public catalogue:
 * - Published movies only.
 * - Verified distribution licences only.
 * - Must cover the visitor's territory.
 * - Must be within the licence validity period.
 */
export function publicCatalogueWhere(req, extra = {}) {
  const now = new Date();

  const headerCountry = env.TRUST_CF_IP_COUNTRY
    ? String(req.get("cf-ipcountry") || "").toUpperCase()
    : "";

  const countryCode =
    /^[A-Z]{2}$/.test(headerCountry) && headerCountry !== "XX"
      ? headerCountry
      : "";

  return {
    ...extra,

    publicationStatus: "PUBLISHED",

    licenses: {
      some: {
        status: "VERIFIED",
        permittedDistribution: true,

        territory: countryCode
          ? { in: ["WORLDWIDE", countryCode] }
          : "WORLDWIDE",

        validFrom: {
          lte: now
        },

        OR: [
          { validUntil: null },
          { validUntil: { gte: now } }
        ]
      }
    }
  };
}

/**
 * Account routes use the same territory restrictions
 * as the public catalogue.
 */
export function publicMovieWhere(req, extra = {}) {
  return publicCatalogueWhere(req, extra);
}

/**
 * Convert a Prisma movie record into a safe public response.
 */
export function serializeMovie(movie) {
  if (!movie) return null;

  const media = movie.media || [];
  const credits = movie.credits || [];
  const genres = movie.genres || [];
  const tracks = movie.tracks || [];

  const poster = media.find(
    (item) => item.mediaType === "poster"
  );

  const backdrop = media.find(
    (item) => item.mediaType === "backdrop"
  );
  const trailer = media.find(
  (item) => item.mediaType === "trailer"
);

  return {
    id: movie.id,
    title: movie.title,
    slug: movie.slug,
    description: movie.description,
    releaseDate: movie.releaseDate,
    durationSeconds: movie.durationSeconds,
    ageRating: movie.ageRating,
    originalLanguage: movie.originalLanguage,
    featured: movie.featured,

    posterUrl: poster?.fileUrl || null,
    backdropUrl: backdrop?.fileUrl || null,
    trailerUrl: trailer?.fileUrl || null,

    genres: genres.map((item) => ({
      id: item.genre.id,
      name: item.genre.name,
      slug: item.genre.slug
    })),

    credits: credits.map((item) => ({
      id: item.id,
      roleType: item.roleType,
      characterName: item.characterName,
      displayOrder: item.displayOrder,
      person: item.person
    })),

    cast: credits
      .filter((item) =>
        String(item.roleType || "").toLowerCase() === "cast"
      )
      .map((item) => ({
        ...item.person,
        characterName: item.characterName
      })),

    crew: credits
      .filter((item) =>
        String(item.roleType || "").toLowerCase() !== "cast"
      )
      .map((item) => ({
        ...item.person,
        roleType: item.roleType
      })),

    tracks: tracks.map((track) => ({
      trackType: track.trackType,
      language: track.language,
      label: track.label,
      isDefault: track.isDefault
    })),

    createdAt: movie.createdAt,
    updatedAt: movie.updatedAt
  };
}
