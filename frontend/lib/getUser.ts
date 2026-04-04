import { getServerSession } from "./auth";

/**
 * Get the current user session on the server
 * @returns The user object or null if not authenticated
 */
export async function getUser() {
	const session = await getServerSession();
  if (!session) return null;
  
  // Return in a format compatible with existing User type if possible
  return {
    ...session,
    id: session.id,
    _id: session.id // for compatibility
  } as any;
}
