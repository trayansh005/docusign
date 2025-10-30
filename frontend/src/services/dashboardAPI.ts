import apiClient from "@/lib/apiClient";

export interface DashboardStats {
    totalDocuments: number;
    pendingSignatures: number;
    completedSignatures: number;
    subscriptionStatus: string;
    owner?: {
        total: number;
        pending: number;
        completed: number;
    };
    assigned?: {
        total: number;
        pending: number;
        completed: number;
    };
    usage?: {
        hasActiveSubscription: boolean;
        uploads?: { used: number; limit: number };
        signs?: { used: number; limit: number };
    };
}

export interface InboxItem {
    id: string;
    name: string;
    status: string;
    createdAt?: string;
    updatedAt?: string;
    finalPdfUrl?: string;
    sender?: string;
    message?: {
        subject?: string;
        body?: string;
    };
    myRecipientInfo?: {
        signatureStatus?: string;
        signedAt?: string;
    };
}

export interface PendingDocumentsCount {
    pendingCount: number;
}

/**
 * Get user dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
    const response = await apiClient.get<{ data: DashboardStats }>("/dashboard/stats");
    return response.data;
}

/**
 * Get inbox items (documents assigned to user)
 */
export async function getInbox(page: number = 1, limit: number = 10): Promise<{
    data: InboxItem[];
    pagination: {
        current: number;
        total: number;
        pages: number;
        limit: number;
    };
}> {
    const response = await apiClient.get<{
        data: InboxItem[];
        pagination: {
            current: number;
            total: number;
            pages: number;
            limit: number;
        };
    }>(`/dashboard/inbox?page=${page}&limit=${limit}`);
    return response;
}

/**
 * Get count of pending documents for the user
 */
export async function getPendingDocumentsCount(): Promise<PendingDocumentsCount> {
    const response = await apiClient.get<{ data: PendingDocumentsCount }>("/dashboard/pending-count");
    return response.data;
}
