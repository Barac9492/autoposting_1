import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        const { posts, dateRange } = await req.json();

        if (!posts || posts.length === 0) {
            return NextResponse.json({ error: "No posts provided" }, { status: 400 });
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            console.error("ANTHROPIC_API_KEY environment variable is missing.");
            return NextResponse.json(
                { reportText: "System Error: Missing API Key" },
                { status: 500 }
            );
        }

        const themeGroups = {};
        posts.forEach((p) => {
            const t = p.theme || "Other";
            if (!themeGroups[t]) themeGroups[t] = [];
            themeGroups[t].push(p);
        });

        const contentSummary = Object.entries(themeGroups)
            .map(
                ([theme, items]) =>
                    `\n## ${theme} (${items.length} posts)\n${items
                        .map(
                            (i) =>
                                `- [${i.source}] ${i.title}: ${i.keyInsight || i.content?.substring(0, 200)}`
                        )
                        .join("\n")}`
            )
            .join("\n");

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1500,
                system: `You are an LP report writer for TheVentures, a Seoul-based VC firm. Write in a professional but distinctive voice. The CIO is Ethan Cho, who has 20+ years experience across Google Korea, Qualcomm Ventures, Samsung, and KB Investment. Key frameworks: "Founder Intelligence" (Korean Diaspora founders with dual cultural context), "MAU Trap" (metrics vs real value). Generate the report in English. Be concise and data-driven.`,
                messages: [
                    {
                        role: "user",
                        content: `Based on this collection of published insights from ${dateRange}, generate an LP quarterly brief draft.

Content collected:
${contentSummary}

Format:
1. EXECUTIVE SUMMARY (3-4 sentences)
2. KEY THEMES THIS QUARTER (top 3 themes with brief analysis)
3. ETHAN'S CONTRARIAN TAKES (2-3 non-consensus views expressed)
4. IMPLICATIONS FOR LPs (what this means for investors)
5. WHAT TO WATCH NEXT QUARTER

Keep it sharp. No fluff. Each section should be 2-4 sentences max.`,
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Anthropic API Error:", errorText);
            throw new Error("Failed Anthropic request");
        }

        const data = await response.json();
        const text = data.content
            ?.map((c) => c.text || "")
            .filter(Boolean)
            .join("\n");

        return NextResponse.json({ reportText: text });
    } catch (error) {
        console.error("Report generation error:", error);
        return NextResponse.json(
            { reportText: "Failed to generate report" },
            { status: 500 }
        );
    }
}
