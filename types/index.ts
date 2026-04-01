export interface User {
    _id: string;
    name: string;
    email: string;
    role: "donor" | "ngo" | "admin";
    createdAt: string;
    isActive: boolean;
    phone?: string;
    isFirstLogin?: boolean;
    latitude?: number;
    longitude?: number;
    verificationStatus?: string; // For NGO user profiles
    ngo_verified?: boolean;
    status?: string;
}

export interface NGOProfile {
    _id: string;
    ngoName: string;
    city: string;
    verificationStatus: "pending" | "approved" | "rejected";
    userId: { _id?: any; name: string; email: string };
    address?: string;
    contactPhone?: string;
    registrationNumber?: string;
    isVerified?: boolean;
    latitude?: number;
    longitude?: number;
    createdAt?: string;
    certificateUrl?: string;
    idProofUrl?: string;
    ngo_verified?: boolean;
    status?: string | "pending" | "approved" | "rejected";
}

export interface Donation {
    _id: string;
    foodType: string;
    quantity: any; // Flexible to accommodate string from backend/form and number in UI
    status: "pending" | "pending_request" | "request_sent" | "accepted" | "on_the_way" | "arrived" | "collected" | "pickup_in_progress" | "delivered" | "completed" | "flagged" | "rejected";
    city: string;
    createdAt: string;
    prioritizationRank?: number;
    donorId: { _id?: any; name: string; email: string } | null;
    latitude?: number | null;
    longitude?: number | null;
    foodImage?: string;
    preparedTime?: string;
    expiryTime?: string;
    pickupAddress?: string;
    acceptedAt?: string;
    deliveredAt?: string;
}

export interface Delivery {
    _id: string;
    donationId: string | Donation;
    ngoId: string | User;
    status: "pending" | "accepted" | "on_the_way" | "arrived" | "collected" | "delivered" | "completed" | "rejected";
    pickupTime?: string;
    deliveryTime?: string;
    liveLatitude?: number;
    liveLongitude?: number;
    isLive?: boolean;
    distributionStatus?: "pending" | "assigned" | "on_the_way" | "delivered";
    hungerSpotId?: string | HungerSpot;
}

export interface HungerSpot {
    _id: string;
    name: string;
    lat: number;
    lng: number;
    peopleCount: number;
    category: "slum" | "shelter" | "orphanage" | "community_center" | "other";
    urgency: "low" | "medium" | "high";
    isActive: boolean;
    createdAt: string;
}

export interface HungerReport {
    _id: string;
    locationName: string;
    lat: number;
    lng: number;
    peopleCount: number;
    urgency: "low" | "medium" | "high";
    status: "pending" | "verified" | "resolved" | "fake";
    createdAt: string;
}

export interface AnalyticsSummary {
    totalDonations: number;
    mealsServed: number;
    activeMissions: number;
    carbonSaved: number;
    successRate: string;
    [key: string]: any;
}

export interface Activity {
    _id: string;
    type: "NEW_DONATION" | "MISSION_ACCEPTED" | "PICKUP_STARTED" | "ARRIVED_AT_PICKUP" | "FOOD_COLLECTED" | "DELIVERY_COMPLETED" | "HUNGER_REPORT";
    title: string;
    description: string;
    timestamp: string;
    id: string; // Original entity ID (donationId or reportId)
}

export interface AdminMetrics {
    totalDonations: number;
    activeNGOs: number;
    totalRecovered: number;
    totalReports: number;
    [key: string]: any;
}
