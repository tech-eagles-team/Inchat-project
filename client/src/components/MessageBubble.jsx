import { FiCheck, FiDownload } from 'react-icons/fi';
import { MdDoneAll } from 'react-icons/md';
import ReactPlayer from 'react-player';

export default function MessageBubble({ message, isOwn }) {
  const formatTime = (dateValue) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getReadStatus = () => {
    if (!isOwn) return null;
    if (message.readBy?.length > 0) {
      return <MdDoneAll className="w-4 h-4 text-blue-500" />;
    }
    if (message.deliveredTo?.length > 1) {
      return <MdDoneAll className="w-4 h-4 text-gray-900 dark:text-gray-100" />;
    }
    return <FiCheck className="w-4 h-4 text-gray-900 dark:text-gray-100" />;
  };

  const renderContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <div className="whitespace-pre-wrap break-words">
            {message.content?.text || message.encryptedContent || 'Encrypted message'}
          </div>
        );

      case 'image':
        return (
          <div>
            <img
              src={`/api/uploads/${message.content.mediaUrl}`}
              alt=""
              className="max-w-xs rounded-lg cursor-pointer"
              onClick={() => window.open(`/api/uploads/${message.content.mediaUrl}`, '_blank')}
            />
            {message.content.text && (
              <div className="mt-2 whitespace-pre-wrap break-words">
                {message.content.text}
              </div>
            )}
          </div>
        );

      case 'video':
        return (
          <div>
            {message.content.mediaUrl && (
              <ReactPlayer
                url={`/api/uploads/${message.content.mediaUrl}`}
                controls
                width="100%"
                height="auto"
                className="max-w-xs"
              />
            )}
            {message.content.text && (
              <div className="mt-2 whitespace-pre-wrap break-words">
                {message.content.text}
              </div>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="flex items-center gap-2">
            <audio controls className="max-w-xs">
              <source src={`/api/uploads/${message.content.mediaUrl}`} />
            </audio>
          </div>
        );

      case 'document':
        return (
          <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-dark-700 rounded-lg max-w-xs">
            <div className="text-3xl flex-shrink-0">📄</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white truncate">
                {message.content.fileName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {(message.content.fileSize / 1024).toFixed(1)} KB
              </div>
            </div>
            <a
              href={`/api/uploads/${message.content.mediaUrl}`}
              download={message.content.fileName}
              className="flex-shrink-0 p-2 text-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900 rounded-lg transition-colors"
              title="Download file"
            >
              <FiDownload className="w-5 h-5" />
            </a>
          </div>
        );

      default:
        return <div>Unsupported message type</div>;
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`chat-bubble ${isOwn ? 'chat-bubble-sent' : 'chat-bubble-received'}`}>
        {message.replyTo && (
          <div className={`mb-2 p-2 rounded border-l-4 ${isOwn ? 'bg-primary-400 border-primary-600' : 'bg-gray-100 dark:bg-dark-600 border-gray-300'
            }`}>
            <div className="text-xs font-semibold opacity-75">
              {message.replyTo.senderId?.username || 'Unknown'}
            </div>
            <div className="text-xs truncate">
              {message.replyTo.content?.text || 'Message'}
            </div>
          </div>
        )}

        {renderContent()}

        <div className={`mt-1 flex items-center gap-1 text-[11px] ${isOwn ? 'justify-end text-white/90' : 'justify-end text-gray-500 dark:text-gray-400'}`}>
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && getReadStatus()}
        </div>
      </div>
    </div>
  );
}

