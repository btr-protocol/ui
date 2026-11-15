import { importTexts } from '../lib/importGuard';
import { BaseModal } from '../ui/BaseModal';
import { ImportFailureNotice } from '../ui/ImportFailureNotice';

export { ImportFailureNotice, canReload, useFailureNotice, useOnline } from '../ui/ImportFailureNotice';

/** A modal chunk (connect / account) that failed to load: the notice in a normal modal body. The modal's own close button dismisses it. */
export function ImportFailureModal({ failure, onClose, title = importTexts().title }: { failure: Error; onClose: () => void; title?: string }) {
  return (
    <BaseModal isOpen onClose={onClose} title={title} headerType="title" size="sm">
      <ImportFailureNotice failure={failure} className="p-4" />
    </BaseModal>
  );
}
