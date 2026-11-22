/**
 * ============================================================================
 * FOODBRIDGE — SMART NGO MATCHING ALGORITHM
 * ============================================================================
 *
 * This module implements a transparent, rule-based recommendation system that
 * matches surplus food donations with the most suitable NGOs.
 *
 * FORMULA:
 * Total Matching Score = (Distance Score × 0.40)
 *                      + (Food Compatibility Score × 0.35)
 *                      + (Pickup Availability Score × 0.25)
 *
 * Designed to be clean, explainable, and viva-ready for college examination.
 */

import { IDonation } from '../models/Donation';
import { IUser } from '../models/User';

export interface MatchScoreResult {
  ngoId: string;
  ngoName: string;
  donationId: string;
  foodName: string;
  totalScore: number; // 0 to 100
  distanceKm: number;
  breakdown: {
    distanceScore: number; // 0-100 (40% weight)
    foodCompatibilityScore: number; // 0-100 (35% weight)
    pickupAvailabilityScore: number; // 0-100 (25% weight)
  };
  explanation: string;
}

/**
 * Calculates distance in kilometers between two coordinates using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * 1. DISTANCE SCORE (Weight: 40%)
 * NGOs closer to the restaurant receive higher scores because fresh food must be
 * transported quickly and cost-effectively.
 */
export function calculateDistanceScore(distanceKm: number): number {
  if (distanceKm <= 2) return 100;
  if (distanceKm <= 5) return 85;
  if (distanceKm <= 10) return 70;
  if (distanceKm <= 15) return 50;
  if (distanceKm <= 25) return 30;
  return 10;
}

/**
 * 2. FOOD COMPATIBILITY SCORE (Weight: 35%)
 * Evaluates dietary preference alignment and quantity compatibility with the NGO's capacity.
 */
export function calculateFoodCompatibilityScore(
  donation: IDonation,
  ngo: IUser
): number {
  let dietaryScore = 50; // baseline

  const ngoPrefs = (ngo.foodPreferences || []).map((p) => p.toLowerCase());
  const donationDiet = donation.dietType.toLowerCase();

  // If NGO accepts both or has not specified preference
  if (ngoPrefs.includes('both') || ngoPrefs.length === 0) {
    dietaryScore = 95;
  } else if (ngoPrefs.includes(donationDiet)) {
    dietaryScore = 100; // Perfect dietary match
  } else if (donationDiet === 'vegetarian' && ngoPrefs.includes('non-vegetarian')) {
    // Non-veg NGOs can still consume vegetarian food
    dietaryScore = 80;
  } else {
    // Incompatible: NGO wants vegetarian only, but donation is non-vegetarian
    return 0; // Immediate disqualification
  }

  // Quantity capacity score
  let quantityScore = 80;
  const beneficiaries = ngo.beneficiaries || 50;
  const servings = donation.quantity;

  if (servings <= beneficiaries) {
    // NGO has enough people to consume all food without waste
    quantityScore = 100;
  } else if (servings <= beneficiaries * 1.5) {
    quantityScore = 85;
  } else {
    // Donation exceeds capacity; risk of secondary waste
    quantityScore = 60;
  }

  return Math.round(dietaryScore * 0.65 + quantityScore * 0.35);
}

/**
 * 3. PICKUP AVAILABILITY SCORE (Weight: 25%)
 * Checks whether the NGO can collect the food before the pickup deadline,
 * and if they have dedicated transport vehicles.
 */
export function calculatePickupAvailabilityScore(
  donation: IDonation,
  ngo: IUser
): number {
  const now = new Date();
  const deadline = new Date(donation.pickupDeadline);
  const remainingHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (remainingHours <= 0) {
    return 0; // Deadline has already passed
  }

  let timeScore = 50;
  if (remainingHours >= 4) {
    timeScore = 100; // Generous pickup window
  } else if (remainingHours >= 2) {
    timeScore = 85;
  } else if (remainingHours >= 1) {
    timeScore = 65;
  } else {
    timeScore = 30; // Urgent, tight window
  }

  // Transport readiness bonus
  const vehicleBonus = ngo.pickupVehicle === 'yes' ? 100 : 70;

  return Math.round(timeScore * 0.7 + vehicleBonus * 0.3);
}

/**
 * Calculates complete matching score for a single donation and single NGO.
 */
export function computeMatchScore(
  donation: IDonation,
  ngo: IUser
): MatchScoreResult | null {
  const donationLoc = donation.location || { lat: 19.076, lng: 72.8777 };
  const ngoLoc = ngo.location || { lat: 19.082, lng: 72.882 };

  const distanceKm = calculateDistanceKm(
    donationLoc.lat,
    donationLoc.lng,
    ngoLoc.lat,
    ngoLoc.lng
  );

  const distanceScore = calculateDistanceScore(distanceKm);
  const foodScore = calculateFoodCompatibilityScore(donation, ngo);
  const pickupScore = calculatePickupAvailabilityScore(donation, ngo);

  // If food is incompatible or deadline passed, exclude
  if (foodScore === 0 || pickupScore === 0) {
    return null;
  }

  // Standard weighted formula: 40% distance + 35% food compatibility + 25% pickup availability
  const totalScore = Math.round(
    distanceScore * 0.4 + foodScore * 0.35 + pickupScore * 0.25
  );

  // Human-readable explanation for demonstration and viva
  const dietText =
    donation.dietType === 'vegetarian' ? 'vegetarian meals' : 'nutritious meals';
  const transportText =
    ngo.pickupVehicle === 'yes'
      ? 'has active pickup transport'
      : 'can collect before deadline';

  const explanation = `Recommended with a ${totalScore}% match score: located ${distanceKm} km away, accepts ${dietText}, and ${transportText}.`;

  return {
    ngoId: ngo._id.toString(),
    ngoName: ngo.orgName,
    donationId: donation._id.toString(),
    foodName: donation.foodName,
    totalScore,
    distanceKm,
    breakdown: {
      distanceScore,
      foodCompatibilityScore: foodScore,
      pickupAvailabilityScore: pickupScore,
    },
    explanation,
  };
}

/**
 * Finds top matching NGOs for a specific donation.
 */
export function getTopMatchingNgos(
  donation: IDonation,
  ngos: IUser[],
  limit: number = 3
): MatchScoreResult[] {
  const results: MatchScoreResult[] = [];

  for (const ngo of ngos) {
    const match = computeMatchScore(donation, ngo);
    if (match) {
      results.push(match);
    }
  }

  return results.sort((a, b) => b.totalScore - a.totalScore).slice(0, limit);
}

/**
 * Finds top matching donations for a specific NGO.
 */
export function getTopMatchingDonations(
  ngo: IUser,
  donations: IDonation[],
  limit: number = 6
): Array<{ donation: IDonation; match: MatchScoreResult }> {
  const results: Array<{ donation: IDonation; match: MatchScoreResult }> = [];

  for (const donation of donations) {
    if (donation.status !== 'available') continue;
    const match = computeMatchScore(donation, ngo);
    if (match) {
      results.push({ donation, match });
    }
  }

  return results
    .sort((a, b) => b.match.totalScore - a.match.totalScore)
    .slice(0, limit);
}
