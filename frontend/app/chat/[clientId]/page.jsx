'use client';
import { useParams }   from 'next/navigation';
import ChatWindow      from '../../../components/chat/ChatWindow';

export default function ChatPage() {
  const { clientId } = useParams();
  // clientId here is actually the API key passed in embed or URL
  // For standalone URL, clientId = the enterprise client's UUID (public)
  // The actual API auth uses X-Client-Key header
  return (
    <div className="flex flex-col h-screen bg-bg">
      <ChatWindow clientKey={clientId} mode="standalone" />
    </div>
  );
}
