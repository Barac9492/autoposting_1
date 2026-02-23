const Parser = require('rss-parser');

const parser = new Parser({
    customFields: {
        item: ['content:encoded', 'dc:creator', 'pubDate'],
    },
});

const SUBSTACK_URL = 'https://ethancho12.substack.com/feed';

async function fetchSubstackPosts() {
    try {
        console.log(`Fetching RSS feed from: ${SUBSTACK_URL}...`);
        const feed = await parser.parseURL(SUBSTACK_URL);

        console.log(`\n✅ Successfully fetched feed: ${feed.title}`);
        console.log(`Description: ${feed.description}`);
        console.log(`Link: ${feed.link}\n`);

        const posts = feed.items.map(item => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            author: item.creator || item['dc:creator'],
            snippet: item.contentSnippet ? item.contentSnippet.substring(0, 150) + '...' : '',
            // Ensure we have some content
            content: item['content:encoded'] || item.content,
        }));

        return posts;
    } catch (error) {
        console.error('❌ Error fetching Substack RSS feed:', error.message);
        throw error;
    }
}

// If this file is run directly (not imported), execute the fetch function
if (require.main === module) {
    fetchSubstackPosts().then(posts => {
        console.log(`Found ${posts.length} posts.`);
        if (posts.length > 0) {
            console.log('\n--- Latest Post Preview ---');
            console.log(`Title: ${posts[0].title}`);
            console.log(`Date: ${new Date(posts[0].pubDate).toLocaleString()}`);
            console.log(`Link: ${posts[0].link}`);
            console.log(`Snippet: ${posts[0].snippet}`);
            console.log('---------------------------\n');
        }
    });
}

module.exports = { fetchSubstackPosts };
