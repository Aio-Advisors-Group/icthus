import type { ReactNode } from 'react';
import { EmptyState, LinkButton } from '../components/ui';

export default function NotFound(): ReactNode {
  return (
    <div className="pt-10">
      <EmptyState
        glyph="◒"
        title="There is nothing at this address"
        body="The link may be old, or the page may have moved. Today is always a good place to start again."
        action={<LinkButton to="/">Go to Today</LinkButton>}
      />
    </div>
  );
}
