import type { SVGProps } from 'react';

/**
 * A person in a jacket over a collared shirt — used for judges. Drawn to match Tabler's outline
 * style (24×24 grid, 2px round strokes, currentColor), since Tabler has no suited-person icon.
 */
export function IconJudge({ size = 24, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* head */}
      <circle cx="12" cy="6" r="3" />
      {/* jacket: shoulders down to the hem */}
      <path d="M4 21v-2a6 6 0 0 1 6 -6h4a6 6 0 0 1 6 6v2" />
      {/* jacket front: lapels run from the shoulders down to the hem */}
      <path d="M8 13.5l4 7.5l4 -7.5" />
      {/* shirt collar at the neck */}
      <path d="M10.5 13l1.5 2.5l1.5 -2.5" />
    </svg>
  );
}
