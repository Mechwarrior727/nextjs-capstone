// lib/privy.ts
import { PrivyClient } from "@privy-io/server-auth";
import { cookies } from "next/headers";

export async function requirePrivyUser() {
  // Verify the Privy auth cookie / JWT via PRIVY_APP_SECRET
  const cookieStore = cookies();
  const idToken = (await cookieStore).get("privy-id-token")?.value;
  
  if (!idToken) {
    throw new Error("Unauthorized: No session token found");
  }
  
  // Get environment variables
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  
  if (!appId || !appSecret) {
    throw new Error("Missing Privy app credentials in environment variables");
  }
  
  try {
    // Create Privy client with app ID and secret
    const client = new PrivyClient(appId, appSecret);
    
    // Verify and get user from the identity token
    const privyUser = await client.getUser({ idToken });
    
    if (!privyUser) {
      throw new Error("Unauthorized: Invalid session token");
    }
    
    return privyUser; // includes id, wallets, oauth info
  } catch (error) {
    console.error("Error verifying Privy session:", error);
    throw new Error("Unauthorized: Session verification failed");
  }
}
