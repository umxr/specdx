/**
 * The package's library surface.
 *
 * `main.ts` is the entrypoint GitHub executes and is deliberately not exported
 * -- importing it would run the action. Everything here is a pure renderer the
 * entrypoint composes, exported so the modules have a caller other than their
 * own tests. `export {}` is what let both of these sit unreachable for a
 * release while their tests stayed green.
 */
export { formatComment, postComment, COMMENT_MARKER } from "./comment.js";
export type { CommentOutcome, PostCommentOptions } from "./comment.js";
export { generateBadge } from "./badge.js";
export type { BadgeStatus } from "./badge.js";
