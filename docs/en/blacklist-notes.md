# Built-in blacklist: decision record

<!-- translated-from: docs/zh/blacklist-notes.md sha256:3e5c363cd3e7 -->

This document records the rationale, evidence tier and verification status of every
decision behind the built-in blacklist (the `BLACKLIST` constant in the script). The
default list is a snapshot **proposed by an agent (AI assistant) and tacitly accepted
by the maintainer** — not the product of per-site testing. Making that explicit keeps
future add/remove discussions grounded, and keeps the "AI knowledge snapshot" lineage
visible instead of buried in an unsigned comment.

Governance principles (apply throughout):

1. The burden of proof for defaults lies with the proposer (the agent); maintainer
   non-interference is not an endorsement;
2. The management panel guarantees defaults can always be overturned: built-in entries
   can be disabled but not deleted, and users can add their own;
3. Storage only records the diff against the defaults (added/disabled), so new built-in
   entries brought by script updates take effect automatically;
4. The script intercepts keys in the capture phase with `stopImmediatePropagation` —
   **taking over kills the site's own listeners**, so conflict cost is the primary
   criterion for deferral decisions, not "whether the site has hotkeys".

## Evidence tiers

| Tier | Meaning |
| --- | --- |
| A | Official docs: the site's help pages publish a shortcut table |
| B | Training knowledge: the agent's model knowledge, unverified, possibly stale |
| C | Structural conflict: arrow-key semantics clash with ours regardless of shortcut tables |
| D | Tested: verified key by key by the maintainer on the real site (no site reaches this tier yet) |

## Current list (effective since v1.7.0)

| Site | Tier | Rationale | Last verified |
| --- | --- | --- | --- |
| `iqiyi.com` | B | Training knowledge: has its own keyboard handling (Space/arrows/F/M etc.), no public shortcut docs, details unverified | never |
| `youku.com` | B | Same as above | never |
| `v.qq.com` | B | Same as above | never |
| `netflix.com` | A | Official help pages list the shortcut table: Space, arrows ±5s, J/L ±10s, F, M | knowledge from this session, not re-checked online |
| `twitch.tv` | A | Official help pages list player shortcuts: Space/K, arrow seek for VODs, F, M | same as above |
| `douyin.com` | C | Structural conflict: on the web, ↑/↓ is the core "previous/next video" interaction and clashes directly with the volume keys | never |
| `tiktok.com` | C | Same as douyin | never |

## Removal record

| Site | Removed in | Rationale | Proposed by |
| --- | --- | --- | --- |
| `bilibili.com` | before v1.2.2 (noted in the original script comment) | Native hotkeys unreliable — the premise of deferring (that the other side handles keys well) failed, leaving both sides inactive; taking over unified the experience | agent (initial script session), maintainer non-interference |
| `youtube.com` | v1.7.0 (2026-11-16) | Embedded YouTube players on third-party pages have no iframe focus, so native hotkeys are dead there and deferral also blocked our key forwarding; Space/arrows semantics match ours so the takeover is conflict-free, while f/m/j/l and number keys stay with YouTube | agent (this session), maintainer requested the change |

## TODO

- The three Chinese sites (iQiyi/Youku/Tencent Video) are the thinnest: awaiting maintainer
  testing (Space/arrows/↑↓/F/M behavior, especially what is lost under takeover); each tested
  site gets upgraded to tier D;
- Netflix/Twitch official doc URLs to be re-checked and recorded when network access allows;
- If a default entry gets disabled by many users, consider removing it from the defaults
  (following the bilibili/youtube precedent).
