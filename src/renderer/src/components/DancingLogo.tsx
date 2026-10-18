// The sidebar's idol, moved by the music (player/logoDance.ts); the same drawing as IdolLogo.
import { useEffect, useRef } from 'react';
import { registerLogo } from '@/player/logoDance';
import { IDOL_PARTS } from './Icon';

export function DancingLogo({ size = 24, performer = false, className }: { size?: number; performer?: boolean; className?: string }) {
  const root = useRef<SVGGElement>(null);
  const head = useRef<SVGGElement>(null);
  const body = useRef<SVGGElement>(null);
  const armL = useRef<SVGGElement>(null);
  const armR = useRef<SVGGElement>(null);
  useEffect(
    () => registerLogo({ root: root.current!, head: head.current!, body: body.current!, armL: armL.current!, armR: armR.current! }, performer),
    [performer],
  );
  // a jump or spin may leave the 24px box for a moment
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ overflow: 'visible' }} className={className} data-test={performer ? 'stage-performer' : 'dancing-logo'}>
      <g ref={root}>
        <g ref={head}>{IDOL_PARTS.head}</g>
        <g ref={body}>{IDOL_PARTS.body}</g>
        <g ref={armL}>{IDOL_PARTS.armL}</g>
        <g ref={armR}>{IDOL_PARTS.armR}</g>
      </g>
    </svg>
  );
}
