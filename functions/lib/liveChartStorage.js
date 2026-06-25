"use strict";
/** Firestore chart archive helpers (functions runtime). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHART_TAIL_SIZE = exports.CHART_PAGE_SIZE = void 0;
exports.appendTickToBuffer = appendTickToBuffer;
exports.appendTicksToPage = appendTicksToPage;
exports.splitOverflowPages = splitOverflowPages;
exports.CHART_PAGE_SIZE = 1500;
exports.CHART_TAIL_SIZE = 600;
function appendTickToBuffer(buffer, tick) {
    const last = buffer[buffer.length - 1];
    if (last?.gameIndex === tick.gameIndex)
        return buffer;
    const next = [...buffer, tick];
    return next.length > exports.CHART_TAIL_SIZE ? next.slice(-exports.CHART_TAIL_SIZE) : next;
}
function appendTicksToPage(page, ticks) {
    const out = [...page];
    for (const tick of ticks) {
        const last = out[out.length - 1];
        if (last?.gameIndex === tick.gameIndex)
            continue;
        out.push(tick);
    }
    return out;
}
function splitOverflowPages(pageIndex, pageTicks) {
    const pages = [];
    let idx = pageIndex;
    let buf = [...pageTicks];
    while (buf.length > exports.CHART_PAGE_SIZE) {
        const chunk = buf.slice(0, exports.CHART_PAGE_SIZE);
        pages.push({
            pageIndex: idx,
            ticks: chunk,
            startGameIndex: chunk[0].gameIndex,
            endGameIndex: chunk[chunk.length - 1].gameIndex,
        });
        idx += 1;
        buf = buf.slice(exports.CHART_PAGE_SIZE);
    }
    return { pages, latestPageIndex: idx, remainder: buf };
}
