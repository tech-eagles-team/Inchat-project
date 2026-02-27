import { useState, useRef, useEffect } from 'react';
import { FiSmile, FiPaperclip, FiSend, FiMic, FiX } from 'react-icons/fi';
import EmojiPicker from 'emoji-picker-react';
import { socketService } from '../services/socket';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

export default function MessageInput({ onSend, chatId }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const { isRecording, startRecording, stopRecording, audioBlob, resetAudioBlob } = useVoiceRecorder();

  useEffect(() => {
    if (audioBlob) {
      const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      handleSendMessage('audio', null, audioFile);
      resetAudioBlob();
    }
  }, [audioBlob]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const handleSend = () => {
    if (text.trim()) {
      handleSendMessage('text', text.trim());
      setText('');
      setShowEmoji(false);
    }
  };

  const handleSendMessage = (type, textContent = null, media = null, replyTo = null) => {
    onSend(textContent, type, media, replyTo);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const type = file.type.startsWith('image/') ? 'image' :
      file.type.startsWith('video/') ? 'video' :
        file.type.startsWith('audio/') ? 'audio' : 'document';

    handleSendMessage(type, null, file);
    setShowMedia(false);
  };

  const handleEmojiClick = (emojiData) => {
    setText(text + emojiData.emoji);
    setShowEmoji(false);
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="bg-white dark:bg-dark-800 border-t border-gray-200 dark:border-dark-700 p-4">
      {showMedia && (
        <div className="mb-2 p-2 bg-gray-50 dark:bg-dark-700 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Select media</span>
            <button
              onClick={() => setShowMedia(false)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-dark-600 rounded"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm"
            >
              Choose File
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            onKeyPress={handleKeyPress}
            placeholder="Type a message"
            rows={1}
            className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-white resize-none max-h-32 overflow-y-auto"
          />
          {showEmoji && (
            <div className="absolute bottom-full right-0 mb-2">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme="dark"
                width={350}
                height={400}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <FiSmile className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          <button
            onClick={() => setShowMedia(!showMedia)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <FiPaperclip className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {text.trim() ? (
            <button
              onClick={handleSend}
              className="p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <FiSend className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleVoiceRecord}
              className={`p-2 rounded-lg transition-colors ${isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400'
                }`}
            >
              <FiMic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {isRecording && (
        <div className="mt-2 text-center text-sm text-red-500">
          Recording... Click again to stop
        </div>
      )}
    </div>
  );
}

