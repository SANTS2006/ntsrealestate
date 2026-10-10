import { MessagesSquare } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ChatWorkspace } from '../../components/chat/ChatWorkspace.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

// A support conversation per company: the organization's administrators on one
// side, the platform team on the other. End-to-end encrypted like all chat.
export default function PlatformAdminSupportPage() {
  useDocumentTitle('Support chat — Platform Admin');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={MessagesSquare} eyebrow="Platform" title="Support chat" description="Talk with each company's administrators in real time." />
      <ChatWorkspace />
    </div>
  );
}
