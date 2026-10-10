import { MessagesSquare } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ChatWorkspace } from '../../components/chat/ChatWorkspace.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

// Real-time, end-to-end encrypted chat: the community rooms for your role,
// private chats with people you can reach, and (for organization
// administrators) the line to the platform team.
export default function ChatPage() {
  useDocumentTitle('Chat');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={MessagesSquare} eyebrow="Community" title="Chat" description="Talk in real time — messages are end-to-end encrypted." />
      <ChatWorkspace />
    </div>
  );
}
