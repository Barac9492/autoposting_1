import { NextResponse } from "next/server";
import { fetchSubstackPosts } from "../../../../src/services/rssFetcher";

// Simple in-memory cache for API route
// Note: In serverless (Vercel), this cache is only maintained while the lambda is warm.
let cachedPosts = [];
let lastFetchTime = null;

export async function GET() {
    try {
        const now = new Date();
        // Cache for 5 minutes
        if (!lastFetchTime || (now - lastFetchTime) > 5 * 60 * 1000) {
            console.log('Fetching fresh RSS data...');
            cachedPosts = await fetchSubstackPosts();
            lastFetchTime = now;
        } else {
            console.log('Serving RSS data from cache.');
        }

        return NextResponse.json({ success: true, posts: cachedPosts });
    } catch (error) {
        console.error('Error serving RSS request:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch RSS data.' },
            { status: 500 }
        );
    }
}
