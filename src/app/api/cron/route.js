import { NextResponse } from "next/server";
import { fetchSubstackPosts } from "../../../../src/services/rssFetcher";

// IMPORTANT: This route MUST be protected on Vercel so public users cannot trigger it.
// Vercel adds an Authorization header with a secret to Cron requests.
// Ensure VERCEL_CRON_SECRET is set in Vercel Environment Variables.
export async function GET(req) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.VERCEL_CRON_SECRET;

        // Verify the request is actually from Vercel Cron
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            // In development, or if no secret is set, we can allow it for testing if we are careful,
            // but in production, we block unauthorized requests.
            if (process.env.NODE_ENV === "production") {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            } else {
                console.warn("CRON auth missing or invalid, but proceeding since not in production.");
            }
        }

        console.log("Starting cron job: Fetching RSS feed...");
        const posts = await fetchSubstackPosts();

        if (posts.length === 0) {
            return NextResponse.json({ success: true, message: "No posts found in feed." });
        }

        // Sort to process oldest first
        const sortedPosts = posts.sort(
            (a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime()
        );

        // TODO: In a real database scenario, you would query your DB for the latest post date here.
        // Since we are using localStorage on the client, the server-side Cron CANNOT natively
        // update the user's browser storage. 
        // 
        // If you add a database (e.g. Vercel Postgres/KV) in the future:
        // 1. Fetch `lastProcessedTime` from DB.
        // 2. Filter `sortedPosts` for posts newer than `lastProcessedTime`.
        // 3. For each new post, calculate classification via AI.
        // 4. Save the finished post back to the DB.

        // For now, we simulate success.
        console.log(`Cron completed: successfully fetched ${sortedPosts.length} posts.`);

        return NextResponse.json({
            success: true,
            message: "Cron executed successfully.",
            foundPosts: sortedPosts.length,
            note: "Server-side cron requires a database to persist automated actions across users.",
        });
    } catch (error) {
        console.error("Cron failed:", error);
        return NextResponse.json({ error: "Cron execution failed." }, { status: 500 });
    }
}
