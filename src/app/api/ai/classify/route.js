import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        const { title, content } = await req.json();

        if (!title && !content) {
            return NextResponse.json({ error: "Missing title or content" }, { status: 400 });
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            console.error("ANTHROPIC_API_KEY environment variable is missing.");
            return NextResponse.json(
                { theme: "Other", keyInsight: "API Key missing", tags: [] },
                { status: 500 }
            );
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1000,
                messages: [
                    {
                        role: "user",
                        content: `Classify this content and extract the key insight.

Title: ${title}
Content: ${content?.substring(0, 1000)}

Respond ONLY in this exact JSON format, no other text:
{"theme": "one of: AI Infrastructure, Korean Diaspora, Korean VC Ecosystem, Demographics & Aging, Consumer Tech, Founder Intelligence, Regulatory & Policy, Global Macro, Other", "keyInsight": "one sentence capturing the core contrarian or unique insight", "tags": ["tag1", "tag2"]}`,
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
        const text = data.content?.[0]?.text || "";

        // Clean potential markdown blocks
        const clean = text.replace(/```json|```/g, "").trim();
        const result = JSON.parse(clean);

        return NextResponse.json(result);
    } catch (error) {
        console.error("Classification error:", error);
        return NextResponse.json(
            { theme: "Other", keyInsight: "Error classifying content", tags: [] },
            { status: 500 }
        );
    }
}
