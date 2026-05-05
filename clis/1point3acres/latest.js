/**
 * 一亩三分地 最新帖子 — Discuz guide=new view.
 */
import { cli, Strategy } from '@jackwener/opencli/registry';
import { fetchHtml, parseThreadList, BASE } from './utils.js';

cli({
    site: '1point3acres',
    name: 'latest',
    access: 'read',
    description: '一亩三分地 最新发帖（按发帖时间倒序）',
    domain: 'www.1point3acres.com',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'limit', type: 'int', default: 20, help: '返回条数（默认 20，最多 ~50）' },
    ],
    columns: ['rank', 'tid', 'title', 'forum', 'author', 'replies', 'views', 'postTime', 'url'],
    func: async (args) => {
        const html = await fetchHtml(`${BASE}/forum.php?mod=guide&view=new`);
        const items = parseThreadList(html);
        const n = Math.max(1, Math.min(Number(args.limit) || 20, items.length));
        return items.slice(0, n).map((t, i) => ({
            rank: i + 1,
            tid: t.tid,
            title: t.title,
            forum: t.forum,
            author: t.author,
            replies: t.replies,
            views: t.views,
            postTime: t.postTime,
            url: t.url,
        }));
    },
});
