/**
 * Maps the user's reduced-motion preference to an explicit scroll behavior.
 *
 * CSS `scroll-behavior` cannot override an explicit `behavior` passed to
 * `scrollIntoView`/`scrollTo`, so callers must honour the preference directly.
 */
export function scrollBehavior(
    reduceMotion: boolean | null | undefined,
): ScrollBehavior {
    return reduceMotion ? "auto" : "smooth";
}
