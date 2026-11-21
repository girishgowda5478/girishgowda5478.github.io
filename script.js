/* =========================================================
   Girish Gowda J · portfolio
   1. helpers   2. nav   3. display words   4. agent swarm
   5. demos (NL→SQL, RAG, Iris, Pothole, Intent, Reconciler)
   ========================================================= */
(() => {
    'use strict';

    /* ---------- 1. helpers ---------- */
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const root = document.documentElement;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const fmt = (n) => n.toLocaleString('en-IN');
    const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

    // Cancellable async sequences: starting a new run invalidates the previous one,
    // so a second click never leaves two timelines fighting over the same DOM.
    const CANCELLED = Symbol('cancelled');
    function sequence() {
        let token = 0;
        return {
            start() {
                const mine = ++token;
                const alive = () => mine === token;
                const sleep = (ms) => new Promise((res, rej) => setTimeout(() => (alive() ? res() : rej(CANCELLED)), ms));
                return { sleep, alive };
            },
            cancel() { token++; },
        };
    }
    const swallow = (e) => { if (e !== CANCELLED) throw e; };

    function restartAnim(el) {
        el.hidden = true;
        void el.offsetWidth;
        el.hidden = false;
    }

        // Play a demo by itself once it is on screen (and built by the swarm), so a
    // visitor who never clicks still sees each system work. Skipped if the visitor
    // already interacted with that demo, and entirely for reduced-motion users.
    // With onLeave, it re-runs on every entry and onLeave fires when it scrolls away.
    function autoplay(demoEl, onEnter, onLeave) {
        if (reduceMotion || root.dataset.autoplay === 'off' || !demoEl || !('IntersectionObserver' in window)) return;
        let touched = false;
        ['pointerdown', 'keydown'].forEach((t) => demoEl.addEventListener(t, () => { touched = true; }, { once: true, passive: true }));
        let timer = 0;
        const ready = () => !root.classList.contains('swarm-on') || demoEl.classList.contains('is-built');
        const io = new IntersectionObserver(([en]) => {
            clearTimeout(timer);
            if (en.intersectionRatio < 0.34) {
                if (onLeave) onLeave();
                return;
            }
            const go = () => {
                if (!ready()) { timer = setTimeout(go, 300); return; }
                if (onLeave) { onEnter(); return; }
                io.disconnect();
                if (!touched) onEnter();
            };
            timer = setTimeout(go, 450);
        }, { threshold: [0, 0.35] });
        io.observe(demoEl);
    }

    /* ---------- 2. nav ---------- */
    function initNav() {
        const nav = $('#nav');
        const toggle = $('.nav-toggle');
        const menu = $('#nav-menu');
        if (!nav || !toggle || !menu) return;
        const setOpen = (open) => {
            toggle.setAttribute('aria-expanded', String(open));
            menu.classList.toggle('is-open', open);
        };
        toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
        menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

        const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 24);
        addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        const links = $$('.nav-links a');
        const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                links.forEach((l) => l.classList.remove('is-active'));
                const link = byId.get(en.target.id);
                if (link) link.classList.add('is-active');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        $$('main section[id]').forEach((s) => io.observe(s));
    }

    /* ---------- 3. giant outlined words ----------
       Size each SVG word so its natural width is exactly the viewBox width,
       then crop the viewBox to the ink bounds measured with canvas. */
    function fitDisplayWords() {
        const ctx = document.createElement('canvas').getContext('2d');
        $$('.display-word svg').forEach((svg) => {
            const t = svg.querySelector('text');
            ctx.font = '400 200px Anton, Impact, sans-serif';
            const m = ctx.measureText(t.textContent);
            if (!m.width) return;
            const k = 1000 / m.width;
            const fs = 200 * k;
            const asc = m.actualBoundingBoxAscent * k;
            const desc = m.actualBoundingBoxDescent * k;
            const pad = 4;
            const base = 500;
            t.style.fontSize = fs.toFixed(2) + 'px';
            t.setAttribute('y', base);
            svg.setAttribute('viewBox', `0 ${(base - asc - pad).toFixed(1)} 1000 ${(asc + desc + pad * 2).toFixed(1)}`);
        });
    }

    /* ---------- 4. agent swarm ----------
       Every [data-build] element is a "layer". Agents (coloured cursors) pick up
       layers as they scroll into view, draw a blueprint box over each one, and the
       real content is revealed inside it. */
    const AGENT_NAMES = ['planner', 'retriever', 'router', 'embedder', 'vision', 'sql-gen', 'reranker', 'critic',
        'summarizer', 'tracker', 'indexer', 'ocr', 'guard', 'scheduler', 'executor', 'tokenizer'];
    const AGENT_COLORS = ['#ff5a5a', '#3ec5ff', '#3ddc84', '#ffb020', '#b18cff', '#ff7ac6', '#5eead4', '#fb923c',
        '#a3e635', '#60a5fa', '#f472b6', '#facc15', '#34d399', '#c084fc', '#fb7185', '#22d3ee'];
    const cursorSvg = (c) => `<svg class="cur-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 1.5v12l3.4-3 2.4 4.6 2-1-2.3-4.5h4.6z" fill="${c}" stroke="#0a0a0a" stroke-width="1" stroke-linejoin="round"/></svg>`;
    // the text cursor an agent shows while it types
    const ibeamSvg = (c) => `<svg class="cur-ibeam" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1.5h6M5 14.5h6M8 1.5v13" fill="none" stroke="#0a0a0a" stroke-width="3.4" stroke-linecap="round"/><path d="M5 1.5h6M5 14.5h6M8 1.5v13" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/></svg>`;

    function createSwarm() {
        const layers = $$('[data-build]');
        const total = layers.length;
        const order = new Map(layers.map((el, i) => [el, i]));

        let gen = 0;
        let raf = 0;
        let last = 0;
        let idleSince = 0;
        let processing = false;
        let finished = false;
        let built = 0;
        let agents = [];
        let crosses = [];
        let io = null;
        let ui = null;
        const pending = new Set();
        const assigned = new Set();
        const seenAt = new Map();

        function mountUi(n) {
            const cursors = document.createElement('div');
            cursors.className = 'swarm-cursors';
            cursors.setAttribute('aria-hidden', 'true');

            const boxes = document.createElement('div');
            boxes.className = 'swarm-boxes';
            boxes.setAttribute('aria-hidden', 'true');

            const hud = document.createElement('div');
            hud.className = 'swarm-hud';
            hud.innerHTML =
                `<span class="hud-dots" aria-hidden="true">${AGENT_COLORS.slice(0, n).map((c) => `<i style="--c:${c}"></i>`).join('')}</span>` +
                `<span class="hud-agents" aria-hidden="true"><b>${n}</b> agents</span>` +
                `<span class="hud-count" aria-hidden="true"><b class="hud-built">0</b>/${total} layers</span>` +
                '<span class="hud-edits" aria-hidden="true"><b>0</b> edits</span>' +
                `<span class="hud-bar" aria-hidden="true"><i></i></span>` +
                `<span class="hud-hint" aria-hidden="true" hidden>scroll ↓ to build</span>` +
                `<button type="button" class="hud-btn">Skip build</button>`;
            document.body.append(boxes, cursors, hud);

            hud.querySelector('.hud-btn').addEventListener('click', skip);
            return {
                cursors, boxes, hud,
                built: hud.querySelector('.hud-built'),
                count: hud.querySelector('.hud-count'),
                edits: hud.querySelector('.hud-edits b'),
                fill: hud.querySelector('.hud-bar i'),
                hint: hud.querySelector('.hud-hint'),
                btn: hud.querySelector('.hud-btn'),
            };
        }

        function spawnCrosshairs(n) {
            for (let i = 0; i < n; i++) {
                const c = document.createElement('i');
                c.className = 'crosshair';
                const x = rand(4, 96);
                const y = rand(10, 90);
                c.style.left = x + '%';
                c.style.top = y + '%';
                c.style.setProperty('--c', AGENT_COLORS[i % AGENT_COLORS.length]);
                c.style.animationDelay = (-Math.random()).toFixed(2) + 's';
                ui.cursors.appendChild(c);
                crosses.push({ el: c, x: (x / 100) * innerWidth, y: (y / 100) * innerHeight });
            }
        }

        function clearCrosshairs() {
            crosses.forEach((c, i) => setTimeout(() => {
                c.el.style.opacity = '0';
                setTimeout(() => c.el.remove(), 500);
            }, i * 20));
            crosses = [];
        }

        function makeAgents(n) {
            return Array.from({ length: n }, (_, i) => {
                const el = document.createElement('div');
                el.className = 'agent';
                const c = AGENT_COLORS[i % AGENT_COLORS.length];
                const name = AGENT_NAMES[i % AGENT_NAMES.length];
                el.style.setProperty('--c', c);
                el.innerHTML = cursorSvg(c) + ibeamSvg(c) + `<span class="agent-tag">${name}</span>`;
                ui.cursors.appendChild(el);
                const spawn = crosses[i % Math.max(crosses.length, 1)] || { x: rand(0, innerWidth), y: rand(0, innerHeight) };
                return { el, name, tag: el.querySelector('.agent-tag'), x: spawn.x, y: spawn.y, tx: spawn.x, ty: spawn.y, job: null, follow: null, wanderAt: 0 };
            });
        }

        function tick(now) {
            const dt = Math.min(48, now - (last || now));
            last = now;
            const k = 1 - Math.pow(1 - 0.13, dt / 16.7);
            const W = innerWidth;
            const H = innerHeight;

            for (const a of agents) {
                if (a.follow) {
                    const p = a.follow();
                    a.tx = p.x;
                    a.ty = p.y;
                } else if (now > a.wanderAt) {
                    a.tx = clamp(a.x + rand(-180, 180), 16, W - 60);
                    a.ty = clamp(a.y + rand(-140, 140), 70, H - 70);
                    a.wanderAt = now + rand(900, 1900);
                }
                const kk = a.follow ? k : k * 0.22;
                a.x += (a.tx - a.x) * kk;
                a.y += (a.ty - a.y) * kk;
                a.el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
            }

            // Never leave content hidden for long if every agent is busy.
            for (const el of pending) {
                if (now - seenAt.get(el) > 4500) reveal(el);
            }

            if (processing) assign(now);

            const busy = pending.size > 0 || assigned.size > 0;
            if (busy || !processing) idleSince = now;
            const idleFor = now - idleSince;
            if (ui) ui.hint.hidden = !(processing && !finished && idleFor > 900);
            if (idleFor > 2400) agents.forEach((a) => a.el.classList.remove('is-live'));
            if (idleFor > 3200 && !finished) { raf = 0; return; } // sleep until something scrolls into view

            raf = requestAnimationFrame(tick);
        }

        function wake() {
            if (!raf && gen && !finished) {
                last = 0;
                idleSince = performance.now();
                raf = requestAnimationFrame(tick);
            }
        }

        // One dispatch every DISPATCH_GAP ms, top-most layer first, to the nearest
        // free agent. The gap is what makes the page cascade together instead of popping in.
        const DISPATCH_GAP = 95;
        let lastDispatch = 0;
        function assign(now) {
            if (!pending.size || now - lastDispatch < DISPATCH_GAP) return;
            const free = agents.filter((a) => !a.job);
            if (!free.length) return;
            let el = null;
            for (const p of pending) if (!el || order.get(p) < order.get(el)) el = p;
            const r = el.getBoundingClientRect();
            let agent = free[0];
            let bestD = Infinity;
            for (const a of free) {
                const d = (a.x - r.left) ** 2 + (a.y - r.top) ** 2;
                if (d < bestD) { bestD = d; agent = a; }
            }
            pending.delete(el);
            lastDispatch = now;
            runJob(agent, el, gen);
        }

        /* ---- operations ----
           Before a layer is done, its agent works on it the way a designer would:
           size the box, type the text (with the odd typo and backspace), swap a
           placeholder word, paste the rest of a long paragraph, duplicate a card and
           retype its title, show padding and gaps, scale the type up, snap the
           alignment, fill the colour, drop in the image. Every change is temporary:
           a draft's finish() puts the original text and inline styles back exactly. */
        const live = new Map(); // layer -> its draft, so Skip and Replay can finish it at once
        let edits = 0;
        let themed = false;
        const bump = () => { edits++; if (ui) ui.edits.textContent = edits; };
        const pause = async (alive, ms) => { await wait(ms); return alive(); };
        const docRect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
        const setTask = (a, t) => { a.tag.textContent = t ? `${a.name} · ${t}` : a.name; };

        function startDraft(el) {
            const styles = []; // [node, property, original inline value]
            const texts = []; // [text node, original value]
            const d = {
                el,
                overlays: new Set(),
                nodesFor: new Map(),
                done: false,
                style(node, prop, value) {
                    if (!styles.some(([n, p]) => n === node && p === prop)) styles.push([node, prop, node.style[prop]]);
                    node.style[prop] = value;
                },
                keepText(n) {
                    if (!texts.some(([t]) => t === n)) texts.push([n, n.nodeValue]);
                },
                original(n) {
                    const hit = texts.find(([t]) => t === n);
                    return hit ? hit[1] : n.nodeValue;
                },
                finish() {
                    if (d.done) return;
                    d.done = true;
                    texts.forEach(([n, v]) => { n.nodeValue = v; });
                    el.querySelectorAll('.type-caret').forEach((c) => c.remove());
                    d.overlays.forEach((o) => o.remove());
                    d.overlays.clear();
                    styles.reverse().forEach(([n, p, v]) => { n.style[p] = v; });
                    // leave no empty style="" behind on elements that had none
                    new Set(styles.map(([n]) => n)).forEach((n) => { if (!n.getAttribute('style')) n.removeAttribute('style'); });
                    el.classList.add('is-op');
                    el.classList.remove('is-drafting', 'is-colored');
                    el.removeAttribute('aria-busy');
                    live.delete(el);
                },
            };
            el.classList.add('is-drafting');
            el.setAttribute('aria-busy', 'true');
            live.set(el, d);
            return d;
        }
        const finishAll = () => [...live.values()].forEach((d) => d.finish());

        function overlay(d, cls, html) {
            const o = document.createElement('div');
            o.className = cls;
            if (html) o.innerHTML = html;
            ui.boxes.appendChild(o);
            d.overlays.add(o);
            return o;
        }
        function place(o, x, y, w, h) {
            o.style.left = x + 'px';
            o.style.top = y + 'px';
            if (w != null) o.style.width = w + 'px';
            if (h != null) o.style.height = h + 'px';
        }
        function badge(d, html, x, y, tone) {
            const b = overlay(d, 'op-badge' + (tone ? ' is-' + tone : ''), html);
            place(b, Math.max(4, x), Math.max(4, y));
            bump();
            return b;
        }
        function fade(d, o) {
            if (!o) return;
            o.classList.add('is-out');
            setTimeout(() => { o.remove(); d.overlays.delete(o); }, 260);
        }
        function highlight(d, rects) {
            return rects.map((r) => {
                const o = overlay(d, 'op-sel');
                place(o, r.left + scrollX, r.top + scrollY, r.width, r.height);
                return o;
            });
        }

        // visible text nodes of a subtree, in reading order (judged by their original text)
        function textNodes(root, d) {
            const out = [];
            const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            for (let n = tw.nextNode(); n; n = tw.nextNode()) {
                const p = n.parentElement;
                if (!d.original(n).trim() || !p || p.closest('.sr-only, svg, .type-caret') || !p.getClientRects().length) continue;
                out.push(n);
            }
            return out;
        }

        // empties text that is about to be typed, so the selection box frames a blank area
        function blank(d, root) {
            const nodes = textNodes(root, d);
            if (!nodes.length) return;
            d.nodesFor.set(root, nodes); // empty inline tags can lose their layout box, so remember the list now
            d.style(d.el, 'minHeight', d.el.getBoundingClientRect().height + 'px');
            nodes.forEach((n) => { d.keepText(n); n.nodeValue = ''; });
        }

        const KEYROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
        function slip(ch) { // a neighbouring key: the typo a real hand makes
            const lo = ch.toLowerCase();
            for (const row of KEYROWS) {
                const i = row.indexOf(lo);
                if (i < 0) continue;
                const n = row[i + (i > 0 && Math.random() < 0.5 ? -1 : 1)] || row[i - 1];
                return ch === lo ? n : n.toUpperCase();
            }
            return 'x';
        }

        // Shows the first `count` characters of a run of text nodes (plus any extra
        // characters typed after them) with a caret at the end.
        function typist(d, nodes) {
            nodes.forEach((n) => d.keepText(n));
            const orig = nodes.map((n) => d.original(n));
            const caret = document.createElement('span');
            caret.className = 'type-caret';
            let extraAt = null;
            const at = (idx) => {
                let left = idx;
                for (let i = 0; i < nodes.length; i++) {
                    if (left <= orig[i].length) return [i, left];
                    left -= orig[i].length;
                }
                const last = nodes.length - 1;
                return [last, orig[last].length];
            };
            const rangeRects = (n1, o1, n2, o2) => {
                const r = document.createRange();
                r.setStart(n1, Math.min(o1, n1.nodeValue.length));
                r.setEnd(n2, Math.min(o2, n2.nodeValue.length));
                return [...r.getClientRects()].filter((x) => x.width > 1).slice(0, 14);
            };
            return {
                caret,
                full: orig.join(''),
                total: orig.reduce((s, t) => s + t.length, 0),
                show(count, extra = '') {
                    let left = count;
                    let cur = 0;
                    for (let i = 0; i < nodes.length; i++) {
                        const take = Math.max(0, Math.min(left, orig[i].length));
                        nodes[i].nodeValue = orig[i].slice(0, take);
                        if (take > 0) cur = i;
                        left -= take;
                    }
                    extraAt = extra ? [cur, nodes[cur].nodeValue.length, extra.length] : null;
                    if (extra) nodes[cur].nodeValue += extra;
                    nodes[cur].after(caret);
                },
                rects(from, to) {
                    const [a, ao] = at(from);
                    const [b, bo] = at(to);
                    return rangeRects(nodes[a], ao, nodes[b], bo);
                },
                extraRects() {
                    if (!extraAt) return [];
                    const [i, start, len] = extraAt;
                    return rangeRects(nodes[i], start, nodes[i], start + len);
                },
                done() {
                    caret.remove();
                    nodes.forEach((n, i) => { n.nodeValue = orig[i]; });
                },
            };
        }

        // type: by hand, with a typo now and then; a placeholder word that gets
        // selected and replaced; the tail of long text pasted in one go
        async function opType(a, d, root, alive, { typo = Math.random() < 0.55, placeholder = false, byHand = 70 } = {}) {
            const nodes = d.nodesFor.get(root) || textNodes(root, d);
            if (!nodes.length) return;
            const t = typist(d, nodes);
            d.style(d.el, 'minHeight', d.el.getBoundingClientRect().height + 'px'); // no layout jump while text grows
            a.el.classList.add('is-ibeam');
            a.follow = () => { const r = t.caret.getBoundingClientRect(); return { x: r.right + 1, y: r.top + r.height * 0.15 }; };
            setTask(a, 'type');
            bump();
            const { total, full } = t;
            const typed = total > byHand + 25 ? byHand : total;
            let swapAt = -1;
            if (placeholder && typed === total) {
                const m = /\S{3,}$/.exec(full.trimEnd());
                if (m && m.index > 0) swapAt = m.index;
            }
            const per = clamp(1000 / Math.max(typed, 1), 14, 46);
            const typoAt = typo && typed >= 8 ? Math.floor(typed * rand(0.3, 0.7)) : -1;
            const handEnd = swapAt > 0 ? swapAt : typed;
            t.show(0);
            for (let i = 1; i <= handEnd; i++) {
                if (!alive()) return;
                if (i === typoAt && /[a-z]/i.test(full[i - 1])) {
                    t.show(i - 1, slip(full[i - 1]));
                    setTask(a, 'typo');
                    bump();
                    if (!await pause(alive, per * 3 + 140)) return;
                    t.show(i - 1);
                    setTask(a, '⌫ backspace');
                    if (!await pause(alive, 140)) return;
                    setTask(a, 'type');
                }
                t.show(i);
                if (!await pause(alive, per * rand(0.55, 1.45))) return;
            }
            if (swapAt > 0) {
                const ph = 'lorem';
                for (let k = 1; k <= ph.length; k++) {
                    t.show(swapAt, ph.slice(0, k));
                    if (!await pause(alive, per)) return;
                }
                setTask(a, 'select word');
                const sel = highlight(d, t.extraRects());
                bump();
                if (!await pause(alive, 360)) return;
                sel.forEach((o) => fade(d, o));
                setTask(a, 'replace');
                for (let i = swapAt + 1; i <= total; i++) {
                    t.show(i);
                    if (!await pause(alive, per)) return;
                }
            }
            if (typed < total) {
                setTask(a, '⌘V paste');
                t.show(total);
                const cr = t.caret.getBoundingClientRect();
                const sel = highlight(d, t.rects(typed, total));
                const b = badge(d, '⌘V', cr.right + scrollX + 6, cr.top + scrollY - 6, 'paste');
                if (!await pause(alive, 480)) return;
                sel.forEach((o) => fade(d, o));
                fade(d, b);
            }
            t.done();
            a.el.classList.remove('is-ibeam');
        }

        // copy a finished sibling, paste it into this slot, then retype the title
        async function opCopy(a, d, src, alive) {
            const TITLE = 'h2, h3, .kv-v';
            const rs = docRect(src);
            const rt = docRect(d.el);
            setTask(a, '⌘C copy');
            a.follow = () => { const r = src.getBoundingClientRect(); return { x: r.left + 12, y: r.top + 12 }; };
            const ghost = overlay(d, 'op-ghost');
            place(ghost, rs.x, rs.y, rs.w, rs.h);
            const bc = badge(d, '⌘C', rs.x, rs.y - 20, 'copy');
            if (!await pause(alive, 380)) return;
            setTask(a, '⌘V paste');
            ghost.classList.add('is-moving');
            place(ghost, rt.x, rt.y, rt.w, rt.h);
            a.follow = () => { const r = ghost.getBoundingClientRect(); return { x: r.left + 12, y: r.top + 12 }; };
            fade(d, bc);
            if (!await pause(alive, 540)) return;
            const bv = badge(d, '⌘V', rt.x, rt.y - 20, 'paste');
            fade(d, ghost);
            const tt = d.el.querySelector(TITLE);
            const st = src.querySelector(TITLE);
            if (!tt || !st) { fade(d, bv); return; }
            const nodes = textNodes(tt, d);
            if (!nodes.length) { fade(d, bv); return; }
            // the pasted copy still carries the source's title
            nodes.forEach((n) => d.keepText(n));
            nodes.forEach((n, i) => { n.nodeValue = i ? '' : st.textContent.trim(); });
            if (!await pause(alive, 240)) return;
            setTask(a, 'select all');
            const r = document.createRange();
            r.selectNodeContents(tt);
            const sel = highlight(d, [...r.getClientRects()].slice(0, 6));
            bump();
            if (!await pause(alive, 340)) return;
            sel.forEach((o) => fade(d, o));
            fade(d, bv);
            await opType(a, d, tt, alive, { typo: Math.random() < 0.35 });
        }

        // box model: padding inside, then the margin or gap to the next sibling
        async function opBox(a, d, alive) {
            const el = d.el;
            const cs = getComputedStyle(el);
            const px = (v) => Math.round(parseFloat(v) || 0);
            const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px);
            const r = docRect(el);
            if (pad.some(Boolean)) {
                setTask(a, 'padding');
                const o = overlay(d, 'op-pad');
                place(o, r.x, r.y, r.w, r.h);
                a.follow = () => { const rr = el.getBoundingClientRect(); return { x: rr.left + pad[3], y: rr.top + pad[0] }; };
                void o.offsetWidth;
                o.style.borderWidth = pad.map((p) => p + 'px').join(' ');
                const same = pad.every((p) => p === pad[0]);
                const b = badge(d, `padding ${same ? pad[0] : pad[0] + ' ' + pad[1]}`, r.x + 4, r.y + 4, 'pad');
                if (!await pause(alive, 600)) return;
                fade(d, o);
                fade(d, b);
            }
            const next = el.nextElementSibling;
            if (!next || !next.getClientRects().length) return;
            const nr = docRect(next);
            let gap = null;
            let size = 0;
            if (nr.y >= r.y + r.h - 1) {
                size = nr.y - (r.y + r.h);
                gap = { x: r.x, y: r.y + r.h, w: Math.min(r.w, nr.w), h: size };
            } else if (nr.x >= r.x + r.w - 1) {
                size = nr.x - (r.x + r.w);
                gap = { x: r.x + r.w, y: r.y, w: size, h: Math.min(r.h, nr.h) };
            }
            if (!gap || size < 4 || size > 240) return;
            const pcs = getComputedStyle(el.parentElement);
            const isGap = /flex|grid/.test(pcs.display) && (parseFloat(pcs.rowGap) > 0 || parseFloat(pcs.columnGap) > 0);
            setTask(a, isGap ? 'gap' : 'margin');
            const o = overlay(d, 'op-gap');
            place(o, gap.x, gap.y, gap.w, gap.h);
            a.follow = () => ({ x: gap.x - scrollX + gap.w / 2, y: gap.y - scrollY + gap.h / 2 });
            const b = badge(d, `${isGap ? 'gap' : 'margin'} ${Math.round(size)}`, gap.x + gap.w / 2 - 26, gap.y + gap.h / 2 - 8, 'gap');
            if (!await pause(alive, 480)) return;
            fade(d, o);
            fade(d, b);
        }

        // type scale: the heading grows from a smaller size to its real one
        async function opFont(a, d, alive) {
            const t = d.el.matches('h1, h2, h3') ? d.el : d.el.querySelector('h1, h2, h3, svg') || d.el;
            const sizeOf = t.matches('svg') ? t.querySelector('text') || t : t;
            const size = Math.round(parseFloat(getComputedStyle(sizeOf).fontSize) || 32);
            const from = Math.round(size * 0.7);
            const centered = getComputedStyle(t).textAlign === 'center';
            d.style(t, 'transformOrigin', centered ? '50% 100%' : '0 100%');
            d.style(t, 'transition', 'none');
            d.style(t, 'scale', '0.7');
            void t.offsetWidth;
            setTask(a, 'font-size');
            const r = docRect(t);
            const b = badge(d, `font-size ${from}px`, centered ? r.x + r.w / 2 - 50 : r.x, r.y - 22, 'font');
            d.style(t, 'transition', 'scale 0.55s cubic-bezier(0.2, 0.7, 0.2, 1)');
            d.style(t, 'scale', '1');
            a.follow = () => { const rr = t.getBoundingClientRect(); return { x: rr.right - 4, y: rr.bottom - 4 }; };
            const t0 = performance.now();
            for (;;) {
                if (!alive()) return;
                const k = Math.min(1, (performance.now() - t0) / 550);
                b.textContent = `font-size ${Math.round(from + (size - from) * k)}px`;
                if (k >= 1) break;
                await wait(40);
            }
            if (!await pause(alive, 180)) return;
            fade(d, b);
        }

        // alignment: the block snaps onto its guide line
        async function opAlign(a, d, alive) {
            const t = d.el.querySelector('h1, h2, h3') || d.el;
            const centered = getComputedStyle(t).textAlign === 'center';
            const r = docRect(t);
            const off = centered ? -Math.min(80, r.w * 0.18) : -28;
            d.style(t, 'transition', 'none');
            d.style(t, 'translate', `${off}px 0`);
            void t.offsetWidth;
            setTask(a, centered ? 'align center' : 'align left');
            const gx = centered ? r.x + r.w / 2 : r.x;
            const g = overlay(d, 'op-guide');
            place(g, gx, r.y - 14, 1, r.h + 28);
            const b = badge(d, centered ? 'text-align: center' : 'x 0 · snap', gx + 6, r.y - 24, 'guide');
            a.follow = () => { const rr = t.getBoundingClientRect(); return { x: centered ? rr.left + rr.width / 2 : rr.left, y: rr.top + rr.height / 2 }; };
            if (!await pause(alive, 180)) return;
            d.style(t, 'transition', 'translate 0.45s cubic-bezier(0.2, 0.7, 0.2, 1)');
            d.style(t, 'translate', '0px 0px');
            if (!await pause(alive, 560)) return;
            fade(d, g);
            fade(d, b);
        }

        // colour: pick the layer's accent from the palette, then fill
        function accentOf(el) {
            for (const n of [el, ...el.querySelectorAll('*')].slice(0, 40)) {
                const cs = getComputedStyle(n);
                for (const c of [cs.backgroundColor, cs.color, cs.borderTopColor]) {
                    const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(c);
                    if (m && (m[4] === undefined || +m[4] > 0.5) && +m[1] > 200 && +m[2] < 110 && +m[3] < 110) return [+m[1], +m[2], +m[3]];
                }
            }
            return [255, 42, 42];
        }
        async function opColor(a, d, alive) {
            const hex = '#' + accentOf(d.el).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
            const r = docRect(d.el);
            setTask(a, 'fill colour');
            a.follow = () => { const rr = d.el.getBoundingClientRect(); return { x: rr.right - 34, y: rr.top + 6 }; };
            const b = badge(d, `<i style="background:${hex}"></i>${hex}`, r.x + r.w - 96, r.y - 22, 'color');
            if (!await pause(alive, 280)) return;
            d.el.classList.add('is-colored');
            if (!await pause(alive, 440)) return;
            fade(d, b);
        }

        // image: a grey placeholder, then the real file drops in
        async function opImage(a, d, alive) {
            const img = d.el.querySelector('img');
            if (!img) return;
            const r = docRect(img);
            setTask(a, 'place image');
            const o = overlay(d, 'op-img', `<span>${escapeHtml((img.getAttribute('src') || '').split('/').pop())}</span>`);
            place(o, r.x, r.y, r.w, r.h);
            a.follow = () => { const rr = img.getBoundingClientRect(); return { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 }; };
            bump();
            if (!await pause(alive, 560)) return;
            const b = badge(d, `${img.naturalWidth || img.width} × ${img.naturalHeight || img.height}`, r.x, r.y + r.h + 4, 'img');
            o.classList.add('is-out');
            if (!await pause(alive, 460)) return;
            fade(d, b);
        }

        // which operations a layer gets, by what it is
        function planFor(el) {
            const kind = el.dataset.build;
            // a typing op; its prep() empties the text before the selection box is drawn
            const T = (root, opts) => Object.assign((a, d, alive) => opType(a, d, root, alive, opts), { prep: (d) => blank(d, root) });
            const base = el.classList[0];
            let src = el.previousElementSibling;
            while (src && src.classList[0] !== base) src = src.previousElementSibling;
            if (!base || !src || !src.classList.contains('is-built')) src = null;
            const title = el.querySelector('h2, h3, .kv-v');

            if (kind === 'nav') return [opBox, opColor];
            if (kind === 'svg.display') return [opFont, opColor];
            if (kind === 'figure.portrait') return [opImage, opColor];
            if (kind === 'h1.name') return [T(el), opColor];
            if (/^h[1-3]\./.test(kind)) return [T(el, { placeholder: true }), opFont, opAlign];
            if (/^(card|li)\./.test(kind)) {
                if (src && title) return [(a, d, alive) => opCopy(a, d, src, alive)];
                return title ? [opBox, T(title)] : [opBox, opColor];
            }
            if (kind === 'div.sys-head') return [T(el, { placeholder: Math.random() < 0.5 })];
            if (kind === 'blockquote.creed') return [T(el), opBox];
            if (kind === 'p.role') return [T(el), opAlign];
            if (kind === 'dl.stats') return [T(el, { typo: false }), opColor];
            if (kind === 'div.index' || kind === 'footer' || /^(p|ul)\./.test(kind)) return [T(el)];
            return [opBox, opColor]; // demos, buttons, chips, ticker, filters
        }

        // the selection box: grows from the cursor with a live size badge
        function frameBox(a, el) {
            const r = el.getBoundingClientRect();
            const w = document.createElement('div');
            w.className = 'wire is-tagged';
            w.style.left = (r.left + scrollX) + 'px';
            w.style.top = (r.top + scrollY) + 'px';
            w.innerHTML = '<i class="wh wh-tr"></i><i class="wh wh-bl"></i><span class="wire-tag">0 × 0</span>';
            ui.boxes.appendChild(w);
            void w.offsetWidth;
            w.style.width = r.width + 'px';
            w.style.height = r.height + 'px';
            a.follow = () => { const rr = el.getBoundingClientRect(); return { x: rr.right - 6, y: rr.bottom - 6 }; };
            setTask(a, 'resize');
            bump();
            const tag = w.querySelector('.wire-tag');
            const t0 = performance.now();
            const count = (now) => {
                const k = Math.min(1, (now - t0) / 440);
                const e = 1 - Math.pow(1 - k, 3);
                tag.textContent = `${Math.round(r.width * e)} × ${Math.round(r.height * e)}`;
                if (k < 1 && w.isConnected) requestAnimationFrame(count);
            };
            requestAnimationFrame(count);
            return w;
        }

        async function runJob(a, el, myGen) {
            a.job = el;
            assigned.add(el);
            a.el.classList.add('is-live');
            const topLeft = () => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top }; };
            a.follow = topLeft;

            const t0 = performance.now();
            await new Promise((res) => {
                const check = () => {
                    const p = topLeft();
                    if (myGen !== gen || Math.hypot(p.x - a.x, p.y - a.y) < 8 || performance.now() - t0 > 750) res();
                    else requestAnimationFrame(check);
                };
                check();
            });
            if (myGen !== gen) return;

            if (!el.classList.contains('is-built')) {
                const d = startDraft(el);
                const alive = () => myGen === gen && !d.done;
                let w = null;
                try {
                    const plan = planFor(el);
                    plan.forEach((op) => { if (op.prep) op.prep(d); });
                    w = frameBox(a, el);
                    if (await pause(alive, 480)) {
                        for (const op of plan) {
                            if (!alive()) break;
                            await op(a, d, alive);
                        }
                    }
                    if (alive()) {
                        setTask(a, 'apply styles');
                        el.classList.add('is-colored');
                        await pause(alive, 260);
                    }
                } catch (e) {
                    console.warn('[swarm] operation failed, finishing the layer as is', e); // never leave a layer half-built
                }
                if (myGen !== gen) return;
                d.finish();
                reveal(el);
                if (w) {
                    w.classList.add('is-done');
                    setTimeout(() => w.remove(), 360);
                }
            }

            if (myGen !== gen) return;
            a.el.classList.remove('is-ibeam');
            setTask(a, '');
            assigned.delete(el);
            a.follow = null;
            a.job = null;
            a.wanderAt = 0;
        }

        function reveal(el) {
            pending.delete(el);
            if (el.classList.contains('is-built')) return;
            el.classList.add('is-built');
            if (io) io.unobserve(el);
            built++;
            if (ui) {
                ui.built.textContent = built;
                ui.fill.style.width = (built / total * 100).toFixed(1) + '%';
            }
            // the dark theme lands once the first part of the page exists on the grey canvas
            if (!themed && built >= Math.min(8, total)) { themed = true; applyTheme(gen); }
            if (built >= total) finish();
        }

        function observe() {
            io = new IntersectionObserver((entries) => {
                const now = performance.now();
                for (const en of entries) {
                    const el = en.target;
                    if (el.classList.contains('is-built') || assigned.has(el)) continue;
                    if (en.isIntersecting) {
                        if (!pending.has(el)) { pending.add(el); seenAt.set(el, now); }
                    } else if (en.boundingClientRect.bottom <= 0) {
                        reveal(el); // scrolled past before an agent got to it
                    } else {
                        pending.delete(el);
                    }
                }
                wake();
            }, { rootMargin: '0px 0px -4% 0px' });
            layers.forEach((l) => { if (!l.classList.contains('is-built')) io.observe(l); });
        }

        // A scrollbar drag can jump a layer from below the viewport to above it without
        // it ever intersecting, so IntersectionObserver never reports it. Sweep for those.
        let sweepQueued = false;
        addEventListener('scroll', () => {
            if (!processing || sweepQueued) return;
            sweepQueued = true;
            requestAnimationFrame(() => {
                sweepQueued = false;
                if (!processing) return;
                for (const el of layers) {
                    if (el.classList.contains('is-built') || assigned.has(el)) continue;
                    if (el.getBoundingClientRect().bottom <= 0) reveal(el);
                }
            });
        }, { passive: true });

        async function start() {
            teardown();
            const myGen = ++gen;
            finished = false;
            built = 0;
            processing = false;
            window.__swarmBooted = true;
            root.classList.remove('swarm-skip');
            root.classList.add('swarm-on', 'swarm-raw'); // starts as an unstyled grey canvas
            layers.forEach((l) => l.classList.remove('is-built', 'is-op', 'is-drafting', 'is-colored'));
            edits = 0;
            themed = false;

            const small = innerWidth < 700;
            const n = small ? 8 : 16;
            ui = mountUi(n);
            spawnCrosshairs(small ? 16 : 30);
            agents = makeAgents(n);
            agents.forEach((a, i) => setTimeout(() => { if (myGen === gen) a.el.classList.add('is-live'); }, 180 + i * 45));
            setTimeout(() => { if (myGen === gen && ui) ui.hud.classList.add('is-in'); }, 250);

            last = 0;
            idleSince = performance.now();
            raf = requestAnimationFrame(tick);

            await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(1500)]);
            fitDisplayWords();
            await wait(450);
            if (myGen !== gen) return;
            clearCrosshairs();
            processing = true;
            observe();
            setTimeout(() => { if (!themed) { themed = true; applyTheme(myGen); } }, 6000);
        }

        // One agent switches the page from the grey draft canvas to the dark theme.
        async function applyTheme(myGen) {
            if (myGen !== gen || !ui || !root.classList.contains('swarm-raw')) return;
            const a = agents.find((x) => !x.job);
            const b = document.createElement('div');
            b.className = 'op-theme';
            b.innerHTML = '<i></i>theme: dark · --bg #09090A';
            ui.cursors.appendChild(b);
            bump();
            if (a) {
                a.el.classList.add('is-live');
                a.follow = () => ({ x: innerWidth / 2 + 110, y: 92 });
                setTask(a, 'theme');
            }
            await wait(520);
            if (myGen !== gen) return;
            root.classList.remove('swarm-raw');
            await wait(1100);
            b.classList.add('is-out');
            setTimeout(() => b.remove(), 300);
            if (a && !a.job) {
                a.follow = null;
                setTask(a, '');
            }
        }

        function finish() {
            if (finished) return;
            finished = true;
            processing = false;
            root.classList.remove('swarm-raw');
            if (io) { io.disconnect(); io = null; }
            const myGen = gen;
            const myUi = ui;
            if (myUi) {
                myUi.count.innerHTML = `<b>✓ ${total}/${total}</b> layers built`;
                myUi.hint.hidden = true;
                myUi.btn.hidden = true;
            }
            agents.forEach((a) => { a.follow = null; });
            setTimeout(() => agents.forEach((a) => a.el.classList.remove('is-live')), 500);
            setTimeout(() => { if (myUi) myUi.hud.classList.remove('is-in'); }, 2200);
            setTimeout(() => {
                if (myGen !== gen) return;
                cancelAnimationFrame(raf);
                raf = 0;
                root.classList.remove('swarm-on', 'swarm-skip');
                if (myUi) { myUi.cursors.remove(); myUi.boxes.remove(); myUi.hud.remove(); }
                if (ui === myUi) ui = null;
                agents = [];
            }, 2700);
        }

        function skip() {
            try { sessionStorage.setItem('swarm-skip', '1'); } catch (e) { /* storage blocked */ }
            root.classList.add('swarm-skip');
            root.classList.remove('swarm-raw');
            processing = false;
            finishAll(); // put back any text or styles an agent is halfway through editing
            layers.forEach(reveal);
        }

        function teardown() {
            finishAll();
            root.classList.remove('swarm-raw');
            gen++;
            cancelAnimationFrame(raf);
            raf = 0;
            if (io) { io.disconnect(); io = null; }
            if (ui) { ui.cursors.remove(); ui.boxes.remove(); ui.hud.remove(); ui = null; }
            agents = [];
            crosses = [];
            pending.clear();
            assigned.clear();
            seenAt.clear();
        }

        function replay() {
            if (reduceMotion) return;
            try { sessionStorage.removeItem('swarm-skip'); } catch (e) { /* storage blocked */ }
            window.scrollTo({ top: 0, behavior: 'instant' });
            start();
        }

        // Keyboard users tabbing into a layer that hasn't been built yet see it immediately.
        document.addEventListener('focusin', (e) => {
            if (!root.classList.contains('swarm-on')) return;
            const layer = e.target.closest('[data-build]');
            if (layer) reveal(layer);
        });

        return {
            start,
            replay,
            // builds a layer at once (used before something hides it, so the build can still finish)
            revealNow(el) { if (root.classList.contains('swarm-on')) reveal(el); },
        };
    }

    /* ---------- project matrix filter ---------- */
    function initMatrix(swarm) {
        const tabs = $$('.m-tab');
        const cards = $$('.lab-card[data-cat]');
        if (!tabs.length) return { reset() {} };
        const apply = (filter) => {
            // a hidden card never scrolls into view, so build it first
            if (filter !== 'all') cards.forEach((c) => swarm.revealNow(c));
            tabs.forEach((t) => {
                const on = t.dataset.filter === filter;
                t.classList.toggle('is-on', on);
                t.setAttribute('aria-pressed', String(on));
            });
            cards.forEach((c) => { c.hidden = filter !== 'all' && c.dataset.cat !== filter; });
        };
        tabs.forEach((t) => t.addEventListener('click', () => apply(t.dataset.filter)));
        return { reset: () => apply('all') };
    }

    /* ---------- boot ---------- */
    initNav();

    fitDisplayWords();
    if (document.fonts) document.fonts.ready.then(fitDisplayWords);

    const swarm = createSwarm();
    const matrix = initMatrix(swarm);
    if (root.classList.contains('swarm-on')) swarm.start();

    const replayBtn = $('#replay');
    // every card must be visible again before a fresh build starts
    if (replayBtn) replayBtn.addEventListener('click', () => { matrix.reset(); swarm.replay(); });

    const enableSmooth = () => setTimeout(() => root.classList.add('can-smooth'), 50);
    if (document.readyState === 'complete') enableSmooth();
    else addEventListener('load', enableSmooth, { once: true });
})();
