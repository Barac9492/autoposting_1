"use client";

import { useState, useEffect, useCallback } from "react";

const THEMES = [
    "AI Infrastructure",
    "Korean Diaspora",
    "Korean VC Ecosystem",
    "Demographics & Aging",
    "Consumer Tech",
    "Founder Intelligence",
    "Regulatory & Policy",
    "Global Macro",
    "Other",
];

const SOURCES = ["Substack", "LinkedIn", "Other"];

// Storage keys
const POSTS_KEY = "contrarian-brief-posts";
const REPORT_KEY = "contrarian-brief-report";

export default function ContrarianBrief() {
    const [posts, setPosts] = useState([]);
    const [view, setView] = useState("dashboard"); // dashboard, add, library, report
    const [loading, setLoading] = useState(true);
    const [reportDraft, setReportDraft] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [editingPost, setEditingPost] = useState(null);

    // Load from local storage
    useEffect(() => {
        try {
            const savedPosts = localStorage.getItem(POSTS_KEY);
            if (savedPosts) {
                setPosts(JSON.parse(savedPosts));
            }
            const savedReport = localStorage.getItem(REPORT_KEY);
            if (savedReport) {
                setReportDraft(JSON.parse(savedReport));
            }
        } catch (e) {
            console.error("Failed to load from storage", e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Save posts
    const savePosts = useCallback((newPosts) => {
        setPosts(newPosts);
        try {
            localStorage.setItem(POSTS_KEY, JSON.stringify(newPosts));
        } catch (e) {
            console.error("Save failed:", e);
        }
    }, []);

    const addPost = async (post) => {
        const newPost = {
            ...post,
            id: Date.now().toString(),
            addedAt: new Date().toISOString(),
        };
        const updated = [newPost, ...posts];
        savePosts(updated);
        setView("library");
    };

    const deletePost = (id) => {
        const updated = posts.filter((p) => p.id !== id);
        savePosts(updated);
    };

    const updatePost = (id, updates) => {
        const updated = posts.map((p) => (p.id === id ? { ...p, ...updates } : p));
        savePosts(updated);
        setEditingPost(null);
    };

    const generateReport = async () => {
        if (posts.length === 0) return;
        setGenerating(true);

        const dateRange = getDateRange(posts);

        try {
            // NOTE: Now we call our secure Next.js API Route instead of Anthropic directly!
            const response = await fetch("/api/ai/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ posts, dateRange }),
            });

            if (!response.ok) throw new Error("API Route Failed");
            const data = await response.json();

            const draft = {
                content: data.reportText,
                generatedAt: new Date().toISOString(),
                postCount: posts.length,
                dateRange,
            };
            setReportDraft(draft);
            localStorage.setItem(REPORT_KEY, JSON.stringify(draft));
            setView("report");
        } catch (e) {
            console.error("Generation failed:", e);
            alert("Report generation failed.");
        } finally {
            setGenerating(false);
        }
    };

    const classifyPost = async (title, content) => {
        try {
            // NOTE: Calling our secure backend API route
            const response = await fetch("/api/ai/classify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content }),
            });
            if (!response.ok) throw new Error("API Route Failed");
            const result = await response.json();
            return result;
        } catch (e) {
            console.error("Classification failed", e);
            return { theme: "Other", keyInsight: "", tags: [] };
        }
    };

    function getDateRange(items) {
        if (items.length === 0) return "N/A";
        const dates = items
            .map((p) => p.publishedDate || p.addedAt)
            .filter(Boolean)
            .sort();
        if (dates.length === 0) return "N/A";
        const fmt = (d) =>
            new Date(d).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
            });
        return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
    }

    function getThemeStats() {
        const stats = {};
        posts.forEach((p) => {
            const t = p.theme || "Other";
            stats[t] = (stats[t] || 0) + 1;
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]);
    }

    if (loading) {
        return (
            <div style={styles.loadingScreen}>
                <div style={styles.loadingText}>Loading...</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <Header view={view} setView={setView} postCount={posts.length} />

            {view === "dashboard" && (
                <Dashboard
                    posts={posts}
                    themeStats={getThemeStats()}
                    dateRange={getDateRange(posts)}
                    onGenerate={generateReport}
                    generating={generating}
                    setView={setView}
                    reportDraft={reportDraft}
                    onAdd={addPost}
                    onClassify={classifyPost}
                />
            )}

            {view === "add" && (
                <AddPost
                    onAdd={addPost}
                    onClassify={classifyPost}
                    setView={setView}
                />
            )}

            {view === "library" && (
                <Library
                    posts={posts}
                    onDelete={deletePost}
                    onUpdate={updatePost}
                    editingPost={editingPost}
                    setEditingPost={setEditingPost}
                />
            )}

            {view === "report" && (
                <Report
                    draft={reportDraft}
                    onRegenerate={generateReport}
                    generating={generating}
                />
            )}
        </div>
    );
}

function Header({ view, setView, postCount }) {
    return (
        <div style={styles.header}>
            <div style={styles.headerLeft}>
                <div style={styles.logo}>CB</div>
                <div>
                    <div style={styles.headerTitle}>Contrarian Brief</div>
                    <div style={styles.headerSub}>
                        {postCount} posts accumulated
                    </div>
                </div>
            </div>
            <nav style={styles.nav}>
                {[
                    ["dashboard", "Dashboard"],
                    ["add", "+ Add"],
                    ["library", "Library"],
                    ["report", "Report"],
                ].map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setView(key)}
                        style={{
                            ...styles.navBtn,
                            ...(view === key ? styles.navBtnActive : {}),
                        }}
                    >
                        {label}
                    </button>
                ))}
            </nav>
        </div>
    );
}

function Dashboard({
    posts,
    themeStats,
    dateRange,
    onGenerate,
    generating,
    setView,
    reportDraft,
    onAdd,
    onClassify,
}) {
    const [fetchingRss, setFetchingRss] = useState(false);
    const recentPosts = posts.slice(0, 5);

    const fetchRssPosts = async () => {
        setFetchingRss(true);
        try {
            // NOTE: Now points to the Next.js API Route!
            const res = await fetch('/api/rss');
            const data = await res.json();

            if (data.success && data.posts) {
                let addedCount = 0;
                // Process new posts that aren't already in the library
                for (const post of data.posts) {
                    // Check if post already exists by URL or title
                    const exists = posts.some(p => p.url === post.link || p.title === post.title);

                    if (!exists) {
                        // Auto-classify the new post
                        const classification = await onClassify(post.title, post.content);
                        await onAdd({
                            source: "Substack",
                            title: post.title,
                            content: post.content,
                            url: post.link,
                            publishedDate: post.pubDate,
                            theme: classification.theme || "Other",
                            keyInsight: classification.keyInsight || "",
                        });
                        addedCount++;
                    }
                }
                alert(addedCount > 0 ? `Successfully imported ${addedCount} new posts!` : 'No new posts found.');
                if (addedCount > 0) setView("library");
            }
        } catch (e) {
            console.error('Failed to fetch RSS', e);
            alert('Failed to connect to RSS server.');
        } finally {
            setFetchingRss(false);
        }
    };


    return (
        <div style={styles.main}>
            <div style={styles.statsRow}>
                <StatCard label="Total Posts" value={posts.length} />
                <StatCard label="Themes Covered" value={themeStats.length} />
                <StatCard label="Date Range" value={dateRange} small />
                <StatCard
                    label="Last Report"
                    value={
                        reportDraft
                            ? new Date(reportDraft.generatedAt).toLocaleDateString()
                            : "None"
                    }
                    small
                />
            </div>

            <div style={styles.twoCol}>
                <div style={styles.col}>
                    <div style={styles.sectionTitle}>Theme Distribution</div>
                    <div style={styles.card}>
                        {themeStats.length === 0 ? (
                            <div style={styles.emptyText}>
                                No posts yet. Add your first content.
                            </div>
                        ) : (
                            themeStats.map(([theme, count]) => (
                                <div key={theme} style={styles.themeBar}>
                                    <div style={styles.themeLabel}>{theme}</div>
                                    <div style={styles.barContainer}>
                                        <div
                                            style={{
                                                ...styles.bar,
                                                width: `${(count / posts.length) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <div style={styles.themeCount}>{count}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div style={styles.col}>
                    <div style={{ ...styles.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Recent Posts</span>
                        <button
                            onClick={fetchRssPosts}
                            disabled={fetchingRss}
                            style={{ ...styles.smallBtn, background: '#2B5BA5' }}
                        >
                            {fetchingRss ? 'Fetching...' : 'Fetch from Substack'}
                        </button>
                    </div>
                    <div style={styles.card}>
                        {recentPosts.length === 0 ? (
                            <div style={styles.emptyText}>
                                <div style={{ marginBottom: 12 }}>Start accumulating content.</div>
                                <button
                                    onClick={() => setView("add")}
                                    style={styles.primaryBtn}
                                >
                                    + Add First Post
                                </button>
                            </div>
                        ) : (
                            recentPosts.map((p) => (
                                <div key={p.id} style={styles.recentItem}>
                                    <div style={styles.recentMeta}>
                                        <span style={styles.sourceTag}>{p.source}</span>
                                        <span style={styles.themeMini}>{p.theme}</span>
                                    </div>
                                    <div style={styles.recentTitle}>{p.title}</div>
                                    {p.keyInsight && (
                                        <div style={styles.recentInsight}>→ {p.keyInsight}</div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {posts.length >= 3 && (
                <div style={styles.generateSection}>
                    <button
                        onClick={onGenerate}
                        disabled={generating}
                        style={{
                            ...styles.generateBtn,
                            opacity: generating ? 0.6 : 1,
                        }}
                    >
                        {generating
                            ? "Generating Report Draft..."
                            : "Generate LP Report Draft"}
                    </button>
                    <div style={styles.generateHint}>
                        {posts.length} posts will be synthesized into a quarterly brief
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, small }) {
    return (
        <div style={styles.statCard}>
            <div style={{ ...styles.statValue, fontSize: small ? 18 : 28 }}>
                {value}
            </div>
            <div style={styles.statLabel}>{label}</div>
        </div>
    );
}

function AddPost({ onAdd, onClassify, setView }) {
    const [source, setSource] = useState("Substack");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [url, setUrl] = useState("");
    const [publishedDate, setPublishedDate] = useState("");
    const [theme, setTheme] = useState("");
    const [keyInsight, setKeyInsight] = useState("");
    const [classifying, setClassifying] = useState(false);

    const handleClassify = async () => {
        if (!title && !content) return;
        setClassifying(true);
        const result = await onClassify(title, content);
        if (result.theme) setTheme(result.theme);
        if (result.keyInsight) setKeyInsight(result.keyInsight);
        setClassifying(false);
    };

    const handleSubmit = () => {
        if (!title) return;
        onAdd({
            source,
            title,
            content,
            url,
            publishedDate: publishedDate || new Date().toISOString(),
            theme: theme || "Other",
            keyInsight,
        });
        // reset
        setTitle("");
        setContent("");
        setUrl("");
        setPublishedDate("");
        setTheme("");
        setKeyInsight("");
    };

    return (
        <div style={styles.main}>
            <div style={styles.sectionTitle}>Add Content</div>
            <div style={styles.addCard}>
                <div style={styles.fieldRow}>
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Source</label>
                        <div style={styles.sourceToggle}>
                            {SOURCES.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setSource(s)}
                                    style={{
                                        ...styles.toggleBtn,
                                        ...(source === s ? styles.toggleBtnActive : {}),
                                    }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ ...styles.fieldGroup, flex: 1 }}>
                        <label style={styles.label}>Date</label>
                        <input
                            type="date"
                            value={publishedDate}
                            onChange={(e) => setPublishedDate(e.target.value)}
                            style={styles.input}
                        />
                    </div>
                </div>

                <div style={styles.fieldGroup}>
                    <label style={styles.label}>Title</label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Post title or headline"
                        style={styles.input}
                    />
                </div>

                <div style={styles.fieldGroup}>
                    <label style={styles.label}>URL (optional)</label>
                    <input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://..."
                        style={styles.input}
                    />
                </div>

                <div style={styles.fieldGroup}>
                    <label style={styles.label}>Content</label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Paste the full post content here..."
                        style={styles.textarea}
                        rows={8}
                    />
                </div>

                <button
                    onClick={handleClassify}
                    disabled={classifying || (!title && !content)}
                    style={{
                        ...styles.classifyBtn,
                        opacity: classifying ? 0.6 : 1,
                    }}
                >
                    {classifying ? "Analyzing..." : "Auto-Classify with AI"}
                </button>

                <div style={styles.fieldRow}>
                    <div style={{ ...styles.fieldGroup, flex: 1 }}>
                        <label style={styles.label}>Theme</label>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            style={styles.select}
                        >
                            <option value="">Select theme...</option>
                            {THEMES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={styles.fieldGroup}>
                    <label style={styles.label}>Key Insight</label>
                    <input
                        value={keyInsight}
                        onChange={(e) => setKeyInsight(e.target.value)}
                        placeholder="One-line contrarian insight from this post"
                        style={styles.input}
                    />
                </div>

                <div style={styles.btnRow}>
                    <button onClick={() => setView("dashboard")} style={styles.cancelBtn}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!title}
                        style={{
                            ...styles.primaryBtn,
                            opacity: title ? 1 : 0.4,
                        }}
                    >
                        Save Post
                    </button>
                </div>
            </div>
        </div>
    );
}

function Library({ posts, onDelete, onUpdate, editingPost, setEditingPost }) {
    const [filter, setFilter] = useState("All");

    const filtered =
        filter === "All" ? posts : posts.filter((p) => p.theme === filter);
    const themes = ["All", ...new Set(posts.map((p) => p.theme || "Other"))];

    return (
        <div style={styles.main}>
            <div style={styles.libraryHeader}>
                <div style={styles.sectionTitle}>Content Library</div>
                <div style={styles.filterRow}>
                    {themes.map((t) => (
                        <button
                            key={t}
                            onClick={() => setFilter(t)}
                            style={{
                                ...styles.filterBtn,
                                ...(filter === t ? styles.filterBtnActive : {}),
                            }}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div style={styles.emptyState}>No posts found.</div>
            ) : (
                <div style={styles.postList}>
                    {filtered.map((post) => (
                        <div key={post.id} style={styles.postCard}>
                            <div style={styles.postHeader}>
                                <div>
                                    <span style={styles.sourceTag}>{post.source}</span>
                                    <span style={styles.themeMini}>{post.theme}</span>
                                    <span style={styles.dateText}>
                                        {new Date(
                                            post.publishedDate || post.addedAt
                                        ).toLocaleDateString()}
                                    </span>
                                </div>
                                <div style={styles.postActions}>
                                    <button
                                        onClick={() =>
                                            setEditingPost(
                                                editingPost === post.id ? null : post.id
                                            )
                                        }
                                        style={styles.smallBtn}
                                    >
                                        {editingPost === post.id ? "Close" : "Edit"}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm("Delete this post?")) onDelete(post.id);
                                        }}
                                        style={{ ...styles.smallBtn, color: "#c0392b" }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                            <div style={styles.postTitle}>{post.title}</div>
                            {post.keyInsight && (
                                <div style={styles.postInsight}>→ {post.keyInsight}</div>
                            )}
                            {post.url && (
                                <a
                                    href={post.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={styles.postUrl}
                                >
                                    {post.url}
                                </a>
                            )}

                            {editingPost === post.id && (
                                <EditInline
                                    post={post}
                                    onSave={(updates) => onUpdate(post.id, updates)}
                                    onCancel={() => setEditingPost(null)}
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function EditInline({ post, onSave, onCancel }) {
    const [theme, setTheme] = useState(post.theme || "");
    const [keyInsight, setKeyInsight] = useState(post.keyInsight || "");

    return (
        <div style={styles.editInline}>
            <div style={styles.fieldGroup}>
                <label style={styles.label}>Theme</label>
                <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    style={styles.select}
                >
                    {THEMES.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </select>
            </div>
            <div style={styles.fieldGroup}>
                <label style={styles.label}>Key Insight</label>
                <input
                    value={keyInsight}
                    onChange={(e) => setKeyInsight(e.target.value)}
                    style={styles.input}
                />
            </div>
            <div style={styles.btnRow}>
                <button onClick={onCancel} style={styles.cancelBtn}>
                    Cancel
                </button>
                <button
                    onClick={() => onSave({ theme, keyInsight })}
                    style={styles.primaryBtn}
                >
                    Save
                </button>
            </div>
        </div>
    );
}

function Report({ draft, onRegenerate, generating }) {
    if (!draft) {
        return (
            <div style={styles.main}>
                <div style={styles.emptyState}>
                    <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
                        No report yet
                    </div>
                    <div style={{ color: "#888" }}>
                        Add at least 3 posts, then generate from Dashboard.
                    </div>
                </div>
            </div>
        );
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(draft.content);
        alert("Copied to clipboard!");
    };

    return (
        <div style={styles.main}>
            <div style={styles.reportHeader}>
                <div>
                    <div style={styles.sectionTitle}>LP Report Draft</div>
                    <div style={styles.reportMeta}>
                        Generated{" "}
                        {new Date(draft.generatedAt).toLocaleDateString()} · Based
                        on {draft.postCount} posts · {draft.dateRange}
                    </div>
                </div>
                <div style={styles.btnRow}>
                    <button onClick={copyToClipboard} style={styles.secondaryBtn}>
                        Copy
                    </button>
                    <button
                        onClick={onRegenerate}
                        disabled={generating}
                        style={styles.primaryBtn}
                    >
                        {generating ? "Regenerating..." : "Regenerate"}
                    </button>
                </div>
            </div>
            <div style={styles.reportCard}>
                <pre style={styles.reportContent}>{draft.content}</pre>
            </div>
        </div>
    );
}

// ─── Styles ───

const styles = {
    container: {
        fontFamily: "'IBM Plex Sans', 'Pretendard', -apple-system, sans-serif",
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e8e8e8",
    },
    loadingScreen: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#0a0a0a",
    },
    loadingText: {
        color: "#666",
        fontSize: 14,
        letterSpacing: 2,
        textTransform: "uppercase",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: "1px solid #1a1a1a",
        background: "#0f0f0f",
    },
    headerLeft: {
        display: "flex",
        alignItems: "center",
        gap: 16,
    },
    logo: {
        width: 40,
        height: 40,
        background: "linear-gradient(135deg, #2B5BA5, #142E5E)",
        color: "#fff",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        fontSize: 18,
        letterSpacing: -0.5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: -0.5,
    },
    headerSub: {
        fontSize: 13,
        color: "#888",
        marginTop: 2,
    },
    nav: {
        display: "flex",
        gap: 8,
    },
    navBtn: {
        border: "none",
        background: "transparent",
        color: "#888",
        padding: "8px 16px",
        borderRadius: 20,
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 500,
        transition: "all 0.2s",
    },
    navBtnActive: {
        background: "#222",
        color: "#fff",
    },
    main: {
        maxWidth: 1000,
        margin: "0 auto",
        padding: "32px 24px",
    },
    statsRow: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
        marginBottom: 40,
    },
    statCard: {
        background: "#111",
        border: "1px solid #1f1f1f",
        borderRadius: 12,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    },
    statValue: {
        fontWeight: 700,
        color: "#fff",
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 13,
        color: "#888",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    twoCol: {
        display: "grid",
        gridTemplateColumns: "1fr 1.5fr",
        gap: 32,
    },
    col: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 600,
        color: "#fff",
        letterSpacing: -0.3,
    },
    card: {
        background: "#111",
        border: "1px solid #1f1f1f",
        borderRadius: 12,
        padding: 24,
    },
    themeBar: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
    },
    themeLabel: {
        flex: "0 0 140px",
        fontSize: 13,
        color: "#ccc",
    },
    barContainer: {
        flex: 1,
        height: 6,
        background: "#1f1f1f",
        borderRadius: 3,
        overflow: "hidden",
    },
    bar: {
        height: "100%",
        background: "#2B5BA5",
        borderRadius: 3,
    },
    themeCount: {
        fontSize: 13,
        color: "#888",
        width: 20,
        textAlign: "right",
    },
    emptyText: {
        color: "#666",
        fontSize: 14,
        textAlign: "center",
        padding: "20px 0",
    },
    primaryBtn: {
        background: "#fff",
        color: "#000",
        border: "none",
        padding: "10px 20px",
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        transition: "transform 0.1s",
    },
    recentItem: {
        paddingBottom: 16,
        borderBottom: "1px solid #1f1f1f",
        marginBottom: 16,
    },
    recentMeta: {
        display: "flex",
        gap: 8,
        marginBottom: 8,
    },
    sourceTag: {
        fontSize: 11,
        padding: "2px 6px",
        background: "#222",
        borderRadius: 4,
        color: "#888",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    themeMini: {
        fontSize: 11,
        padding: "2px 8px",
        background: "rgba(43, 91, 165, 0.1)",
        color: "#2B5BA5",
        borderRadius: 4,
    },
    recentTitle: {
        fontSize: 15,
        fontWeight: 500,
        color: "#eee",
        lineHeight: 1.4,
        marginBottom: 8,
    },
    recentInsight: {
        fontSize: 14,
        color: "#aaa",
        fontStyle: "italic",
        background: "#161616",
        padding: "8px 12px",
        borderRadius: 6,
        borderLeft: "2px solid #2B5BA5",
    },
    generateSection: {
        marginTop: 40,
        padding: 32,
        background: "linear-gradient(45deg, #111, #161616)",
        border: "1px solid #1f1f1f",
        borderRadius: 12,
        textAlign: "center",
    },
    generateBtn: {
        background: "#2B5BA5",
        color: "#fff",
        border: "none",
        padding: "14px 32px",
        borderRadius: 8,
        fontSize: 16,
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(43, 91, 165, 0.2)",
    },
    generateHint: {
        marginTop: 12,
        fontSize: 13,
        color: "#888",
    },
    addCard: {
        background: "#111",
        border: "1px solid #1f1f1f",
        borderRadius: 12,
        padding: 32,
        marginTop: 16,
    },
    fieldRow: {
        display: "flex",
        gap: 24,
        marginBottom: 24,
    },
    fieldGroup: {
        marginBottom: 24,
    },
    label: {
        display: "block",
        fontSize: 13,
        color: "#888",
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        width: "100%",
        background: "#0a0a0a",
        border: "1px solid #222",
        color: "#eee",
        padding: "12px 16px",
        borderRadius: 8,
        fontSize: 15,
        outline: "none",
    },
    textarea: {
        width: "100%",
        background: "#0a0a0a",
        border: "1px solid #222",
        color: "#eee",
        padding: "16px",
        borderRadius: 8,
        fontSize: 15,
        fontFamily: "inherit",
        resize: "vertical",
        outline: "none",
        lineHeight: 1.5,
    },
    select: {
        width: "100%",
        background: "#0a0a0a",
        border: "1px solid #222",
        color: "#eee",
        padding: "12px 16px",
        borderRadius: 8,
        fontSize: 15,
        outline: "none",
        appearance: "none",
    },
    sourceToggle: {
        display: "flex",
        background: "#0a0a0a",
        padding: 4,
        borderRadius: 8,
        border: "1px solid #222",
    },
    toggleBtn: {
        flex: 1,
        background: "transparent",
        border: "none",
        color: "#888",
        padding: "8px 0",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 14,
    },
    toggleBtnActive: {
        background: "#222",
        color: "#fff",
    },
    classifyBtn: {
        width: "100%",
        background: "rgba(43, 91, 165, 0.1)",
        border: "1px dashed #2B5BA5",
        color: "#2B5BA5",
        padding: "16px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        marginBottom: 24,
    },
    btnRow: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 12,
        marginTop: 32,
    },
    cancelBtn: {
        background: "transparent",
        color: "#aaa",
        border: "1px solid #333",
        padding: "10px 20px",
        borderRadius: 6,
        fontSize: 14,
        cursor: "pointer",
    },
    libraryHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    filterRow: {
        display: "flex",
        gap: 8,
    },
    filterBtn: {
        background: "#111",
        border: "1px solid #222",
        color: "#888",
        padding: "6px 14px",
        borderRadius: 20,
        fontSize: 13,
        cursor: "pointer",
    },
    filterBtnActive: {
        background: "#eee",
        color: "#000",
    },
    emptyState: {
        padding: 60,
        textAlign: "center",
        background: "#111",
        border: "1px dashed #222",
        borderRadius: 12,
        color: "#666",
    },
    postList: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
    },
    postCard: {
        background: "#111",
        border: "1px solid #1f1f1f",
        borderRadius: 12,
        padding: 24,
    },
    postHeader: {
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    dateText: {
        fontSize: 13,
        color: "#666",
        marginLeft: 12,
    },
    postActions: {
        display: "flex",
        gap: 8,
    },
    smallBtn: {
        background: "transparent",
        border: "none",
        color: "#888",
        fontSize: 13,
        cursor: "pointer",
    },
    postTitle: {
        fontSize: 18,
        fontWeight: 600,
        color: "#fff",
        marginBottom: 12,
        lineHeight: 1.4,
    },
    postInsight: {
        fontSize: 15,
        color: "#aaa",
        background: "#161616",
        padding: "12px 16px",
        borderRadius: 6,
        borderLeft: "2px solid #2B5BA5",
        marginBottom: 12,
    },
    postUrl: {
        fontSize: 13,
        color: "#2B5BA5",
        textDecoration: "none",
    },
    editInline: {
        marginTop: 24,
        paddingTop: 24,
        borderTop: "1px dashed #333",
    },
    reportHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    reportMeta: {
        fontSize: 13,
        color: "#888",
        marginTop: 4,
    },
    secondaryBtn: {
        background: "#222",
        color: "#fff",
        border: "none",
        padding: "10px 20px",
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
    },
    reportCard: {
        background: "#fff",
        color: "#000",
        borderRadius: 12,
        padding: "40px 60px",
        fontFamily: "Times New Roman, serif",
        fontSize: 16,
        lineHeight: 1.6,
    },
    reportContent: {
        fontFamily: "inherit",
        whiteSpace: "pre-wrap",
        margin: 0,
    },
};
