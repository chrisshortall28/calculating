type Point = [number, number];

/**
 * A ribbon along a cubic curve from `from` to `to`: sharp at both ends and swelling to about
 * ¾ × `thickness` in the middle.
 */
function ribbon(from: Point, c1: Point, c2: Point, to: Point, thickness: number, fill: string, opacity = 1) {
  const p = ([x, y]: Point, dy = 0) => `${x} ${y + dy}`;
  return (
    `<path d="M${p(from)} C${p(c1)} ${p(c2)} ${p(to)} C${p(c2, thickness)} ${p(c1, thickness)} ${p(from)} Z"` +
    ` fill="${fill}" fill-opacity="${opacity}" />`
  );
}

/**
 * The programme cover's artwork, a page-sized SVG: flowing ribbons in the club colours sweeping
 * across the top of the page, and a lower one along the foot, leaving a clear band for the title
 * between them (from about 540 to 740 points down).
 */
export function coverSwooshes(
  width: number,
  height: number,
  { background, accent, contrast }: { background: string; accent: string; contrast: string },
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="${background}" />
  ${ribbon([-60, 250], [150, 20], [400, 330], [660, 40], 150, contrast, 0.07)}
  ${ribbon([-60, 520], [220, 300], [380, 620], [660, 330], 110, contrast, 0.06)}
  ${ribbon([-60, 420], [170, 180], [390, 520], [660, 200], 60, accent, 0.45)}
  ${ribbon([-60, 470], [190, 230], [380, 560], [660, 250], 85, accent)}
  ${ribbon([-60, 380], [200, 120], [420, 440], [660, 120], 10, accent, 0.8)}
  ${ribbon([-60, 520], [230, 330], [360, 600], [660, 340], 6, contrast, 0.5)}
  ${ribbon([-60, 845], [180, 740], [420, 880], [660, 770], 70, accent)}
  ${ribbon([-60, 820], [200, 730], [400, 850], [660, 740], 20, contrast, 0.12)}
</svg>`;
}
